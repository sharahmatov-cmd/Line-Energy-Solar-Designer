# Changelog

All notable project changes will be documented here.

## Web App v0.1 - 2026-07-12

- Added local web calculator in `Web/`.
- Added CSV-to-web data export script.
- Added Premium, Standard, and Economy web sizing.
- Added material/work estimate, monthly generation chart, economics summary, and browser PDF export.
- Updated web estimate display to show brand plus model for inverter, panel, and battery.
- Added Gobel Power 300 Ah and 314 Ah battery options.
- Hidden payback outputs for hybrid inverter stations; payback remains visible for grid stations.
- Added manual price inputs for panel, inverter, and battery in the web app.
- Added price and subtotal columns to the web material estimate.
- Improved web PDF export by generating an in-page printable report with explicit print and back buttons.
- Expanded web region data with starter yield profiles and tariff placeholders for 20 additional Russian regions.
- Added commercial-offer-template cost assumptions for mounting, cable, DC protection, delivery, and installation work.
- Updated web estimate totals to use template cost assumptions plus manual equipment price overrides.
- Removed Premium / Standard / Economy options from both the PDF report and the main web screen.
- Added inverter/panel compatibility recommendations with maximum panels per MPPT and datasheet warnings.
- Added roof tilt and roof orientation inputs with a draft yield correction factor.
- Added string count input and string-count checks in compatibility recommendations.
- Added selected panel technical data table to the web calculator and PDF report.
- Added visible panel-to-inverter selection formulas to compatibility recommendations.
- Added winter generation and winter coverage calculations for December-February.
- Made estimate quantities and prices editable, with automatic totals and economics recalculation.
- Split the estimate into Material, Delivery and unloading, and Work sections.
- Added two roof-slope inputs with tilt, orientation, connection type, share of panels, and strings per MPPT checks.
- Made the web input panel more compact with inline labels and controls.
- Grouped short web inputs into two-column rows to reduce long single-line controls.
- Added selectable roof slope count with dynamic 1-4 slope input cards.
- Reworked equipment inputs into compact model-plus-price rows and added manual battery quantity override.
- Added panel quantity per roof slope and removed separate row-count/string-count inputs from the main form.
- Added safe recalculation handlers for both input and change events with visible error feedback.
- Split inverter selection into manufacturer, inverter type, phase count, and filtered model controls.
- Improved PDF report styling for a cleaner commercial proposal draft.

## 0.23.0-draft - 2026-07-12

- Fixed `Inputs` dropdown compatibility for Excel.
- Added `DropdownLists` sheet and workbook defined names for validation lists.
- Rebuilt Excel calculator as v0.23.

## 0.22.0-draft - 2026-07-12

- Added Russian workbook labels while preserving English terms in parentheses.
- Kept sheet names, formulas, equipment models, dropdown values, and PASS/FAIL/VERIFY statuses stable.
- Added Excel calculator v0.22 documentation.
- Rebuilt Excel calculator as v0.22.

## 0.21.0-draft - 2026-07-12

- Added local datasheet-derived parameters for 9 Deye G06P3 three-phase grid inverter models.
- Marked G06P3 rows with suffix review because the readable local PDF is BM2 while catalog rows are BM2-P1.
- Added Excel calculator v0.21 documentation.
- Rebuilt Excel calculator as v0.21.

## 0.20.0-draft - 2026-07-12

- Added local datasheet verification for 8 Deye single-phase grid inverter models.
- Added Excel calculator v0.20 documentation.
- Rebuilt Excel calculator as v0.20.

## 0.19.0-draft - 2026-07-12

- Added local datasheet verification for 14 Deye high-voltage three-phase hybrid inverter models.
- Added Excel calculator v0.19 documentation.
- Rebuilt Excel calculator as v0.19.

## 0.18.0-draft - 2026-07-12

- Added local datasheet verification for 13 Deye three-phase grid inverter models.
- Added Excel calculator v0.18 documentation.
- Rebuilt Excel calculator as v0.18.

## 0.17.0-draft - 2026-07-12

- Added local datasheet verification for Deye SUN-14/16/18K-SG01LP1-EU-AM3-P models.
- Added Excel calculator v0.17 documentation.
- Rebuilt Excel calculator as v0.17.

## 0.16.0-draft - 2026-07-12

- Added local datasheet verification for 16 Deye hybrid inverter models.
- Updated Deye inverter PV voltage, MPPT, string, current, and battery ranges from downloaded local PDFs.
- Added Excel calculator v0.16 documentation.
- Rebuilt Excel calculator as v0.16.

## 0.15.0-draft - 2026-07-12

- Added monthly yield profile database.
- Added MonthlyYieldProfile sheet to Excel.
- Added MonthlyGeneration sheet to Excel.
- Added monthly generation, consumption, self-consumption, export, and value calculations.
- Added best/worst month and yearly monthly-value summaries.
- Added Excel calculator v0.15 documentation.

## 0.14.0-draft - 2026-07-12

- Added monthly consumption and target coverage inputs.
- Added day-night tariff comparison inputs.
- Added ground mount option to mounting rules.
- Added Premium, Standard, and Economy option tiers.
- Added SystemOptions sheet with automatic option sizing.
- Added daily, monthly, and annual generation per option.
- Added green/export revenue and day-night payback comparison.
- Added Lifetime sheet with 20-year panel degradation.
- Added Excel calculator v0.14 documentation.

## 0.13.1-draft - 2026-07-12

- Clarified tariff source policy.
- Marked ATS as the source for export / microgeneration price verification.
- Added tariff source documentation.

