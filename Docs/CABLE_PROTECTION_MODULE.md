# Cable and Protection Module

This module adds starter outputs for cables and protection devices.

## Current Items

- PV DC cable red
- PV DC cable black
- PE grounding cable
- DC string fuses
- DC isolator
- DC SPD Type 2
- AC breaker
- AC SPD Type 2
- AC cable
- Battery DC cable pair
- Battery fuse or breaker

## Current Inputs

- DC cable route length
- AC cable route length
- Grounding cable route length
- Installation method
- Cable grouping derating factor
- Ambient temperature derating factor
- Lightning protection condition
- AC earthing system

## Current Logic

- Cable lengths are user inputs.
- DC string fuses are estimated when more than one string is connected per MPPT.
- DC isolator, DC SPD, AC breaker, AC SPD, and battery protection are starter quantities.
- DC cable section is sized from PV operating current with a 4 mm2 starter minimum.
- DC voltage drop is estimated from DC route length, string current, cable section, and hot string Vmp.
- DC string fuse rating is suggested from panel short-circuit current.
- AC current is estimated from inverter output power and single-phase or three-phase output.
- AC cable section and voltage drop are estimated from AC route length and phase type.
- Battery current is estimated from inverter output power and selected battery nominal voltage.
- Battery cable section and breaker rating are suggested as starter values.
- Combined cable derating factor is applied to DC, AC, and battery cable section calculations.
- SPD type is suggested from the selected lightning protection condition.
- Earthing-system checklist output follows the selected AC earthing system.

## Limitation

This is not a final electrical protection design. Cable sections, breaker ratings, fuses, voltage-drop limits, derating factors, SPD type, earthing system, and selectivity must be verified against local electrical standards, inverter manuals, battery manuals, and actual cable routes.
