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
const { scanBlockStructure } = require('./lib/block-structure-guard');
const {
  collectJsonStringValues,
  findMixedScriptTokens,
  sanitizeMarkupForMixedScript,
} = require('./lib/mixed-script-guard');
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

  // ── 3. Mixed-script contamination (ERROR: Unicode-aware Latin+Cyrillic guard) ──
  for (const hit of findMixedScriptTokens(sanitizeMarkupForMixedScript(raw))) {
    err(rel, `смешанный алфавит в слове (кириллица+латиница): «${hit.token}» (${hit.kind})`);
  }
  const cjk = text.match(/[㐀-鿿豈-﫿]/g);
  if (cjk) err(rel, `иероглиф(ы) в русском тексте: ${[...new Set(cjk)].join(' ')}`);

  // ── 5. Block structure (GBS-KRAJNE-FIGURE-PARAGRAPH-ORPHAN-TEXT):
  //      block <figure> inside an open <p> makes the HTML parser orphan the
  //      following sentence as a direct text child of the article root;
  //      substantive direct text in <article data-pagefind-body> is the
  //      rendered symptom of that class of nesting mistakes. ──
  const structure = scanBlockStructure(raw);
  if (structure.figureInP)
    err(rel, `block <figure> вложен в незакрытый <p> (${structure.figureInP} шт.)`);
  if (structure.directText)
    err(rel, `substantive direct text без элемента-родителя в article[data-pagefind-body] (${structure.directText} шт.)`);
}

// ── 4. Extended JSON/map/genealogy/glossary/quiz mixed-script surface coverage ──
const JSON_SURFACES = [
  'data/glossary.json',
  'data/search-manifest.json',
  ...(fs.existsSync(path.join(ROOT, 'karty'))
    ? fs.readdirSync(path.join(ROOT, 'karty'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join('karty', e.name, 'route.json'))
      .filter((p) => fs.existsSync(path.join(ROOT, p)))
    : []),
  ...(fs.existsSync(path.join(ROOT, 'data/genealogy/v2/publishable'))
    ? fs.readdirSync(path.join(ROOT, 'data/genealogy/v2/publishable'))
      .filter((n) => n.endsWith('.json'))
      .map((n) => path.join('data/genealogy/v2/publishable', n))
    : []),
];
for (const jsonRel of JSON_SURFACES) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, jsonRel), 'utf8'));
    const joined = collectJsonStringValues(parsed).join('\n');
    for (const hit of findMixedScriptTokens(joined, { checkHyphenCompounds: false })) {
      err(jsonRel, `смешанный алфавит в JSON-поверхности: «${hit.token}»`);
    }
  } catch (error) {
    err(jsonRel, `не удалось проверить JSON-поверхность: ${error.message}`);
  }
}

function walkPageHeads(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkPageHeads(p, out);
    else if (/PageHead\.astro$/u.test(e.name)) out.push(p);
  }
  return out;
}
for (const headRel of walkPageHeads('src/components')) {
  const raw = fs.readFileSync(path.join(ROOT, headRel), 'utf8');
  const scriptPayloads = [...raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/giu)].map((m) => m[1]).join('\n');
  const stringLiterals = [...scriptPayloads.matchAll(/"((?:\\.|[^"\\])*)"/gu)].map((m) => m[1]).join(' ');
  const combined = `${sanitizeMarkupForMixedScript(raw)}\n${stringLiterals}`;
  for (const hit of findMixedScriptTokens(combined, { checkHyphenCompounds: false })) {
    err(headRel, `смешанный алфавит в метаданных/квизе: «${hit.token}»`);
  }
}

// ── 5. Positive semantic preservation for selected high-value owners ──
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
