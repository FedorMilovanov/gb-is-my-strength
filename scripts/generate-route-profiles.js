#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const ownershipData = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/page-ownership.json'), 'utf8'));
const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/visual-parity-baseline.json'), 'utf8'));

const outDir = path.join(ROOT, 'data/route-profiles');
fs.mkdirSync(outDir, { recursive: true });

function classifyRoute(urlPath) {
  const u = urlPath.replace(/\/$/, '') || '/';
  if (u === '/') return { lane: 'landing', type: 'home', section: 'home' };
  if (u === '/about') return { lane: 'shell-first', type: 'about', section: 'about' };
  if (u.startsWith('/articles/')) {
    const slug = u.split('/')[2];
    if (!slug) return { lane: 'landing', type: 'articles-index', section: 'articles' };
    return { lane: 'content', type: 'article', section: 'articles', slug };
  }
  if (u.startsWith('/baptisty-rossii/')) {
    const slug = u.split('/')[2];
    if (!slug) return { lane: 'landing', type: 'series-index', section: 'baptisty-rossii' };
    return { lane: 'content', type: 'series-article', section: 'baptisty-rossii', slug };
  }
  if (u.startsWith('/nagornaya/')) {
    const slug = u.split('/')[2];
    if (!slug) return { lane: 'landing', type: 'series-index', section: 'nagornaya' };
    return { lane: 'content', type: 'series-chapter', section: 'nagornaya', slug };
  }
  if (u.startsWith('/karty/')) {
    const slug = u.split('/')[2];
    if (!slug) return { lane: 'landing', type: 'maps-index', section: 'karty' };
    return { lane: 'special', type: 'map', section: 'karty', slug };
  }
  if (u.startsWith('/konfessii/')) {
    const slug = u.split('/')[2];
    if (!slug) return { lane: 'landing', type: 'confessions-index', section: 'konfessii' };
    return { lane: 'special', type: 'confession', section: 'konfessii', slug };
  }
  if (u === '/biografii') return { lane: 'landing', type: 'biographies-index', section: 'biografii' };
  if (u === '/hard-texts') return { lane: 'landing', type: 'hard-texts-index', section: 'hard-texts' };
  if (u === '/pastor-series') return { lane: 'landing', type: 'pastor-index', section: 'pastor-series' };
  if (u === '/map') return { lane: 'landing', type: 'map-landing', section: 'map' };
  if (u === '/rodosloviye') return { lane: 'special', type: 'genealogy', section: 'rodosloviye' };
  return { lane: 'unknown', type: 'unknown', section: 'unknown' };
}

function getMdxPath(slug) {
  if (!slug) return null;
  const mdxFile = path.join(ROOT, 'src/content/articles', `${slug}.mdx`);
  return fs.existsSync(mdxFile) ? `src/content/articles/${slug}.mdx` : null;
}

function getLegacyPath(urlPath) {
  const u = urlPath.replace(/\/$/, '') || '/';
  const parts = u.split('/').filter(Boolean);
  const rel = parts.join('/') + '/index.html';
  return fs.existsSync(path.join(ROOT, rel)) ? rel : null;
}

const routes = ownershipData.routes;
let generated = 0, skipped = 0;

for (const [urlPath, entry] of Object.entries(routes)) {
  const classification = classifyRoute(urlPath);
  const fileName = urlPath.replace(/\/$/, '').replace(/^\//, '').replace(/\//g, '-') || 'home';
  const profilePath = path.join(outDir, `${fileName}.json`);

  // Skip if detailed profile exists
  if (fs.existsSync(profilePath)) {
    const existing = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    if (existing.anatomy) { skipped++; continue; }
  }

  const mdxPath = getMdxPath(classification.slug);
  const legacyPath = getLegacyPath(urlPath);
  const baselineEntry = baselineData.routes ? baselineData.routes[urlPath] : null;

  const profile = {
    route: urlPath,
    profiledAt: '2026-06-22',
    migrationLane: classification.lane,
    routeType: classification.type,
    section: classification.section,
    slug: classification.slug || null,
    currentStatus: entry.status || 'production-dist',
    source: entry.source || null,
    risk: entry.risk || 0,
    hasMDX: !!mdxPath,
    mdxPath,
    legacyPath,
    visualParity: baselineEntry ? { desktop: baselineEntry.desktopDiff ?? 0, mobile: baselineEntry.mobileDiff ?? 0 } : { desktop: 0, mobile: 0 },
    cssPilot: classification.slug === 'kod-da-vinchi' ? 'site-layered.css' : null,
  };

  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n');
  generated++;
}

console.log(`Generated ${generated} route profiles, skipped ${skipped} existing detailed profiles`);
