#!/usr/bin/env python3
"""Read actual catalog PDFs, including title/full-summary pagination.

Uses the existing Journal PDF reader's normalizer and text/style/paper checks.
PyMuPDF is required for PDF analysis, not for the pure --self-test negatives.
No PDF, Product markup, browser scroll position or source authority is changed.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
PAPERS = ("A4", "Letter")


def normalize(text):
    return re.sub(r"\s+|\u00ad", "", unicodedata.normalize("NFKC", text))


def entry_pagination(entries, page_texts):
    """A title and its complete abstract must share a real emitted PDF page."""
    pages = [normalize(text) for text in page_texts]
    result = []
    for entry in entries:
        title = normalize(entry["title"])
        summary = normalize(entry.get("summary", ""))
        title_pages = [i + 1 for i, text in enumerate(pages) if title and title in text]
        summary_pages = [i + 1 for i, text in enumerate(pages) if summary and summary in text]
        together = bool(title_pages) and (not summary or bool(set(title_pages) & set(summary_pages)))
        result.append({"url": entry["url"], "title": entry["title"], "titlePages": title_pages,
                       "summaryPages": summary_pages, "hasSummary": bool(summary), "together": together})
    return result


def printed_scale(heading, font_pt, first_page_spans):
    """Measure actual PDF scaling; an A4 @page may be fitted to Letter paper."""
    if not math.isfinite(font_pt) or font_pt <= 0:
        raise ValueError("invalid captured page heading size")
    for size in sorted({span["size"] for span in first_page_spans}, reverse=True):
        text = "".join(span["text"] for span in first_page_spans if abs(span["size"] - size) <= .05)
        if normalize(heading) and normalize(heading) in normalize(text) and math.isfinite(size) and size > 0:
            return size / font_pt
    raise ValueError("page heading style not found in actual PDF")


def opening_pagination(openings, page_texts, page_spans, scale=1):
    """Only heading-sized PDF ink can witness a section label, not metadata."""
    pages = [normalize(text) for text in page_texts]
    result = []
    for opening in openings:
        font_pt = opening["fontPt"]
        if not math.isfinite(font_pt) or font_pt <= 0:
            raise ValueError("invalid captured section heading size")
        label = normalize(opening["label"])
        heading_pages = [i + 1 for i, spans in enumerate(page_spans)
                         if label and label in normalize("".join(span["text"] for span in spans if abs(span["size"] - font_pt * scale) <= .15))]
        first = normalize(opening["firstTitle"])
        first_pages = [i + 1 for i, text in enumerate(pages) if first and first in text]
        result.append({**opening, "headingPages": heading_pages, "firstPages": first_pages,
                       "together": bool(set(heading_pages) & set(first_pages))})
    return result


def self_test():
    entry = {"url": "/fixture/", "title": "Длинный заголовок", "summary": "Полная аннотация"}
    assert entry_pagination([entry], ["Длинный\nзаголовок Полная аннотация"])[0]["together"]
    assert not entry_pagination([entry], ["Длинный заголовок", "Полная аннотация"])[0]["together"]
    assert not entry_pagination([entry], ["Длинный заголовок Полная анно…"])[0]["together"]
    assert not entry_pagination([entry], ["Длинный заго… Полная аннотация"])[0]["together"]
    assert not entry_pagination([entry], ["Длинный", "заголовок Полная аннотация"])[0]["together"]
    assert entry_pagination([{**entry, "summary": ""}], [entry["title"]])[0]["together"]
    # A matching title on a different page cannot substitute for its abstract.
    assert entry_pagination([entry], [entry["title"], entry["title"] + entry["summary"]])[0]["together"]
    opening = {"label": "Серии", "fontPt": 21, "firstTitle": entry["title"], "firstUrl": entry["url"]}
    heading = {"text": "Серии", "size": 21}
    assert opening_pagination([opening], [entry["title"]], [[heading]])[0]["together"]
    assert not opening_pagination([opening], ["Серии", entry["title"]], [[heading], []])[0]["together"]
    # A repeated body/category label on the next page cannot hide an orphan.
    assert not opening_pagination([opening], ["Серии", "Серии " + entry["title"]], [[heading], [{"text": "Серии", "size": 8}]])[0]["together"]
    scale = printed_scale("Все статьи", 32, [{"text": "Все ", "size": 30.08}, {"text": "статьи", "size": 30.08}])
    assert abs(scale - .94) < .0001
    assert opening_pagination([opening], [entry["title"]], [[{**heading, "size": 21 * scale}]], scale)[0]["together"]
    assert not opening_pagination([opening], [entry["title"]], [[{**heading, "size": 8 * scale}]], scale)[0]["together"]
    try:
        printed_scale("Все статьи", 32, [{"text": "Нет заголовка", "size": 32}])
    except ValueError:
        pass
    else:
        raise AssertionError("missing PDF page heading style accepted")
    print("PASS actual-PDF pagination logic: title/abstract negatives; section-heading/first-entry negatives; repeated metadata; measured paper-fit scaling")


def analyze(capture):
    # The same existing PDF reader owns normalization, paper and text/style
    # inspection; the catalog only adds its entry-level pagination projection.
    spec = importlib.util.spec_from_file_location("journal_print_pdf", Path(__file__).with_name("journal-print-pdf.py"))
    reader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reader)
    import fitz

    cases, results, problems = capture["cases"], [], []
    expected = {(paper, theme, scripting) for paper in PAPERS for theme in ("light", "dark") for scripting in (True, False)}
    keys = {(case["paper"], case["theme"], case["javaScriptEnabled"]) for case in cases}
    if len(cases) != len(expected) or keys != expected:
        problems.append("missing or duplicate catalog PDF matrix case")
    for case in cases:
        result = {key: case[key] for key in ("paper", "theme", "javaScriptEnabled", "pdf")}
        failures = []
        try:
            pdf = reader.resolve(case["pdf"])
            result["pdfSha256"] = hashlib.sha256(pdf.read_bytes()).hexdigest()
            result.update(reader.inspect(case))
            for name in ("paperSizeCorrect", "allPagesHaveText", "headingFirstPage"):
                if not result[name]:
                    failures.append(name)
            for name in ("missingSourceTitles", "printedScreenControls"):
                if result[name]:
                    failures.append(name)
            entries = case["dom"]["entries"]
            if not entries or len({entry["url"] for entry in entries}) != len(entries):
                failures.append("missing or duplicate source-owned catalog entries")
            if [entry["title"] for entry in entries] != case["dom"]["sourceTitles"]:
                failures.append("entry/title projections disagree")
            with fitz.open(pdf) as document:
                texts = [page.get_text(sort=True) for page in document]
                result["entries"] = entry_pagination(entries, texts)
                result["splitOrMissingEntries"] = [entry for entry in result["entries"] if not entry["together"]]
                if result["splitOrMissingEntries"]:
                    failures.append("catalog title/full-summary split or missing")
                openings = case["dom"]["sectionOpenings"]
                if not openings or any(opening["firstUrl"] not in {entry["url"] for entry in entries} for opening in openings):
                    failures.append("missing or invalid source-owned section openings")
                page_spans = [[span for block in page.get_text("dict")["blocks"] for line in block.get("lines", []) for span in line.get("spans", [])] for page in document]
                result["printScale"] = printed_scale(case["dom"]["heading"], case["dom"]["headingFontPt"], page_spans[0])
                result["sectionOpenings"] = opening_pagination(openings, texts, page_spans, result["printScale"])
                result["detachedHeadings"] = [opening for opening in result["sectionOpenings"] if not opening["together"]]
                if result["detachedHeadings"]:
                    failures.append("section heading separated from first catalog entry")
                bounds = []
                for page in document:
                    outside, glyphs = 0, 0
                    raw = page.get_text("rawdict", flags=fitz.TEXTFLAGS_RAWDICT & ~fitz.TEXT_MEDIABOX_CLIP, clip=fitz.INFINITE_RECT())
                    for block in raw["blocks"]:
                        for line in block.get("lines", []):
                            for span in line.get("spans", []):
                                for char in span.get("chars", []):
                                    if not char["c"].strip():
                                        continue
                                    glyphs += 1
                                    x0, y0, x1, y1 = char["bbox"]
                                    outside += int(not all(math.isfinite(v) for v in char["bbox"]) or x0 < -.5 or y0 < -.5 or x1 > page.rect.width + .5 or y1 > page.rect.height + .5)
                    bounds.append({"page": page.number + 1, "glyphs": glyphs, "outsidePaper": outside})
                result["bounds"] = bounds
                if any(page["outsidePaper"] for page in bounds):
                    failures.append("glyph bounds outside physical paper")
        except (OSError, ValueError, KeyError, RuntimeError) as error:
            failures.append(f"PDF analysis error: {error}")
        result["failures"] = failures
        problems.extend(f"{case['paper']}/{case['theme']}/{case['javaScriptEnabled']}: {failure}" for failure in failures)
        results.append(result)
    return {"head": capture.get("head"), "composite": capture.get("composite"), "cases": results, "problems": problems,
            "note": "Actual PDF text/style/paper, title/abstract and section-heading/first-entry co-location. Not pixel/overlap/full-WCAG, physical-printer or artistic signoff."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--capture")
    parser.add_argument("--output")
    args = parser.parse_args()
    if args.self_test:
        if args.capture or args.output:
            parser.error("--self-test cannot consume or produce capture artifacts")
        self_test()
        return 0
    if not args.capture or not args.output:
        parser.error("--capture and --output are required")
    capture_path = Path(args.capture).resolve()
    output = Path(args.output).resolve()
    if output.exists():
        parser.error("refusing to overwrite an existing PDF analysis")
    report = analyze(json.loads(capture_path.read_text()))
    report["captureSha256"] = hashlib.sha256(capture_path.read_bytes()).hexdigest()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    for case in report["cases"]:
        print(f"{'FAIL' if case['failures'] else 'PASS'} catalog {case['paper']}/{case['theme']}/{case['javaScriptEnabled']}: {case.get('pages')} pages; {len(case.get('splitOrMissingEntries', []))} split/missing entries; {len(case.get('detachedHeadings', []))} detached headings")
    print(f"{len(report['cases'])} actual catalog PDF cases; {len(report['problems'])} problem(s)")
    for problem in report["problems"]:
        print(problem)
    return int(bool(report["problems"]))


if __name__ == "__main__":
    raise SystemExit(main())
