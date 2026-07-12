# Equipment Databases

This folder stores structured equipment data used by calculators and future source code.

## Data Status

Each record has a `data_status` field:

- `seed_verify_datasheet` - starter value added for project development; verify against the latest manufacturer datasheet before commercial use.
- `model_only_needs_datasheet` - model name and basic classification are added; electrical parameters must be filled from datasheet before calculator use.
- `verified_datasheet` - checked against a manufacturer datasheet.
- `deprecated` - kept for compatibility or history, not recommended for new designs.

## Folders

- `Inverters` - inverter and hybrid inverter data.
- `Panels` - photovoltaic module data.
- `Batteries` - battery and ESS data.
- `Compatibility` - starter batch scenarios for inverter, panel, and battery screening.
- `Protection` - cable, cable sizing, and electrical protection starter rules.
- `Regions` - solar yield and climate assumptions.
- `Tariffs` - retail electricity price and export / microgeneration tariff assumptions. Retail tariffs should come from regional suppliers/regulators; export prices should be checked through ATS market-price data.
- `Mounting` - mounting system and roof data.
- `Standards` - starter electrical design assumptions for SPD, earthing, and cable derating.
