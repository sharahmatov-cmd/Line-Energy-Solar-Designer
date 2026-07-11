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
- `Protection` - cable and electrical protection starter rules.
- `Regions` - solar yield and climate assumptions.
- `Tariffs` - electricity price and green tariff assumptions.
- `Mounting` - mounting system and roof data.
