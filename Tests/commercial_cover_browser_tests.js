const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = path.join(root, "tmp", `chrome-cover-browser-tests-${Date.now()}`);
const appUrl = `file:///${path.join(root, "Web", "index.html").replaceAll("\\", "/")}`;

fs.mkdirSync(userDataDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 10000) {
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
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
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
  for (let i = 0; i < 150; i += 1) {
    const result = await cdp.command("Runtime.evaluate", {
      expression: `({
        ready: document.readyState,
        href: location.href,
        hasReports: !!window.LINE_ENERGY_REPORTS,
        title: document.title,
        body: document.body ? document.body.innerText.slice(0, 160) : ""
      })`,
      returnByValue: true,
    });
    last = result.result.value;
    if (last.ready === "complete" && last.hasReports) return;
    await sleep(100);
  }
  throw new Error(`Application did not become ready: ${JSON.stringify(last)}`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

const browserExpression = `
(() => {
  const reports = window.LINE_ENERGY_REPORTS;
  const f = reports.formatters;
  const fakePanel = { brand: "Jinko", model: "JKM575", power_stc_w: 575 };
  const fakeHybrid = { brand: "Deye", model: "SUN-8K", series: "Hybrid", nominal_ac_power_w: 8000 };
  const fakeBattery = { brand: "Pylontech", model: "US5000", nominal_energy_kwh: 4.8, dod_pct: 90 };
  const baseState = {
    rows: {},
    selectedPanel: fakePanel,
    selectedInverter: fakeHybrid,
    selectedBattery: fakeBattery,
    batteryQuantity: 2,
    panelQuantity: 16,
    annualConsumption: 12000,
    tariffValues: { retail: 8.5, export: 3.5 },
    standard: { kwp: 9.2, annual: 10752 },
    estimate: [
      { section: "Материал", qty: 1, unitPrice: 900000 },
      { section: "Работа", qty: 1, unitPrice: 150000 },
      { section: "Доставка и разгрузка", qty: 1, unitPrice: 44120 },
    ],
    validationStatus: "PASS",
    validationMessages: [],
  };
  const makeHtml = (patch) => reports.coverMarkup({ ...baseState, ...patch }, new Date("2026-07-20T12:00:00"));
  const textFromHtml = (html) => {
    const node = document.createElement("div");
    node.innerHTML = html;
    return node.innerText;
  };
  const fullVm = reports.buildCommercialCoverViewModel(baseState, new Date("2026-07-20T12:00:00"));
  const noBatteryHtml = makeHtml({ selectedBattery: { model: "Без АКБ", nominal_energy_kwh: 0 }, batteryQuantity: 0 });
  const warningText = textFromHtml(makeHtml({ validationStatus: "WARNING" }));
  const errorText = textFromHtml(makeHtml({ validationStatus: "ERROR" }));
  const unknownText = textFromHtml(makeHtml({ validationStatus: "UNKNOWN" }));
  const missingHtml = makeHtml({ standard: { kwp: 0, annual: 0 }, selectedInverter: { series: "Grid", nominal_ac_power_w: 0 } });
  const imageHtml = reports.coverMarkup({ ...baseState }, new Date("2026-07-20T12:00:00"));
  const defaultMode = reports.selectedReportMode();
  document.getElementById("reportModeEngineering").checked = true;
  document.getElementById("reportModeEngineering").dispatchEvent(new Event("change", { bubbles: true }));
  const fullMode = reports.selectedReportMode();
  const commercialText = textFromHtml(reports.reportMarkup("commercial"));
  const fullText = textFromHtml(reports.reportMarkup("full"));
  return {
    formatters: {
      rub: f.formatCurrencyRub(1091720),
      energy: f.formatEnergyKwh(7429, "кВт·ч/год"),
      power: f.formatPowerKw(9.2, "кВтп"),
      percent: f.formatPercent(62),
      date: f.formatDateRu(new Date("2026-07-20T12:00:00")),
      proposal: f.formatProposalNumber(""),
    },
    vm: {
      companyName: fullVm.company.name,
      pv: fullVm.system.pvPowerKw,
      inverter: fullVm.system.inverterPowerKw,
      battery: fullVm.system.batteryEnergyKwh,
      total: fullVm.pricing.total,
      deliveryIncluded: fullVm.pricing.deliveryIncluded,
      status: fullVm.proposal.status,
    },
    conditional: {
      withBattery: textFromHtml(makeHtml({})).includes("Ёмкость АКБ"),
      noBattery: !textFromHtml(noBatteryHtml).includes("Ёмкость АКБ"),
      noImageHole: !imageHtml.includes("projectCoverImage"),
      noClientLabel: !textFromHtml(makeHtml({})).includes("Клиент"),
      warning: warningText.includes("Требуется уточнение отдельных параметров"),
      error: errorText.includes("Конфигурация требует корректировки"),
      unknown: unknownText.includes("Параметры требуют подтверждения"),
      missing: textFromHtml(missingHtml).includes("Не рассчитано"),
      defaultReportMode: defaultMode === "commercial",
      fullReportMode: fullMode === "full",
      commercialHasNoEngineering: !commercialText.includes("Инженерное приложение"),
      fullHasEngineering: fullText.includes("Инженерное приложение"),
      noCommercialEconomy: !commercialText.includes("Годовая экономия") && !commercialText.includes("Ориентировочная годовая экономия"),
      educationalAppendixHidden: !commercialText.includes("Часто задаваемые вопросы") && !fullText.includes("Часто задаваемые вопросы"),
    },
    leaks: /Voc|Vmp|Isc|Imp|MPPT|datasheet|по чертежу|undefined|null|NaN/.test(textFromHtml(makeHtml({}))),
  };
})()
`;

(async () => {
  if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
  const port = 10400 + Math.floor(Math.random() * 1000);
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
    const cdp = await connect(pageTarget.webSocketDebuggerUrl);
    await cdp.command("Page.enable");
    await cdp.command("Runtime.enable");
    await cdp.command("Page.navigate", { url: appUrl });
    await waitForApp(cdp);

    const result = await evaluate(cdp, browserExpression);
    assert.equal(result.formatters.rub, "1 091 720 ₽");
    assert.equal(result.formatters.energy, "7 429 кВт·ч/год");
    assert.equal(result.formatters.power, "9,2 кВтп");
    assert.equal(result.formatters.percent, "62 %");
    assert.equal(result.formatters.date, "20.07.2026");
    assert.match(result.formatters.proposal, /^LE-\d{8}$/);
    assert.equal(result.vm.companyName, "Line-Energy");
    assert.equal(result.vm.pv, 9.2);
    assert.equal(result.vm.inverter, 8);
    assert.equal(result.vm.battery, 9.6);
    assert.equal(result.vm.total, 1094120);
    assert.equal(result.vm.deliveryIncluded, true);
    assert.equal(result.vm.status, "PASS");
    Object.entries(result.conditional).forEach(([name, passed]) => assert.equal(passed, true, `${name} condition failed`));
    assert.equal(result.leaks, false);
    cdp.close();
    console.log("commercial cover browser tests passed");
  } finally {
    chrome.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
