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
      hasCoverImage: imageHtml.includes("projectCoverImage") && imageHtml.includes("cover-solar-house.png"),
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

const batteryCatalogExpression = `
(() => {
  const battery = document.getElementById("battery");
  const options = () => [...battery.options].map((entry) => entry.value);
  const activeModels = options();
  const defaultModel = battery.value;
  localStorage.setItem("lineEnergyProposalArchive", JSON.stringify([{
    id: "legacy-battery-proposal",
    number: "LE-LEGACY",
    controls: {
      battery: { value: "US5000" },
      batteryQty: { value: "2" },
      systemMode: { value: "backup" },
      inverter: { value: document.getElementById("inverter").value },
    },
    estimateState: { overrides: { inverter: { unitPrice: 111111 } } },
  }]));
  document.getElementById("archiveToggleBtn").click();
  document.querySelector('[data-proposal-id="legacy-battery-proposal"][data-proposal-action="open"]').click();
  const archivedModel = battery.value;
  const archivedDisabled = battery.selectedOptions[0].disabled;
  const archivedEstimateQty = document.querySelector('#estimateTable input[data-row-id="battery"][data-field="qty"]').value;
  const report = document.createElement("div");
  report.innerHTML = window.LINE_ENERGY_REPORTS.reportMarkup("commercial");
  const archivedReport = report.textContent.includes("US5000") && report.textContent.includes("9,6 кВт·ч");
  const estimatePrice = () => document.querySelector('#estimateTable input[data-row-id="inverter"][data-field="unitPrice"]').value;
  const archivedPrice = estimatePrice();
  const inverter = document.getElementById("inverter");
  inverter.value = "SUN-6K-SG05LP1-EU-AM2-P";
  inverter.dispatchEvent(new Event("change", { bubbles: true }));
  const priceNotTransferred = estimatePrice() !== archivedPrice;
  battery.value = "QPW-ST314";
  battery.dispatchEvent(new Event("change", { bubbles: true }));
  const modelsAfterChange = options();
  document.getElementById("resetBtn").click();
  return { activeModels, defaultModel, archivedModel, archivedDisabled, archivedEstimateQty, archivedReport, archivedPrice, priceNotTransferred, modelsAfterChange };
})()
`;

const dailyBackupExpression = `
(() => {
  const byId = (id) => document.getElementById(id);
  const change = (id, value) => {
    byId(id).value = value;
    byId(id).dispatchEvent(new Event("change", { bubbles: true }));
  };
  const apply = byId("applyDailyBackupBtn");
  const estimateBatteryField = (field) => document.querySelector('#estimateTable input[data-row-id="battery"][data-field="' + field + '"]');
  change("systemMode", "backup");
  change("dailyBackupKwh", "15");
  const needsPeak = apply.disabled;
  const inverterBefore = byId("inverter").value;
  change("dailyBackupPeakKw", "4");
  const onePhase = !apply.disabled && getComputedStyle(byId("dailyBackupPhaseField")).display === "none";
  const previewOnly = byId("inverter").value === inverterBefore;
  change("battery", "QPW-ST314");
  for (const [field, value] of [["qty", "5"], ["unitPrice", "200000"]]) {
    const input = estimateBatteryField(field);
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  apply.click();
  const result = {
    needsPeak, onePhase, previewOnly,
    inverter: byId("inverter").value,
    battery: byId("battery").value,
    batteryQty: byId("batteryQty").value,
    estimateQty: estimateBatteryField("qty").value,
    estimatePrice: estimateBatteryField("unitPrice").value,
    source: byId("backupLoadSource").value,
    noCalculationError: !byId("statusNote").textContent.includes("остановился"),
  };
  const report = document.createElement("div");
  report.innerHTML = window.LINE_ENERGY_REPORTS.reportMarkup("commercial");
  result.dailyReport = report.textContent.includes("при потреблении 15 кВт·ч/сутки") &&
    report.textContent.includes("около 40,5 ч") &&
    report.textContent.includes("Расчёт по суточному потреблению");
  change("systemMode", "hybrid");
  change("inverterPhase", "three-phase");
  result.requiresPhasePeak = !byId("dailyBackupSizing").hidden && !byId("dailyBackupPhaseField").hidden && apply.disabled;
  change("dailyBackupPhaseKw", "3");
  result.threePhase = !apply.disabled && byId("dailyBackupResult").textContent.includes("до 4 кВт на фазу");
  change("systemMode", "grid");
  result.hiddenForGrid = byId("dailyBackupSizing").hidden;
  return result;
})()
`;

