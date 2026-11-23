#!/usr/bin/env node
/**
 * Native G3 history release contract, independent of the 2025–26 dossier.
 * Test positive publication registration and narrow, accepted Research evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { G3_HISTORY_METADATA as history } from '../src/data/journal/g3HistoryMetadata.ts';
import { G3_HISTORY_SOURCES as sources } from '../src/data/journal/g3HistorySources.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const route = '/journal/dossiers/g3/history/';
const researchSha = '389de7b1fca6bf2317aa4e0bf187f13600792384';
const approved = Array.from({ length: 9 }, (_, i) => `G3-HIST-PUB-${String(i + 1).padStart(2, '0')}`);
const historicalText = read('src/components/journal/G3HistoryFeature.astro');
const article = read('src/components/journal/G3HistoryArticle.astro');
const page = read('src/pages/journal/dossiers/g3/history/index.astro');
const bibliography = new Map(sources.map(s => [s.id, s]));

test('Research #628 handoff is pinned, and the 2025–26 crisis seal is independent', () => {
  assert.equal(history.researchHandoffUrl.includes(researchSha), true, 'adopted Research merge SHA required');
  assert.deepEqual([...history.approvedClaimIds], approved);
  assert.equal(history.canonical, 'https://gospod-bog.ru' + route);
  assert.equal(history.publishedAt, '2026-11-24T00:00:00+03:00');
  assert.ok(Date.parse(history.modifiedAt) >= Date.parse(history.publishedAt));
  const oldCrisis = read('src/data/journal/g3PublicationHandoff.ts');
  assert.match(oldCrisis, /G3-PUB-001/);
  assert.ok(!oldCrisis.includes('G3-HIST-PUB-'), 'do not silently inflate old historical seal');
});

test('Reader copy has no draft overlays, forged audio access or hidden route', () => {
  assert.match(page, /<G3HistoryArticle\s*\/>/);
  assert.match(page, /data-pagefind-body/);
  assert.match(page, /data-journal-id="g3-history"/);
  assert.match(page, /kind="Article"/);
  for (const [name, source] of [['article',article], ['feature', historicalText]]) {
    assert.doesNotMatch(source, /PUBLICATION_HOLD|RESEARCH_DRAFT|source-only|\bDRAFT\b|Не опубликовано|Локальная историческая рукопись/, `${name}: stale manuscript warning`);
    assert.doesNotMatch(source, /<(?:iframe|audio|video)[\s>]/i, `${name}: audiovisual rights were not granted`);
    assert.doesNotMatch(source, /data-research-candidates=/, `${name}: internal review ids should not surface in HTML`);
  }
  assert.ok(article.includes('Автор-редактор:'), 'preserve editorial attribution');
  assert.ok(!fs.existsSync(path.join(root, 'src/pages/_review/g3-history')), 'no unintended preview route');
});

test('All prose citations and bibliography references resolve to a real source and local section', () => {
  assert.ok(sources.length >= 22, 'approved historical source bibliography must not shrink');
  assert.equal(bibliography.size, sources.length, 'bibliography source IDs unique');
  for (const source of sources) {
    assert.match(source.url, /^https:\/\//);
    assert.ok(source.title.trim() && source.boundary.trim(), 'visible bibliographic evidence and limits required');
    // The returnHref is stored as data and rendered by JournalSourceReturn.
    // Verify its referenced DOM target instead of expecting a literal href in source prose.
    const target = source.returnHref.slice(1);
    assert.ok(new RegExp(`id=["']${target}["']`).test(article+historicalText), `no return anchor ${source.id}: ${target}`);
  }
  const cited = [...(article + '\n' + historicalText).matchAll(/cite\('([^']+)'\)/g)].map(x => x[1]);
  assert.ok(cited.length >= 18, 'do not regress source density');
  for (const id of cited) assert.ok(bibliography.has(id), `citation with no source: ${id}`);
  for (const id of ['invitation-2011','ascol-2018','gnl-2013','gnl-2019','gnl-2020','peters-2024'])
    assert.ok(cited.includes(id), `key adopted primary source lacks a nearby citation: ${id}`);
});

test('Publication route, SEO, RSS and sitemap are registered exactly once and date aligned', () => {
  const ownership = json('migration/page-ownership.json').routes[route];
  const profile = json('data/route-profiles/journal-dossiers-g3-history.json');
  const policy = json('data/route-search-policy.json').routes[route];
  const manifest = json('data/search-manifest.json');
  const entries = manifest.items.filter(x => x.url === route);
  assert.deepEqual(ownership, { owner:'astro', source:'src/pages/journal/dossiers/g3/history/index.astro', risk:3, status:'production-dist' });
  assert.equal(profile.route, route);
  assert.equal(profile.currentStatus, 'production-dist');
  assert.equal(profile.migrationMode, 'strict-native');
  assert.equal(policy.indexPolicy, 'index');
  for (const key of ['pagefindPolicy', 'searchManifestPolicy', 'sitemapPolicy', 'rssPolicy'])
    assert.equal(policy[key], 'include', `${key}: public history should be discoverable`);
  assert.equal(entries.length, 1);
  const entry = entries[0];
  for (const [key,expected] of [['title',history.title],['description',history.description],
    ['publishedTime',history.publishedAt],['modifiedTime',history.modifiedAt]])
    assert.equal(entry[key],expected,`${key} drift`);
  assert.equal(entry.image,'/images/journal/g3-ministries-og-1200x630.webp');
  assert.ok(Date.parse(manifest.generatedAt)>=Date.parse(history.modifiedAt));
  const sitemap=read('sitemap.xml'),feed=read('feed.xml');
  const site='https://gospod-bog.ru'+route;
  const mapBlocks=[...sitemap.matchAll(/<url>[\s\S]*?<\/url>/g)].map(x=>x[0]).filter(x=>x.includes('<loc>'+site+'</loc>'));
  assert.equal(mapBlocks.length,1);
  assert.ok(mapBlocks[0].includes('<lastmod>'+new Date(history.modifiedAt).toISOString()+'</lastmod>'));
  assert.ok(mapBlocks[0].includes('<image:loc>https://gospod-bog.ru'+entry.image+'</image:loc>'));
  assert.ok(mapBlocks[0].includes('<image:title>'+history.title+'</image:title>'));
  const feedItems=[...feed.matchAll(/<item>[\s\S]*?<\/item>/g)].map(x=>x[0]).filter(x=>x.includes('<link>'+site+'</link>'));
  assert.equal(feedItems.length,1);
  assert.ok(feedItems[0].includes('<pubDate>'+new Date(history.publishedAt).toUTCString()+'</pubDate>'));
});

test('History and crisis pages cross-link through one Journal editorial surface', () => {
  assert.ok(read('src/components/journal/JournalLanding.astro').includes('href="'+route+'"'));
  assert.ok(read('src/components/journal/G3Dossier.astro').includes('href="'+route+'"'));
  assert.ok(article.includes('href="/journal/dossiers/g3/"'));
  assert.ok(!read('src/pages/journal/dossiers/g3/index.astro').includes('G3HistoryArticle'));
});

test('Built route is indexable, single-headed and has correct source anchors when dist exists', () => {
  const target=path.join(root,'dist',route,'index.html');
  if(!fs.existsSync(target))return;
  const html=fs.readFileSync(target,'utf8');
  assert.equal((html.match(/<h1[\s>]/g)||[]).length,1);
  assert.ok(html.includes(history.canonical));
  assert.ok(html.includes('index, follow'));
  assert.ok(html.includes('data-pagefind-body'));
  assert.ok(html.includes('history-source-invitation-2011'));
  assert.ok(html.includes('history-source-ascol-2018'));
  assert.ok(!html.includes('PUBLICATION_HOLD') && !html.includes('Не опубликовано'));
});
