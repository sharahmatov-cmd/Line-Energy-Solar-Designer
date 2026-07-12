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
  const costPrice = (code, fallback = 0) => {
    const row = (data.costs || []).find((item) => item.code === code);
    return num(row?.unit_price_rub, fallback);
  };
  const equipmentName = (row) => {
    if (!row.brand) return row.model || "";
    if (String(row.model || "").toLowerCase().startsWith(String(row.brand).toLowerCase())) return row.model;
    return `${row.brand} ${row.model}`;
  };

  const els = {
    region: byId("region"),
    monthlyConsumption: byId("monthlyConsumption"),
    targetCoverage: byId("targetCoverage"),
    roofType: byId("roofType"),
    roofTilt: byId("roofTilt"),
    roofAzimuth: byId("roofAzimuth"),
    panel: byId("panel"),
    panelPrice: byId("panelPrice"),
    inverter: byId("inverter"),
    inverterPrice: byId("inverterPrice"),
    battery: byId("battery"),
    batteryPrice: byId("batteryPrice"),
    selfShare: byId("selfShare"),
    panelsPerRow: byId("panelsPerRow"),
    dayShare: byId("dayShare"),
    mountingReserve: byId("mountingReserve"),
    systemSize: byId("systemSize"),
    panelCount: byId("panelCount"),
    annualGeneration: byId("annualGeneration"),
    roofFactor: byId("roofFactor"),
    payback: byId("payback"),
    paybackMetric: byId("paybackMetric"),
    statusNote: byId("statusNote"),
    recommendationsList: byId("recommendationsList"),
    estimateTable: byId("estimateTable"),
    economicsTable: byId("economicsTable"),
    chart: byId("generationChart"),
    exportStatus: byId("exportStatus"),
  };

  function option(select, value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    select.appendChild(node);
  }

  function fillSelects() {
    els.region.innerHTML = "";
    els.roofType.innerHTML = "";
    els.roofAzimuth.innerHTML = "";
    els.panel.innerHTML = "";
    els.inverter.innerHTML = "";
    els.battery.innerHTML = "";

    data.regions.forEach((row) => option(els.region, row.region, row.region));
    ["Metal tile", "Standing seam", "Trapezoidal sheet", "Flat roof", "Ground mount"].forEach((value) => option(els.roofType, value, roofLabel(value)));
    [
      ["south", "Юг"],
      ["south-east", "Юго-восток"],
      ["south-west", "Юго-запад"],
      ["east", "Восток"],
      ["west", "Запад"],
      ["north-east", "Северо-восток"],
      ["north-west", "Северо-запад"],
      ["north", "Север"],
    ].forEach(([value, label]) => option(els.roofAzimuth, value, label));

    data.panels
      .filter((row) => num(row.power_stc_w) > 0)
      .sort((a, b) => num(b.power_stc_w) - num(a.power_stc_w))
      .forEach((row) => option(els.panel, row.model, `${equipmentName(row)} · ${row.power_stc_w} Вт`));

    data.inverters
      .filter((row) => num(row.nominal_ac_power_w) > 0)
      .sort((a, b) => num(a.nominal_ac_power_w) - num(b.nominal_ac_power_w))
      .forEach((row) => option(els.inverter, row.model, `${equipmentName(row)} · ${fmt(num(row.nominal_ac_power_w) / 1000, 1)} кВт`));

    data.batteries.forEach((row) => option(els.battery, row.model, equipmentName(row)));

    els.region.value = "Moscow starter";
    els.roofAzimuth.value = "south";
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

  function azimuthLabel(value) {
    return {
      "south": "Юг",
      "south-east": "Юго-восток",
      "south-west": "Юго-запад",
      "east": "Восток",
      "west": "Запад",
      "north-east": "Северо-восток",
      "north-west": "Северо-запад",
      "north": "Север",
    }[value] || value;
  }

  function roofYieldFactor() {
    const tilt = Math.max(0, Math.min(90, num(els.roofTilt.value, 35)));
    const orientationFactor = {
      "south": 1,
      "south-east": 0.96,
      "south-west": 0.96,
      "east": 0.88,
      "west": 0.88,
      "north-east": 0.75,
      "north-west": 0.75,
      "north": 0.6,
    }[els.roofAzimuth.value] || 1;
    let tiltFactor = 1 - Math.min(Math.abs(tilt - 35) * 0.0045, 0.28);
    if (tilt <= 5) tiltFactor = 0.9;
    if (tilt >= 75) tiltFactor = Math.min(tiltFactor, 0.78);
    return {
      factor: Math.max(0.45, orientationFactor * tiltFactor),
      tilt,
      orientation: azimuthLabel(els.roofAzimuth.value),
      orientationFactor,
      tiltFactor,
    };
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

  function stationType(inverter) {
    const series = String(inverter.series || "").toLowerCase();
    if (series.includes("grid")) return "grid";
    if (series.includes("hybrid")) return "hybrid";
    return "unknown";
  }

  function batteryQuantity(kwp, battery) {
    return num(battery.nominal_energy_kwh) > 0 ? Math.max(1, Math.ceil(kwp / 5)) : 0;
  }

  function priceInputs() {
    return {
      panel: num(els.panelPrice.value),
      inverter: num(els.inverterPrice.value),
      battery: num(els.batteryPrice.value),
    };
  }

  function equipmentPrices() {
    const prices = priceInputs();
    return {
      panel: prices.panel || costPrice("panel_jinko_590", 14500),
      inverter: prices.inverter || costPrice("inverter_deye_sun_6k", 135000),
      battery: prices.battery || costPrice("battery_lifepo4_314ah", 210000),
    };
  }

  function estimateTotal(rows) {
    return rows
      .filter((row) => row[0] !== "Итого")
      .reduce((sum, row) => sum + num(String(row[5]).replace(/[^\d,.-]/g, "")), 0);
  }

  function buildCost(optionData, rows) {
    return estimateTotal(buildEstimate(optionData, rows, false));
  }

  function calculate() {
    const rows = selectedRows();
    const panelW = Math.max(1, num(rows.panel.power_stc_w, 550));
    const annualConsumption = num(els.monthlyConsumption.value) * 12;
    const targetCoverage = num(els.targetCoverage.value, 70) / 100;
    const specificYield = num(rows.region.specific_yield_kwh_per_kwp_year, 950);
    const roofFactor = roofYieldFactor();
    const performanceRatio = 0.85;
    const targetGeneration = annualConsumption * targetCoverage;
    const requiredKwp = targetGeneration / specificYield / performanceRatio / roofFactor.factor;
    const selfShare = num(els.selfShare.value, 70) / 100;
    const retailTariff = num(rows.tariff.retail_tariff_rub_kwh, 8.5);
    const exportTariff = num(rows.tariff.export_tariff_rub_kwh, 3.5);

    const options = data.optionTiers.map((tier) => {
      const panels = Math.max(1, Math.ceil((requiredKwp * 1000) / panelW));
      const kwp = panels * panelW / 1000;
      const annual = kwp * specificYield * performanceRatio * roofFactor.factor;
      const batteryQty = batteryQuantity(kwp, rows.battery);
      const cost = buildCost({ panels, kwp }, rows);
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
    const type = stationType(rows.inverter);
    const showPayback = type === "grid";
    const monthly = monthKeys.map((key) => standard.annual * num(rows.monthlyProfile[key]) / 100);
    const estimate = buildEstimate(standard, rows);
    const economics = buildEconomics(standard, rows, annualConsumption, retailTariff, exportTariff, selfShare, showPayback, roofFactor);
    const recommendations = buildRecommendations(standard, rows, roofFactor);

    els.systemSize.textContent = `${fmt(standard.kwp, 2)} кВтп`;
    els.panelCount.textContent = `${standard.panels} шт.`;
    els.annualGeneration.textContent = `${fmt(standard.annual)} кВт·ч/год`;
    els.roofFactor.textContent = `${fmt(roofFactor.factor * 100)} %`;
    els.paybackMetric.style.display = showPayback ? "" : "none";
    els.payback.textContent = showPayback ? `${fmt(standard.payback, 1)} лет` : "";
    els.statusNote.textContent = statusText(rows);

    renderRecommendations(recommendations);
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

  function parseStringsPerMppt(value) {
    const numbers = String(value || "")
      .split("+")
      .map((item) => num(item.trim()))
      .filter((item) => item > 0);
    return numbers.length ? Math.max(...numbers) : 1;
  }

  function buildRecommendations(optionData, rows, roofFactor) {
    const panel = rows.panel;
    const inverter = rows.inverter;
    const vmp = num(panel.vmp_stc_v);
    const voc = num(panel.voc_stc_v);
    const imp = num(panel.imp_stc_a);
    const isc = num(panel.isc_stc_a);
    const mpptMin = num(inverter.mppt_voltage_min_v);
    const mpptMax = num(inverter.mppt_voltage_max_v);
    const maxPvVoltage = num(inverter.max_pv_voltage_v);
    const mpptCount = Math.max(1, num(inverter.mppt_count, 1));
    const specStrings = parseStringsPerMppt(inverter.strings_per_mppt);
    const maxInputCurrent = num(inverter.max_input_current_per_mppt_a);
    const maxShortCurrent = num(inverter.max_short_circuit_current_per_mppt_a);
    const items = [];

    items.push({
      level: roofFactor.factor >= 0.92 ? "ok" : roofFactor.factor >= 0.8 ? "warn" : "bad",
      title: "Кровля и ориентация",
      text: `Угол ${fmt(roofFactor.tilt)}°, ориентация: ${roofFactor.orientation}. Поправка к выработке: ${fmt(roofFactor.factor * 100)}%. Лучший ориентир для расчета - южный скат около 30-40°.`,
    });

    if (!vmp || !voc || !imp || !isc || !mpptMin || !mpptMax || !maxPvVoltage) {
      items.push({
        level: "warn",
        title: "Нужна проверка datasheet",
        text: "Для выбранной панели или инвертора не хватает Voc/Vmp/Imp/Isc или диапазона MPPT. Рекомендацию по строкам нельзя считать надежно.",
      });
      return items;
    }

    const coldVocFactor = 1.12;
    const maxByVoc = Math.floor(maxPvVoltage / (voc * coldVocFactor));
    const maxByVmp = Math.floor(mpptMax / vmp);
    const maxPanelsPerString = Math.max(0, Math.min(maxByVoc, maxByVmp));
    const minPanelsPerString = Math.max(1, Math.ceil(mpptMin / vmp));
    const currentStrings = maxInputCurrent ? Math.floor(maxInputCurrent / imp) : specStrings;
    const shortCurrentStrings = maxShortCurrent ? Math.floor(maxShortCurrent / isc) : specStrings;
    const maxParallelStrings = Math.max(0, Math.min(specStrings, currentStrings || specStrings, shortCurrentStrings || specStrings));
    const maxPanelsPerMppt = maxPanelsPerString * maxParallelStrings;
    const requiredMppts = maxPanelsPerMppt > 0 ? Math.ceil(optionData.panels / maxPanelsPerMppt) : 0;

    items.push({
      level: maxPanelsPerString >= minPanelsPerString ? "ok" : "bad",
      title: "Строка панелей на MPPT",
      text: `Рекомендуемый диапазон: ${minPanelsPerString}-${maxPanelsPerString} панелей последовательно в одной строке. Расчет учитывает Vmp, Voc и запас 12% на холод.`,
    });

    items.push({
      level: maxParallelStrings > 0 ? "ok" : "bad",
      title: "Максимум на один MPPT",
      text: `Один MPPT поддерживает ориентировочно до ${maxPanelsPerMppt} панелей: ${maxParallelStrings} параллельн. строк(и) × ${maxPanelsPerString} панелей в строке. По току: Imp ${fmt(imp, 2)} А, Isc ${fmt(isc, 2)} А.`,
    });

    if (requiredMppts > mpptCount) {
      items.push({
        level: "bad",
        title: "Нужно больше MPPT или другой инвертор",
        text: `Для выбранных ${optionData.panels} панелей нужно около ${requiredMppts} MPPT, а у инвертора ${mpptCount}. Уменьшите число панелей или выберите инвертор с большим количеством MPPT/строк.`,
      });
    } else {
      items.push({
        level: "ok",
        title: "Выбранное количество панелей помещается",
        text: `${optionData.panels} панелей можно распределить по ${requiredMppts} из ${mpptCount} MPPT. Финально сверить раскладку по кровле и datasheet.`,
      });
    }

    if (String(panel.data_status || "").includes("seed") || String(inverter.data_status || "").includes("suffix_review")) {
      items.push({
        level: "warn",
        title: "Статус данных",
        text: "Часть параметров помечена как стартовая или требующая сверки суффикса модели. Для КП обязательно проверить оригинальные datasheet.",
      });
    }

    return items;
  }

  function renderRecommendations(items) {
    els.recommendationsList.innerHTML = items
      .map((item) => `<div class="recommendation ${item.level}"><strong>${item.title}</strong><span>${item.text}</span></div>`)
      .join("");
  }

  function buildEstimate(optionData, rows, includeTotal = true) {
    const panelsPerRow = Math.max(1, num(els.panelsPerRow.value, 8));
    const rowCount = Math.ceil(optionData.panels / panelsPerRow);
    const reserve = 1 + num(els.mountingReserve.value, 10) / 100;
    const railPieces = Math.ceil(optionData.panels * 2 * 1.15 / 4.2 * reserve);
    const railConnectors = Math.max(0, railPieces - 1);
    const roofMounts = Math.ceil(optionData.panels * 3 * reserve);
    const endClamps = Math.ceil(rowCount * 4);
    const middleClamps = Math.ceil(Math.max(0, optionData.panels - rowCount) * 2 * reserve);
    const groundingClips = Math.ceil(optionData.panels * reserve);
    const cableClips = Math.ceil(optionData.panels * 2 * reserve);
    const mc4Sets = Math.ceil(rowCount * 4);
    const blackCableM = Math.ceil(optionData.panels * 5 * reserve);
    const redCableM = Math.ceil(optionData.panels * 5 * reserve);
    const cableRouteM = Math.ceil((blackCableM + redCableM) * 1.1);
    const batteryQty = batteryQuantity(optionData.kwp, rows.battery);
    const prices = equipmentPrices();
    const row = (section, item, qty, unit, unitPrice, status = "") => [
      section,
      item,
      qty,
      unit,
      money(unitPrice),
      money(qty * unitPrice),
      status,
    ];
    const estimateRows = [
      ["Солнечные панели", equipmentName(rows.panel), optionData.panels, "шт.", money(prices.panel), money(optionData.panels * prices.panel), rows.panel.data_status],
      ["Инвертор", equipmentName(rows.inverter), 1, "шт.", money(prices.inverter), money(prices.inverter), rows.inverter.data_status],
      ["АКБ", equipmentName(rows.battery), batteryQty, "шт.", money(prices.battery), money(batteryQty * prices.battery), rows.battery.data_status],
      row("Крепеж", `L-крепление / ${roofLabel(els.roofType.value)}`, roofMounts, "шт.", costPrice("roof_mount_l", 250)),
      row("Крепеж", "Монтажный профиль для солнечных панелей", railPieces, "шт.", costPrice("mounting_profile", 3100)),
      row("Крепеж", "Стыковой соединитель профиля", railConnectors, "шт.", costPrice("profile_connector", 200)),
      row("Крепеж", "Комплект концевых зажимов End Clamp", endClamps, "шт.", costPrice("end_clamp_set", 160)),
      row("Крепеж", "Комплект межпанельных зажимов Inter Clamp", middleClamps, "шт.", costPrice("inter_clamp_set", 160)),
      row("Крепеж", "Заземление / grounding clip", groundingClips, "шт.", costPrice("grounding_clip", 160)),
      row("Крепеж", "Кабельные клипсы", cableClips, "шт.", costPrice("cable_clip", 50)),
      row("Кабель и защита", "Коннектор MC4, комплект", mc4Sets, "шт.", costPrice("mc4_set", 200)),
      row("Кабель и защита", "Кабель солнечный 6 мм² черный", blackCableM, "м", costPrice("solar_cable_6mm_black", 200)),
      row("Кабель и защита", "Кабель солнечный 6 мм² красный", redCableM, "м", costPrice("solar_cable_6mm_red", 200)),
      row("Кабель и защита", "Предохранитель плавкая вставка 30 А", 4, "шт.", costPrice("fuse_link_30a", 400)),
      row("Кабель и защита", "Держатель плавкой вставки", 4, "шт.", costPrice("fuse_holder", 800)),
      row("Кабель и защита", "УЗИП постоянного тока 1000 В", 2, "шт.", costPrice("dc_spd_1000v", 5400)),
      row("Кабель и защита", "Щит постоянного тока для солнечных панелей", 1, "шт.", costPrice("pv_dc_box", 3500)),
      row("Кабель и защита", "Кабель/провод для подключения АКБ и инвертора", 1, "компл.", costPrice("battery_cable_set", 12000)),
      row("Кабель и защита", "Реле выбора фаз 63 А", 1, "шт.", costPrice("phase_selector_relay", 8500)),
      row("Логистика", "Доставка транспортной и разгрузка на объекте", 1, "компл.", costPrice("delivery_unloading", 25000)),
      row("Работы", "Монтаж панелей и подсистемы", optionData.panels, "шт.", costPrice("panel_mounting_work", 4500)),
      row("Работы", "Монтаж и подключение инвертора, АКБ, пусконаладка", 1, "компл.", costPrice("inverter_battery_commissioning", 30000)),
      row("Работы", "Сборка и монтаж щита защиты PV для панелей", 1, "компл.", costPrice("pv_box_installation", 8000)),
      row("Работы", "Монтаж кабельных трасс для солнечных панелей", cableRouteM, "м", costPrice("cable_route_work", 170)),
    ];
    if (includeTotal) {
      estimateRows.push(["Итого", "Материалы и работы", "", "", "", money(estimateTotal(estimateRows)), ""]);
    }
    return estimateRows;
  }

  function buildEconomics(optionData, rows, annualConsumption, retailTariff, exportTariff, selfShare, showPayback, roofFactor) {
    const dayShare = num(els.dayShare.value, 65) / 100;
    const dayTariff = retailTariff * 1.12;
    const nightTariff = retailTariff * 0.42;
    const blended = dayTariff * dayShare + nightTariff * (1 - dayShare);
    const rowsOut = [
      ["Регион", rows.region.region, ""],
      ["Кровля", `${roofFactor.orientation}, ${fmt(roofFactor.tilt)}°, поправка ${fmt(roofFactor.factor * 100)} %`, "черновой коэффициент ориентации и наклона"],
      ["Потребление", `${fmt(annualConsumption)} кВт·ч/год`, ""],
      ["Выработка СЭС", `${fmt(optionData.annual)} кВт·ч/год`, ""],
      ["Покрытие потребления", `${fmt(optionData.coverage)} %`, ""],
      ["Розничный тариф", `${fmt(retailTariff, 2)} ₽/кВт·ч`, rows.tariff.retail_source_url],
      ["Зеленый тариф / экспорт", `${fmt(exportTariff, 2)} ₽/кВт·ч`, rows.tariff.export_source_url],
      ["Экономия за год", money(optionData.savings), ""],
      ["Экономия с день-ночь", money(optionData.dayNightSavings), ""],
      ["Оценочная стоимость", money(optionData.cost), ""],
      ["Смешанный день-ночь тариф", `${fmt(blended, 2)} ₽/кВт·ч`, "черновая оценка"],
    ];
    if (showPayback) {
      rowsOut.splice(rowsOut.length - 1, 0, ["Окупаемость", `${fmt(optionData.payback, 1)} лет`, "только для сетевой станции"]);
    }
    return rowsOut;
  }

  function renderEstimate(rows) {
    els.estimateTable.innerHTML = tableHtml(["Раздел", "Позиция", "Количество", "Ед.", "Цена", "Сумма", "Статус"], rows, [2, 4, 5]);
  }

  function renderEconomics(rows) {
    els.economicsTable.innerHTML = tableHtml(["Показатель", "Значение", "Источник/примечание"], rows, []);
  }

  function tableHtml(headers, rows, numericIndexes) {
    const head = `<thead><tr>${headers.map((h, i) => `<th class="${numericIndexes.includes(i) ? "num" : ""}">${h}</th>`).join("")}</tr></thead>`;
    const body = rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${numericIndexes.includes(i) ? "num" : ""}">${cell ?? ""}</td>`).join("")}</tr>`).join("");
    return `${head}<tbody>${body}</tbody>`;
  }

  function reportMarkup() {
    const chartImage = els.chart.toDataURL("image/png");
    const now = new Date().toLocaleString("ru-RU");
    return `<div class="reportSheet">
  <h1>Line-Energy Solar Designer</h1>
  <div class="reportMeta">Отчет сформирован: ${now}</div>
  <div class="reportMetrics">
    <div class="reportMetric"><span>Рекомендуемая мощность</span><strong>${els.systemSize.textContent}</strong></div>
    <div class="reportMetric"><span>Панелей</span><strong>${els.panelCount.textContent}</strong></div>
    <div class="reportMetric"><span>Годовая выработка</span><strong>${els.annualGeneration.textContent}</strong></div>
    <div class="reportMetric"><span>Поправка кровли</span><strong>${els.roofFactor.textContent}</strong></div>
  </div>
  <div>${els.statusNote.textContent}</div>
  <h2>Рекомендации по совместимости</h2>
  <div class="reportRecommendations">${els.recommendationsList.innerHTML}</div>
  <h2>График выработки</h2>
  <img class="reportChart" src="${chartImage}" alt="График выработки">
  <h2>Смета материалов и работ</h2>
  ${els.estimateTable.outerHTML}
  <h2>Экономика и тарифы</h2>
  ${els.economicsTable.outerHTML}
  <div class="reportNote">Черновой расчет. Перед коммерческим предложением сверить datasheet, объект, тарифы и нормы.</div>
</div>`;
  }

  function exportReport() {
    calculate();
    document.getElementById("reportView")?.remove();
    const report = document.createElement("section");
    report.id = "reportView";
    report.className = "reportView";
    report.innerHTML = `
      <div class="reportActions">
        <button id="reportPrintBtn" type="button">Печать / Сохранить PDF</button>
        <button id="reportBackBtn" type="button">Вернуться к расчету</button>
      </div>
      ${reportMarkup()}
    `;
    document.body.appendChild(report);
    document.body.classList.add("reportMode");
    byId("reportPrintBtn").addEventListener("click", () => window.print());
    byId("reportBackBtn").addEventListener("click", () => {
      document.body.classList.remove("reportMode");
      report.remove();
    });
    els.exportStatus.textContent = "Отчет открыт на этой странице. Нажмите «Печать / Сохранить PDF».";
    setTimeout(() => window.print(), 300);
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
    byId("printBtn").addEventListener("click", exportReport);
    byId("resetBtn").addEventListener("click", () => {
      els.monthlyConsumption.value = 1000;
      els.targetCoverage.value = 70;
      els.roofTilt.value = 35;
      els.panelPrice.value = "";
      els.inverterPrice.value = "";
      els.batteryPrice.value = "";
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
