from __future__ import annotations

import csv
import html
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Excel" / "Line-Energy-Solar-Calculator-v0.6.xlsx"


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

    inputs = [
        ["Line-Energy Solar Calculator", "v0.6.0-draft"],
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
    for ref in ["B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13", "B14", "B15", "B16"]:
        input_styles[ref] = 4
    result_styles = range_styles(results)
    for row in range(2, len(results) + 1):
        result_styles[f"B{row}"] = 3

    sheets = [
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
