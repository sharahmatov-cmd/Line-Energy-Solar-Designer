# Excel Calculator v0.12

File:

`Excel/Line-Energy-Solar-Calculator-v0.12.xlsx`

## Added in v0.12

- `BulkCompatibility` sheet for checking several inverter, panel, and battery combinations at once.
- `Database/Compatibility/bulk_compatibility_scenarios.csv` with starter scenarios.
- Batch cold string Voc calculation.
- Batch hot string Vmp calculation.
- Batch PV voltage status.
- Batch PV current status.
- Batch battery compatibility status.
- Batch overall `PASS`, `FAIL`, and `VERIFY` status.
- Summary counts for total scenarios, `PASS`, `FAIL`, and `VERIFY`.

## Current Limitation

The bulk matrix is a fast screening table, not a final design approval. Rows marked `VERIFY` usually need datasheet parameters or a manual protocol check. Final system selection must still use verified inverter, panel, and battery datasheets.
