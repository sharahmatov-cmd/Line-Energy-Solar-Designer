# Excel Calculator v0.4

File:

`Excel/Line-Energy-Solar-Calculator-v0.4.xlsx`

## Added in v0.4

- Dropdown list for inverter model selection.
- Dropdown list for panel model selection.
- Basic workbook styling for input and result areas.
- Frozen header rows on database sheets.
- Filters on inverter and panel database sheets.
- Minimum panels per string by MPPT voltage.
- Maximum panels per string by MPPT voltage.
- Maximum panels per string by PV voltage.
- Recommended panels-per-string range.
- Expanded Deye inverter catalog in the `Inverters` sheet.
- Expanded MUST, PowMr, and Anenji hybrid inverter catalogs in the `Inverters` sheet.
- Expanded Growatt and Solis inverter catalogs in the `Inverters` sheet.
- Expanded Jinko, LONGi, JA Solar, Trina, Astronergy, SunPro, and Ulica catalogs in the `Panels` sheet.

## Sheets

- `Inputs` - project input values and dropdowns.
- `Results` - calculated limits, checks, and recommended range.
- `Inverters` - embedded starter inverter database.
- `Panels` - embedded starter panel database.

## Current Default Scenario

- Inverter: `SUN-8K-SG01LP1-EU`
- Panel: `JKM575N-72HL4-V`
- Minimum ambient temperature: `-10 C`
- Maximum cell temperature: `70 C`
- Panels per string: `8`
- Strings per MPPT: `1`

## Still To Improve

- Add conditional colors for PASS/FAIL cells.
- Add a compatibility matrix.
- Add separate Vmp temperature coefficient if manufacturer data provides it.
- Verify starter equipment data against latest datasheets.
- Fill datasheet parameters for `model_only_needs_datasheet` inverter records.
- Fill datasheet parameters for `model_only_needs_datasheet` panel records.
- Add regional yield and economics.
