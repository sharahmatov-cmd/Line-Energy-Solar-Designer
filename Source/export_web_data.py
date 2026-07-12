from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "Web"
OUTPUT = WEB_DIR / "data.js"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def read_folder(folder: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in sorted(folder.glob("*.csv")):
        if path.name == ".gitkeep":
            continue
        rows.extend(read_csv(path))
    return rows


def main() -> None:
    data = {
        "inverters": read_folder(ROOT / "Database" / "Inverters"),
        "panels": read_folder(ROOT / "Database" / "Panels"),
        "batteries": read_folder(ROOT / "Database" / "Batteries"),
        "regions": read_csv(ROOT / "Database" / "Regions" / "regional_yield_assumptions.csv"),
        "monthlyProfiles": read_csv(ROOT / "Database" / "Regions" / "monthly_yield_profile.csv"),
        "tariffs": read_csv(ROOT / "Database" / "Tariffs" / "electricity_tariff_assumptions.csv"),
        "optionTiers": read_csv(ROOT / "Database" / "Options" / "system_option_tiers.csv"),
        "mountingRules": read_folder(ROOT / "Database" / "Mounting"),
    }
    WEB_DIR.mkdir(exist_ok=True)
    OUTPUT.write_text(
        "window.SOLAR_DATA = "
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
