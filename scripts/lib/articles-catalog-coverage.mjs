/**
 * Opt-in /articles/ acceptance, not a publication registry or UI owner.
 * Manifest ∩ production ownership determines membership; explicit HOLD vetoes.
 * Text comparisons collapse whitespace, never delete it, reorder or title-dedup.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

export const CATALOG_ROUTE = '/articles/';
export const CATALOG_SELECTORS = Object.freeze({
  library: '[data-catalog-source="search-manifest+page-ownership"]',
  published: '[data-catalog-route], [data-catalog-series]',
  curated: '#razbor',
});
const ORIGIN = 'https://catalog-contract.invalid';
export const catalogText = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();
const digest = (value) => createHash('sha256').update(value).digest('hex');
const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const has = (node, name) => attr(node, name) !== undefined;
const classes = (node) => (attr(node, 'class') || '').split(/\s+/);
const all = (node, predicate) => [
  ...(predicate(node) ? [node] : []),
  ...(node.childNodes || []).flatMap((child) => all(child, predicate)),
];
const raw = (node) => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(raw).join('');
const text = (node) => catalogText(raw(node));
const headings = (node) => all(node, (n) => /^h[2-6]$/.test(n.tagName || ''));
const roles = (node) => all(node, (n) => has(n, 'data-catalog-role') || classes(n).includes('h-meta-author'));
const summaries = (node) => {
  const marked = all(node, (n) => has(n, 'data-catalog-description') || classes(n).includes('h-article-abstract'));
  if (marked.length) return marked;
  return all(node, (n) => {
    if (n.tagName !== 'p' || has(n, 'data-catalog-role')) return false;
    for (let p = n; p && p !== node; p = p.parentNode) {
      if (has(p, 'data-catalog-role') || classes(p).some((c) => /(?:^|-)meta(?:-|$)/.test(c))) return false;
    }
    return true;
  });
};

/** Root-relative authorities, or explicit native relative hrefs at the DOM edge. */
export function catalogDestination(value, { relative = false } = {}) {
  assert.ok(typeof value === 'string' && value && value === value.trim(), 'Catalog URL must be a nonempty literal');
  assert.ok(!/[\\\s\u0000-\u001f\u007f]/u.test(value), `Invalid catalog URL: ${value}`);
  assert.ok(!value.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(value), 'Catalog URL must be same-origin, not a protocol');
  assert.ok(relative || value.startsWith('/'), 'Catalog authority must be root-relative');
  assert.ok(!value.startsWith('#') && !value.includes('?'), 'Catalog destination needs a route, without query');
  for (const segment of value.split('#')[0].split('/')) {
    const decoded = decodeURIComponent(segment);
    assert.ok(!['.', '..'].includes(decoded) && !/[\\/\u0000-\u0020\u007f]/u.test(decoded), 'Unsafe catalog path segment');
  }
  const url = new URL(value, ORIGIN + CATALOG_ROUTE);
  assert.equal(url.origin, ORIGIN, 'Catalog destination left the site');
  assert.ok(url.pathname.endsWith('/'), 'Catalog destination must be a native trailing-slash route');
  assert.ok(!value.endsWith('#'), 'Empty catalog fragment');
  const fragment = url.hash ? decodeURIComponent(url.hash.slice(1)) : null;
  assert.ok(!fragment || !/[\u0000-\u001f\u007f]/u.test(fragment), 'Invalid catalog fragment');
  return { href: url.pathname + url.hash, route: url.pathname, fragment };
}

