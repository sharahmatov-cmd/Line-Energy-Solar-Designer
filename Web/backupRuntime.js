(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LINE_ENERGY_BACKUP_RUNTIME = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const defaultScenarios = {
    normal: {
      key: "normal",
      enabled: true,
      title: "Обычный режим дома",
      description: "Дом с газовым отоплением: котёл, насосы, два холодильника, связь, освещение и обычные бытовые нагрузки.",
      dailyConsumptionMinKwh: 14,
      dailyConsumptionMaxKwh: 16,
    },
    base: {
      key: "base",
      enabled: true,
      title: "Базовый резервный режим",
      description: "Расчёт по средней резервной нагрузке, указанной в проекте.",
      averageLoadW: 400,
    },
    economy: {
      key: "economy",
      enabled: true,
      title: "Экономичный режим",
      description: "Котёл, насосы, холодильники, роутер, связь и необходимое освещение без мощных приборов.",
      dailyConsumptionKwh: 8,
    },
  };

  const defaultBatteryComparisonPresets = [
    { key: "48v100", enabled: true, title: "48 В 100 А·ч", voltageV: 48, capacityAh: 100, quantity: 1 },
    { key: "48v200", enabled: true, title: "48 В 200 А·ч", voltageV: 48, capacityAh: 200, quantity: 1 },
    { key: "48v300", enabled: false, title: "48 В 300 А·ч", voltageV: 48, capacityAh: 300, quantity: 1 },
    { key: "51v100", enabled: false, title: "51,2 В 100 А·ч", voltageV: 51.2, capacityAh: 100, quantity: 1 },
    { key: "51v200", enabled: false, title: "51,2 В 200 А·ч", voltageV: 51.2, capacityAh: 200, quantity: 1 },
    { key: "51v314", enabled: false, title: "51,2 В 314 А·ч", voltageV: 51.2, capacityAh: 314, quantity: 1 },
  ];

  function number(value, fallback = 0) {
    const parsed = Number(String(value ?? "").replace(",", ".").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(number(value) * factor) / factor;
  }

  function formatNumber(value, digits = 1) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(number(value)).replaceAll("\u00a0", " ").replaceAll("\u202f", " ");
  }

  function suffixHours(hours) {
    const value = Math.round(number(hours));
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return "час";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "часа";
    return "часов";
  }

  function dayHint(hours) {
    const value = number(hours);
    if (value >= 42 && value < 52) return "почти 2 суток";
    if (value >= 34 && value < 42) return "около 1,5 суток";
    if (value >= 22 && value < 34) return "около 1 суток";
    if (value >= 52) return `около ${formatNumber(value / 24, 1)} суток`;
    return "";
  }

  function formatRuntimeHours(hours) {
    const value = number(hours);
    if (value <= 0) return "не рассчитано";
    const rounded = round(value, value >= 10 ? 0 : 1);
    const hint = dayHint(value);
    return `${formatNumber(rounded, rounded >= 10 ? 0 : 1)} ${suffixHours(rounded)}${hint ? ` (${hint})` : ""}`;
  }

  function formatRuntimeRange(minHours, maxHours) {
    const minValue = number(minHours);
    const maxValue = number(maxHours);
    if (minValue <= 0 || maxValue <= 0) return "не рассчитано";
    const low = Math.min(minValue, maxValue);
    const high = Math.max(minValue, maxValue);
    const lowRounded = Math.round(low);
    const highRounded = Math.round(high);
    const text = lowRounded === highRounded
      ? `${formatNumber(highRounded, 0)} ${suffixHours(highRounded)}`
      : `${formatNumber(lowRounded, 0)}-${formatNumber(highRounded, 0)} часов`;
    const hint = dayHint(high);
    return hint ? `${text} (${hint})` : text;
  }

  function normalizeScenarios(input = {}) {
    const normal = { ...defaultScenarios.normal, ...(input.normal || {}) };
    const base = { ...defaultScenarios.base, ...(input.base || {}) };
    const economy = { ...defaultScenarios.economy, ...(input.economy || {}) };
    normal.dailyConsumptionMinKwh = Math.max(0.1, number(normal.dailyConsumptionMinKwh, 14));
    normal.dailyConsumptionMaxKwh = Math.max(normal.dailyConsumptionMinKwh, number(normal.dailyConsumptionMaxKwh, 16));
    base.averageLoadW = Math.max(1, number(base.averageLoadW, 400));
    economy.dailyConsumptionKwh = Math.max(0.1, number(economy.dailyConsumptionKwh, 8));
    return { normal, base, economy };
  }

  function calculateScenarioRuntime(usableEnergyKwh, scenario) {
    const usable = Math.max(0, number(usableEnergyKwh));
    if (!scenario?.enabled || usable <= 0) {
      return { ...scenario, runtimeHours: 0, runtimeMinHours: 0, runtimeMaxHours: 0, runtimeText: "не рассчитано" };
    }
    if (scenario.key === "normal") {
      const minDaily = Math.max(0.1, number(scenario.dailyConsumptionMinKwh, 14));
      const maxDaily = Math.max(minDaily, number(scenario.dailyConsumptionMaxKwh, 16));
      const runtimeMinHours = usable / (maxDaily / 24);
      const runtimeMaxHours = usable / (minDaily / 24);
      return {
        ...scenario,
        averageLoadMinW: maxDaily / 24 * 1000,
        averageLoadMaxW: minDaily / 24 * 1000,
        dailyText: `${formatNumber(minDaily, 0)}-${formatNumber(maxDaily, 0)} кВт·ч/сутки`,
        averageLoadText: `${formatNumber(maxDaily / 24 * 1000, 0)}-${formatNumber(minDaily / 24 * 1000, 0)} Вт`,
        runtimeMinHours,
        runtimeMaxHours,
        runtimeHours: (runtimeMinHours + runtimeMaxHours) / 2,
        runtimeText: formatRuntimeRange(runtimeMinHours, runtimeMaxHours),
      };
    }
    if (scenario.key === "base") {
      const loadW = Math.max(1, number(scenario.averageLoadW, 400));
      const daily = loadW / 1000 * 24;
      const runtimeHours = usable / (loadW / 1000);
      return {
        ...scenario,
        dailyConsumptionKwh: daily,
        dailyText: `${formatNumber(daily, 1)} кВт·ч/сутки`,
        averageLoadText: `${formatNumber(loadW, 0)} Вт`,
        runtimeMinHours: runtimeHours,
        runtimeMaxHours: runtimeHours,
        runtimeHours,
        runtimeText: formatRuntimeHours(runtimeHours),
      };
    }
    const daily = Math.max(0.1, number(scenario.dailyConsumptionKwh, 8));
    const runtimeHours = usable / (daily / 24);
    return {
      ...scenario,
      dailyText: `${formatNumber(daily, 1)} кВт·ч/сутки`,
      averageLoadText: `${formatNumber(daily / 24 * 1000, 0)} Вт`,
      runtimeMinHours: runtimeHours,
      runtimeMaxHours: runtimeHours,
      runtimeHours,
      runtimeText: formatRuntimeHours(runtimeHours),
    };
  }

  function nominalEnergyKwh(config) {
    return Math.max(0, number(config?.voltageV) * number(config?.capacityAh) * Math.max(1, number(config?.quantity, 1)) / 1000);
  }

  function usableEnergyKwhFromPreset(nominalEnergy, settings = {}) {
    const dod = clamp(number(settings.depthOfDischargePercent, 90), 1, 100) / 100;
    const efficiency = clamp(number(settings.inverterEfficiencyPercent, 92), 1, 100) / 100;
    const reserve = clamp(number(settings.operationalReservePercent, 95), 1, 100) / 100;
    return Math.max(0, number(nominalEnergy) * dod * efficiency * reserve);
  }

  function calculateBackupRuntime(input = {}) {
    const scenarios = normalizeScenarios(input.scenarios);
    const nominalEnergy = Math.max(0, number(input.nominalEnergyKwh));
    const usableEnergy = Math.max(0, number(input.usableEnergyKwh));
    const scenarioList = [
      calculateScenarioRuntime(usableEnergy, scenarios.normal),
      calculateScenarioRuntime(usableEnergy, scenarios.base),
      calculateScenarioRuntime(usableEnergy, scenarios.economy),
    ].filter((item) => item.enabled);
    const scenarioMap = Object.fromEntries(scenarioList.map((item) => [item.key, item]));
    return {
      nominalEnergyKwh: nominalEnergy,
      usableEnergyKwh: usableEnergy,
      minSocReservePercent: number(input.minSocReservePercent, 100 - 85),
      conversionEfficiencyPercent: number(input.conversionEfficiencyPercent, 100),
      scenarios: scenarioList,
      scenarioMap,
    };
  }

  function sameEnergy(a, b) {
    return Math.abs(number(a) - number(b)) < 0.05;
  }

  function calculateRuntimeColumns(usableEnergy, scenarios) {
    const runtime = calculateBackupRuntime({ nominalEnergyKwh: usableEnergy, usableEnergyKwh: usableEnergy, scenarios });
    return {
      normal: runtime.scenarioMap.normal?.runtimeText || "не рассчитано",
      base: runtime.scenarioMap.base?.runtimeText || "не рассчитано",
      economy: runtime.scenarioMap.economy?.runtimeText || "не рассчитано",
    };
  }

  function buildBatteryComparison(input = {}) {
    const settings = input.settings || {};
    const scenarios = normalizeScenarios(input.scenarios);
    const presets = (input.presets || defaultBatteryComparisonPresets).filter((item) => item.enabled !== false);
    const rows = presets.map((preset) => {
      const nominal = nominalEnergyKwh(preset);
      const usable = usableEnergyKwhFromPreset(nominal, settings);
      return {
        key: preset.key,
        title: preset.title,
        nominalEnergyKwh: nominal,
        usableEnergyKwh: usable,
        isSelected: false,
        ...calculateRuntimeColumns(usable, scenarios),
      };
    });
    const selectedNominal = number(input.selectedNominalEnergyKwh);
    const selectedUsable = number(input.selectedUsableEnergyKwh);
    if (selectedNominal > 0 && !rows.some((row) => sameEnergy(row.nominalEnergyKwh, selectedNominal))) {
      rows.push({
        key: "selected",
        title: input.selectedTitle || "Выбранная АКБ проекта",
        nominalEnergyKwh: selectedNominal,
        usableEnergyKwh: selectedUsable,
        isSelected: true,
        ...calculateRuntimeColumns(selectedUsable, scenarios),
      });
    } else {
      rows.forEach((row) => {
        if (sameEnergy(row.nominalEnergyKwh, selectedNominal)) row.isSelected = true;
      });
    }
    return rows;
  }

  return {
    defaultScenarios,
    defaultBatteryComparisonPresets,
    normalizeScenarios,
    calculateScenarioRuntime,
    calculateBackupRuntime,
    nominalEnergyKwh,
    usableEnergyKwhFromPreset,
    buildBatteryComparison,
    formatRuntimeHours,
    formatRuntimeRange,
    formatNumber,
  };
});
