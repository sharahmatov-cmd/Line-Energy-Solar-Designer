from __future__ import annotations

import csv
import html
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Excel" / "Line-Energy-Solar-Calculator-v0.17.xlsx"


@dataclass
class Sheet:
    name: str
    rows: list[list[object]]
    formulas: dict[str, str] = field(default_factory=dict)
    styles: dict[str, int] = field(default_factory=dict)
    col_widths: dict[int, float] = field(default_factory=dict)
    freeze_cell: str | None = None
    auto_filter: str | None = None
    data_validations: list[str] = field(default_factory=list)
    conditional_formats: list[str] = field(default_factory=list)


def read_csv(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return [row for row in csv.reader(file)]


def col_name(index: int) -> str:
    result = ""
    while index:
        index, rem = divmod(index - 1, 26)
        result = chr(65 + rem) + result
    return result


def cell_ref(row: int, col: int) -> str:
    return f"{col_name(col)}{row}"


def to_number(value: str) -> object:
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    return value


def convert_table(rows: list[list[str]]) -> list[list[object]]:
    return [[to_number(cell) for cell in row] for row in rows]


def read_database_folder(folder: Path) -> list[list[object]]:
    files = sorted(folder.glob("*.csv"))
    merged: list[list[object]] = []
    for file in files:
        rows = convert_table(read_csv(file))
        if not rows:
            continue
        if not merged:
            merged.extend(rows)
        else:
            merged.extend(rows[1:])
    return merged


def cell_xml(ref: str, value: object, formula: str | None, style_id: int | None) -> str:
    style = f' s="{style_id}"' if style_id is not None else ""
    if formula:
        return f'<c r="{ref}"{style}><f>{html.escape(formula)}</f></c>'
    if isinstance(value, (int, float)):
        return f'<c r="{ref}"{style}><v>{value}</v></c>'
    text = "" if value is None else str(value)
    return f'<c r="{ref}" t="inlineStr"{style}><is><t>{html.escape(text)}</t></is></c>'


def cols_xml(widths: dict[int, float]) -> str:
    if not widths:
        return ""
    return "<cols>" + "".join(
        f'<col min="{idx}" max="{idx}" width="{width}" customWidth="1"/>'
        for idx, width in sorted(widths.items())
    ) + "</cols>"


def sheet_views_xml(freeze_cell: str | None) -> str:
    if not freeze_cell:
        return '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
    col_letters = re.sub(r"\d", "", freeze_cell)
    row_number = int(re.sub(r"\D", "", freeze_cell))
    x_split = sum((ord(char) - 64) * (26 ** idx) for idx, char in enumerate(reversed(col_letters))) - 1
    y_split = row_number - 1
    return (
        '<sheetViews><sheetView workbookViewId="0">'
        f'<pane xSplit="{x_split}" ySplit="{y_split}" topLeftCell="{freeze_cell}" '
        'activePane="bottomRight" state="frozen"/>'
        '</sheetView></sheetViews>'
    )


def sheet_xml(sheet: Sheet) -> str:
    max_col = max((len(row) for row in sheet.rows), default=1)
    max_row = len(sheet.rows)
    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        f'<dimension ref="A1:{cell_ref(max_row, max_col)}"/>',
        sheet_views_xml(sheet.freeze_cell),
        '<sheetFormatPr defaultRowHeight="16"/>',
        cols_xml(sheet.col_widths),
        '<sheetData>',
    ]
    for row_idx, row in enumerate(sheet.rows, start=1):
        parts.append(f'<row r="{row_idx}">')
        for col_idx, value in enumerate(row, start=1):
            ref = cell_ref(row_idx, col_idx)
            parts.append(cell_xml(ref, value, sheet.formulas.get(ref), sheet.styles.get(ref)))
        parts.append("</row>")
    parts.append("</sheetData>")
    if sheet.auto_filter:
        parts.append(f'<autoFilter ref="{sheet.auto_filter}"/>')
    if sheet.data_validations:
        parts.append(f'<dataValidations count="{len(sheet.data_validations)}">')
        parts.extend(sheet.data_validations)
        parts.append("</dataValidations>")
    parts.extend(sheet.conditional_formats)
    parts.extend(
        [
            '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>',
            "</worksheet>",
        ]
    )
    return "".join(parts)


def data_validation(cell: str, formula_range: str, title: str, prompt: str) -> str:
    return (
        f'<dataValidation type="list" allowBlank="0" showInputMessage="1" sqref="{cell}" '
        f'promptTitle="{html.escape(title)}" prompt="{html.escape(prompt)}">'
        f'<formula1>{html.escape(formula_range)}</formula1>'
        '</dataValidation>'
    )


def status_conditional_formatting(ranges: list[str]) -> list[str]:
    rules: list[str] = []
    for sqref in ranges:
        rules.append(
            f'<conditionalFormatting sqref="{sqref}">'
            '<cfRule type="cellIs" priority="1" operator="equal" dxfId="0">'
            '<formula>"PASS"</formula>'
            '</cfRule>'
            '<cfRule type="cellIs" priority="2" operator="equal" dxfId="1">'
            '<formula>"FAIL"</formula>'
            '</cfRule>'
            '<cfRule type="cellIs" priority="3" operator="equal" dxfId="2">'
            '<formula>"VERIFY"</formula>'
            '</cfRule>'
            '</conditionalFormatting>'
        )
    return rules


def workbook_xml(sheet_names: list[str]) -> str:
    sheets = "".join(
        f'<sheet name="{html.escape(name)}" sheetId="{idx}" r:id="rId{idx}"/>'
        for idx, name in enumerate(sheet_names, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        "<workbookPr/>"
        "<bookViews><workbookView/></bookViews>"
        f"<sheets>{sheets}</sheets>"
        "</workbook>"
    )


def workbook_rels(sheet_count: int) -> str:
    rels = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ]
    for idx in range(1, sheet_count + 1):
        rels.append(
            f'<Relationship Id="rId{idx}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{idx}.xml"/>'
        )
    rels.append(
        f'<Relationship Id="rId{sheet_count + 1}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
    )
    rels.append("</Relationships>")
    return "".join(rels)


def styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="3">'
        '<font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
        '<font><b/><sz val="14"/><color rgb="FF1F2937"/><name val="Calibri"/></font>'
        '</fonts>'
        '<fills count="5">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>'
        '</fills>'
        '<borders count="2">'
        '<border><left/><right/><top/><bottom/><diagonal/></border>'
        '<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>'
        '</borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="5">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>'
        '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>'
        '</cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '<dxfs count="3">'
        '<dxf><font><b/><color rgb="FF006100"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/></patternFill></fill></dxf>'
        '<dxf><font><b/><color rgb="FF9C0006"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/></patternFill></fill></dxf>'
        '<dxf><font><b/><color rgb="FF9C6500"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFFEB9C"/></patternFill></fill></dxf>'
        '</dxfs>'
        '</styleSheet>'
    )


def content_types(sheet_count: int) -> str:
    overrides = [
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]
    for idx in range(1, sheet_count + 1):
        overrides.append(
            f'<Override PartName="/xl/worksheets/sheet{idx}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        f'{"".join(overrides)}'
        "</Types>"
    )


def root_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )


def range_styles(rows: list[list[object]], header_row: int = 1, title_row: int | None = None) -> dict[str, int]:
    styles: dict[str, int] = {}
    if title_row:
        for col_idx in range(1, len(rows[title_row - 1]) + 1):
            styles[cell_ref(title_row, col_idx)] = 2
    for col_idx in range(1, len(rows[header_row - 1]) + 1):
        styles[cell_ref(header_row, col_idx)] = 1
    return styles


