const assert = require("node:assert/strict");
const backup = require("../Web/backupRuntime.js");

const scenarios = backup.normalizeScenarios({
  normal: { dailyConsumptionMinKwh: 14, dailyConsumptionMaxKwh: 16 },
  base: { averageLoadW: 400 },
  economy: { dailyConsumptionKwh: 8 },
});

let result = backup.calculateBackupRuntime({
  nominalEnergyKwh: 16,
  usableEnergyKwh: 14.5,
  scenarios,
});

assert.equal(result.scenarios.length, 3, "three backup runtime scenarios should be calculated");
assert.ok(result.scenarioMap.normal.runtimeMinHours > 21.7 && result.scenarioMap.normal.runtimeMinHours < 21.9, "normal min runtime should match 16 kWh/day");
assert.ok(result.scenarioMap.normal.runtimeMaxHours > 24.8 && result.scenarioMap.normal.runtimeMaxHours < 24.9, "normal max runtime should match 14 kWh/day");
assert.ok(result.scenarioMap.base.runtimeHours > 36.2 && result.scenarioMap.base.runtimeHours < 36.3, "400 W runtime should be about 36.2 h");
assert.ok(result.scenarioMap.economy.runtimeHours > 43.4 && result.scenarioMap.economy.runtimeHours < 43.6, "8 kWh/day runtime should be about 43.5 h");
assert.match(result.scenarioMap.normal.runtimeText, /22-25/, "normal runtime text should be a range");

const nominal100 = backup.nominalEnergyKwh({ voltageV: 48, capacityAh: 100, quantity: 1 });
const useful100 = backup.usableEnergyKwhFromPreset(nominal100, {
  depthOfDischargePercent: 90,
  inverterEfficiencyPercent: 92,
  operationalReservePercent: 95,
});
assert.equal(Math.round(nominal100 * 10) / 10, 4.8, "48 V 100 Ah nominal energy should be 4.8 kWh");
assert.equal(Math.round(useful100 * 100) / 100, 3.78, "48 V 100 Ah useful energy should be about 3.78 kWh");

const nominal200 = backup.nominalEnergyKwh({ voltageV: 48, capacityAh: 200, quantity: 1 });
const useful200 = backup.usableEnergyKwhFromPreset(nominal200, {
  depthOfDischargePercent: 90,
  inverterEfficiencyPercent: 92,
  operationalReservePercent: 95,
});
assert.equal(Math.round(nominal200 * 10) / 10, 9.6, "48 V 200 Ah nominal energy should be 9.6 kWh");
assert.equal(Math.round(useful200 * 100) / 100, 7.55, "48 V 200 Ah useful energy should be about 7.55 kWh");

const comparison = backup.buildBatteryComparison({
  scenarios,
  settings: {
    depthOfDischargePercent: 90,
    inverterEfficiencyPercent: 92,
    operationalReservePercent: 95,
  },
  selectedNominalEnergyKwh: 16.08,
  selectedUsableEnergyKwh: 14.5,
  selectedTitle: "51,2 В 314 А·ч",
});
assert.ok(comparison.some((row) => row.title.includes("48 В 100")), "comparison should include 48 V 100 Ah");
assert.ok(comparison.some((row) => row.title.includes("48 В 200")), "comparison should include 48 V 200 Ah");
assert.ok(comparison.some((row) => row.isSelected), "comparison should include selected project battery");
assert.equal(comparison.filter((row) => row.isSelected).length, 1, "selected battery should not be duplicated");
assert.ok(!comparison.some((row) => /NaN|undefined|null/.test(JSON.stringify(row))), "comparison should not contain invalid values");

console.log("backup runtime tests passed");
