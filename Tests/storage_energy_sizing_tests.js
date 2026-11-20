const assert = require("node:assert/strict");
const backup = require("../Web/backupRuntime.js");
const input = { nominalPerUnitKwh: 261, quantity: 1, loadKw: 10, targetHours: 24 };
const calculate = (patch = {}) => backup.calculateStorageEnergySizing({ ...input, ...patch });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + " vs " + expected);
const result = calculate();
assert.equal(result.isEstimate, true);
assert.equal(result.status, "WARNING");
close(result.usableEnergyKwh, 205.3026);
close(result.runtimeHours, 20.53026);
close(result.requiredLoadEnergyKwh, 240);
close(result.requiredNominalEnergyKwh, 305.11060259344015);
assert.equal(result.requiredQuantity, 2);
close(calculate({ quantity: 2 }).runtimeHours, 41.06052);
close(calculate({ quantity: 3 }).nominalEnergyKwh, 783);
close(calculate({ loadKw: 20 }).runtimeHours, 10.26513);
assert.equal(calculate({ loadKw: 20 }).requiredQuantity, 3);
close(calculate({ auxiliaryPowerKw: 1 }).runtimeHours, 205.3026 / 11);
close(calculate({ initialSocPercent: 50 }).usableEnergyKwh, 91.2456);
assert.equal(calculate({ initialSocPercent: 50 }).requiredQuantity, 3);
assert.equal(calculate({ targetHours: 20.53026 }).requiredQuantity, 1, "boundary must not add a spurious cabinet");
assert.equal(calculate({ quantity: 0 }).runtimeHours, 0);
assert.equal(calculate({ inverterPowerKw: 8 }).powerExceeded, true);
assert.equal(calculate({ inverterPowerKw: 10 }).powerExceeded, false);
assert.equal(calculate({ inverterPowerKw: 10, auxiliaryPowerKw: 1 }).powerExceeded, true);
for (const patch of [
  { loadKw: 0 }, { loadKw: -1 }, { targetHours: 0 }, { auxiliaryPowerKw: -1 },
  { initialSocPercent: 10 }, { initialSocPercent: 0 }, { initialSocPercent: 101 },
  { depthOfDischargePercent: 0 }, { depthOfDischargePercent: 101 },
  { inverterEfficiencyPercent: -1 }, { inverterEfficiencyPercent: 101 },
  { operationalReservePercent: 0 }, { nominalPerUnitKwh: 0 }, { targetHours: 1e308 },
]) {
  const invalid = calculate(patch);
  assert.equal(invalid.runtimeHours, null, JSON.stringify(patch));
  assert.equal(invalid.requiredQuantity, null);
  assert.ok(invalid.messages.length > 0);
  assert.ok(Number.isFinite(invalid.usableEnergyKwh));
}
console.log("PASS: 261 kWh energy sizing, runtime, SOC, losses, auxiliary load, cabinet count and invalid inputs");
