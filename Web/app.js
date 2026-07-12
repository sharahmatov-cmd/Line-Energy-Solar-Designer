(function () {
  const data = window.SOLAR_DATA;
  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  const monthKeys = ["jan_pct", "feb_pct", "mar_pct", "apr_pct", "may_pct", "jun_pct", "jul_pct", "aug_pct", "sep_pct", "oct_pct", "nov_pct", "dec_pct"];

  const byId = (id) => document.getElementById(id);
  const num = (value, fallback = 0) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const fmt = (value, digits = 0) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
  const money = (value) => `${fmt(value)} ₽`;

  const els = {
    region: byId("region"),
    monthlyConsumption: byId("monthlyConsumption"),
    targetCoverage: byId("targetCoverage"),
    roofType: byId("roofType"),
    panel: byId("panel"),
    inverter: byId("inverter"),
    battery: byId("battery"),
    selfShare: byId("selfShare"),
    panelsPerRow: byId("panelsPerRow"),
    dayShare: byId("dayShare"),
    mountingReserve: byId("mountingReserve"),
    systemSize: byId("systemSize"),
    panelCount: byId("panelCount"),
    annualGeneration: byId("annualGeneration"),
    payback: byId("payback"),
    statusNote: byId("statusNote"),
    optionsTable: byId("optionsTable"),
    estimateTable: byId("estimateTable"),
    economicsTable: byId("economicsTable"),
    chart: byId("generationChart"),
  };

  function option(select, value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    select.appendChild(node);
  }

  function fillSelects() {
    data.regions.forEach((row) => option(els.region, row.region, row.region));
    ["Metal tile", "Standing seam", "Trapezoidal sheet", "Flat roof", "Ground mount"].forEach((value) => option(els.roofType, value, roofLabel(value)));

    data.panels
      .filter((row) => num(row.power_stc_w) > 0)
      .sort((a, b) => num(b.power_stc_w) - num(a.power_stc_w))
      .forEach((row) => option(els.panel, row.model, `${row.brand} ${row.model} · ${row.power_stc_w} Вт`));

    data.inverters
      .filter((row) => num(row.nominal_ac_power_w) > 0)
      .sort((a, b) => num(a.nominal_ac_power_w) - num(b.nominal_ac_power_w))
      .forEach((row) => option(els.inverter, row.model, `${row.brand} ${row.model} · ${fmt(num(row.nominal_ac_power_w) / 1000, 1)} кВт`));

    data.batteries.forEach((row) => option(els.battery, row.model, `${row.brand} ${row.model}`));

    els.region.value = "Moscow starter";
    setDefaultSelect(els.panel, "JKM575N-72HL4-V");
    setDefaultSelect(els.inverter, "SUN-8K-SG05LP1-EU-AM2-P");
    setDefaultSelect(els.battery, "US5000");
  }

  function setDefaultSelect(select, value) {
    if ([...select.options].some((item) => item.value === value)) {
      select.value = value;
    }
  }

  function roofLabel(value) {
    return {
      "Metal tile": "Металлочерепица",
      "Standing seam": "Фальцевая кровля",
      "Trapezoidal sheet": "Профлист",
      "Flat roof": "Плоская кровля",
      "Ground mount": "Наземная установка",
    }[value] || value;
  }

  function selectedRows() {
    return {
      region: data.regions.find((row) => row.region === els.region.value) || data.regions[0],
      monthlyProfile: data.monthlyProfiles.find((row) => row.region === els.region.value) || data.monthlyProfiles[0],
      tariff: data.tariffs.find((row) => row.region === els.region.value) || data.tariffs[0],
      panel: data.panels.find((row) => row.model === els.panel.value) || data.panels[0],
      inverter: data.inverters.find((row) => row.model === els.inverter.value) || data.inverters[0],
      battery: data.batteries.find((row) => row.model === els.battery.value) || data.batteries[0],
    };
  }

  function calculate() {
    const rows = selectedRows();
    const panelW = Math.max(1, num(rows.panel.power_stc_w, 550));
    const annualConsumption = num(els.monthlyConsumption.value) * 12;
    const targetCoverage = num(els.targetCoverage.value, 70) / 100;
    const specificYield = num(rows.region.specific_yield_kwh_per_kwp_year, 950);
    const performanceRatio = 0.85;
    const targetGeneration = annualConsumption * targetCoverage;
    const requiredKwp = targetGeneration / specificYield / performanceRatio;
    const selfShare = num(els.selfShare.value, 70) / 100;
    const retailTariff = num(rows.tariff.retail_tariff_rub_kwh, 8.5);
    const exportTariff = num(rows.tariff.export_tariff_rub_kwh, 3.5);

    const options = data.optionTiers.map((tier) => {
      const panels = Math.max(1, Math.ceil((requiredKwp * 1000) / panelW));
      const kwp = panels * panelW / 1000;
      const annual = kwp * specificYield * performanceRatio;
      const cost = kwp * num(tier.cost_rub_per_kwp);
      const savings = annual * selfShare * retailTariff + annual * (1 - selfShare) * exportTariff;
      const dayNightBoost = annualConsumption * 0.08;
      const dayNightSavings = savings + dayNightBoost;
      return {
        tier,
        panels,
        kwp,
        annual,
        cost,
        coverage: annual / annualConsumption * 100,
        savings,
        dayNightSavings,
        payback: dayNightSavings > 0 ? cost / dayNightSavings : 0,
      };
    });

    const standard = options.find((item) => item.tier.tier === "Standard") || options[0];
    const monthly = monthKeys.map((key) => standard.annual * num(rows.monthlyProfile[key]) / 100);
    const estimate = buildEstimate(standard, rows);
    const economics = buildEconomics(standard, rows, annualConsumption, retailTariff, exportTariff, selfShare);

    els.systemSize.textContent = `${fmt(standard.kwp, 2)} кВтп`;
    els.panelCount.textContent = `${standard.panels} шт.`;
    els.annualGeneration.textContent = `${fmt(standard.annual)} кВт·ч/год`;
    els.payback.textContent = `${fmt(standard.payback, 1)} лет`;
    els.statusNote.textContent = statusText(rows);

    renderOptions(options);
    renderEstimate(estimate);
    renderEconomics(economics);
    drawChart(monthly);
  }

  function statusText(rows) {
    const flags = [rows.inverter.data_status, rows.panel.data_status, rows.battery.data_status].filter(Boolean);
    if (flags.includes("model_only_needs_datasheet")) {
      return "В выбранной связке есть оборудование без полного datasheet. Для теста можно, для КП нужно проверить.";
    }
    if (flags.includes("datasheet_local_pdf_suffix_review")) {
      return "Есть оборудование с параметрами из PDF, но требуется сверить суффикс модели.";
    }
    return "Выбранная связка подходит для чернового расчета. Перед КП сверить объект и нормы.";
  }

  function buildEstimate(optionData, rows) {
    const panelsPerRow = Math.max(1, num(els.panelsPerRow.value, 8));
    const rowCount = Math.ceil(optionData.panels / panelsPerRow);
    const reserve = 1 + num(els.mountingReserve.value, 10) / 100;
    const railPieces = Math.ceil(optionData.panels * 2 * 1.15 / 4.2 * reserve);
    const railConnectors = Math.max(0, Math.ceil(railPieces - rowCount * 2));
    const batteryQty = num(rows.battery.nominal_energy_kwh) > 0 ? Math.max(1, Math.ceil(optionData.kwp / 5)) : 0;
    const installation = optionData.kwp * 23000;
    const design = Math.max(35000, optionData.kwp * 4500);

    return [
      ["Солнечные панели", rows.panel.model, optionData.panels, "шт.", ""],
      ["Инвертор", rows.inverter.model, 1, "шт.", rows.inverter.data_status],
      ["АКБ", rows.battery.model, batteryQty, "шт.", rows.battery.data_status],
      ["Крепеж: крюки/опоры", roofLabel(els.roofType.value), Math.ceil(optionData.panels * 4 * reserve), "шт.", ""],
      ["Рейки", "Алюминиевая рейка", railPieces, "шт.", ""],
      ["Соединители реек", "Rail connector", railConnectors, "шт.", ""],
      ["Крайние прижимы", "End clamp", Math.ceil(rowCount * 4 * reserve), "шт.", ""],
      ["Средние прижимы", "Middle clamp", Math.ceil(Math.max(0, optionData.panels - rowCount) * 2 * reserve), "шт.", ""],
      ["Заземление", "Grounding clip", Math.ceil(optionData.panels * reserve), "шт.", ""],
      ["Кабельные клипсы", "Cable clip", Math.ceil(optionData.panels * 2 * reserve), "шт.", ""],
      ["Кабель и защита", "DC/AC cable, SPD, breakers", 1, "компл.", ""],
      ["Работы монтажные", "Installation work", money(installation), "", ""],
      ["Проектирование и ПНР", "Design and commissioning", money(design), "", ""],
    ];
  }

  function buildEconomics(optionData, rows, annualConsumption, retailTariff, exportTariff, selfShare) {
    const dayShare = num(els.dayShare.value, 65) / 100;
    const dayTariff = retailTariff * 1.12;
    const nightTariff = retailTariff * 0.42;
    const blended = dayTariff * dayShare + nightTariff * (1 - dayShare);
    return [
      ["Регион", rows.region.region, ""],
      ["Потребление", `${fmt(annualConsumption)} кВт·ч/год`, ""],
      ["Выработка СЭС", `${fmt(optionData.annual)} кВт·ч/год`, ""],
      ["Покрытие потребления", `${fmt(optionData.coverage)} %`, ""],
      ["Розничный тариф", `${fmt(retailTariff, 2)} ₽/кВт·ч`, rows.tariff.retail_source_url],
      ["Зеленый тариф / экспорт", `${fmt(exportTariff, 2)} ₽/кВт·ч`, rows.tariff.export_source_url],
      ["Экономия за год", money(optionData.savings), ""],
      ["Экономия с день-ночь", money(optionData.dayNightSavings), ""],
      ["Оценочная стоимость", money(optionData.cost), ""],
      ["Окупаемость", `${fmt(optionData.payback, 1)} лет`, ""],
      ["Смешанный день-ночь тариф", `${fmt(blended, 2)} ₽/кВт·ч`, "черновая оценка"],
    ];
  }

  function renderOptions(options) {
    els.optionsTable.innerHTML = tableHtml(
      ["Вариант", "Мощность", "Панели", "Выработка", "Покрытие", "Стоимость", "Окупаемость"],
      options.map((item) => [
        item.tier.tier,
        `${fmt(item.kwp, 2)} кВтп`,
        `${item.panels} шт.`,
        `${fmt(item.annual)} кВт·ч`,
        `${fmt(item.coverage)} %`,
        money(item.cost),
        `${fmt(item.payback, 1)} лет`,
      ]),
      [1, 2, 3, 4, 5, 6]
    );
  }

  function renderEstimate(rows) {
    els.estimateTable.innerHTML = tableHtml(["Раздел", "Позиция", "Количество", "Ед.", "Статус"], rows, [2]);
  }

  function renderEconomics(rows) {
    els.economicsTable.innerHTML = tableHtml(["Показатель", "Значение", "Источник/примечание"], rows, []);
  }

  function tableHtml(headers, rows, numericIndexes) {
    const head = `<thead><tr>${headers.map((h, i) => `<th class="${numericIndexes.includes(i) ? "num" : ""}">${h}</th>`).join("")}</tr></thead>`;
    const body = rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${numericIndexes.includes(i) ? "num" : ""}">${cell ?? ""}</td>`).join("")}</tr>`).join("");
    return `${head}<tbody>${body}</tbody>`;
  }

  function drawChart(values) {
    const canvas = els.chart;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const pad = 42;
    const max = Math.max(...values) * 1.15 || 1;
    ctx.strokeStyle = "#d8dee8";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = pad + (h - pad * 2) * i / 4;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }
    const barW = (w - pad * 2) / values.length * 0.62;
    values.forEach((value, i) => {
      const x = pad + (w - pad * 2) * (i + 0.19) / values.length;
      const barH = (h - pad * 2) * value / max;
      const y = h - pad - barH;
      ctx.fillStyle = "#0f8b6f";
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = "#334155";
      ctx.font = "13px Arial";
      ctx.textAlign = "center";
      ctx.fillText(months[i], x + barW / 2, h - 16);
      ctx.fillText(fmt(value), x + barW / 2, y - 6);
    });
  }

  function bind() {
    [...document.querySelectorAll("select,input")].forEach((node) => node.addEventListener("input", calculate));
    byId("printBtn").addEventListener("click", () => window.print());
    byId("resetBtn").addEventListener("click", () => {
      els.monthlyConsumption.value = 1000;
      els.targetCoverage.value = 70;
      els.selfShare.value = 70;
      els.panelsPerRow.value = 8;
      els.dayShare.value = 65;
      els.mountingReserve.value = 10;
      fillSelects();
      calculate();
    });
  }

  fillSelects();
  bind();
  calculate();
})();
