const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "Web", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "Web", "styles.css"), "utf8");

[
  "buildCommercialCoverViewModel",
  "CommercialCoverHeader",
  "ProjectIdentity",
  "SystemSummary",
  "KeyMetricGrid",
  "KeyMetricCard",
  "TotalPriceBlock",
  "CommercialCoverFooter",
  "formatCurrencyRub",
  "formatEnergyKwh",
  "formatPowerKw",
  "formatPercent",
  "formatDateRu",
  "formatProposalNumber",
].forEach((name) => assert.match(app, new RegExp(`\\b${name}\\b`), `${name} is missing`));

const coverMarkupMatch = app.match(/function coverMarkup[\s\S]*?\n  }\n\n  function systemSummaryMarkup/);
assert.ok(coverMarkupMatch, "coverMarkup block was not found");
const coverMarkup = coverMarkupMatch[0];

[
  "Voc",
  "Vmp",
  "Isc",
  "Imp",
  "MPPT",
  "стринг",
  "datasheet",
  "по чертежу",
  "черновой расчет",
  "черновой расчёт",
].forEach((term) => assert.ok(!coverMarkup.includes(term), `commercial cover leaks technical term: ${term}`));

assert.match(app, /vm\.proposal\.status === "ERROR"[\s\S]*?Конфигурация требует корректировки/, "ERROR status message is missing");
assert.match(app, /vm\.proposal\.status === "WARNING"[\s\S]*?Требуется уточнение отдельных параметров/, "WARNING status message is missing");
assert.match(app, /vm\.proposal\.status === "PASS"[\s\S]*?Конфигурация проверена/, "PASS status message is missing");
assert.match(app, /hasNumber\(vm\.system\.batteryEnergyKwh\)[\s\S]*?\?[\s\S]*?Ёмкость АКБ[\s\S]*?: null/, "battery KPI must be conditional");

[
  "--pagePadding",
  "--sectionGap",
  "--cardGap",
  "--borderRadius",
  "--primaryColor",
  "--headingColor",
  "--bodyColor",
  "--mutedColor",
  "--surfaceColor",
  "--borderColor",
  "--fontSizeXs",
  "--fontSizeSm",
  "--fontSizeMd",
  "--fontSizeLg",
  "--fontSizeXl",
  "--fontSizeHero",
  ".commercialCover",
  ".coverKpiGrid",
  ".coverPriceBlock",
].forEach((token) => assert.ok(css.includes(token), `${token} style token/class is missing`));

console.log("commercial cover tests passed");
