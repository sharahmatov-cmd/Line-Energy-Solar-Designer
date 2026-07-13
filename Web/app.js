(function () {
  const data = window.SOLAR_DATA;
  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  const monthKeys = ["jan_pct", "feb_pct", "mar_pct", "apr_pct", "may_pct", "jun_pct", "jul_pct", "aug_pct", "sep_pct", "oct_pct", "nov_pct", "dec_pct"];

  const byId = (id) => document.getElementById(id);
  const num = (value, fallback = 0) => {
    const raw = String(value ?? "").replace(",", ".").trim();
    if (raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const fmt = (value, digits = 0) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
  const money = (value) => `${fmt(value)} ₽`;
  const estimateOverrides = {};
  const estimateCustomRows = [];
  let estimateCustomRowCounter = 1;
  let estimateInputTimer = 0;
  const roofLayoutState = {
    activeSlope: 0,
    slopes: [],
    manual: false,
    panels: [],
    rails: [],
    selected: -1,
    selectedPanels: [],
    selectedRail: -1,
    dimensionHandles: [],
    dimensionEditorHandle: null,
    drag: null,
    draw: null,
    materials: null,
    aggregateMaterials: null,
  };
  const costPrice = (code, fallback = 0) => {
    const row = (data.costs || []).find((item) => item.code === code);
    return num(row?.unit_price_rub, fallback);
  };
  const equipmentName = (row) => {
    if (!row.brand) return row.model || "";
    if (String(row.model || "").toLowerCase().startsWith(String(row.brand).toLowerCase())) return row.model;
    return `${row.brand} ${row.model}`;
  };
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const els = {
    region: byId("region"),
    monthlyConsumption: byId("monthlyConsumption"),
    tariffRetail: byId("tariffRetail"),
    tariffDay: byId("tariffDay"),
    tariffNight: byId("tariffNight"),
    tariffExport: byId("tariffExport"),
    targetCoverage: byId("targetCoverage"),
    roofType: byId("roofType"),
    roofMainTilt: byId("roofMainTilt"),
    roofMainTiltLabel: byId("roofMainTiltLabel"),
    roofSlopeCount: byId("roofSlopeCount"),
    roof1PanelCount: byId("roof1PanelCount"),
    roof1Share: byId("roof1Share"),
    roof1Tilt: byId("roof1Tilt"),
    roof1Azimuth: byId("roof1Azimuth"),
    roof1Connection: byId("roof1Connection"),
    roof1StringsPerMppt: byId("roof1StringsPerMppt"),
    roof2PanelCount: byId("roof2PanelCount"),
    roof2Share: byId("roof2Share"),
    roof2Tilt: byId("roof2Tilt"),
    roof2Azimuth: byId("roof2Azimuth"),
    roof2Connection: byId("roof2Connection"),
    roof2StringsPerMppt: byId("roof2StringsPerMppt"),
    roof3PanelCount: byId("roof3PanelCount"),
    roof3Share: byId("roof3Share"),
    roof3Tilt: byId("roof3Tilt"),
    roof3Azimuth: byId("roof3Azimuth"),
    roof3Connection: byId("roof3Connection"),
    roof3StringsPerMppt: byId("roof3StringsPerMppt"),
    roof4PanelCount: byId("roof4PanelCount"),
    roof4Share: byId("roof4Share"),
    roof4Tilt: byId("roof4Tilt"),
    roof4Azimuth: byId("roof4Azimuth"),
    roof4Connection: byId("roof4Connection"),
    roof4StringsPerMppt: byId("roof4StringsPerMppt"),
    panel: byId("panel"),
    inverterBrand: byId("inverterBrand"),
    inverterType: byId("inverterType"),
    inverterPhase: byId("inverterPhase"),
    inverter: byId("inverter"),
    manualMaxPvVoltage: byId("manualMaxPvVoltage"),
    manualMpptMin: byId("manualMpptMin"),
    manualMpptMax: byId("manualMpptMax"),
    manualMpptCount: byId("manualMpptCount"),
    manualStringsPerMppt: byId("manualStringsPerMppt"),
    manualMaxInputCurrent: byId("manualMaxInputCurrent"),
    manualMaxShortCurrent: byId("manualMaxShortCurrent"),
    manualMaxPvPower: byId("manualMaxPvPower"),
    manualStartupVoltage: byId("manualStartupVoltage"),
    battery: byId("battery"),
    batteryQty: byId("batteryQty"),
    selfShare: byId("selfShare"),
    dayShare: byId("dayShare"),
    mountingReserve: byId("mountingReserve"),
    systemSize: byId("systemSize"),
    panelCount: byId("panelCount"),
    stringCountMetric: byId("stringCountMetric"),
    annualGeneration: byId("annualGeneration"),
    winterGeneration: byId("winterGeneration"),
    winterCoverage: byId("winterCoverage"),
    roofFactor: byId("roofFactor"),
    payback: byId("payback"),
    paybackMetric: byId("paybackMetric"),
    statusNote: byId("statusNote"),
    recommendationsList: byId("recommendationsList"),
    panelSpecsTable: byId("panelSpecsTable"),
    inverterSpecsTable: byId("inverterSpecsTable"),
    estimateTable: byId("estimateTable"),
    economicsTable: byId("economicsTable"),
    chart: byId("generationChart"),
    layoutRoofShape: byId("layoutRoofShape"),
    layoutRoofWidth: byId("layoutRoofWidth"),
    layoutRoofTopWidth: byId("layoutRoofTopWidth"),
    layoutRoofTopOffset: byId("layoutRoofTopOffset"),
    layoutRoofHeight: byId("layoutRoofHeight"),
    layoutPanelOrientation: byId("layoutPanelOrientation"),
    layoutSlopeTilt: byId("layoutSlopeTilt"),
    layoutSlopeAzimuth: byId("layoutSlopeAzimuth"),
    layoutSetback: byId("layoutSetback"),
    layoutGap: byId("layoutGap"),
    layoutPanelOverhang: byId("layoutPanelOverhang"),
    layoutMaxPanels: byId("layoutMaxPanels"),
    layoutProfileLength: byId("layoutProfileLength"),
    layoutCableType: byId("layoutCableType"),
    layoutCableLength: byId("layoutCableLength"),
    layoutSlopeTabs: byId("layoutSlopeTabs"),
    layoutAddSlopeBtn: byId("layoutAddSlopeBtn"),
    layoutAutoBtn: byId("layoutAutoBtn"),
    layoutManualBtn: byId("layoutManualBtn"),
    layoutAddPanelBtn: byId("layoutAddPanelBtn"),
    layoutAddRailBtn: byId("layoutAddRailBtn"),
    layoutMakeStringBtn: byId("layoutMakeStringBtn"),
    layoutClearStringBtn: byId("layoutClearStringBtn"),
    layoutAlignPanelsBtn: byId("layoutAlignPanelsBtn"),
    layoutRotatePanelBtn: byId("layoutRotatePanelBtn"),
    layoutDeletePanelBtn: byId("layoutDeletePanelBtn"),
    layoutClearBtn: byId("layoutClearBtn"),
    applyLayoutToSlopeBtn: byId("applyLayoutToSlopeBtn"),
    roofLayoutCanvas: byId("roofLayoutCanvas"),
    dimensionEditor: byId("dimensionEditor"),
    dimensionEditorInput: byId("dimensionEditorInput"),
    roofLayoutMetrics: byId("roofLayoutMetrics"),
    roofLayoutNote: byId("roofLayoutNote"),
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
    roofInputs().forEach((slope) => {
      slope.azimuth.innerHTML = "";
      slope.connection.innerHTML = "";
    });
    els.panel.innerHTML = "";
    els.inverterBrand.innerHTML = "";
    els.inverterType.innerHTML = "";
    els.inverterPhase.innerHTML = "";
    els.inverter.innerHTML = "";
    els.battery.innerHTML = "";

    data.regions.forEach((row) => option(els.region, row.region, regionLabel(row.region)));
    ["Metal tile", "Soft roof", "Standing seam", "Trapezoidal sheet", "Flat roof", "Ground mount"].forEach((value) => option(els.roofType, value, roofLabel(value)));
    roofInputs().forEach((slope) => {
      fillAzimuthSelect(slope.azimuth);
      fillConnectionSelect(slope.connection);
    });

    data.panels
      .filter((row) => num(row.power_stc_w) > 0)
      .sort((a, b) => {
        const brandCompare = String(a.brand || "").localeCompare(String(b.brand || ""), "ru");
        if (brandCompare) return brandCompare;
        const powerCompare = num(b.power_stc_w) - num(a.power_stc_w);
        if (powerCompare) return powerCompare;
        return String(a.model || "").localeCompare(String(b.model || ""), "ru");
      })
      .forEach((row) => option(els.panel, row.model, `${equipmentName(row)} · ${row.power_stc_w} Вт`));

    inverterBrands().forEach((brand) => option(els.inverterBrand, brand, brand));
    [
      ["hybrid", "Гибридный"],
      ["grid", "Сетевой"],
    ].forEach(([value, label]) => option(els.inverterType, value, label));
    [
      ["single-phase", "1 фаза"],
      ["three-phase", "3 фазы"],
    ].forEach(([value, label]) => option(els.inverterPhase, value, label));

    data.batteries.forEach((row) => option(els.battery, row.model, equipmentName(row)));

    els.region.value = "Moscow starter";
    setTariffInputsFromRegion();
    els.roof1Azimuth.value = "south";
    els.roof2Azimuth.value = "west";
    els.roof3Azimuth.value = "east";
    els.roof4Azimuth.value = "south-west";
    els.roof1Connection.value = "series";
    els.roof2Connection.value = "series";
    els.roof3Connection.value = "series";
    els.roof4Connection.value = "series";
    els.layoutSlopeAzimuth.innerHTML = "";
    fillAzimuthSelect(els.layoutSlopeAzimuth);
    els.layoutSlopeAzimuth.value = "south";
    setDefaultSelect(els.panel, "JKM575N-72HL4-BDV-F9");
    els.inverterBrand.value = "Deye";
    els.inverterType.value = "hybrid";
    els.inverterPhase.value = "single-phase";
    fillInverterModels("SUN-8K-SG05LP1-EU-AM2-P");
    setDefaultSelect(els.battery, "US5000");
  }

  function inverterBrands() {
    return [...new Set(data.inverters.map((row) => row.brand).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ru"));
  }

  function inverterType(row) {
    const series = String(row.series || "").toLowerCase();
    if (series.includes("grid")) return "grid";
    if (series.includes("hybrid")) return "hybrid";
    return "";
  }

  function phaseLabel(value) {
    return {
      "single-phase": "1 фаза",
      "three-phase": "3 фазы",
    }[value] || value;
  }

  function selectedInverters() {
    return data.inverters
      .filter((row) => num(row.nominal_ac_power_w) > 0)
      .filter((row) => !els.inverterBrand.value || row.brand === els.inverterBrand.value)
      .filter((row) => !els.inverterType.value || inverterType(row) === els.inverterType.value)
      .filter((row) => !els.inverterPhase.value || row.phase === els.inverterPhase.value)
      .sort((a, b) => num(a.nominal_ac_power_w) - num(b.nominal_ac_power_w));
  }

  function fillInverterModels(preferredModel = els.inverter.value) {
    const rows = selectedInverters();
    els.inverter.innerHTML = "";
    if (!rows.length) {
      option(els.inverter, "", "Нет моделей под выбранные фильтры");
      return;
    }
    rows.forEach((row) => option(
      els.inverter,
      row.model,
      `${equipmentName(row)} · ${fmt(num(row.nominal_ac_power_w) / 1000, 1)} кВт · ${phaseLabel(row.phase)}`
    ));
    if (rows.some((row) => row.model === preferredModel)) {
      els.inverter.value = preferredModel;
    } else if (rows.length) {
      els.inverter.value = rows[0].model;
    }
  }

  function roofInputs() {
    return [
      { name: "Скат 1", panels: els.roof1PanelCount, share: els.roof1Share, tilt: els.roof1Tilt, azimuth: els.roof1Azimuth, connection: els.roof1Connection, strings: els.roof1StringsPerMppt },
      { name: "Скат 2", panels: els.roof2PanelCount, share: els.roof2Share, tilt: els.roof2Tilt, azimuth: els.roof2Azimuth, connection: els.roof2Connection, strings: els.roof2StringsPerMppt },
      { name: "Скат 3", panels: els.roof3PanelCount, share: els.roof3Share, tilt: els.roof3Tilt, azimuth: els.roof3Azimuth, connection: els.roof3Connection, strings: els.roof3StringsPerMppt },
      { name: "Скат 4", panels: els.roof4PanelCount, share: els.roof4Share, tilt: els.roof4Tilt, azimuth: els.roof4Azimuth, connection: els.roof4Connection, strings: els.roof4StringsPerMppt },
    ];
  }

  function selectedRoofSlopeCount() {
    return Math.max(1, Math.min(4, Math.ceil(num(els.roofSlopeCount.value, 1))));
  }

  function updateRoofMainTiltLabel() {
    if (!els.roofMainTiltLabel) return;
    const flatInstall = ["Flat roof", "Ground mount"].includes(els.roofType.value);
    els.roofMainTiltLabel.textContent = flatInstall ? "Угол наклона панелей, °" : "Угол наклона кровли, °";
  }

  function syncPrimaryRoofInputs(summary = null) {
    updateRoofMainTiltLabel();
    const slopes = summary?.slopes || [];
    const firstTilt = slopes.length ? slopes[0].tilt : num(els.layoutSlopeTilt?.value, 35);
    if (els.roofMainTilt) els.roofMainTilt.value = Math.max(0, Math.min(90, num(firstTilt, 35)));
    els.roofSlopeCount.value = Math.max(1, Math.min(4, slopes.length || 1));
    roofInputs().forEach((input, index) => {
      const slope = slopes[index];
      input.panels.value = slope ? slope.panelCount : 0;
      input.share.value = slope ? 100 : 0;
      input.tilt.value = slope ? slope.tilt : 35;
      input.azimuth.value = slope ? slope.azimuth : input.azimuth.value;
      input.connection.value = "series";
      input.strings.value = slope ? slope.stringsPerMppt : 1;
    });
  }

  function updateRoofSlopeVisibility() {
    const count = selectedRoofSlopeCount();
    document.querySelectorAll(".roofSlope").forEach((node) => {
      node.hidden = num(node.dataset.slopeIndex) > count;
    });
  }

  function fillAzimuthSelect(select) {
    [
      ["south", "Юг"],
      ["south-east", "Юго-восток"],
      ["south-west", "Юго-запад"],
      ["east", "Восток"],
      ["west", "Запад"],
      ["north-east", "Северо-восток"],
      ["north-west", "Северо-запад"],
      ["north", "Север"],
    ].forEach(([value, label]) => option(select, value, label));
  }

  function fillConnectionSelect(select) {
    [
      ["series", "Последовательное"],
      ["parallel", "Параллельное"],
      ["series-parallel", "Последовательно-параллельное"],
    ].forEach(([value, label]) => option(select, value, label));
  }

  function plainClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function sourceValue(source, key, fallback = "") {
    const value = source?.[key];
    if (value && typeof value === "object" && "value" in value) return value.value;
    return value ?? fallback;
  }

  function defaultLayoutSlopeState(index = 0, options = {}) {
    return {
      name: `Скат ${index + 1}`,
      layoutRoofShape: "rectangle",
      layoutRoofWidth: 10,
      layoutRoofTopWidth: 6,
      layoutRoofTopOffset: 2,
      layoutRoofHeight: 6,
      layoutPanelOrientation: "portrait",
      layoutSlopeTilt: num(els.roofMainTilt?.value, 35),
      layoutSlopeAzimuth: index === 1 ? "west" : index === 2 ? "east" : "south",
      layoutSetback: 0.3,
      layoutGap: 0.03,
      layoutPanelOverhang: 0.2,
      layoutMaxPanels: "",
      layoutProfileLength: 3.5,
      layoutCableType: "2x6",
      layoutCableLength: 0,
      manual: Boolean(options.empty),
      panels: [],
      rails: [],
      selected: -1,
      selectedPanels: [],
      selectedRail: -1,
      materials: null,
      panelCount: 0,
      kwp: 0,
    };
  }

  function layoutControlValues() {
    return {
      layoutRoofShape: els.layoutRoofShape.value,
      layoutRoofWidth: els.layoutRoofWidth.value,
      layoutRoofTopWidth: els.layoutRoofTopWidth.value,
      layoutRoofTopOffset: els.layoutRoofTopOffset.value,
      layoutRoofHeight: els.layoutRoofHeight.value,
      layoutPanelOrientation: els.layoutPanelOrientation.value,
      layoutSlopeTilt: els.layoutSlopeTilt.value,
      layoutSlopeAzimuth: els.layoutSlopeAzimuth.value,
      layoutSetback: els.layoutSetback.value,
      layoutGap: els.layoutGap.value,
      layoutPanelOverhang: els.layoutPanelOverhang.value,
      layoutMaxPanels: els.layoutMaxPanels.value,
      layoutProfileLength: els.layoutProfileLength.value,
      layoutCableType: els.layoutCableType.value,
      layoutCableLength: els.layoutCableLength.value,
    };
  }

  function applyLayoutControlValues(slope) {
    Object.entries(layoutControlValues()).forEach(([key]) => {
      if (els[key]) els[key].value = slope[key] ?? defaultLayoutSlopeState()[key];
    });
  }

  function saveActiveLayoutSlope() {
    if (!roofLayoutState.slopes.length) return;
    const index = roofLayoutState.activeSlope;
    const slope = roofLayoutState.slopes[index] || defaultLayoutSlopeState(index);
    Object.assign(slope, layoutControlValues(), {
      name: `Скат ${index + 1}`,
      manual: roofLayoutState.manual,
      panels: plainClone(roofLayoutState.panels) || [],
      rails: plainClone(roofLayoutState.rails) || [],
      selected: roofLayoutState.selected,
      selectedPanels: plainClone(roofLayoutState.selectedPanels) || [],
      selectedRail: roofLayoutState.selectedRail,
      materials: plainClone(roofLayoutState.materials),
      panelCount: roofLayoutState.materials?.panels ?? roofLayoutState.panels.length,
      kwp: roofLayoutState.draw?.layout?.kwp ?? 0,
    });
    roofLayoutState.slopes[index] = slope;
  }

  function loadLayoutSlope(index) {
    const slope = roofLayoutState.slopes[index] || defaultLayoutSlopeState(index);
    roofLayoutState.activeSlope = index;
    applyLayoutControlValues(slope);
    roofLayoutState.manual = !!slope.manual;
    roofLayoutState.panels = plainClone(slope.panels) || [];
    roofLayoutState.rails = plainClone(slope.rails) || [];
    roofLayoutState.selected = slope.selected ?? -1;
    roofLayoutState.selectedPanels = plainClone(slope.selectedPanels) || [];
    roofLayoutState.selectedRail = slope.selectedRail ?? -1;
    roofLayoutState.drag = null;
    roofLayoutState.materials = plainClone(slope.materials);
    roofLayoutState.draw = null;
  }

  function renderLayoutSlopeTabs() {
    els.layoutSlopeTabs.innerHTML = roofLayoutState.slopes.map((slope, index) => {
      const count = num(slope.panelCount, slope.panels?.length || 0);
      return `<button type="button" class="layoutSlopeTab ${index === roofLayoutState.activeSlope ? "active" : ""}" data-slope-index="${index}">${slope.name || `Скат ${index + 1}`}${count ? ` · ${fmt(count)} пан.` : ""}</button>`;
    }).join("");
  }

  function resetLayoutSlopes() {
    roofLayoutState.activeSlope = 0;
    roofLayoutState.slopes = [defaultLayoutSlopeState(0)];
    roofLayoutState.aggregateMaterials = null;
    loadLayoutSlope(0);
    renderLayoutSlopeTabs();
  }

  function invalidateRoofLayoutMaterials() {
    roofLayoutState.materials = null;
    roofLayoutState.aggregateMaterials = null;
    roofLayoutState.slopes.forEach((slope) => {
      slope.materials = null;
      slope.panelCount = slope.panels?.length || 0;
      slope.kwp = 0;
    });
  }

  function switchLayoutSlope(index) {
    if (index === roofLayoutState.activeSlope) return;
    drawRoofLayout(selectedRows().panel);
    saveActiveLayoutSlope();
    loadLayoutSlope(index);
    renderLayoutSlopeTabs();
    safeCalculate();
  }

  function addLayoutSlope() {
    drawRoofLayout(selectedRows().panel);
    saveActiveLayoutSlope();
    const nextIndex = roofLayoutState.slopes.length;
    roofLayoutState.slopes.push(defaultLayoutSlopeState(nextIndex, { empty: true }));
    loadLayoutSlope(nextIndex);
    renderLayoutSlopeTabs();
    safeCalculate();
  }

  function setDefaultSelect(select, value) {
    if ([...select.options].some((item) => item.value === value)) {
      select.value = value;
    }
  }

  function roofLabel(value) {
    return {
      "Metal tile": "Металлочерепица",
      "Soft roof": "Мягкая кровля",
      "Standing seam": "Фальцевая кровля",
      "Trapezoidal sheet": "Профлист",
      "Flat roof": "Плоская кровля",
      "Ground mount": "Наземная установка",
    }[value] || value;
  }

  function regionLabel(value) {
    return {
      "Moscow starter": "Москва",
      "Saint Petersburg starter": "Санкт-Петербург",
      "Krasnodar starter": "Краснодар",
      "Rostov-on-Don starter": "Ростов-на-Дону",
      "Yekaterinburg starter": "Екатеринбург",
      "Crimea starter": "Крым",
      "Belgorod starter": "Белгород",
      "Voronezh starter": "Воронеж",
      "Kursk starter": "Курск",
      "Lipetsk starter": "Липецк",
      "Tambov starter": "Тамбов",
      "Tula starter": "Тула",
      "Ryazan starter": "Рязань",
      "Nizhny Novgorod starter": "Нижний Новгород",
      "Kazan starter": "Казань",
      "Samara starter": "Самара",
      "Saratov starter": "Саратов",
      "Volgograd starter": "Волгоград",
      "Stavropol starter": "Ставрополь",
      "Sochi starter": "Сочи",
      "Novosibirsk starter": "Новосибирск",
      "Chelyabinsk starter": "Челябинск",
      "Perm starter": "Пермь",
      "Ufa starter": "Уфа",
      "Kaliningrad starter": "Калининград",
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

  function connectionLabel(value) {
    return {
      "series": "последовательное",
      "parallel": "параллельное",
      "series-parallel": "последовательно-параллельное",
    }[value] || value;
  }

  function clampPercent(value, fallback) {
    return Math.max(0, Math.min(100, num(value, fallback)));
  }

  function singleRoofFactor(tiltValue, azimuthValue) {
    const tilt = Math.max(0, Math.min(90, num(tiltValue, 35)));
    const orientationFactor = {
      "south": 1,
      "south-east": 0.96,
      "south-west": 0.96,
      "east": 0.88,
      "west": 0.88,
      "north-east": 0.75,
      "north-west": 0.75,
      "north": 0.6,
    }[azimuthValue] || 1;
    let tiltFactor = 1 - Math.min(Math.abs(tilt - 35) * 0.0045, 0.28);
    if (tilt <= 5) tiltFactor = 0.9;
    if (tilt >= 75) tiltFactor = Math.min(tiltFactor, 0.78);
    return {
      factor: Math.max(0.45, orientationFactor * tiltFactor),
      tilt,
      orientation: azimuthLabel(azimuthValue),
      orientationFactor,
      tiltFactor,
    };
  }

  function roofSlope(name, panelInput, shareInput, tiltInput, azimuthInput, connectionInput, stringsInput) {
    const base = singleRoofFactor(tiltInput.value, azimuthInput.value);
    return {
      name,
      panelCount: Math.max(0, Math.ceil(num(panelInput.value, 0))),
      share: clampPercent(shareInput.value, name === "Скат 1" ? 100 : 0),
      connection: connectionInput.value,
      connectionText: connectionLabel(connectionInput.value),
      stringsPerMppt: Math.max(1, Math.ceil(num(stringsInput.value, 1))),
      ...base,
    };
  }

  function roofYieldFactor() {
    const slopes = roofInputs()
      .slice(0, selectedRoofSlopeCount())
      .map((slope) => roofSlope(slope.name, slope.panels, slope.share, slope.tilt, slope.azimuth, slope.connection, slope.strings));
    const manualPanelTotal = slopes.reduce((sum, slope) => sum + slope.panelCount, 0);
    const active = manualPanelTotal > 0 ? slopes.filter((slope) => slope.panelCount > 0) : slopes.filter((slope) => slope.share > 0);
    const weighted = active.length ? active : [slopes[0]];
    const totalShare = manualPanelTotal > 0 ? manualPanelTotal : weighted.reduce((sum, slope) => sum + slope.share, 0) || 100;
    const factor = weighted.reduce((sum, slope) => sum + slope.factor * (manualPanelTotal > 0 ? slope.panelCount : slope.share || 100), 0) / totalShare;
    const label = weighted.map((slope) => {
      const basis = manualPanelTotal > 0 ? `${slope.panelCount} пан.` : `${fmt(slope.share || 100)}%`;
      return `${slope.name}: ${basis}, ${slope.orientation}, ${fmt(slope.tilt)}°, ${slope.connectionText}, ${slope.stringsPerMppt} стр./MPPT`;
    }).join("; ");
    return {
      factor,
      slopes,
      active: weighted,
      totalShare,
      manualPanelTotal,
      label,
    };
  }

  function selectedRows() {
    return {
      region: data.regions.find((row) => row.region === els.region.value) || data.regions[0],
      monthlyProfile: data.monthlyProfiles.find((row) => row.region === els.region.value) || data.monthlyProfiles[0],
      tariff: data.tariffs.find((row) => row.region === els.region.value) || data.tariffs[0],
      panel: data.panels.find((row) => row.model === els.panel.value) || data.panels[0],
      inverter: data.inverters.find((row) => row.model === els.inverter.value) || selectedInverters()[0] || data.inverters[0],
      battery: data.batteries.find((row) => row.model === els.battery.value) || data.batteries[0],
    };
  }

  function defaultTariffValues(tariff) {
    const retail = num(tariff?.retail_tariff_rub_kwh, 8.5);
    return {
      retail,
      day: retail * 1.12,
      night: retail * 0.42,
      export: num(tariff?.export_tariff_rub_kwh, 3.5),
    };
  }

  function setTariffInputsFromRegion() {
    const tariff = data.tariffs.find((row) => row.region === els.region.value) || data.tariffs[0];
    const values = defaultTariffValues(tariff);
    els.tariffRetail.value = values.retail.toFixed(2);
    els.tariffDay.value = values.day.toFixed(2);
    els.tariffNight.value = values.night.toFixed(2);
    els.tariffExport.value = values.export.toFixed(2);
  }

  function selectedTariffValues(tariff) {
    const defaults = defaultTariffValues(tariff);
    return {
      retail: num(els.tariffRetail.value, defaults.retail),
      day: num(els.tariffDay.value, defaults.day),
      night: num(els.tariffNight.value, defaults.night),
      export: num(els.tariffExport.value, defaults.export),
    };
  }

  function inverterWithManualInputs(inverter) {
    const manualFields = [
      ["manualMaxPvPower", "max_pv_input_power_w"],
      ["manualMaxPvVoltage", "max_pv_voltage_v"],
      ["manualStartupVoltage", "startup_voltage_v"],
      ["manualMpptMin", "mppt_voltage_min_v"],
      ["manualMpptMax", "mppt_voltage_max_v"],
      ["manualMpptCount", "mppt_count"],
      ["manualStringsPerMppt", "strings_per_mppt"],
      ["manualMaxInputCurrent", "max_input_current_per_mppt_a"],
      ["manualMaxShortCurrent", "max_short_circuit_current_per_mppt_a"],
    ];
    const next = { ...inverter };
    let hasManual = false;
    manualFields.forEach(([inputId, key]) => {
      const value = String(els[inputId]?.value ?? "").trim();
      if (value) {
        next[key] = value;
        hasManual = true;
      }
    });
    if (hasManual) {
      next.data_status = "manual_override";
      next.notes = "Часть параметров инвертора введена вручную в веб-калькуляторе.";
    }
    return next;
  }

  function updateInverterManualPlaceholders(inverter) {
    [
      ["manualMaxPvPower", "max_pv_input_power_w"],
      ["manualMaxPvVoltage", "max_pv_voltage_v"],
      ["manualStartupVoltage", "startup_voltage_v"],
      ["manualMpptMin", "mppt_voltage_min_v"],
      ["manualMpptMax", "mppt_voltage_max_v"],
      ["manualMpptCount", "mppt_count"],
      ["manualStringsPerMppt", "strings_per_mppt"],
      ["manualMaxInputCurrent", "max_input_current_per_mppt_a"],
      ["manualMaxShortCurrent", "max_short_circuit_current_per_mppt_a"],
    ].forEach(([inputId, key]) => {
      const value = String(inverter[key] || "").trim();
      els[inputId].placeholder = value || "нет данных";
    });
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

  function selectedBatteryQuantity(kwp, battery) {
    const manualQty = String(els.batteryQty.value ?? "").trim();
    if (manualQty !== "") return Math.max(0, Math.ceil(num(manualQty)));
    return batteryQuantity(kwp, battery);
  }

  function equipmentPrices() {
    return {
      panel: costPrice("panel_jinko_590", 14500),
      inverter: costPrice("inverter_deye_sun_6k", 135000),
      battery: costPrice("battery_lifepo4_314ah", 210000),
    };
  }

  function estimateTotal(rows) {
    return rows
      .filter((row) => !row.isTotal)
      .reduce((sum, row) => sum + row.qty * row.unitPrice, 0);
  }

  function buildCost(optionData, rows) {
    return estimateTotal(buildEstimate(optionData, rows, false));
  }

  function calculate() {
    updateRoofSlopeVisibility();
    const rows = selectedRows();
    drawRoofLayout(rows.panel);
    saveActiveLayoutSlope();
    const layoutSummary = summarizeRoofLayoutSlopes(rows.panel);
    syncPrimaryRoofInputs(layoutSummary);
    const panelW = Math.max(1, num(rows.panel.power_stc_w, 550));
    const annualConsumption = num(els.monthlyConsumption.value) * 12;
    const specificYield = num(rows.region.specific_yield_kwh_per_kwp_year, 950);
    const roofFactor = layoutRoofYieldFactor(layoutSummary);
    const performanceRatio = 0.85;
    const layoutPanels = Math.max(0, Math.ceil(num(layoutSummary.panels, 0)));
    const selfShare = num(els.selfShare.value, 70) / 100;
    const tariffValues = selectedTariffValues(rows.tariff);
    const retailTariff = tariffValues.retail;
    const exportTariff = tariffValues.export;
    const dayShare = num(els.dayShare.value, 65) / 100;
    const blendedDayNightTariff = tariffValues.day * dayShare + tariffValues.night * (1 - dayShare);

    const options = data.optionTiers.map((tier) => {
      const panels = layoutPanels;
      const kwp = panels * panelW / 1000;
      const annual = kwp * specificYield * performanceRatio * roofFactor.factor;
      const batteryQty = selectedBatteryQuantity(kwp, rows.battery);
      const cost = buildCost({ panels, kwp }, rows);
      const savings = annual * selfShare * retailTariff + annual * (1 - selfShare) * exportTariff;
      const dayNightBoost = Math.max(0, annualConsumption * (retailTariff - blendedDayNightTariff));
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
    updateInverterManualPlaceholders(rows.inverter);
    const effectiveInverter = inverterWithManualInputs(rows.inverter);
    const effectiveRows = { ...rows, inverter: effectiveInverter };
    const type = stationType(rows.inverter);
    const showPayback = type === "grid";
    const monthly = monthKeys.map((key) => standard.annual * num(rows.monthlyProfile[key]) / 100);
    const winter = buildWinterMetrics(standard.annual, rows.monthlyProfile, num(els.monthlyConsumption.value));
    const estimate = buildEstimate(standard, rows);
    const economics = buildEconomics(standard, rows, annualConsumption, tariffValues, selfShare, showPayback, roofFactor, winter);
    const recommendations = buildRecommendations(standard, effectiveRows, roofFactor, winter);
    const panelSpecs = buildPanelSpecs(rows.panel);
    const inverterSpecs = buildInverterSpecs(rows.inverter, effectiveInverter);

    els.systemSize.textContent = `${fmt(standard.kwp, 2)} кВтп`;
    els.panelCount.textContent = `${standard.panels} шт. (по чертежу)`;
    els.stringCountMetric.textContent = `${selectedStringCount(standard.panels, roofFactor)} шт.`;
    els.annualGeneration.textContent = `${fmt(standard.annual)} кВт·ч/год`;
    els.winterGeneration.textContent = `${fmt(winter.generation)} кВт·ч`;
    els.winterCoverage.textContent = `${fmt(winter.coverage)} %`;
    els.roofFactor.textContent = `${fmt(roofFactor.factor * 100)} %`;
    els.paybackMetric.style.display = showPayback ? "" : "none";
    els.payback.textContent = showPayback ? `${fmt(standard.payback, 1)} лет` : "";
    els.statusNote.textContent = statusText(rows);

    renderRecommendations(recommendations);
    renderPanelSpecs(panelSpecs);
    renderInverterSpecs(inverterSpecs);
    renderEstimate(estimate);
    renderEconomics(economics);
    drawChart(monthly);
  }

  function safeCalculate() {
    try {
      calculate();
    } catch (error) {
      console.error(error);
      if (els.statusNote) {
        els.statusNote.textContent = `Расчет остановился из-за ошибки: ${error.message}. Обновите страницу Ctrl + F5; если повторится, пришлите скрин.`;
      }
    }
  }

  function statusText(rows) {
    if (!selectedInverters().length) {
      return "Для выбранных фильтров инвертора моделей нет. Измените производителя, тип или количество фаз.";
    }
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

  function selectedStringCount(panelCount, roofFactor = null) {
    if (panelCount <= 0) return 0;
    const source = roofFactor || roofYieldFactor();
    const strings = source.active.reduce((sum, slope) => sum + slope.stringsPerMppt, 0);
    return Math.max(1, Math.min(panelCount, strings || 1));
  }

  function nextNominal(value, nominals) {
    return nominals.find((item) => item >= value) || nominals[nominals.length - 1];
  }

  function pvProtection(panel, stringCount) {
    const isc = num(panel.isc_stc_a, 14);
    const fuseNominal = nextNominal(isc * 1.25, [15, 20, 25, 30, 35, 40]);
    const breakerNominal = nextNominal(isc * Math.max(1, stringCount) * 1.25, [16, 20, 25, 32, 40, 50, 63, 80, 100]);
    return {
      isc,
      fuseNominal,
      breakerNominal,
      fuseQty: stringCount > 0 ? stringCount * 2 : 0,
      holderQty: stringCount > 0 ? stringCount * 2 : 0,
      breakerQty: stringCount > 0 ? 1 : 0,
    };
  }

  function panelsForSlope(panelCount, slope, totalShare) {
    if (slope.panelCount > 0) return slope.panelCount;
    return Math.max(0, Math.round(panelCount * (slope.share || 100) / (totalShare || 100)));
  }

  function slopeStringLabel(slope) {
    const groups = slope.stringGroups || [];
    const parts = groups.map((group) => `S${group.id}: ${group.count} пан.`);
    if (slope.unassignedStringPanels) parts.push(`без стринга: ${slope.unassignedStringPanels} пан.`);
    return parts.length ? parts.join(", ") : "стринги не размечены";
  }

  function buildWinterMetrics(annualGeneration, monthlyProfile, monthlyConsumption) {
    const winterPct = num(monthlyProfile.dec_pct) + num(monthlyProfile.jan_pct) + num(monthlyProfile.feb_pct);
    const generation = annualGeneration * winterPct / 100;
    const consumption = monthlyConsumption * 3;
    return {
      generation,
      consumption,
      coverage: consumption > 0 ? generation / consumption * 100 : 0,
      pct: winterPct,
      avgMonth: generation / 3,
      avgDay: generation / 90,
    };
  }

  function panelLayoutDimensions(panel) {
    const lengthM = num(panel.module_length_mm) / 1000;
    const widthM = num(panel.module_width_mm) / 1000;
    const fallback = { length: 2.278, width: 1.134, fallback: true };
    if (lengthM > 0 && widthM > 0) return { length: lengthM, width: widthM, fallback: false };
    return fallback;
  }

  function roofWidthAtY(layout, y) {
    return Math.max(0, roofRightAtY(layout, y) - roofLeftAtY(layout, y));
  }

  function roofRightAtY(layout, y) {
    if (layout.shape !== "hip" || layout.roofH <= 0) return (layout.bottomLeft ?? 0) + layout.bottomW;
    const ratio = Math.max(0, Math.min(1, y / layout.roofH));
    return layout.topRight + (layout.bottomRight - layout.topRight) * ratio;
  }

  function roofLeftAtY(layout, y) {
    if (layout.shape !== "hip" || layout.roofH <= 0) return layout.bottomLeft ?? 0;
    const ratio = Math.max(0, Math.min(1, y / layout.roofH));
    return layout.topLeft + (layout.bottomLeft - layout.topLeft) * ratio;
  }

  function roofCornerPoints(layout) {
    return [
      { id: "topLeft", x: roofLeftAtY(layout, 0), y: 0 },
      { id: "topRight", x: roofRightAtY(layout, 0), y: 0 },
      { id: "bottomRight", x: roofRightAtY(layout, layout.roofH), y: layout.roofH },
      { id: "bottomLeft", x: roofLeftAtY(layout, layout.roofH), y: layout.roofH },
    ];
  }

  function drawArrowHead(ctx, fromX, fromY, toX, toY) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - Math.cos(angle - Math.PI / 6) * size, toY - Math.sin(angle - Math.PI / 6) * size);
    ctx.lineTo(toX - Math.cos(angle + Math.PI / 6) * size, toY - Math.sin(angle + Math.PI / 6) * size);
    ctx.closePath();
    ctx.fill();
  }

  function drawDimensionArrow(ctx, x1, y1, x2, y2, label, vertical = false, edit = null) {
    ctx.save();
    ctx.strokeStyle = "#64748b";
    ctx.fillStyle = "#64748b";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    drawArrowHead(ctx, x2, y2, x1, y1);
    drawArrowHead(ctx, x1, y1, x2, y2);
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textWidth = Math.max(48, ctx.measureText(label).width);
    let labelX = (x1 + x2) / 2;
    let labelY = (y1 + y2) / 2 - 13;
    if (vertical) {
      labelX = (x1 + x2) / 2 - 20;
      labelY = (y1 + y2) / 2;
      ctx.translate(labelX, labelY);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0);
    } else {
      ctx.fillText(label, labelX, labelY);
    }
    ctx.restore();
    if (edit) {
      const padX = vertical ? 12 : textWidth / 2 + 8;
      const padY = vertical ? textWidth / 2 + 8 : 14;
      roofLayoutState.dimensionHandles.push({
        ...edit,
        x: labelX,
        y: labelY,
        minX: labelX - padX,
        maxX: labelX + padX,
        minY: labelY - padY,
        maxY: labelY + padY,
      });
    }
  }

  function panelInsideRoof(panel, layout) {
    const y1 = panel.y;
    const y2 = panel.y + panel.h;
    const overhang = num(layout.panelOverhang, 0);
    const left = Math.max(roofLeftAtY(layout, y1), roofLeftAtY(layout, y2)) + layout.setback - overhang;
    const right = Math.min(roofLeftAtY(layout, y1) + roofWidthAtY(layout, y1), roofLeftAtY(layout, y2) + roofWidthAtY(layout, y2)) - layout.setback + overhang;
    return panel.x >= left && panel.x + panel.w <= right && panel.y >= layout.setback - overhang && panel.y + panel.h <= layout.roofH - layout.setback + overhang;
  }

  function buildRoofLayout(panel, source = els) {
    const shape = sourceValue(source, "layoutRoofShape", "rectangle");
    const bottomW = Math.max(0, num(sourceValue(source, "layoutRoofWidth", 10)));
    const topWRaw = Math.max(0, num(sourceValue(source, "layoutRoofTopWidth", 6)));
    const topW = shape === "hip" ? Math.max(0.1, topWRaw || bottomW) : bottomW;
    const topOffsetRaw = num(sourceValue(source, "layoutRoofTopOffset", Math.max(0, (bottomW - topW) / 2)), Math.max(0, (bottomW - topW) / 2));
    const rawTopLeft = shape === "hip" ? topOffsetRaw : 0;
    const rawTopRight = rawTopLeft + topW;
    const rawBottomLeft = 0;
    const rawBottomRight = bottomW;
    const minX = Math.min(rawBottomLeft, rawTopLeft);
    const maxX = Math.max(rawBottomRight, rawTopRight);
    const roofW = Math.max(0, maxX - minX);
    const topLeft = rawTopLeft - minX;
    const topRight = rawTopRight - minX;
    const bottomLeft = rawBottomLeft - minX;
    const bottomRight = rawBottomRight - minX;
    const roofH = Math.max(0, num(sourceValue(source, "layoutRoofHeight", 6)));
    const setback = Math.max(0, num(sourceValue(source, "layoutSetback", 0.3)));
    const gap = Math.max(0, num(sourceValue(source, "layoutGap", 0.03)));
    const panelOverhang = Math.max(0, num(sourceValue(source, "layoutPanelOverhang", 0.2)));
    const maxPanels = Math.max(0, Math.floor(num(sourceValue(source, "layoutMaxPanels", 0))));
    const dims = panelLayoutDimensions(panel);
    const portrait = sourceValue(source, "layoutPanelOrientation", "portrait") === "portrait";
    const panelW = portrait ? dims.width : dims.length;
    const panelH = portrait ? dims.length : dims.width;
    const usableH = Math.max(0, roofH - setback * 2 + panelOverhang * 2);
    const rows = panelH > 0 ? Math.max(0, Math.floor((usableH + gap) / (panelH + gap))) : 0;
    const layoutBase = { shape, bottomW, topW, topOffset: topOffsetRaw, minX, maxW: roofW, roofW, roofH, topLeft, topRight, bottomLeft, bottomRight, setback, gap, panelW, panelH };
    const rowCols = [];
    for (let row = 0; row < rows; row += 1) {
      const y = setback - panelOverhang + row * (panelH + gap);
      const left = Math.max(roofLeftAtY(layoutBase, y), roofLeftAtY(layoutBase, y + panelH)) + setback - panelOverhang;
      const right = Math.min(
        roofLeftAtY(layoutBase, y) + roofWidthAtY(layoutBase, y),
        roofLeftAtY(layoutBase, y + panelH) + roofWidthAtY(layoutBase, y + panelH)
      ) - setback + panelOverhang;
      rowCols.push(panelW > 0 ? Math.max(0, Math.floor((right - left + gap) / (panelW + gap))) : 0);
    }
    const cols = rowCols.reduce((max, value) => Math.max(max, value), 0);
    const capacity = rowCols.reduce((sum, value) => sum + value, 0);
    const panels = maxPanels > 0 ? Math.min(capacity, maxPanels) : capacity;
    const panelArea = panelW * panelH;
    const roofArea = shape === "hip" ? (bottomW + topW) / 2 * roofH : roofW * roofH;
    const kwp = panels * num(panel.power_stc_w) / 1000;
    const profileLength = Math.max(0.1, num(sourceValue(source, "layoutProfileLength", 3.5), 3.5));
    const cableType = sourceValue(source, "layoutCableType", "2x6") === "2x4" ? "2x4" : "2x6";
    const cableLength = Math.max(0, num(sourceValue(source, "layoutCableLength", 0)));
    return {
      roofW,
      roofH,
      shape,
      bottomW,
      topW,
      topOffset: topOffsetRaw,
      minX,
      maxW: roofW,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
      setback,
      gap,
      panelOverhang,
      panelW,
      panelH,
      rows,
      cols,
      rowCols,
      capacity,
      panels,
      panelArea,
      roofArea,
      kwp,
      profileLength,
      profileOverhang: 0.2,
      cableType,
      cableLength,
      fallback: dims.fallback,
      orientation: portrait ? "портрет" : "альбом",
    };
  }

  function buildAutoLayoutPanels(layout) {
    const panels = [];
    let drawn = 0;
    for (let row = 0; row < layout.rows; row += 1) {
      const y = layout.setback - layout.panelOverhang + row * (layout.panelH + layout.gap);
      const left = Math.max(roofLeftAtY(layout, y), roofLeftAtY(layout, y + layout.panelH)) + layout.setback - layout.panelOverhang;
      const right = Math.min(
        roofLeftAtY(layout, y) + roofWidthAtY(layout, y),
        roofLeftAtY(layout, y + layout.panelH) + roofWidthAtY(layout, y + layout.panelH)
      ) - layout.setback + layout.panelOverhang;
      const colCount = layout.rowCols[row] || 0;
      const rowSpan = colCount * layout.panelW + Math.max(0, colCount - 1) * layout.gap;
      const startX = left + Math.max(0, (right - left - rowSpan) / 2);
      for (let col = 0; col < colCount; col += 1) {
        if (drawn >= layout.panels) break;
        panels.push({
          x: startX + col * (layout.panelW + layout.gap),
          y,
          w: layout.panelW,
          h: layout.panelH,
          rotated: false,
        });
        drawn += 1;
      }
    }
    return panels;
  }

  function clampLayoutPanel(panel, layout) {
    const rotated = Boolean(panel.rotated);
    const next = normalizeLayoutPanel({ ...panel, rotated }, layout);
    const overhang = num(layout.panelOverhang, 0);
    const y = Math.max(layout.setback - overhang, Math.min(layout.roofH - next.h - layout.setback + overhang, next.y));
    const left = Math.max(roofLeftAtY(layout, y), roofLeftAtY(layout, y + next.h)) + layout.setback - overhang;
    const right = Math.min(roofLeftAtY(layout, y) + roofWidthAtY(layout, y), roofLeftAtY(layout, y + next.h) + roofWidthAtY(layout, y + next.h)) - layout.setback + overhang;
    return {
      ...next,
      x: Math.max(left, Math.min(right - next.w, next.x)),
      y,
    };
  }

  function normalizeLayoutPanel(panel, layout) {
    const rotated = Boolean(panel.rotated);
    return {
      ...panel,
      rotated,
      w: rotated ? layout.panelH : layout.panelW,
      h: rotated ? layout.panelW : layout.panelH,
    };
  }

  function panelsOverlap(a, b) {
    const gap = 0.005;
    return a.x < b.x + b.w - gap
      && a.x + a.w > b.x + gap
      && a.y < b.y + b.h - gap
      && a.y + a.h > b.y + gap;
  }

  function stringColor(stringId) {
    const colors = ["#2563eb", "#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#65a30d", "#be185d", "#0f766e"];
    return colors[Math.max(0, num(stringId, 1) - 1) % colors.length];
  }

  function panelStringGroups(panels) {
    const groups = new Map();
    let unassigned = 0;
    panels.forEach((panel) => {
      const id = Math.max(0, Math.floor(num(panel.stringId, 0)));
      if (id > 0) {
        groups.set(id, (groups.get(id) || 0) + 1);
      } else {
        unassigned += 1;
      }
    });
    return {
      groups: [...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([id, count]) => ({ id, count, mppt: 1 })),
      unassigned,
      count: groups.size + (unassigned > 0 ? 1 : 0),
    };
  }

  function nextStringId(panels) {
    const ids = panels.map((panel) => Math.floor(num(panel.stringId, 0))).filter((id) => id > 0);
    return (ids.length ? Math.max(...ids) : 0) + 1;
  }

  function selectedPanelIndices() {
    if (roofLayoutState.selectedPanels.length) return roofLayoutState.selectedPanels.slice();
    if (roofLayoutState.selected >= 0) return [roofLayoutState.selected];
    return [];
  }

  function stringPanelIndices(stringId) {
    const id = Math.floor(num(stringId, 0));
    if (id <= 0) return [];
    return roofLayoutState.panels
      .map((panel, index) => (Math.floor(num(panel.stringId, 0)) === id ? index : -1))
      .filter((index) => index >= 0);
  }

  function cleanManualPanelsForLayout(panels, layout) {
    const kept = [];
    panels.forEach((item) => {
      const panel = normalizeLayoutPanel(item, layout);
      if (!panelInsideRoof(panel, layout)) return;
      if (kept.some((existing) => panelsOverlap(panel, existing))) return;
      kept.push(panel);
    });
    return kept;
  }

  function validPanelGroup(panels, layout) {
    return panels.every((panel) => panelInsideRoof(panel, layout))
      && panels.every((panel, index) => panels.slice(index + 1).every((other) => !panelsOverlap(panel, other)));
  }

  function candidatePanelSpots(layout) {
    const baseLayout = { ...layout, panels: layout.capacity };
    const autoSpots = buildAutoLayoutPanels(baseLayout);
    if (autoSpots.length) return autoSpots;
    const spots = [];
    const stepX = Math.max(layout.gap || 0.03, 0.05);
    const stepY = Math.max(layout.gap || 0.03, 0.05);
    for (let y = layout.setback - layout.panelOverhang; y <= layout.roofH - layout.panelH - layout.setback + layout.panelOverhang; y += stepY) {
      const left = Math.max(roofLeftAtY(layout, y), roofLeftAtY(layout, y + layout.panelH)) + layout.setback - layout.panelOverhang;
      const right = Math.min(
        roofLeftAtY(layout, y) + roofWidthAtY(layout, y),
        roofLeftAtY(layout, y + layout.panelH) + roofWidthAtY(layout, y + layout.panelH)
      ) - layout.setback + layout.panelOverhang;
      for (let x = left; x <= right - layout.panelW; x += stepX) {
        spots.push({ x, y, w: layout.panelW, h: layout.panelH, rotated: false });
      }
    }
    return spots;
  }

  function nextFreePanelSpot(layout, panels) {
    const existing = panels.map((panel) => normalizeLayoutPanel(panel, layout));
    return candidatePanelSpots(layout)
      .map((panel) => normalizeLayoutPanel(panel, layout))
      .find((panel) => panelInsideRoof(panel, layout) && existing.every((item) => !panelsOverlap(panel, item)));
  }

  function selectedPanelAnchor() {
    if (roofLayoutState.selected >= 0) return roofLayoutState.selected;
    if (roofLayoutState.selectedPanels.length) return roofLayoutState.selectedPanels[roofLayoutState.selectedPanels.length - 1];
    return roofLayoutState.panels.length - 1;
  }

  function adjacentPanelSpot(layout, panels) {
    const anchorIndex = selectedPanelAnchor();
    if (anchorIndex < 0 || !panels[anchorIndex]) return null;
    const existing = panels.map((panel) => normalizeLayoutPanel(panel, layout));
    const anchor = existing[anchorIndex];
    const gap = Math.max(0, num(layout.gap, 0.03));
    const proto = normalizeLayoutPanel({ rotated: Boolean(anchor.rotated) }, layout);
    const candidates = [
      { x: anchor.x + anchor.w + gap, y: anchor.y },
      { x: anchor.x - proto.w - gap, y: anchor.y },
      { x: anchor.x, y: anchor.y + anchor.h + gap },
      { x: anchor.x, y: anchor.y - proto.h - gap },
    ].map((item) => normalizeLayoutPanel({ ...item, rotated: Boolean(anchor.rotated) }, layout));
    return candidates.find((panel) => (
      panelInsideRoof(panel, layout)
      && existing.every((item, index) => index === anchorIndex || !panelsOverlap(panel, item))
    ));
  }

  function movePanelGroup(deltaX, deltaY, layout, indices = roofLayoutState.selectedPanels) {
    const selected = new Set(indices);
    const moved = roofLayoutState.panels.map((panel, index) => normalizeLayoutPanel({
      ...panel,
      x: selected.has(index) ? panel.x + deltaX : panel.x,
      y: selected.has(index) ? panel.y + deltaY : panel.y,
    }, layout));
    if (!validPanelGroup(moved, layout)) return false;
    roofLayoutState.panels = moved;
    roofLayoutState.selected = -1;
    roofLayoutState.selectedRail = -1;
    roofLayoutState.selectedPanels = indices.slice();
    return true;
  }

  function layoutRows(panels, layout) {
    const sorted = panels.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    const groups = [];
    sorted.forEach((panel) => {
      const center = panel.y + panel.h / 2;
      let group = groups.find((item) => Math.abs(item.center - center) <= layout.panelH * 0.45);
      if (!group) {
        group = { center, panels: [] };
        groups.push(group);
      }
      group.panels.push(panel);
      group.center = group.panels.reduce((sum, item) => sum + item.y + item.h / 2, 0) / group.panels.length;
    });
    return groups.map((group) => ({
      ...group,
      panels: group.panels.sort((a, b) => a.x - b.x),
    }));
  }

  function layoutRowsWithIndexes(indexes, layout) {
    const indexed = indexes
      .map((index) => ({ index, panel: normalizeLayoutPanel(roofLayoutState.panels[index], layout) }))
      .filter((item) => item.panel);
    const rows = [];
    indexed
      .sort((a, b) => a.panel.y - b.panel.y || a.panel.x - b.panel.x)
      .forEach((item) => {
        const center = item.panel.y + item.panel.h / 2;
        let row = rows.find((candidate) => Math.abs(candidate.center - center) <= layout.panelH * 0.45);
        if (!row) {
          row = { center, items: [] };
          rows.push(row);
        }
        row.items.push(item);
        row.center = row.items.reduce((sum, entry) => sum + entry.panel.y + entry.panel.h / 2, 0) / row.items.length;
      });
    return rows.map((row) => ({
      ...row,
      items: row.items.sort((a, b) => a.panel.x - b.panel.x),
    }));
  }

  function alignLayoutPanels() {
    enableManualLayoutFromCurrent();
    const rows = selectedRows();
    const layout = buildRoofLayout(rows.panel);
    const indexes = selectedPanelIndices().length > 1
      ? selectedPanelIndices()
      : roofLayoutState.panels.map((_, index) => index);
    if (!indexes.length) {
      els.roofLayoutNote.textContent = "На листе нет панелей для выравнивания.";
      return;
    }
    const gap = 0.02;
    els.layoutGap.value = gap;
    const nextPanels = roofLayoutState.panels.map((panel) => normalizeLayoutPanel(panel, layout));
    layoutRowsWithIndexes(indexes, layout).forEach((row) => {
      const rowY = Math.min(...row.items.map((item) => item.panel.y));
      const rowSpan = row.items.reduce((sum, item) => sum + item.panel.w, 0) + Math.max(0, row.items.length - 1) * gap;
      const sample = row.items[0].panel;
      const left = Math.max(roofLeftAtY(layout, rowY), roofLeftAtY(layout, rowY + sample.h)) + layout.setback - layout.panelOverhang;
      const right = Math.min(
        roofLeftAtY(layout, rowY) + roofWidthAtY(layout, rowY),
        roofLeftAtY(layout, rowY + sample.h) + roofWidthAtY(layout, rowY + sample.h)
      ) - layout.setback + layout.panelOverhang;
      let x = Math.max(left, Math.min(right - rowSpan, row.items[0].panel.x));
      row.items.forEach((item) => {
        nextPanels[item.index] = {
          ...nextPanels[item.index],
          x,
          y: rowY,
        };
        x += item.panel.w + gap;
      });
    });
    if (!validPanelGroup(nextPanels, layout)) {
      els.roofLayoutNote.textContent = "Не удалось выровнять: панели выходят за границы или пересекаются.";
      return;
    }
    roofLayoutState.panels = nextPanels;
    roofLayoutState.selected = -1;
    roofLayoutState.selectedPanels = indexes.slice().sort((a, b) => a - b);
    roofLayoutState.selectedRail = -1;
    els.roofLayoutNote.textContent = `Панели выровнены, зазор ${fmt(gap, 2)} м.`;
    safeCalculate();
  }

  function rowRailSegments(row, layout) {
    if (!row.panels.length) return [];
    const rawMinX = Math.min(...row.panels.map((panel) => panel.x));
    const rawMaxX = Math.max(...row.panels.map((panel) => panel.x + panel.w));
    const first = row.panels[0];
    const overhang = num(layout.profileOverhang, 0.2);
    return [first.y + first.h * 0.28, first.y + first.h * 0.72]
      .map((railY) => {
        const roofLeft = roofLeftAtY(layout, railY);
        const roofRight = roofLeft + roofWidthAtY(layout, railY);
        const minX = Math.max(roofLeft, rawMinX - overhang);
        const maxX = Math.min(roofRight, rawMaxX + overhang);
        return {
          y: railY,
          minX,
          maxX,
          span: Math.max(0, maxX - minX),
        };
      })
      .filter((segment) => segment.span > 0);
  }

  function rowClampMarkers(row) {
    if (!row.panels.length) return [];
    const panels = row.panels.slice().sort((a, b) => a.x - b.x);
    const first = panels[0];
    const last = panels[panels.length - 1];
    const railYs = [first.y + first.h * 0.28, first.y + first.h * 0.72];
    const markers = [];
    railYs.forEach((railY) => {
      markers.push({ type: "end", x: first.x, y: railY });
      markers.push({ type: "end", x: last.x + last.w, y: railY });
      for (let index = 0; index < panels.length - 1; index += 1) {
        const left = panels[index];
        const right = panels[index + 1];
        markers.push({ type: "inter", x: (left.x + left.w + right.x) / 2, y: railY });
      }
    });
    return markers;
  }

  function autoLayoutRails(panels, layout) {
    return layoutRows(panels, layout)
      .filter((row) => row.panels.length)
      .flatMap((row) => rowRailSegments(row, layout));
  }

  function clampLayoutRail(rail, layout) {
    const y = Math.max(0, Math.min(layout.roofH, rail.y));
    const roofLeft = roofLeftAtY(layout, y);
    const roofRight = roofLeft + roofWidthAtY(layout, y);
    const roofSpan = Math.max(0, roofRight - roofLeft);
    const requestedSpan = Math.max(0.1, rail.maxX - rail.minX);
    const span = Math.min(requestedSpan, roofSpan);
    const minX = Math.max(roofLeft, Math.min(roofRight - span, rail.minX));
    return {
      ...rail,
      y,
      minX,
      maxX: minX + span,
      span,
    };
  }

  function railsTouch(a, b, tolerance = 0.08) {
    if (Math.abs(a.y - b.y) > tolerance) return false;
    return Math.abs(a.maxX - b.minX) <= tolerance || Math.abs(b.maxX - a.minX) <= tolerance;
  }

  function connectedRailIndices(startIndex, rails) {
    const connected = new Set([startIndex]);
    let changed = true;
    while (changed) {
      changed = false;
      rails.forEach((rail, index) => {
        if (connected.has(index)) return;
        const touchesGroup = [...connected].some((groupIndex) => railsTouch(rail, rails[groupIndex]));
        if (touchesGroup) {
          connected.add(index);
          changed = true;
        }
      });
    }
    return [...connected].sort((a, b) => a - b);
  }

  function snapRailGroup(movedRails, groupIndices, allRails, layout) {
    const yTolerance = 0.12;
    const xTolerance = 0.12;
    const excluded = new Set(groupIndices);
    const otherRails = allRails.filter((_, index) => !excluded.has(index));
    let yDelta = 0;
    let bestY = yTolerance;
    movedRails.forEach((rail) => {
      otherRails.forEach((other) => {
        const distance = Math.abs(rail.y - other.y);
        if (distance < bestY) {
          bestY = distance;
          yDelta = other.y - rail.y;
        }
      });
    });
    let next = movedRails.map((rail) => clampLayoutRail({ ...rail, y: rail.y + yDelta }, layout));
    let xDelta = 0;
    let bestX = xTolerance;
    next.forEach((rail) => {
      otherRails.forEach((other) => {
        [
          { distance: Math.abs(rail.maxX - other.minX), delta: other.minX - rail.maxX },
          { distance: Math.abs(rail.minX - other.maxX), delta: other.maxX - rail.minX },
        ].forEach((candidate) => {
          if (Math.abs(rail.y - other.y) <= yTolerance && candidate.distance < bestX) {
            bestX = candidate.distance;
            xDelta = candidate.delta;
          }
        });
      });
    });
    if (xDelta) {
      next = next.map((rail) => clampLayoutRail({ ...rail, minX: rail.minX + xDelta, maxX: rail.maxX + xDelta }, layout));
    }
    return next;
  }

  function calculateLayoutMaterials(panels, layout, manualRails = null) {
    const rows = layoutRows(panels, layout).filter((row) => row.panels.length);
    let rails = [];
    let clampMarkers = [];
    let railPieces = 0;
    let railConnectors = 0;
    let roofMounts = 0;
    let railMeters = 0;
    if (manualRails !== null) {
      rails = manualRails.map((rail) => clampLayoutRail(rail, layout));
      rows.forEach((row) => {
        row.rails = [];
      });
    } else {
      rows.forEach((row) => {
        row.rails = rowRailSegments(row, layout);
        rails.push(...row.rails);
      });
    }
    rows.forEach((row) => {
      clampMarkers.push(...rowClampMarkers(row));
    });
    const railJoints = [];
    rails.forEach((rail) => {
      const piecesPerRail = Math.max(1, Math.ceil(rail.span / layout.profileLength));
      railConnectors += Math.max(0, piecesPerRail - 1);
      roofMounts += Math.ceil(rail.span) + 1;
      railMeters += rail.span;
      rail.joints = Array.from({ length: Math.max(0, piecesPerRail - 1) }, (_, index) => rail.minX + layout.profileLength * (index + 1))
        .filter((x) => x > rail.minX && x < rail.maxX);
      rail.joints.forEach((x) => railJoints.push({ x, y: rail.y }));
    });
    rails.forEach((rail, index) => {
      rails.slice(index + 1).forEach((other) => {
        if (!railsTouch(rail, other)) return;
        const x = Math.abs(rail.maxX - other.minX) <= Math.abs(other.maxX - rail.minX)
          ? (rail.maxX + other.minX) / 2
          : (other.maxX + rail.minX) / 2;
        railConnectors += 1;
        railJoints.push({ x, y: (rail.y + other.y) / 2 });
      });
    });
    railPieces = railMeters > 0 ? Math.ceil(railMeters / layout.profileLength) : 0;
    return {
      rows,
      rails,
      railJoints,
      clampMarkers,
      panels: panels.length,
      railPieces,
      railConnectors,
      roofMounts,
      endClamps: rows.length * 4,
      middleClamps: rows.reduce((sum, row) => sum + Math.max(0, row.panels.length - 1) * 2, 0),
      railMeters,
      profileLength: layout.profileLength,
      cableType: layout.cableType,
      cableLength: layout.cableLength,
    };
  }

  function layoutSnapshotForSlope(slope, index, panel) {
    const layout = buildRoofLayout(panel, slope);
    let panels = slope.manual
      ? cleanManualPanelsForLayout(plainClone(slope.panels) || [], layout)
      : buildAutoLayoutPanels(layout);
    let manualRails = null;
    if (slope.manual) {
      manualRails = (plainClone(slope.rails) || []).map((rail) => clampLayoutRail(rail, layout));
      panels = panels.filter((item) => item.w > 0 && item.h > 0);
    }
    layout.panels = panels.length;
    layout.kwp = panels.length * num(panel.power_stc_w) / 1000;
    const materials = calculateLayoutMaterials(panels, layout, manualRails);
    const strings = panelStringGroups(panels);
    const tilt = Math.max(0, Math.min(90, num(slope.layoutSlopeTilt, 35)));
    const azimuth = slope.layoutSlopeAzimuth || "south";
    Object.assign(slope, {
      name: `Скат ${index + 1}`,
      panels: plainClone(panels) || [],
      rails: slope.manual ? plainClone(materials.rails) || [] : plainClone(slope.rails) || [],
      materials: plainClone(materials),
      panelCount: materials.panels,
      kwp: layout.kwp,
    });
    return {
      index,
      name: slope.name,
      layout,
      materials,
      panelCount: materials.panels,
      kwp: layout.kwp,
      tilt,
      azimuth,
      stringGroups: strings.groups,
      unassignedStringPanels: strings.unassigned,
      stringsPerMppt: Math.max(1, strings.count),
    };
  }

  function sumLayoutMaterials(snapshots) {
    const total = {
      rows: [],
      rails: [],
      railJoints: [],
      clampMarkers: [],
      panels: 0,
      rowCount: 0,
      railPieces: 0,
      railConnectors: 0,
      roofMounts: 0,
      endClamps: 0,
      middleClamps: 0,
      railMeters: 0,
      profileLength: 0,
      profileLabel: "",
      cableByType: {},
      cableLength: 0,
    };
    const profileLengths = new Set();
    snapshots.forEach((snapshot) => {
      const materials = snapshot.materials;
      if (!materials) return;
      total.panels += materials.panels || 0;
      total.rowCount += materials.rows?.length || 0;
      total.railPieces += materials.railPieces || 0;
      total.railConnectors += materials.railConnectors || 0;
      total.roofMounts += materials.roofMounts || 0;
      total.endClamps += materials.endClamps || 0;
      total.middleClamps += materials.middleClamps || 0;
      total.railMeters += materials.railMeters || 0;
      if (materials.cableLength > 0) {
        const cableType = materials.cableType === "2x4" ? "2x4" : "2x6";
        total.cableByType[cableType] = (total.cableByType[cableType] || 0) + materials.cableLength;
        total.cableLength += materials.cableLength;
      }
      if (materials.profileLength) profileLengths.add(num(materials.profileLength, 0));
    });
    const lengths = [...profileLengths].filter(Boolean).sort((a, b) => a - b);
    total.profileLength = lengths.length === 1 ? lengths[0] : lengths[0] || 0;
    total.profileLabel = lengths.length
      ? lengths.map((value) => `${fmt(value, 1)} м`).join(" / ")
      : "профиль";
    return total;
  }

  function layoutRoofYieldFactor(summary) {
    const slopes = summary.slopes.map((slope) => {
      const base = singleRoofFactor(slope.tilt, slope.azimuth);
      return {
        name: slope.name,
        panelCount: slope.panelCount,
        share: 100,
        connection: "series",
        connectionText: "последовательное",
        stringsPerMppt: slope.stringsPerMppt,
        stringGroups: slope.stringGroups || [],
        unassignedStringPanels: slope.unassignedStringPanels || 0,
        ...base,
      };
    });
    const active = slopes.filter((slope) => slope.panelCount > 0);
    const weighted = active.length ? active : slopes.slice(0, 1);
    const manualPanelTotal = active.reduce((sum, slope) => sum + slope.panelCount, 0);
    const totalShare = manualPanelTotal || 100;
    const factor = manualPanelTotal
      ? active.reduce((sum, slope) => sum + slope.factor * slope.panelCount, 0) / manualPanelTotal
      : (weighted[0]?.factor || 1);
    const label = weighted.map((slope) => {
      const basis = `${slope.panelCount} пан.`;
      return `${slope.name}: ${basis}, ${slope.orientation}, ${fmt(slope.tilt)}°, ${slope.connectionText}, ${slope.stringsPerMppt} стр./MPPT`;
    }).join("; ");
    return {
      factor,
      slopes,
      active: weighted,
      totalShare,
      manualPanelTotal,
      label,
    };
  }

  function summarizeRoofLayoutSlopes(panel) {
    if (!roofLayoutState.slopes.length) resetLayoutSlopes();
    const snapshots = roofLayoutState.slopes.map((slope, index) => layoutSnapshotForSlope(slope, index, panel));
    const materials = sumLayoutMaterials(snapshots);
    roofLayoutState.aggregateMaterials = materials;
    renderLayoutSlopeTabs();
    return {
      panels: materials.panels,
      kwp: snapshots.reduce((sum, snapshot) => sum + snapshot.kwp, 0),
      materials,
      slopes: snapshots,
    };
  }

  function drawRoofLayout(panel) {
    const layout = buildRoofLayout(panel);
    const canvas = els.roofLayoutCanvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    if (!layout.roofW || !layout.roofH) {
      els.roofLayoutMetrics.innerHTML = "";
      els.roofLayoutNote.textContent = "Введите размеры ската.";
      return layout;
    }

    const pad = 34;
    const scale = Math.min((w - pad * 2) / layout.roofW, (h - pad * 2) / layout.roofH);
    const roofDrawW = layout.roofW * scale;
    const roofDrawH = layout.roofH * scale;
    const roofX = (w - roofDrawW) / 2;
    const roofY = (h - roofDrawH) / 2;
    roofLayoutState.dimensionHandles = [];
    const setbackPx = layout.setback * scale;
    const gapPx = layout.gap * scale;
    const panelPxW = layout.panelW * scale;
    const panelPxH = layout.panelH * scale;
    const autoPanels = buildAutoLayoutPanels(layout);
    if (!roofLayoutState.manual) {
      roofLayoutState.panels = autoPanels;
      roofLayoutState.selected = -1;
      roofLayoutState.selectedPanels = [];
      roofLayoutState.selectedRail = -1;
      roofLayoutState.rails = [];
    } else {
      const directEdit = roofLayoutState.drag && ["panel", "panels", "rail"].includes(roofLayoutState.drag.type);
      roofLayoutState.panels = directEdit
        ? roofLayoutState.panels
          .map((item) => clampLayoutPanel(item, layout))
          .filter((item) => panelInsideRoof(item, layout))
          .filter((item) => item.w > 0 && item.h > 0)
        : cleanManualPanelsForLayout(roofLayoutState.panels, layout);
      if (roofLayoutState.selected >= roofLayoutState.panels.length) roofLayoutState.selected = -1;
      roofLayoutState.selectedPanels = roofLayoutState.selectedPanels.filter((index) => index < roofLayoutState.panels.length);
      roofLayoutState.rails = roofLayoutState.rails.map((rail) => clampLayoutRail(rail, layout));
      if (roofLayoutState.selectedRail >= roofLayoutState.rails.length) roofLayoutState.selectedRail = -1;
    }
    const panels = roofLayoutState.panels;
    layout.panels = panels.length;
    layout.kwp = panels.length * num(panel.power_stc_w) / 1000;
    roofLayoutState.materials = calculateLayoutMaterials(panels, layout, roofLayoutState.manual ? roofLayoutState.rails : null);
    roofLayoutState.draw = { roofX, roofY, scale, layout };

    ctx.fillStyle = "#eef3f6";
    ctx.strokeStyle = "#10252e";
    ctx.lineWidth = 2;
    const roofPoints = [
      [roofX + roofLeftAtY(layout, 0) * scale, roofY],
      [roofX + (roofLeftAtY(layout, 0) + roofWidthAtY(layout, 0)) * scale, roofY],
      [roofX + (roofLeftAtY(layout, layout.roofH) + roofWidthAtY(layout, layout.roofH)) * scale, roofY + roofDrawH],
      [roofX + roofLeftAtY(layout, layout.roofH) * scale, roofY + roofDrawH],
    ];
    ctx.beginPath();
    roofPoints.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = "#8aa0b2";
    ctx.lineWidth = 1;
    const setbackTopY = layout.setback;
    const setbackBottomY = Math.max(layout.setback, layout.roofH - layout.setback);
    const setbackPoints = [
      [roofX + (roofLeftAtY(layout, setbackTopY) + layout.setback) * scale, roofY + setbackTopY * scale],
      [roofX + (roofLeftAtY(layout, setbackTopY) + roofWidthAtY(layout, setbackTopY) - layout.setback) * scale, roofY + setbackTopY * scale],
      [roofX + (roofLeftAtY(layout, setbackBottomY) + roofWidthAtY(layout, setbackBottomY) - layout.setback) * scale, roofY + setbackBottomY * scale],
      [roofX + (roofLeftAtY(layout, setbackBottomY) + layout.setback) * scale, roofY + setbackBottomY * scale],
    ];
    ctx.beginPath();
    setbackPoints.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    panels.forEach((item, index) => {
      const x = roofX + item.x * scale;
      const y = roofY + item.y * scale;
      const itemW = item.w * scale;
      const itemH = item.h * scale;
      const selected = roofLayoutState.selectedPanels.includes(index) || index === roofLayoutState.selected;
      const stringId = Math.floor(num(item.stringId, 0));
      ctx.fillStyle = stringId > 0 ? stringColor(stringId) : "#143d52";
      ctx.fillRect(x, y, itemW, itemH);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, itemW, itemH);
      if (stringId > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`S${stringId}`, x + itemW / 2, y + itemH / 2);
      }
      if (selected) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, itemW - 4, itemH - 4);
      }
    });

    ctx.save();
    roofLayoutState.materials.rails.forEach((rail, index) => {
      ctx.setLineDash([]);
      ctx.strokeStyle = "#ffd21f";
      ctx.lineWidth = index === roofLayoutState.selectedRail ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(roofX + rail.minX * scale, roofY + rail.y * scale);
      ctx.lineTo(roofX + rail.maxX * scale, roofY + rail.y * scale);
      ctx.stroke();
      if (index === roofLayoutState.selectedRail) {
        ctx.strokeStyle = "#0f8b6f";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
    ctx.restore();

    roofLayoutState.materials.railJoints.forEach((joint) => {
      const size = 9;
      const x = roofX + joint.x * scale - size / 2;
      const y = roofY + joint.y * scale - size / 2;
      ctx.fillStyle = "#86efac";
      ctx.strokeStyle = "#15803d";
      ctx.lineWidth = 1.5;
      ctx.fillRect(x, y, size, size);
      ctx.strokeRect(x, y, size, size);
    });

    const movingPanels = roofLayoutState.drag && ["panel", "panels"].includes(roofLayoutState.drag.type);
    if (!movingPanels) {
      roofLayoutState.materials.clampMarkers.forEach((marker) => {
        const size = marker.type === "inter" ? 8 : 9;
        const x = roofX + marker.x * scale - size / 2;
        const y = roofY + marker.y * scale - size / 2;
        ctx.fillStyle = marker.type === "inter" ? "#ef1b1b" : "#ff8fc7";
        ctx.strokeStyle = marker.type === "inter" ? "#8b0000" : "#b83280";
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, size, size);
        ctx.strokeRect(x, y, size, size);
      });
    }

    const corners = roofCornerPoints(layout);
    const toCanvas = (point) => ({ x: roofX + point.x * scale, y: roofY + point.y * scale });
    const topLeft = toCanvas(corners[0]);
    const topRight = toCanvas(corners[1]);
    const bottomRight = toCanvas(corners[2]);
    const bottomLeft = toCanvas(corners[3]);
    drawDimensionArrow(ctx, bottomLeft.x, bottomLeft.y + 28, bottomRight.x, bottomRight.y + 28, `${fmt(layout.bottomW, 1)} м`, false, {
      type: "bottomWidth",
      label: "нижнюю ширину",
      inputId: "layoutRoofWidth",
      min: 1,
    });
    if (layout.shape === "hip") {
      const topDimensionY = Math.max(18, topLeft.y - 16);
      drawDimensionArrow(ctx, topLeft.x, topDimensionY, topRight.x, topDimensionY, `верх ${fmt(layout.topW, 1)} м`, false, {
        type: "topWidth",
        label: "верхнюю ширину",
        inputId: "layoutRoofTopWidth",
        min: 0.1,
      });
    }
    drawDimensionArrow(ctx, bottomLeft.x - 28, bottomLeft.y, topLeft.x - 28, topLeft.y, `${fmt(layout.roofH, 1)} м`, true, {
      type: "leftHeight",
      label: "высоту ската",
      inputId: "layoutRoofHeight",
      min: 1,
    });
    drawDimensionArrow(ctx, bottomRight.x + 28, bottomRight.y, topRight.x + 28, topRight.y, `${fmt(layout.roofH, 1)} м`, true, {
      type: "rightHeight",
      label: "высоту ската",
      inputId: "layoutRoofHeight",
      min: 1,
    });

    corners.forEach((corner) => {
      const point = toCanvas(corner);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    const occupiedPct = layout.roofArea > 0 ? layout.panels * layout.panelArea / layout.roofArea * 100 : 0;
    const materials = roofLayoutState.materials;
    const strings = panelStringGroups(panels);
    const stringText = strings.groups.length
      ? [
        ...strings.groups.map((group) => `S${group.id}: ${group.count}`),
        strings.unassigned ? `без стринга: ${strings.unassigned}` : "",
      ].filter(Boolean).join(", ")
      : (strings.unassigned ? "не размечены" : "0");
    els.roofLayoutMetrics.innerHTML = `
      <div><span>Панелей</span><strong>${layout.panels} шт.</strong></div>
      <div><span>Стринги</span><strong>${strings.count} шт. ${stringText}</strong></div>
      <div><span>Ряды × колонки</span><strong>${materials.rows.length} × ${materials.rows.reduce((max, row) => Math.max(max, row.panels.length), 0)}</strong></div>
      <div><span>Мощность</span><strong>${fmt(layout.kwp, 2)} кВтп</strong></div>
      <div><span>Ориентация ската</span><strong>${azimuthLabel(els.layoutSlopeAzimuth.value)}, ${fmt(num(els.layoutSlopeTilt.value, 35))}°</strong></div>
      <div><span>Форма ската</span><strong>${layout.shape === "hip" ? `вальмовая ${fmt(layout.topW, 1)}/${fmt(layout.bottomW, 1)} м, смещ. ${fmt(layout.topOffset, 1)} м` : "прямоугольная"}</strong></div>
      <div><span>Панель</span><strong>${fmt(layout.panelW, 2)} × ${fmt(layout.panelH, 2)} м</strong></div>
      <div><span>Площадь ската</span><strong>${fmt(layout.roofArea, 1)} м²</strong></div>
      <div><span>Занято панелями</span><strong>${fmt(occupiedPct)} %</strong></div>
      <div><span>Профиль ${fmt(materials.profileLength, 1)} м</span><strong>${materials.railPieces} шт.</strong></div>
      <div><span>Кабель СЭС</span><strong>${layout.cableType.replace("x", " × ")} · ${fmt(layout.cableLength)} м</strong></div>
      <div><span>L-крепеж</span><strong>${materials.roofMounts} шт.</strong></div>
      <div><span>Соединители профиля</span><strong>${materials.railConnectors} шт.</strong></div>
      <div><span>Inter Clamp</span><strong>${materials.middleClamps} компл.</strong></div>
      <div><span>End Clamp</span><strong>${materials.endClamps} компл.</strong></div>
    `;
    els.roofLayoutNote.textContent = layout.fallback
      ? "В выбранной модели нет размеров панели, использован типовой размер 2278 × 1134 мм."
      : `${roofLayoutState.manual ? "Ручная раскладка: Ctrl + клик выбирает несколько панелей, выбранную группу можно перетаскивать. Ctrl + стрелки двигают выбранные панели. " : ""}Размер панели взят из выбранной модели: ${layout.orientation}.`;
    return layout;
  }

  function canvasToRoofPoint(event) {
    const draw = roofLayoutState.draw;
    if (!draw) return null;
    const rect = els.roofLayoutCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (els.roofLayoutCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (els.roofLayoutCanvas.height / rect.height);
    return {
      x: (x - draw.roofX) / draw.scale,
      y: (y - draw.roofY) / draw.scale,
    };
  }

  function canvasPixelPoint(event) {
    const rect = els.roofLayoutCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (els.roofLayoutCanvas.width / rect.width),
      y: (event.clientY - rect.top) * (els.roofLayoutCanvas.height / rect.height),
    };
  }

  function findDimensionHandle(event) {
    const point = canvasPixelPoint(event);
    return roofLayoutState.dimensionHandles.find((handle) => (
      point.x >= handle.minX
      && point.x <= handle.maxX
      && point.y >= handle.minY
      && point.y <= handle.maxY
    )) || null;
  }

  function editRoofDimension(handle) {
    const input = byId(handle.inputId);
    if (!input) return;
    const current = num(input.value);
    roofLayoutState.dimensionEditorHandle = handle;
    const rect = els.roofLayoutCanvas.getBoundingClientRect();
    const left = Math.max(6, Math.min(rect.width - 104, handle.x * (rect.width / els.roofLayoutCanvas.width) - 52));
    const top = Math.max(6, Math.min(rect.height - 40, handle.y * (rect.height / els.roofLayoutCanvas.height) - 18));
    els.dimensionEditor.style.left = `${left}px`;
    els.dimensionEditor.style.top = `${top}px`;
    els.dimensionEditorInput.min = String(handle.min);
    els.dimensionEditorInput.value = String(current);
    els.dimensionEditor.hidden = false;
    els.dimensionEditorInput.focus();
    els.dimensionEditorInput.select();
  }

  function closeDimensionEditor(apply = false) {
    if (els.dimensionEditor.hidden) return;
    const handle = roofLayoutState.dimensionEditorHandle;
    const input = handle ? byId(handle.inputId) : null;
    if (apply && handle && input) {
      const next = num(els.dimensionEditorInput.value, NaN);
      if (Number.isFinite(next) && next >= handle.min) {
        setLayoutNumber(input, next, handle.min);
        safeCalculate();
      }
    }
    roofLayoutState.dimensionEditorHandle = null;
    els.dimensionEditor.hidden = true;
  }

  function findLayoutPanel(point) {
    if (!point) return -1;
    for (let index = roofLayoutState.panels.length - 1; index >= 0; index -= 1) {
      const item = roofLayoutState.panels[index];
      if (point.x >= item.x && point.x <= item.x + item.w && point.y >= item.y && point.y <= item.y + item.h) {
        return index;
      }
    }
    return -1;
  }

  function findLayoutRail(point) {
    const draw = roofLayoutState.draw;
    if (!point || !draw || !roofLayoutState.materials) return -1;
    const tolerance = Math.max(0.05, 8 / draw.scale);
    for (let index = roofLayoutState.materials.rails.length - 1; index >= 0; index -= 1) {
      const rail = roofLayoutState.materials.rails[index];
      const withinX = point.x >= rail.minX - tolerance && point.x <= rail.maxX + tolerance;
      const withinY = Math.abs(point.y - rail.y) <= tolerance;
      if (withinX && withinY) return index;
    }
    return -1;
  }

  function findRoofHandle(point) {
    const draw = roofLayoutState.draw;
    if (!point || !draw) return null;
    const tolerance = Math.max(0.08, 11 / draw.scale);
    return roofCornerPoints(draw.layout).find((corner) => Math.hypot(point.x - corner.x, point.y - corner.y) <= tolerance) || null;
  }

  function setLayoutNumber(input, value, min = 0.1) {
    input.value = Math.max(min, value).toFixed(1);
  }

  function updateRoofFromHandleDrag(point) {
    const drag = roofLayoutState.drag;
    if (!drag || drag.type !== "roof" || !point) return;
    const deltaX = point.x - drag.startX;
    const deltaY = point.y - drag.startY;
    const isTop = drag.handle.startsWith("top");
    const heightDelta = isTop ? -deltaY : deltaY;
    const nextHeight = Math.max(1, drag.startHeight + heightDelta);
    if (drag.shape === "hip") {
      if (drag.handle === "topLeft") {
        const nextOffset = drag.startTopOffset + deltaX;
        const nextTopWidth = drag.startTopWidth - deltaX;
        setLayoutNumber(els.layoutRoofTopOffset, nextOffset, -100);
        setLayoutNumber(els.layoutRoofTopWidth, nextTopWidth, 0.1);
      } else if (drag.handle === "topRight") {
        const nextTopWidth = drag.startTopWidth + deltaX;
        setLayoutNumber(els.layoutRoofTopWidth, nextTopWidth, 0.1);
      } else if (drag.handle === "bottomLeft") {
        const nextBottomWidth = drag.startBottomWidth - deltaX;
        const nextOffset = drag.startTopOffset - deltaX;
        setLayoutNumber(els.layoutRoofWidth, nextBottomWidth, 1);
        setLayoutNumber(els.layoutRoofTopOffset, nextOffset, -100);
      } else {
        setLayoutNumber(els.layoutRoofWidth, drag.startBottomWidth + deltaX, 1);
      }
    } else {
      const isLeft = drag.handle.endsWith("Left");
      const widthDelta = (isLeft ? -deltaX : deltaX) * 2;
      const nextWidth = Math.max(1, drag.startBottomWidth + widthDelta);
      setLayoutNumber(els.layoutRoofWidth, nextWidth, 1);
      setLayoutNumber(els.layoutRoofTopWidth, nextWidth, 1);
      setLayoutNumber(els.layoutRoofTopOffset, 0, -100);
    }
    setLayoutNumber(els.layoutRoofHeight, nextHeight, 1);
  }

  function enableManualLayoutFromCurrent() {
    const rows = selectedRows();
    const layout = drawRoofLayout(rows.panel);
    if (!roofLayoutState.manual) {
      roofLayoutState.panels = buildAutoLayoutPanels(layout);
      roofLayoutState.rails = [];
      roofLayoutState.selected = roofLayoutState.panels.length ? 0 : -1;
      roofLayoutState.selectedPanels = [];
      roofLayoutState.selectedRail = -1;
    }
    roofLayoutState.manual = true;
    drawRoofLayout(rows.panel);
  }

  function clearRoofLayoutSheet() {
    roofLayoutState.manual = true;
    roofLayoutState.panels = [];
    roofLayoutState.rails = [];
    roofLayoutState.selected = -1;
    roofLayoutState.selectedPanels = [];
    roofLayoutState.selectedRail = -1;
    roofLayoutState.drag = null;
    roofLayoutState.materials = null;
    safeCalculate();
  }

  function addLayoutPanel() {
    const rows = selectedRows();
    enableManualLayoutFromCurrent();
    const layout = buildRoofLayout(rows.panel);
    const panel = adjacentPanelSpot(layout, roofLayoutState.panels) || nextFreePanelSpot(layout, roofLayoutState.panels);
    if (!panel) {
      els.roofLayoutNote.textContent = "Свободного места под новую панель на этом скате не найдено.";
      return;
    }
    roofLayoutState.panels.push(panel);
    roofLayoutState.selected = roofLayoutState.panels.length - 1;
    roofLayoutState.selectedPanels = [];
    roofLayoutState.selectedRail = -1;
    safeCalculate();
  }

  function addLayoutRail() {
    const rows = selectedRows();
    const layout = buildRoofLayout(rows.panel);
    enableManualLayoutFromCurrent();
    const y = layout.roofH / 2;
    const roofLeft = roofLeftAtY(layout, y);
    const roofRight = roofLeft + roofWidthAtY(layout, y);
    const span = Math.min(layout.profileLength, Math.max(0.1, roofRight - roofLeft));
    const minX = roofLeft + Math.max(0, (roofRight - roofLeft - span) / 2);
    const rail = clampLayoutRail({
      minX,
      maxX: minX + span,
      y,
    }, layout);
    roofLayoutState.rails.push(rail);
    roofLayoutState.selectedRail = roofLayoutState.rails.length - 1;
    roofLayoutState.selected = -1;
    roofLayoutState.selectedPanels = [];
    safeCalculate();
  }

  function makeSelectedPanelsString() {
    enableManualLayoutFromCurrent();
    const indices = selectedPanelIndices().filter((index) => roofLayoutState.panels[index]);
    if (!indices.length) {
      els.roofLayoutNote.textContent = "Выделите панели через Ctrl + клик, затем нажмите «Объединить в стринг».";
      return;
    }
    const id = nextStringId(roofLayoutState.panels);
    indices.forEach((index) => {
      roofLayoutState.panels[index] = { ...roofLayoutState.panels[index], stringId: id };
    });
    roofLayoutState.selected = -1;
    roofLayoutState.selectedPanels = indices;
    roofLayoutState.selectedRail = -1;
    els.roofLayoutNote.textContent = `Стринг S${id}: ${indices.length} панелей.`;
    safeCalculate();
  }

  function clearSelectedPanelsString() {
    enableManualLayoutFromCurrent();
    const indices = selectedPanelIndices().filter((index) => roofLayoutState.panels[index]);
    if (!indices.length) {
      els.roofLayoutNote.textContent = "Выделите панели, с которых нужно снять стринг.";
      return;
    }
    indices.forEach((index) => {
      const { stringId, ...panel } = roofLayoutState.panels[index];
      roofLayoutState.panels[index] = panel;
    });
    roofLayoutState.selected = -1;
    roofLayoutState.selectedPanels = indices;
    roofLayoutState.selectedRail = -1;
    els.roofLayoutNote.textContent = `Стринг снят с ${indices.length} панелей.`;
    safeCalculate();
  }

  function rotateSelectedLayoutPanel() {
    enableManualLayoutFromCurrent();
    if (roofLayoutState.selected < 0) {
      els.roofLayoutNote.textContent = "Сначала выберите панель на чертеже.";
      return;
    }
    const rows = selectedRows();
    const layout = buildRoofLayout(rows.panel);
    const current = roofLayoutState.panels[roofLayoutState.selected];
    const centerX = current.x + current.w / 2;
    const centerY = current.y + current.h / 2;
    const rotated = !current.rotated;
    const nextW = rotated ? layout.panelH : layout.panelW;
    const nextH = rotated ? layout.panelW : layout.panelH;
    const candidate = clampLayoutPanel({
      ...current,
      rotated,
      x: centerX - nextW / 2,
      y: centerY - nextH / 2,
    }, layout);
    if (!panelInsideRoof(candidate, layout)) {
      drawRoofLayout(rows.panel);
      els.roofLayoutNote.textContent = "Панель после поворота не помещается в границы ската.";
      return;
    }
    roofLayoutState.panels[roofLayoutState.selected] = candidate;
    roofLayoutState.selectedRail = -1;
    roofLayoutState.selectedPanels = [];
    safeCalculate();
  }

  function deleteSelectedLayoutPanel() {
    if (roofLayoutState.selectedRail >= 0) {
      roofLayoutState.rails.splice(roofLayoutState.selectedRail, 1);
      roofLayoutState.selectedRail = Math.min(roofLayoutState.selectedRail, roofLayoutState.rails.length - 1);
      roofLayoutState.selected = -1;
      roofLayoutState.selectedPanels = [];
      safeCalculate();
      return;
    }
    if (roofLayoutState.selected < 0) return;
    roofLayoutState.panels.splice(roofLayoutState.selected, 1);
    roofLayoutState.selected = Math.min(roofLayoutState.selected, roofLayoutState.panels.length - 1);
    roofLayoutState.selectedRail = -1;
    roofLayoutState.selectedPanels = [];
    safeCalculate();
  }

  function buildRecommendations(optionData, rows, roofFactor, winter) {
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
    const stringCount = selectedStringCount(optionData.panels, roofFactor);
    const panelsPerString = stringCount > 0 ? Math.ceil(optionData.panels / stringCount) : 0;
    const items = [];

    items.push({
      level: roofFactor.factor >= 0.92 ? "ok" : roofFactor.factor >= 0.8 ? "warn" : "bad",
      title: "Кровля и ориентация",
      text: [
        ...roofFactor.active.map((slope) => {
          const panelText = slope.panelCount > 0 ? `${slope.panelCount} панелей` : `${fmt(slope.share || 100)}% панелей`;
          return `${slope.name}: ${panelText}, ${slope.orientation}, угол ${fmt(slope.tilt)}°, ${slope.connectionText}, ${slope.stringsPerMppt} стринг(а) на 1 MPPT. ${slopeStringLabel(slope)}.`;
        }),
        `Итоговая поправка к выработке: ${fmt(roofFactor.factor * 100)}%. Лучший ориентир для расчета - южный скат около 30-40°.`,
      ].join("<br>"),
    });

    if (roofFactor.manualPanelTotal > 0 && roofFactor.manualPanelTotal !== optionData.panels) {
      items.push({
        level: "warn",
        title: "Сумма панелей по скатам",
        text: `По скатам введено ${roofFactor.manualPanelTotal} панелей, а расчетная рекомендация сейчас ${optionData.panels} панелей. Для точной раскладки выровняйте количество по скатам с итогом расчета.`,
      });
    }

    items.push({
      level: winter.coverage >= 70 ? "ok" : winter.coverage >= 35 ? "warn" : "bad",
      title: "Зимний период",
      text: [
        `Декабрь-февраль дают около ${fmt(winter.pct)}% годовой выработки по региональному профилю.`,
        `Зимняя выработка: ${fmt(winter.generation)} кВт·ч за сезон, в среднем ${fmt(winter.avgMonth)} кВт·ч/мес и ${fmt(winter.avgDay, 1)} кВт·ч/день.`,
        `Зимнее потребление при текущем вводе: ${fmt(winter.consumption)} кВт·ч. Покрытие зимой: ${fmt(winter.coverage)}%.`,
      ].join("<br>"),
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
    const availableStringInputs = mpptCount * maxParallelStrings;
    const currentFormula = maxInputCurrent
      ? `floor(${fmt(maxInputCurrent, 2)} / ${fmt(imp, 2)}) = ${currentStrings}`
      : `нет лимита в базе, принято по паспорту входов = ${currentStrings}`;
    const shortCurrentFormula = maxShortCurrent
      ? `floor(${fmt(maxShortCurrent, 2)} / ${fmt(isc, 2)}) = ${shortCurrentStrings}`
      : `нет лимита в базе, принято по паспорту входов = ${shortCurrentStrings}`;

    items.push({
      level: maxPanelsPerString >= minPanelsPerString ? "ok" : "bad",
      title: "Строка панелей на MPPT",
      text: `Рекомендуемый диапазон: ${minPanelsPerString}-${maxPanelsPerString} панелей последовательно в одной строке. Расчет учитывает Vmp, Voc и запас 12% на холод.`,
    });

    items.push({
      level: "ok",
      title: "Формулы по напряжению",
      text: [
        `Мин. панелей в стринге = ceil(MPPT min / Vmp панели) = ceil(${fmt(mpptMin, 2)} / ${fmt(vmp, 2)}) = ${minPanelsPerString}.`,
        `Макс. по рабочему напряжению = floor(MPPT max / Vmp панели) = floor(${fmt(mpptMax, 2)} / ${fmt(vmp, 2)}) = ${maxByVmp}.`,
        `Макс. по холостому ходу = floor(Max PV voltage / (Voc × 1,12)) = floor(${fmt(maxPvVoltage, 2)} / (${fmt(voc, 2)} × 1,12)) = ${maxByVoc}.`,
        `Итого макс. панелей в стринге = min(${maxByVmp}, ${maxByVoc}) = ${maxPanelsPerString}.`,
      ].join("<br>"),
    });

    items.push({
      level: panelsPerString >= minPanelsPerString && panelsPerString <= maxPanelsPerString ? "ok" : "bad",
      title: "Выбранное количество стрингов",
      text: `${optionData.panels} панелей / ${stringCount} стринг(а) = примерно ${panelsPerString} панелей в стринге. Допустимый диапазон для выбранной связки: ${minPanelsPerString}-${maxPanelsPerString}.`,
    });

    items.push({
      level: maxParallelStrings > 0 ? "ok" : "bad",
      title: "Формулы по току",
      text: [
        `Параллельных строк по рабочему току = floor(Max input current / Imp) = ${currentFormula}.`,
        `Параллельных строк по току КЗ = floor(Max short current / Isc) = ${shortCurrentFormula}.`,
        `По паспорту входов MPPT: ${specStrings} строк(и) на MPPT.`,
        `Итого строк на MPPT = min(${specStrings}, ${currentStrings}, ${shortCurrentStrings}) = ${maxParallelStrings}.`,
      ].join("<br>"),
    });

    items.push({
      level: maxParallelStrings > 0 ? "ok" : "bad",
      title: "Максимум на один MPPT",
      text: `Один MPPT поддерживает ориентировочно до ${maxPanelsPerMppt} панелей: ${maxParallelStrings} параллельн. строк(и) × ${maxPanelsPerString} панелей в строке. По току: Imp ${fmt(imp, 2)} А, Isc ${fmt(isc, 2)} А.`,
    });

    const slopeTexts = roofFactor.active.map((slope) => {
      const slopePanels = panelsForSlope(optionData.panels, slope, roofFactor.totalShare);
      const panelsPerSlopeString = Math.ceil(slopePanels / slope.stringsPerMppt);
      const voltageOk = panelsPerSlopeString >= minPanelsPerString && panelsPerSlopeString <= maxPanelsPerString;
      const currentOk = slope.stringsPerMppt <= maxParallelStrings;
      const status = voltageOk && currentOk ? "OK" : "нужна правка";
      return `${slope.name}: около ${slopePanels} панелей, ${slope.stringsPerMppt} стр./MPPT, ${panelsPerSlopeString} панелей в стринге, ${slope.connectionText} - ${status}. ${slopeStringLabel(slope)}.`;
    });
    const slopesOk = roofFactor.active.every((slope) => {
      const slopePanels = panelsForSlope(optionData.panels, slope, roofFactor.totalShare);
      const panelsPerSlopeString = Math.ceil(slopePanels / slope.stringsPerMppt);
      return panelsPerSlopeString >= minPanelsPerString && panelsPerSlopeString <= maxPanelsPerString && slope.stringsPerMppt <= maxParallelStrings;
    });
    items.push({
      level: slopesOk ? "ok" : "warn",
      title: "Разбивка по скатам и MPPT",
      text: [
        ...slopeTexts,
        `Формула: если количество панелей на скате введено, берется оно; иначе панелей на скате = всего панелей × доля ската / сумма долей. Панелей в стринге = ceil(панелей на скате / стрингов на 1 MPPT).`,
      ].join("<br>"),
    });

    items.push({
      level: requiredMppts <= mpptCount && stringCount <= availableStringInputs ? "ok" : "bad",
      title: "Формулы распределения по MPPT",
      text: [
        `Макс. панелей на 1 MPPT = строк на MPPT × макс. панелей в стринге = ${maxParallelStrings} × ${maxPanelsPerString} = ${maxPanelsPerMppt}.`,
        `Нужно MPPT = ceil(кол-во панелей / макс. панелей на 1 MPPT) = ceil(${optionData.panels} / ${maxPanelsPerMppt}) = ${requiredMppts}.`,
        `Доступно входов под стринги = MPPT × строк на MPPT = ${mpptCount} × ${maxParallelStrings} = ${availableStringInputs}.`,
        `Проверка выбранных стрингов: ${stringCount} ≤ ${availableStringInputs}.`,
      ].join("<br>"),
    });

    if (stringCount > availableStringInputs) {
      items.push({
        level: "bad",
        title: "Слишком много стрингов",
        text: `Выбрано ${stringCount} стринг(а), а по входам инвертора доступно около ${availableStringInputs}: ${mpptCount} MPPT × ${maxParallelStrings} строк(и) на MPPT.`,
      });
    } else if (requiredMppts > mpptCount) {
      items.push({
        level: "bad",
        title: "Нужно больше MPPT или другой инвертор",
        text: `Для выбранных ${optionData.panels} панелей нужно около ${requiredMppts} MPPT, а у инвертора ${mpptCount}. Уменьшите число панелей или выберите инвертор с большим количеством MPPT/строк.`,
      });
    } else {
      items.push({
        level: "ok",
        title: "Выбранное количество панелей помещается",
        text: `${optionData.panels} панелей и ${stringCount} стринг(а) можно распределить по ${Math.max(1, requiredMppts)} из ${mpptCount} MPPT. Финально сверить раскладку по кровле и datasheet.`,
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

  function specValue(value, suffix = "") {
    const parsed = num(value);
    if (!String(value || "").trim()) return "нет данных";
    return parsed ? `${fmt(parsed, 2)}${suffix}` : String(value);
  }

  function buildPanelSpecs(panel) {
    const dimensions = [panel.module_length_mm, panel.module_width_mm, panel.module_depth_mm]
      .filter((value) => String(value || "").trim())
      .map((value) => fmt(num(value)))
      .join(" × ");
    return [
      ["Марка и модель", equipmentName(panel), panel.data_status || ""],
      ["Серия", panel.series || "нет данных", ""],
      ["Мощность STC", specValue(panel.power_stc_w, " Вт"), ""],
      ["Vmp STC", specValue(panel.vmp_stc_v, " В"), "Рабочее напряжение панели"],
      ["Imp STC", specValue(panel.imp_stc_a, " А"), "Рабочий ток панели"],
      ["Voc STC", specValue(panel.voc_stc_v, " В"), "Напряжение холостого хода"],
      ["Isc STC", specValue(panel.isc_stc_a, " А"), "Ток короткого замыкания"],
      ["Темп. коэф. Pmax", specValue(panel.temp_coeff_pmax_pct_c, " %/°C"), ""],
      ["Темп. коэф. Voc", specValue(panel.temp_coeff_voc_pct_c, " %/°C"), ""],
      ["Темп. коэф. Isc", specValue(panel.temp_coeff_isc_pct_c, " %/°C"), ""],
      ["Размеры", dimensions ? `${dimensions} мм` : "нет данных", "Длина × ширина × толщина"],
      ["Статус данных", panel.data_status || "нет данных", panel.notes || ""],
    ];
  }

  function buildInverterSpecs(baseInverter, effectiveInverter) {
    const sourceNote = (key) => String(baseInverter[key] || "") !== String(effectiveInverter[key] || "") ? "введено вручную" : "";
    return [
      ["Марка и модель", equipmentName(effectiveInverter), effectiveInverter.data_status || ""],
      ["Серия", effectiveInverter.series || "нет данных", ""],
      ["Тип / фазы", `${effectiveInverter.series || "нет данных"} / ${effectiveInverter.phase || "нет данных"}`, ""],
      ["Номинальная AC мощность", specValue(effectiveInverter.nominal_ac_power_w, " Вт"), ""],
      ["Макс. PV мощность", specValue(effectiveInverter.max_pv_input_power_w, " Вт"), sourceNote("max_pv_input_power_w")],
      ["Макс. PV напряжение", specValue(effectiveInverter.max_pv_voltage_v, " В"), sourceNote("max_pv_voltage_v")],
      ["Стартовое напряжение", specValue(effectiveInverter.startup_voltage_v, " В"), sourceNote("startup_voltage_v")],
      ["MPPT диапазон", `${specValue(effectiveInverter.mppt_voltage_min_v, " В")} - ${specValue(effectiveInverter.mppt_voltage_max_v, " В")}`, [sourceNote("mppt_voltage_min_v"), sourceNote("mppt_voltage_max_v")].filter(Boolean).join(", ")],
      ["MPPT, шт.", specValue(effectiveInverter.mppt_count, ""), sourceNote("mppt_count")],
      ["Строк на MPPT", effectiveInverter.strings_per_mppt || "нет данных", sourceNote("strings_per_mppt")],
      ["Max рабочий ток/MPPT", specValue(effectiveInverter.max_input_current_per_mppt_a, " А"), sourceNote("max_input_current_per_mppt_a")],
      ["Max Isc/MPPT", specValue(effectiveInverter.max_short_circuit_current_per_mppt_a, " А"), sourceNote("max_short_circuit_current_per_mppt_a")],
      ["АКБ напряжение", effectiveInverter.battery_voltage_range_v || effectiveInverter.battery_nominal_voltage_v || "нет данных", ""],
      ["Статус данных", effectiveInverter.data_status || "нет данных", effectiveInverter.notes || ""],
    ];
  }

  function renderPanelSpecs(rows) {
    els.panelSpecsTable.innerHTML = tableHtml(["Параметр", "Значение", "Примечание"], rows, []);
  }

  function renderInverterSpecs(rows) {
    els.inverterSpecsTable.innerHTML = tableHtml(["Параметр", "Значение", "Примечание"], rows, []);
  }

  function customEstimateDefaults(section) {
    if (section === "Доставка и разгрузка") {
      return { item: "Дополнительная доставка / разгрузка", unit: "компл." };
    }
    if (section === "Работа") {
      return { item: "Дополнительная работа", unit: "компл." };
    }
    return { item: "Дополнительный материал", unit: "шт." };
  }

  function addCustomEstimateRow(section) {
    const defaults = customEstimateDefaults(section);
    estimateCustomRows.push({
      id: `custom_${estimateCustomRowCounter++}`,
      section,
      item: defaults.item,
      qty: 1,
      unit: defaults.unit,
      unitPrice: 0,
      status: "добавлено вручную",
    });
    safeCalculate();
  }

  function findCustomEstimateRow(id) {
    return estimateCustomRows.find((row) => row.id === id);
  }

  function updateEstimateRowInput(target) {
    const id = target.dataset.rowId;
    const field = target.dataset.field;
    const customRow = findCustomEstimateRow(id);
    if (customRow) {
      customRow[field] = ["qty", "unitPrice"].includes(field) ? num(target.value) : target.value;
      return;
    }
    if (["qty", "unitPrice"].includes(field)) {
      estimateOverrides[id] = { ...(estimateOverrides[id] || {}), [field]: num(target.value) };
    }
  }

  function removeCustomEstimateRow(id) {
    const index = estimateCustomRows.findIndex((row) => row.id === id);
    if (index >= 0) {
      estimateCustomRows.splice(index, 1);
      safeCalculate();
    }
  }

  function buildEstimate(optionData, rows, includeTotal = true) {
    const panelsPerRow = 8;
    const reserve = 1 + num(els.mountingReserve.value, 10) / 100;
    const layoutMaterials = roofLayoutState.aggregateMaterials || roofLayoutState.materials;
    const useLayoutMaterials = layoutMaterials && (
      layoutMaterials.panels > 0
      || layoutMaterials.railPieces > 0
      || layoutMaterials.roofMounts > 0
      || layoutMaterials.railConnectors > 0
      || layoutMaterials.cableLength > 0
    );
    const materialPanelCount = useLayoutMaterials ? Math.ceil(layoutMaterials.panels || 0) : Math.ceil(optionData.panels);
    const rowCount = useLayoutMaterials
      ? (materialPanelCount > 0 ? Math.max(1, Math.ceil(layoutMaterials.rowCount || layoutMaterials.rows?.length || materialPanelCount / panelsPerRow)) : 0)
      : Math.ceil(optionData.panels / panelsPerRow);
    const layoutStatus = useLayoutMaterials ? "по чертежу кровли" : "";
    const railPieces = useLayoutMaterials ? layoutMaterials.railPieces : Math.ceil(optionData.panels * 2 * 1.15 / 4.2 * reserve);
    const railConnectors = useLayoutMaterials ? layoutMaterials.railConnectors : Math.max(0, railPieces - 1);
    const roofMounts = useLayoutMaterials ? layoutMaterials.roofMounts : Math.ceil(optionData.panels * 3 * reserve);
    const endClamps = useLayoutMaterials ? layoutMaterials.endClamps : Math.ceil(rowCount * 4);
    const middleClamps = useLayoutMaterials ? layoutMaterials.middleClamps : Math.ceil(Math.max(0, optionData.panels - rowCount) * 2 * reserve);
    const groundingClips = Math.ceil(materialPanelCount * reserve);
    const cableClips = Math.ceil(materialPanelCount * 2 * reserve);
    const mc4Sets = Math.ceil(rowCount * 4);
    const fallbackCableLength = Math.ceil(materialPanelCount * 10 * reserve);
    const cableByType = useLayoutMaterials && layoutMaterials.cableLength > 0
      ? layoutMaterials.cableByType
      : { "2x6": fallbackCableLength };
    const cableRouteM = Math.ceil(Object.values(cableByType).reduce((sum, value) => sum + num(value), 0) * 1.1);
    const batteryQty = selectedBatteryQuantity(optionData.kwp, rows.battery);
    const prices = equipmentPrices();
    const protectionSnapshots = roofLayoutState.slopes.map((slope, index) => layoutSnapshotForSlope(slope, index, rows.panel));
    const protectionRoofFactor = layoutRoofYieldFactor({ slopes: protectionSnapshots });
    const protectionStringCount = selectedStringCount(optionData.panels, protectionRoofFactor);
    const protection = pvProtection(rows.panel, protectionStringCount);
    const row = (id, section, item, qty, unit, unitPrice, status = "") => {
      const override = estimateOverrides[id] || {};
      return {
        id,
        section,
        item,
        qty: num(override.qty, qty),
        unit,
        unitPrice: num(override.unitPrice, unitPrice),
        status,
      };
    };
    const estimateRows = [
      row("panel", "Материал", equipmentName(rows.panel), materialPanelCount, "шт.", prices.panel, [rows.panel.data_status, layoutStatus].filter(Boolean).join(" / ")),
      row("inverter", "Материал", equipmentName(rows.inverter), 1, "шт.", prices.inverter, rows.inverter.data_status),
      row("battery", "Материал", equipmentName(rows.battery), batteryQty, "шт.", prices.battery, rows.battery.data_status),
      row("roof_mount_l", "Материал", `L-крепление / ${roofLabel(els.roofType.value)}`, roofMounts, "шт.", costPrice("roof_mount_l", 250), layoutStatus),
      row("mounting_profile", "Материал", `Монтажный профиль ${useLayoutMaterials ? (layoutMaterials.profileLabel || `${fmt(layoutMaterials.profileLength, 1)} м`) : "4,2 м"} для солнечных панелей`, railPieces, "шт.", costPrice("mounting_profile", 3100), layoutStatus),
      row("profile_connector", "Материал", "Стыковой соединитель профиля", railConnectors, "шт.", costPrice("profile_connector", 200), layoutStatus),
      row("end_clamp_set", "Материал", "Комплект концевых зажимов End Clamp", endClamps, "шт.", costPrice("end_clamp_set", 160), layoutStatus),
      row("inter_clamp_set", "Материал", "Комплект межпанельных зажимов Inter Clamp", middleClamps, "шт.", costPrice("inter_clamp_set", 160), layoutStatus),
      row("grounding_clip", "Материал", "Заземление / grounding clip", groundingClips, "шт.", costPrice("grounding_clip", 160), layoutStatus),
      row("cable_clip", "Материал", "Кабельные клипсы", cableClips, "шт.", costPrice("cable_clip", 50), layoutStatus),
      row("mc4_set", "Материал", "Коннектор MC4, комплект", mc4Sets, "шт.", costPrice("mc4_set", 200), layoutStatus),
      row("solar_cable_2x4", "Материал", "Кабель солнечный 2 × 4 мм²", Math.ceil(num(cableByType["2x4"])), "м", costPrice("solar_cable_2x4", 170), layoutStatus),
      row("solar_cable_2x6", "Материал", "Кабель солнечный 2 × 6 мм²", Math.ceil(num(cableByType["2x6"])), "м", costPrice("solar_cable_6mm_black", 200), layoutStatus),
      row("fuse_link_30a", "Материал", `Предохранитель плавкая вставка ${protection.fuseNominal} А`, protection.fuseQty, "шт.", costPrice("fuse_link_30a", 400), `${layoutStatus}${layoutStatus ? ", " : ""}Isc панели ${fmt(protection.isc, 1)} А`),
      row("fuse_holder", "Материал", `Держатель плавкой вставки ${protection.fuseNominal} А`, protection.holderQty, "шт.", costPrice("fuse_holder", 800)),
      row("dc_breaker", "Материал", `DC-автомат ${protection.breakerNominal} А`, protection.breakerQty, "шт.", costPrice("dc_breaker", 2500), `${protectionStringCount} стринг(а)`),
      row("dc_spd_1000v", "Материал", "УЗИП постоянного тока 1000 В", 2, "шт.", costPrice("dc_spd_1000v", 5400)),
      row("pv_dc_box", "Материал", "Щит постоянного тока для солнечных панелей", 1, "шт.", costPrice("pv_dc_box", 3500)),
      row("battery_cable_set", "Материал", "Кабель/провод для подключения АКБ и инвертора", 1, "компл.", costPrice("battery_cable_set", 12000)),
      row("phase_selector_relay", "Материал", "Реле выбора фаз 63 А", 1, "шт.", costPrice("phase_selector_relay", 8500)),
      row("delivery_unloading", "Доставка и разгрузка", "Доставка транспортной и разгрузка на объекте", 1, "компл.", costPrice("delivery_unloading", 25000)),
      row("panel_mounting_work", "Работа", "Монтаж панелей и подсистемы", materialPanelCount, "шт.", costPrice("panel_mounting_work", 4500), layoutStatus),
      row("inverter_battery_commissioning", "Работа", "Монтаж и подключение инвертора, АКБ, пусконаладка", 1, "компл.", costPrice("inverter_battery_commissioning", 30000)),
      row("pv_box_installation", "Работа", "Сборка и монтаж щита защиты PV для панелей", 1, "компл.", costPrice("pv_box_installation", 8000)),
      row("cable_route_work", "Работа", "Монтаж кабельных трасс для солнечных панелей", cableRouteM, "м", costPrice("cable_route_work", 170)),
    ];
    estimateCustomRows.forEach((customRow) => {
      estimateRows.push({
        ...customRow,
        qty: num(customRow.qty),
        unitPrice: num(customRow.unitPrice),
        custom: true,
      });
    });
    if (includeTotal) {
      estimateRows.push({ isTotal: true, section: "Итого", item: "Материалы, доставка и работа", qty: 0, unit: "", unitPrice: 0, status: "" });
    }
    return estimateRows;
  }

  function buildEconomics(optionData, rows, annualConsumption, tariffValues, selfShare, showPayback, roofFactor, winter) {
    const dayShare = num(els.dayShare.value, 65) / 100;
    const retailTariff = tariffValues.retail;
    const exportTariff = tariffValues.export;
    const dayTariff = tariffValues.day;
    const nightTariff = tariffValues.night;
    const blended = dayTariff * dayShare + nightTariff * (1 - dayShare);
    const stringCount = selectedStringCount(optionData.panels, roofFactor);
    const panelsPerString = stringCount > 0 ? Math.ceil(optionData.panels / stringCount) : 0;
    const rowsOut = [
      ["Регион", regionLabel(rows.region.region), ""],
      ["Кровля", `${roofFactor.label}. Поправка ${fmt(roofFactor.factor * 100)} %`, "средневзвешенно по долям панелей на скатах"],
      ["Стринги", `${stringCount} шт., примерно ${panelsPerString} панелей в стринге`, "сумма стрингов по активным скатам"],
      ["Потребление", `${fmt(annualConsumption)} кВт·ч/год`, ""],
      ["Выработка СЭС", `${fmt(optionData.annual)} кВт·ч/год`, ""],
      ["Зимняя выработка", `${fmt(winter.generation)} кВт·ч за дек-фев`, `${fmt(winter.avgMonth)} кВт·ч/мес, ${fmt(winter.avgDay, 1)} кВт·ч/день`],
      ["Зимнее покрытие", `${fmt(winter.coverage)} %`, `потребление дек-фев: ${fmt(winter.consumption)} кВт·ч`],
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
    const groups = ["Материал", "Доставка и разгрузка", "Работа"];
    const head = `<thead><tr>
      <th class="num">№</th>
      <th>Позиция</th>
      <th class="num">Количество</th>
      <th>Ед.</th>
      <th class="num">Цена</th>
      <th class="num">Сумма</th>
      <th>Примечание</th>
    </tr></thead>`;
    const body = groups.map((group) => {
      const groupRows = rows.filter((row) => row.section === group && !row.isTotal);
      const subtotal = groupRows.reduce((sum, row) => sum + row.qty * row.unitPrice, 0);
      const lineRows = groupRows.map((row, index) => `<tr>
        <td class="num">${index + 1}</td>
        <td>${row.custom
          ? `<input class="estimateTextInput" data-row-id="${escapeHtml(row.id)}" data-field="item" type="text" value="${escapeHtml(row.item)}">`
          : escapeHtml(row.item)}</td>
        <td class="num"><input class="estimateInput qty" data-row-id="${escapeHtml(row.id)}" data-field="qty" type="number" min="0" step="1" value="${row.qty}"></td>
        <td>${row.custom
          ? `<input class="estimateTextInput unit" data-row-id="${escapeHtml(row.id)}" data-field="unit" type="text" value="${escapeHtml(row.unit)}">`
          : escapeHtml(row.unit)}</td>
        <td class="num"><input class="estimateInput price" data-row-id="${escapeHtml(row.id)}" data-field="unitPrice" type="number" min="0" step="1" value="${row.unitPrice}"></td>
        <td class="num">${money(row.qty * row.unitPrice)}</td>
        <td>${escapeHtml(row.status)}${row.custom ? ` <button class="estimateRemoveRow" type="button" data-row-id="${escapeHtml(row.id)}">Удалить</button>` : ""}</td>
      </tr>`).join("");
      return `<tr class="sectionRow"><td colspan="7">${group}</td></tr>
        ${lineRows}
        <tr class="estimateAddRow"><td colspan="7"><button class="estimateAddButton" type="button" data-section="${escapeHtml(group)}">+ строка</button></td></tr>
        <tr class="subtotalRow"><td colspan="5">Итого: ${group}</td><td class="num">${money(subtotal)}</td><td></td></tr>`;
    }).join("");
    const total = estimateTotal(rows);
    els.estimateTable.innerHTML = `${head}<tbody>${body}<tr class="totalRow"><td colspan="5">Итого по смете</td><td class="num">${money(total)}</td><td></td></tr></tbody>`;
  }

  function renderEconomics(rows) {
    els.economicsTable.innerHTML = tableHtml(["Показатель", "Значение", "Источник/примечание"], rows, []);
  }

  function tableHtml(headers, rows, numericIndexes) {
    const head = `<thead><tr>${headers.map((h, i) => `<th class="${numericIndexes.includes(i) ? "num" : ""}">${h}</th>`).join("")}</tr></thead>`;
    const body = rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${numericIndexes.includes(i) ? "num" : ""}">${cell ?? ""}</td>`).join("")}</tr>`).join("");
    return `${head}<tbody>${body}</tbody>`;
  }

  function tableForReport(table) {
    const clone = table.cloneNode(true);
    clone.querySelectorAll(".estimateAddRow").forEach((row) => row.remove());
    if (table === els.estimateTable) {
      clone.querySelectorAll("tr").forEach((row) => {
        row.lastElementChild?.remove();
      });
      clone.querySelectorAll("[colspan]").forEach((cell) => {
        const span = num(cell.getAttribute("colspan"), 1);
        if (span > 1) cell.setAttribute("colspan", String(Math.max(1, span - 1)));
      });
    }
    clone.querySelectorAll("input").forEach((input) => {
      input.replaceWith(document.createTextNode(input.value));
    });
    clone.querySelectorAll("button").forEach((button) => button.remove());
    return clone.outerHTML;
  }

  function roofLayoutReportSections() {
    const rows = selectedRows();
    saveActiveLayoutSlope();
    const activeIndex = roofLayoutState.activeSlope;
    const sections = roofLayoutState.slopes.map((slope, index) => {
      loadLayoutSlope(index);
      drawRoofLayout(rows.panel);
      saveActiveLayoutSlope();
      const image = els.roofLayoutCanvas.toDataURL("image/png");
      const metrics = els.roofLayoutMetrics.innerHTML;
      const title = escapeHtml(slope.name || `Скат ${index + 1}`);
      return `<div class="reportRoofSlope">
  <h3>${title}</h3>
  <img class="reportChart reportRoofImage" src="${image}" alt="${title}">
  <div class="reportMetrics">${metrics}</div>
</div>`;
    }).join("");
    loadLayoutSlope(activeIndex);
    drawRoofLayout(rows.panel);
    renderLayoutSlopeTabs();
    return sections;
  }

  function reportAppendixMarkup() {
    return `<section class="reportAppendix">
  <h2>Памятка по подбору MPPT, стрингов и АКБ</h2>
  <h3>MPPT и параллельные стринги</h3>
  <ul>
    <li><strong>MPPT 1+1</strong> обычно означает один MPPT-контроллер и два входа для параллельных стрингов.</li>
    <li>Два стринга на одном MPPT должны быть одинаковыми: одна модель панели, одинаковое количество панелей, один угол и одна ориентация.</li>
    <li>Юг + запад, восток + запад или разные углы на одном MPPT 1+1 подключать нельзя: такие скаты нужно разводить на разные MPPT.</li>
    <li><strong>2 MPPT</strong> означает два независимых трекера. На них можно посадить разные скаты, если каждый стринг попадает в диапазон напряжения и тока инвертора.</li>
    <li>Проверка стринга: Voc зимой ниже максимального PV-напряжения инвертора, Vmp в рабочем диапазоне MPPT, ток стринга не выше допустимого входного тока.</li>
  </ul>
  <h3>Как считать LiFePO4 АКБ</h3>
  <ul>
    <li>Энергия АКБ: напряжение × емкость / 1000. Например, 48 В × 100 А·ч = 4,8 кВт·ч.</li>
    <li>Полезная энергия с учетом глубины разряда 80-90%: 4,8 × 0,8...0,9 = примерно 3,8-4,3 кВт·ч.</li>
    <li>Время работы: полезная энергия / нагрузка. При нагрузке 400 Вт: 3,8-4,3 кВт·ч / 0,4 кВт = примерно 9,5-10,8 часа.</li>
    <li>Эконом-режим 300-500 Вт обычно включает холодильник, сетевое оборудование, автоматику котла, освещение и малую бытовую нагрузку.</li>
    <li>Для резерва дома лучше считать не только емкость АКБ, но и пиковую мощность инвертора, пусковые токи насосов/холодильника и минимальный остаток заряда.</li>
  </ul>
  <h3>Практические рекомендации клиенту</h3>
  <ul>
    <li>Для резервного питания сначала составить список критичных нагрузок и их мощность в ваттах.</li>
    <li>Для автономии на ночь считать потребление в кВт·ч, а не только мощность инвертора.</li>
    <li>Для солнечной части обязательно сверять выбранную схему с паспортом инвертора и фактической ориентацией скатов.</li>
  </ul>
  <h3>Часто задаваемые вопросы</h3>
  <div class="reportFaq">
    <p><strong>Стабилизирует ли гибридный инвертор входное напряжение от электросети?</strong></p>
    <p>Обычно нет. Большинство гибридных инверторов не заменяют стабилизатор напряжения. Если в сети часто просадки или повышенное напряжение, перед инвертором нужно ставить отдельный стабилизатор подходящей мощности.</p>
    <p>Исключения бывают у инверторов с онлайн-преобразованием: они работают по другому принципу и могут стабилизировать напряжение. Для таких моделей отдельный стабилизатор перед инвертором обычно не требуется, но это нужно подтверждать по паспорту конкретного оборудования.</p>
    <p><strong>Можно ли подключить генератор к инвертору при пропадании электросети, чтобы заряжать АКБ?</strong></p>
    <p>Да, можно, если инвертор поддерживает вход генератора или заряд АКБ от внешнего AC-источника. Генератор лучше выбирать инверторный: у него стабильнее частота и напряжение, поэтому инвертору проще принять питание.</p>
    <p>Для однофазных гибридных инверторов обычно подходит однофазный генератор. Для трехфазных гибридных инверторов нужен трехфазный генератор и правильная схема подключения по требованиям производителя.</p>
  </div>
</section>`;
  }

  function reportMarkup() {
    const chartImage = els.chart.toDataURL("image/png");
    const roofLayoutSections = roofLayoutReportSections();
    const now = new Date().toLocaleString("ru-RU");
    const estimateReportTable = tableForReport(els.estimateTable);
    return `<div class="reportSheet">
  <h1>Line-Energy Solar Designer</h1>
  <div class="reportMeta">Отчет сформирован: ${now}</div>
  <div class="reportMetrics">
    <div class="reportMetric"><span>Рекомендуемая мощность</span><strong>${els.systemSize.textContent}</strong></div>
    <div class="reportMetric"><span>Панелей</span><strong>${els.panelCount.textContent}</strong></div>
    <div class="reportMetric"><span>Стрингов</span><strong>${els.stringCountMetric.textContent}</strong></div>
    <div class="reportMetric"><span>Годовая выработка</span><strong>${els.annualGeneration.textContent}</strong></div>
    <div class="reportMetric"><span>Зима дек-фев</span><strong>${els.winterGeneration.textContent}</strong></div>
    <div class="reportMetric"><span>Зимнее покрытие</span><strong>${els.winterCoverage.textContent}</strong></div>
    <div class="reportMetric"><span>Поправка кровли</span><strong>${els.roofFactor.textContent}</strong></div>
  </div>
  <div>${els.statusNote.textContent}</div>
  <h2>Рекомендации по совместимости</h2>
  <div class="reportRecommendations">${els.recommendationsList.innerHTML}</div>
  <h2>Технические данные панели</h2>
  ${els.panelSpecsTable.outerHTML}
  <h2>Технические данные инвертора</h2>
  ${els.inverterSpecsTable.outerHTML}
  <h2>График выработки</h2>
  <img class="reportChart" src="${chartImage}" alt="График выработки">
  <h2>Чертёж кровли и раскладка панелей</h2>
  ${roofLayoutSections}
  <h2>Смета материалов и работ</h2>
  ${estimateReportTable}
  <h2>Экономика и тарифы</h2>
  ${els.economicsTable.outerHTML}
  ${reportAppendixMarkup()}
  <div class="reportNote">Черновой расчет. Перед коммерческим предложением сверить datasheet, объект, тарифы и нормы.</div>
</div>`;
  }

  function exportReport() {
    safeCalculate();
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
    els.region.addEventListener("change", () => {
      setTariffInputsFromRegion();
      safeCalculate();
    });
    els.panel.addEventListener("change", () => {
      invalidateRoofLayoutMaterials();
      safeCalculate();
    });
    els.inverter.addEventListener("change", () => {
      safeCalculate();
    });
    els.battery.addEventListener("change", () => {
      safeCalculate();
    });
    [els.inverterBrand, els.inverterType, els.inverterPhase].forEach((node) => {
      node.addEventListener("change", () => {
        fillInverterModels();
        safeCalculate();
      });
    });
    [...document.querySelectorAll("select,input")].forEach((node) => {
      node.addEventListener("input", safeCalculate);
      node.addEventListener("change", safeCalculate);
    });
    els.estimateTable.addEventListener("click", (event) => {
      const target = event.target;
      if (target.classList.contains("estimateAddButton")) {
        addCustomEstimateRow(target.dataset.section);
      }
      if (target.classList.contains("estimateRemoveRow")) {
        removeCustomEstimateRow(target.dataset.rowId);
      }
    });
    els.estimateTable.addEventListener("input", (event) => {
      const target = event.target;
      if (!target.classList.contains("estimateInput") && !target.classList.contains("estimateTextInput")) return;
      updateEstimateRowInput(target);
      if (target.classList.contains("estimateTextInput")) return;
      window.clearTimeout(estimateInputTimer);
      estimateInputTimer = window.setTimeout(safeCalculate, 250);
    });
    els.estimateTable.addEventListener("change", (event) => {
      const target = event.target;
      if (!target.classList.contains("estimateInput") && !target.classList.contains("estimateTextInput")) return;
      updateEstimateRowInput(target);
      if (target.classList.contains("estimateTextInput")) return;
      window.clearTimeout(estimateInputTimer);
      safeCalculate();
    });
    byId("calculateBtn").addEventListener("click", safeCalculate);
    byId("calculateInputsBtn").addEventListener("click", safeCalculate);
    els.layoutSlopeTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-slope-index]");
      if (!button) return;
      switchLayoutSlope(num(button.dataset.slopeIndex, 0));
    });
    els.layoutAddSlopeBtn.addEventListener("click", addLayoutSlope);
    els.layoutAutoBtn.addEventListener("click", () => {
      roofLayoutState.manual = false;
      roofLayoutState.selected = -1;
      roofLayoutState.selectedPanels = [];
      roofLayoutState.selectedRail = -1;
      roofLayoutState.rails = [];
      roofLayoutState.drag = null;
      safeCalculate();
    });
    els.layoutManualBtn.addEventListener("click", () => {
      enableManualLayoutFromCurrent();
      safeCalculate();
    });
    els.layoutAddPanelBtn.addEventListener("click", addLayoutPanel);
    els.layoutAddRailBtn.addEventListener("click", addLayoutRail);
    els.layoutMakeStringBtn.addEventListener("click", makeSelectedPanelsString);
    els.layoutClearStringBtn.addEventListener("click", clearSelectedPanelsString);
    els.layoutAlignPanelsBtn.addEventListener("click", alignLayoutPanels);
    els.layoutRotatePanelBtn.addEventListener("click", rotateSelectedLayoutPanel);
    els.layoutDeletePanelBtn.addEventListener("click", deleteSelectedLayoutPanel);
    els.layoutClearBtn.addEventListener("click", clearRoofLayoutSheet);
    els.dimensionEditor.addEventListener("pointerdown", (event) => event.stopPropagation());
    els.dimensionEditorInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") closeDimensionEditor(true);
      if (event.key === "Escape") closeDimensionEditor(false);
    });
    els.dimensionEditorInput.addEventListener("blur", () => closeDimensionEditor(true));
    els.roofLayoutCanvas.addEventListener("pointerdown", (event) => {
      if (!els.dimensionEditor.hidden) closeDimensionEditor(true);
      const dimensionHandle = findDimensionHandle(event);
      if (dimensionHandle) {
        editRoofDimension(dimensionHandle);
        return;
      }
      enableManualLayoutFromCurrent();
      const point = canvasToRoofPoint(event);
      const roofHandle = findRoofHandle(point);
      if (roofHandle) {
        const layout = roofLayoutState.draw.layout;
        roofLayoutState.selected = -1;
        roofLayoutState.selectedPanels = [];
        roofLayoutState.selectedRail = -1;
        roofLayoutState.drag = {
          type: "roof",
          handle: roofHandle.id,
          shape: layout.shape,
          startX: point.x,
          startY: point.y,
          startBottomWidth: layout.bottomW,
          startTopWidth: layout.topW,
          startTopOffset: layout.topOffset,
          startHeight: layout.roofH,
        };
        els.roofLayoutCanvas.setPointerCapture(event.pointerId);
        return;
      }
      const railIndex = findLayoutRail(point);
      const panelIndex = railIndex >= 0 ? -1 : findLayoutPanel(point);
      const clickedStringId = panelIndex >= 0 ? Math.floor(num(roofLayoutState.panels[panelIndex]?.stringId, 0)) : 0;
      roofLayoutState.selectedRail = railIndex;
      roofLayoutState.selected = event.ctrlKey && panelIndex >= 0 ? -1 : panelIndex;
      if (event.ctrlKey && panelIndex >= 0) {
        const alreadySelected = roofLayoutState.selectedPanels.includes(panelIndex);
        if (!alreadySelected) {
          roofLayoutState.selectedPanels = [...roofLayoutState.selectedPanels, panelIndex].sort((a, b) => a - b);
        } else if (roofLayoutState.selectedPanels.length === 1) {
          roofLayoutState.selectedPanels = [];
        }
      } else if (panelIndex >= 0) {
        roofLayoutState.selectedPanels = [];
      }
      if (railIndex >= 0) {
        roofLayoutState.selectedPanels = [];
        const group = connectedRailIndices(railIndex, roofLayoutState.rails);
        roofLayoutState.drag = {
          type: "rail",
          index: railIndex,
          group,
          startX: point.x,
          startY: point.y,
          rails: group.map((index) => ({ ...roofLayoutState.rails[index] })),
        };
        els.roofLayoutCanvas.setPointerCapture(event.pointerId);
      } else if (event.ctrlKey && panelIndex >= 0) {
        const group = roofLayoutState.selectedPanels.length ? roofLayoutState.selectedPanels : [panelIndex];
        roofLayoutState.drag = {
          type: "panels",
          group,
          startX: point.x,
          startY: point.y,
          panels: roofLayoutState.panels.map((panel) => ({ ...panel })),
        };
        els.roofLayoutCanvas.setPointerCapture(event.pointerId);
      } else if (panelIndex >= 0 && clickedStringId > 0) {
        const group = stringPanelIndices(clickedStringId);
        roofLayoutState.selected = -1;
        roofLayoutState.selectedPanels = group;
        roofLayoutState.drag = {
          type: "panels",
          group,
          startX: point.x,
          startY: point.y,
          panels: roofLayoutState.panels.map((panel) => ({ ...panel })),
        };
        els.roofLayoutCanvas.setPointerCapture(event.pointerId);
      } else if (panelIndex >= 0 && roofLayoutState.selectedPanels.length > 1 && roofLayoutState.selectedPanels.includes(panelIndex)) {
        roofLayoutState.selected = -1;
        roofLayoutState.drag = {
          type: "panels",
          group: roofLayoutState.selectedPanels.slice(),
          startX: point.x,
          startY: point.y,
          panels: roofLayoutState.panels.map((panel) => ({ ...panel })),
        };
        els.roofLayoutCanvas.setPointerCapture(event.pointerId);
      } else if (panelIndex >= 0) {
        roofLayoutState.selectedPanels = [];
        const item = roofLayoutState.panels[panelIndex];
        roofLayoutState.drag = { type: "panel", index: panelIndex, dx: point.x - item.x, dy: point.y - item.y };
        els.roofLayoutCanvas.setPointerCapture(event.pointerId);
      }
      safeCalculate();
    });
    els.roofLayoutCanvas.addEventListener("pointermove", (event) => {
      if (!roofLayoutState.drag) return;
      const point = canvasToRoofPoint(event);
      const draw = roofLayoutState.draw;
      if (!point || !draw) return;
      if (roofLayoutState.drag.type === "roof") {
        updateRoofFromHandleDrag(point);
      } else if (roofLayoutState.drag.type === "rail") {
        const deltaX = point.x - roofLayoutState.drag.startX;
        const deltaY = point.y - roofLayoutState.drag.startY;
        const movedRails = roofLayoutState.drag.rails.map((rail) => clampLayoutRail({
          ...rail,
          minX: rail.minX + deltaX,
          maxX: rail.maxX + deltaX,
          y: rail.y + deltaY,
        }, draw.layout));
        const snappedRails = snapRailGroup(movedRails, roofLayoutState.drag.group, roofLayoutState.rails, draw.layout);
        roofLayoutState.drag.group.forEach((railIndex, offset) => {
          roofLayoutState.rails[railIndex] = snappedRails[offset];
        });
      } else if (roofLayoutState.drag.type === "panels") {
        const deltaX = point.x - roofLayoutState.drag.startX;
        const deltaY = point.y - roofLayoutState.drag.startY;
        const selected = new Set(roofLayoutState.drag.group);
        const movedPanels = roofLayoutState.drag.panels.map((panel, index) => normalizeLayoutPanel({
          ...panel,
          x: selected.has(index) ? panel.x + deltaX : panel.x,
          y: selected.has(index) ? panel.y + deltaY : panel.y,
        }, draw.layout));
        if (validPanelGroup(movedPanels, draw.layout)) {
          roofLayoutState.panels = movedPanels;
        }
      } else {
        const item = roofLayoutState.panels[roofLayoutState.drag.index];
        roofLayoutState.panels[roofLayoutState.drag.index] = clampLayoutPanel({
          ...item,
          x: point.x - roofLayoutState.drag.dx,
          y: point.y - roofLayoutState.drag.dy,
        }, draw.layout);
      }
      drawRoofLayout(selectedRows().panel);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      els.roofLayoutCanvas.addEventListener(eventName, () => {
        if (!roofLayoutState.drag) return;
        roofLayoutState.drag = null;
        safeCalculate();
      });
    });
    window.addEventListener("keydown", (event) => {
      if (!event.ctrlKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      const active = document.activeElement;
      if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) return;
      if (!roofLayoutState.manual || !roofLayoutState.panels.length) return;
      if (!roofLayoutState.selectedPanels.length) return;
      const draw = roofLayoutState.draw || { layout: buildRoofLayout(selectedRows().panel) };
      const step = event.shiftKey ? 0.1 : 0.05;
      const deltaX = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const deltaY = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if (movePanelGroup(deltaX, deltaY, draw.layout)) {
        event.preventDefault();
        safeCalculate();
      }
    });
    els.applyLayoutToSlopeBtn.addEventListener("click", () => {
      const rows = selectedRows();
      drawRoofLayout(rows.panel);
      saveActiveLayoutSlope();
      syncPrimaryRoofInputs(summarizeRoofLayoutSlopes(rows.panel));
      safeCalculate();
    });
    byId("printBtn").addEventListener("click", exportReport);
    byId("resetBtn").addEventListener("click", () => {
      Object.keys(estimateOverrides).forEach((key) => delete estimateOverrides[key]);
      estimateCustomRows.splice(0, estimateCustomRows.length);
      estimateCustomRowCounter = 1;
      roofLayoutState.manual = false;
      roofLayoutState.panels = [];
      roofLayoutState.rails = [];
      roofLayoutState.selected = -1;
      roofLayoutState.selectedPanels = [];
      roofLayoutState.selectedRail = -1;
      roofLayoutState.drag = null;
      roofLayoutState.draw = null;
      roofLayoutState.materials = null;
      roofLayoutState.aggregateMaterials = null;
      els.monthlyConsumption.value = 1000;
      els.targetCoverage.value = 70;
      els.roofMainTilt.value = 35;
      els.roofSlopeCount.value = 1;
      els.roof1PanelCount.value = 0;
      els.roof1Share.value = 100;
      els.roof1Tilt.value = 35;
      els.roof1StringsPerMppt.value = 1;
      els.roof2PanelCount.value = 0;
      els.roof2Share.value = 0;
      els.roof2Tilt.value = 35;
      els.roof2StringsPerMppt.value = 1;
      els.roof3PanelCount.value = 0;
      els.roof3Share.value = 0;
      els.roof3Tilt.value = 35;
      els.roof3StringsPerMppt.value = 1;
      els.roof4PanelCount.value = 0;
      els.roof4Share.value = 0;
      els.roof4Tilt.value = 35;
      els.roof4StringsPerMppt.value = 1;
      els.manualMaxPvVoltage.value = "";
      els.manualMpptMin.value = "";
      els.manualMpptMax.value = "";
      els.manualMpptCount.value = "";
      els.manualStringsPerMppt.value = "";
      els.manualMaxInputCurrent.value = "";
      els.manualMaxShortCurrent.value = "";
      els.manualMaxPvPower.value = "";
      els.manualStartupVoltage.value = "";
      els.batteryQty.value = "";
      els.selfShare.value = 70;
      els.dayShare.value = 65;
      els.mountingReserve.value = 10;
      els.layoutRoofShape.value = "rectangle";
      els.layoutRoofWidth.value = 10;
      els.layoutRoofTopWidth.value = 6;
      els.layoutRoofTopOffset.value = 2;
      els.layoutRoofHeight.value = 6;
      els.layoutPanelOrientation.value = "portrait";
      els.layoutSlopeTilt.value = 35;
      els.layoutSlopeAzimuth.value = "south";
      els.layoutSetback.value = 0.3;
      els.layoutGap.value = 0.03;
      els.layoutPanelOverhang.value = 0.2;
      els.layoutMaxPanels.value = "";
      els.layoutProfileLength.value = 3.5;
      els.layoutCableType.value = "2x6";
      els.layoutCableLength.value = 0;
      fillSelects();
      resetLayoutSlopes();
      safeCalculate();
    });
  }

  fillSelects();
  resetLayoutSlopes();
  updateRoofMainTiltLabel();
  updateRoofSlopeVisibility();
  bind();
  safeCalculate();
})();
