const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const web = path.join(__dirname, "../Web");
const context = vm.createContext({ window: {}, num: (value, fallback = 0) => {
  const raw = String(value ?? "").replace(",", ".").trim();
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) ? parsed : fallback;
} });
const catalog = fs.readFileSync(path.join(web, "data.js"), "utf8");
vm.runInContext(catalog, context);
const source = fs.readFileSync(path.join(web, "app.js"), "utf8");
for (const name of ["inverterType", "stringsPerMpptArray", "pvInputsForInverter", "mpptInputCapacity",
  "maxPanelsPerString", "mergeStatus", "buildStringConfiguration"]) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf("\n  function ", start + 1);
  vm.runInContext(source.slice(start, end), context);
}

const inverters = context.window.SOLAR_DATA.inverters;
const sg06 = inverters.filter((item) => item.brand === "Deye" && item.model.includes("-SG06"));
const model = (name) => {
  const item = sg06.find((row) => row.model === name);
  assert.ok(item, name);
  return item;
};
assert.equal(sg06.length, 34);
assert.equal(new Set(sg06.map((item) => item.model)).size, 34);
assert.equal(sg06.filter((item) => item.phase === "three-phase").length, 10);
assert.equal(new Set(sg06.map((item) => item.image_url)).size, 6);
for (const item of sg06) {
  assert.equal(context.inverterType(item), "hybrid");
  assert.ok(item.description && item.datasheet_url && item.image_source_url, item.model);
  const photo = fs.readFileSync(path.join(web, item.image_url));
  assert.equal(photo.toString("ascii", 8, 12), "WEBP");
  assert.equal(item.strings_per_mppt.split("+").length, Number(item.mppt_count));
  assert.ok(Number(item.max_pv_access_power_w) > Number(item.max_pv_input_power_w));
}
const small = model("SUN-3K-SG06LP1-24-EU-BM1");
assert.equal(small.battery_voltage_range_v, "20-30");
assert.equal(small.mppt_count, "1");
const threePhase = model("SUN-8K-SG06LP3-EU-CM2");
assert.equal(threePhase.max_pv_voltage_v, "800");
assert.equal(threePhase.mppt_voltage_min_v, "200");
assert.equal(threePhase.max_battery_current_a, "190");

const panel = { imp_stc_a: 13, isc_stc_a: 14, vmp_stc_v: 44, voc_stc_v: 53 };
const eightKw = model("SUN-8K-SG06LP1-EU-BM3");
const twelveKw = model("SUN-12K-SG06LP1-EU-CM3");
const capacity = (inverter, module = panel) => Array.from(context.mpptInputCapacity(module, inverter).trackers, (tracker) => tracker.allowed);
assert.deepEqual(capacity(eightKw), [2, 1, 1]);
assert.deepEqual(capacity(twelveKw), [2, 2, 1]);
assert.deepEqual(capacity(eightKw, { ...panel, imp_stc_a: 19 }), [1, 0, 0]);
assert.deepEqual(capacity(eightKw, { ...panel, isc_stc_a: 28 }), [1, 0, 0]);
assert.equal(context.mpptInputCapacity({ ...panel, isc_stc_a: "" }, eightKw).status, "UNKNOWN");
const configure = (selectedPanel, selectedInverter, panelQuantity) => context.buildStringConfiguration({ selectedPanel, selectedInverter, panelQuantity }, { slopes: [] });
const fourStrings = configure(panel, eightKw, 32);
assert.equal(fourStrings.stringCount, 4);
assert.deepEqual(Array.from(fourStrings.mpptAssignment, (item) => item.pvInput), ["PV 1.1", "PV 2", "PV 3", "PV 1.2"]);
assert.notEqual(fourStrings.validationStatus, "ERROR");
assert.equal(configure(panel, eightKw, 40).validationStatus, "ERROR");
assert.equal(configure({ ...panel, imp_stc_a: 40 }, eightKw, 8).validationStatus, "ERROR");
const existing = inverters.find((item) => item.model === "SUN-8K-SG05LP1-EU-AM2-P");
assert.deepEqual(capacity(existing), [2, 2]);
assert.deepEqual(Array.from(configure(panel, existing, 16).mpptAssignment, (item) => item.panels), [8, 8]);

console.log("PASS: 34 Deye SG06 models, six photos, catalog specs and per-MPPT limits");
