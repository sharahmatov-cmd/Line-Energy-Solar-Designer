const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const temp = path.join(os.tmpdir(), `line-energy-roof-interaction-${Date.now()}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(port) {
  let target;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = targets.find((item) => item.type === "page");
      if (target) break;
    } catch (_) { /* Chrome may still be starting. */ }
    await sleep(100);
  }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  });
  ws.addEventListener("close", () => {
    pending.forEach((call) => call.reject(new Error("Browser connection closed")));
    pending.clear();
  });
  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Browser command timed out: ${method}`));
        }, 15000);
        pending.set(id, {
          resolve: (result) => { clearTimeout(timer); resolve(result); },
          reject: (error) => { clearTimeout(timer); reject(error); },
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => ws.close(),
  };
}

(async () => {
  fs.mkdirSync(temp, { recursive: true });
  const source = fs.readFileSync(path.join(root, "Web/app.js"), "utf8");
  // Expose private state only in this isolated test fixture, never in the application.
  const instrumented = source.replace("  async function startCalculator() {", `
  window.roofTest = { roofLayoutState, selectedPanelIndices, selectedRows,
    buildRoofLayout, normalizeLayoutPanel, drawRoofLayout, saveActiveLayoutSlope,
    safeCalculate, snapLayoutPanel, validPanelPlacement };
  async function startCalculator() {`);
  assert.notEqual(instrumented, source, "Test instrumentation marker missing");
  const fixture = fs.readFileSync(path.join(root, "Web/index.html"), "utf8")
    .replace("<head>", `<head><base href="${pathToFileURL(path.join(root, "Web/")).href}">`)
    .replace('<script src="app.js"></script>', () => `<script>${instrumented.replaceAll("</script", "<\\/script")}</script>`);
  const fixturePath = path.join(temp, "index.html");
  fs.writeFileSync(fixturePath, fixture);
  const port = 11500 + Math.floor(Math.random() * 1000);
  const chrome = spawn(chromePath, ["--headless=chrome", "--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox", "--no-first-run", "--no-default-browser-check",
    "--allow-file-access-from-files", `--user-data-dir=${path.join(temp, "profile")}`,
    `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let cdp;
  try {
    cdp = await connect(port);
    const evaluate = async (expression) => {
      const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: pathToFileURL(fixturePath).href });
    for (let i = 0; i < 100; i++) {
      if (await evaluate("!!window.roofTest && !!window.LINE_ENERGY_REPORTS")) break;
      await sleep(100);
    }
    assert.equal(await evaluate("!!window.roofTest"), true, "Application did not initialize");
    await evaluate(`(() => {
      const t = roofTest, s = t.roofLayoutState;
      document.getElementById('layoutRoofWidth').value = 10;
      document.getElementById('layoutRoofHeight').value = 8;
      const layout = t.buildRoofLayout(t.selectedRows().panel);
      s.manual = true;
      s.panels = [0, 1, 2].map(i => t.normalizeLayoutPanel({
        x: 1 + i * (layout.panelW + layout.gap), y: 1,
        stringId: 1, pvInput: 'PV 1'
      }, layout));
      s.rails = []; s.selected = -1; s.selectedPanels = [];
      t.drawRoofLayout(t.selectedRows().panel); t.saveActiveLayoutSlope();
      document.getElementById('roofLayoutCanvas').scrollIntoView({block: 'center'});
    })()`);
    const state = () => evaluate("JSON.parse(JSON.stringify(roofTest.roofLayoutState.panels))");
    const screenPoint = (x, y) => evaluate(`(() => {
      const c = document.getElementById('roofLayoutCanvas'), r = c.getBoundingClientRect();
      const d = roofTest.roofLayoutState.draw;
      return {x:r.left+(d.roofX+${x}*d.scale)*r.width/c.width,
        y:r.top+(d.roofY+${y}*d.scale)*r.height/c.height};
    })()`);
    const center = async (index) => {
      const panels = await state(), p = panels[index];
      return screenPoint(p.x + p.w / 2, p.y + p.h / 2);
    };
    const click = async (index, modifiers = 0) => {
      const point = await center(index);
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1, modifiers });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", buttons: 0, clickCount: 1, modifiers });
    };
    const drag = async (index, x, y) => {
      const panels = await state(), p = panels[index], from = await center(index);
      const to = await screenPoint(x + p.w / 2, y + p.h / 2);
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1, clickCount: 1 });
      assert.equal(await evaluate("roofTest.roofLayoutState.drag?.type"), "panel", `Panel drag did not start at ${JSON.stringify(from)}`);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...to, button: "left", buttons: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", buttons: 0, clickCount: 1 });
    };
    const before = await state();
    await drag(0, 1, 4);
    let after = await state();
    assert.ok(Math.abs(after[0].y - 4) < 1e-5, "Single panel did not move");
    assert.deepEqual(after.slice(1), before.slice(1), "Other panels in the string moved");
    assert.equal(after[0].stringId, 1, "Moving a panel changed its string");
    await click(1, 2);
    await click(2, 2);
    await click(1, 2);
    assert.deepEqual(await evaluate("roofTest.selectedPanelIndices()"), [0, 2], "Ctrl toggle lost the original selection");
    await evaluate("document.getElementById('layoutMakeStringBtn').click()");
    after = await state();
    assert.equal(after[0].stringId, after[2].stringId, "Selected panels were not grouped into a string");
    assert.notEqual(after[0].stringId, after[1].stringId, "Unselected panel entered the new string");
    await click(0);
    assert.deepEqual(await evaluate("roofTest.selectedPanelIndices()"), [0], "Click still selects an entire string");
    await click(0, 2);
    assert.deepEqual(await evaluate("roofTest.selectedPanelIndices()"), [], "Ctrl cannot clear the last selected panel");
    const gap = await evaluate("roofTest.roofLayoutState.draw.layout.gap");
    const neighbor = after[1];
    await drag(0, neighbor.x, neighbor.y + neighbor.h + gap + 0.04);
    after = await state();
    assert.ok(Math.abs(after[0].y - neighbor.y - neighbor.h - gap) < 1e-8, "Panel did not snap vertically");
    assert.equal(after[0].x, neighbor.x, "Snapped panels are not aligned");
    await drag(0, 6, 4);
    after = await state();
    assert.ok(Math.abs(after[0].x - 6) < 1e-5, "Panel stays magnetized when moved away");
    await drag(0, neighbor.x - after[0].w - gap - 0.04, neighbor.y + 0.03);
    after = await state();
    assert.ok(Math.abs(after[0].x + after[0].w + gap - neighbor.x) < 1e-8, "Panel did not snap horizontally");
    assert.equal(after[0].y, neighbor.y);
    const snapped = after[0];
    await drag(0, neighbor.x, neighbor.y);
    assert.deepEqual((await state())[0], snapped, "Panels can be dragged over one another");
    assert.equal(await evaluate(`(() => {
      const t=roofTest, l=t.roofLayoutState.draw.layout;
      const p=t.normalizeLayoutPanel({x:7,y:4,rotated:true}, l);
      const n=t.normalizeLayoutPanel({x:4,y:4}, l);
      const raw={...p,x:n.x+n.w+l.gap+0.03};
      const result=t.snapLayoutPanel(raw,0,[raw,n],l,0.1);
      return Math.abs(result.x-n.x-n.w-l.gap)<1e-8 && result.rotated;
    })()`), true, "Rotated-panel snapping failed");
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(temp, "roof.png"), Buffer.from(screenshot.data, "base64"));
    await evaluate(`(() => {
      const t=roofTest,s=t.roofLayoutState;
      s.manual=false; s.selected=-1; s.selectedPanels=[];
      t.drawRoofLayout(t.selectedRows().panel);
      document.getElementById('roofLayoutCanvas').scrollIntoView({block:'center'});
    })()`);
    await click(0, 2);
    assert.deepEqual(await evaluate("roofTest.selectedPanelIndices()"), [0], "First Ctrl click in auto layout did not select one panel");
    await click(1, 2);
    await evaluate("document.getElementById('roofLayoutCanvas').dispatchEvent(new MouseEvent('dblclick',{ctrlKey:true,bubbles:true}))");
    assert.deepEqual(await evaluate("roofTest.selectedPanelIndices()"), [0, 1], "Ctrl double click cleared multiselection");
    console.log("PASS: single-panel drag preserves neighbors and string membership");
    console.log("PASS: Ctrl selection, deselection, string assignment, and first selection in auto layout");
    console.log("PASS: horizontal/vertical snapping, release, rotated panels, collision protection");
    console.log(`Screenshot: ${path.join(temp, "roof.png")}`);
  } finally {
    cdp?.close();
    const exited = new Promise((resolve) => chrome.exitCode !== null || chrome.signalCode !== null
      ? resolve() : chrome.once("exit", resolve));
    chrome.kill();
    await exited;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
