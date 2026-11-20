const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const backup = require("../Web/backupRuntime.js");

const web = path.join(__dirname, "../Web");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(web, "data.js"), "utf8"), context);
const { inverters, batteries } = context.window.SOLAR_DATA;
const prices = {
  "SUN-10K-SG01HP3-EU-AM2": 135020,
  "SUN-12K-SG01HP3-EU-AM2": 143140,
  "SUN-15K-SG01HP3-EU-AM2": 167230,
  "SUN-20K-SG01HP3-EU-AM2": 197202,
  "SUN-25K-SG01HP3-EU-AM2": 210630,
  "SUN-30K-SG02HP3-EU-AM3": 325205,
  "SUN-40K-SG01HP3-EU-BM4": 456300,
  "SUN-50K-SG01HP3-EU-BM4": 478810,
  "SUN-60K-SG02HP3-EU-EM6": 650620,
  "SUN-70K-SG02HP3-EU-EM6": 665170,
  "SUN-75K-SG02HP3-EU-EM6": 681295,
  "SUN-80K-SG02HP3-EU-EM6": 697420,
  "SUN-100K-SG02HP3-EU-GM10": 899560,
  "SUN-125K-SG02HP3-EU-GM10": 976790,
};

for (const [name, price] of Object.entries(prices)) {
  const rows = inverters.filter((row) => row.model === name);
  assert.equal(rows.length, 1, name + " must not be duplicated");
  const row = rows[0];
  assert.equal(Number(row.price_rub), price);
  assert.equal(row.price_source, "user_provided");
  assert.equal(row.phase, "three-phase");
  assert.equal(row.battery_voltage_class, "HV");
  assert.ok(row.description.includes("высоковольтным"));
  assert.ok(row.product_url.startsWith("https://"));
  assert.ok(row.datasheet_url.endsWith(".pdf"));
  const pdf = fs.readFileSync(path.join(web, row.datasheet_local_url));
  assert.equal(pdf.toString("ascii", 0, 5), "%PDF-");
  const photo = fs.readFileSync(path.join(web, row.image_url));
  assert.ok(photo.length > 10000);
  assert.equal(row.image_url.endsWith(".webp") ? photo.toString("ascii", 8, 12) : photo.toString("ascii", 1, 4),
    row.image_url.endsWith(".webp") ? "WEBP" : "PNG");
  const mppts = Number(row.mppt_count);
  assert.equal(row.strings_per_mppt.split("+").length, mppts);
  assert.equal(row.max_input_current_per_mppt_a.split("+").length, mppts);
  assert.equal(row.max_short_circuit_current_per_mppt_a.split("+").length, mppts);
  assert.equal(Number(row.max_pv_input_power_w), Number(row.nominal_ac_power_w) * 1.6);
  assert.equal(Number(row.max_pv_access_power_w), Number(row.nominal_ac_power_w) * 2);
  for (const battery of batteries) {
    for (const quantity of [1, 2, 20]) {
      assert.equal(backup.checkBatteryVoltageCompatibility(row, battery, quantity).status, "ERROR");
    }
  }
  assert.equal(backup.checkBatteryVoltageCompatibility(row, batteries[0], 0).status, "PASS");
}

const get = (model) => inverters.find((row) => row.model === model);
assert.equal(get("SUN-12K-SG01HP3-EU-AM2").strings_per_mppt, "2+1");
assert.equal(get("SUN-15K-SG01HP3-EU-AM2").max_input_current_per_mppt_a, "26+20");
assert.equal(get("SUN-25K-SG01HP3-EU-AM2").strings_per_mppt, "2+2");
assert.equal(get("SUN-40K-SG01HP3-EU-BM4").mppt_count, "4");
assert.equal(get("SUN-40K-SG01HP3-EU-BM4").lifecycle_status, "discontinued");
assert.equal(get("SUN-100K-SG02HP3-EU-GM10").mppt_count, "10");
assert.equal(get("SUN-125K-SG02HP3-EU-GM10").datasheet_preliminary, "true");
assert.equal(get("SUN-125K-SG02HP3-EU-GM10").data_status, "manufacturer_preliminary_datasheet");
assert.equal(backup.checkBatteryVoltageCompatibility(get("SUN-10K-SG01HP3-EU-AM2"), { model: "HV-test", nominal_voltage_v: 400 }, 1).status, "PASS");
assert.equal(backup.checkBatteryVoltageCompatibility({}, batteries[0], 1).status, "UNKNOWN");
assert.equal(backup.checkBatteryVoltageCompatibility(get("SUN-10K-SG01HP3-EU-AM2"), {}, 1).status, "UNKNOWN");
const daily = backup.recommendDailyBackup({ dailyKwh: 15, peakKw: 4, phase: "three-phase", phasePeakKw: 2 }, inverters, batteries);
assert.equal(daily.issue, "");
assert.notEqual(daily.inverter.battery_voltage_class, "HV", "48 V recommendation must not select a HV model");

console.log("PASS: 14 unique Deye HV models, exact user prices, five photo/PDF families and battery voltage checks");
