/**
 * Read-only desktop table-of-contents projection.
 *
 * The existing SeriesConfig + partToc remain the ONLY owners of series order,
 * published routes, Gill labels, book hierarchy and historical anchors.
 * This file produces data only: no DOM, storage, listeners, scrollspy or CSS.
 */
import {
  sectionLabel,
  type SeriesConfig,
  type SeriesItem,
  type SeriesMark,
} from './seriesConfig';

export type ReaderTocKind = 'chapter' | 'page' | 'endpaper' | 'heading';

export interface ReaderHeading {
  readonly id: string;
  readonly label: string;
  readonly level: 2 | 3 | 4 | 5 | 6;
}

/** Values in this projection are separate from (and never mutate) SeriesConfig. */
export interface ReaderTocNode {
  readonly key: string;
  readonly kind: ReaderTocKind;
  readonly label: string;
  readonly shortLabel?: string;
  readonly href: string;
  readonly depth: number;
  readonly mark?: Readonly<SeriesMark>;
  readonly children: readonly ReaderTocNode[];
}

export interface ReaderTocProjection {
  readonly nodes: readonly ReaderTocNode[];
  /** Ordered outer-to-inner keys: the reader renderer may open this path. */
  readonly activePath: readonly string[];
  readonly currentPageKey: string;
}

/**
 * Optional DOM heading inventory is used ONLY for strict anchor-order
 * reconciliation and to admit H4-H6 below existing canonical H2/H3.
 * Omit in the initial adapter-only phase; supply real rendered headings
 * only in a later, browser-proven Product pilot.
 */
export interface ReaderProjectionOptions {
  readonly renderedHeadings?: readonly ReaderHeading[];
}

interface HeadingRow {
  id: string;
  label: string;
  level: number;
  href: string;
}

interface DraftNode extends Omit<ReaderTocNode, 'children'> {
  children: DraftNode[];
}

function bad(reason: string): never {
  throw new Error('[reader-toc-projection] ' + reason);
}

function fragmentId(href: string): string {
  if (!href.startsWith('#') || href.length < 2) bad('partToc must contain a nonempty #fragment: ' + href);
  try {
    const id = decodeURIComponent(href.slice(1));
    if (!id || id.includes('#') || /[\u0000-\u001f]/.test(id)) bad('invalid partToc fragment: ' + href);
    return id;
  } catch {
    return bad('bad percent-encoding in fragment: ' + href);
  }
}

function checkHeading(row: ReaderHeading): void {
  if (!Number.isInteger(row.level) || row.level < 2 || row.level > 6) {
    bad('heading level must be H2-H6: ' + row.level);
  }
  if (!row.id?.trim() || !row.label?.trim()) bad('heading with empty id or label');
}

/** Preserve original partToc hrefs/labels; reuse the engine's book prefix rule. */
function headingsForPage(
  cfg: SeriesConfig,
  pageId: string,
  opts: ReaderProjectionOptions,
): HeadingRow[] {
  const page = cfg.pages[pageId];
  if (!page) bad('page is absent from series pages: ' + pageId);
  const canon: HeadingRow[] = [];
  const byId = new Map<string, { row: HeadingRow; index: number }>();
  for (const row of page.partToc) {
    const id = fragmentId(row.href);
    if (byId.has(id)) bad('duplicate canonical fragment in ' + pageId + ': ' + id);
    const normalized: HeadingRow = {
      id, label: sectionLabel(cfg, row.label), level: row.level, href: row.href,
    };
    if (!normalized.label.trim() || (row.level !== 2 && row.level !== 3)) {
      bad('bad canonical H2/H3 in ' + pageId + ': ' + row.href);
    }
    byId.set(id, { row: normalized, index: canon.length });
    canon.push(normalized);
  }
  if (canon.length === 0) bad('empty canonical partToc: ' + pageId);
  if (!opts.renderedHeadings) return canon;

  const seen = new Set<string>();
  const matched = new Set<string>();
  const merged: HeadingRow[] = [];
  let previousIndex = -1;
  let insideCanonicalSection = false;
  for (const heading of opts.renderedHeadings) {
    checkHeading(heading);
    if (seen.has(heading.id)) bad('duplicate rendered heading id: ' + heading.id);
    seen.add(heading.id);
    const canonical = byId.get(heading.id);
    if (canonical) {
      if (canonical.index <= previousIndex) bad('rendered headings reorder canonical partToc');
      if (canonical.row.level !== heading.level) bad('heading level disagrees with partToc: ' + heading.id);
      previousIndex = canonical.index;
      matched.add(heading.id);
      insideCanonicalSection = true;
      merged.push(canonical.row);
    } else if (heading.level <= 3) {
      // An unregistered H2/H3 is not silently added to historical Gill menus.
      insideCanonicalSection = false;
    } else if (insideCanonicalSection) {
      // Extra deep headings may be shown only within a registered section.
      merged.push({
        id: heading.id, label: heading.label, level: heading.level,
        href: '#' + encodeURIComponent(heading.id),
      });
    }
  }
  if (matched.size !== byId.size) {
    const missing = [...byId.keys()].filter((id) => !matched.has(id));
    bad('canonical fragment missing from rendered headings: ' + missing.join(', '));
  }
  return merged;
}

