from __future__ import annotations

import csv
import html
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Excel" / "Line-Energy-Solar-Calculator-v0.3.xlsx"


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


def sheet_xml(rows: list[list[object]], formulas: dict[str, str] | None = None) -> str:
    formulas = formulas or {}
    max_col = max((len(row) for row in rows), default=1)
    max_row = len(rows)
    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        f'<dimension ref="A1:{cell_ref(max_row, max_col)}"/>',
        '<sheetViews><sheetView workbookViewId="0"/></sheetViews>',
        '<sheetFormatPr defaultRowHeight="15"/>',
        '<sheetData>',
    ]
    for row_idx, row in enumerate(rows, start=1):
        parts.append(f'<row r="{row_idx}">')
        for col_idx, value in enumerate(row, start=1):
            ref = cell_ref(row_idx, col_idx)
            if ref in formulas:
                parts.append(f'<c r="{ref}"><f>{html.escape(formulas[ref])}</f></c>')
                continue
            if isinstance(value, (int, float)):
                parts.append(f'<c r="{ref}"><v>{value}</v></c>')
                continue
            text = "" if value is None else str(value)
            parts.append(
                f'<c r="{ref}" t="inlineStr"><is><t>{html.escape(text)}</t></is></c>'
            )
        parts.append("</row>")
    parts.extend(
        [
            "</sheetData>",
            '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>',
            "</worksheet>",
        ]
    )
    return "".join(parts)


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
    rels.append("</Relationships>")
    return "".join(rels)


def content_types(sheet_count: int) -> str:
    overrides = [
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
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


def to_number(value: str) -> object:
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    return value


def convert_table(rows: list[list[str]]) -> list[list[object]]:
    return [[to_number(cell) for cell in row] for row in rows]


def build() -> None:
    inverters = convert_table(read_csv(ROOT / "Database" / "Inverters" / "deye_lv_hybrid.csv"))
    jinko = convert_table(read_csv(ROOT / "Database" / "Panels" / "jinko_tiger_neo.csv"))
    longi = convert_table(read_csv(ROOT / "Database" / "Panels" / "longi_himo.csv"))
    panels = [jinko[0], *jinko[1:], *longi[1:]]

    inputs = [
        ["Line-Energy Solar Calculator", "v0.3.0-draft"],
        ["Input", "Value", "Unit", "Notes"],
        ["Inverter model", "SUN-8K-SG01LP1-EU", "", "Must match Inverters!C:C"],
        ["Panel model", "JKM575N-72HL4-V", "", "Must match Panels!C:C"],
        ["Minimum ambient temperature", -10, "C", "Used for cold Voc check"],
        ["Maximum cell temperature", 70, "C", "Used for hot Vmp check"],
        ["Panels per string", 8, "pcs", "Series modules in one string"],
        ["Strings per MPPT", 1, "pcs", "Parallel strings on one tracker"],
        ["Design note", "Starter calculation only", "", "Verify datasheets before commercial use"],
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
        ["Panel Voc temperature coefficient", "", "%/C", "Used for preliminary voltage correction"],
        ["Cold string Voc", "", "V", "Voc at minimum temperature"],
        ["Hot string Vmp", "", "V", "Preliminary Vmp at maximum cell temperature"],
        ["MPPT operating check", "", "", "Hot Vmp must stay inside MPPT window"],
        ["Max voltage check", "", "", "Cold Voc must stay below max PV voltage"],
        ["Current check", "", "", "Parallel string current must stay below MPPT current"],
        ["Overall preliminary status", "", "", "All checks must pass"],
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
        "B14": "B10*(1+(B13/100)*(Inputs!B5-25))*B4",
        "B15": "B11*(1+(B13/100)*(Inputs!B6-25))*B4",
        "B16": 'IF(AND(B15>=B7,B15<=B8),"PASS","FAIL")',
        "B17": 'IF(B14<B6,"PASS","FAIL")',
        "B18": 'IF(B12*B5<=B9,"PASS","FAIL")',
        "B19": 'IF(AND(B16="PASS",B17="PASS",B18="PASS"),"PASS","FAIL")',
    }

    sheets = {
        "Inputs": sheet_xml(inputs),
        "Results": sheet_xml(results, formulas),
        "Inverters": sheet_xml(inverters),
        "Panels": sheet_xml(panels),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as xlsx:
        xlsx.writestr("[Content_Types].xml", content_types(len(sheets)))
        xlsx.writestr("_rels/.rels", root_rels())
        xlsx.writestr("xl/workbook.xml", workbook_xml(list(sheets)))
        xlsx.writestr("xl/_rels/workbook.xml.rels", workbook_rels(len(sheets)))
        for idx, xml in enumerate(sheets.values(), start=1):
            xlsx.writestr(f"xl/worksheets/sheet{idx}.xml", xml)


if __name__ == "__main__":
    build()
