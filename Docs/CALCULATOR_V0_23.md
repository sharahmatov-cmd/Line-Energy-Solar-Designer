# Excel Calculator v0.23

File:

`Excel/Line-Energy-Solar-Calculator-v0.23.xlsx`

## Fixed in v0.23

- Reworked Excel dropdown lists on the `Inputs` sheet.
- Added a `DropdownLists` worksheet with source values for model and option
  selectors.
- Added workbook defined names for dropdown ranges.
- Changed `Inputs` data validation to use named ranges instead of direct
  cross-sheet references.

## Why

Some Excel versions do not reliably show dropdown arrows when data validation
points directly to another worksheet range. Named ranges are more stable.
