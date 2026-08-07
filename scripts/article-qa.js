#!/usr/bin/env node
'use strict';

/*
 * article-qa — content-quality lint. DELIBERATELY NARROW: every ERROR here is a
 * near-certain typo; every WARN is a likely omission worth a human glance. Rules
 * were calibrated empirically against the whole corpus and pruned until the
 * false-positive rate was ~zero. See docs/ARTICLE-STANDARD-CHARTER.md §checks.
 *
 * Checks (all ERROR unless noted): (1) «» guillemet balance; (2) tooltip
 * well-formedness (empty gtip/tooltip = ERROR; gterm w/o tip = WARN); (3) mixed-
 * script contamination — a token mixing Cyrillic+Latin, or any CJK ideograph, is
 * homoglyph corruption that ships broken, unsearchable text (calibrated: 3 real
 * hits, 0 false positives across the corpus); (4) accepted semantic manifests for
 * selected high-value article owners, including adversarial deletion mutations.
 *
 * Deliberately NOT checked (would be noise, per calibration 2026-07-11):
 *  - «…» → source: blanket rule false-positives on Bible refs, emphasis, titles.
 *    We check only BLOCK quotes, and count footnotes/prose/attribution as sourced.
 *  - „ " balance: the corpus mixes English curly “ ” with Russian inner „ " — a
 *    naive pair-count conflates conventions. Dropped.
 *  - tooltip VISUAL placement (flip/edge/direction): handled at RUNTIME by
 *    js/site.js collision detection (flip + viewport clamp). Verify with
 *    visual:parity screenshots, never statically.
 *
 * Usage: node scripts/article-qa.js            (exit 1 on ERROR only)
 *        node scripts/article-qa.js --strict    (WARN also fails)
 */

const fs = require('fs');
const path = require('path');
const {
  runAcceptedSemanticManifestAudit,
} = require('./lib/accepted-semantic-manifest');
const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const SCAN = ['src/content/articles', 'src/components/baptisty-rossii', 'src/components/article-pilots'];
function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.mdx$/.test(e.name) || /(Body|Section[A-Za-z]*)\.astro$/.test(e.name)) out.push(rel);
  }
  return out;
}

// Strip everything that legitimately holds unbalanced punctuation.
function sanitize(t) {
  return t
    .replace(/^---[\s\S]*?---/, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')     // markdown links [text](url) — strip whole
    .replace(/<code[\s\S]*?<\/code>/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/[^\s"'<>)]+/g, ' ')
    .replace(/[:;]-?[()]/g, ' ')              // smileys :) :( ;)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
}

const errors = [], warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);
const files = SCAN.flatMap(d => walk(d));

for (const rel of files) {
  let raw; try { raw = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
  const text = sanitize(raw);

  // ── 1. Guillemet balance (ERROR: a dropped « or » is a real typo) ──
  const cnt = (s, re) => (s.match(re) || []).length;
  const naG = cnt(text, /«/g), nbG = cnt(text, /»/g);
  if (naG !== nbG) err(rel, `несбалансированные кавычки «»: ${naG} откр. / ${nbG} закр.`);

  // ── 2. Tooltip markup well-formedness (ERROR on empty; WARN on term w/o tip) ──
  if (/class="gtip">\s*<\/span>/.test(raw)) err(rel, 'пустой тултип-перевод (gtip без текста)');
  if (/class="tooltip">\s*<\/span>/.test(raw)) err(rel, 'пустая сноска (tooltip без текста)');
  const gterm = cnt(raw, /class="gterm"/g);
  const tipForTerm = cnt(raw, /class="gterm"[^>]*data-term=/g) + cnt(raw, /class="gterm"[^>]*>[\s\S]{0,120}?class="gtip"/g);
  if (gterm && tipForTerm < gterm) warn(rel, `gterm без перевода/пояснения (${gterm} терминов, ${tipForTerm} с тултипом/глоссарием)`);

  // ── 3. Mixed-script contamination (ERROR: real corruption, never legitimate) ──
  for (const tok of text.match(/[A-Za-zА-Яа-яЁё]+/g) || []) {
    if (/[А-Яа-яЁё]/.test(tok) && /[A-Za-z]/.test(tok))
      err(rel, `смешанный алфавит в слове (кириллица+латиница): «${tok}»`);
  }
  const cjk = text.match(/[㐀-鿿豈-﫿]/g);
  if (cjk) err(rel, `иероглиф(ы) в русском тексте: ${[...new Set(cjk)].join(' ')}`);
}

// ── 4. Positive semantic preservation for selected high-value owners ──
try {
  const semantic = runAcceptedSemanticManifestAudit({ requireDist: false });
  console.log(`Semantic manifest source contract: ${semantic.results.length} routes, ${semantic.mutationCasesKilled} deletion mutations killed.`);
} catch (error) {
  err('accepted-semantic-manifest', error.message);
}

console.log('=== article-qa (guillemet balance · tooltip well-formedness · mixed-script · semantic manifest) ===');
console.log(`Scanned ${files.length} article files.\n`);
for (const e of errors) console.log(`❌ ${e}`);
for (const w of warnings) console.log(`⚠️  ${w}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
if (errors.length || (STRICT && warnings.length)) process.exit(1);
process.exit(0);
