# Web App v0.1

Folder:

`Web/`

Entry point:

`Web/index.html`

## Added

- Local browser-based solar calculator.
- Input form for region, monthly consumption, roof / ground mount type, panel,
  inverter, battery, self-consumption share, and mounting reserve.
- Premium, Standard, and Economy sizing options.
- Material and work estimate table.
- Monthly generation chart.
- Economics table with retail tariff, export / green tariff, day-night estimate,
  annual savings, and payback.
- PDF export through the browser print dialog.

## Updated

- Material estimate now shows brand plus model for inverter, panel, and battery.
- Added Gobel Power 51.2 V 300 Ah and 314 Ah battery options to the battery
  catalog and web dropdown data.

## Data Source

The web app uses `Web/data.js`, generated from the CSV database by:

`python Source/export_web_data.py`

Regenerate `Web/data.js` after database updates.

## Current Limitations

- PDF export uses browser print / Save as PDF.
- Calculations are draft estimates and require datasheet, roof, wind/snow,
  electrical protection, and tariff verification before a commercial proposal.
