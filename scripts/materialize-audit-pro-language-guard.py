#!/usr/bin/env python3
from pathlib import Path

file = Path('scripts/audit-pro.js')
source = file.read_text(encoding='utf-8')
old = """  function hasEnglishDirectQuote(fragment) {
    const clean = stripHtmlLite(fragment);
    const latinWords = clean.match(/[A-Za-z]{4,}/g) || [];
"""
new = """  function hasEnglishDirectQuote(fragment) {
    const clean = stripHtmlLite(fragment);
    // Latin-script diacritics strongly indicate a French/Latin/non-English quotation.
    // Keep this language rule generic; do not add route- or phrase-specific exceptions.
    if (/[À-ÖØ-öø-ÿ]/.test(clean)) return false;
    const latinWords = clean.match(/[A-Za-z]{4,}/g) || [];
"""
count = source.count(old)
if count != 1:
    raise SystemExit(f'expected one English quote guard, found {count}')
file.write_text(source.replace(old, new, 1), encoding='utf-8')
