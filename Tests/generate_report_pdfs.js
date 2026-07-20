const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = path.join(root, "output", "pdf");
const userDataDir = path.join(root, "tmp", `chrome-report-tests-${Date.now()}`);
const appUrl = `file:///${path.join(root, "Web", "index.html").replaceAll("\\", "/")}`;

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(userDataDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (_) {
      await sleep(150);
    }
  }
  throw new Error(`Chrome DevTools did not start: ${url}`);
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  return {
    command(method, params = {}) {
      const callId = ++id;
      ws.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
    },
    close() {
      ws.close();
    },
  };
}

async function waitForApp(cdp) {
  let last = null;
  for (let i = 0; i < 80; i += 1) {
    const result = await cdp.command("Runtime.evaluate", {
      expression: `({
        ready: document.readyState,
        href: location.href,
        hasReports: !!window.LINE_ENERGY_REPORTS,
        title: document.title,
        body: document.body ? document.body.innerText.slice(0, 120) : ""
      })`,
      returnByValue: true,
    });
    last = result.result.value;
    if (last.ready === "complete" && last.hasReports) return;
    await sleep(100);
  }
  throw new Error(`Application did not become ready: ${JSON.stringify(last)}`);
}

function scenarioScript(name, mode = "commercial") {
  return `
    (async () => {
      const el = (id) => document.getElementById(id);
      const setValue = (id, value) => {
        const node = el(id);
        if (!node) return;
        node.value = String(value);
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const setSelectByText = (id, text) => {
        const node = el(id);
        if (!node) return;
        const option = [...node.options].find((item) => item.textContent.includes(text) || item.value.includes(text));
        if (option) setValue(id, option.value);
      };

      setSelectByText("region", "Белгород");
      setValue("monthlyConsumption", ${name === "long" ? 20000 : 1000});
      setSelectByText("panel", "${name === "long" ? "Jinko" : "JKM575"}");
      setSelectByText("inverterBrand", "Deye");
      setSelectByText("inverterType", "${name === "noBattery" ? "Сетевой" : "Гибридный"}");
      setSelectByText("inverterPhase", "${name === "noBattery" ? "3" : "1"}");
      setSelectByText("inverter", "${name === "noBattery" ? "G06" : "SUN-8K-SG05LP1-EU-AM2-P"}");
      setValue("batteryQty", ${name === "noBattery" ? 0 : name === "long" ? 10 : 2});
      setValue("roofSlopeCount", 1);
      setValue("layoutRoofShape", "rect");
      setValue("layoutRoofWidth", ${name === "long" ? 32 : 10});
      setValue("layoutRoofHeight", ${name === "long" ? 18 : 6});
      setValue("layoutRoofTopWidth", ${name === "long" ? 32 : 10});
      setValue("layoutMaxPanels", ${name === "long" ? 240 : 16});
      el("layoutAutoBtn")?.click();
      el("applyLayoutToSlopeBtn")?.click();
      el("calculateBtn")?.click();
      await new Promise((resolve) => setTimeout(resolve, 250));

      const mode = "${mode}";
      const html = window.LINE_ENERGY_REPORTS.reportMarkup(mode);
      document.body.classList.add("reportMode");
      document.body.innerHTML = '<section id="reportView" class="reportView">' + html + '</section>';
      const cover = document.querySelector('[data-report-section="cover"]');
      return {
        mode,
        sectionOrder: [...document.querySelectorAll("[data-report-section]")].map((item) => item.dataset.reportSection),
        coverText: cover ? cover.innerText : "",
        bodyText: document.body.innerText,
        badValues: /undefined|null|NaN/.test(document.body.innerText),
        hasCover: !!cover,
      };
    })()
  `;
}

