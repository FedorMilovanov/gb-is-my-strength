#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const cssPath = 'css/site.css';
const auditPath = 'scripts/print-paper-pdf-audit.py';
const marker = 'GB PRINT CONTRACT v2.8 — Gill series overview pagination';

let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes(marker)) {
  css = `${css.trimEnd()}\n\n/* ${marker}. */\n@media print {\n  /* Part I uses the first page as a clean title sheet. The series overview is\n     one semantic section and must never leave its label orphaned below the byline. */\n  html body [data-gill-v16=\"part1\"] .article-body > .note-box:first-child {\n    break-before: page;\n    page-break-before: always;\n  }\n\n  html body [data-gill-v16=\"part1\"] .article-body > .note-box:first-child > :first-child {\n    break-inside: avoid-page;\n    page-break-inside: avoid;\n    break-after: avoid-page;\n    page-break-after: avoid;\n  }\n\n  html body [data-gill-v16=\"part1\"] .article-body > .note-box:first-child > .grid {\n    break-before: avoid-page;\n    page-break-before: avoid;\n  }\n\n  html body [data-gill-v16=\"part1\"] .article-body > .note-box:first-child .gill-card {\n    break-inside: avoid-page;\n    page-break-inside: avoid;\n  }\n}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
}

let audit = fs.readFileSync(auditPath, 'utf8');
const auditMarker = 'series overview split across pages';
if (!audit.includes(auditMarker)) {
  const needle = '    known_headings = {\n';
  const insertion = `    series_label_pages = [\n        i for i, value in enumerate(text_pages)\n        if \"СЕРИЯ О ДЖОНЕ ГИЛЛЕ\" in normalize(value)\n    ]\n    series_intro_pages = [\n        i for i, value in enumerate(text_pages)\n        if \"БИОГРАФИЯ ДЖОНА ГИЛЛА\" in normalize(value)\n    ]\n    if (\n        not series_label_pages\n        or not series_intro_pages\n        or not set(series_label_pages) & set(series_intro_pages)\n    ):\n        failures.append(\n            \"series overview split across pages: \"\n            f\"label={series_label_pages}, intro={series_intro_pages}\"\n        )\n\n`;
  if (!audit.includes(needle)) throw new Error('Audit insertion point not found');
  audit = audit.replace(needle, insertion + needle);
  fs.writeFileSync(auditPath, audit, 'utf8');
}

execFileSync('node', ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
