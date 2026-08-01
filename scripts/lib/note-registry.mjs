import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED_START = '<!-- NOTE_REGISTRY:START -->';
export const GENERATED_END = '<!-- NOTE_REGISTRY:END -->';
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW_TEXT = new Set(['script','style','textarea','title']);
const INTERACTIVE_TAGS = new Set(['a','button','input','select','textarea','summary']);
const CONTEXT_TAGS = new Set(['p','li','blockquote','td','th','dd','dt','figcaption','caption']);
const STABLE_ID_RE = /^[a-z][a-z0-9-]{2,127}$/;

export function normalizeRoute(value) {
  let route = String(value || '/').split(/[?#]/)[0].replace(/\\/g, '/');
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/\/index\.html$/u, '/').replace(/\/{2,}/g, '/');
  if (route !== '/' && !route.endsWith('/')) route += '/';
  return route;
}

export function routeFromFile(distRoot, file) {
  const rel = path.relative(distRoot, file).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (!rel.endsWith('/index.html')) return null;
  return normalizeRoute(`/${rel.slice(0, -'index.html'.length)}`);
}

function parseAttributes(openTag) {
  const attrs = Object.create(null);
  const body = openTag.replace(/^<\/?[a-zA-Z][\w:-]*/, '').replace(/\/?>\s*$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

function classes(node) {
  return new Set(String(node.attrs.class || '').split(/\s+/).filter(Boolean));
}

export function parseElements(html) {
  const roots = [];
  const stack = [];
  const all = [];
  const re = /<\/?([a-zA-Z][\w:-]*)(?:\s[^<>]*?)?>/g;
  let match;
  while ((match = re.exec(html))) {
    const raw = match[0];
    const tag = match[1].toLowerCase();
    const closing = raw.startsWith('</');
    if (closing) {
      let index = stack.length - 1;
      while (index >= 0 && stack[index].tag !== tag) index -= 1;
      if (index < 0) continue;
      while (stack.length - 1 > index) {
        const dangling = stack.pop();
        dangling.endStart = match.index;
        dangling.end = match.index;
      }
      const node = stack.pop();
      node.endStart = match.index;
      node.end = re.lastIndex;
      continue;
    }
    const node = {
      tag,
      start: match.index,
      openEnd: re.lastIndex,
      endStart: re.lastIndex,
      end: re.lastIndex,
      openTag: raw,
      attrs: parseAttributes(raw),
      parent: stack.at(-1) || null,
      children: [],
    };
    if (node.parent) node.parent.children.push(node); else roots.push(node);
    all.push(node);
    const selfClosing = raw.endsWith('/>') || VOID.has(tag);
    if (selfClosing) continue;
    if (RAW_TEXT.has(tag)) {
      const closeRe = new RegExp(`</${tag}\\s*>`, 'ig');
      closeRe.lastIndex = re.lastIndex;
      const close = closeRe.exec(html);
      if (close) {
        node.endStart = close.index;
        node.end = closeRe.lastIndex;
        re.lastIndex = closeRe.lastIndex;
      } else {
        node.endStart = html.length;
        node.end = html.length;
        re.lastIndex = html.length;
      }
      continue;
    }
    stack.push(node);
  }
  while (stack.length) {
    const node = stack.pop();
    node.endStart = html.length;
    node.end = html.length;
  }
  return { roots, all };
}

function descendants(node, predicate, output = []) {
  for (const child of node.children) {
    if (predicate(child)) output.push(child);
    descendants(child, predicate, output);
  }
  return output;
}

function isDescendantOf(node, ancestor) {
  for (let current = node?.parent; current; current = current.parent) if (current === ancestor) return true;
  return false;
}

function stripTags(value) {
  return decodeEntities(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?…])/g, '$1')
    .trim();
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_all, token) => {
    if (token[0] === '#') {
      const radix = token[1].toLowerCase() === 'x' ? 16 : 10;
      const raw = token.replace(/^#x?/i, '');
      const point = Number.parseInt(raw, radix);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _all;
    }
    return named[token.toLowerCase()] ?? _all;
  });
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function stableRouteSlug(route) {
  return normalizeRoute(route).replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '') || 'home';
}