/** Public role policy, independently asserted against rendered labels. */
export function catalogAttribution(item) {
  const author = catalogText(item.author), editor = catalogText(item.editor), translator = catalogText(item.translator);
  if (author && author === editor && !translator) return { kind: 'author-editor', label: `Автор-редактор: ${author}` };
  assert.ok(!((author === 'Фёдор Милованов' || translator === 'Фёдор Милованов') && !editor),
    `Owner attribution missing editor authority: ${item.url}`);
  if (editor) return { kind: 'editor', label: `Ред.: ${editor}` };
  if (author) return { kind: 'author', label: `Автор: ${author}` };
  if (translator) return { kind: 'translator', label: `Перевод: ${translator}` };
  return { kind: 'site', label: 'Господь Бог — Сила Моя' };
}
const held = (record) => ['status', 'publicationStatus', 'publicationGate'].some((key) => record?.[key] === 'PUBLICATION_HOLD');
function staticAvailable(node, label, { link = false } = {}) {
  if (link) {
    assert.equal(node.tagName, 'a', `${label}: must be a native anchor`);
    assert.ok(!has(node, 'tabindex') || (/^\+?\d+$/.test(attr(node, 'tabindex')) && Number(attr(node, 'tabindex')) >= 0), `${label}: link removed from Tab order`);
    assert.ok(!has(node, 'role') || attr(node, 'role') === 'link', `${label}: native link role changed`);
  }
  for (let n = node; n; n = n.parentNode) {
    assert.ok(!has(n, 'hidden') && !has(n, 'inert') && attr(n, 'aria-hidden') !== 'true' && attr(n, 'aria-disabled') !== 'true', `${label}: hidden/inert/disabled content`);
    assert.ok(!['template', 'script', 'style'].includes(n.tagName), `${label}: non-rendered content`);
    const style = Object.fromEntries((attr(n, 'style') || '').split(';').filter((v) => v.includes(':')).map((v) => {
      const i = v.indexOf(':'); return [v.slice(0, i).trim().toLowerCase(), v.slice(i + 1).replace(/\s*!important\s*$/i, '').trim().toLowerCase()];
    }));
    assert.ok(style.display !== 'none' && !['hidden', 'collapse'].includes(style.visibility) && style['content-visibility'] !== 'hidden'
      && (style.opacity === undefined || Number(style.opacity) !== 0), `${label}: hidden by inline CSS`);
  }
}
function field(card, candidates, label, required) {
  assert.equal(candidates.length, required ? 1 : 0, `${label}: expected ${required ? 'one' : 'no'} field`);
  if (!required) return '';
  // Include descendants: a hidden exact string must not make a visible drift pass.
  for (const n of all(candidates[0], (n) => Boolean(n.tagName))) staticAvailable(n, label);
  return text(candidates[0]);
}
function cardRecord(card, { type, href, expected, curated = false }) {
  staticAvailable(card, href, { link: true });
  const destination = catalogDestination(attr(card, 'href'), { relative: true });
  assert.equal(destination.href, href, `${href}: marker/source and actual href differ`);
  assert.doesNotMatch(text(card), /Автор:\s*Фёдор\s+Милованов/u, `${href}: forbidden owner-as-author label`);
  const title = field(card, headings(card), `${href} title`, true);
  const description = field(card, summaries(card), `${href} description`, Boolean(expected.description));
  assert.equal(title, expected.title, `${href}: title word boundaries/order/content changed`);
  assert.equal(description, expected.description, `${href}: description word boundaries/order/content changed`);
  const roleNodes = roles(card);
  const roleRequired = type === 'article' || curated;
  assert.ok(roleNodes.length <= 1, `${href}: duplicate attribution`);
  assert.ok(!roleRequired || roleNodes.length === 1, `${href}: missing attribution`);
  let role = null;
  if (roleNodes.length) {
    const roleText = field(card, roleNodes, `${href} attribution`, true);
    assert.equal(roleText, expected.attribution.label, `${href}: attribution text drift`);
    if (!curated || has(roleNodes[0], 'data-catalog-role')) assert.equal(attr(roleNodes[0], 'data-catalog-role'), expected.attribution.kind, `${href}: attribution role drift`);
    role = { kind: expected.attribution.kind, label: roleText };
  }
  return { type, href, title, description, role };
}
function curatedFromSource(source) {
  assert.equal(typeof source, 'string', 'Curated Astro source is required, never a copied card registry');
  const frontmatter = /^---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/;
  assert.match(source, frontmatter, 'Curated source needs Astro frontmatter');
  const template = source.replace(frontmatter, '').replace(/\{(['"])([ \t\r\n]*)\1\}/g, (_, quote, space) => space);
  const doc = parse(template), sections = all(doc, (n) => attr(n, 'id') === 'razbor');
  assert.equal(sections.length, 1, 'Exactly one source curated section #razbor required');
  const cards = all(sections[0], (n) => n.tagName === 'a');
  assert.ok(cards.length, 'Curated repeat must not disappear');
  return cards.map((card) => {
    const { href } = catalogDestination(attr(card, 'href'), { relative: true });
    const title = field(card, headings(card), `${href} curated source title`, true);
    const ps = summaries(card);
    assert.ok(ps.length <= 1, 'Curated source has ambiguous description');
    const description = ps.length ? field(card, ps, `${href} curated source description`, true) : '';
    const label = field(card, roles(card), `${href} curated source attribution`, true);
    assert.ok(!/[{}]/.test(title + description + label + attr(card, 'href')), 'Unsupported dynamic curated expression; add a bounded source adapter, never eval/skip');
    const prefixes = [['Автор-редактор:', 'author-editor'], ['Ред.:', 'editor'], ['Автор:', 'author'], ['Перевод:', 'translator']];
    const kind = prefixes.find(([prefix]) => label.startsWith(prefix))?.[1];
    assert.ok(kind, 'Unknown curated attribution policy');
    assert.doesNotMatch(label, /Автор:\s*Фёдор\s+Милованов/u);
    return { href, title, description, attribution: { kind, label } };
  });
}

export function catalogExpectation({ manifest, ownership, curatedSource }) {
  assert.ok(Array.isArray(manifest?.items) && ownership?.routes && typeof ownership.routes === 'object', 'Existing manifest and route ownership required');
  const published = [], excluded = [];
  for (const item of manifest.items.filter((i) => ['article', 'series'].includes(i.type))) {
    const dest = catalogDestination(item.url), owner = ownership.routes[dest.route];
    if (owner?.status !== 'production-dist' || held(item) || held(owner)) {
      excluded.push({ ...dest, type: item.type, status: owner?.status ?? null, reason: held(item) || held(owner) ? 'PUBLICATION_HOLD' : 'not-production-owned' });
      continue;
    }
    published.push({ ...dest, type: item.type, title: catalogText(item.title || item.id || item.url), description: catalogText(item.description), attribution: catalogAttribution(item) });
  }
  assert.ok(published.length, 'No published article/series coverage');
  assert.equal(new Set(published.map((i) => i.href)).size, published.length, 'Duplicate published destination, not a title-based deduplication');
  const curated = curatedFromSource(curatedSource);
  assert.equal(new Set(curated.map((i) => i.href)).size, curated.length, 'Duplicate curated source entry');
  for (const item of curated) assert.ok(published.some((p) => p.href === item.href), `${item.href}: curated repeat must reference a published destination, never an extra publication`);
  return { version: 1, counts: { article: published.filter((i) => i.type === 'article').length, series: published.filter((i) => i.type === 'series').length },
    published, excluded, curated, curatedSourceSha256: digest(curatedSource) };
}

/** Actual SSR anchors, not just data attributes or unordered title includes. */
export function assertCatalogHtml(expectation, html) {
  assert.equal(expectation.version, 1);
  const doc = parse(html), libraries = all(doc, (n) => attr(n, 'data-catalog-source') === 'search-manifest+page-ownership');
  assert.equal(libraries.length, 1, 'Exactly one authority-derived catalog owner required');
  const library = libraries[0], marked = all(doc, (n) => has(n, 'data-catalog-route') || has(n, 'data-catalog-series'));
  assert.equal(marked.length, expectation.published.length, 'Published card count differs from dynamic authority');
  const records = [];
  for (const card of marked) {
    let inside = false;
    for (let n = card.parentNode; n; n = n.parentNode) if (n === library) inside = true;
    assert.ok(inside, 'Published marker outside the one exhaustive catalog');
    assert.notEqual(has(card, 'data-catalog-route'), has(card, 'data-catalog-series'), 'One publication type per anchor');
    const type = has(card, 'data-catalog-route') ? 'article' : 'series';
    const marker = attr(card, type === 'article' ? 'data-catalog-route' : 'data-catalog-series');
    const href = catalogDestination(marker).href;
    const expected = expectation.published.find((i) => i.href === href && i.type === type);
    assert.ok(expected, `${href}: extra/unpublished/HOLD or wrong-type card`);
    records.push(cardRecord(card, { type, href, expected }));
  }
  assert.deepEqual(records.map((r) => r.href).sort(), expectation.published.map((r) => r.href).sort(), 'Omitted/duplicated published destinations');
  for (const anchor of all(library, (n) => n.tagName === 'a')) {
    if (marked.includes(anchor)) continue;
    const href = attr(anchor, 'href');
    assert.ok(href?.startsWith('#') && href.length > 1, 'Unmarked/extra catalog destination');
    assert.equal(all(doc, (n) => attr(n, 'id') === decodeURIComponent(href.slice(1))).length, 1, 'Native catalog topic link has no unique SSR target');
    staticAvailable(anchor, href, { link: true });
  }
  const curatedSections = all(doc, (n) => attr(n, 'id') === 'razbor');
  assert.equal(curatedSections.length, 1, 'Curated repeat section missing/duplicated');
  assert.ok(curatedSections[0] !== library, 'Curated and exhaustive membership must stay distinct');
  const curatedCards = all(curatedSections[0], (n) => n.tagName === 'a');
  assert.equal(curatedCards.length, expectation.curated.length, 'Curated repeat count changed');
  const curated = curatedCards.map((card) => {
    const href = catalogDestination(attr(card, 'href'), { relative: true }).href;
    const expected = expectation.curated.find((i) => i.href === href);
    assert.ok(expected, `${href}: unapproved curated destination`);
    assert.ok(!marked.includes(card), 'Curated repeat counted as an extra unique publication');
    return cardRecord(card, { type: 'curated', href, expected, curated: true });
  });
  assert.deepEqual(curated.map((r) => r.href).sort(), expectation.curated.map((r) => r.href).sort(), 'Curated repeat omission/duplication');
  return { counts: expectation.counts, published: records, curated, htmlSha256: digest(html) };
}

/** Serialized by Playwright; no product JS/filters or init-script dependence. */
export function catalogBrowserSnapshot(selectors) {
  const normalize = (v) => String(v ?? '').replace(/\s+/gu, ' ').trim();
  function available(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.left >= innerWidth) return false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (n.hidden || n.inert || n.getAttribute('aria-hidden') === 'true' || n.getAttribute('aria-disabled') === 'true'
        || s.display === 'none' || ['hidden', 'collapse'].includes(s.visibility) || Number(s.opacity) === 0 || s.contentVisibility === 'hidden') return false;
      const b = n.getBoundingClientRect();
      if (['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowX) && (b.right <= r.left || b.left >= r.right)) return false;
      if (['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowY) && (b.bottom <= r.top || b.top >= r.bottom)) return false;
    }
    return true;
  }
  function visibleText(el) {
    if (!el || !available(el)) return false;
    return [...el.querySelectorAll('*')].every((n) => !normalize(n.textContent) || available(n));
  }
  function record(card, scope) {
    const title = card.querySelector('h2,h3,h4,h5,h6');
    let descriptions = [...card.querySelectorAll('[data-catalog-description],.h-article-abstract')];
    if (!descriptions.length) descriptions = [...card.querySelectorAll('p')].filter((p) => {
      for (let n = p; n && n !== card; n = n.parentElement) if (n.hasAttribute('data-catalog-role') || [...n.classList].some((c) => /(?:^|-)meta(?:-|$)/.test(c))) return false;
      return true;
    });
    const description = descriptions[0], role = card.querySelector('[data-catalog-role],.h-meta-author');
    return { scope, type: scope === 'curated' ? 'curated' : card.hasAttribute('data-catalog-route') ? 'article' : 'series',
      href: new URL(card.getAttribute('href'), location.href).pathname + new URL(card.getAttribute('href'), location.href).hash,
      title: normalize(title?.innerText), description: normalize(description?.innerText), role: role ? normalize(role.innerText) : null,
      available: available(card), titleAvailable: visibleText(title), descriptionAvailable: !description || visibleText(description), roleAvailable: !role || visibleText(role),
      nativeTabbable: card.tagName === 'A' && Boolean(card.getAttribute('href')) && card.tabIndex >= 0 && (!card.getAttribute('role') || card.getAttribute('role') === 'link') };
  }
  const library = document.querySelector(selectors.library), curated = document.querySelector(selectors.curated);
  return { published: [...(library?.querySelectorAll(selectors.published) || [])].map((c) => record(c, 'published')),
    curated: [...(curated?.querySelectorAll('a') || [])].map((c) => record(c, 'curated')) };
}
export function assertBrowserCatalog(snapshot, facts) {
  for (const scope of ['published', 'curated']) {
    assert.deepEqual(facts[scope].map((r) => r.href).sort(), snapshot[scope].map((r) => r.href).sort(), `${scope}: browser link set/multiplicity changed`);
    for (const record of facts[scope]) {
      const expected = snapshot[scope].find((r) => r.href === record.href);
      assert.equal(record.type, expected.type, `${record.href}: browser publication type drift`);
      for (const key of ['title', 'description']) assert.equal(record[key], expected[key], `${record.href}: browser ${key} drift`);
      assert.equal(record.role, expected.role?.label ?? null, `${record.href}: browser role drift`);
      for (const key of ['available', 'nativeTabbable', 'titleAvailable', 'descriptionAvailable', 'roleAvailable']) assert.equal(record[key], true, `${record.href}: ${key} failed (CSS/hidden/keyboard)`);
    }
  }
  return { published: facts.published.length, curated: facts.curated.length };
}

/** HTTP status/redirect/fragment checks are separate from manifest ownership. */
export function assertCatalogDestination(destination, { status, redirected = false, contentType, html, responsePath }) {
  assert.equal(status, 200, `${destination.href}: destination HTTP status`);
  assert.equal(redirected, false, `${destination.href}: unexpected redirect`);
  assert.equal(responsePath, destination.route, `${destination.href}: response route mismatch`);
  assert.match(contentType || '', /^text\/html(?:;|$)/i, `${destination.href}: not an HTML destination`);
  if (destination.fragment) {
    const matches = all(parse(html), (n) => attr(n, 'id') === destination.fragment);
    assert.equal(matches.length, 1, `${destination.href}: missing/duplicate destination fragment`);
    staticAvailable(matches[0], destination.href);
  }
  return { href: destination.href, route: destination.route, fragment: destination.fragment, status, htmlSha256: digest(html) };
}
