/**
 * Opt-in Journal acceptance helper. No source writes, JS evaluation, visual
 * owner, Research authority, CLI side effects or CI/gate registration.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

export const G3_READING_SECTIONS = Object.freeze([
  'overview', 'timeline', 'finance', 'governance', 'buice', 'buck',
  'wind-down', 'unknowns', 'documents',
]);
const attr = (node, key) => node.attrs?.find(({ name }) => name === key)?.value;
const all = (node, predicate) => [
  ...(predicate(node) ? [node] : []),
  ...(node.childNodes || []).flatMap((child) => all(child, predicate)),
];
const raw = (node) => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(raw).join('');
export const normalizeReadingText = (value) => value.replace(/\s+/gu, ' ').trim();
const text = (node) => normalizeReadingText(raw(node));
const hash = (value) => createHash('sha256').update(value).digest('hex');
// Figure UI (e.g. JournalDataFigure's generated unit paragraph) is not a
// source-owned reading paragraph. Its separate data/figure contract still applies.
const readingParagraphs = (section) => all(section, (node) => {
  if (node.tagName !== 'p' || !text(node)) return false;
  for (let parent = node.parentNode; parent && parent !== section; parent = parent.parentNode) {
    if (['figure', 'journaldatafigure'].includes(parent.tagName)) return false;
  }
  return true;
});

/** Ordered source expectations. Unknown expressions are visible exclusions. */
export function readingExpectation(source, { sections = G3_READING_SECTIONS, expressions = {} } = {}) {
  assert.equal(typeof source, 'string');
  assert.ok(sections.length && new Set(sections).size === sections.length, 'Unique reading sections required');
  const frontmatter = /^---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/;
  assert.match(source, frontmatter, 'Expected Astro frontmatter');
  let template = source.replace(frontmatter, '');
  // Only literal whitespace, not arbitrary Astro expressions, is interpreted.
  template = template.replace(/\{(['"])([ \t\r\n]*)\1\}/g, (_, quote, space) => space);
  for (const [expression, value] of Object.entries(expressions)) {
    assert.match(expression, /^[\w.[\]()]+$/, 'Explicit expression key required');
    assert.equal(typeof value, 'string');
    assert.ok(!/[<>{}]/.test(value), 'Expression projection must be plain text');
    template = template.split(`{${expression}}`).join(value);
  }
  const doc = parse(template), result = [], excluded = [];
  for (const id of sections) {
    const matches = all(doc, (node) => attr(node, 'id') === id);
    assert.equal(matches.length, 1, `${id}: exactly one source section required`);
    const paragraphs = readingParagraphs(matches[0]);
    const expected = [];
    for (const [index, paragraph] of paragraphs.entries()) {
      const value = raw(paragraph);
      if (/[{}]/.test(value)) excluded.push({ section: id, index, reason: 'unsupported dynamic expression', text: text(paragraph) });
      else if (text(paragraph)) expected.push({ index, text: text(paragraph) });
    }
    assert.ok(expected.length, `${id}: no literal reading paragraphs`);
    result.push({ id, paragraphs: expected });
  }
  return { version: 1, sourceSha256: hash(source), sections: result, excluded };
}

/**
 * Each literal source paragraph must be present at its actual paragraph index.
 * This catches missing inline spaces, missing/duplicated/reordered paragraphs.
 * Do not use includes(), a Set, per-text-node trim or whitespace removal here.
 */
export function assertReadingParity(expectation, html) {
  assert.equal(expectation.version, 1);
  const doc = parse(html), sections = [];
  let checked = 0;
  for (const { id, paragraphs } of expectation.sections) {
    const matches = all(doc, (node) => attr(node, 'id') === id);
    assert.equal(matches.length, 1, `${id}: exactly one rendered section required`);
    const rendered = readingParagraphs(matches[0]).map(text);
    const excluded = expectation.excluded.filter((entry) => entry.section === id).length;
    assert.equal(rendered.length, paragraphs.length + excluded, `${id}: paragraph count changed`);
    for (const paragraph of paragraphs) {
      assert.equal(rendered[paragraph.index], paragraph.text,
        `${id} paragraph ${paragraph.index + 1}: source→DOM word boundaries/order changed`);
      checked++;
    }
    sections.push({ id, checked: paragraphs.length, unsupportedDynamic: excluded,
      orderedTextSha256: hash(paragraphs.map((p) => p.text).join('\n')) });
  }
  return { checked, sections, excluded: expectation.excluded, sourceSha256: expectation.sourceSha256, htmlSha256: hash(html) };
}

/** Source-side SSR contract, independent of CSS and of the adapter's JS. */
export function citationInventory(html, { expectedSources, fallback = '#documents' } = {}) {
  assert.ok(Array.isArray(expectedSources) && expectedSources.length > 0, 'Explicit approved source IDs required');
  assert.equal(new Set(expectedSources).size, expectedSources.length, 'Unique approved source IDs required');
  const doc = parse(html), nodes = all(doc, (node) => Boolean(node.tagName));
  const ids = nodes.map((node) => attr(node, 'id')).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate DOM IDs');
  const article = nodes.filter((node) => attr(node, 'data-journal-source-navigation') !== undefined);
  assert.equal(article.length, 1, 'One source-navigation owner required');
  const sources = all(article[0], (node) => (attr(node, 'class') || '').split(/\s+/).includes('bibliography-item'));
  assert.deepEqual(sources.map((node) => attr(node, 'id')).sort(), [...expectedSources].sort(), 'Approved bibliography targets changed');
  for (const source of sources) {
    assert.equal(attr(source, 'tabindex'), '-1', `${attr(source, 'id')}: native source focus target`);
    const returns = all(source, (node) => node.tagName === 'a' && attr(node, 'data-journal-source-return') !== undefined);
    assert.equal(returns.length, 1, 'One existing return control per source, never a parallel control');
    assert.equal(attr(returns[0], 'href'), fallback, 'SSR/direct/no-JS fallback must remain honest');
    assert.ok(ids.includes(fallback.slice(1)), 'Missing fallback target');
    assert.notEqual(attr(returns[0], 'data-pagefind-ignore'), undefined, 'Navigation text must not pollute search');
  }
  const citations = all(article[0], (node) => node.tagName === 'a' && attr(node, 'href')?.startsWith('#src-')).map((node) => {
    const id = attr(node, 'id'), href = attr(node, 'href');
    assert.ok(id?.startsWith('cite-'), 'Stable SSR citation ID required');
    assert.notEqual(attr(node, 'data-journal-citation'), undefined, 'Existing citation must use the one adapter');
    assert.ok(expectedSources.includes(href.slice(1)), 'Citation must target an approved source');
    return { id, href, text: text(node) };
  });
  assert.ok(citations.length, 'No citations tested');
  const toc = nodes.filter((node) => attr(node, 'data-journal-contents') !== undefined);
  assert.equal(toc.length, 1, 'One native contents owner required');
  assert.equal(toc[0].tagName, 'details', 'Preserve the selected native TOC');
  const tocLinks = all(toc[0], (node) => node.tagName === 'a').map((node) => attr(node, 'href'));
  assert.ok(tocLinks.length > 0 && new Set(tocLinks).size === tocLinks.length, 'Unique TOC entries required');
  for (const href of tocLinks) assert.ok(href?.startsWith('#') && ids.includes(href.slice(1)), 'Broken TOC fragment');
  return { citations, sources: sources.map((node) => attr(node, 'id')), fallback, tocLinks };
}
