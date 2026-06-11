#!/usr/bin/env node
/**
 * §2.6 — Typograf: Russian typographic fixes for article HTML
 * Usage: node scripts/typograf.js [--dry-run]
 * Fixes: ёлочки, тире, неразрывные пробелы после коротких предлогов
 * Skips: <code>, <pre>, JSON-LD, attributes, data-* values
 */
'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('path');

const DRY = process.argv.includes('--dry-run');

const ARTICLES_DIR = path.join(__dirname, '..', 'articles');
const SHORT_WORDS = /\b(в|и|к|о|с|у|а|я|не|на|по|за|из|от|до|но|ни|же|ли|бы|то|во|со)\s/gi;

function processText(text) {
  let out = text;
  // 1. Straight quotes → ёлочки (simple heuristic)
  out = out.replace(/"([^"]{1,200})"/g, '«$1»');
  // 2. Hyphen between words → em-dash with spaces
  out = out.replace(/(\s)- /g, '$1— ');
  out = out.replace(/ -(\s)/g, ' —$1');
  // 3. Non-breaking space after short prepositions
  out = out.replace(SHORT_WORDS, (m) => m.slice(0, -1) + '\u00A0');
  // 4. Ellipsis
  out = out.replace(/\.\.\./g, '…');
  return out;
}

function processFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  
  // Only process text content inside <p>, <li>, <figcaption>, <blockquote>
  // Skip: <code>, <pre>, <script>, attributes, JSON-LD
  const out = html.replace(
    /(<(?:p|li|figcaption|blockquote|h[1-6]|td|th|dt|dd)[^>]*>)([\s\S]*?)(<\/(?:p|li|figcaption|blockquote|h[1-6]|td|th|dt|dd)>)/gi,
    (match, open, body, close) => {
      // Don't touch code/pre content
      if (/<(?:code|pre|script|kbd|samp)/i.test(body)) return match;
      
      // Process only text nodes (not inside tags)
      const processed = body.replace(/>([^<]+)</g, (m2, text) => {
        const fixed = processText(text);
        if (fixed !== text) changed = true;
        return '>' + fixed + '<';
      });
      
      // Also process text at start/end if not in a tag
      const final = processed.replace(/^([^<]+)/, (m2, text) => {
        const fixed = processText(text);
        if (fixed !== text) changed = true;
        return fixed;
      });
      
      return open + final + close;
    }
  );
  
  if (changed) {
    if (DRY) {
      console.log(`  [dry] ${path.relative(process.cwd(), filePath)}`);
    } else {
      fs.writeFileSync(filePath, out, 'utf-8');
      console.log(`  ✎  ${path.relative(process.cwd(), filePath)}`);
    }
  }
  
  return changed;
}

console.log(`\nGB TYPOGRAF ${DRY ? '(dry run)' : ''}`);
let total = 0;

const dirs = fs.readdirSync(ARTICLES_DIR);
for (const slug of dirs.sort()) {
  const fp = path.join(ARTICLES_DIR, slug, 'index.html');
  if (!fs.existsSync(fp)) continue;
  if (processFile(fp)) total++;
}

console.log(`\n${DRY ? 'Would change' : 'Changed'}: ${total} files\n`);