## 0.13.0-draft - 2026-07-12

- Added regional yield assumptions database.
- Added retail and export tariff assumptions database.
- Added Economics sheet to Excel.
- Added region, self-consumption, installed cost, and tariff source status inputs.
- Added annual generation, annual savings, and simple payback calculations.
- Added economics outputs to Summary.
- Added Excel calculator v0.13 documentation.

## 0.12.0-draft - 2026-07-12

- Added Compatibility database folder.
- Added starter bulk compatibility scenario table.
- Added BulkCompatibility sheet to Excel.
- Added batch PV voltage, PV current, battery, and overall compatibility statuses.
- Added PASS, FAIL, and VERIFY counts to Summary.
- Added Excel calculator v0.12 documentation.

## 0.11.0-draft - 2026-07-12

- Added Standards database folder for starter electrical design rules.
- Added SpdRules, EarthingRules, and CableDerating sheets to Excel.
- Added inputs for installation method, derating factors, lightning protection condition, and AC earthing system.
- Added starter SPD type recommendation.
- Added earthing-system checklist output.
- Applied combined cable derating factor to DC, AC, and battery cable sizing.
- Added Excel calculator v0.11 documentation.

## 0.10.0-draft - 2026-07-12

- Added CableSizing database.
- Added recommended DC, AC, and battery cable section calculations.
- Added DC and AC voltage-drop estimates.
- Added suggested DC fuse, AC breaker, and battery breaker ratings.
- Added cable sizing outputs to Summary and Equipment.
- Added Excel calculator v0.10 documentation.

## 0.9.0-draft - 2026-07-12

- Added CableProtection sheet to Excel.
- Added ProtectionRules database.
- Added starter cable and protection quantities.
- Added protection items to Equipment output.
- Added Excel calculator v0.9 documentation.

## 0.8.0-draft - 2026-07-12

- Added Equipment sheet to Excel.
- Added basic bill of materials output.
- Added selected inverter, panels, battery, and mounting quantities.
- Added equipment item count to Summary.
- Added Excel calculator v0.8 documentation.

## 0.7.0-draft - 2026-07-12

- Added Summary sheet as the first workbook screen.
- Added selected-system overview.
- Added mounting and battery summary values.
- Added conditional formatting for PASS, FAIL, and VERIFY statuses.
- Added Excel calculator v0.7 documentation.

## 0.6.0-draft - 2026-07-12

- Added Compatibility sheet to Excel.
- Added selected inverter, panel, and battery compatibility summary.
- Added PASS, FAIL, and VERIFY status logic.
- Added data completeness check based on database record status.
- Added Excel calculator v0.6 documentation.

## 0.5.1-draft - 2026-07-11

- Added battery catalog for Pylontech, Dyness, Deye ESS, Gobel Power, GSL Energy, Felicity ESS, HinaESS, and selected OEM suppliers.
- Added Batteries sheet to Excel.
- Added battery model and battery quantity inputs.
- Added total nominal battery energy calculation.
- Added battery module documentation.

## 0.5.0-draft - 2026-07-11

- Added mounting rules database for roof mounting components.
- Added mounting calculation sheet to Excel.
- Added automatic quantities for hooks, mini-rails, rails, connectors, clamps, bolt sets, grounding clips, and cable clips.
- Added roof type, panel count, row layout, rail length, and reserve inputs.
- Added mounting module documentation.

## 0.4.4-draft - 2026-07-11

- Added expanded solar panel model catalogs for Jinko, LONGi, JA Solar, Trina, Astronergy, SunPro, and Ulica.
- Updated Excel generator to merge all panel CSV files.
- Rebuilt Excel v0.4 so expanded panel catalog appears in the panel dropdown.

## 0.4.3-draft - 2026-07-11

- Added Growatt hybrid and battery-ready inverter model catalog.
- Added Solis hybrid inverter model catalog.
- Rebuilt Excel v0.4 so Growatt and Solis models appear in the inverter dropdown.

## 0.4.2-draft - 2026-07-11

- Added MUST hybrid inverter model catalog.
- Added PowMr hybrid inverter model catalog.
- Added Anenji hybrid inverter model catalog.
- Rebuilt Excel v0.4 so the expanded inverter catalog appears in the inverter dropdown.

## 0.4.1-draft - 2026-07-11

- Added 78 Deye inverter catalog models supplied by the user.
- Added hybrid LV, hybrid HV, single-phase grid, and three-phase grid Deye model groups.
- Updated Excel generator to merge all inverter CSV files.
- Updated Excel inverter dropdown to include the expanded Deye catalog.

## 0.4.0-draft - 2026-07-11

- Added Excel dropdowns for inverter and panel selection.
- Added basic workbook styling, frozen rows, and database filters.
- Added recommended panels-per-string range.
- Added min and max string sizing formulas.
- Added Excel calculator v0.4 documentation.

## 0.3.0-draft - 2026-07-11

- Added first Excel calculator workbook.
- Added workbook generator script.
- Added input, result, inverter, and panel sheets.
- Added preliminary Voc, Vmp, MPPT range, max voltage, and current checks.
- Added calculator documentation.

## 0.2.0-draft - 2026-07-11

- Added first Deye low-voltage hybrid inverter database.
- Added first Jinko Tiger Neo panel database.
- Added first LONGi Hi-MO panel database.
- Added database README and field documentation.
- Marked starter records as requiring datasheet verification before commercial use.

## 0.1.0-draft - 2026-07-11

- Created initial project documentation.
- Defined first roadmap.
- Added project checklist.
- Added folder structure placeholders.
