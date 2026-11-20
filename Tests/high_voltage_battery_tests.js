const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const backup = require("../Web/backupRuntime.js");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../Web/data.js"), "utf8"), context);
const { batteries, inverters } = context.window.SOLAR_DATA;
const cabinet = batteries.find((row) => row.model === "LB-261kW");
assert.ok(cabinet);
assert.equal(batteries.length, 5);
assert.equal(cabinet.nominal_energy_kwh, "261");
assert.equal(cabinet.battery_voltage_class, "HV");
assert.equal(cabinet.brand, "DYNAVOLT");
assert.equal(cabinet.weight_kg, "2620");
assert.equal(cabinet.data_status, "packing_list_identified_needs_datasheet");
assert.match(cabinet.source_document, /IMG_0081/);
assert.equal(cabinet.requires_datasheet, "true");
assert.equal(cabinet.quote_required, "true");
for (const field of ["nominal_voltage_v", "capacity_ah", "chemistry", "usable_energy_kwh",
  "max_charge_current_a", "max_discharge_current_a", "dimensions_mm", "image_url"]) {
  assert.equal(cabinet[field], "", field + " must not be fabricated");
}
assert.equal(cabinet.accessory_model, "LB-261KW-A1");
assert.equal(batteries.some((row) => row.model === cabinet.accessory_model), false);
assert.match(cabinet.packaging_description, /1645 × 1475 × 2247/);
assert.match(cabinet.packaging_description, /1290 × 710 × 600/);
const lv = inverters.find((row) => row.model === "SUN-8K-SG05LP1-EU-AM2-P");
const hv = inverters.find((row) => row.model === "SUN-100K-SG02HP3-EU-GM10");
assert.equal(backup.checkBatteryVoltageCompatibility(lv, cabinet, 1).status, "ERROR");
const pending = backup.checkBatteryVoltageCompatibility(hv, cabinet, 1);
assert.equal(pending.status, "UNKNOWN");
assert.equal(pending.calculationBlocked, true);
assert.equal(backup.checkBatteryVoltageCompatibility(hv, cabinet, 0).status, "PASS");
assert.equal(backup.dailyBackupBatteryEnergy(cabinet), 0, "missing useful energy must not turn into a default runtime");
console.log("PASS: preliminary 261 kWh HV cabinet, packaging separation, no fabricated specifications or LV compatibility");
