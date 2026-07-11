# Database Fields

## Inverter Fields

- `brand` - manufacturer.
- `series` - product series.
- `model` - exact model name.
- `phase` - single-phase or three-phase.
- `nominal_ac_power_w` - nominal AC output power.
- `max_pv_input_power_w` - maximum recommended PV array power.
- `max_pv_voltage_v` - absolute maximum PV open-circuit voltage.
- `startup_voltage_v` - inverter startup PV voltage.
- `mppt_voltage_min_v` - lower MPPT operating voltage.
- `mppt_voltage_max_v` - upper MPPT operating voltage.
- `mppt_count` - number of independent MPPT trackers.
- `strings_per_mppt` - input strings per MPPT tracker.
- `max_input_current_per_mppt_a` - maximum operating input current per MPPT.
- `max_short_circuit_current_per_mppt_a` - maximum short-circuit current per MPPT.
- `battery_nominal_voltage_v` - nominal battery voltage.
- `battery_voltage_range_v` - allowed battery voltage range.
- `data_status` - verification status.
- `notes` - engineering notes.

## Panel Fields

- `brand` - manufacturer.
- `series` - product series.
- `model` - exact model name.
- `power_stc_w` - module power at STC.
- `vmp_stc_v` - voltage at maximum power at STC.
- `imp_stc_a` - current at maximum power at STC.
- `voc_stc_v` - open-circuit voltage at STC.
- `isc_stc_a` - short-circuit current at STC.
- `temp_coeff_pmax_pct_c` - power temperature coefficient.
- `temp_coeff_voc_pct_c` - Voc temperature coefficient.
- `temp_coeff_isc_pct_c` - Isc temperature coefficient.
- `module_length_mm` - module length.
- `module_width_mm` - module width.
- `module_depth_mm` - module frame depth.
- `data_status` - verification status.
- `notes` - engineering notes.

## Battery Fields

- `brand` - manufacturer or supplier brand.
- `series` - product series.
- `model` - exact model or catalog name.
- `chemistry` - battery chemistry, for example LiFePO4.
- `nominal_energy_kwh` - nominal energy capacity.
- `usable_energy_kwh` - usable energy when known.
- `nominal_voltage_v` - nominal battery voltage.
- `capacity_ah` - nominal amp-hour capacity.
- `cycle_life_min` - lower stated cycle-life value.
- `cycle_life_max` - upper stated cycle-life value.
- `communication` - supported communication interfaces.
- `bms` - BMS type or note.
- `compatibility` - compatibility note.
- `data_status` - verification status.
- `notes` - engineering notes.
