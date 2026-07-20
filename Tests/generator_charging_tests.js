const assert = require("node:assert/strict");
const generator = require("../Web/generatorCharging.js");

function baseInput(overrides = {}) {
  return {
    enabled: true,
    generatorRatedPowerKw: 5,
    generatorContinuousLoadPercent: 80,
    generatorType: "inverter",
    generatorPhases: "single-phase",
    batteryCurrentSocPercent: 20,
    batteryTargetSocPercent: 90,
    batteryChargingVoltageV: 54,
    batteryChargeCurrentA: 50,
    houseAverageLoadW: 400,
    houseReservePowerW: 500,
    chargerEfficiencyPercent: 90,
    chargingProfileFactor: 1.1,
    inverterMaxGeneratorChargeCurrentA: 100,
    batteryMaxChargeCurrentA: 100,
    generatorInputSupported: true,
    generatorDryContactSupported: true,
    remoteStartSupported: true,
    autoStart: {
      enabled: false,
      supportedByInverter: true,
      dryContactSupported: true,
      remoteStartSupportedByGenerator: true,
      startSocPercent: 20,
      stopSocPercent: 80,
      warmupSeconds: 30,
      cooldownSeconds: 60,
      minimumRunMinutes: 30,
      controlType: "dryContactTwoWire",
    },
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    systemType: "backup",
    hasBattery: true,
    totalBatteryNominalEnergyKwh: 9.6,
    inverterBrand: "Deye",
    inverterModel: "SUN-8K-SG05LP1-EU-AM2-P",
    ...overrides,
  };
}

let result = generator.calculateGeneratorCharging(baseInput(), context());
assert.equal(result.visible, true, "backup with battery should show generator block");
assert.equal(Math.round(result.dcChargingPowerKw * 10) / 10, 2.7, "54 V * 50 A should be 2.7 kW DC");
assert.equal(Math.round(result.generatorChargingPowerKw * 10) / 10, 3.0, "90% efficiency should require 3.0 kW from generator");
assert.ok(result.estimatedChargingTimeHours > 2.6 && result.estimatedChargingTimeHours < 2.8, "SOC charge time should include profile factor");
assert.ok(result.generatorTotalRequiredPowerKw > result.generatorChargingPowerKw, "house load and reserve should be included");

result = generator.calculateGeneratorCharging(baseInput(), context({ systemType: "grid" }));
assert.equal(result.visible, false, "grid systems should hide generator block");

result = generator.calculateGeneratorCharging(baseInput(), context({ systemType: "hybrid" }));
assert.equal(result.visible, true, "hybrid with battery should show generator block");

result = generator.calculateGeneratorCharging(baseInput(), context({ hasBattery: false }));
assert.equal(result.visible, false, "systems without battery should hide generator block");

result = generator.calculateGeneratorCharging(baseInput({ inverterMaxGeneratorChargeCurrentA: 30, batteryMaxChargeCurrentA: 80 }), context());
assert.equal(result.allowedChargeCurrentA, 30, "inverter current cap should limit charge current");
assert.match(result.messages.join(" "), /30 А/, "current cap warning should be shown");

result = generator.calculateGeneratorCharging(baseInput({ batteryMaxChargeCurrentA: 20 }), context());
assert.equal(result.allowedChargeCurrentA, 20, "battery/BMS current cap should limit charge current");

result = generator.calculateGeneratorCharging(baseInput({ batteryMaxChargeCurrentA: 0 }), context());
assert.equal(result.status, "UNKNOWN", "missing BMS limit should make status UNKNOWN");

result = generator.calculateGeneratorCharging(baseInput({ batteryCurrentSocPercent: 80, batteryTargetSocPercent: 70 }), context());
assert.equal(result.status, "ERROR", "target SOC <= current SOC should be ERROR");

result = generator.calculateGeneratorCharging(baseInput({ generatorRatedPowerKw: 3, batteryChargeCurrentA: 100 }), context());
assert.equal(result.status, "ERROR", "generator overload should be ERROR");

result = generator.calculateGeneratorCharging(baseInput({ generatorRatedPowerKw: 5, batteryChargeCurrentA: 60, houseAverageLoadW: 600, houseReservePowerW: 0 }), context());
assert.ok(["WARNING", "ERROR"].includes(result.status), "load above 80% should warn or error");

result = generator.calculateGeneratorCharging(baseInput({ generatorInputSupported: null }), context());
assert.equal(result.status, "UNKNOWN", "unknown generator input support should be UNKNOWN");

result = generator.calculateGeneratorCharging(baseInput({
  autoStart: {
    ...baseInput().autoStart,
    enabled: true,
    remoteStartSupportedByGenerator: false,
  },
}), context());
assert.equal(result.status, "ERROR", "autostart needs remote generator start");
assert.match(result.autoStart.messages.join(" "), /Сухой контакт/, "dry contact warning should be present");

assert.equal(generator.roundUpGeneratorSize(4.1), 5, "standard generator size should round up");
assert.equal(generator.roundUpGeneratorSize(10.2), 12, "larger standard generator size should round up");

result = generator.calculateGeneratorCharging(baseInput(), context());
const t20 = result.comparisonRows.find((row) => row.allowedChargeCurrentA === 20);
const t100 = result.comparisonRows.find((row) => row.allowedChargeCurrentA === 100);
assert.ok(t20.estimatedChargingTimeHours > t100.estimatedChargingTimeHours, "higher current should reduce charge time");
assert.ok(t100.recommendedGeneratorRatedPowerKw >= t100.minimumGeneratorRatedPowerKw, "comparison should include recommended generator size");

console.log("generator charging tests passed");