const deyeHvExpression = `
(async () => {
  const get = (id) => document.getElementById(id);
  const change = (id, value) => {
    get(id).value = value;
    get(id).dispatchEvent(new Event("change", { bubbles: true }));
  };
  const inverterPrice = () => document.querySelector('#estimateTable input[data-row-id="inverter"][data-field="unitPrice"]');
  change("systemMode", "hybrid");
  change("inverterBrand", "Deye");
  change("inverterType", "hybrid");
  change("inverterPhase", "three-phase");
  change("batteryQty", "1");
  const models = window.SOLAR_DATA.inverters.filter((row) => row.battery_voltage_class === "HV");
  const rows = [];
  for (const inverter of models) {
    change("inverter", inverter.model);
    await get("inverterPhoto").decode();
    const engineering = document.createElement("div");
    engineering.innerHTML = window.LINE_ENERGY_REPORTS.reportMarkup("engineering");
    const commercial = document.createElement("div");
    commercial.innerHTML = window.LINE_ENERGY_REPORTS.reportMarkup("commercial");
    rows.push({
      model: inverter.model,
      price: +inverterPrice().value,
      expectedPrice: +inverter.price_rub,
      visible: !get("inverterPhotoBox").hidden && get("inverterPhoto").naturalWidth > 100,
      photo: get("inverterPhoto").getAttribute("src").endsWith(inverter.image_url),
      description: get("inverterSpecsTable").textContent.includes(inverter.description),
      pdfLink: !!get("inverterSpecsTable").querySelector('a[href$="' + inverter.datasheet_local_url + '"]'),
      hvWarning: !get("batteryVoltageWarning").hidden && get("batteryVoltageWarning").textContent.includes("несовместима"),
      draft: get("statusNote").textContent.includes("Конфигурация требует корректировки"),
      noFakeRuntime: !get("batteryRuntimeScenarios").textContent.trim() &&
        !get("generatorChargingMetrics").textContent.trim(),
      report: engineering.textContent.includes(inverter.model) &&
        commercial.textContent.includes(inverter.description) &&
        engineering.textContent.includes("несовместима") &&
        !/NaN|undefined/.test(engineering.textContent + commercial.textContent),
    });
  }
  const first = models[0];
  const second = models[1];
  change("inverter", first.model);
  inverterPrice().value = "123456";
  inverterPrice().dispatchEvent(new Event("change", { bubbles: true }));
  change("inverter", second.model);
  const otherModelPrice = +inverterPrice().value === +second.price_rub;
  change("inverter", first.model);
  const retainedManualPrice = +inverterPrice().value === 123456;
  change("batteryQty", "0");
  const noBatteryWarning = get("batteryVoltageWarning").hidden;
  change("inverterPhase", "single-phase");
  change("inverter", "SUN-8K-SG05LP1-EU-AM2-P");
  change("batteryQty", "1");
  const lvRestored = get("batteryVoltageWarning").hidden && !!get("batteryRuntimeScenarios").textContent.trim();
  return { rows, otherModelPrice, retainedManualPrice, noBatteryWarning, lvRestored };
})()
`;

