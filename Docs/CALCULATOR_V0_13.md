# Excel Calculator v0.13

File:

`Excel/Line-Energy-Solar-Calculator-v0.13.xlsx`

## Added in v0.13

- `Economics` sheet.
- `Regions` sheet with starter regional yield assumptions.
- `Tariffs` sheet with starter retail and export tariff assumptions.
- Inputs for region / tariff zone, self-consumption share, installed system cost, and tariff source status.
- Annual generation estimate.
- Annual savings estimate from self-consumed energy plus exported energy.
- Simple payback estimate.
- Summary outputs for region, annual generation, annual savings, payback, and tariff verification status.

## Source Policy

Tariff values are volatile and depend on region, supplier, voltage group, meter type, date, and microgeneration purchase rules. The current rows are starter assumptions marked `seed_verify_source`. Before commercial use, replace them with values from the exact supplier, regulator, or market-price source for the project date.

Use separate sources for the two tariff types:

- Retail tariff: the local electricity supplier or official regional tariff regulator.
- Export / green tariff: ATS market-price data at `https://www.atsenergo.ru/`, where microgeneration surplus purchase price assumptions should be checked for the required period.