function nearestHeadingContext(html, marker) {
  const prefix = html.slice(0, marker.start);
  const headingRe = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let match;
  let last = null;
  while ((match = headingRe.exec(prefix))) last = match;
  if (!last) return '';
  const attrs = parseAttributes(`<h${last[1]}${last[2]}>`);
  const anchor = attrs.id || attrs['data-section-id'] || '';
  return `${anchor} ${stripTags(last[3])}`.trim();
}

function lexicalContextContainer(html, marker) {
  const candidates = [];
  for (const tag of CONTEXT_TAGS) {
    const tokenRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
    const stack = [];
    let match;
    while ((match = tokenRe.exec(html)) && match.index < marker.start) {
      const raw = match[0];
      if (raw.startsWith('</')) stack.pop();
      else if (!raw.endsWith('/>')) {
        stack.push({
          tag,
          start: match.index,
          openEnd: tokenRe.lastIndex,
          openTag: raw,
          attrs: parseAttributes(raw),
        });
      }
    }
    const open = stack.at(-1);
    if (!open) continue;
    let depth = 1;
    tokenRe.lastIndex = marker.end;
    while ((match = tokenRe.exec(html))) {
      const raw = match[0];
      if (raw.startsWith('</')) depth -= 1;
      else if (!raw.endsWith('/>')) depth += 1;
      if (depth === 0) {
        candidates.push({ ...open, endStart: match.index, end: tokenRe.lastIndex });
        break;
      }
    }
  }
  return candidates.sort((left, right) => right.start - left.start)[0] || null;
}

function authoredContext(html, marker) {
  const lexical = lexicalContextContainer(html, marker);
  let tree = marker.parent;
  while (tree && !CONTEXT_TAGS.has(tree.tag)) tree = tree.parent;
  const container = lexical || tree;
  const containerAnchor = container
    ? [container.attrs.id, container.attrs['data-section-id'], container.attrs['data-source-id']].filter(Boolean).join(' ')
    : '';
  const before = container
    ? stripTags(html.slice(container.openEnd, marker.start)).slice(-768)
    : '';
  const after = container
    ? stripTags(html.slice(marker.end, container.endStart)).slice(0, 768)
    : '';
  return [
    nearestHeadingContext(html, marker),
    container?.tag || '',
    containerAnchor,
    `before:${before}`,
    `after:${after}`,
  ].join(' ').replace(/\s+/g, ' ').trim();
}

function contentHash(route, text, context) {
  return crypto.createHash('sha256')
    .update(`${normalizeRoute(route)}\0${text}\0${context}`)
    .digest('hex')
    .slice(0, 12);
}

