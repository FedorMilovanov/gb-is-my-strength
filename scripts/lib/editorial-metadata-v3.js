'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  ROOT,
  SITE,
  readRegistry,
  normalizeInstant,
} = require('./editorial-metadata');

const ALLOWED_REVIEW_STATUS = new Set([
  'migration-freeze-unverified',
  'inconsistent-needs-review',
  'approved',
]);
const DATE_FIELDS = Object.freeze([
  'editorialPublishedAt',
  'editorialModifiedAt',
  'originalWorkPublishedAt',
]);
const TECHNICAL_SOURCE_RE = /\b(?:git(?:hub)?|commit|file[-_ ]?mtime|cache[-_ ]?bust|asset[-_ ]?revision|build[-_ ]?(?:time|timestamp|date))\b/i;
const ARTICLE_TYPES = new Set(['Article', 'ScholarlyArticle', 'NewsArticle', 'BlogPosting']);
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function normalizeRoute(value) {
  const url = new URL(String(value || '/'), SITE);
  let route = url.pathname.replace(/\/index\.html$/u, '/').replace(/\/{2,}/g, '/');
  if (!route.startsWith('/')) route = `/${route}`;
  if (route !== '/' && !route.endsWith('/')) route += '/';
  return route;
}

function normalizeDecisionDate(value, label) {
  if (value === null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}: expected an ISO date-time string or null`);
  }
  const normalized = normalizeInstant(value);
  if (!normalized) throw new Error(`${label}: invalid date-time ${JSON.stringify(value)}`);
  return normalized;
}

function validateDecisionRecord(record, routeKey, options = {}) {
  const errors = [];
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  if (!record || typeof record !== 'object') return [`${routeKey}: record missing`];
  if (record.route !== routeKey) errors.push(`${routeKey}: route key/record.route mismatch`);
  if (!record.canonical || normalizeRoute(record.canonical) !== routeKey) {
    errors.push(`${routeKey}: canonical route mismatch`);
  }
  if (!record.metadataSource || typeof record.metadataSource !== 'string') {
    errors.push(`${routeKey}: metadataSource missing`);
  }
  if (!record.provenance || typeof record.provenance !== 'string') {
    errors.push(`${routeKey}: provenance missing`);
  }
  if (!ALLOWED_REVIEW_STATUS.has(record.reviewStatus)) {
    errors.push(`${routeKey}: invalid reviewStatus=${record.reviewStatus}`);
  }
  if (!record.observations || typeof record.observations !== 'object') {
    errors.push(`${routeKey}: observations missing`);
  }

  const dates = {};
  for (const field of DATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      errors.push(`${routeKey}: ${field} missing; use null for unknown`);
      continue;
    }
    try {
      dates[field] = normalizeDecisionDate(record[field], `${routeKey} ${field}`);
      if (dates[field] && Date.parse(dates[field]) > now + FUTURE_TOLERANCE_MS) {
        errors.push(`${routeKey}: ${field} is in the future`);
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  const sourceDescriptor = [
    record.provenance,
    record.editorialDateSource,
    record.editorialPublishedSource,
    record.editorialModifiedSource,
  ].filter(Boolean).join(' ');
  if (TECHNICAL_SOURCE_RE.test(sourceDescriptor)) {
    errors.push(`${routeKey}: technical build/Git/cache source cannot own editorial dates`);
  }

  if (
    record.reviewStatus === 'approved' &&
    dates.editorialPublishedAt &&
    dates.editorialModifiedAt &&
    Date.parse(dates.editorialModifiedAt) < Date.parse(dates.editorialPublishedAt)
  ) {
    errors.push(`${routeKey}: approved editorialModifiedAt precedes editorialPublishedAt`);
  }
  return errors;
}

function validateRegistryV3(registry, options = {}) {
  const errors = [];
  if (!registry || ![1, 3].includes(registry.version)) errors.push('registry version must be 1 or 3');
  if (!registry?.records || typeof registry.records !== 'object' || Array.isArray(registry.records)) {
    errors.push('registry.records missing');
    return errors;
  }

  const routeIdentities = new Map();
  for (const [route, record] of Object.entries(registry.records)) {
    for (const problem of validateDecisionRecord(record, route, options)) errors.push(problem);
    if (!record?.route) continue;
    if (routeIdentities.has(record.route) && routeIdentities.get(record.route) !== route) {
      errors.push(`${record.route}: duplicate record identity in ${routeIdentities.get(record.route)} and ${route}`);
    } else {
      routeIdentities.set(record.route, route);
    }
  }
  return errors;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function replaceAttribute(tag, name, value) {
  const re = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(["'])[^"']*\\1`, 'i');
  if (re.test(tag)) return tag.replace(re, `${name}="${escapeHtml(value)}"`);
  return tag.replace(/\/?>$/, (end) => ` ${name}="${escapeHtml(value)}"${end}`);
}

