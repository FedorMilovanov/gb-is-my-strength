#!/usr/bin/env node
/**
 * Pastor-series current discovery authority contract (SYS-SERIES-DISCOVERY-CURRENT-AUTHORITY).
 *
 * Absorbs GBS-PASTOR-SERIES-DISCOVERY-DRIFT and GBS-WAVE12-CONTRACT-FROZEN-AT-BOUNDARY
 * while keeping the historical Wave 12 anchor contract intact as a separate witness.
 *
 * Canonical membership owner: data/series.json["pastor-series"]
 *  - parts[]: numbered theological-pastoral core I–IX (9 routes, JSON-LD hasPart)
 *  - companions[]: unnumbered documentary dossiers (1 route, JSON-LD subjectOf)
 *  - discoveryPolicy: explicit core/companion projection rules across hub cards,
 *    reader config, JSON-LD, feed-pastor-series.xml, sitemap-pastor-series.xml,
 *    root feed.xml, root sitemap.xml, and built dist/ shards when present.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://gospod-bog.ru';

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function extractXmlBlocks(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'g');
  return [...String(xml).matchAll(re)].map((m) => m[0]);
}

function extractTagValue(block, tag) {
  const m = String(block).match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : '';
}

function parseReaderSeriesItems(configSource) {
  const itemsSection = configSource.split('items: [')[1]?.split(/\n\s*\],\s*\n\s*pages:/)[0] ?? '';
  const entries = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < itemsSection.length; i += 1) {
    const ch = itemsSection[i];
    if (ch === '{') {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const body = itemsSection.slice(start, i);
        const id = body.match(/\bid:\s*'([^']+)'/)?.[1] ?? '';
        const markKind = body.match(/kind:\s*'([^']+)'/)?.[1] ?? '';
        const markValue = body.match(/value:\s*'([^']+)'/)?.[1] ?? '';
        const href = body.match(/\bhref:\s*'([^']+)'/)?.[1] ?? '';
        const readingTime = Number.parseInt(body.match(/\breadingTime:\s*'(\d+)\s*мин'/)?.[1] ?? '0', 10);
        if (id && href) {
          entries.push({ id, markKind, markValue, href, readingTime });
        }
        start = -1;
      }
    }
  }
  return entries;
}

function parseHeadSeriesStructuredData(headSource) {
  const numberOfItems = Number.parseInt(headSource.match(/\bnumberOfItems:\s*(\d+)/)?.[1] ?? '-1', 10);
  const hasPartSection = headSource.split('hasPart: [')[1]?.split('],')[0] ?? '';
  const hasPartUrls = [...hasPartSection.matchAll(/url:\s*'([^']+)'/g)].map((m) => m[1]);
  const subjectSection = headSource.split('subjectOf: {')[1]?.split('},')[0] ?? '';
  const subjectUrls = [...subjectSection.matchAll(/url:\s*'([^']+)'/g)].map((m) => m[1]);
  return { numberOfItems, hasPartUrls, subjectUrls };
}

function parseHubCardRoutes(cardsSource) {
  const hrefs = [...cardsSource.matchAll(/<a\b[^>]*\bhref="\.\.\/articles\/([^"/]+)\/"/g)].map(
    (m) => `/articles/${m[1]}/`
  );
  return hrefs;
}

export function evaluatePastorSeriesDiscovery(snapshot) {
  const errors = [];
  const fail = (msg) => errors.push(msg);

  const owner = snapshot.seriesEntry;
  if (!owner || typeof owner !== 'object') {
    return ['data/series.json["pastor-series"] is missing'];
  }
  if (owner.extensionPolicy !== 'locked') {
    fail(`pastor-series extensionPolicy must be "locked", got ${JSON.stringify(owner.extensionPolicy)}`);
  }

  const policy = owner.discoveryPolicy;
  if (!policy || typeof policy !== 'object') {
    return ['pastor-series.discoveryPolicy is missing'];
  }
  if (policy.coreRole !== 'hasPart' || policy.companionRole !== 'subjectOf') {
    fail('discoveryPolicy must keep coreRole="hasPart" and companionRole="subjectOf"');
  }

  const baseUrl = String(owner.baseUrl || '/articles/');
  const publishedCore = (owner.parts || []).filter((p) => p.status === 'published');
  const publishedCompanions = (owner.companions || []).filter((c) => c.status === 'published');

  if (publishedCore.length === 0) fail('pastor-series.parts has zero published core parts');
  if (publishedCompanions.length === 0) fail('pastor-series.companions has zero published companions');

  const coreRoutes = publishedCore.map((p) => `${baseUrl}${p.slug}/`);
  const companionRoutes = publishedCompanions.map((c) => `${baseUrl}${c.slug}/`);
  const allMemberRoutes = [...coreRoutes, ...companionRoutes];
  const coreCanonicalUrls = coreRoutes.map((r) => `${SITE}${r}`);
  const companionCanonicalUrls = companionRoutes.map((r) => `${SITE}${r}`);
  const allCanonicalUrls = allMemberRoutes.map((r) => `${SITE}${r}`);
  const hubCanonicalUrl = `${SITE}${policy.hubRoute}`;

  // 1. Reconcile against pastorSeriesConfig.ts (reader engine)
  const readerCore = snapshot.readerItems.filter((i) => i.markKind === 'roman');
  const readerCompanions = snapshot.readerItems.filter((i) => i.markKind === 'label');
  if (JSON.stringify(readerCore.map((i) => i.href)) !== JSON.stringify(coreRoutes)) {
    fail(`pastorSeriesConfig roman core routes drift from data/series.json parts: ${JSON.stringify(readerCore.map((i) => i.href))} != ${JSON.stringify(coreRoutes)}`);
  }
  if (JSON.stringify(readerCompanions.map((i) => i.href)) !== JSON.stringify(companionRoutes)) {
    fail(`pastorSeriesConfig label companion routes drift from data/series.json companions: ${JSON.stringify(readerCompanions.map((i) => i.href))} != ${JSON.stringify(companionRoutes)}`);
  }
  for (const part of publishedCore) {
    const route = `${baseUrl}${part.slug}/`;
    const match = readerCore.find((i) => i.href === route);
    if (!match || match.readingTime !== Number(part.readingTime)) {
      fail(`readingTime drift on core ${part.slug}: config=${match?.readingTime}, registry=${part.readingTime}`);
    }
  }
  for (const comp of publishedCompanions) {
    const route = `${baseUrl}${comp.slug}/`;
    const match = readerCompanions.find((i) => i.href === route);
    if (!match || match.readingTime !== Number(comp.readingTime) || match.markValue !== comp.mark) {
      fail(`companion metadata drift on ${comp.slug}: config=(${match?.markValue}, ${match?.readingTime}), registry=(${comp.mark}, ${comp.readingTime})`);
    }
  }

  // 2. Reconcile against hub cards (PastorSeriesCardsSection.astro)
  const expectedHubSet = new Set(allMemberRoutes);
  const actualHubSet = new Set(snapshot.hubRoutes);
  if (snapshot.hubRoutes.length !== allMemberRoutes.length || actualHubSet.size !== expectedHubSet.size) {
    fail(`hub public card count (${snapshot.hubRoutes.length}) != published membership (${allMemberRoutes.length})`);
  }
  for (const route of expectedHubSet) {
    if (!actualHubSet.has(route)) fail(`hub cards missing published member route: ${route}`);
  }
  for (const route of actualHubSet) {
    if (!expectedHubSet.has(route)) fail(`hub cards expose undeclared route: ${route}`);
  }

  // 3. Reconcile against JSON-LD (PastorSeriesPageHead.astro)
  if (snapshot.structuredData.numberOfItems !== publishedCore.length) {
    fail(`JSON-LD numberOfItems (${snapshot.structuredData.numberOfItems}) != published core count (${publishedCore.length})`);
  }
  if (JSON.stringify(snapshot.structuredData.hasPartUrls) !== JSON.stringify(coreCanonicalUrls)) {
    fail(`JSON-LD hasPart URLs drift from canonical core order`);
  }
  if (JSON.stringify(snapshot.structuredData.subjectUrls) !== JSON.stringify(companionCanonicalUrls)) {
    fail(`JSON-LD subjectOf URLs drift from canonical companions: ${JSON.stringify(snapshot.structuredData.subjectUrls)} != ${JSON.stringify(companionCanonicalUrls)}`);
  }

  // 4. Reconcile against feed-pastor-series.xml
  const expectedFeedUrls = policy.feedIncludesCompanions ? allCanonicalUrls : coreCanonicalUrls;
  const feedItems = extractXmlBlocks(snapshot.seriesFeedXml, 'item');
  const feedLinks = feedItems.map((b) => extractTagValue(b, 'link'));
  if (feedLinks.length !== expectedFeedUrls.length) {
    fail(`feed-pastor-series.xml item count (${feedLinks.length}) != expected (${expectedFeedUrls.length})`);
  }
  const feedLinkSet = new Set(feedLinks);
  if (feedLinkSet.size !== feedLinks.length) {
    fail('feed-pastor-series.xml contains duplicate <item> links');
  }
  for (const url of expectedFeedUrls) {
    if (!feedLinkSet.has(url)) fail(`feed-pastor-series.xml missing published URL: ${url}`);
  }
  for (const url of feedLinkSet) {
    if (!expectedFeedUrls.includes(url)) fail(`feed-pastor-series.xml contains undeclared URL: ${url}`);
  }
  const feedPubDates = feedItems.map((b) => Date.parse(extractTagValue(b, 'pubDate')));
  if (feedPubDates.some((t) => !Number.isFinite(t))) {
    fail('feed-pastor-series.xml contains invalid <pubDate>');
  } else {
    for (let i = 1; i < feedPubDates.length; i += 1) {
      if (feedPubDates[i] > feedPubDates[i - 1]) {
        fail('feed-pastor-series.xml items are not ordered newest-first by pubDate');
        break;
      }
    }
    const lastBuild = Date.parse(extractTagValue(snapshot.seriesFeedXml, 'lastBuildDate'));
    const maxPubDate = Math.max(...feedPubDates);
    if (!Number.isFinite(lastBuild) || lastBuild < maxPubDate) {
      fail('feed-pastor-series.xml <lastBuildDate> is older than newest item <pubDate>');
    }
    // Freshness authority parity: a shard item that also appears in the root feed
    // must publish the same instant, otherwise the same URL advertises two dates.
    const rootFeedDates = new Map();
    for (const block of extractXmlBlocks(snapshot.rootFeedXml, 'item')) {
      const link = extractTagValue(block, 'link');
      const when = Date.parse(extractTagValue(block, 'pubDate'));
      if (link && Number.isFinite(when)) rootFeedDates.set(link, when);
    }
    for (let i = 0; i < feedItems.length; i += 1) {
      const link = feedLinks[i];
      if (!rootFeedDates.has(link)) continue;
      if (rootFeedDates.get(link) !== feedPubDates[i]) {
        fail(
          `feed-pastor-series.xml pubDate drifts from root feed.xml on ${link}: `
          + `shard ${new Date(feedPubDates[i]).toISOString()} != root ${new Date(rootFeedDates.get(link)).toISOString()}`,
        );
      }
    }
  }

  // 5. Reconcile against sitemap-pastor-series.xml
  const expectedSitemapUrls = [
    ...(policy.sitemapIncludesHub ? [hubCanonicalUrl] : []),
    ...coreCanonicalUrls,
    ...(policy.sitemapIncludesCompanions ? companionCanonicalUrls : []),
  ];
  const sitemapBlocks = extractXmlBlocks(snapshot.seriesSitemapXml, 'url');
  const sitemapLocs = sitemapBlocks.map((b) => extractTagValue(b, 'loc'));
  if (sitemapLocs.length !== expectedSitemapUrls.length) {
    fail(`sitemap-pastor-series.xml <url> count (${sitemapLocs.length}) != expected (${expectedSitemapUrls.length})`);
  }
  const sitemapLocSet = new Set(sitemapLocs);
  if (sitemapLocSet.size !== sitemapLocs.length) {
    fail('sitemap-pastor-series.xml contains duplicate <loc> entries');
  }
  for (const url of expectedSitemapUrls) {
    if (!sitemapLocSet.has(url)) fail(`sitemap-pastor-series.xml missing published URL: ${url}`);
  }
  for (const url of sitemapLocSet) {
    if (!expectedSitemapUrls.includes(url)) fail(`sitemap-pastor-series.xml contains undeclared URL: ${url}`);
  }
  for (const block of sitemapBlocks) {
    const loc = extractTagValue(block, 'loc');
    const lastmod = Date.parse(extractTagValue(block, 'lastmod'));
    if (!Number.isFinite(lastmod)) fail(`sitemap-pastor-series.xml invalid <lastmod> on ${loc}`);
    const imageLoc = extractTagValue(block, 'image:loc');
    if (!imageLoc.startsWith(`${SITE}/images/pastor-series/`)) {
      fail(`sitemap-pastor-series.xml missing pastor-series <image:loc> on ${loc}`);
    } else {
      const localImg = imageLoc.slice(SITE.length + 1);
      if (!fs.existsSync(path.join(ROOT, localImg)) && !fs.existsSync(path.join(ROOT, 'public', localImg))) {
        fail(`sitemap-pastor-series.xml references missing image asset: ${localImg}`);
      }
    }
  }

  // 5b. Freshness authority parity with the root sitemap (SYS-SERIES-DISCOVERY-CURRENT-AUTHORITY).
  // Every shard URL, including the hub, must publish the exact same <lastmod> instant as
  // sitemap.xml. A shard-only date rewrite is reader-visible freshness fabrication.
  const rootSitemapLastmod = new Map();
  for (const block of extractXmlBlocks(snapshot.rootSitemapXml, 'url')) {
    const loc = extractTagValue(block, 'loc');
    const stamp = Date.parse(extractTagValue(block, 'lastmod'));
    if (loc && Number.isFinite(stamp)) rootSitemapLastmod.set(loc, stamp);
  }
  for (const block of sitemapBlocks) {
    const loc = extractTagValue(block, 'loc');
    const stamp = Date.parse(extractTagValue(block, 'lastmod'));
    if (!Number.isFinite(stamp) || !rootSitemapLastmod.has(loc)) continue;
    if (rootSitemapLastmod.get(loc) !== stamp) {
      fail(
        `sitemap-pastor-series.xml lastmod drifts from root sitemap.xml on ${loc}: `
        + `shard ${new Date(stamp).toISOString()} != root ${new Date(rootSitemapLastmod.get(loc)).toISOString()}`,
      );
    }
  }

  // 6. Verify root feed.xml and sitemap.xml retain all published Pastor-series routes
  if (snapshot.rootFeedXml) {
    for (const url of allCanonicalUrls) {
      if (!snapshot.rootFeedXml.includes(`<link>${url}</link>`)) {
        fail(`root feed.xml missing pastor-series URL: ${url}`);
      }
    }
  }
  if (snapshot.rootSitemapXml) {
    for (const url of [hubCanonicalUrl, ...allCanonicalUrls]) {
      if (!snapshot.rootSitemapXml.includes(`<loc>${url}</loc>`)) {
        fail(`root sitemap.xml missing pastor-series URL: ${url}`);
      }
    }
  }

  return errors;
}

function runNegativeFixtures(validSnapshot) {
  // 1. Missing feed item fails
  const missingFeedItem = {
    ...validSnapshot,
    seriesFeedXml: validSnapshot.seriesFeedXml.replace(
      /<item>[\s\S]*?anatomiya-padeniya-pyat-stadiy[\s\S]*?<\/item>/,
      ''
    ),
  };
  assert(
    evaluatePastorSeriesDiscovery(missingFeedItem).some((e) => e.includes('feed-pastor-series.xml')),
    'negative fixture failed: missing feed item must fail'
  );

  // 2. Missing sitemap <url> fails
  const missingSitemapUrl = {
    ...validSnapshot,
    seriesSitemapXml: validSnapshot.seriesSitemapXml.replace(
      /<url>[\s\S]*?priznaki-zdorovoy-cerkvi[\s\S]*?<\/url>/,
      ''
    ),
  };
  assert(
    evaluatePastorSeriesDiscovery(missingSitemapUrl).some((e) => e.includes('sitemap-pastor-series.xml')),
    'negative fixture failed: missing sitemap <url> must fail'
  );

  // 3. Companion erroneously numbered in JSON-LD numberOfItems / hasPart fails
  const conflatedJsonLd = {
    ...validSnapshot,
    structuredData: {
      numberOfItems: 10,
      hasPartUrls: [...validSnapshot.structuredData.hasPartUrls, `${SITE}/articles/diotrefy-nashego-vremeni/`],
      subjectUrls: [],
    },
  };
  assert(
    evaluatePastorSeriesDiscovery(conflatedJsonLd).some((e) => e.includes('JSON-LD')),
    'negative fixture failed: numbering companion in JSON-LD must fail'
  );

  // 4. Missing companion in JSON-LD subjectOf fails
  const missingSubjectOf = {
    ...validSnapshot,
    structuredData: {
      ...validSnapshot.structuredData,
      subjectUrls: [],
    },
  };
  assert(
    evaluatePastorSeriesDiscovery(missingSubjectOf).some((e) => e.includes('subjectOf')),
    'negative fixture failed: missing companion subjectOf must fail'
  );

  // 5. Reader config drift from data/series.json fails
  const driftedReader = {
    ...validSnapshot,
    readerItems: validSnapshot.readerItems.slice(0, -1),
  };
  assert(
    evaluatePastorSeriesDiscovery(driftedReader).some((e) => e.includes('pastorSeriesConfig')),
    'negative fixture failed: reader config drift must fail'
  );

  // 6. Hub card drift from data/series.json fails
  const driftedHub = {
    ...validSnapshot,
    hubRoutes: validSnapshot.hubRoutes.filter((r) => !r.includes('diotrefy-nashego-vremeni')),
  };
  assert(
    evaluatePastorSeriesDiscovery(driftedHub).some((e) => e.includes('hub')),
    'negative fixture failed: hub card drift must fail'
  );

  // 7. Shard-only hub lastmod rewrite fails (freshness fabrication)
  const driftedHubDate = {
    ...validSnapshot,
    seriesSitemapXml: validSnapshot.seriesSitemapXml.replace(
      /(<loc>https:\/\/gospod-bog\.ru\/pastor-series\/<\/loc>\s*<lastmod>)[^<]+(<\/lastmod>)/,
      '$12026-09-06T21:00:00.000Z$2',
    ),
  };
  assert(
    evaluatePastorSeriesDiscovery(driftedHubDate).some((e) => e.includes('lastmod drifts from root sitemap.xml')),
    'negative fixture failed: shard-only hub lastmod rewrite must fail'
  );

  // 8. Shard-only feed pubDate rewrite fails
  const driftedFeedDate = {
    ...validSnapshot,
    seriesFeedXml: validSnapshot.seriesFeedXml.replace(
      /(<link>https:\/\/gospod-bog\.ru\/articles\/nesovershennyy-chelovek-v-nesovershennoy-cerkvi\/<\/link>\s*<guid[^>]*>[^<]*<\/guid>\s*<pubDate>)[^<]+(<\/pubDate>)/,
      '$1Mon, 05 Jan 2026 12:00:00 GMT$2',
    ),
  };
  assert(
    evaluatePastorSeriesDiscovery(driftedFeedDate).some((e) => e.includes('pubDate drifts from root feed.xml')),
    'negative fixture failed: shard-only feed pubDate rewrite must fail'
  );
}

export function runPastorSeriesDiscoveryContract({ checkDist = false } = {}) {
  const seriesRegistry = JSON.parse(readText('data/series.json'));
  const configSource = readText('src/components/article-pilots/_shared/series/pastorSeriesConfig.ts');
  const headSource = readText('src/components/pastor-series/PastorSeriesPageHead.astro');
  const cardsSource = readText('src/components/pastor-series/PastorSeriesCardsSection.astro');
  const seriesFeedXml = readText('feed-pastor-series.xml');
  const seriesSitemapXml = readText('sitemap-pastor-series.xml');
  const rootFeedXml = readText('feed.xml');
  const rootSitemapXml = readText('sitemap.xml');

  const snapshot = {
    seriesEntry: seriesRegistry['pastor-series'],
    readerItems: parseReaderSeriesItems(configSource),
    structuredData: parseHeadSeriesStructuredData(headSource),
    hubRoutes: parseHubCardRoutes(cardsSource),
    seriesFeedXml,
    seriesSitemapXml,
    rootFeedXml,
    rootSitemapXml,
  };

  const errors = evaluatePastorSeriesDiscovery(snapshot);
  if (errors.length) {
    throw new Error(`Pastor-series current discovery authority failed:\n  - ${errors.join('\n  - ')}`);
  }

  runNegativeFixtures(snapshot);

  if (checkDist || fs.existsSync(path.join(ROOT, 'dist', 'feed-pastor-series.xml'))) {
    const distFeedPath = path.join(ROOT, 'dist', 'feed-pastor-series.xml');
    const distSitemapPath = path.join(ROOT, 'dist', 'sitemap-pastor-series.xml');
    const distLandingPath = path.join(ROOT, 'dist', 'pastor-series', 'index.html');
    if (checkDist) {
      assert(fs.existsSync(distFeedPath), 'dist/feed-pastor-series.xml missing');
      assert(fs.existsSync(distSitemapPath), 'dist/sitemap-pastor-series.xml missing');
      assert(fs.existsSync(distLandingPath), 'dist/pastor-series/index.html missing');
    }
    if (fs.existsSync(distFeedPath) && fs.existsSync(distSitemapPath)) {
      assert.equal(fs.readFileSync(distFeedPath, 'utf8'), seriesFeedXml, 'dist/feed-pastor-series.xml drifted from source shard');
      assert.equal(fs.readFileSync(distSitemapPath, 'utf8'), seriesSitemapXml, 'dist/sitemap-pastor-series.xml drifted from source shard');
    }
    if (fs.existsSync(distLandingPath)) {
      const distLanding = fs.readFileSync(distLandingPath, 'utf8');
      assert(distLanding.includes('"numberOfItems":9'), 'dist /pastor-series/ JSON-LD must keep numberOfItems=9');
      assert(distLanding.includes('"subjectOf":{"@type":"Article"'), 'dist /pastor-series/ JSON-LD must keep companion subjectOf');
    }
  }

  return {
    coreCount: snapshot.seriesEntry.parts.length,
    companionCount: snapshot.seriesEntry.companions.length,
    negativeFixtures: 8,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const checkDist = process.argv.includes('--dist');
    const res = runPastorSeriesDiscoveryContract({ checkDist });
    console.log(
      `✅ Pastor-series current discovery authority PASS: ${res.coreCount} core + ${res.companionCount} companion reconciled across series.json, reader config, hub, JSON-LD, RSS shard (10 items), sitemap shard (11 URLs), reconciled freshness parity and ${res.negativeFixtures} negative fixtures`
    );
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}
