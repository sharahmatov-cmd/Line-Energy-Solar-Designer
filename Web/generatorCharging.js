(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LINE_ENERGY_GENERATOR_CHARGING = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const standardGeneratorSizesKw = [3, 3.5, 4, 5, 6, 7, 8, 10, 12, 15];

  function toNumber(value, fallback = 0) {
    const raw = String(value ?? "").replace(",", ".").trim();
    if (raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function positiveNumber(value) {
    const parsed = toNumber(value, 0);
    return parsed > 0 ? parsed : 0;
  }

  function boolFromValue(value, fallback = null) {
    if (value === true || value === "true" || value === "yes") return true;
    if (value === false || value === "false" || value === "no") return false;
    return fallback;
  }

  function mergeStatus(statuses) {
    if (statuses.includes("ERROR")) return "ERROR";
    if (statuses.includes("WARNING")) return "WARNING";
    if (statuses.includes("UNKNOWN")) return "UNKNOWN";
    return "PASS";
  }

  function roundUpGeneratorSize(requiredKw) {
    const required = positiveNumber(requiredKw);
    return standardGeneratorSizesKw.find((size) => size >= required) || required;
  }

  function formatDuration(hours) {
    const value = positiveNumber(hours);
    if (!value) return "не рассчитано";
    const minutes = Math.round(value * 60);
    if (minutes < 60) return `${minutes} мин`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }

  function defaultInput(raw = {}) {
    return {
      enabled: boolFromValue(raw.enabled, true),
      generatorRatedPowerKw: positiveNumber(raw.generatorRatedPowerKw || 5),
      generatorContinuousLoadPercent: positiveNumber(raw.generatorContinuousLoadPercent || 80),
      generatorType: raw.generatorType || "inverter",
      generatorPhases: raw.generatorPhases || "single-phase",
      batteryCurrentSocPercent: toNumber(raw.batteryCurrentSocPercent, 20),
      batteryTargetSocPercent: toNumber(raw.batteryTargetSocPercent, 90),
      batteryChargingVoltageV: positiveNumber(raw.batteryChargingVoltageV || 54),
      batteryChargeCurrentA: positiveNumber(raw.batteryChargeCurrentA || 50),
      houseAverageLoadW: positiveNumber(raw.houseAverageLoadW || 400),
      houseReservePowerW: positiveNumber(raw.houseReservePowerW || 500),
      chargerEfficiencyPercent: positiveNumber(raw.chargerEfficiencyPercent || 90),
      chargingProfileFactor: positiveNumber(raw.chargingProfileFactor || 1.1),
      inverterMaxGeneratorChargeCurrentA: positiveNumber(raw.inverterMaxGeneratorChargeCurrentA),
      batteryMaxChargeCurrentA: positiveNumber(raw.batteryMaxChargeCurrentA),
      generatorInputSupported: boolFromValue(raw.generatorInputSupported, null),
      generatorDryContactSupported: boolFromValue(raw.generatorDryContactSupported, null),
      remoteStartSupported: boolFromValue(raw.remoteStartSupported, null),
      autoStart: {
        enabled: boolFromValue(raw.autoStart?.enabled, false),
        supportedByInverter: boolFromValue(raw.autoStart?.supportedByInverter, null),
        dryContactSupported: boolFromValue(raw.autoStart?.dryContactSupported, null),
        remoteStartSupportedByGenerator: boolFromValue(raw.autoStart?.remoteStartSupportedByGenerator, null),
        startSocPercent: toNumber(raw.autoStart?.startSocPercent, 20),
        stopSocPercent: toNumber(raw.autoStart?.stopSocPercent, 80),
        warmupSeconds: positiveNumber(raw.autoStart?.warmupSeconds || 30),
        cooldownSeconds: positiveNumber(raw.autoStart?.cooldownSeconds || 60),
        minimumRunMinutes: positiveNumber(raw.autoStart?.minimumRunMinutes || 30),
        controlType: raw.autoStart?.controlType || "dryContactTwoWire",
      },
    };
  }

  function visibilityStatus(input, context) {
    const systemType = context?.systemType || "unknown";
    const hasBattery = !!context?.hasBattery;
    if (!["hybrid", "backup"].includes(systemType)) return { visible: false, status: "PASS", messages: [] };
    if (!hasBattery) return { visible: false, status: "PASS", messages: [] };
    if (input.generatorInputSupported === false) {
      return {
        visible: false,
        status: "UNKNOWN",
        messages: ["Выбранный инвертор не подтвержден как совместимый с внешним AC-входом/генератором."],
      };
    }
    if (input.generatorInputSupported === null) {
      return {
        visible: true,
        status: "UNKNOWN",
        messages: ["Возможность подключения и управления генератором необходимо подтвердить по паспорту выбранного инвертора."],
      };
    }
    return { visible: true, status: "PASS", messages: [] };
  }

  function currentLimit(input) {
    const limits = [
      { value: input.batteryChargeCurrentA, label: "заданный ток заряда" },
      { value: input.inverterMaxGeneratorChargeCurrentA, label: "лимит инвертора по заряду от генератора" },
      { value: input.batteryMaxChargeCurrentA, label: "лимит BMS/АКБ" },
    ].filter((item) => item.value > 0);
    const missing = [];
    if (!input.inverterMaxGeneratorChargeCurrentA) missing.push("лимит инвертора по заряду от генератора");
    if (!input.batteryMaxChargeCurrentA) missing.push("лимит BMS/АКБ");
    const allowed = limits.length ? Math.min(...limits.map((item) => item.value)) : input.batteryChargeCurrentA;
    const cappedBy = limits.find((item) => item.value === allowed)?.label || "";
    const messages = [];
    let status = "PASS";
    if (missing.length) {
      status = "UNKNOWN";
      messages.push(`Нет подтверждённых данных: ${missing.join(", ")}.`);
    }
    if (input.batteryChargeCurrentA > allowed) {
      status = mergeStatus([status, "WARNING"]);
      messages.push(`Расчёт ограничен током ${allowed} А: ${cappedBy}.`);
    }
    return { allowed, status, messages };
  }

  function autoStartStatus(input, context) {
    const auto = input.autoStart;
    const messages = [];
    const statuses = [];
    if (!auto.enabled) {
      return {
        ...auto,
        status: "PASS",
        messages: ["Автозапуск не включён в расчёте."],
      };
    }
    const supportedByInverter = auto.supportedByInverter ?? input.generatorDryContactSupported;
    const dryContactSupported = auto.dryContactSupported ?? input.generatorDryContactSupported;
    const remoteStartSupportedByGenerator = auto.remoteStartSupportedByGenerator ?? input.remoteStartSupported;
    if (supportedByInverter === null || dryContactSupported === null) {
      statuses.push("UNKNOWN");
      messages.push("Поддержку сухого контакта нужно подтвердить по паспорту инвертора.");
    } else if (!supportedByInverter || !dryContactSupported) {
      statuses.push("ERROR");
      messages.push("Автозапуск невозможен без подтверждённого сухого контакта/управляющего выхода инвертора.");
    }
    if (remoteStartSupportedByGenerator === null) {
      statuses.push("UNKNOWN");
      messages.push("Нужно подтвердить электрический запуск и дистанционный запуск генератора.");
    } else if (!remoteStartSupportedByGenerator) {
      statuses.push("ERROR");
      messages.push("Для автоматического режима генератор должен поддерживать дистанционный запуск.");
    }
    if (auto.stopSocPercent <= auto.startSocPercent) {
      statuses.push("ERROR");
      messages.push("SOC остановки должен быть выше SOC запуска.");
    } else if (auto.stopSocPercent - auto.startSocPercent < 20) {
      statuses.push("WARNING");
      messages.push("Рекомендуемая разница между запуском и остановкой генератора не менее 20 процентных пунктов.");
    }
    if (!auto.minimumRunMinutes) {
      statuses.push("ERROR");
      messages.push("Минимальное время работы генератора должно быть больше 0.");
    }
    messages.push("Сухой контакт инвертора является управляющим сигналом. Для автоматического запуска генератор должен иметь электрический запуск и совместимый контроллер дистанционного запуска.");
    if (supportedByInverter === true && context?.inverterBrand === "Deye") {
      messages.push("Инвертор может подавать команду на запуск генератора через сухой контакт при снижении SOC АКБ до заданного значения.");
    }
    return {
      ...auto,
      supportedByInverter,
      dryContactSupported,
      remoteStartSupportedByGenerator,
      status: statuses.length ? mergeStatus(statuses) : "PASS",
      messages,
    };
  }

  function calculateGeneratorCharging(rawInput = {}, context = {}) {
    const input = defaultInput(rawInput);
    const visibility = visibilityStatus(input, context);
    if (!visibility.visible || !input.enabled) {
      return {
        visible: visibility.visible && input.enabled,
        input,
        status: visibility.status,
        messages: visibility.messages,
        comparisonRows: [],
      };
    }
    const messages = [...visibility.messages];
    const statuses = [visibility.status];
    const current = currentLimit(input);
    statuses.push(current.status);
    messages.push(...current.messages);

    const allowedChargeCurrentA = current.allowed;
    const efficiency = Math.max(1, Math.min(100, input.chargerEfficiencyPercent)) / 100;
    const batteryVoltage = input.batteryChargingVoltageV;
    const dcChargingPowerKw = batteryVoltage * allowedChargeCurrentA / 1000;
    const generatorChargingPowerKw = dcChargingPowerKw / efficiency;
    const generatorRecommendedContinuousPowerKw = input.generatorRatedPowerKw * input.generatorContinuousLoadPercent / 100;
    const houseAverageLoadKw = input.houseAverageLoadW / 1000;
    const houseReservePowerKw = input.houseReservePowerW / 1000;
    const generatorTotalRequiredPowerKw = generatorChargingPowerKw + houseAverageLoadKw + houseReservePowerKw;
    const generatorAvailableReserveKw = generatorRecommendedContinuousPowerKw - generatorChargingPowerKw - houseAverageLoadKw;
    const generatorReserveAfterPlannedMarginKw = generatorRecommendedContinuousPowerKw - generatorTotalRequiredPowerKw;
    const generatorLoadPercent = input.generatorRatedPowerKw > 0
      ? (generatorChargingPowerKw + houseAverageLoadKw) / input.generatorRatedPowerKw * 100
      : 0;
    const totalBatteryNominalEnergyKwh = positiveNumber(context.totalBatteryNominalEnergyKwh);
    const socDelta = input.batteryTargetSocPercent - input.batteryCurrentSocPercent;
    const energyToChargeKwh = totalBatteryNominalEnergyKwh * socDelta / 100;
    const baseChargingTimeHours = dcChargingPowerKw > 0 ? energyToChargeKwh / dcChargingPowerKw : 0;
    const estimatedChargingTimeHours = baseChargingTimeHours * input.chargingProfileFactor;
    const minimumGeneratorRatedPowerKw = input.generatorContinuousLoadPercent > 0
      ? generatorTotalRequiredPowerKw / (input.generatorContinuousLoadPercent / 100)
      : 0;
    const recommendedGeneratorRatedPowerKw = roundUpGeneratorSize(minimumGeneratorRatedPowerKw);
    const preferredGeneratorRatedPowerKw = roundUpGeneratorSize(minimumGeneratorRatedPowerKw * 1.15);

    if (!batteryVoltage) {
      statuses.push("UNKNOWN");
      messages.push("Нет подтверждённого напряжения заряда АКБ. Расчёт ориентировочный.");
    }
    if (input.batteryCurrentSocPercent < 0 || input.batteryTargetSocPercent > 100 || input.batteryTargetSocPercent <= input.batteryCurrentSocPercent) {
      statuses.push("ERROR");
      messages.push("SOC окончания должен быть больше текущего SOC и не выше 100%.");
    }
    if (!dcChargingPowerKw) {
      statuses.push("ERROR");
      messages.push("Мощность заряда АКБ не рассчитана: проверьте напряжение и ток заряда.");
    }
    if (generatorReserveAfterPlannedMarginKw < 0) {
      statuses.push("ERROR");
      messages.push("Генератор перегружен с учётом заряда АКБ, нагрузки дома и планового резерва.");
    } else if (generatorLoadPercent > 80) {
      statuses.push("WARNING");
      messages.push("Нагрузка генератора выше 80%. Желательно увеличить мощность генератора или снизить ток заряда АКБ.");
    }
    if (input.generatorType === "synchronous") {
      statuses.push("WARNING");
      messages.push("Необходимо проверить стабильность частоты, напряжения, форму выходного сигнала, запас мощности, схему нейтрали и совместимость с AC-входом инвертора.");
    }

    const autoStart = autoStartStatus(input, context);
    statuses.push(autoStart.status);

    const generatorTypeRecommendation = input.generatorType === "inverter"
      ? "Для работы с гибридным или резервным инвертором предпочтительно использовать инверторный генератор. Он обеспечивает более стабильные напряжение и частоту, благодаря чему инвертор надёжнее принимает питание и реже отключает генераторный вход по качеству сети."
      : "Для синхронного генератора требуется отдельная проверка качества напряжения, частоты, нейтрали и совместимости с AC-входом инвертора.";

    const result = {
      visible: true,
      input,
      status: mergeStatus(statuses),
      messages: [...messages, "Фактическое время зарядки может увеличиваться ближе к верхнему уровню SOC из-за снижения зарядного тока, балансировки ячеек, температуры и ограничений BMS."],
      allowedChargeCurrentA,
      dcChargingPowerKw,
      generatorChargingPowerKw,
      generatorRecommendedContinuousPowerKw,
      houseAverageLoadKw,
      houseReservePowerKw,
      generatorTotalRequiredPowerKw,
      generatorAvailableReserveKw,
      generatorReserveAfterPlannedMarginKw,
      generatorLoadPercent,
      energyToChargeKwh,
      baseChargingTimeHours,
      estimatedChargingTimeHours,
      estimatedChargingTimeText: formatDuration(estimatedChargingTimeHours),
      minimumGeneratorRatedPowerKw,
      recommendedGeneratorRatedPowerKw,
      preferredGeneratorRatedPowerKw,
      generatorTypeRecommendation,
      autoStart,
      comparisonRows: [],
    };
    result.comparisonRows = context.skipComparison ? [] : buildChargeCurrentComparison(input, context);
    return result;
  }

  function buildChargeCurrentComparison(input, context, currents = [20, 30, 50, 60, 80, 100]) {
    return currents.map((amp) => {
      const result = calculateGeneratorCharging({ ...input, batteryChargeCurrentA: amp }, { ...context, skipComparison: true });
      return {
        batteryChargeCurrentA: amp,
        allowedChargeCurrentA: result.allowedChargeCurrentA || 0,
        generatorChargingPowerKw: result.generatorChargingPowerKw || 0,
        generatorTotalRequiredPowerKw: result.generatorTotalRequiredPowerKw || 0,
        generatorLoadPercent: result.generatorLoadPercent || 0,
        generatorAvailableReserveKw: result.generatorAvailableReserveKw || 0,
        estimatedChargingTimeHours: result.estimatedChargingTimeHours || 0,
        estimatedChargingTimeText: result.estimatedChargingTimeText || "не рассчитано",
        status: result.status || "UNKNOWN",
      };
    });
  }

  return {
    standardGeneratorSizesKw,
    toNumber,
    positiveNumber,
    mergeStatus,
    roundUpGeneratorSize,
    formatDuration,
    defaultInput,
    calculateGeneratorCharging,
    buildChargeCurrentComparison,
  };
});