function projectMeta(html, property, value, route) {
  const re = new RegExp(`<meta\\b[^>]*\\bproperty\\s*=\\s*["']${escapeRegExp(property)}["'][^>]*>`, 'gi');
  const matches = html.match(re) || [];
  if (matches.length > 1) throw new Error(`${route}: duplicate ${property} metadata`);
  if (value === null) return html.replace(re, '');
  if (matches.length === 1) return html.replace(re, replaceAttribute(matches[0], 'content', value));
  if (!/<\/head>/i.test(html)) throw new Error(`${route}: cannot inject ${property}; </head> missing`);
  return html.replace(/<\/head>/i, `<meta property="${property}" content="${escapeHtml(value)}">\n</head>`);
}

function nodeTypes(node) {
  const type = node?.['@type'];
  return Array.isArray(type) ? type : [type].filter(Boolean);
}

function articleCandidates(parsed) {
  if (Array.isArray(parsed)) return parsed.filter((node) => node && typeof node === 'object');
  if (Array.isArray(parsed?.['@graph'])) return parsed['@graph'].filter((node) => node && typeof node === 'object');
  return parsed && typeof parsed === 'object' ? [parsed] : [];
}

function nodeRoute(node) {
  const value = node?.url || node?.mainEntityOfPage?.['@id'] || node?.['@id'];
  if (!value) return null;
  try {
    return normalizeRoute(String(value).split('#')[0]);
  } catch {
    return null;
  }
}

function setNullableField(object, field, value) {
  if (value === null) delete object[field];
  else object[field] = value;
}

function projectJsonLd(html, route, record) {
  const scriptRe = /<script\b([^>]*\btype=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi;
  const blocks = [...html.matchAll(scriptRe)];
  const candidates = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[2].trim());
      for (const node of articleCandidates(parsed)) {
        if (nodeTypes(node).some((type) => ARTICLE_TYPES.has(type))) {
          candidates.push({ block, parsed, node });
        }
      }
    } catch {
      // Dedicated JSON-LD audits own syntax failures. Projection fails below
      // when no usable article node exists for an editorial record.
    }
  }

  const exact = candidates.filter(({ node }) => nodeRoute(node) === route);
  const selected = exact.length ? exact : candidates.length === 1 ? candidates : [];
  if (selected.length !== 1) {
    throw new Error(`${route}: expected exactly one Article JSON-LD node, found ${selected.length || candidates.length}`);
  }

  const target = selected[0];
  setNullableField(target.node, 'datePublished', record.editorialPublishedAt);
  setNullableField(target.node, 'dateModified', record.editorialModifiedAt);
  const serialized = JSON.stringify(target.parsed, null, 2).replace(/</g, '\\u003c');
  const replacement = `<script${target.block[1]}>${serialized}</script>`;
  return html.slice(0, target.block.index) + replacement + html.slice(target.block.index + target.block[0].length);
}

function projectTimeTag(tag, value) {
  if (value === null) return tag;
  return replaceAttribute(tag, 'datetime', value);
}

