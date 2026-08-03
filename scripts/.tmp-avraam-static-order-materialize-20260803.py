#!/usr/bin/env python3
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
if not args.write:
    raise SystemExit('guard failed: explicit --write is required')

path = Path('scripts/avraam-dossier-witness.mjs')
text = path.read_text(encoding='utf-8')
old = '''    const skip = document.querySelector('[data-map-skip-link]');
    const heading = document.querySelector('h1.sr-only');
    const fallback = document.querySelector('[data-map-static-projection]');
    const stage = document.querySelector('[data-map-stage]');
    const precedes = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      skipCount: document.querySelectorAll('[data-map-skip-link]').length,
      href: skip?.getAttribute('href') || null,
      text: (skip?.textContent || '').replace(/\\s+/g, ' ').trim(),
      stageTabIndex: stage?.tabIndex ?? null,
      stageTabIndexAttribute: stage?.getAttribute('tabindex') || null,
      order: {
        skipBeforeHeading: precedes(skip, heading),
        headingBeforeFallback: precedes(heading, fallback),
        fallbackBeforeStage: precedes(fallback, stage),
      },
    };'''
new = '''    const skip = document.querySelector('[data-map-skip-link]');
    const lifecycleHeading = document.querySelector('h1.sr-only[data-pagefind-body]');
    const fallback = document.querySelector('[data-map-static-projection]');
    const stage = document.querySelector('[data-map-stage]');
    const precedes = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      skipCount: document.querySelectorAll('[data-map-skip-link]').length,
      href: skip?.getAttribute('href') || null,
      text: (skip?.textContent || '').replace(/\\s+/g, ' ').trim(),
      lifecycleHeadingPresent: Boolean(lifecycleHeading),
      stageTabIndex: stage?.tabIndex ?? null,
      stageTabIndexAttribute: stage?.getAttribute('tabindex') || null,
      order: {
        skipBeforeFallback: precedes(skip, fallback),
        fallbackBeforeStage: precedes(fallback, stage),
      },
    };'''
if text.count(old) != 1:
    raise SystemExit(f'guard failed: static order block count={text.count(old)}')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('updated static navigation order to lifecycle-stable route owners')
