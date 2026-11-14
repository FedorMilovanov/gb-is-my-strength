#!/usr/bin/env node
/**
 * FAQ structured-data answer parity — SYS-FAQ-STRUCTURED-DATA-ANSWER-PARITY.
 *
 * A FAQPage mainEntity acceptedAnswer.text is a claim about the page: whatever the
 * structured data answers must be the copy the reader actually sees. A truncated,
 * paraphrased or invented schema answer makes the rich result say something the page
 * does not say.
 *
 * Rule enforced: for every FAQPage node in every emitted page, each acceptedAnswer.text
 * must be present verbatim in the VISIBLE page copy. Only presentation-level variance is
 * tolerated: indentation/pretty-printing inside the JSON-LD block, inline-markup
 * boundaries, HTML entities, non-breaking spaces, typographic quote and dash variants,
 * and the space that block-level tag removal introduces before punctuation.
 *
 * Usage:
 *   node scripts/faq-structured-data-answer-parity.mjs [dir-or-file ...]   default: dist
 *   node scripts/faq-structured-data-answer-parity.mjs --selftest           fixture mode
 */
import fs from 'node:fs';
import path from 'node:path';

const INLINE = /^(?:a|abbr|b|big|code|del|em|font|i|ins|kbd|mark|nobr|q|s|samp|small|span|strike|strong|sub|sup|time|tt|u|var)$/i;

export const norm = (s) => s
  // The JSON-LD block is the object under test, never the evidence.
  .replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, ' ')
  // Inline elements are transparent; block-level elements separate words.
  .replace(new RegExp(`<\\/?(${INLINE.source})\\b[^>]*>`, 'gi'), '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x?[0-9a-f]+;/gi, ' ')
  .replace(/&[a-z#]+;/gi, ' ')
  .replace(/[\u00a0\u202f\u2009\u200b\ufeff]/g, ' ')
  .replace(/[“”«»„]/g, '"')
  .replace(/[—–−]/g, '-')
  .replace(/\s+([):,.?!;»])/g, '$1')
  .replace(/([«(])\s+/g, '$1')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

/** All FAQPage answers on one emitted page → list of parity failures (empty when clean). */
export function checkHtml(html) {
  const failures = [];
  const blocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      continue;
    }
    const graph = Array.isArray(parsed) ? parsed : (parsed && parsed['@graph']) ? parsed['@graph'] : [parsed];
    for (const node of graph) {
      if (!node || node['@type'] !== 'FAQPage') continue;
      const visible = norm(html);
      for (const q of node.mainEntity || []) {
        const answer = (q && q.acceptedAnswer && q.acceptedAnswer.text) || '';
        if (!answer) {
          failures.push(`empty acceptedAnswer.text for "${q && q.name}"`);
          continue;
        }
        if (!visible.includes(norm(answer))) {
          failures.push(`structured-data answer for "${q && q.name}" is not the visible page copy (${answer.length} chars)`);
        }
      }
    }
  }
  return failures;
}

const faqPage = (answerText, visibleHtml) => `<html><head>
<script type="application/ld+json">${JSON.stringify({
  '@graph': [{ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Вопрос?', acceptedAnswer: { '@type': 'Answer', text: answerText } }] }],
})}</script>
</head><body><main>${visibleHtml}</main></body></html>`;

/* Negative fixtures pin both directions: the gate must reject divergent schema copy and
 * must not fire on presentation-only differences. */
const FIXTURES = [
  { name: 'truncated answer is rejected', wantFail: true, html: faqPage('Первое предложение. Второе предложение.', '<p>Первое предложение.</p>') },
  { name: 'paraphrased answer is rejected', wantFail: true, html: faqPage('Власть — это сервиз.', '<p>Власть — это служение.</p>') },
  { name: 'invented answer is rejected', wantFail: true, html: faqPage('Ответ, которого на странице нет вовсе.', '<p>Что-то совсем другое.</p>') },
  { name: 'empty answer is rejected', wantFail: true, html: faqPage('', '<p>Любой текст.</p>') },
  { name: 'inline markup, entities and dashes accepted', wantFail: false, html: faqPage('строгая власть — не зло, а проверяемое служение (1&nbsp;Пет. 5:3)', '<p><strong>строгая</strong> власть — <em>не зло</em>, а проверяемое служение (1&nbsp;Пет. 5:3)</p>') },
  { name: 'block-wrapped answer accepted', wantFail: false, html: faqPage('Первый абзац. Второй абзац.', '<p>Первый абзац.</p>\n  <p>Второй абзац.</p>') },
];

if (process.argv[2] === '--selftest') {
  let bad = 0;
  for (const f of FIXTURES) {
    const failed = checkHtml(f.html).length > 0;
    if (failed !== f.wantFail) {
      bad++;
      console.log(`  ❌ fixture «${f.name}»: want fail=${f.wantFail}, got fail=${failed}`);
    }
  }
  if (bad) {
    console.log(`❌ FAQ structured-data parity fixtures failed: ${bad}/${FIXTURES.length}`);
    process.exit(1);
  }
  console.log(`✅ FAQ structured-data parity fixtures: ${FIXTURES.length}/${FIXTURES.length} divergence and tolerance cases behave as specified`);
  process.exit(0);
}

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('dist');

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('index.html')) files.push(p);
  }
};
for (const r of roots) {
  if (!fs.existsSync(r)) continue;
  if (fs.statSync(r).isDirectory()) walk(r);
  else files.push(r);
}

let checked = 0;
const failures = [];
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('FAQPage')) continue;
  const blocks = html.match(/"@type":\s*"Question"/g) || [];
  checked += blocks.length;
  for (const msg of checkHtml(html)) failures.push(`${file}: ${msg}`);
}

const label = (f) => f.replace(/^.*?\/dist\//, '/').replace(/\/index\.html$/, '/');
if (failures.length) {
  console.log(`❌ FAQ structured-data answer parity failed (${failures.length} of ${checked} answers diverge):`);
  for (const f of failures) console.log('  - ' + label(f));
  process.exit(1);
}
console.log(`✅ FAQ structured-data answer parity: ${checked} acceptedAnswer texts verbatim in visible copy across ${files.length} emitted pages`);