function projectVisibleDateline(html, record) {
  let updated = html;
  const updatedContainerRe = /<(?<tag>p|div)\b(?<attrs>[^>]*\bclass=["'][^"']*\barticle-updated\b[^"']*["'][^>]*)>(?<body>[\s\S]*?)<\/\k<tag>>/i;
  const updatedContainer = updated.match(updatedContainerRe);
  if (updatedContainer && record.editorialModifiedAt) {
    const nextBody = updatedContainer.groups.body.replace(/<time\b[^>]*>/i, (tag) => projectTimeTag(tag, record.editorialModifiedAt));
    updated = updated.replace(updatedContainer[0], `<${updatedContainer.groups.tag}${updatedContainer.groups.attrs}>${nextBody}</${updatedContainer.groups.tag}>`);
  }

  const bylineRe = /<(?<tag>p|div)\b(?<attrs>[^>]*\bclass=["'][^"']*\barticle-byline\b[^"']*["'][^>]*)>(?<body>[\s\S]*?)<\/\k<tag>>/i;
  const byline = updated.match(bylineRe);
  if (byline && record.editorialPublishedAt) {
    const nextBody = byline.groups.body.replace(/<time\b[^>]*>/i, (tag) => projectTimeTag(tag, record.editorialPublishedAt));
    updated = updated.replace(byline[0], `<${byline.groups.tag}${byline.groups.attrs}>${nextBody}</${byline.groups.tag}>`);
  }
  return updated;
}

function projectPagefindDates(html, route, record) {
  const existingRe = /\s*<span\b[^>]*\bdata-pagefind-meta=["'](?:publishedTime|modifiedTime)["'][^>]*>[\s\S]*?<\/span>\s*/gi;
  let updated = html.replace(existingRe, '\n');
  const markers = [];
  if (record.editorialPublishedAt) {
    markers.push(`<span data-pagefind-meta="publishedTime" hidden>${escapeHtml(record.editorialPublishedAt)}</span>`);
  }
  if (record.editorialModifiedAt) {
    markers.push(`<span data-pagefind-meta="modifiedTime" hidden>${escapeHtml(record.editorialModifiedAt)}</span>`);
  }
  if (!markers.length) return updated;
  const mainRe = /<main\b[^>]*\bdata-pagefind-body\b[^>]*>/i;
  const fallbackMainRe = /<main\b[^>]*>/i;
  const match = updated.match(mainRe) || updated.match(fallbackMainRe);
  if (!match) throw new Error(`${route}: cannot project Pagefind dates; <main> missing`);
  return updated.replace(match[0], `${match[0]}\n    ${markers.join('\n    ')}`);
}

function projectHtml(html, route, record) {
  let updated = html;
  updated = projectMeta(updated, 'article:published_time', record.editorialPublishedAt, route);
  updated = projectMeta(updated, 'article:modified_time', record.editorialModifiedAt, route);
  updated = projectJsonLd(updated, route, record);
  updated = projectVisibleDateline(updated, record);
  updated = projectPagefindDates(updated, route, record);
  return updated;
}

function routeToDistFile(distRoot, route) {
  const clean = normalizeRoute(route).replace(/^\/+|\/+$/g, '');
  return path.join(distRoot, clean, 'index.html');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeIfChanged(file, next, dryRun) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current === next) return false;
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next, 'utf8');
  }
  return true;
}

function projectSearchManifest(file, registry, dryRun) {
  if (!fs.existsSync(file)) throw new Error(`dist search manifest missing: ${file}`);
  const manifest = readJson(file);
  let matched = 0;
  for (const item of Array.isArray(manifest.items) ? manifest.items : []) {
    if (!item?.url || String(item.url).includes('#') || String(item.url).includes('?')) continue;
    const route = normalizeRoute(item.url);
    const record = registry.records[route];
    if (!record) continue;
    matched += 1;
    if (record.editorialPublishedAt === null) delete item.publishedTime;
    else item.publishedTime = record.editorialPublishedAt;
    if (record.editorialModifiedAt === null) delete item.modifiedTime;
    else item.modifiedTime = record.editorialModifiedAt;
  }
  const next = `${JSON.stringify(manifest, null, 2)}\n`;
  return { matched, changed: writeIfChanged(file, next, dryRun) };
}

function projectSitemapXml(xml, registry) {
  let matched = 0;
  const next = String(xml).replace(/<url>([\s\S]*?)<\/url>/gi, (block) => {
    const location = block.match(/<loc>([^<]+)<\/loc>/i)?.[1]?.trim();
    if (!location) return block;
    let route;
    try {
      route = normalizeRoute(location);
    } catch {
      return block;
    }
    const record = registry.records[route];
    if (!record) return block;
    matched += 1;
    const target = record.editorialModifiedAt || record.editorialPublishedAt;
    let projected = block.replace(/\s*<lastmod>[^<]*<\/lastmod>/i, '');
    if (target) projected = projected.replace(/(<loc>[^<]+<\/loc>)/i, `$1\n    <lastmod>${target}</lastmod>`);
    return projected;
  });
  return { xml: next, matched };
}

function projectSitemaps(distRoot, registry, dryRun) {
  const files = fs.readdirSync(distRoot)
    .filter((name) => /^sitemap(?:-\d+)?\.xml$/i.test(name))
    .map((name) => path.join(distRoot, name))
    .sort();
  if (!files.length) throw new Error(`dist sitemap missing in ${distRoot}`);
  let matched = 0;
  let changed = 0;
  for (const file of files) {
    const result = projectSitemapXml(fs.readFileSync(file, 'utf8'), registry);
    matched += result.matched;
    if (writeIfChanged(file, result.xml, dryRun)) changed += 1;
  }
  return { files: files.length, matched, changed };
}

function technicalBuildInstant(explicitValue = null) {
  const requested = explicitValue || process.env.GB_BUILD_INSTANT || null;
  if (requested) {
    const normalized = normalizeInstant(requested);
    if (!normalized) throw new Error(`invalid technical build instant: ${requested}`);
    return normalized;
  }
  try {
    const value = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    const normalized = normalizeInstant(value);
    if (normalized) return normalized;
  } catch {
    // Fail below rather than substitute wall-clock time into a deterministic build.
  }
  throw new Error('technical build instant unavailable; set GB_BUILD_INSTANT');
}

function projectFeedXml(xml, registry, buildInstant) {
  let matched = 0;
  let updated = String(xml).replace(/<item>([\s\S]*?)<\/item>/gi, (block) => {
    const location = block.match(/<link>([^<]+)<\/link>/i)?.[1]?.trim();
    if (!location) return block;
    let route;
    try {
      route = normalizeRoute(location);
    } catch {
      return block;
    }
    const record = registry.records[route];
    if (!record) return block;
    matched += 1;
    let projected = block.replace(/\s*<pubDate>[^<]*<\/pubDate>/i, '');
    if (record.editorialPublishedAt) {
      const value = new Date(record.editorialPublishedAt).toUTCString();
      projected = projected.replace(/(<guid\b[^>]*>[\s\S]*?<\/guid>)/i, `$1\n      <pubDate>${value}</pubDate>`);
    }
    return projected;
  });

  const technical = new Date(buildInstant).toUTCString();
  if (/<lastBuildDate>[^<]*<\/lastBuildDate>/i.test(updated)) {
    updated = updated.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/i, `<lastBuildDate>${technical}</lastBuildDate>`);
  } else {
    updated = updated.replace(/(<language>[^<]*<\/language>)/i, `$1\n    <lastBuildDate>${technical}</lastBuildDate>`);
  }
  return { xml: updated, matched };
}

function projectFeed(file, registry, buildInstant, dryRun) {
  if (!fs.existsSync(file)) throw new Error(`dist feed missing: ${file}`);
  const result = projectFeedXml(fs.readFileSync(file, 'utf8'), registry, buildInstant);
  return { matched: result.matched, changed: writeIfChanged(file, result.xml, dryRun) };
}

function projectRegistryToDist(options = {}) {
  const distRoot = path.resolve(options.distRoot || path.join(ROOT, 'dist'));
  const registry = options.registry || readRegistry();
  const errors = validateRegistryV3(registry, options);
  if (errors.length) throw new Error(`Editorial Metadata v3 invalid:\n- ${errors.join('\n- ')}`);
  if (!fs.existsSync(distRoot)) throw new Error(`dist root missing: ${distRoot}`);

  const dryRun = Boolean(options.dryRun);
  const buildInstant = technicalBuildInstant(options.technicalInstant);
  const report = {
    schemaVersion: 3,
    sourceRegistry: 'data/editorial-metadata.json',
    technicalBuildInstant: buildInstant,
    records: Object.keys(registry.records).length,
    htmlMatched: 0,
    htmlChanged: 0,
    searchManifestMatched: 0,
    searchManifestChanged: false,
    sitemapFiles: 0,
    sitemapMatched: 0,
    sitemapChanged: 0,
    rssMatched: 0,
    rssChanged: false,
    unknownPublished: 0,
    unknownModified: 0,
    dryRun,
  };

  for (const [route, record] of Object.entries(registry.records)) {
    if (record.editorialPublishedAt === null) report.unknownPublished += 1;
    if (record.editorialModifiedAt === null) report.unknownModified += 1;
    const file = routeToDistFile(distRoot, route);
    if (!fs.existsSync(file)) throw new Error(`${route}: dist HTML missing: ${file}`);
    const current = fs.readFileSync(file, 'utf8');
    const projected = projectHtml(current, route, record);
    report.htmlMatched += 1;
    if (writeIfChanged(file, projected, dryRun)) report.htmlChanged += 1;
  }

  const manifestResult = projectSearchManifest(
    path.join(distRoot, 'data', 'search-manifest.json'),
    registry,
    dryRun
  );
  report.searchManifestMatched = manifestResult.matched;
  report.searchManifestChanged = manifestResult.changed;

  const sitemapResult = projectSitemaps(distRoot, registry, dryRun);
  report.sitemapFiles = sitemapResult.files;
  report.sitemapMatched = sitemapResult.matched;
  report.sitemapChanged = sitemapResult.changed;

  const feedResult = projectFeed(path.join(distRoot, 'feed.xml'), registry, buildInstant, dryRun);
  report.rssMatched = feedResult.matched;
  report.rssChanged = feedResult.changed;

  const reportFile = options.reportFile || path.join(ROOT, 'reports', 'editorial-metadata-v3-projection.json');
  if (!dryRun && reportFile) {
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return report;
}

module.exports = {
  ALLOWED_REVIEW_STATUS,
  DATE_FIELDS,
  TECHNICAL_SOURCE_RE,
  normalizeRoute,
  normalizeDecisionDate,
  validateDecisionRecord,
  validateRegistryV3,
  projectMeta,
  projectJsonLd,
  projectVisibleDateline,
  projectPagefindDates,
  projectHtml,
  projectSearchManifest,
  projectSitemapXml,
  projectSitemaps,
  technicalBuildInstant,
  projectFeedXml,
  projectFeed,
  projectRegistryToDist,
};
