#!/usr/bin/env python3

from pathlib import Path

TARGET = Path(__file__).resolve().parent / "home-browser-lifecycle-contract.mjs"
OLD = "await page.goBack({ waitUntil: 'domcontentloaded' });"
NEW = "await page.goBack({ waitUntil: 'commit' });"

text = TARGET.read_text(encoding="utf-8")
count = text.count(OLD)
if count != 1:
    raise RuntimeError(f"expected exactly one BFCache-incompatible wait, found {count}")
TARGET.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
Path(__file__).unlink()
