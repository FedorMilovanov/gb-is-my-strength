import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED_START = '<!-- NOTE_REGISTRY:START -->';
export const GENERATED_END = '<!-- NOTE_REGISTRY:END -->';
export const STYLESHEET_MARKER = 'data-note-registry-stylesheet';

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
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

function classSet(node) {
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
    if (node.parent) node.parent.children.push(node);
    else roots.push(node);
    all.push(node);

    if (raw.endsWith('/>') || VOID_TAGS.has(tag)) continue;
    if (RAW_TEXT_TAGS.has(tag)) {
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

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, token) => {
    if (token.startsWith('#')) {
      const radix = token[1]?.toLowerCase() === 'x' ? 16 : 10;
      const point = Number.parseInt(token.replace(/^#x?/i, ''), radix);
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    }
    return named[token.toLowerCase()] ?? whole;
  });
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stableRouteSlug(route) {
  return normalizeRoute(route)
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'home';
}

function nearestHeadingIdentity(html, marker, allNodes) {
  const heading = allNodes
    .filter((node) => HEADING_TAGS.has(node.tag) && node.start < marker.start)
    .sort((left, right) => right.start - left.start)[0];
  if (!heading) return 'document-root';
  const anchor = String(heading.attrs.id || heading.attrs['data-section-id'] || '').trim();
  const text = stripTags(html.slice(heading.openEnd, heading.endStart));
  return `${heading.tag}:${anchor || text || 'untitled'}`;
}

function contentHash(route, text, headingIdentity) {
  return crypto.createHash('sha256')
    .update(`${normalizeRoute(route)}\0${text}\0${headingIdentity}`)
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
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\s${escapedName}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
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
  return `${before}${after}`;
}

function directTooltipChildren(marker) {
  return marker.children.filter((child) => classSet(child).has('tooltip'));
}

function hasNestedInteractiveControl(marker, tooltip) {
  const visit = (node) => {
    for (const child of node.children) {
      if (child === tooltip) continue;
      const role = String(child.attrs.role || '').toLowerCase();
      const isInteractive = INTERACTIVE_TAGS.has(child.tag)
        || role === 'button'
        || role === 'link'
        || (Object.prototype.hasOwnProperty.call(child.attrs, 'tabindex') && child.attrs.tabindex !== '-1');
      if (isInteractive || visit(child)) return true;
    }
    return false;
  };
  return visit(marker);
}

function buildEndnotes(route, notes) {
  if (!notes.length) return '';
  const headingId = `note-endnotes-${stableRouteSlug(route)}`;
  const items = notes.map((note) => (
    `    <li id="${note.endnoteId}" data-note-id="${note.id}" data-note-ordinal="${note.ordinal}">`
      + `<span class="gb-note-endnotes__ordinal" aria-hidden="true">${note.ordinal}.</span> `
      + `<span class="gb-note-endnotes__content">${note.html}</span> `
      + `<a class="gb-note-endnotes__back" href="#${note.refId}" aria-label="Вернуться к отметке ${note.ordinal}">↩</a>`
      + '</li>'
  )).join('\n');
  return `${GENERATED_START}\n<section class="gb-note-endnotes" data-note-registry-endnotes data-speakable data-pagefind-body aria-labelledby="${headingId}">\n  <h2 id="${headingId}">Примечания</h2>\n  <ol>\n${items}\n  </ol>\n</section>\n${GENERATED_END}`;
}

function injectStylesheet(html, cssHref) {
  const tag = `<link rel="stylesheet" href="${escapeHtml(cssHref)}" ${STYLESHEET_MARKER}>`;
  const existing = new RegExp(`<link\\b[^>]*${STYLESHEET_MARKER}[^>]*>`, 'i');
  if (existing.test(html)) return html.replace(existing, tag);
  if (!/<\/head>/i.test(html)) throw new Error('note registry route has no </head> boundary');
  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

export function collectAndProjectHtml(inputHtml, route, options = {}) {
  const cssHref = options.cssHref || '/css/note-registry.css';
  const html = removeGenerated(String(inputHtml));
  const parsed = parseElements(html);
  const markers = parsed.all.filter((node) => classSet(node).has('fn-marker') && !classSet(node).has('map-trigger'));
  const errors = [];
  const notes = [];
  const ids = new Map();
  const patches = [];
  const routeSlug = stableRouteSlug(route);

  markers.forEach((marker, index) => {
    const ordinal = index + 1;
    const tips = directTooltipChildren(marker);
    if (tips.length !== 1) {
      errors.push(`${normalizeRoute(route)}: marker ${ordinal} expected one direct .tooltip child, found ${tips.length}`);
      return;
    }
    const tip = tips[0];
    if (hasNestedInteractiveControl(marker, tip)) {
      errors.push(`${normalizeRoute(route)}: marker ${ordinal} contains a nested interactive control outside tooltip`);
    }

    const markerText = stripTags(html.slice(marker.openEnd, tip.start) + html.slice(tip.end, marker.endStart));
    const noteHtml = sanitizeNoteHtml(html.slice(tip.openEnd, tip.endStart));
    const noteText = stripTags(noteHtml);
    if (!noteText) errors.push(`${normalizeRoute(route)}: marker ${ordinal} has empty note content`);

    const authoredId = String(marker.attrs['data-note-id'] || '').trim();
    if (authoredId && !STABLE_ID_RE.test(authoredId)) {
      errors.push(`${normalizeRoute(route)}: invalid authored data-note-id=${authoredId}`);
    }
    const headingIdentity = nearestHeadingIdentity(html, marker, parsed.all);
    const id = authoredId || `${routeSlug}-note-${contentHash(route, noteText, headingIdentity)}`;
    if (ids.has(id)) {
      errors.push(`${normalizeRoute(route)}: duplicate stable note id ${id} at ordinals ${ids.get(id)} and ${ordinal}; add authored data-note-id values`);
    } else {
      ids.set(id, ordinal);
    }

    const authoredOrdinal = marker.attrs['data-note-ordinal'];
    if (authoredOrdinal !== undefined && Number(authoredOrdinal) !== ordinal) {
      errors.push(`${normalizeRoute(route)}: ordinal drift for ${id}; authored=${authoredOrdinal} actual=${ordinal}`);
    }

    const refId = marker.attrs.id || `note-ref-${id}`;
    const tipId = tip.attrs.id || `note-tip-${id}`;
    const endnoteId = `note-end-${id}`;
    notes.push({
      id,
      route: normalizeRoute(route),
      ordinal,
      visibleOrdinal: numericLabel(markerText),
      markerText,
      text: noteText,
      html: noteHtml,
      headingIdentity,
      refId,
      tipId,
      endnoteId,
      authoredSource: '.fn-marker > .tooltip',
      interactionOwner: 'SiteUtils.makeTooltipController',
      projections: [
        'popover',
        'aria-describedby',
        'screen-reader-endnote',
        'tts-endnote',
        'pagefind-endnote',
        'print-endnote',
        'no-js-endnote',
      ],
    });

    patches.push({
      start: marker.start,
      end: marker.openEnd,
      value: setAttributes(marker.openTag, {
        id: refId,
        'data-note-id': id,
        'data-note-ordinal': ordinal,
        'aria-describedby': endnoteId,
        'aria-controls': tipId,
      }),
    });
    patches.push({
      start: tip.start,
      end: tip.openEnd,
      value: setAttributes(tip.openTag, {
        id: tipId,
        role: tip.attrs.role || 'tooltip',
        'data-note-id': id,
        'data-note-ordinal': ordinal,
        'data-pagefind-ignore': '',
        'data-note-registry-tooltip': '',
      }),
    });
  });

  if (errors.length) return { html, notes, errors, changed: false };

  if (notes.length) {
    const containsAllMarkers = (node) => markers.every((marker) => marker.start >= node.openEnd && marker.end <= node.endStart);
    const narrowest = (left, right) => (left.endStart - left.openEnd) - (right.endStart - right.openEnd);
    const articleOwner = parsed.all.filter((node) => node.tag === 'article' && containsAllMarkers(node)).sort(narrowest)[0];
    const searchableOwner = parsed.all
      .filter((node) => Object.prototype.hasOwnProperty.call(node.attrs, 'data-pagefind-body') && containsAllMarkers(node))
      .sort(narrowest)[0];
    const fallbackOwner = parsed.all
      .filter((node) => (node.tag === 'main' || node.tag === 'article') && containsAllMarkers(node))
      .sort(narrowest)[0];
    const insertion = articleOwner?.end ?? searchableOwner?.endStart ?? fallbackOwner?.endStart ?? -1;
    if (insertion < 0) errors.push(`${normalizeRoute(route)}: notes exist but no common article, Pagefind body or main insertion point exists`);
    else patches.push({ start: insertion, end: insertion, value: `\n${buildEndnotes(route, notes)}\n` });
  }

  if (errors.length) return { html, notes, errors, changed: false };

  let projected = html;
  for (const patch of patches.sort((left, right) => right.start - left.start)) {
    projected = `${projected.slice(0, patch.start)}${patch.value}${projected.slice(patch.end)}`;
  }
  if (notes.length) projected = injectStylesheet(projected, cssHref);
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

function stableRegistry(notes, sourceCommit, stylesheet) {
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
    identityStrategy: 'authored-data-note-id-or-route-note-heading-hash',
    interactionOwner: 'SiteUtils.makeTooltipController',
    stylesheet,
    routeCount: Object.keys(routes).length,
    noteCount: notes.length,
    routes,
  };
}

function markdownReport(registry, filesChanged, errors) {
  const lines = [
    '# A03 NoteRegistry projection',
    '',
    `- Routes with notes: **${registry.routeCount}**`,
    `- Notes: **${registry.noteCount}**`,
    `- HTML files changed: **${filesChanged}**`,
    `- Errors: **${errors.length}**`,
    `- Interaction owner: \`${registry.interactionOwner}\``,
    `- Stylesheet: \`${registry.stylesheet}\``,
    '',
    '| Route | Notes |',
    '|---|---:|',
  ];
  for (const [route, value] of Object.entries(registry.routes)) lines.push(`| \`${route}\` | ${value.count} |`);
  if (errors.length) lines.push('', '## Errors', '', ...errors.map((error) => `- ${error}`));
  return `${lines.join('\n')}\n`;
}

export function projectNoteRegistry(options = {}) {
  const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const distRoot = path.resolve(options.distRoot || path.join(moduleRoot, 'dist'));
  const reportDir = path.resolve(options.reportDir || path.join(moduleRoot, 'reports'));
  const styleSource = path.resolve(options.styleSource || path.join(moduleRoot, 'src', 'runtime', 'note-registry.css'));
  const dryRun = Boolean(options.dryRun);

  if (!fs.existsSync(distRoot)) throw new Error(`dist root missing: ${distRoot}`);
  if (!fs.existsSync(styleSource)) throw new Error(`note registry stylesheet missing: ${styleSource}`);

  const styleBytes = fs.readFileSync(styleSource);
  const styleHash = crypto.createHash('md5').update(styleBytes).digest('hex').slice(0, 8);
  const stylesheet = `/css/note-registry.css?v=${styleHash}`;
  const files = walkHtml(distRoot).sort();
  const allNotes = [];
  const errors = [];
  let filesChanged = 0;

  for (const file of files) {
    const route = routeFromFile(distRoot, file);
    if (!route) continue;
    const source = fs.readFileSync(file, 'utf8');
    const result = collectAndProjectHtml(source, route, { cssHref: stylesheet });
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

  const registry = stableRegistry(allNotes, options.sourceCommit, stylesheet);
  const report = { registry, filesScanned: files.length, filesChanged, errors, dryRun };
  if (errors.length) throw new Error(`NoteRegistry projection failed:\n- ${errors.join('\n- ')}`);

  if (!dryRun) {
    const dataDir = path.join(distRoot, 'data');
    const cssTarget = path.join(distRoot, 'css', 'note-registry.css');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(path.dirname(cssTarget), { recursive: true });
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(cssTarget, styleBytes);
    fs.writeFileSync(path.join(dataDir, 'note-registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(reportDir, 'a03-note-registry.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(reportDir, 'a03-note-registry.md'), markdownReport(registry, filesChanged, errors), 'utf8');
  }
  return report;
}
