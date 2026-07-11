# Excel Calculator v0.6

File:

`Excel/Line-Energy-Solar-Calculator-v0.6.xlsx`

## Added in v0.6

- `Compatibility` sheet.
- Selected inverter, panel, and battery compatibility summary.
- PV electrical status from existing Voc, Vmp, and MPPT current checks.
- Battery compatibility status based on database compatibility notes.
- Data completeness status based on `data_status`.
- Overall `PASS`, `FAIL`, or `VERIFY` status.

## Status Meaning

- `PASS` - starter calculation passes and selected records do not require immediate datasheet completion.
- `FAIL` - at least one electrical check fails.
- `VERIFY` - available data is not complete enough for a commercial engineering decision.

## Current Limitation

The matrix currently evaluates the selected configuration. Full bulk matrix generation across many inverter, panel, and battery combinations is planned for the next iteration after key datasheet fields are filled.
