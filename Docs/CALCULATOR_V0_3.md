# Excel Calculator v0.3

File:

`Excel/Line-Energy-Solar-Calculator-v0.3.xlsx`

## Sheets

- `Inputs` - user input values for inverter, panel, temperature, panels per string, and strings per MPPT.
- `Results` - calculated voltage, current, and compatibility checks.
- `Inverters` - embedded starter inverter database.
- `Panels` - embedded starter panel database.

## Current Checks

- Cold string Voc against inverter maximum PV voltage.
- Hot string Vmp against inverter MPPT voltage range.
- String current against inverter maximum MPPT input current.
- Overall preliminary pass/fail status.

## Current Default Scenario

- Inverter: `SUN-8K-SG01LP1-EU`
- Panel: `JKM575N-72HL4-V`
- Minimum ambient temperature: `-10 C`
- Maximum cell temperature: `70 C`
- Panels per string: `8`
- Strings per MPPT: `1`

## Limitations

- Starter data must be verified against current manufacturer datasheets.
- Vmp temperature correction is preliminary and currently uses the available voltage temperature coefficient.
- No data validation dropdowns yet.
- No regional yield or economics yet.
- No PDF or commercial proposal output yet.
