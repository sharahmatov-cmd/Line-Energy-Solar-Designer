from __future__ import annotations

import csv
import html
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Excel" / "Line-Energy-Solar-Calculator-v0.9.xlsx"


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

    inputs = [
        ["Line-Energy Solar Calculator", "v0.9.0-draft"],
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
    for ref in ["B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13", "B14", "B15", "B16", "B17", "B18", "B19"]:
        input_styles[ref] = 4
    result_styles = range_styles(results)
    for row in range(2, len(results) + 1):
        result_styles[f"B{row}"] = 3

    sheets = [
        Sheet(
            "Summary",
            [
                ["Line-Energy Solar Designer", "v0.9.0-draft", "", ""],
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
                "B21": "COUNTA(Equipment!A2:A30)",
                "B22": "COUNTA(CableProtection!A2:A20)",
            },
            styles={**range_styles([["Line-Energy Solar Designer", "v0.9.0-draft", "", ""], ["Item", "Value", "Unit", "Status / Note"]], header_row=2, title_row=1), **{f"B{row}": 3 for row in range(3, 23)}},
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
                data_validation("B11", "Metal tile,Standing seam,Trapezoidal sheet,Flat roof", "Roof type", "Choose roof type"),
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
                ["Roof hooks / seam clamps", "", "pcs", "Hooks or seam clamps depending on roof type"],
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
                "B11": 'ROUNDUP((SUMIFS(MountingRules!D:D,MountingRules!A:A,B2,MountingRules!B:B,"Roof hook")+SUMIFS(MountingRules!D:D,MountingRules!A:A,B2,MountingRules!B:B,"Mini rail clamp"))*B3*(1+B9/100),0)',
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
                ["Mounting", "Roof hooks / seam clamps", "", "pcs", "From Mounting sheet"],
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
            },
            styles={**range_styles([["Category", "Item", "Quantity", "Unit", "Notes"]]), **{f"C{row}": 3 for row in range(2, 26)}},
            col_widths={1: 18, 2: 42, 3: 14, 4: 10, 5: 52},
            freeze_cell="A2",
            auto_filter="A1:E26",
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
            },
            styles={**range_styles([["Cable / Protection item", "Quantity", "Unit", "Formula / meaning"]]), **{f"B{row}": 3 for row in range(2, 14)}},
            col_widths={1: 32, 2: 16, 3: 10, 4: 64},
            freeze_cell="A2",
            conditional_formats=status_conditional_formatting(["B13"]),
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
            "MountingRules",
            mounting_rules,
            styles=range_styles(mounting_rules),
            col_widths={1: 22, 2: 28, 10: 72},
            freeze_cell="A2",
            auto_filter=f"A1:{cell_ref(len(mounting_rules), len(mounting_rules[0]))}",
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
