# Datasheet gaps

Status date: 2026-07-12

This file tracks equipment records that still need manufacturer datasheet values before commercial engineering use.

## Inverters

Current audit:

| Brand | Records | Incomplete records | Missing key fields |
| --- | ---: | ---: | ---: |
| Anenji | 8 | 8 | 72 |
| Deye | 82 | 15 | 135 |
| Growatt | 35 | 35 | 315 |
| MUST | 18 | 18 | 162 |
| PowMr | 13 | 13 | 117 |
| Solis | 28 | 28 | 252 |

Key inverter fields checked:

- max PV input power
- max PV voltage
- startup voltage
- MPPT voltage range
- MPPT count
- strings per MPPT
- max input current per MPPT
- max short-circuit current per MPPT

## Panels

Current audit before the Jinko BDV-F9 update:

| Brand | Records | Incomplete records | Missing key fields |
| --- | ---: | ---: | ---: |
| Astronergy | 8 | 8 | 80 |
| JA Solar | 10 | 10 | 100 |
| Jinko | 14 | 14 | 95 |
| LONGi | 13 | 13 | 85 |
| SunPro | 7 | 7 | 70 |
| Trina | 12 | 12 | 120 |
| Ulica | 8 | 8 | 80 |

Added in this pass:

- Jinko Tiger Neo N-type 72HL4-BDV-F9, 575-600 W, from local PDF `JKM575-600N-72HL4-BDV-F9-EN.pdf`.

Key panel fields checked:

- Pmax
- Vmp
- Imp
- Voc
- Isc
- temperature coefficients
- module dimensions

## Next batches

Recommended order:

1. Finish local Deye PDF extraction for remaining Deye model-only records.
2. Fill Jinko, LONGi, JA Solar, Trina, Astronergy, SunPro, and Ulica panels from official datasheets.
3. Fill Growatt and Solis hybrid inverter datasheets.
4. Fill MUST, PowMr, and Anenji only where official datasheets are available; otherwise keep `model_only_needs_datasheet`.