def build() -> None:
    inverters = read_database_folder(ROOT / "Database" / "Inverters")
    panels = read_database_folder(ROOT / "Database" / "Panels")
    mounting_rules = read_database_folder(ROOT / "Database" / "Mounting")
    batteries = read_database_folder(ROOT / "Database" / "Batteries")
    protection_rules = read_database_folder(ROOT / "Database" / "Protection")
    cable_sizing = convert_table(read_csv(ROOT / "Database" / "Protection" / "cable_sizing_rules.csv"))
    spd_rules = convert_table(read_csv(ROOT / "Database" / "Standards" / "spd_selection_rules.csv"))
    earthing_rules = convert_table(read_csv(ROOT / "Database" / "Standards" / "earthing_rules.csv"))
    cable_derating = convert_table(read_csv(ROOT / "Database" / "Standards" / "cable_derating_rules.csv"))
    bulk_scenarios = convert_table(read_csv(ROOT / "Database" / "Compatibility" / "bulk_compatibility_scenarios.csv"))
    regional_yield = convert_table(read_csv(ROOT / "Database" / "Regions" / "regional_yield_assumptions.csv"))
    monthly_yield_profile = convert_table(read_csv(ROOT / "Database" / "Regions" / "monthly_yield_profile.csv"))
    tariffs = convert_table(read_csv(ROOT / "Database" / "Tariffs" / "electricity_tariff_assumptions.csv"))
    option_tiers = convert_table(read_csv(ROOT / "Database" / "Options" / "system_option_tiers.csv"))

    inputs = [
        ["Line-Energy Solar Calculator", "v0.17.0-draft"],
        ["Input", "Value", "Unit", "Notes"],
        ["Inverter model", "SUN-8K-SG01LP1-EU", "", "Choose from dropdown"],
        ["Panel model", "JKM575N-72HL4-V", "", "Choose from dropdown"],
        ["Minimum ambient temperature", -10, "C", "Used for cold Voc check"],
        ["Maximum cell temperature", 70, "C", "Used for hot Vmp check"],
        ["Panels per string", 8, "pcs", "Series modules in one string"],
        ["Strings per MPPT", 1, "pcs", "Parallel strings on one tracker"],
        ["Battery model", "US5000", "", "Choose from dropdown"],
        ["Battery quantity", 2, "pcs", "Used for total battery capacity"],
        ["Roof type", "Metal tile", "", "Choose from dropdown"],
        ["Total panels", 16, "pcs", "Used for mounting quantity calculation"],
        ["Panels per row", 8, "pcs", "Used for row and clamp calculation"],
        ["Rail stock length", 4.2, "m", "Used for rail connector estimate"],
        ["Rail length per panel", 1.15, "m", "Starter assumption; adjust by panel orientation"],
        ["Mounting reserve", 10, "%", "Extra quantity reserve"],
        ["DC cable route length", 30, "m", "One-way route length estimate"],
        ["AC cable route length", 20, "m", "One-way route length estimate"],
        ["Grounding cable route length", 25, "m", "Grounding route length estimate"],
        ["Installation method", "Open air", "", "Used for cable derating notes"],
        ["Cable grouping derating", 1, "factor", "Starter factor; adjust by local rules"],
        ["Ambient temperature derating", 1, "factor", "Starter factor; adjust by local rules"],
        ["Lightning protection system", "No external LPS", "", "Used for SPD type suggestion"],
        ["AC earthing system", "TN-S", "", "Used for earthing checklist"],
        ["Region / tariff zone", "Moscow starter", "", "Choose from tariff database"],
        ["Self-consumption share", 70, "%", "Share of generation consumed on site"],
        ["Installed system cost", 800000, "RUB", "Used for simple payback estimate"],
        ["Tariff source status", "VERIFY", "", "Tariffs must be checked for exact supplier/date"],
        ["Monthly consumption", 1000, "kWh/month", "Customer monthly electricity consumption"],
        ["Target coverage", 70, "%", "Recommended options cover this share of annual consumption"],
        ["Tariff mode", "Single-rate", "", "Single-rate or Day-night comparison"],
        ["Day consumption share", 65, "%", "Used for day-night tariff comparison"],
        ["Day tariff", 9.8, "RUB/kWh", "Starter day tariff; verify supplier/date"],
        ["Night tariff", 3.5, "RUB/kWh", "Starter night tariff; verify supplier/date"],
        ["Design note", "Starter calculation only", "", "Verify datasheets and mounting manuals before commercial use"],
    ]

    results = [
        ["Result", "Value", "Unit", "Formula / meaning"],
        ["Inverter model", "", "", "From Inputs"],
        ["Panel model", "", "", "From Inputs"],
        ["Panels per string", "", "pcs", "From Inputs"],
        ["Strings per MPPT", "", "pcs", "From Inputs"],
        ["Max PV voltage", "", "V", "Inverter absolute PV voltage limit"],
        ["MPPT min voltage", "", "V", "Inverter lower MPPT voltage"],
        ["MPPT max voltage", "", "V", "Inverter upper MPPT voltage"],
        ["Max input current per MPPT", "", "A", "Inverter current limit"],
        ["Panel Voc STC", "", "V", "Open-circuit voltage at STC"],
        ["Panel Vmp STC", "", "V", "Voltage at maximum power at STC"],
        ["Panel Imp STC", "", "A", "Current at maximum power at STC"],
        ["Panel voltage temperature coefficient", "", "%/C", "Preliminary voltage correction"],
        ["Cold Voc per panel", "", "V", "Voc at minimum temperature"],
        ["Hot Vmp per panel", "", "V", "Vmp at maximum cell temperature"],
        ["Cold string Voc", "", "V", "Cold Voc per panel x panels per string"],
        ["Hot string Vmp", "", "V", "Hot Vmp per panel x panels per string"],
        ["Minimum panels per string by MPPT", "", "pcs", "Ceiling of MPPT min / hot Vmp per panel"],
        ["Maximum panels per string by MPPT", "", "pcs", "Floor of MPPT max / hot Vmp per panel"],
        ["Maximum panels per string by PV voltage", "", "pcs", "Floor of max PV voltage / cold Voc per panel"],
        ["Recommended panels per string range", "", "pcs", "Minimum to safest maximum"],
        ["MPPT operating check", "", "", "Hot Vmp must stay inside MPPT window"],
        ["Max voltage check", "", "", "Cold Voc must stay below max PV voltage"],
        ["Current check", "", "", "Parallel string current must stay below MPPT current"],
        ["Overall preliminary status", "", "", "All checks must pass"],
        ["Battery model", "", "", "From Inputs"],
        ["Battery quantity", "", "pcs", "From Inputs"],
        ["Battery nominal energy", "", "kWh", "From Batteries database"],
        ["Total nominal battery energy", "", "kWh", "Battery energy x quantity"],
        ["Battery compatibility note", "", "", "From Batteries database"],
    ]

    formulas = {
        "B2": "Inputs!B3",
        "B3": "Inputs!B4",
        "B4": "Inputs!B7",
        "B5": "Inputs!B8",
        "B6": "INDEX(Inverters!G:G,MATCH(B2,Inverters!C:C,0))",
        "B7": "INDEX(Inverters!I:I,MATCH(B2,Inverters!C:C,0))",
        "B8": "INDEX(Inverters!J:J,MATCH(B2,Inverters!C:C,0))",
        "B9": "INDEX(Inverters!M:M,MATCH(B2,Inverters!C:C,0))",
        "B10": "INDEX(Panels!G:G,MATCH(B3,Panels!C:C,0))",
        "B11": "INDEX(Panels!E:E,MATCH(B3,Panels!C:C,0))",
        "B12": "INDEX(Panels!F:F,MATCH(B3,Panels!C:C,0))",
        "B13": "INDEX(Panels!J:J,MATCH(B3,Panels!C:C,0))",
        "B14": "B10*(1+(B13/100)*(Inputs!B5-25))",
        "B15": "B11*(1+(B13/100)*(Inputs!B6-25))",
        "B16": "B14*B4",
        "B17": "B15*B4",
        "B18": "ROUNDUP(B7/B15,0)",
        "B19": "ROUNDDOWN(B8/B15,0)",
        "B20": "ROUNDDOWN(B6/B14,0)",
        "B21": 'B18&" - "&MIN(B19,B20)',
        "B22": 'IF(AND(B17>=B7,B17<=B8),"PASS","FAIL")',
        "B23": 'IF(B16<B6,"PASS","FAIL")',
        "B24": 'IF(B12*B5<=B9,"PASS","FAIL")',
        "B25": 'IF(AND(B22="PASS",B23="PASS",B24="PASS"),"PASS","FAIL")',
        "B26": "Inputs!B9",
        "B27": "Inputs!B10",
        "B28": "INDEX(Batteries!E:E,MATCH(B26,Batteries!C:C,0))",
        "B29": "B27*B28",
        "B30": "INDEX(Batteries!M:M,MATCH(B26,Batteries!C:C,0))",
    }

    input_styles = range_styles(inputs, header_row=2, title_row=1)
    for ref in ["B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13", "B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21", "B22", "B23", "B24", "B25", "B26", "B27", "B28", "B29", "B30", "B31", "B32", "B33", "B34"]:
        input_styles[ref] = 4
    result_styles = range_styles(results)
    for row in range(2, len(results) + 1):
        result_styles[f"B{row}"] = 3
    bulk_rows = [
        [
            row[0],
            row[1],
            row[2],
            row[3],
            row[4],
            row[5],
            "",
            "",
            "",
            "",
            "",
            "",
            row[6],
        ]
        for row in bulk_scenarios[1:]
    ]

    sheets = [
        Sheet(
            "Summary",
            [
                ["Line-Energy Solar Designer", "v0.17.0-draft", "", ""],
                ["Item", "Value", "Unit", "Status / Note"],
                ["Overall compatibility", "", "", "PASS / FAIL / VERIFY"],
                ["PV electrical status", "", "", "From Results"],
                ["Battery status", "", "", "From Compatibility"],
                ["Datasheet completeness", "", "", "From Compatibility"],
                ["Inverter", "", "", "Selected model"],
                ["Panel", "", "", "Selected model"],
                ["Battery", "", "", "Selected model"],
                ["Panels per string", "", "pcs", "Selected value"],
                ["Recommended string range", "", "pcs", "Calculated range"],
                ["Battery total energy", "", "kWh", "Nominal energy"],
                ["Roof type", "", "", "Selected roof"],
                ["Total panels", "", "pcs", "Mounting input"],
                ["Rows", "", "rows", "Mounting calculation"],
                ["Rails", "", "pcs", "Mounting calculation"],
                ["End clamps", "", "pcs", "Mounting calculation"],
                ["Middle clamps", "", "pcs", "Mounting calculation"],
                ["Grounding clips", "", "pcs", "Mounting calculation"],
                ["Cable clips", "", "pcs", "Mounting calculation"],
                ["Equipment list items", "", "items", "Generated equipment output"],
                ["Protection items", "", "items", "Generated protection output"],
                ["DC cable section", "", "mm2", "Starter sizing"],
                ["AC cable section", "", "mm2", "Starter sizing"],
                ["Battery cable section", "", "mm2", "Starter sizing"],
                ["SPD recommendation", "", "", "Starter protection selection"],
                ["Earthing system", "", "", "Selected AC earthing system"],
                ["Cable derating factor", "", "factor", "Grouping x ambient factors"],
                ["Bulk scenarios", "", "rows", "Mass compatibility table"],
                ["Bulk PASS", "", "rows", "Bulk compatibility count"],
                ["Bulk FAIL", "", "rows", "Bulk compatibility count"],
                ["Bulk VERIFY", "", "rows", "Bulk compatibility count"],
                ["Region", "", "", "Economics input"],
                ["Annual generation", "", "kWh/year", "Regional yield estimate"],
                ["Annual savings", "", "RUB/year", "Self-consumption plus export"],
                ["Simple payback", "", "years", "Installed cost / annual savings"],
                ["Tariff source status", "", "", "Must be verified"],
                ["Monthly consumption", "", "kWh/month", "Customer input"],
                ["Target coverage", "", "%", "Option sizing target"],
                ["Recommended standard size", "", "kWp", "SystemOptions"],
                ["Standard option annual generation", "", "kWh/year", "SystemOptions"],
                ["Standard option payback day-night", "", "years", "SystemOptions"],
                ["Best month generation", "", "kWh/month", "MonthlyGeneration"],
                ["Worst month generation", "", "kWh/month", "MonthlyGeneration"],
                ["Monthly self-consumption value", "", "RUB/year", "MonthlyGeneration"],
                ["Monthly export value", "", "RUB/year", "MonthlyGeneration"],
            ],
            formulas={
                "B3": "Compatibility!B8",
                "B4": "Results!B25",
                "B5": "Compatibility!B6",
                "B6": "Compatibility!B7",
                "B7": "Inputs!B3",
                "B8": "Inputs!B4",
                "B9": "Inputs!B9",
                "B10": "Inputs!B7",
                "B11": "Results!B21",
                "B12": "Results!B29",
                "B13": "Inputs!B11",
                "B14": "Inputs!B12",
                "B15": "Mounting!B5",
                "B16": "Mounting!B13",
                "B17": "Mounting!B15",
                "B18": "Mounting!B16",
                "B19": "Mounting!B18",
                "B20": "Mounting!B19",
                "B21": "COUNTA(Equipment!A2:A35)",
                "B22": "COUNTA(CableProtection!A2:A32)",
                "B23": "CableProtection!B15",
                "B24": "CableProtection!B19",
                "B25": "CableProtection!B24",
                "B26": "CableProtection!B28",
                "B27": "CableProtection!B29",
                "B28": "CableProtection!B30",
                "B29": "COUNTA(BulkCompatibility!A2:A100)",
                "B30": 'COUNTIF(BulkCompatibility!L2:L100,"PASS")',
                "B31": 'COUNTIF(BulkCompatibility!L2:L100,"FAIL")',
                "B32": 'COUNTIF(BulkCompatibility!L2:L100,"VERIFY")',
                "B33": "Economics!B2",
                "B34": "Economics!B8",
                "B35": "Economics!B12",
                "B36": "Economics!B13",
                "B37": "Economics!B15",
                "B38": "Inputs!B29",
                "B39": "Inputs!B30",
                "B40": "SystemOptions!H3",
                "B41": "SystemOptions!K3",
                "B42": "SystemOptions!R3",
                "B43": "MAX(MonthlyGeneration!B2:B13)",
                "B44": "MIN(MonthlyGeneration!B2:B13)",
                "B45": "SUM(MonthlyGeneration!E2:E13)",
                "B46": "SUM(MonthlyGeneration!F2:F13)",
            },
            styles={**range_styles([["Line-Energy Solar Designer", "v0.17.0-draft", "", ""], ["Item", "Value", "Unit", "Status / Note"]], header_row=2, title_row=1), **{f"B{row}": 3 for row in range(3, 47)}},
            col_widths={1: 34, 2: 34, 3: 12, 4: 34},
            freeze_cell="A3",
            conditional_formats=status_conditional_formatting(["B3:B6"]),
        ),
        Sheet(
            "Inputs",
            inputs,
            styles=input_styles,
            col_widths={1: 32, 2: 28, 3: 10, 4: 48},
            freeze_cell="A3",
            data_validations=[
                data_validation("B3", f"Inverters!$C$2:$C${len(inverters)}", "Inverter", "Choose inverter model"),
                data_validation("B4", f"Panels!$C$2:$C${len(panels)}", "Panel", "Choose panel model"),
                data_validation("B9", f"Batteries!$C$2:$C${len(batteries)}", "Battery", "Choose battery model"),
                data_validation("B11", "Metal tile,Standing seam,Trapezoidal sheet,Flat roof,Ground mount", "Roof type", "Choose roof type or ground mount"),
                data_validation("B20", "Open air,Conduit or trunking,Thermal insulation", "Installation method", "Choose cable installation method"),
                data_validation("B23", "No external LPS,External LPS,Overhead supply,Long outdoor DC route", "Lightning protection", "Choose lightning protection condition"),
                data_validation("B24", "TN-S,TN-C-S,TT,IT", "Earthing system", "Choose AC earthing system"),
                data_validation("B25", f"Tariffs!$A$2:$A${len(tariffs)}", "Region", "Choose tariff region"),
                data_validation("B31", "Single-rate,Day-night", "Tariff mode", "Choose tariff comparison mode"),
            ],
        ),
        Sheet(
            "Results",
            results,
            formulas=formulas,
            styles=result_styles,
            col_widths={1: 38, 2: 24, 3: 10, 4: 56},
            freeze_cell="A2",
            conditional_formats=status_conditional_formatting(["B22:B25"]),
        ),
        Sheet(
            "Inverters",
            inverters,
            styles=range_styles(inverters),
            col_widths={1: 16, 2: 18, 3: 24, 18: 52},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(inverters), len(inverters[0]))}",
        ),
        Sheet(
            "Panels",
            panels,
            styles=range_styles(panels),
            col_widths={1: 16, 2: 28, 3: 24, 16: 52},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(panels), len(panels[0]))}",
        ),
        Sheet(
            "Batteries",
            batteries,
            styles=range_styles(batteries),
            col_widths={1: 18, 2: 24, 3: 34, 13: 24, 15: 70},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(batteries), len(batteries[0]))}",
        ),
        Sheet(
            "Mounting",
            [
                ["Mounting quantity", "Value", "Unit", "Formula / meaning"],
                ["Roof type", "", "", "From Inputs"],
                ["Total panels", "", "pcs", "From Inputs"],
                ["Panels per row", "", "pcs", "From Inputs"],
                ["Rows", "", "rows", "Calculated from total panels and panels per row"],
                ["Rail lines", "", "pcs", "Two rail lines per row"],
                ["Estimated rail length", "", "m", "Total panels x rail length per panel x 2"],
                ["Rail joints", "", "pcs", "Estimated from rail length and stock length"],
                ["Reserve", "", "%", "Extra quantity reserve"],
                ["Component", "Quantity", "Unit", "Notes"],
                ["Roof hooks / seam clamps / ground posts", "", "pcs", "Hooks, seam clamps, or ground posts depending on installation type"],
                ["Mini-rails", "", "pcs", "Used for mini-rail roof systems"],
                ["Rails", "", "pcs", "Rail stock pieces"],
                ["Rail connectors", "", "pcs", "Usually two per rail joint"],
                ["End clamps", "", "pcs", "Four per row"],
                ["Middle clamps", "", "pcs", "Two per gap between panels in a row"],
                ["Bolt sets", "", "pcs", "Fastener allowance"],
                ["Grounding clips", "", "pcs", "One per panel starter assumption"],
                ["Cable clips", "", "pcs", "Two per panel starter assumption"],
            ],
            formulas={
                "B2": "Inputs!B11",
                "B3": "Inputs!B12",
                "B4": "Inputs!B13",
                "B5": "ROUNDUP(B3/B4,0)",
                "B6": "B5*2",
                "B7": "B3*Inputs!B15*2",
                "B8": "MAX(0,ROUNDUP(B7/Inputs!B14,0)-B6)",
                "B9": "Inputs!B16",
                "B11": 'ROUNDUP((SUMIFS(MountingRules!D:D,MountingRules!A:A,B2,MountingRules!B:B,"Roof hook")+SUMIFS(MountingRules!D:D,MountingRules!A:A,B2,MountingRules!B:B,"Mini rail clamp")+SUMIFS(MountingRules!E:E,MountingRules!A:A,B2,MountingRules!B:B,"Ground post"))*B3*(1+B9/100),0)',
                "B12": 'ROUNDUP(SUMIFS(MountingRules!D:D,MountingRules!A:A,B2,MountingRules!B:B,"*Mini rail*")*B3*(1+B9/100),0)',
                "B13": "ROUNDUP(B7/Inputs!B12*(1+B9/100),0)",
                "B14": "ROUNDUP(B8*2*(1+B9/100),0)",
                "B15": "ROUNDUP(B5*4*(1+B9/100),0)",
                "B16": "ROUNDUP(MAX(0,(B3-B5)*2)*(1+B9/100),0)",
                "B17": 'ROUNDUP((SUMIFS(MountingRules!D:D,MountingRules!A:A,B2,MountingRules!B:B,"Bolt set")+SUMIFS(MountingRules!D:D,MountingRules!A:A,B2,MountingRules!B:B,"Self-drilling screw set"))*B3*(1+B9/100),0)',
                "B18": "ROUNDUP(B3*(1+B9/100),0)",
                "B19": "ROUNDUP(B3*2*(1+B9/100),0)",
            },
            styles={**range_styles([["Mounting quantity", "Value", "Unit", "Formula / meaning"]]), **{f"B{row}": 3 for row in range(2, 20)}, **{cell_ref(10, col): 1 for col in range(1, 5)}},
            col_widths={1: 30, 2: 16, 3: 10, 4: 60},
            freeze_cell="A2",
        ),
        Sheet(
            "Equipment",
            [
                ["Category", "Item", "Quantity", "Unit", "Notes"],
                ["Inverter", "", 1, "pcs", "Selected inverter"],
                ["Solar panels", "", "", "pcs", "Total panel quantity"],
                ["Battery", "", "", "pcs", "Selected battery quantity"],
                ["Battery energy", "", "", "kWh", "Total nominal battery energy"],
                ["Mounting", "Roof hooks / seam clamps / ground posts", "", "pcs", "From Mounting sheet"],
                ["Mounting", "Mini-rails", "", "pcs", "From Mounting sheet"],
                ["Mounting", "Rails", "", "pcs", "From Mounting sheet"],
                ["Mounting", "Rail connectors", "", "pcs", "From Mounting sheet"],
                ["Mounting", "End clamps", "", "pcs", "From Mounting sheet"],
                ["Mounting", "Middle clamps", "", "pcs", "From Mounting sheet"],
                ["Mounting", "Bolt sets", "", "pcs", "From Mounting sheet"],
                ["Mounting", "Grounding clips", "", "pcs", "From Mounting sheet"],
                ["Mounting", "Cable clips", "", "pcs", "From Mounting sheet"],
                ["Protection", "PV cable red", "", "m", "From CableProtection sheet"],
                ["Protection", "PV cable black", "", "m", "From CableProtection sheet"],
                ["Protection", "PE cable", "", "m", "From CableProtection sheet"],
                ["Protection", "DC string fuses", "", "pcs", "From CableProtection sheet"],
                ["Protection", "DC isolator", "", "pcs", "From CableProtection sheet"],
                ["Protection", "DC SPD Type 2", "", "pcs", "From CableProtection sheet"],
                ["Protection", "AC breaker", "", "pcs", "From CableProtection sheet"],
                ["Protection", "AC SPD Type 2", "", "pcs", "From CableProtection sheet"],
                ["Protection", "AC cable", "", "m", "From CableProtection sheet"],
                ["Protection", "Battery DC cable pair", "", "pair", "From CableProtection sheet"],
                ["Protection", "Battery fuse or breaker", "", "pcs", "From CableProtection sheet"],
                ["Sizing", "Recommended DC cable section", "", "mm2", "Starter sizing; verify installation method"],
                ["Sizing", "DC voltage drop", "", "%", "Starter voltage-drop estimate"],
                ["Sizing", "Recommended AC cable section", "", "mm2", "Starter sizing; verify installation method"],
                ["Sizing", "AC voltage drop", "", "%", "Starter voltage-drop estimate"],
                ["Sizing", "Recommended battery cable section", "", "mm2", "Starter sizing; verify installation method"],
                ["Sizing", "Estimated battery current", "", "A", "Inverter power / battery voltage"],
                ["Sizing", "Cable derating factor", "", "factor", "Grouping x ambient derating"],
                ["Protection", "Recommended SPD type", "", "", "Starter selection; verify local standards"],
                ["Protection", "AC earthing system", "", "", "Selected earthing checklist"],
                ["Documentation", "Datasheet verification", 1, "task", "Required before commercial use"],
            ],
            formulas={
                "B2": "Inputs!B3",
                "B3": "Inputs!B4",
                "C3": "Inputs!B12",
                "B4": "Inputs!B9",
                "C4": "Inputs!B10",
                "B5": 'Inputs!B9&" total nominal energy"',
                "C5": "Results!B29",
                "C6": "Mounting!B11",
                "C7": "Mounting!B12",
                "C8": "Mounting!B13",
                "C9": "Mounting!B14",
                "C10": "Mounting!B15",
                "C11": "Mounting!B16",
                "C12": "Mounting!B17",
                "C13": "Mounting!B18",
                "C14": "Mounting!B19",
                "C15": "CableProtection!B2",
                "C16": "CableProtection!B3",
                "C17": "CableProtection!B4",
                "C18": "CableProtection!B5",
                "C19": "CableProtection!B6",
                "C20": "CableProtection!B7",
                "C21": "CableProtection!B8",
                "C22": "CableProtection!B9",
                "C23": "CableProtection!B10",
                "C24": "CableProtection!B11",
                "C25": "CableProtection!B12",
                "C26": "CableProtection!B15",
                "C27": "CableProtection!B16",
                "C28": "CableProtection!B19",
                "C29": "CableProtection!B20",
                "C30": "CableProtection!B24",
                "C31": "CableProtection!B23",
                "C32": "CableProtection!B30",
                "C33": "CableProtection!B28",
                "C34": "CableProtection!B29",
            },
            styles={**range_styles([["Category", "Item", "Quantity", "Unit", "Notes"]]), **{f"C{row}": 3 for row in range(2, 35)}},
            col_widths={1: 18, 2: 42, 3: 14, 4: 10, 5: 52},
            freeze_cell="A2",
            auto_filter="A1:E35",
        ),
        Sheet(
            "CableProtection",
            [
                ["Cable / Protection item", "Quantity", "Unit", "Formula / meaning"],
                ["PV cable red", "", "m", "DC cable route length"],
                ["PV cable black", "", "m", "DC cable route length"],
                ["PE cable", "", "m", "Grounding route length"],
                ["DC string fuses", "", "pcs", "Used when strings per MPPT > 1"],
                ["DC isolator", "", "pcs", "Starter quantity"],
                ["DC SPD Type 2", "", "pcs", "Starter quantity"],
                ["AC breaker", "", "pcs", "Starter quantity; rating must be selected"],
                ["AC SPD Type 2", "", "pcs", "Starter quantity"],
                ["AC cable", "", "m", "AC cable route length"],
                ["Battery DC cable pair", "", "pair", "Starter quantity"],
                ["Battery fuse or breaker", "", "pcs", "Starter quantity; rating must be selected"],
                ["Protection design status", "", "", "VERIFY until ratings and cable sections are selected"],
                [],
                ["Sizing result", "Value", "Unit", "Formula / meaning"],
                ["Recommended DC cable section", "", "mm2", "Based on PV operating current"],
                ["DC voltage drop", "", "%", "2 x length x current x copper resistance / section / voltage"],
                ["Suggested DC fuse rating", "", "A", "Based on string short-circuit current"],
                ["Estimated AC current", "", "A", "Based on inverter AC power and phase"],
                ["Recommended AC cable section", "", "mm2", "Based on estimated AC current"],
                ["AC voltage drop", "", "%", "Starter single/three-phase voltage-drop estimate"],
                ["Suggested AC breaker rating", "", "A", "Next common rating above AC current"],
                ["Estimated battery current", "", "A", "AC power / battery nominal voltage"],
                ["Recommended battery cable section", "", "mm2", "Based on estimated battery current"],
                ["Suggested battery breaker rating", "", "A", "Next common rating above battery current"],
                ["Sizing status", "", "", "VERIFY until local standards and datasheets are checked"],
                [],
                ["Advanced protection result", "Value", "Unit", "Formula / meaning"],
                ["Recommended SPD type", "", "", "Based on selected lightning protection condition"],
                ["AC earthing system", "", "", "Selected earthing system checklist"],
                ["Combined cable derating factor", "", "factor", "Grouping derating x ambient derating"],
                ["Derated DC cable ampacity", "", "A", "Selected DC cable ampacity after derating"],
                ["Advanced protection status", "", "", "VERIFY until local standards are checked"],
            ],
            formulas={
                "B2": "Inputs!B17",
                "B3": "Inputs!B17",
                "B4": "Inputs!B19",
                "B5": "IF(Inputs!B8>1,Inputs!B8*2,0)",
                "B6": "1",
                "B7": "1",
                "B8": "1",
                "B9": "1",
                "B10": "Inputs!B18",
                "B11": "1",
                "B12": "1",
                "B13": '"VERIFY"',
                "B15": "MAX(4,LOOKUP((Results!B12*Inputs!B8)/B30,CableSizing!B:B,CableSizing!A:A))",
                "B16": "ROUND(2*Inputs!B17*Results!B12*Inputs!B8*0.0175/(B15*Results!B17)*100,2)",
                "B17": "LOOKUP(INDEX(Panels!H:H,MATCH(Inputs!B4,Panels!C:C,0))*1.25,{0,16,20,25,32},{16,20,25,32,40})",
                "B18": 'ROUND(INDEX(Inverters!E:E,MATCH(Inputs!B3,Inverters!C:C,0))/IF(INDEX(Inverters!D:D,MATCH(Inputs!B3,Inverters!C:C,0))="three-phase",692.8,230),1)',
                "B19": "MAX(2.5,LOOKUP(B18/B30,CableSizing!B:B,CableSizing!A:A))",
                "B20": 'ROUND(IF(INDEX(Inverters!D:D,MATCH(Inputs!B3,Inverters!C:C,0))="three-phase",1.732*Inputs!B18*B18*0.0175/(B19*400)*100,2*Inputs!B18*B18*0.0175/(B19*230)*100),2)',
                "B21": "LOOKUP(B18*1.25,{0,16,20,25,32,40,50,63,80,100,125,160},{16,20,25,32,40,50,63,80,100,125,160,200})",
                "B23": "ROUND(INDEX(Inverters!E:E,MATCH(Inputs!B3,Inverters!C:C,0))/INDEX(Batteries!G:G,MATCH(Inputs!B9,Batteries!C:C,0)),1)",
                "B24": "MAX(16,LOOKUP(B23/B30,CableSizing!B:B,CableSizing!A:A))",
                "B25": "LOOKUP(B23*1.25,{0,63,80,100,125,160,200,250},{63,80,100,125,160,200,250,315})",
                "B26": '"VERIFY"',
                "B28": 'IF(Inputs!B23="External LPS","Type 1+2 DC/AC SPD",IF(Inputs!B23="Overhead supply","Type 1+2 AC SPD + Type 2 DC SPD",IF(Inputs!B23="Long outdoor DC route","Type 2 DC SPD near inverter and array","Type 2 DC/AC SPD")))',
                "B29": "Inputs!B24",
                "B30": "MAX(0.1,Inputs!B21*Inputs!B22)",
                "B31": "INDEX(CableSizing!B:B,MATCH(B15,CableSizing!A:A,0))*B30",
                "B32": '"VERIFY"',
            },
            styles={**range_styles([["Cable / Protection item", "Quantity", "Unit", "Formula / meaning"]]), **{cell_ref(14, col): 1 for col in range(1, 5)}, **{cell_ref(27, col): 1 for col in range(1, 5)}, **{f"B{row}": 3 for row in list(range(2, 14)) + list(range(15, 27)) + list(range(28, 33))}},
            col_widths={1: 32, 2: 16, 3: 10, 4: 64},
            freeze_cell="A2",
            conditional_formats=status_conditional_formatting(["B13", "B26", "B32"]),
        ),
        Sheet(
            "BulkCompatibility",
            [
                ["Scenario", "Inverter", "Panel", "Battery", "Panels/string", "Strings/MPPT", "Cold string Voc", "Hot string Vmp", "PV voltage", "PV current", "Battery", "Overall", "Notes"],
                *bulk_rows,
            ],
            formulas={
                **{
                    f"G{row}": f"ROUND(INDEX(Panels!G:G,MATCH(C{row},Panels!C:C,0))*(1+(INDEX(Panels!J:J,MATCH(C{row},Panels!C:C,0))/100)*(Inputs!B5-25))*E{row},1)"
                    for row in range(2, len(bulk_scenarios) + 1)
                },
                **{
                    f"H{row}": f"ROUND(INDEX(Panels!E:E,MATCH(C{row},Panels!C:C,0))*(1+(INDEX(Panels!J:J,MATCH(C{row},Panels!C:C,0))/100)*(Inputs!B6-25))*E{row},1)"
                    for row in range(2, len(bulk_scenarios) + 1)
                },
                **{
                    f"I{row}": f"IF(OR(INDEX(Inverters!Q:Q,MATCH(B{row},Inverters!C:C,0))=\"model_only_needs_datasheet\",INDEX(Panels!O:O,MATCH(C{row},Panels!C:C,0))=\"model_only_needs_datasheet\"),\"VERIFY\",IF(AND(G{row}<INDEX(Inverters!G:G,MATCH(B{row},Inverters!C:C,0)),H{row}>=INDEX(Inverters!I:I,MATCH(B{row},Inverters!C:C,0)),H{row}<=INDEX(Inverters!J:J,MATCH(B{row},Inverters!C:C,0))),\"PASS\",\"FAIL\"))"
                    for row in range(2, len(bulk_scenarios) + 1)
                },
                **{
                    f"J{row}": f"IF(OR(INDEX(Inverters!Q:Q,MATCH(B{row},Inverters!C:C,0))=\"model_only_needs_datasheet\",INDEX(Panels!O:O,MATCH(C{row},Panels!C:C,0))=\"model_only_needs_datasheet\"),\"VERIFY\",IF(INDEX(Panels!F:F,MATCH(C{row},Panels!C:C,0))*F{row}<=INDEX(Inverters!M:M,MATCH(B{row},Inverters!C:C,0)),\"PASS\",\"FAIL\"))"
                    for row in range(2, len(bulk_scenarios) + 1)
                },
                **{
                    f"K{row}": f"IF(ISNUMBER(SEARCH(\"Deye\",INDEX(Batteries!M:M,MATCH(D{row},Batteries!C:C,0)))),\"PASS\",\"VERIFY\")"
                    for row in range(2, len(bulk_scenarios) + 1)
                },
                **{
                    f"L{row}": f"IF(OR(I{row}=\"FAIL\",J{row}=\"FAIL\"),\"FAIL\",IF(OR(I{row}=\"VERIFY\",J{row}=\"VERIFY\",K{row}=\"VERIFY\",INDEX(Inverters!Q:Q,MATCH(B{row},Inverters!C:C,0))=\"model_only_needs_datasheet\",INDEX(Panels!O:O,MATCH(C{row},Panels!C:C,0))=\"model_only_needs_datasheet\",INDEX(Batteries!N:N,MATCH(D{row},Batteries!C:C,0))=\"model_only_needs_datasheet\"),\"VERIFY\",\"PASS\"))"
                    for row in range(2, len(bulk_scenarios) + 1)
                },
            },
            styles={**range_styles([["Scenario", "Inverter", "Panel", "Battery", "Panels/string", "Strings/MPPT", "Cold string Voc", "Hot string Vmp", "PV voltage", "PV current", "Battery", "Overall", "Notes"]]), **{f"G{row}": 3 for row in range(2, len(bulk_scenarios) + 1)}, **{f"H{row}": 3 for row in range(2, len(bulk_scenarios) + 1)}, **{f"I{row}": 3 for row in range(2, len(bulk_scenarios) + 1)}, **{f"J{row}": 3 for row in range(2, len(bulk_scenarios) + 1)}, **{f"K{row}": 3 for row in range(2, len(bulk_scenarios) + 1)}, **{f"L{row}": 3 for row in range(2, len(bulk_scenarios) + 1)}},
            col_widths={1: 26, 2: 28, 3: 24, 4: 22, 5: 14, 6: 14, 7: 16, 8: 16, 9: 14, 10: 14, 11: 14, 12: 14, 13: 68},
            freeze_cell="A2",
            auto_filter=f"A1:M{len(bulk_scenarios)}",
            conditional_formats=status_conditional_formatting([f"I2:L{len(bulk_scenarios)}"]),
        ),
        Sheet(
            "Economics",
            [
                ["Economics", "Value", "Unit", "Formula / meaning"],
                ["Region / tariff zone", "", "", "From Inputs"],
                ["Selected panel power", "", "W", "From Panels database"],
                ["Total panel count", "", "pcs", "From Inputs"],
                ["PV system size", "", "kWp", "Panel power x total panels"],
                ["Specific yield", "", "kWh/kWp/year", "From Regions database"],
                ["Performance ratio", 0.85, "factor", "Starter system loss factor"],
                ["Annual generation", "", "kWh/year", "PV size x yield x performance ratio"],
                ["Retail tariff", "", "RUB/kWh", "From Tariffs database"],
                ["Export / green tariff", "", "RUB/kWh", "Starter microgeneration purchase value"],
                ["Self-consumption share", "", "%", "From Inputs"],
                ["Annual savings", "", "RUB/year", "Self-consumed value plus exported value"],
                ["Simple payback", "", "years", "Installed cost / annual savings"],
                ["Installed system cost", "", "RUB", "From Inputs"],
                ["Tariff source status", "", "", "VERIFY until supplier/date is checked"],
                ["Retail tariff source", "", "", "Source URL"],
                ["Export tariff source", "", "", "Source URL"],
                ["Monthly consumption", "", "kWh/month", "From Inputs"],
                ["Annual consumption", "", "kWh/year", "Monthly consumption x 12"],
                ["Target annual coverage", "", "kWh/year", "Annual consumption x target coverage"],
                ["Day-night blended tariff", "", "RUB/kWh", "Day share x day tariff plus night share x night tariff"],
                ["Estimated current annual cost", "", "RUB/year", "Annual consumption x retail tariff"],
                ["Estimated day-night annual cost", "", "RUB/year", "Annual consumption x blended day-night tariff"],
                ["Potential day-night saving before PV", "", "RUB/year", "Current cost minus day-night cost"],
            ],
            formulas={
                "B2": "Inputs!B25",
                "B3": "INDEX(Panels!D:D,MATCH(Inputs!B4,Panels!C:C,0))",
                "B4": "Inputs!B12",
                "B5": "B3*B4/1000",
                "B6": "INDEX(Regions!B:B,MATCH(B2,Regions!A:A,0))",
                "B8": "ROUND(B5*B6*B7,0)",
                "B9": "INDEX(Tariffs!B:B,MATCH(B2,Tariffs!A:A,0))",
                "B10": "INDEX(Tariffs!C:C,MATCH(B2,Tariffs!A:A,0))",
                "B11": "Inputs!B26",
                "B12": "ROUND(B8*(B11/100)*B9+B8*(1-B11/100)*B10,0)",
                "B13": "IF(B12>0,ROUND(B14/B12,1),\"\")",
                "B14": "Inputs!B27",
                "B15": "Inputs!B28",
                "B16": "INDEX(Tariffs!D:D,MATCH(B2,Tariffs!A:A,0))",
                "B17": "INDEX(Tariffs!E:E,MATCH(B2,Tariffs!A:A,0))",
                "B18": "Inputs!B29",
                "B19": "B18*12",
                "B20": "B19*Inputs!B30/100",
                "B21": "Inputs!B33*(Inputs!B32/100)+Inputs!B34*(1-Inputs!B32/100)",
                "B22": "B19*B9",
                "B23": "B19*B21",
                "B24": "MAX(0,B22-B23)",
            },
            styles={**range_styles([["Economics", "Value", "Unit", "Formula / meaning"]]), **{f"B{row}": 3 for row in range(2, 25)}},
            col_widths={1: 30, 2: 34, 3: 16, 4: 72},
            freeze_cell="A2",
            conditional_formats=status_conditional_formatting(["B15"]),
        ),
        Sheet(
            "SystemOptions",
            [
                ["Option", "Quality", "Cost per kWp", "Service life", "Degradation", "Required annual generation", "Required kWp", "Recommended kWp", "Panels", "Daily generation", "Monthly generation", "Annual generation", "Coverage", "Estimated cost", "Single-rate savings", "Day-night savings", "Green tariff export revenue", "Payback day-night", "Notes"],
                ["Premium", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Higher allowance; verify commercial offer"],
                ["Standard", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Balanced default option"],
                ["Economy", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Lower cost allowance; verify warranties"],
            ],
            formulas={
                **{f"B{row}": f"INDEX(OptionTiers!B:B,MATCH(A{row},OptionTiers!A:A,0))" for row in range(2, 5)},
                **{f"C{row}": f"INDEX(OptionTiers!C:C,MATCH(A{row},OptionTiers!A:A,0))" for row in range(2, 5)},
                **{f"D{row}": f"INDEX(OptionTiers!D:D,MATCH(A{row},OptionTiers!A:A,0))" for row in range(2, 5)},
                **{f"E{row}": f"INDEX(OptionTiers!E:E,MATCH(A{row},OptionTiers!A:A,0))" for row in range(2, 5)},
                **{f"F{row}": "Economics!B20" for row in range(2, 5)},
                **{f"G{row}": f"F{row}/Economics!B6/Economics!B7" for row in range(2, 5)},
                **{f"H{row}": f"ROUNDUP(G{row}*1000/INDEX(Panels!D:D,MATCH(Inputs!B4,Panels!C:C,0)),0)*INDEX(Panels!D:D,MATCH(Inputs!B4,Panels!C:C,0))/1000" for row in range(2, 5)},
                **{f"I{row}": f"ROUNDUP(G{row}*1000/INDEX(Panels!D:D,MATCH(Inputs!B4,Panels!C:C,0)),0)" for row in range(2, 5)},
                **{f"J{row}": f"ROUND(L{row}/365,1)" for row in range(2, 5)},
                **{f"K{row}": f"ROUND(L{row}/12,0)" for row in range(2, 5)},
                **{f"L{row}": f"ROUND(H{row}*Economics!B6*Economics!B7,0)" for row in range(2, 5)},
                **{f"M{row}": f"ROUND(L{row}/Economics!B19*100,0)" for row in range(2, 5)},
                **{f"N{row}": f"ROUND(H{row}*C{row},0)" for row in range(2, 5)},
                **{f"O{row}": f"ROUND(L{row}*(Inputs!B26/100)*Economics!B9+L{row}*(1-Inputs!B26/100)*Economics!B10,0)" for row in range(2, 5)},
                **{f"P{row}": f"ROUND(L{row}*(Inputs!B26/100)*Economics!B21+L{row}*(1-Inputs!B26/100)*Economics!B10+Economics!B24,0)" for row in range(2, 5)},
                **{f"Q{row}": f"ROUND(L{row}*(1-Inputs!B26/100)*Economics!B10,0)" for row in range(2, 5)},
                **{f"R{row}": f"IF(P{row}>0,ROUND(N{row}/P{row},1),\"\")" for row in range(2, 5)},
            },
            styles={**range_styles([["Option", "Quality", "Cost per kWp", "Service life", "Degradation", "Required annual generation", "Required kWp", "Recommended kWp", "Panels", "Daily generation", "Monthly generation", "Annual generation", "Coverage", "Estimated cost", "Single-rate savings", "Day-night savings", "Green tariff export revenue", "Payback day-night", "Notes"]]), **{cell_ref(row, col): 3 for row in range(2, 5) for col in range(2, 19)}},
            col_widths={1: 16, 2: 14, 3: 16, 4: 14, 5: 14, 6: 24, 7: 16, 8: 16, 9: 10, 10: 18, 11: 20, 12: 20, 13: 12, 14: 16, 15: 18, 16: 18, 17: 24, 18: 18, 19: 54},
            freeze_cell="A2",
            conditional_formats=status_conditional_formatting([]),
        ),
        Sheet(
            "Lifetime",
            [
                ["Year", "Premium generation", "Standard generation", "Economy generation", "Premium cumulative", "Standard cumulative", "Economy cumulative"],
                *[[year, "", "", "", "", "", ""] for year in range(0, 21)],
            ],
            formulas={
                **{f"B{row}": f"ROUND(SystemOptions!L2*(1-SystemOptions!E2/100)^A{row},0)" for row in range(2, 23)},
                **{f"C{row}": f"ROUND(SystemOptions!L3*(1-SystemOptions!E3/100)^A{row},0)" for row in range(2, 23)},
                **{f"D{row}": f"ROUND(SystemOptions!L4*(1-SystemOptions!E4/100)^A{row},0)" for row in range(2, 23)},
                **{f"E{row}": f"SUM(B$2:B{row})" for row in range(2, 23)},
                **{f"F{row}": f"SUM(C$2:C{row})" for row in range(2, 23)},
                **{f"G{row}": f"SUM(D$2:D{row})" for row in range(2, 23)},
            },
            styles={**range_styles([["Year", "Premium generation", "Standard generation", "Economy generation", "Premium cumulative", "Standard cumulative", "Economy cumulative"]]), **{cell_ref(row, col): 3 for row in range(2, 23) for col in range(2, 8)}},
            col_widths={1: 10, 2: 20, 3: 20, 4: 20, 5: 20, 6: 20, 7: 20},
            freeze_cell="A2",
        ),
        Sheet(
            "OptionTiers",
            option_tiers,
            styles=range_styles(option_tiers),
            col_widths={1: 16, 2: 16, 3: 18, 4: 18, 5: 18, 6: 72},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(option_tiers), len(option_tiers[0]))}",
        ),
        Sheet(
            "MonthlyGeneration",
            [
                ["Month", "Generation", "Consumption", "Self-consumed", "Self-consumption value", "Exported", "Export value", "Total value", "Coverage"],
                ["Jan", "", "", "", "", "", "", "", ""],
                ["Feb", "", "", "", "", "", "", "", ""],
                ["Mar", "", "", "", "", "", "", "", ""],
                ["Apr", "", "", "", "", "", "", "", ""],
                ["May", "", "", "", "", "", "", "", ""],
                ["Jun", "", "", "", "", "", "", "", ""],
                ["Jul", "", "", "", "", "", "", "", ""],
                ["Aug", "", "", "", "", "", "", "", ""],
                ["Sep", "", "", "", "", "", "", "", ""],
                ["Oct", "", "", "", "", "", "", "", ""],
                ["Nov", "", "", "", "", "", "", "", ""],
                ["Dec", "", "", "", "", "", "", "", ""],
                ["Total", "", "", "", "", "", "", "", ""],
            ],
            formulas={
                **{f"B{row}": f"ROUND(SystemOptions!L3*INDEX(MonthlyYieldProfile!{col_name(row)}:{col_name(row)},MATCH(Inputs!B25,MonthlyYieldProfile!A:A,0))/100,0)" for row in range(2, 14)},
                **{f"C{row}": "Inputs!B29" for row in range(2, 14)},
                **{f"D{row}": f"MIN(B{row},C{row},B{row}*Inputs!B26/100)" for row in range(2, 14)},
                **{f"E{row}": f"ROUND(D{row}*Economics!B21,0)" for row in range(2, 14)},
                **{f"F{row}": f"MAX(0,B{row}-D{row})" for row in range(2, 14)},
                **{f"G{row}": f"ROUND(F{row}*Economics!B10,0)" for row in range(2, 14)},
                **{f"H{row}": f"E{row}+G{row}" for row in range(2, 14)},
                **{f"I{row}": f"ROUND(B{row}/C{row}*100,0)" for row in range(2, 14)},
                "B14": "SUM(B2:B13)",
                "C14": "SUM(C2:C13)",
                "D14": "SUM(D2:D13)",
                "E14": "SUM(E2:E13)",
                "F14": "SUM(F2:F13)",
                "G14": "SUM(G2:G13)",
                "H14": "SUM(H2:H13)",
                "I14": "ROUND(B14/C14*100,0)",
            },
            styles={**range_styles([["Month", "Generation", "Consumption", "Self-consumed", "Self-consumption value", "Exported", "Export value", "Total value", "Coverage"]]), **{cell_ref(row, col): 3 for row in range(2, 15) for col in range(2, 10)}},
            col_widths={1: 12, 2: 16, 3: 16, 4: 16, 5: 22, 6: 14, 7: 16, 8: 16, 9: 12},
            freeze_cell="A2",
        ),
        Sheet(
            "MonthlyYieldProfile",
            monthly_yield_profile,
            styles=range_styles(monthly_yield_profile),
            col_widths={1: 26, 14: 22, 15: 78},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(monthly_yield_profile), len(monthly_yield_profile[0]))}",
        ),
        Sheet(
            "CableSizing",
            cable_sizing,
            styles=range_styles(cable_sizing),
            col_widths={1: 14, 2: 14, 3: 74},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(cable_sizing), len(cable_sizing[0]))}",
        ),
        Sheet(
            "ProtectionRules",
            protection_rules,
            styles=range_styles(protection_rules),
            col_widths={1: 30, 2: 20, 5: 26, 6: 74},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(protection_rules), len(protection_rules[0]))}",
        ),
        Sheet(
            "SpdRules",
            spd_rules,
            styles=range_styles(spd_rules),
            col_widths={1: 28, 2: 34, 3: 78},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(spd_rules), len(spd_rules[0]))}",
        ),
        Sheet(
            "EarthingRules",
            earthing_rules,
            styles=range_styles(earthing_rules),
            col_widths={1: 18, 2: 34, 3: 78},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(earthing_rules), len(earthing_rules[0]))}",
        ),
        Sheet(
            "CableDerating",
            cable_derating,
            styles=range_styles(cable_derating),
            col_widths={1: 24, 2: 28, 3: 16, 4: 78},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(cable_derating), len(cable_derating[0]))}",
        ),
        Sheet(
            "MountingRules",
            mounting_rules,
            styles=range_styles(mounting_rules),
            col_widths={1: 22, 2: 28, 10: 72},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(mounting_rules), len(mounting_rules[0]))}",
        ),
        Sheet(
            "Regions",
            regional_yield,
            styles=range_styles(regional_yield),
            col_widths={1: 26, 2: 24, 3: 42, 4: 22, 5: 78},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(regional_yield), len(regional_yield[0]))}",
        ),
        Sheet(
            "Tariffs",
            tariffs,
            styles=range_styles(tariffs),
            col_widths={1: 26, 2: 20, 3: 22, 4: 42, 5: 42, 6: 22, 7: 78},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(tariffs), len(tariffs[0]))}",
        ),
        Sheet(
            "Compatibility",
            [
                ["Compatibility Matrix", "Status", "Reason", "Source"],
                ["Selected inverter", "", "", "Inputs"],
                ["Selected panel", "", "", "Inputs"],
                ["Selected battery", "", "", "Inputs"],
                ["PV voltage/current", "", "", "Results"],
                ["Battery compatibility", "", "", "Batteries"],
                ["Data completeness", "", "", "Databases"],
                ["Overall compatibility", "", "", "Combined result"],
                [],
                ["Check", "Status", "Reason", "Next action"],
                ["Cold Voc vs max PV voltage", "", "", "Adjust panels per string or inverter"],
                ["Hot Vmp vs MPPT range", "", "", "Adjust panels per string"],
                ["Panel current vs MPPT current", "", "", "Adjust strings per MPPT or inverter"],
                ["Battery protocol", "", "", "Verify CAN/RS485 settings"],
                ["Required datasheet data", "", "", "Fill missing database fields"],
            ],
            formulas={
                "B2": "Inputs!B3",
                "B3": "Inputs!B4",
                "B4": "Inputs!B9",
                "B5": "Results!B25",
                "C5": 'IF(B5="PASS","PV voltage/current checks pass","PV voltage/current check failed")',
                "B6": 'IF(ISNUMBER(SEARCH("Deye",Results!B30)),"PASS",IF(ISNUMBER(SEARCH("compatible",Results!B30)),"VERIFY","VERIFY"))',
                "C6": "Results!B30",
                "B7": 'IF(OR(INDEX(Inverters!Q:Q,MATCH(B2,Inverters!C:C,0))="model_only_needs_datasheet",INDEX(Panels!O:O,MATCH(B3,Panels!C:C,0))="model_only_needs_datasheet",INDEX(Batteries!N:N,MATCH(B4,Batteries!C:C,0))="model_only_needs_datasheet"),"VERIFY","PASS")',
                "C7": 'IF(B7="VERIFY","One or more selected records need datasheet parameters","Selected records have starter or verified data")',
                "B8": 'IF(B5="FAIL","FAIL",IF(OR(B6="VERIFY",B7="VERIFY"),"VERIFY","PASS"))',
                "C8": 'IF(B8="PASS","Selected system is preliminarily compatible",IF(B8="FAIL","Selected system fails at least one electrical check","Selected system needs datasheet verification"))',
                "B11": "Results!B23",
                "C11": 'IF(B11="PASS","Cold string Voc is below inverter max PV voltage","Cold string Voc exceeds inverter max PV voltage")',
                "B12": "Results!B22",
                "C12": 'IF(B12="PASS","Hot string Vmp is inside MPPT range","Hot string Vmp is outside MPPT range")',
                "B13": "Results!B24",
                "C13": 'IF(B13="PASS","Panel current is within MPPT current limit","Panel current exceeds MPPT current limit")',
                "B14": "B6",
                "C14": "Results!B30",
                "B15": "B7",
                "C15": "C7",
            },
            styles={**range_styles([["Compatibility Matrix", "Status", "Reason", "Source"]]), **{cell_ref(10, col): 1 for col in range(1, 5)}, **{f"B{row}": 3 for row in [2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15]}},
            col_widths={1: 34, 2: 16, 3: 72, 4: 34},
            freeze_cell="A2",
            conditional_formats=status_conditional_formatting(["B5:B8", "B11:B15"]),
        ),
    ]

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as xlsx:
        xlsx.writestr("[Content_Types].xml", content_types(len(sheets)))
        xlsx.writestr("_rels/.rels", root_rels())
        xlsx.writestr("xl/workbook.xml", workbook_xml([sheet.name for sheet in sheets]))
        xlsx.writestr("xl/_rels/workbook.xml.rels", workbook_rels(len(sheets)))
        xlsx.writestr("xl/styles.xml", styles_xml())
        for idx, sheet in enumerate(sheets, start=1):
            xlsx.writestr(f"xl/worksheets/sheet{idx}.xml", sheet_xml(sheet))


if __name__ == "__main__":
    build()