function numericLabel(markerText) {
  const match = String(markerText || '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function setAttributes(openTag, additions) {
  let next = openTag;
  for (const [name, rawValue] of Object.entries(additions)) {
    const value = String(rawValue);
    const re = new RegExp(`\\s${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
    if (re.test(next)) next = next.replace(re, ` ${name}="${escapeHtml(value)}"`);
    else next = next.replace(/\s*\/?>$/, (end) => ` ${name}="${escapeHtml(value)}"${end}`);
  }
  return next;
}

function sanitizeNoteHtml(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<button\b[^>]*data-tooltip-close[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/\s(?:id|aria-hidden|data-note-id|data-note-ordinal|data-pagefind-ignore)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .trim();
}

function removeGenerated(html) {
  const start = html.indexOf(GENERATED_START);
  const end = html.indexOf(GENERATED_END);
  if (start < 0 && end < 0) return html;
  if (start < 0 || end < start) throw new Error('note registry generated block is malformed');
  const before = html.slice(0, start).replace(/[ \t]*\n?$/, '');
  const after = html.slice(end + GENERATED_END.length).replace(/^\n?[ \t]*/, '');
  return before + after;
}

function findDirectTip(marker) {
  return descendants(marker, (node) => classes(node).has('tooltip'));
}

function nestedControlsOutsideTip(marker, tip) {
  return descendants(marker, (node) => {
    if (node === tip || isDescendantOf(node, tip)) return false;
    if (INTERACTIVE_TAGS.has(node.tag)) return true;
    const role = String(node.attrs.role || '').toLowerCase();
    if (role === 'button' || role === 'link') return true;
    return Object.prototype.hasOwnProperty.call(node.attrs, 'tabindex') && node.attrs.tabindex !== '-1';
  });
}

function buildEndnotes(route, notes) {
  if (!notes.length) return '';
  const routeSlug = stableRouteSlug(route);
  const headingId = `note-endnotes-${routeSlug}`;
  const items = notes.map((note) => `      <li id="${note.endnoteId}" data-note-id="${note.id}" data-note-ordinal="${note.ordinal}"><span class="gb-note-endnotes__ordinal" aria-hidden="true">${note.ordinal}.</span> <span class="gb-note-endnotes__content">${escapeHtml(note.text)}</span> <a class="gb-note-endnotes__back" href="#${note.refId}" aria-label="Вернуться к отметке ${note.ordinal}">↩</a></li>`).join('\n');
  return `${GENERATED_START}
<style data-note-registry-style>
.gb-note-endnotes{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:normal!important;border:0!important}
.gb-note-endnotes:focus-within{position:static!important;width:auto!important;height:auto!important;margin:2rem 0!important;overflow:visible!important;clip:auto!important}
@media print{.gb-note-endnotes{display:block!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;margin:2rem 0 0!important;padding:0!important;overflow:visible!important;clip:auto!important;clip-path:none!important;visibility:visible!important;opacity:1!important;content-visibility:visible!important;contain:none!important;transform:none!important;color:#111!important;font-size:10pt!important;line-height:1.45!important;break-before:auto!important;page-break-before:auto!important;break-after:auto!important;page-break-after:auto!important}.gb-note-endnotes,.gb-note-endnotes *{visibility:visible!important;opacity:1!important;content-visibility:visible!important;clip:auto!important;clip-path:none!important;transform:none!important;color:#111!important}.gb-note-endnotes h2{display:block!important;font-size:18pt!important;line-height:1.2!important;break-after:avoid-page!important;page-break-after:avoid!important}.gb-note-endnotes ol{display:block!important;margin:.75rem 0 0!important;padding-left:1.5rem!important;list-style:decimal!important;overflow:visible!important;font-size:10pt!important;line-height:1.45!important}.gb-note-endnotes li{display:list-item!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;margin:0 0 .55rem!important;padding:0!important;overflow:visible!important;clip:auto!important;white-space:normal!important;font-size:10pt!important;line-height:1.45!important;break-inside:auto!important;page-break-inside:auto!important}.gb-note-endnotes__content{display:inline!important;position:static!important;width:auto!important;height:auto!important;overflow:visible!important;white-space:normal!important}.fn-marker>.tooltip{display:none!important}.gb-note-endnotes__back{display:none!important}}
</style>
<noscript data-note-registry-noscript><style>.gb-note-endnotes{position:static!important;width:auto!important;height:auto!important;margin:2rem 0!important;overflow:visible!important;clip:auto!important}</style></noscript>
<section class="gb-note-endnotes" data-note-registry-endnotes data-speakable data-pagefind-body aria-labelledby="${headingId}">
  <h2 id="${headingId}">Примечания</h2>
  <ol>
${items}
  </ol>
</section>
${GENERATED_END}`;
}

export function collectAndProjectHtml(inputHtml, route, options = {}) {
  const html = removeGenerated(String(inputHtml));
  const parsed = parseElements(html);
  const markers = parsed.all.filter((node) => classes(node).has('fn-marker') && !classes(node).has('map-trigger'));
  const errors = [];
  const notes = [];
  const ids = new Map();
  const ordinals = new Map();
  const patches = [];
  const routeSlug = stableRouteSlug(route);

  markers.forEach((marker, index) => {
    const ordinal = index + 1;
    const tips = findDirectTip(marker);
    if (tips.length !== 1) {
      errors.push(`${route}: marker ${ordinal} expected one .tooltip, found ${tips.length}`);
      return;
    }
    const tip = tips[0];
    const nested = nestedControlsOutsideTip(marker, tip);
    if (nested.length) errors.push(`${route}: marker ${ordinal} contains nested interactive controls outside tooltip`);

    const markerPrefix = html.slice(marker.openEnd, tip.start);
    const markerSuffix = html.slice(tip.end, marker.endStart);
    const markerText = stripTags(markerPrefix + markerSuffix);
    const noteHtml = sanitizeNoteHtml(html.slice(tip.openEnd, tip.endStart));
    const noteText = stripTags(noteHtml);
    if (!noteText) errors.push(`${route}: marker ${ordinal} has empty note content`);
    const visibleOrdinal = numericLabel(markerText);
    const authoredId = String(marker.attrs['data-note-id'] || '').trim();
    if (authoredId && !STABLE_ID_RE.test(authoredId)) errors.push(`${route}: invalid authored data-note-id=${authoredId}`);
    const context = authoredContext(html, marker);
    const id = authoredId || `${routeSlug}-note-${contentHash(route, noteText, context)}`;
    if (ids.has(id)) errors.push(`${route}: duplicate note id ${id} at ordinals ${ids.get(id)} and ${ordinal}`);
    else ids.set(id, ordinal);
    if (ordinals.has(ordinal)) errors.push(`${route}: duplicate ordinal ${ordinal}`);
    else ordinals.set(ordinal, id);
    const authoredOrdinal = marker.attrs['data-note-ordinal'];
    if (authoredOrdinal !== undefined && Number(authoredOrdinal) !== ordinal) {
      errors.push(`${route}: ordinal drift for ${id}; authored=${authoredOrdinal} actual=${ordinal}`);
    }

    const refId = marker.attrs.id || `note-ref-${id}`;
    const tipId = tip.attrs.id || `note-tip-${id}`;
    const endnoteId = `note-end-${id}`;
    const record = {
      id, route: normalizeRoute(route), ordinal, visibleOrdinal,
      markerText, text: noteText, html: noteHtml,
      refId, tipId, endnoteId,
      authoredSource: '.fn-marker > .tooltip',
      interactionOwner: 'SiteUtils.makeTooltipController',
      projections: ['popover', 'aria-describedby', 'screen-reader-endnote', 'tts-endnote', 'pagefind-endnote', 'print-endnote', 'no-js-endnote'],
    };
    notes.push(record);
    patches.push({ start: marker.start, end: marker.openEnd, value: setAttributes(marker.openTag, {
      id: refId,
      'data-note-id': id,
      'data-note-ordinal': ordinal,
      'aria-describedby': endnoteId,
      'aria-controls': tipId,
    }) });
    patches.push({ start: tip.start, end: tip.openEnd, value: setAttributes(tip.openTag, {
      id: tipId,
      role: tip.attrs.role || 'tooltip',
      'data-note-id': id,
      'data-note-ordinal': ordinal,
      'data-pagefind-ignore': '',
      'data-note-registry-tooltip': '',
    }) });
  });

  if (errors.length) return { html, notes, errors, changed: false };
  if (notes.length) {
    const containsEveryMarker = (node) => markers.every((marker) => marker.start >= node.openEnd && marker.end <= node.endStart);
    const byNarrowestRange = (left, right) => (left.endStart - left.openEnd) - (right.endStart - right.openEnd);
    const articleOwner = parsed.all
      .filter((node) => node.tag === 'article' && containsEveryMarker(node))
      .sort(byNarrowestRange)[0];
    const searchable = parsed.all
      .filter((node) => Object.prototype.hasOwnProperty.call(node.attrs, 'data-pagefind-body') && containsEveryMarker(node))
      .sort(byNarrowestRange)[0];
    const fallback = parsed.all
      .filter((node) => (node.tag === 'main' || node.tag === 'article') && containsEveryMarker(node))
      .sort(byNarrowestRange)[0];
    const insertion = articleOwner?.end ?? searchable?.endStart ?? fallback?.endStart ?? -1;
    if (insertion < 0) errors.push(`${route}: notes exist but no common searchable, main or article insertion point`);
    else patches.push({ start: insertion, end: insertion, value: `\n${buildEndnotes(route, notes)}\n` });
  }
  if (errors.length) return { html, notes, errors, changed: false };
  let projected = html;
  for (const patch of patches.sort((a, b) => b.start - a.start)) {
    projected = projected.slice(0, patch.start) + patch.value + projected.slice(patch.end);
  }
  return { html: projected, notes, errors, changed: projected !== inputHtml };
}

function walkHtml(root, output = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) walkHtml(file, output);
    else if (entry.isFile() && entry.name === 'index.html') output.push(file);
  }
  return output;
}

function stableRegistry(notes, sourceCommit) {
  const routes = {};
  for (const note of notes) {
    routes[note.route] ||= { count: 0, notes: [] };
    routes[note.route].notes.push(note);
    routes[note.route].count += 1;
  }
  return {
    schemaVersion: 1,
    contract: 'A03-note-registry',
    sourceCommit: sourceCommit || process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || 'unknown',
    sourceModel: 'authored-inline-tooltip-captured-once-then-unified-projection',
    interactionOwner: 'SiteUtils.makeTooltipController',
    routeCount: Object.keys(routes).length,
    noteCount: notes.length,
    routes,
  };
}

function markdownReport(registry, filesChanged, errors) {
  const lines = [
    '# A03 NoteRegistry projection', '',
    `- Routes with notes: **${registry.routeCount}**`,
    `- Notes: **${registry.noteCount}**`,
    `- HTML files changed: **${filesChanged}**`,
    `- Errors: **${errors.length}**`,
    `- Interaction owner: \`${registry.interactionOwner}\``, '',
    '| Route | Notes |', '|---|---:|',
  ];
  for (const [route, value] of Object.entries(registry.routes)) lines.push(`| \`${route}\` | ${value.count} |`);
  if (errors.length) lines.push('', '## Errors', '', ...errors.map((error) => `- ${error}`));
  return `${lines.join('\n')}\n`;
}

export function projectNoteRegistry(options = {}) {
  const distRoot = path.resolve(options.distRoot || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist'));
  const dryRun = Boolean(options.dryRun);
  if (!fs.existsSync(distRoot)) throw new Error(`dist root missing: ${distRoot}`);
  const files = walkHtml(distRoot).sort();
  const allNotes = [];
  const errors = [];
  let filesChanged = 0;
  for (const file of files) {
    const route = routeFromFile(distRoot, file);
    if (!route) continue;
    const source = fs.readFileSync(file, 'utf8');
    const result = collectAndProjectHtml(source, route, options);
    errors.push(...result.errors);
    allNotes.push(...result.notes);
    if (result.changed) {
      filesChanged += 1;
      if (!dryRun) fs.writeFileSync(file, result.html, 'utf8');
    }
  }
  if (!allNotes.length) errors.push('no authored footnotes found in production-like dist');
  const globalIds = new Map();
  for (const note of allNotes) {
    if (globalIds.has(note.id)) errors.push(`global duplicate note id ${note.id} in ${globalIds.get(note.id)} and ${note.route}`);
    else globalIds.set(note.id, note.route);
  }
  const registry = stableRegistry(allNotes, options.sourceCommit);
  const report = {
    registry,
    filesScanned: files.length,
    filesChanged,
    errors,
    dryRun,
  };
  if (errors.length) throw new Error(`NoteRegistry projection failed:\n- ${errors.join('\n- ')}`);
  if (!dryRun) {
    const dataDir = path.join(distRoot, 'data');
    const reportDir = path.resolve(options.reportDir || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'reports'));
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'note-registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(reportDir, 'a03-note-registry.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(reportDir, 'a03-note-registry.md'), markdownReport(registry, filesChanged, errors), 'utf8');
  }
  return report;
}
