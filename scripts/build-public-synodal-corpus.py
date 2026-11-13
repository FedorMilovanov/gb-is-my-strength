#!/usr/bin/env python3
"""Reproduce the public-domain eBible RUSSYN verse corpus used by inline tips.

Input: the unmodified eBible RUSSYN USFX release, downloaded from
https://ebible.org/Scriptures/russyn_usfx.zip
Publication metadata: https://ebible.org/find/details.php?id=russyn
Never import the repository's separate RIGHTS_UNKNOWN / Kassian editions.
"""
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE_URL = "https://ebible.org/Scriptures/russyn_usfx.zip"
SOURCE_SHA256 = "acd200046b4a4cb9bca8ca375544bc9d58ae10dc64f1862a2b7b73e225931a77"
BOOK_CODES = """GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV""".split()
# Drop annotations, cross-references and headings; never blend a footnote's
# commentary into the canonical Bible verse.
SKIP = {"f", "x", "note", "fig", "s", "h", "toc", "id", "rem", "cl", "cp", "r", "ms", "mr", "mt", "d", "sp", "qa", "lit", "ide"}
SPACES = re.compile(r"\s+")


def generate(source: Path, root: Path) -> dict:
    actual = hashlib.sha256(source.read_bytes()).hexdigest()
    if actual != SOURCE_SHA256:
        raise ValueError(f"Upstream ZIP SHA-256 mismatch: {actual}")
    registry = json.loads((root / "data/bible/books.json").read_text(encoding="utf-8"))
    ids = list(registry["books"])
    if len(ids) != 66 or len(BOOK_CODES) != 66:
        raise ValueError("Canonical 66-book registry/source mapping changed")
    mapping = dict(zip(BOOK_CODES, ids))
    if mapping["GEN"] != "bytie" or mapping["MAT"] != "matfeya" or mapping["REV"] != "otkrovenie":
        raise ValueError("Unexpected canonical book order")
    with zipfile.ZipFile(source) as archive:
        xml = archive.read("russyn_usfx.xml")
    bible = ET.fromstring(xml)
    output = {}
    for book in bible.findall("book"):
        code = book.get("id", "")
        if code not in mapping:
            raise ValueError(f"Unexpected book code {code}")
        verses = {}
        current_key = None

        def record(text: str):
            if current_key and text:
                verses[current_key].append(text)

        def walk(element):
            nonlocal current_key
            tag = element.tag.rsplit("}", 1)[-1]
            if tag == "c":
                current_key = None
            elif tag == "v":
                bcv = element.get("bcv", "")
                pieces = bcv.split(".")
                if len(pieces) != 3 or pieces[0] != code or not pieces[1].isdigit() or not pieces[2].isdigit():
                    raise ValueError(f"Invalid verse marker {bcv}")
                current_key = f"{int(pieces[1])}:{int(pieces[2])}"
                if current_key in verses:
                    raise ValueError(f"Duplicate canonical verse {code} {current_key}")
                verses[current_key] = []
            elif tag not in SKIP:
                record(element.text or "")
                for child in element:
                    child_tag = child.tag.rsplit("}", 1)[-1]
                    if child_tag not in SKIP:
                        walk(child)
                    record(child.tail or "")
        walk(book)
        joined = {key: SPACES.sub(" ", "".join(value)).strip() for key, value in verses.items()}
        blanks = [k for k, text in joined.items() if not text]
        if blanks:
            raise ValueError(f"Empty verses for {code}: {blanks[:6]}")
        output[code] = joined
    if set(output) != set(BOOK_CODES):
        raise ValueError(f"Missing books: {set(BOOK_CODES) - set(output)}")
    total = sum(len(x) for x in output.values())
    if not 29000 < total < 33000:
        raise ValueError(f"Unexpected canonical verse count {total}")
    sample = output["GEN"]["1:1"]
    if not ("Бог" in sample and "землю" in sample):
        raise ValueError("Failed GEN 1:1 witness")
    return {
        "_meta": {
            "translation": "Синодальный перевод (RUSSYN)",
            "source": "eBible.org RUSSYN, 2022-11-25",
            "sourceUrl": "https://ebible.org/find/details.php?id=russyn",
            "downloadUrl": SOURCE_URL,
            "zipSHA256": actual,
            "rights": "Public Domain (eBible RUSSYN)",
            "rightsState": "PUBLICATION_ELIGIBLE",
            "publicationState": "PUBLICATION_APPROVED",
            "books": len(output),
            "verses": total,
            "bookIds": mapping,
        },
        "books": output
    }


if __name__ == "__main__":
    base = Path(__file__).resolve().parents[1]
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else base / "evidence/russyn_usfx.zip"
    target = base / "data/bible/public-domain-russyn.json"
    payload = generate(source, base)
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("RUSSYN_BUILD_OK", payload["_meta"]["books"], payload["_meta"]["verses"], target.stat().st_size, target)