async function renderScenario(cdp, scenario, outputName, mode = "commercial") {
  await cdp.command("Page.navigate", { url: appUrl });
  await waitForApp(cdp);
  const evalResult = await cdp.command("Runtime.evaluate", {
    expression: scenarioScript(scenario, mode),
    awaitPromise: true,
    returnByValue: true,
  });
  const result = evalResult.result.value;
  if (!result.hasCover) throw new Error(`${scenario}: cover section was not rendered`);
  if (result.badValues) throw new Error(`${scenario}: report contains undefined/null/NaN`);
  if (result.sectionOrder[0] !== "cover") throw new Error(`${scenario}: first section is not cover`);
  ["Voc", "Vmp", "Isc", "Imp", "MPPT", "datasheet", "по чертежу"].forEach((term) => {
    if (result.coverText.includes(term)) throw new Error(`${scenario}: commercial cover leaks ${term}`);
  });
  if (mode === "commercial") {
    [
      "Инженерное приложение",
      "Расчет стрингов",
      "Расчёт MPPT",
      "Годовая экономия",
      "Ориентировочная годовая экономия",
      "Окупаемость",
      "Зеленый тариф",
      "Зелёный тариф",
      "Часто задаваемые вопросы",
    ].forEach((term) => {
      if (result.bodyText.includes(term)) throw new Error(`${scenario}: standard report leaks ${term}`);
    });
  }
  if (mode === "full" && !result.bodyText.includes("Инженерное приложение")) {
    throw new Error(`${scenario}: full report does not include engineering appendix`);
  }
  if (scenario !== "noBattery") {
    if (!result.bodyText.includes("Резерв критичных нагрузок")) throw new Error(`${scenario}: reserve KPI is missing`);
    if (!result.bodyText.includes("при средней нагрузке 400 Вт")) throw new Error(`${scenario}: reserve load caption is missing`);
    if (!result.bodyText.includes("не менее 5 кВт")) throw new Error(`${scenario}: winter generator minimum is missing`);
    if (!result.bodyText.includes("6-8 кВт")) throw new Error(`${scenario}: winter generator preferred range is missing`);
  }
  if (scenario === "noBattery" && result.bodyText.includes("Рекомендация для зимнего периода")) {
    throw new Error(`${scenario}: generator recommendation should be hidden for grid/no battery`);
  }
  if (result.bodyText.includes("не число")) throw new Error(`${scenario}: report contains invalid percent text`);
  if (/[?]{2,}/.test(result.bodyText)) throw new Error(`${scenario}: report contains broken unknown symbols`);
  if (!result.bodyText.includes("Продажа излишков")) throw new Error(`${scenario}: surplus sale summary is missing`);
  if (!result.bodyText.includes("кВт·ч/год")) throw new Error(`${scenario}: annual surplus energy unit is missing`);
  [
    "ПоказательЗначение",
    "ОборудованиеОписание",
    "РазделСтоимость",
    "ПараметрЗначение",
    "УсловиеОписание",
    "ПолеЗначение",
  ].forEach((term) => {
    if (result.bodyText.includes(term)) throw new Error(`${scenario}: report text is merged: ${term}`);
  });
  const pdf = await cdp.command("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 0.25,
    marginBottom: 0.25,
    marginLeft: 0.25,
    marginRight: 0.25,
  });
  const outPath = path.join(outputDir, outputName);
  fs.writeFileSync(outPath, Buffer.from(pdf.data, "base64"));
  return { scenario, outputName, sectionOrder: result.sectionOrder };
}

(async () => {
  if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
  const port = 9333 + Math.floor(Math.random() * 1000);
  const chrome = spawn(chromePath, [
    "--headless=chrome",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--allow-file-access-from-files",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    "about:blank",
  ], { stdio: "ignore" });

  try {
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!pageTarget) throw new Error("No Chrome page target was found");
    const cdp = await connect(pageTarget.webSocketDebuggerUrl);
    await cdp.command("Page.enable");
    await cdp.command("Runtime.enable");

    const results = [];
    results.push(await renderScenario(cdp, "full", "standard-commercial-proposal.pdf", "commercial"));
    results.push(await renderScenario(cdp, "full", "full-commercial-with-engineering.pdf", "full"));
    results.push(await renderScenario(cdp, "noBattery", "grid-system-no-battery.pdf", "commercial"));
    results.push(await renderScenario(cdp, "full", "hybrid-system-generator-recommendation.pdf", "commercial"));

    const orderResult = await cdp.command("Runtime.evaluate", {
      expression: `window.LINE_ENERGY_REPORTS.sectionOrder("full")`,
      returnByValue: true,
    });
    if (orderResult.result.value[0] !== "cover" || !orderResult.result.value.includes("engineeringCover")) {
      throw new Error("full report order is invalid");
    }

    cdp.close();
    console.log(JSON.stringify({ ok: true, outputDir, results, fullOrder: orderResult.result.value }, null, 2));
  } finally {
    chrome.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