const hvCabinetExpression = `
(() => {
  const get = (id) => document.getElementById(id);
  const change = (id, value) => {
    get(id).value = value;
    get(id).dispatchEvent(new Event("change", { bubbles: true }));
  };
  const priceField = () => document.querySelector('#estimateTable input[data-row-id="battery"][data-field="unitPrice"]');
  const reportText = (mode) => {
    const node = document.createElement("div");
    node.innerHTML = window.LINE_ENERGY_REPORTS.reportMarkup(mode);
    return node.textContent;
  };
  change("battery", "LB-261kW");
  change("batteryQty", "");
  const result = {
    lowVoltageBlocked: get("batteryVoltageWarning").textContent.includes("низковольтным"),
    noInventedPrice: priceField().value === "0",
    singleCabinet: document.querySelector('#estimateTable input[data-row-id="battery"][data-field="qty"]').value === "1",
    noInventedPhoto: get("batteryPhotoBox").hidden && !get("batteryPhoto").getAttribute("src"),
    correctGuide: get("batteryGuideGrid").textContent.includes("Высоковольтный") &&
      !get("batteryGuideGrid").textContent.includes("большинству домов"),
  };
  change("inverterPhase", "three-phase");
  change("inverter", "SUN-100K-SG02HP3-EU-GM10");
  result.unknownData = get("batteryVoltageWarning").textContent.includes("нет подтверждённого даташита");
  result.noFakeRuntime = !get("batteryRuntimeScenarios").textContent.trim() &&
    !get("generatorChargingMetrics").textContent.trim();
  result.noFinalPrice = reportText("commercial").includes("По запросу");
  priceField().value = "12300000";
  priceField().dispatchEvent(new Event("change", { bubbles: true }));
  get("calculateBtn").click();
  result.manualQuote = priceField().value === "12300000";
  result.unknownStatus = get("statusNote").textContent.includes("часть технических значений не подтверждена");
  const engineering = reportText("engineering");
  result.packagingSeparated = engineering.includes("Упаковка (не габариты оборудования)") &&
    engineering.includes("LB-261KW-A1") && engineering.includes("261 кВт·ч");
  result.noBadValues = !/NaN|undefined/.test(engineering);
  change("battery", "QPW-ST314");
  result.quoteNotTransferred = priceField().value !== "12300000";
  return result;
})()
`;

