# Excel Calculator v0.21

File:

`Excel/Line-Energy-Solar-Calculator-v0.21.xlsx`

## Added in v0.21

- Added local datasheet-derived parameters for 9 Deye three-phase grid
  `G06P3` models:
  - `SUN-4K-G06P3-EU-BM2-P1`
  - `SUN-5K-G06P3-EU-BM2-P1`
  - `SUN-6K-G06P3-EU-BM2-P1`
  - `SUN-7K-G06P3-EU-BM2-P1`
  - `SUN-8K-G06P3-EU-BM2-P1`
  - `SUN-9K-G06P3-EU-BM2-P1`
  - `SUN-10K-G06P3-EU-BM2-P1`
  - `SUN-12K-G06P3-EU-BM2-P1`
  - `SUN-15K-G06P3-EU-BM2-P1`
- Filled PV input power, max PV voltage, startup voltage, MPPT voltage range,
  MPPT count, string layout, MPPT input current, and short-circuit current.

## Source PDF

- `SUN-_3-15_K-G06P3-EU-BM2_RU.pdf`

## Review Note

The catalog rows use suffix `BM2-P1`, while the readable local PDF uses suffix
`BM2`. These rows are marked `datasheet_local_pdf_suffix_review` so they can be
used for draft calculations, but the exact suffix should be checked before a
commercial proposal.

Rows still marked `model_only_needs_datasheet` after this pass do not have a
clean matching local datasheet in the current folders.
