#!/usr/bin/env python3
"""Read actual Journal PDFs; emulated print DOM alone cannot prove pagination.

Requires PyMuPDF in the selected Python environment; never installs or skips it.
Used by journal-editorial-browser.mjs --suite=print (and full Chromium suite).
An optional earlier capture also checks text, typography and unaffected geometry.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata

try:
    import fitz
except ImportError as error:
    raise SystemExit("Journal PDF checks require PyMuPDF; select --pdf-python or configure PYTHONPATH.") from error

ROOT = Path(__file__).resolve().parents[2]
PAPER_POINTS = {"A4": (595.28, 841.89), "Letter": (612, 792)}


def resolve(value):
    item = Path(value)
    return item if item.is_absolute() else ROOT / item


def normalize(text, *, fold=False):
    value = re.sub(r"\s+|\u00ad", "", unicodedata.normalize("NFKC", text))
    return value.casefold() if fold else value


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def key(case):
    return (case["kind"], case["paper"], case["theme"], case["javaScriptEnabled"])


def inspect(case):
    with fitz.open(resolve(case["pdf"])) as document:
        texts = [page.get_text(sort=True) for page in document]
        folded = [normalize(text, fold=True) for text in texts]
        sizes = [[round(page.rect.width, 2), round(page.rect.height, 2)] for page in document]
        typography, geometry = [], []
        for page in document:
            styled, positioned = [], []
            for block in page.get_text("rawdict", sort=True)["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        style = (span["font"], round(span["size"], 4), span["flags"], span["color"])
                        for char in span["chars"]:
                            for letter in normalize(char["c"]):
                                token = [letter, *style]
                                styled.append(token)
                                positioned.append([*token, *[round(v, 3) for v in char["bbox"]]])
            typography.extend(styled)
            geometry.append(positioned)
    dom = case["dom"]
    all_text = "".join(folded)
    companion = dom.get("companion")
    locations = {part: [i + 1 for i, text in enumerate(folded) if normalize(companion[part], fold=True) in text]
                 for part in ("label", "title")} if companion else None
    expected_size = PAPER_POINTS[case["paper"]]
    return {
        "pages": len(texts), "pageSizes": sizes,
        # Chromium rounds paper dimensions to device pixels (less than 1.1pt).
        "paperSizeCorrect": bool(sizes) and all(abs(size[i] - expected_size[i]) < 1.1 for size in sizes for i in (0, 1)),
        "allPagesHaveText": bool(texts) and all(text.strip() for text in texts),
        "headingFirstPage": bool(folded) and normalize(dom["heading"], fold=True) in folded[0],
        "sourceTitles": len(dom["sourceTitles"]),
        "missingSourceTitles": [title for title in dom["sourceTitles"] if normalize(title, fold=True) not in all_text],
        "printedScreenControls": [label for label in dom.get("screenOnlyLabels", []) if normalize(label, fold=True) in all_text],
        "reviewWarningFirstPage": bool(folded) and normalize(dom["reviewWarning"], fold=True) in folded[0] if dom.get("reviewWarning") else None,
        "holdPrinted": "publication_hold" in all_text,
        "companionPages": locations,
        "companionTogether": locations is None or len(locations["label"]) == len(locations["title"]) == 1 and locations["label"] == locations["title"],
        # Ignore pagination/whitespace, not words, case, numerals, fonts or sizes.
        "textSha256": digest(normalize("".join(texts))),
        "typographySha256": digest(typography),
        "pageGeometrySha256": digest(geometry),
    }


def analyze(capture, baseline=None):
    cases = capture["cases"]
    before = {key(case): case for case in baseline["cases"]} if baseline else {}
    problems, results = [], []
    kinds = {case["kind"] for case in cases}
    expected = {(kind, paper, theme, scripting) for kind in kinds for paper in PAPER_POINTS
                for theme in ("light", "dark") for scripting in (True, False)}
    if not {"journal", "dossier"} <= kinds <= {"journal", "dossier", "history"}:
        problems.append("expected public Journal/dossier and optional held history surfaces")
    if len(cases) != len(expected) or {key(case) for case in cases} != expected:
        problems.append("missing or duplicate print matrix cases")
    if baseline and (len(before) != len(baseline["cases"]) or set(before) != expected):
        problems.append("baseline must have exactly the same unique matrix cases")
    for case in cases:
        result = {name: case[name] for name in ("kind", "paper", "theme", "javaScriptEnabled", "pdf")}
        failures = []
        try:
            result.update(inspect(case))
            for field in ("paperSizeCorrect", "allPagesHaveText", "headingFirstPage", "companionTogether"):
                if not result[field]:
                    failures.append(field)
            for field in ("missingSourceTitles", "printedScreenControls"):
                if result[field]:
                    failures.append(field)
            if case["kind"] != "journal" and not result["sourceTitles"]:
                failures.append("missing bibliography")
            if case["kind"] == "history":
                for field in ("reviewWarningFirstPage", "holdPrinted"):
                    if not result[field]:
                        failures.append(field)
                if not case["dom"].get("companion"):
                    failures.append("missing companion")
            if baseline:
                original = inspect(before[key(case)])
                result["baseline"] = {name: original[name] for name in ("pages", "textSha256", "typographySha256", "pageGeometrySha256", "companionPages")}
                for name in ("textSha256", "typographySha256"):
                    if result[name] != original[name]:
                        failures.append(f"baseline {name} changed")
                # Only history may repaginate. Other surfaces must be untouched.
                if case["kind"] != "history" and result["pageGeometrySha256"] != original["pageGeometrySha256"]:
                    failures.append("unaffected public print geometry changed")
        except (OSError, ValueError, KeyError, RuntimeError) as error:
            failures.append(f"PDF analysis error: {error}")
        result["failures"] = failures
        problems.extend(f"{' / '.join(map(str, key(case)))}: {failure}" for failure in failures)
        results.append(result)
    return {"head": capture["head"], "baselineHead": baseline["head"] if baseline else None,
            "note": "Actual PDF text/style/page witness, not browser print-dialog, physical-printer or artistic signoff.",
            "cases": results, "problems": problems}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--baseline")
    args = parser.parse_args()
    capture_path = resolve(args.capture)
    baseline_path = resolve(args.baseline) if args.baseline else None
    report = analyze(json.loads(capture_path.read_text()), json.loads(baseline_path.read_text()) if baseline_path else None)
    report["captureSha256"] = hashlib.sha256(capture_path.read_bytes()).hexdigest()
    report["baselineCaptureSha256"] = hashlib.sha256(baseline_path.read_bytes()).hexdigest() if baseline_path else None
    output = resolve(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    for result in report["cases"]:
        status = "FAIL" if result["failures"] else "PASS"
        print(f"{status} {' / '.join(map(str, key(result)))}: {result.get('pages')} pages, companion {result.get('companionPages')}")
    print(f"{len(report['cases'])} actual PDF cases; {len(report['problems'])} problem(s).")
    for problem in report["problems"]:
        print(problem)
    return int(bool(report["problems"]))


if __name__ == "__main__":
    raise SystemExit(main())