const storageEnergyExpression = `
(async () => {
  const get = (id) => document.getElementById(id);
  const change = (id, value) => {
    get(id).value = value;
    get(id).dispatchEvent(new Event("change", { bubbles: true }));
  };
  const text = () => get("storageEnergyResults").textContent;
  const reportText = () => {
    const node = document.createElement("div");
    node.innerHTML = window.LINE_ENERGY_REPORTS.reportMarkup("commercial");
    return node.textContent;
  };
  const estimateQty = () => document.querySelector('#estimateTable input[data-row-id="battery"][data-field="qty"]');
  change("inverterPhase", "three-phase");
  change("inverter", "SUN-100K-SG02HP3-EU-GM10");
  change("battery", "LB-261kW");
  change("batteryQty", "1");
  change("storageLoadSource", "manual");
  change("storageAverageLoadKw", "10");
  change("storageTargetHours", "24");
  change("storageInitialSoc", "100");
  change("storageDod", "90");
  change("storageEfficiency", "92");
  change("storageReserve", "95");
  change("storageAuxiliaryKw", "0");
  const result = {
    panelVisible: !get("storageEnergyPanel").hidden && get("dailyBackupSizing").hidden,
    oneCabinet: text().includes("205,3 кВт·ч") && text().includes("20,5 ч") && text().includes("305,1 кВт·ч"),
    loadSynchronized: get("houseAverageLoadW").value === "10000",
    preliminary: text().includes("не паспортные характеристики") && !get("batteryVoltageWarning").hidden,
    report: reportText().includes("Энергетическая оценка автономности АКБ") && reportText().includes("20,5 ч"),
    generatorStillBlocked: !get("generatorChargingMetrics").textContent.trim(),
  };
  get("applyStorageQuantityBtn").click();
  result.appliedQuantity = get("batteryQty").value === "2" && estimateQty().value === "2" &&
    text().includes("522 кВт·ч") && text().includes("41,1 ч") && reportText().includes("41,1 ч");
  get("saveProposalBtn").click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const saved = JSON.parse(localStorage.getItem("lineEnergyProposalArchive")).find((row) => row.controls?.battery?.value === "LB-261kW");
  change("storageAverageLoadKw", "20");
  change("storageInitialSoc", "50");
  const open = document.querySelector('[data-proposal-id="' + saved.id + '"][data-proposal-action="open"]');
  open.click();
  result.archiveRestored = get("storageAverageLoadKw").value === "10" && get("storageInitialSoc").value === "100" &&
    get("storageTargetHours").value === "24" && get("batteryQty").value === "2" && text().includes("41,1 ч");
  estimateQty().value = "3";
  estimateQty().dispatchEvent(new Event("change", { bubbles: true }));
  result.estimateQuantity = get("batteryQty").value === "3" && text().includes("783 кВт·ч") && text().includes("61,6 ч") &&
    reportText().includes("61,6 ч");
  change("batteryQty", "1");
  result.directQuantity = estimateQty().value === "1" && text().includes("20,5 ч");
  change("storageLoadSource", "daily");
  change("storageDailyKwh", "240");
  result.dailyLoad = get("dailyBackupKwh").value === "240" && text().includes("20,5 ч");
  document.querySelectorAll(".backupLoadRow").forEach((row) => { row.querySelector(".backupLoadEnabled").checked = false; });
  const fridge = document.querySelector(".backupLoadRow");
  for (const [selector, value] of [[".backupLoadWatts", 100], [".backupLoadQty", 1], [".backupLoadHours", 24],
    [".backupLoadKwhEach", 0], [".backupLoadCycles", 0]]) fridge.querySelector(selector).value = value;
  fridge.querySelector(".backupLoadEnabled").checked = true;
  fridge.querySelector(".backupLoadEnabled").dispatchEvent(new Event("change", { bubbles: true }));
  result.applianceLoad = get("storageLoadSource").value === "appliances" && text().includes("2 053 ч");
  change("storageAuxiliaryKw", "1");
  result.auxiliaryLoad = text().includes("186,6 ч");
  change("storageLoadSource", "manual");
  change("storageAuxiliaryKw", "0");
  change("storageAverageLoadKw", "101");
  result.overload = get("applyStorageQuantityBtn").disabled && text().includes("превышает номинальную мощность") &&
    get("statusNote").textContent.includes("Конфигурация требует корректировки");
  change("storageAverageLoadKw", "");
  result.emptyLoad = get("applyStorageQuantityBtn").disabled && text().includes("Укажите положительную нагрузку");
  change("storageAverageLoadKw", "10");
  change("systemMode", "backup");
  result.backupMode = !get("storageEnergyPanel").hidden && reportText().includes("Расчётная автономность") && reportText().includes("20,5 ч");
  change("systemMode", "hybrid");
  change("inverterPhase", "single-phase");
  change("inverter", "SUN-8K-SG05LP1-EU-AM2-P");
  result.incompatible = get("applyStorageQuantityBtn").disabled && get("batteryVoltageWarning").textContent.includes("низковольтным");
  change("battery", "QPW-ST314");
  result.hiddenForLv = get("storageEnergyPanel").hidden;
  return result;
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
    const catalog = await evaluate(cdp, batteryCatalogExpression);
    assert.deepEqual(catalog.activeModels, ["Gobel Power 16.08kWh 51.2V 314Ah", "QPW-ST314", "W512100-L", "51V 314 Ah ячейки EVE", "LB-261kW"]);
    assert.equal(catalog.defaultModel, "W512100-L");
    assert.equal(catalog.archivedModel, "US5000");
    assert.equal(catalog.archivedDisabled, true);
    assert.equal(catalog.archivedEstimateQty, "2");
    assert.equal(catalog.archivedReport, true);
    assert.equal(catalog.archivedPrice, "111111");
    assert.equal(catalog.priceNotTransferred, true);
    assert.deepEqual(catalog.modelsAfterChange, catalog.activeModels);
    const daily = await evaluate(cdp, dailyBackupExpression);
    assert.match(daily.inverter, /^SUN-5K-/);
    assert.equal(daily.battery, "QPW-ST314");
    assert.equal(daily.batteryQty, "2");
    assert.equal(daily.estimateQty, "2");
    assert.equal(daily.estimatePrice, "200000");
    assert.equal(daily.source, "daily");
    for (const key of ["needsPeak", "onePhase", "previewOnly", "noCalculationError", "dailyReport", "requiresPhasePeak", "threePhase", "hiddenForGrid"]) {
      assert.equal(daily[key], true, key);
    }
    const hv = await evaluate(cdp, deyeHvExpression);
    assert.equal(hv.rows.length, 14);
    for (const row of hv.rows) {
      assert.equal(row.price, row.expectedPrice, row.model + " price");
      for (const key of ["visible", "photo", "description", "pdfLink", "hvWarning", "draft", "noFakeRuntime", "report"]) {
        assert.equal(row[key], true, row.model + " " + key);
      }
    }
    for (const key of ["otherModelPrice", "retainedManualPrice", "noBatteryWarning", "lvRestored"]) {
      assert.equal(hv[key], true, key);
    }
    const cabinet = await evaluate(cdp, hvCabinetExpression);
    for (const [key, value] of Object.entries(cabinet)) assert.equal(value, true, "261 kWh cabinet: " + key);
    const storage = await evaluate(cdp, storageEnergyExpression);
    for (const [key, value] of Object.entries(storage)) assert.equal(value, true, "storage energy: " + key);
    if (process.env.LINE_ENERGY_STORAGE_QA === "1") {
      const qaDir = path.join(root, "tmp", "storage-energy-qa");
      fs.mkdirSync(qaDir, { recursive: true });
      await evaluate(cdp, `(() => {
        const change = (id, value) => {
          const node = document.getElementById(id);
          node.value = value;
          node.dispatchEvent(new Event("change", { bubbles: true }));
        };
        change("inverterPhase", "three-phase");
        change("inverter", "SUN-100K-SG02HP3-EU-GM10");
        change("battery", "LB-261kW");
        change("batteryQty", "1");
        change("storageLoadSource", "manual");
        change("storageAverageLoadKw", "10");
      })()`);
      for (const width of [1440, 390]) {
        await cdp.command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
        const clip = await evaluate(cdp, `(() => {
          const panel = document.getElementById("storageEnergyPanel");
          const rect = panel.getBoundingClientRect();
          return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height, scale: 1,
            fits: rect.left >= 0 && rect.right <= innerWidth && panel.scrollWidth <= panel.clientWidth + 1 };
        })()`);
        const fits = clip.fits;
        delete clip.fits;
        const screenshot = await cdp.command("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
        fs.writeFileSync(path.join(qaDir, "storage-" + width + ".png"), Buffer.from(screenshot.data, "base64"));
        assert.equal(fits, true, "storage energy panel overflow at width " + width + ": " + JSON.stringify(clip));
      }
      await cdp.command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await evaluate(cdp, `(async () => {
        const html = window.LINE_ENERGY_REPORTS.reportMarkup("commercial");
        document.body.classList.add("reportMode");
        document.body.innerHTML = '<section id="reportView" class="reportView">' + html + '</section>';
        await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
        await document.fonts.ready;
      })()`);
      const pdf = await cdp.command("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
      fs.writeFileSync(path.join(qaDir, "storage-runtime-commercial.pdf"), Buffer.from(pdf.data, "base64"));
      console.log("Storage desktop/mobile screenshots and PDF saved to tmp/storage-energy-qa");
    }
    if (process.env.LINE_ENERGY_HV_QA === "1") {
      await evaluate(cdp, `(async () => {
        const change = (id, value) => {
          const node = document.getElementById(id);
          node.value = value;
          node.dispatchEvent(new Event("change", { bubbles: true }));
        };
        change("inverterPhase", "three-phase");
        change("inverter", "SUN-40K-SG01HP3-EU-BM4");
        change("batteryQty", "0");
        await document.getElementById("inverterPhoto").decode();
      })()`);
      const clip = await evaluate(cdp, `(() => {
        const rect = document.querySelector(".inverterSpecs").getBoundingClientRect();
        return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height, scale: 1 };
      })()`);
      const qaDir = path.join(root, "tmp", "deye-hv-qa");
      fs.mkdirSync(qaDir, { recursive: true });
      const screenshot = await cdp.command("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
      fs.writeFileSync(path.join(qaDir, "inverter-card.png"), Buffer.from(screenshot.data, "base64"));
      await evaluate(cdp, `(async () => {
        const html = window.LINE_ENERGY_REPORTS.reportMarkup("full");
        document.body.classList.add("reportMode");
        document.body.innerHTML = '<section id="reportView" class="reportView">' + html + '</section>';
        await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
        await document.fonts.ready;
      })()`);
      const pdf = await cdp.command("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
      fs.writeFileSync(path.join(qaDir, "deye-40k-full.pdf"), Buffer.from(pdf.data, "base64"));
      console.log("QA screenshot and full PDF saved to tmp/deye-hv-qa");
    }
    cdp.close();
    console.log("PASS: commercial cover, archive, Deye HV catalog and storage energy sizing in Chrome");
  } finally {
    chrome.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
