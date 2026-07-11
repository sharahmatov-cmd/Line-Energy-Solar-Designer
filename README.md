# Line-Energy Solar Designer

Engineering workspace for designing solar power systems: inverter and panel selection, string sizing, regional yield estimates, mounting checks, economics, and proposal documents.

## Project Goal

Create a practical solar design tool that helps select compatible equipment and produce clear calculation outputs for customers and engineers.

## First Milestones

1. Build the project structure and documentation.
2. Add initial inverter and solar panel databases.
3. Create the first working Excel calculator.
4. Add MPPT, Voc, Vmp, and string sizing calculations.
5. Add regional yield, economics, and commercial proposal outputs.

## Main Areas

- Equipment databases: inverters, panels, tariffs, regions, mounting.
- Calculation logic: MPPT limits, string count, voltage windows, temperature corrections.
- Deliverables: Excel calculator, PDF reports, commercial proposals.
- Project control: roadmap, changelog, versioning, and task checklist.

## Current Status

Version: 0.6.0-draft

The repository structure, starter equipment databases, and improved Excel calculator are prepared.

## Current Calculator

The current workbook is available here:

`Excel/Line-Energy-Solar-Calculator-v0.6.xlsx`

It includes dropdown equipment selection, expanded equipment catalogs, battery selection, preliminary electrical checks, recommended panels-per-string range, starter mounting quantities, and a selected-system compatibility summary.

## Data Notice

Starter equipment records are marked with `seed_verify_datasheet`. They are suitable for building and testing the calculator logic, but must be verified against current manufacturer datasheets before commercial engineering use.
