#!/usr/bin/env node
/**
 * route-impact-report.js — generates route impact report from changed files.
 *
 * From: GBS non-excluded living audit iter 18 (P1 recommendation)
 *
 * Reads changed files (git diff or --files flag) and produces:
 * - reports/route-impact.json (machine-readable)
 * - reports/route-impact.md (human-readable, for CI summaries)
 *
 * Each affected route gets:
 * - reason (which file triggered it)
 * - migrationMode from matrix
 * - semanticLane from route profile
 * - requiredChecks
 * - scope
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OWNERSHIP_FILE = path.join(ROOT, 'migration/page-ownership.json');
const MATRIX_FILE = path.join(ROOT, 'migration/route-migration-matrix.json');
const PROFILES_DIR = path.join(ROOT, 'data/route-profiles');

const strict = process.argv.includes('--strict');
const filesArg = process.argv.find((a) => a.startsWith('--files='));
const outJson = process.argv.find((a) => a.startsWith('--out-json='))?.split('=')[1] || 'reports/route-impact.json';
const outMd = process.argv.find((a) => a.startsWith('--out-md='))?.split('=')[1] || 'reports/route-impact.md';

// File pattern → route mapping (from source files to production routes)
const SOURCE_ROUTE_MAP = {
  'src/pages/index.astro': ['/'],
  'src/pages/about/index.astro': ['/about/'],
  'src/pages/articles/index.astro': ['/articles/'],
  'src/pages/biografii/index.astro': ['/biografii/'],
  'src/pages/hard-texts/index.astro': ['/hard-texts/'],
  'src/pages/karty/index.astro': ['/karty/'],
  'src/pages/konfessii/index.astro': ['/konfessii/'],
  'src/pages/pastor-series/index.astro': ['/pastor-series/'],
  'src/pages/nagornaya/index.astro': ['/nagornaya/'],
  'src/pages/map/index.astro': ['/map/'],
  'src/components/home/': ['/'],
  'src/components/articles/': ['/articles/'],
  'src/components/biografii/': ['/biografii/'],
  'src/components/hard-texts/': ['/hard-texts/'],
  'src/components/karty/': ['/karty/'],
  'src/components/konfessii/': ['/konfessii/'],
  'src/components/pastor-series/': ['/pastor-series/'],
  'src/components/nagornaya/': ['/nagornaya/'],
  'data/series.json': ['/baptisty-rossii/', '/articles/', '/biografii/', '/'],
  'data/search-manifest.json': ['/'], // affects multiple routes via search
  'data/public-content-baseline.json': ['/'],
  'AGENTS.md': [],
  'package.json': [],
  'scripts/guard-shared-files.js': [],
  'scripts/check-workflows.js': [],
  'scripts/audit-pro.js': [],
  'scripts/check-data-consistency.js': [],
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function matchesPrefix(file, prefix) {
  return file === prefix || file.startsWith(prefix);
}

function getAffectedRoutes(changedFiles) {
  const routes = new Map(); // route → { reason, files }

  for (const file of changedFiles) {
    for (const [pattern, affected] of Object.entries(SOURCE_ROUTE_MAP)) {
      if (matchesPrefix(file, pattern)) {
        for (const route of affected) {
          if (!routes.has(route)) routes.set(route, { files: new Set(), reasons: new Set() });
          routes.get(route).files.add(file);
          routes.get(route).reasons.add(`changed: ${file}`);
        }
      }
    }

    // Special cases: baptisty-rossii subroutes
    if (file.startsWith('src/pages/baptisty-rossii/') && file.includes('/index.astro')) {
      const match = file.match(/src\/pages\/baptisty-rossii\/([^/]+)\/index\.astro/);
      if (match) {
        const slug = match[1];
        const route = `/baptisty-rossii/${slug}/`;
        if (!routes.has(route)) routes.set(route, { files: new Set(), reasons: new Set() });
        routes.get(route).files.add(file);
        routes.get(route).reasons.add(`baptisty article: ${slug}`);
      }
      const landingRoute = '/baptisty-rossii/';
      if (!routes.has(landingRoute)) routes.set(landingRoute, { files: new Set(), reasons: new Set() });
      routes.get(landingRoute).files.add(file);
      routes.get(landingRoute).reasons.add('baptisty article changed');
    }

    // karty subroutes
    if (file.startsWith('src/pages/karty/') && file.includes('/index.astro')) {
      const match = file.match(/src\/pages\/karty\/([^/]+)\/index\.astro/);
      if (match) {
        const slug = match[1];
        const route = `/karty/${slug}/`;
        if (!routes.has(route)) routes.set(route, { files: new Set(), reasons: new Set() });
        routes.get(route).files.add(file);
        routes.get(route).reasons.add(`karty map: ${slug}`);
      }
    }

    // nagornaya subroutes
    if (file.startsWith('src/pages/nagornaya/') && file.includes('/index.astro')) {
      const match = file.match(/src\/pages\/nagornaya\/([^/]+)\/index\.astro/);
      if (match) {
        const slug = match[1];
        const route = `/nagornaya/${slug}/`;
        if (!routes.has(route)) routes.set(route, { files: new Set(), reasons: new Set() });
        routes.get(route).files.add(file);
        routes.get(route).reasons.add(`nagornaya: ${slug}`);
      }
    }

    // Gill articles
    if (file.includes('/dzhon-gill-')) {
      // Gill articles: these are excluded semantic lanes but still appear in catalogs
      const routes = [];
      if (file.includes('/dzhon-gill-chast-1-chelovek/')) routes.push('/articles/dzhon-gill-chast-1-chelovek/');
      if (file.includes('/dzhon-gill-chast-2-uchenyi/')) routes.push('/articles/dzhon-gill-chast-2-uchenyi/');
      if (file.includes('/dzhon-gill-chast-3-nasledie/')) routes.push('/articles/dzhon-gill-chast-3-nasledie/');
      if (file.includes('/dzhon-gill-istoricheskiy-kontekst/')) routes.push('/articles/dzhon-gill-istoricheskiy-kontekst/');
      if (file.includes('/dzhon-gill-spravochnik/')) routes.push('/articles/dzhon-gill-spravochnik/');
      // Also affect discovery routes
      routes.push('/biografii/');
      for (const r of routes) {
        if (!routes.has(r)) routes.set(r, { files: new Set(), reasons: new Set() });
        routes.get(r).files.add(file);
        routes.get(r).reasons.add(`gill content changed: ${file}`);
      }
    }

    // CSS changes → all routes
    if (file.startsWith('css/') || file.startsWith('js/')) {
      const allRoutes = ['/', '/about/', '/articles/', '/biografii/', '/baptisty-rossii/', '/karty/', '/konfessii/', '/pastor-series/', '/hard-texts/', '/nagornaya/', '/map/'];
      for (const r of allRoutes) {
        if (!routes.has(r)) routes.set(r, { files: new Set(), reasons: new Set() });
        routes.get(r).files.add(file);
        routes.get(r).reasons.add(`css/js changed: ${file}`);
      }
    }
  }

  return routes;
}

function getRouteMetadata(route) {
  const ownership = fs.existsSync(OWNERSHIP_FILE) ? readJson(OWNERSHIP_FILE) : { routes: {} };
  const matrix = fs.existsSync(MATRIX_FILE) ? readJson(MATRIX_FILE) : { routes: {} };
  const profileFile = path.join(PROFILES_DIR, route.replace(/^\/|\/$/g, '').replace(/\//g, '__') + '.json');
  const profile = fs.existsSync(profileFile) ? readJson(profileFile) : null;
  const owner = ownership.routes?.[route] || {};
  const contract = matrix.routes?.[route] || {};

  return {
    route,
    owner: owner.owner || 'unknown',
    status: owner.status || 'unknown',
    risk: owner.risk || 0,
    migrationMode: contract.mode || profile?.migrationMode || profile?.currentStatus || 'unknown',
    scope: contract.scope || profile?.scope || 'unknown',
    requiredChecks: contract.audits || [],
  };
}

function buildReport(changedFiles) {
  const affected = getAffectedRoutes(changedFiles);
  const report = {
    generated: new Date().toISOString(),
    totalFiles: changedFiles.length,
    totalRoutes: affected.size,
    changedFiles,
    affectedRoutes: [],
  };

  for (const [route, data] of affected) {
    const meta = getRouteMetadata(route);
    report.affectedRoutes.push({
      route,
      owner: meta.owner,
      status: meta.status,
      risk: meta.risk,
      migrationMode: meta.migrationMode,
      semanticLane: isExcludedRoute(route) ? 'excluded' : meta.scope === 'excluded-semantic-lane' ? 'excluded' : 'non-excluded',
      scope: meta.scope,
      migrationLane: meta.status === 'production-dist' ? 'landing' : meta.migrationMode,
      requiredChecks: meta.requiredChecks,
      changedByFiles: [...data.files],
      reason: [...data.reasons].join(', '),
    });
  }

  return report;
}

function isExcludedRoute(route) {
  if (route.startsWith('/nagornaya/')) return true;
  if (route.startsWith('/hard-texts/')) return true;
  if (route.includes('/dzhon-gill-')) return true;
  if (route === '/articles/krajne-li-isporcheno-serdce/') return true;
  if (route === '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/') return true;
  return false;
}

function toMarkdown(report) {
  const lines = ['## Route Impact Report', '', `Generated: ${report.generated}`, `Changed files: ${report.totalFiles}`, `Affected routes: ${report.totalRoutes}`, ''];

  if (report.affectedRoutes.length === 0) {
    lines.push('No affected routes detected.');
    return lines.join('\n');
  }

  lines.push('### Affected Routes', '');
  lines.push('| Route | Mode | Lane | Risk | Required Checks |');
  lines.push('|-------|------|------|------|-----------------|');
  for (const r of report.affectedRoutes) {
    const checks = r.requiredChecks.length > 0 ? r.requiredChecks.join(', ') : 'visual:parity:screenshot';
    lines.push(`| ${r.route} | ${r.migrationMode} | ${r.semanticLane} | ${r.risk} | ${checks} |`);
  }

  lines.push('', '### Changed Files', '');
  for (const f of report.changedFiles) {
    lines.push(`- \`${f}\``);
  }

  lines.push('', '### Semantic Lane Breakdown', '');
  const byLane = {};
  for (const r of report.affectedRoutes) {
    byLane[r.semanticLane] = (byLane[r.semanticLane] || 0) + 1;
  }
  for (const [lane, count] of Object.entries(byLane)) {
    lines.push(`- **${lane}**: ${count} route(s)`);
  }

  return lines.join('\n');
}

// ---------- main ----------
console.log('=== Route Impact Report ===');

let changedFiles = [];
if (filesArg) {
  const filesPath = filesArg.split('=')[1];
  if (fs.existsSync(filesPath)) {
    changedFiles = fs.readFileSync(filesPath, 'utf8').split('\n').filter(Boolean);
  } else {
    changedFiles = filesPath.split(',').filter(Boolean);
  }
} else {
  try {
    const base = process.env.GUARD_BASE || 'HEAD~1';
    const head = process.env.GUARD_HEAD || 'HEAD';
    changedFiles = execSync(`git diff --name-only ${base} ${head}`, { encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (_) {
    try {
      changedFiles = execSync(`git diff --name-only`, { encoding: 'utf8' })
        .split('\n').map((s) => s.trim()).filter(Boolean);
    } catch (_2) {
      console.error('Could not get changed files. Pass --files=path or set GUARD_BASE/GUARD_HEAD.');
      process.exit(1);
    }
  }
}

console.log(`Changed files: ${changedFiles.length}`);
const report = buildReport(changedFiles);
console.log(`Affected routes: ${report.affectedRoutes.length}`);

// Write outputs
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, outJson), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(ROOT, outMd), toMarkdown(report));

console.log(`Written: ${outJson}`);
console.log(`Written: ${outMd}`);

// Print markdown to stdout
console.log('\n' + toMarkdown(report));