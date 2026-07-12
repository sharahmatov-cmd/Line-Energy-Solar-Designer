# Excel Calculator v0.16

File:

`Excel/Line-Energy-Solar-Calculator-v0.16.xlsx`

## Added in v0.16

- Added local datasheet verification for 16 Deye hybrid inverter models.
- Updated Deye LV single-phase models from local PDF:
  `SUN-_3.6-10_K-SG05LP1-EU-AM2-P_RU.pdf`.
- Updated Deye LV single-phase 10/12 kW models from local PDF:
  `SUN-_7.6-12_K-SG02LP1-EU-AM2-P_RU.pdf`.
- Updated Deye LV three-phase 5-12 kW models from local PDF:
  `SUN-_3-12_K-SG05LP3-EU-SM2_RU.pdf`.
- Updated Deye LV three-phase 14-20 kW models from local PDF:
  `SUN-_14-20_K-SG05LP3-EU-SM2_RU.pdf`.
- Filled PV input power, max PV voltage, startup voltage, MPPT voltage range,
  MPPT count, string layout, MPPT current, short-circuit current, and battery
  voltage range where the local datasheets were readable.

## Current Limitation

Only the models marked `datasheet_local_pdf_verified` have been checked against
the downloaded local PDFs. Other Deye rows remain catalog placeholders until
their datasheets are parsed and reviewed.