function headingTree(rows: readonly HeadingRow[], scope: string, baseHref: string, baseDepth: number): DraftNode[] {
  const roots: DraftNode[] = [];
  const stack: Array<{ level: number; node: DraftNode }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!Number.isInteger(row.level) || row.level < 2 || row.level > 6) bad('invalid H2-H6 level');
    if (seen.has(row.id)) bad('duplicate section id: ' + row.id);
    seen.add(row.id);
    while (stack.length && stack[stack.length - 1].level >= row.level) stack.pop();
    const parentLevel = stack.length ? stack[stack.length - 1].level : 1;
    if (row.level !== parentLevel + 1) {
      bad('heading hierarchy gap at ' + row.id + ' (H' + parentLevel + ' -> H' + row.level + ')');
    }
    const node: DraftNode = {
      key: scope + ':heading:' + row.id,
      kind: 'heading',
      label: row.label,
      href: baseHref + row.href,
      depth: baseDepth + row.level - 2,
      children: [],
    };
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ level: row.level, node });
  }
  return roots;
}

function pageNode(cfg: SeriesConfig, item: SeriesItem, activePageId: string, opts: ReaderProjectionOptions, depth: number): DraftNode {
  const node: DraftNode = {
    key: 'series:' + cfg.seriesId + ':page:' + item.id,
    kind: item.mark.kind === 'label' ? 'endpaper' : 'page',
    label: item.title,
    shortLabel: item.shortTitle,
    href: item.href,
    depth,
    mark: { ...item.mark },
    children: [],
  };
  // Do not hydrate TOCs for every article in a large book.
  if (item.id === activePageId) {
    node.children = headingTree(
      headingsForPage(cfg, item.id, opts),
      'series:' + cfg.seriesId + ':page:' + item.id,
      item.href,
      depth + 1,
    );
  }
  return node;
}

function freezeNodes(drafts: readonly DraftNode[]): readonly ReaderTocNode[] {
  return Object.freeze(drafts.map((item) => Object.freeze({
    ...item,
    mark: item.mark ? Object.freeze({ ...item.mark }) : undefined,
    children: freezeNodes(item.children),
  })));
}

function findPath(nodes: readonly ReaderTocNode[], key: string, parents: readonly string[] = []): readonly string[] | null {
  for (const node of nodes) {
    const path = [...parents, node.key];
    if (node.key === key) return path;
    const nested = findPath(node.children, key, path);
    if (nested) return nested;
  }
  return null;
}

/** Exact series ordering, nested book chapters, single active article headings. */
export function projectSeriesReaderToc(
  cfg: SeriesConfig,
  activePageId: string,
  opts: ReaderProjectionOptions = {},
): ReaderTocProjection {
  const active = cfg.items.find((item) => item.id === activePageId);
  if (!active || active.tier === 'chapter' || !cfg.pages[activePageId]) {
    bad('active page is not a published series article: ' + activePageId);
  }
  const roots: DraftNode[] = [];
  const chapters = new Map<string, DraftNode>();
  for (const item of cfg.items) {
    if (item.tier === 'satellite') continue; // Engine contract: satellites live in the part accordion, not desktop rail.
    if (item.tier === 'chapter') {
      if (cfg.shape !== 'book') bad('chapter within a non-book series: ' + item.id);
      if (chapters.has(item.id)) bad('duplicate chapter: ' + item.id);
      const node: DraftNode = {
        key: 'series:' + cfg.seriesId + ':chapter:' + item.id,
        kind: 'chapter',
        label: item.title,
        shortLabel: item.shortTitle,
        href: item.href, // Existing chapter link points to its first article.
        depth: 0,
        mark: { ...item.mark },
        children: [],
      };
      chapters.set(item.id, node);
      roots.push(node);
      continue;
    }
    if (item.parent) {
      const chapter = chapters.get(item.parent);
      if (!chapter || item.mark.kind !== 'arabic') bad('article parent missing or unordered: ' + item.id);
      chapter.children.push(pageNode(cfg, item, activePageId, opts, 1));
    } else {
      roots.push(pageNode(cfg, item, activePageId, opts, 0));
    }
  }
  const nodes = freezeNodes(roots);
  const currentPageKey = 'series:' + cfg.seriesId + ':page:' + activePageId;
  const activePath = findPath(nodes, currentPageKey);
  if (!activePath) bad('active page is absent from visible core tree: ' + activePageId);
  return Object.freeze({ nodes, activePath: Object.freeze([...activePath]), currentPageKey });
}

/** Standalone H2-H6 documents use the same heading projection, no SeriesConfig. */
export function projectStandaloneReaderToc(
  pageHref: string,
  headings: readonly ReaderHeading[],
): readonly ReaderTocNode[] {
  const ids = new Set<string>();
  const rows: HeadingRow[] = headings.map((heading) => {
    checkHeading(heading);
    if (ids.has(heading.id)) bad('duplicate standalone heading id: ' + heading.id);
    ids.add(heading.id);
    return {
      id: heading.id,
      label: heading.label,
      level: heading.level,
      href: '#' + encodeURIComponent(heading.id),
    };
  });
  if (!pageHref.startsWith('/') || pageHref.includes('#')) bad('standalone page needs a path without fragment');
  return freezeNodes(headingTree(rows, 'standalone:' + pageHref, pageHref, 0));
}
