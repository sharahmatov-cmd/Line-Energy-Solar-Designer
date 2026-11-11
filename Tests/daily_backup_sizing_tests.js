const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const backup = require("../Web/backupRuntime.js");

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../Web/data.js"), "utf8"), context);
const { inverters, batteries } = context.window.SOLAR_DATA;
const input = { dailyKwh: 15, peakKw: 4, phase: "single-phase" };
const recommend = (overrides = {}, models = inverters, modules = batteries) =>
  backup.recommendDailyBackup({ ...input, ...overrides }, models, modules);

const single = recommend();
assert.equal(single.issue, "");
assert.equal(single.referenceNominalKwh, 15.072);
assert.ok(Math.abs(single.referenceUsableKwh - 11.8556352) < 1e-9);
assert.equal(single.battery.model, "QPW-ST314");
assert.equal(single.battery.nominal_voltage_v, "51.2");
assert.equal(single.batteryQuantity, 2);
assert.equal(single.inverter.nominal_ac_power_w, "5000");
assert.equal(single.inverter.phase, "single-phase");
assert.ok(Math.abs(single.runtimeHours - 40.47) < 0.02);
assert.equal(recommend({ dailyKwh: 12, peakKw: 1 }).batteryQuantity, 2, "48 V is the sizing baseline");
assert.equal(recommend({ dailyKwh: 8, peakKw: 2 }).batteryQuantity, 1);
assert.equal(recommend({ dailyKwh: 8, peakKw: 6 }).batteryQuantity, 2, "discharge current may require more modules");

const three = recommend({ phase: "three-phase", phasePeakKw: 3 });
assert.equal(three.issue, "");
assert.equal(three.inverter.phase, "three-phase");
assert.equal(three.inverter.nominal_ac_power_w, "8000", "8 kW is required by the phase limit, not by total load");
assert.equal(three.inverter.max_backup_phase_power_w, "4000");
assert.equal(recommend({ phase: "three-phase", phasePeakKw: 1 }).issue, "phasePeak");
assert.equal(recommend({ phase: "three-phase", phasePeakKw: 5 }).issue, "phasePeak");
assert.equal(recommend({ phase: "three-phase", phasePeakKw: "" }).issue, "phasePeak");
assert.equal(recommend({ phase: "" }).issue, "phase");
assert.equal(recommend({ peakKw: 0.4 }).issue, "peak");
assert.equal(recommend({ dailyKwh: "" }).issue, "consumption");
assert.equal(recommend({ peakKw: 100 }).issue, "inverter");
assert.equal(recommend({}, inverters, []).issue, "battery");

const checkReject = (patch, inputPatch = {}, model = single.inverter) =>
  assert.equal(recommend(inputPatch, [{ ...model, ...patch }]).issue, "inverter");
checkReject({ battery_voltage_range_v: "20-30" });
checkReject({ battery_voltage_range_v: "150-600" });
checkReject({ battery_voltage_range_v: "40-55" });
checkReject({ max_battery_current_a: "60" });
checkReject({ max_battery_current_a: "" });
checkReject({ series: "Grid" });
checkReject({ data_status: "seed_verify_datasheet" });
checkReject({ max_backup_phase_power_w: "" }, { phase: "three-phase", phasePeakKw: 3 }, three.inverter);

const useful = backup.dailyBackupBatteryEnergy(single.battery, {
  depthOfDischargePercent: 100, inverterEfficiencyPercent: 92, operationalReservePercent: 95,
});
assert.equal(useful, 14.47 * 0.92 * 0.95, "documented usable capacity caps the calculation");
const runtime = backup.calculateBackupRuntime({
  nominalEnergyKwh: 2 * Number(single.battery.nominal_energy_kwh),
  usableEnergyKwh: single.usableEnergyKwh,
  scenarios: { base: { averageLoadW: input.dailyKwh / 24 * 1000 } },
});
assert.ok(Math.abs(runtime.scenarioMap.base.runtimeHours - single.runtimeHours) < 1e-9);

console.log("PASS: daily sizing, actual 314 Ah battery, per-phase and current limits, and runtime consistency");
