# Tariff Sources

## Retail Electricity Tariff

Use the local electricity supplier or official regional tariff regulator. This is the price the customer pays for consumed electricity.

Examples in the starter table:

- Moscow: `https://www.mosenergosbyt.ru/`
- Saint Petersburg: `https://www.pes.spb.ru/`
- Krasnodar: `https://kuban.tns-e.ru/`
- Rostov-on-Don: `https://rostov.tns-e.ru/`
- Yekaterinburg: `https://ekb.esplus.ru/`

## Export / Green Tariff

Use ATS market-price data:

`https://www.atsenergo.ru/`

This source is used for the export side of the calculation: surplus electricity sold under microgeneration rules. The value must be checked for the correct region, supplier, price zone, and billing period.

## Calculator Rule

Do not use the retail tariff as the export tariff unless the supplier contract explicitly says so. Keep retail consumption savings and export revenue as separate values.
