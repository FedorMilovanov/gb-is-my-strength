#!/usr/bin/env node
/**
 * §2.6 — Typograf: Russian typographic fixes for article HTML.
 * Legacy report: node scripts/typograf.js --dry-run
 * Strict read-only article-body check: node scripts/typograf.js --check --root=dist/articles
 * Rule-level JSON diagnostics: node scripts/typograf.js --dry-run --root=dist/articles --json
 * Read-only diagnostics; repair through the actual authored source owner.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const SHORT_WORDS = /(?<![\p{L}\p{M}\p{N}_-])(в|и|к|о|с|у|а|я|не|на|по|за|из|от|до|но|ни|же|ли|бы|то|во|со)[ \t]+(?=[\p{L}\p{N}«„“"])/giu;
const PROSE = new Set(['p', 'li', 'figcaption', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'dt', 'dd']);
const PROTECTED = new Set(['code', 'pre', 'script', 'style', 'textarea', 'kbd', 'samp', 'template', 'svg', 'math', 'noscript']);

const RULES = [
  ['quotes', text => text.replace(/"([^"]{1,200})"/g, '«$1»')],
  ['dash', text => text.replace(/(\s)- /g, '$1— ').replace(/ -(\s)/g, ' —$1')],
  ['nbsp', text => text.replace(SHORT_WORDS, '$1\u00A0')],
  ['ellipsis', text => text.replace(/\.\.\./g, '…')],
];
function processText(text, counts) {
  let result = text;
  for (const [name, transform] of RULES) {
    const next = transform(result);
    if (counts && next !== result) counts[name]++;
    result = next;
  }
  return result;
}

// Use parser offsets rather than reserialization: attributes, comments, raw
// script/JSON-LD, entity spellings and all unedited bytes remain unchanged.
function processHtml(html, parse, articleOnly = false, counts) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const edits = [];
  let scope = document;
  if (articleOnly) {
    const articles = [];
    function findArticle(node, inMain = false) {
      if (node.tagName === 'article' && inMain) articles.push(node);
      for (const child of node.childNodes || []) {
        findArticle(child, inMain || node.tagName === 'main');
      }
    }
    findArticle(document);
    if (articles.length !== 1) {
      throw new Error('Expected exactly one article inside main; got ' + articles.length);
    }
    scope = articles[0];
  }
  function visit(node, prose, protectedAncestor) {
    const tag = node.tagName;
    const lang = node.attrs?.find(attr => attr.name === 'lang')?.value;
    const protectedNode = protectedAncestor || PROTECTED.has(tag) ||
      Boolean(lang && !/^ru(?:-|$)/i.test(lang));
    if (protectedNode || (articleOnly && (
      tag === 'nav' || node.attrs?.some(attr =>
        attr.name === 'role' && attr.value === 'navigation' ||
        attr.name === 'class' && /(?:^|\s)(?:gbs2-tocscroll|gbs2-toc|hrail|hrail-scroll|hrail-toc|hrail-sub|author-card)(?:\s|$)/.test(attr.value)
      )
    ))) return;
    const insideProse = prose || PROSE.has(tag);
    if (node.nodeName === '#text' && insideProse) {
      const loc = node.sourceCodeLocation;
      if (!loc) return;
      const raw = html.slice(loc.startOffset, loc.endOffset);
      // A malformed document can produce a coalesced parser text location
      // spanning markup (e.g. foster parenting). Never edit that range.
      if (raw.includes('<')) return;
      const fixed = processText(raw, counts);
      if (raw !== fixed) edits.push({ start: loc.startOffset, end: loc.endOffset, fixed });
      return;
    }
    for (const child of node.childNodes || []) visit(child, insideProse, false);
  }
  visit(scope, false, false);
  edits.sort((a, b) => b.start - a.start);
  let result = html;
  let previousStart = html.length;
  for (const edit of edits) {
    if (edit.end > previousStart) throw new Error('Overlapping typographic source ranges');
    result = result.slice(0, edit.start) + edit.fixed + result.slice(edit.end);
    previousStart = edit.start;
  }
  return result;
}

function selfTest(parse) {
  const cases = [
    ['plain', '<p>Он в доме...</p>', '<p>Он в\u00A0доме…</p>'],
    ['tail', '<p><b>Слово</b> далее...</p>', '<p><b>Слово</b> далее…</p>'],
    ['nested', '<blockquote><p>Первое...</p><p>Второе...</p></blockquote>', '<blockquote><p>Первое…</p><p>Второе…</p></blockquote>'],
    ['attributes', '<p title="a...b">Текст...</p>', '<p title="a...b">Текст…</p>'],
    ['script', "<script>const text = '<p>текст...</p>';</script>", "<script>const text = '<p>текст...</p>';</script>"],
    ['json-ld', '<script type="application/ld+json">{"text":"<p>текст...</p>"}</script>', '<script type="application/ld+json">{"text":"<p>текст...</p>"}</script>'],
    ['pre', '<pre><p>текст...</p></pre>', '<pre><p>текст...</p></pre>'],
    ['inline-code', '<p>Текст... <code>foo...</code> ещё...</p>', '<p>Текст… <code>foo...</code> ещё…</p>'],
    ['language', '<p>Текст... <span lang="en">A "quote"...</span></p>', '<p>Текст… <span lang="en">A "quote"...</span></p>'],
    ['nbsp-entity', '<p>в&nbsp;доме и\u00A0сад</p>', '<p>в&nbsp;доме и\u00A0сад</p>'],
    ['word-boundary', '<p>окно дома, кино здесь, пол-о слове</p>', '<p>окно дома, кино здесь, пол-о слове</p>'],
    ['quotes-and-dash', '<p>"слово" - текст...</p>', '<p>«слово» — текст…</p>'],
    ['markup-guard', '<p>число &lt; 3...</p>', '<p>число &lt; 3…</p>'],
    ['comment', '<!-- <p>текст...</p> --><p>текст...</p>', '<!-- <p>текст...</p> --><p>текст…</p>'],
  ];
  for (const [label, input, expected] of cases) {
    const actual = processHtml(input, parse);
    assert.equal(actual, expected, label);
    assert.equal(processHtml(actual, parse), actual, label + ': idempotence');
  }
  const scoped = '<nav><p>в меню...</p></nav><main><article><p>в доме...</p><nav><p>в меню...</p></nav><div class="gbs2-toc"><p>в оглавлении...</p></div><aside class="note-box"><p>в примечании...</p></aside><aside class="author-card"><p>в карточке...</p></aside></article></main>';
  const expected = '<nav><p>в меню...</p></nav><main><article><p>в\u00A0доме…</p><nav><p>в меню...</p></nav><div class="gbs2-toc"><p>в оглавлении...</p></div><aside class="note-box"><p>в\u00A0примечании…</p></aside><aside class="author-card"><p>в карточке...</p></aside></article></main>';
  assert.equal(processHtml(scoped, parse, true), expected, 'article-only navigation boundary');
  assert.equal(processHtml(expected, parse, true), expected, 'article-only idempotence');
  assert.throws(() => processHtml('<main><p>текст...</p></main>', parse, true), /exactly one article/);
  assert.throws(() => processHtml('<main><article></article><article></article></main>', parse, true), /exactly one article/);
  const counts = Object.fromEntries(RULES.map(([name]) => [name, 0]));
  processHtml('<main><article><p>в доме...</p><p>"слово" - текст</p><nav><p>в меню...</p></nav></article></main>', parse, true, counts);
  assert.deepEqual(counts, { quotes: 1, dash: 1, nbsp: 1, ellipsis: 1 }, 'rule-level text-node counts exclude navigation');
  console.log('Typograf: ' + cases.length + ' source-preserving fixtures + idempotence + 5 article-scope and rule-count assertions PASS');
}

async function main() {
  const args = process.argv.slice(2);
  const { parse } = await import('parse5');
  if (args.length === 1 && args[0] === '--self-test') {
    selfTest(parse);
    return;
  }
  const modes = args.filter(arg => ['--dry-run', '--check'].includes(arg));
  const roots = args.filter(arg => arg.startsWith('--root='));
  const jsonFlags = args.filter(arg => arg === '--json');
  if (args.includes('--write')) {
    throw new Error('Automatic rewrite disabled: fix the authored source after reviewing diagnostics');
  }
  if (modes.length > 1 || roots.length > 1 || jsonFlags.length > 1 ||
      args.length !== modes.length + roots.length + jsonFlags.length ||
      (modes[0] === '--check' && !roots.length) ||
      (roots.length && !roots[0].slice(7))) {
    throw new Error('Use --dry-run [--root=DIR] [--json], --check --root=DIR [--json], or --self-test');
  }
  const mode = modes[0] || '--dry-run';
  const root = roots.length ? path.resolve(roots[0].slice(7)) : path.join(__dirname, '..', 'articles');
  const articleOnly = mode === '--check' || roots.length > 0;
  let scanned = 0;
  const findings = [];
  for (const slug of fs.readdirSync(root).sort()) {
    const file = path.join(root, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const input = fs.readFileSync(file, 'utf8');
    const counts = Object.fromEntries(RULES.map(([name]) => [name, 0]));
    const output = processHtml(input, parse, articleOnly, counts);
    scanned++;
    if (output === input) continue;
    findings.push({ file: path.relative(root, file).split(path.sep).join('/'), textNodesByRule: counts });
    if (!jsonFlags.length) console.log(path.relative(process.cwd(), file), JSON.stringify(counts));
  }
  if (!scanned) throw new Error('No article index.html files found under ' + root);
  const textNodesByRule = Object.fromEntries(RULES.map(([name]) => [
    name, findings.reduce((sum, finding) => sum + finding.textNodesByRule[name], 0)
  ]));
  const report = { mode, articleOnly, scanned, filesWithSuggestions: findings.length, textNodesByRule, findings,
    note: 'Diagnostic suggestions, not automatically verified editorial defects; counts are affected text nodes per rule, not substitutions.' };
  if (jsonFlags.length) console.log(JSON.stringify(report));
  else console.log('Would change: ' + findings.length + ' files; scanned: ' + scanned + '; suggestions: ' + JSON.stringify(textNodesByRule));
  if (mode === '--check' && findings.length > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
