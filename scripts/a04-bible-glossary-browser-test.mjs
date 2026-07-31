#!/usr/bin/env node
/** A04 route-wide ownership census and interaction orchestrator. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  REPORT, SNAPSHOT, DESKTOP, SURFACES, LEGACY, results, record,
  launchBrowser, serve, configureContext, loadSourceContract,
} from './lib/a04-contract.mjs';
import { inspectRoute, desktopWitness, mobileWitness } from './lib/a04-browser-witness.mjs';

const require = createRequire(import.meta.url);
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');

const registry = buildPublicSurfaceRegistry();
if (registry.errors.length) {
  registry.errors.forEach((error) => console.error(`REGISTRY ERROR ${error}`));
  process.exit(1);
}
const productionEntries = registry.entries
  .filter((entry) => entry.status === 'production-dist')
  .sort((a, b) => a.route.localeCompare(b.route));
const sourceContract = await loadSourceContract();
record('*', 'a04-source', 'source:66-books', sourceContract.bibleRegistry.bookCount === 66, sourceContract.bibleRegistry.bookCount);
record('*', 'a04-source', 'source:39-old-testament', sourceContract.bibleRegistry.testamentCounts.OT === 39, JSON.stringify(sourceContract.bibleRegistry.testamentCounts));
record('*', 'a04-source', 'source:27-new-testament', sourceContract.bibleRegistry.testamentCounts.NT === 27, JSON.stringify(sourceContract.bibleRegistry.testamentCounts));
record('*', 'a04-source', 'source:ot-synodal-owner', sourceContract.bibleRegistry.defaultTranslationByTestament.OT === 'synodal', JSON.stringify(sourceContract.bibleRegistry.defaultTranslationByTestament));
record('*', 'a04-source', 'source:nt-kassian-owner', sourceContract.bibleRegistry.defaultTranslationByTestament.NT === 'kassian', JSON.stringify(sourceContract.bibleRegistry.defaultTranslationByTestament));
record('*', 'a04-source', 'source:no-testament-owner-drift', sourceContract.bibleRegistry.ownerDrift.length === 0, sourceContract.bibleRegistry.ownerDrift.join(', '));
record('*', 'a04-source', 'source:partial-materialization-explicit', sourceContract.bibleRegistry.materializedBookCount > 0 && sourceContract.bibleRegistry.materializedBookCount + sourceContract.bibleRegistry.registryOnlyBookCount === 66, JSON.stringify({ materialized: sourceContract.bibleRegistry.materializedBookCount, registryOnly: sourceContract.bibleRegistry.registryOnlyBookCount }));
record('*', 'a04-source', 'source:original-words-schema-provenance', sourceContract.originalWords.entryCount > 0 && sourceContract.originalWords.issues.length === 0, sourceContract.originalWords.issues.join(', '));
record('*', 'a04-source', 'source:original-words-metadata-separated', sourceContract.originalWords.metadataKeys.includes('_provenance'), JSON.stringify(sourceContract.originalWords.metadataKeys));

const routeResults = [];
const candidateRoutes = Object.fromEntries(SURFACES.map((surface) => [surface.id, []]));
const { server, base } = await serve();
const browser = await launchBrowser();
try {
  const censusContext = await browser.newContext({ viewport: DESKTOP, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  await configureContext(censusContext, base);
  const page = await censusContext.newPage();
  for (const entry of productionEntries) {
    const pageErrors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)));
    let response = null;
    let navigationError = '';
    let facts = { surfaces: {}, legacy: {} };
    try {
      response = await page.goto(base + entry.route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(120);
      facts = await inspectRoute(page, SURFACES, LEGACY);
    } catch (error) {
      navigationError = String(error?.message || error).slice(0, 500);
    }
    record(entry.route, 'a04-census', 'document:navigation', navigationError === '', navigationError || 'DOM loaded');
    record(entry.route, 'a04-census', 'document:status', response?.status() === 200, response?.status() ?? 'no response');
    record(entry.route, 'a04-census', 'runtime:no-pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    for (const surface of SURFACES) {
      const surfaceFacts = facts.surfaces[surface.id] || {};
      record(entry.route, 'a04-census', `surface:${surface.id}:paired`, (surfaceFacts.unpairedTriggerCount || 0) === 0 && (surfaceFacts.emptyContentCount || 0) === 0, JSON.stringify(surfaceFacts));
      record(entry.route, 'a04-census', `surface:${surface.id}:no-authored-nested-controls`, (surfaceFacts.nestedAuthoredInteractiveCount || 0) === 0, JSON.stringify(surfaceFacts));
      if ((surfaceFacts.ownedTriggerCount || 0) > 0) candidateRoutes[surface.id].push(entry.route);
    }
    for (const surface of LEGACY) {
      const legacyFacts = facts.legacy[surface.id] || {};
      record(entry.route, 'a04-census', `surface:${surface.id}:absent-public-markup`, (legacyFacts.triggerCount || 0) === 0 && (legacyFacts.tipCount || 0) === 0, JSON.stringify(legacyFacts));
    }
    routeResults.push({
      route: entry.route, surface: entry.surface, routeRole: entry.routeRole,
      responseStatus: response?.status() ?? null, navigationError, pageErrors,
      surfaces: facts.surfaces, legacy: facts.legacy,
    });
  }
  await censusContext.close();

  const interactionWitnesses = {};
  for (const surface of SURFACES) {
    const routes = [...new Set(candidateRoutes[surface.id])];
    record('*', 'a04-coverage', `surface:${surface.id}:present-public-route`, routes.length > 0, JSON.stringify(routes));
    const desktop = await desktopWitness(browser, base, routes, surface);
    const mobile = await mobileWitness(browser, base, routes, surface);
    interactionWitnesses[surface.id] = { surface, routes, desktop, mobile };

    record(desktop.route || '*', 'a04-desktop', `surface:${surface.id}:focusable`, desktop.focusable, JSON.stringify(desktop));
    if (surface.activation.includes('desktop-focus')) {
      record(desktop.route || '*', 'a04-desktop', `surface:${surface.id}:focus-opens`, desktop.focusOpens === true, JSON.stringify(desktop));
    }
    record(desktop.route || '*', 'a04-desktop', `surface:${surface.id}:opens`, desktop.opens, JSON.stringify(desktop));
    record(desktop.route || '*', 'a04-desktop', `surface:${surface.id}:shared-owner-mount`, desktop.mountedToBody && desktop.tipDetachedFromTrigger, JSON.stringify(desktop));
    record(desktop.route || '*', 'a04-desktop', `surface:${surface.id}:inside-viewport`, desktop.insideViewport, JSON.stringify(desktop));
    record(desktop.route || '*', 'a04-desktop', `surface:${surface.id}:escape-closes`, desktop.escapeCloses, JSON.stringify(desktop));
    record(desktop.route || '*', 'a04-desktop', `surface:${surface.id}:focus-continuity`, desktop.focusContinuity, JSON.stringify(desktop));
    record(desktop.route || '*', 'a04-desktop', `surface:${surface.id}:no-pageerror`, desktop.pageErrors.length === 0 && !desktop.error, JSON.stringify(desktop));

    record(mobile.route || '*', 'a04-mobile-390', `surface:${surface.id}:reduced-motion`, mobile.reducedMotion, JSON.stringify(mobile));
    record(mobile.route || '*', 'a04-mobile-390', `surface:${surface.id}:touch-opens`, mobile.touchOpens, JSON.stringify(mobile));
    record(mobile.route || '*', 'a04-mobile-390', `surface:${surface.id}:shared-owner-mount`, mobile.mountedToBody && mobile.tipDetachedFromTrigger, JSON.stringify(mobile));
    record(mobile.route || '*', 'a04-mobile-390', `surface:${surface.id}:inside-viewport`, mobile.insideViewport, JSON.stringify(mobile));
    record(mobile.route || '*', 'a04-mobile-390', `surface:${surface.id}:second-touch-closes`, mobile.secondTouchCloses, JSON.stringify(mobile));
    record(mobile.route || '*', 'a04-mobile-390', `surface:${surface.id}:no-pageerror`, mobile.pageErrors.length === 0 && !mobile.error, JSON.stringify(mobile));
  }

  record('*', 'a04-coverage', 'registry:all-production-routes-scanned', routeResults.length === productionEntries.length, `${routeResults.length}/${productionEntries.length}`);

  const baseReport = JSON.parse(await readFile(REPORT, 'utf8'));
  const priorResults = (baseReport.results || []).filter((item) => !String(item.viewport || '').startsWith('a04-'));
  const combinedResults = [...priorResults, ...results];
  const failed = combinedResults.filter((item) => !item.ok);
  const ownFailures = results.filter((item) => !item.ok);
  const surfaceCoverage = Object.fromEntries(SURFACES.map((surface) => {
    const triggerRoutes = routeResults.filter((row) => (row.surfaces[surface.id]?.ownedTriggerCount || 0) > 0).map((row) => row.route);
    const rawTriggerCount = routeResults.reduce((sum, row) => sum + (row.surfaces[surface.id]?.rawTriggerCount || 0), 0);
    const ownedTriggerCount = routeResults.reduce((sum, row) => sum + (row.surfaces[surface.id]?.ownedTriggerCount || 0), 0);
    const exceptionCount = routeResults.reduce((sum, row) => sum + (row.surfaces[surface.id]?.exceptionCount || 0), 0);
    return [surface.id, { ...surface, triggerRoutes, rawTriggerCount, ownedTriggerCount, exceptionCount }];
  }));

  await writeFile(REPORT, JSON.stringify({
    ...baseReport,
    schemaVersion: Math.max(Number(baseReport.schemaVersion || 0), 3),
    a04Snapshot: SNAPSHOT,
    generatedAt: new Date().toISOString(),
    total: combinedResults.length,
    passed: combinedResults.length - failed.length,
    failed: failed.length,
    results: combinedResults,
    a04BibleGlossaryOwnership: {
      productionRoutes: productionEntries.length,
      scannedRoutes: routeResults.length,
      sourceContract,
      surfaceCoverage,
      interactionWitnesses,
      routes: routeResults,
      webkitBarrier: 'owned by Public surfaces — webkit touch/scroll on the same canonical production-route registry',
    },
  }, null, 2));

  console.log(`A04 Bible/glossary ownership: ${results.length - ownFailures.length}/${results.length} passed; routes=${routeResults.length}/${productionEntries.length}; books=${sourceContract.bibleRegistry.bookCount}; materialized=${sourceContract.bibleRegistry.materializedBookCount}; registry-only=${sourceContract.bibleRegistry.registryOnlyBookCount}; original-words=${sourceContract.originalWords.entryCount}`);
  for (const [id, witness] of Object.entries(interactionWitnesses)) {
    console.log(`A04 WITNESS ${id}: desktop=${witness.desktop.route || '—'}; mobile=${witness.mobile.route || '—'}; activation=${witness.surface.activation}`);
  }
  if (ownFailures.length) {
    ownFailures.forEach((failure) => console.error(`FAIL ${failure.route} ${failure.viewport} ${failure.contract}: ${failure.detail}`));
    process.exit(1);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
