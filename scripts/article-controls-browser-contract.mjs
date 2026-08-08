#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { chromium, webkit } from 'playwright';

const require = createRequire(import.meta.url);
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry.js');

const ROOT = process.cwd();
const DIST = process.env.DIST_ROOT || path.join(ROOT, 'dist');
const BASE = String(process.env.AUDIT_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const OUT = path.join(ROOT, 'reports', 'interactive-audit', 'article-control-census');
const PROGRESS = path.join(OUT, 'progress.ndjson');
const CHECKPOINT = path.join(OUT, 'checkpoint.json');
const MIN_READING_ROUTES = 55;
const VIEWS = [
  ['390', 390, 844, true], ['412', 412, 915, true],
  ['1024', 1024, 900, false], ['1366', 1366, 900, false],
];
const CLICK_VIEWS = new Set(['390', '1366']);
const SCREENSHOT_KINDS = new Set([
  'page-horizontal-overflow', 'control-clipped', 'control-center-obscured',
  'dialog-outside-viewport', 'settings-opened-wrong-surface', 'toc-opened-wrong-surface',
  'menu-label-but-no-section-links', 'back-wrong-destination', 'runtime-errors',
]);
const screenshotCounts = new Map();
const MAX_SCREENSHOTS_PER_ROOT = 2;

const clean = (s, n = 200) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const family = (r) => r.includes('hermenevticheskaya-otsenka') ? 'hermenevtika'
  : r.startsWith('/articles/dzhon-gill-') ? 'gill'
  : r.startsWith('/baptisty-rossii/') ? 'baptisty'
  : r.startsWith('/hard-texts/') ? 'hard-texts'
  : r.startsWith('/nagornaya/chast-') ? 'nagornaya'
  : r.startsWith('/articles/') ? 'articles' : 'other';

function distFileForRoute(route) {
  return path.join(DIST, route.replace(/^\/+|\/+$/g, ''), 'index.html');
}

function discoverRoutes() {
  const registry = buildPublicSurfaceRegistry();
  if (registry.errors.length) throw new Error(`Public surface registry is invalid:\n${registry.errors.join('\n')}`);
  const routes = registry.entries
    .filter((entry) => entry.routeRole === 'reading')
    .map((entry) => entry.route)
    .sort((a, b) => a.localeCompare(b));
  const missingDist = routes.filter((route) => !fs.existsSync(distFileForRoute(route)));
  if (missingDist.length) throw new Error(`Reading routes missing from production-like dist: ${missingDist.join(', ')}`);
  if (routes.length < MIN_READING_ROUTES) throw new Error(`Reading route authority unexpectedly shrank: ${routes.length} < ${MIN_READING_ROUTES}`);
  const familyCounts = routes.reduce((acc, route) => { const key = family(route); acc[key] = (acc[key] || 0) + 1; return acc; }, {});
  console.log(`ARTICLE CONTROL ROUTE AUTHORITY routes=${routes.length} families=${JSON.stringify(familyCounts)}`);
  return routes;
}

async function makeContext(browser, width, height, mobile) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const origin = new URL(BASE).origin;
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    let same = false;
    try { same = new URL(u).origin === origin; } catch (_) {}
    if (same || u.startsWith('data:') || u.startsWith('blob:')) await route.continue();
    else await route.fulfill({ status: 204, contentType: 'text/plain', body: '' });
  });
  await ctx.addInitScript(() => {
    window.print = () => { window.__auditPrint = true; };
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { window.__auditShare = true; } }); } catch (_) {}
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (v) => { window.__auditClip = String(v || ''); } } }); } catch (_) {}
  });
  return ctx;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const rendered = (e) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity !== 0 && r.width > .5 && r.height > .5;
    };
    const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('data-tip') || e.textContent || '').replace(/\s+/g, ' ').trim();
    const classKey = (e) => String(e.className || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
    const identityBase = (e) => {
      if (e.id) return `id:${e.id}`;
      const fc = e.getAttribute('data-fc-action') || '';
      const action = e.getAttribute('data-action') || '';
      const home = e.getAttribute('data-home-href') || '';
      const controls = e.getAttribute('aria-controls') || '';
      const type = e.getAttribute('type') || '';
      const role = e.getAttribute('role') || '';
      const cls = classKey(e);
      const fallbackName = (fc || action || home || controls || cls) ? '' : name(e).slice(0, 120);
      return JSON.stringify({ tag: e.tagName, fc, action, home, controls, type, role, cls, fallbackName });
    };
    const renderedControls = [...document.querySelectorAll('button,[role="button"]')].filter(rendered);
    const seen = new Map();
    const controls = renderedControls.map((e) => {
      const base = identityBase(e);
      const identityOccurrence = seen.get(base) || 0;
      seen.set(base, identityOccurrence + 1);
      const r = e.getBoundingClientRect(), inView = r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
      const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2)), y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y), cls = String(e.className || ''), inline = !!e.closest('p,blockquote');
      const specialized = inline || /(?:^|\s)(?:bref|fn-marker|gterm|tooltip-trigger|quiz-option|map-trigger)(?:\s|$)/.test(cls);
      const ordinal = e.classList.contains('fn-marker') ? [...e.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent || '').join('').replace(/\s+/g, '').trim() : '';
      const blockedByContainer = !!e.closest('[inert],[hidden],[aria-hidden="true"]');
      const disabled = !!e.disabled || e.getAttribute('aria-disabled') === 'true';
      const interactable = !blockedByContainer && !disabled && getComputedStyle(e).pointerEvents !== 'none';
      return {
        identityBase: base, identityOccurrence,
        id: e.id || '', name: name(e).slice(0, 160), text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100), cls: cls.slice(0, 140),
        fc: e.getAttribute('data-fc-action') || '', action: e.getAttribute('data-action') || '', homeHref: e.getAttribute('data-home-href') || '',
        ariaControls: e.getAttribute('aria-controls') || '', ariaExpanded: e.getAttribute('aria-expanded'), ariaHaspopup: e.getAttribute('aria-haspopup') || '', ordinal,
        w: +r.width.toFixed(1), h: +r.height.toFixed(1), inView, clipped: inView && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1),
        owns: !inView || !!(hit && (hit === e || e.contains(hit))), inline, specialized, disabled, interactable,
      };
    });
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id).filter(Boolean);
    const invalidListChildren = [...document.querySelectorAll('ul > :not(li):not(script):not(template),ol > :not(li):not(script):not(template)')].filter(rendered).map((e) => ({ tag: e.tagName, id: e.id || '', cls: String(e.className || '').slice(0, 120) }));
    const refs = [];
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
      document.querySelectorAll(`[${attr}]`).forEach((e) => {
        for (const id of (e.getAttribute(attr) || '').split(/\s+/).filter(Boolean)) if (!document.getElementById(id)) refs.push({ attr, id, owner: e.id || '', name: name(e).slice(0, 120) });
      });
    }
    const badLabels = [...document.querySelectorAll('label[for]')].map(e => ({ for: e.getAttribute('for') || '', text: name(e).slice(0, 120) })).filter(x => x.for && !document.getElementById(x.for));
    const backTargets = [...document.querySelectorAll('[data-home-href]')].map((e) => ({ id: e.id || '', name: name(e).slice(0, 80), href: e.getAttribute('data-home-href') || '', path: (() => { try { return new URL(e.getAttribute('data-home-href') || '', location.href).pathname; } catch { return ''; } })() })).filter(x => /Назад/i.test(x.name));
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, controls,
      dupIds: [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))], invalidListChildren, brokenReferences: refs, badLabels, backTargets,
    };
  });
}

const clickable = (c) => {
  const explicit = Boolean(c.fc || c.action || c.homeHref);
  if (c.disabled || !c.interactable) return false;
  if (c.fc === 'play' || /Озвучк|Пауза|Play/i.test(c.name)) return false;
  if (c.specialized && !explicit) return false;
  return Boolean(c.name || c.id || explicit);
};

async function reset(page, route) {
  for (let i = 0; i < 2; i++) { try { await page.keyboard.press('Escape'); } catch (_) {} await page.waitForTimeout(10); }
  if (new URL(page.url()).pathname !== route) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(80);
  }
}

async function bindStableControl(page, c) {
  return page.evaluate((expected) => {
    const rendered = (e) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity !== 0 && r.width > .5 && r.height > .5;
    };
    const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('data-tip') || e.textContent || '').replace(/\s+/g, ' ').trim();
    const classKey = (e) => String(e.className || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
    const identityBase = (e) => {
      if (e.id) return `id:${e.id}`;
      const fc = e.getAttribute('data-fc-action') || '';
      const action = e.getAttribute('data-action') || '';
      const home = e.getAttribute('data-home-href') || '';
      const controls = e.getAttribute('aria-controls') || '';
      const type = e.getAttribute('type') || '';
      const role = e.getAttribute('role') || '';
      const cls = classKey(e);
      const fallbackName = (fc || action || home || controls || cls) ? '' : name(e).slice(0, 120);
      return JSON.stringify({ tag: e.tagName, fc, action, home, controls, type, role, cls, fallbackName });
    };
    document.querySelectorAll('[data-gb-audit-active-control]').forEach((e) => e.removeAttribute('data-gb-audit-active-control'));
    const matches = [...document.querySelectorAll('button,[role="button"]')].filter(rendered).filter((e) => identityBase(e) === expected.identityBase);
    const target = matches[expected.identityOccurrence];
    if (!target) return { ok: false, reason: 'stable-control-missing', candidates: matches.length };
    if (target.disabled || target.getAttribute('aria-disabled') === 'true' || target.closest('[inert],[hidden],[aria-hidden="true"]') || getComputedStyle(target).pointerEvents === 'none') {
      return { ok: false, reason: 'stable-control-not-interactable', actualName: name(target).slice(0, 160) };
    }
    target.setAttribute('data-gb-audit-active-control', '1');
    return { ok: true, actualId: target.id || '', actualName: name(target).slice(0, 160) };
  }, { identityBase: c.identityBase, identityOccurrence: c.identityOccurrence });
}

async function clickOne(page, route, c) {
  await reset(page, route);
  const bound = await bindStableControl(page, c);
  if (!bound.ok) return { ok: false, error: `${bound.reason} candidates=${bound.candidates ?? ''} actual=${bound.actualName || ''}`.trim() };
  const loc = page.locator('[data-gb-audit-active-control="1"]').first();
  try { await loc.scrollIntoViewIfNeeded({ timeout: 1800 }); await loc.click({ timeout: 2500 }); } catch (e) { return { ok: false, error: clean(e.message, 300) }; }
  await page.waitForTimeout(80);
  return page.evaluate(({ ariaControls }) => {
    const vis = (e) => {
      if (!e || e.hidden || e.closest('[inert],[hidden],[aria-hidden="true"]')) return false;
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity !== 0 && r.width > 2 && r.height > 2;
    };
    const dialogs = [...document.querySelectorAll('[role="dialog"],dialog')].filter(vis).map(e => ({ id: e.id || '', text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220), rect: (() => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })() }));
    const cp = document.querySelector('.cp-backdrop.is-open');
    const openText = [...document.querySelectorAll('.is-open,[aria-hidden="false"],[open]')].filter(vis).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).join(' ').slice(0, 600);
    const cpLinks = cp ? [...cp.querySelectorAll('a[href]')].filter(vis).map(a => a.getAttribute('href') || '') : [];
    const trigger = document.querySelector('[data-gb-audit-active-control="1"]');
    const controlled = ariaControls ? document.getElementById(ariaControls) : null;
    return {
      ok: true, url: location.href, dialogs, openText, cp: !!cp, cpInternal: cpLinks.filter(h => h.startsWith('/') || h.startsWith('.') || h.startsWith('#')).length,
      print: window.__auditPrint === true, share: window.__auditShare === true, clip: window.__auditClip || '', triggerExpanded: trigger?.getAttribute('aria-expanded') ?? null,
      controlled: ariaControls ? { id: ariaControls, exists: !!controlled, visible: !!(controlled && vis(controlled)), ariaHidden: controlled?.getAttribute('aria-hidden') ?? null } : null,
    };
  }, { ariaControls: c.ariaControls });
}

function semanticIssues(c, o, route) {
  if (!o.ok) return [['click-failed', o.error]];
  const label = `${c.name} ${c.text}`, surface = `${o.dialogs.map(d => d.text).join(' ')} ${o.openText}`, out = [];
  const popupIntent = /Настройки|Открыть оглавление|Оглавление статьи|Сейчас читаете|Открыть меню|Справка/i.test(label);
  if (/Настройки чтения|Настройки$/i.test(label) && !/Настройки|Тема|Размер текста|Межстроч/i.test(surface)) out.push(['settings-opened-wrong-surface', { label, dialogs: o.dialogs, cp: o.cp }]);
  if (/Открыть оглавление|Оглавление статьи|Сейчас читаете/i.test(label) && !/Оглавление|раздел/i.test(surface)) out.push(['toc-opened-wrong-surface', { label, dialogs: o.dialogs, cp: o.cp }]);
  if ((c.fc === 'search' || /Поиск и разделы сайта/i.test(label)) && !o.cp) out.push(['global-search-did-not-open-command-palette', { label, dialogs: o.dialogs }]);
  if (/Поиск и разделы сайта/i.test(label) && o.cp && o.cpInternal < 2) out.push(['menu-label-but-no-section-links', { label, links: o.cpInternal }]);
  if (c.homeHref && /Назад/i.test(label)) { const expected = new URL(c.homeHref, BASE + route).pathname, actual = new URL(o.url).pathname; if (actual !== expected) out.push(['back-wrong-destination', { label, expected, actual, homeHref: c.homeHref }]); }
  if (popupIntent && !c.ariaControls) out.push(['popup-trigger-missing-aria-controls', { label, id: c.id, fc: c.fc, action: c.action }]);
  if (popupIntent && c.ariaControls) {
    if (!o.controlled?.exists || !o.controlled.visible || o.controlled.ariaHidden === 'true') out.push(['controlled-surface-not-open', { label, controlled: o.controlled }]);
    if (c.ariaExpanded === 'false' && o.triggerExpanded !== 'true') out.push(['popup-expanded-not-synced', { label, ariaControls: c.ariaControls, after: o.triggerExpanded }]);
  }
  if (c.action === 'print' && !o.print) out.push(['print-no-outcome', label]);
  if ((c.action === 'share' || /Поделиться/i.test(label)) && !(o.dialogs.length || o.share || o.clip)) out.push(['share-no-outcome', label]);
  return out;
}

async function maybeScreenshot(page, kind, route, browserName, viewName) {
  if (!SCREENSHOT_KINDS.has(kind)) return;
  const key = `${kind}|${family(route)}|${browserName}`;
  const count = screenshotCounts.get(key) || 0;
  if (count >= MAX_SCREENSHOTS_PER_ROOT) return;
  screenshotCounts.set(key, count + 1);
  const safe = route.replace(/\W+/g, '_');
  try { await page.screenshot({ path: path.join(OUT, `${kind}-${safe}-${browserName}-${viewName}-${count + 1}.png`), fullPage: false }); } catch (_) {}
}

function appendProgress(scene, completed, expected) {
  const compact = { route: scene.route, family: scene.family, browser: scene.browser, view: scene.view, controls: scene.controls, skippedSpecialized: scene.skippedSpecialized, clickCount: scene.clicks.length, issueCount: scene.issues.length, issues: scene.issues };
  fs.appendFileSync(PROGRESS, `${JSON.stringify(compact)}\n`);
  fs.writeFileSync(CHECKPOINT, `${JSON.stringify({ schemaVersion: 2, identityMode: 'stable-signature-v1', sourceSha: process.env.SOURCE_SHA || '', completedScenes: completed, expectedScenes: expected, last: compact }, null, 2)}\n`);
  console.log(`ARTICLE CONTROL PROGRESS ${completed}/${expected} ${scene.browser}/${scene.view} ${scene.route} controls=${scene.controls} clicks=${scene.clicks.length} issues=${scene.issues.length}`);
}

async function scene(browser, browserName, route, view, doClicks) {
  const [viewName, width, height, mobile] = view, ctx = await makeContext(browser, width, height, mobile), page = await ctx.newPage(), errors = [], issues = [], clicks = [];
  page.on('pageerror', e => errors.push(`PAGE_ERROR: ${clean(e.message, 500)}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|yandex|metrika/i.test(m.text())) errors.push(clean(m.text(), 500)); });
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(180);
    if (!resp || !resp.ok()) issues.push(['route-status', resp ? resp.status() : null]);
    const snap = await snapshot(page);
    const baseIssues = [];
    if (snap.overflow > 1) baseIssues.push(['page-horizontal-overflow', snap.overflow]);
    if (snap.dupIds.length) baseIssues.push(['duplicate-dom-ids', snap.dupIds.slice(0, 20)]);
    if (snap.invalidListChildren.length) baseIssues.push(['invalid-list-direct-child', { count: snap.invalidListChildren.length, sample: snap.invalidListChildren.slice(0, 8) }]);
    if (snap.brokenReferences.length) baseIssues.push(['broken-aria-reference', { count: snap.brokenReferences.length, sample: snap.brokenReferences.slice(0, 10) }]);
    if (snap.badLabels.length) baseIssues.push(['broken-label-for', { count: snap.badLabels.length, sample: snap.badLabels.slice(0, 8) }]);
    const backPaths = [...new Set(snap.backTargets.map(x => x.path).filter(Boolean))];
    if (backPaths.length > 1) baseIssues.push(['back-authority-drift', { targets: snap.backTargets }]);
    const footnoteName = snap.controls.filter(c => /fn-marker/.test(c.cls) && /^\d+$/.test(c.ordinal) && /^Показать сноску$/i.test(c.name));
    const footnoteControls = snap.controls.filter(c => /fn-marker/.test(c.cls) && /^\d+$/.test(c.ordinal) && !c.ariaControls);
    if (footnoteName.length) baseIssues.push(['footnote-name-not-unique', { count: footnoteName.length, sample: footnoteName.slice(0, 6).map(c => ({ ordinal: c.ordinal, name: c.name, id: c.id })) }]);
    if (footnoteControls.length) baseIssues.push(['footnote-missing-aria-controls', { count: footnoteControls.length, sample: footnoteControls.slice(0, 6).map(c => ({ ordinal: c.ordinal, name: c.name, id: c.id })) }]);
    for (const c of snap.controls) {
      if (!c.name && !c.specialized) baseIssues.push(['control-no-accessible-name', c]);
      if (!c.specialized && c.interactable && (c.w < 24 || c.h < 24)) baseIssues.push(['small-control-target', c]);
      if (!c.specialized && c.interactable && c.clipped) baseIssues.push(['control-clipped', c]);
      if (!c.specialized && c.interactable && c.inView && !c.owns) baseIssues.push(['control-center-obscured', c]);
    }
    issues.push(...baseIssues); for (const [kind] of baseIssues) await maybeScreenshot(page, kind, route, browserName, viewName);
    if (doClicks) {
      for (const c of snap.controls) {
        if (!clickable(c)) continue;
        const o = await clickOne(page, route, c);
        clicks.push({ key: c.identityBase, occurrence: c.identityOccurrence, name: c.name.slice(0, 80), ok: o.ok, url: o.ok ? new URL(o.url).pathname : '', cp: o.ok ? o.cp : false, expanded: o.ok ? o.triggerExpanded : null });
        for (const [kind, detail] of semanticIssues(c, o, route)) {
          issues.push([kind, { control: { id: c.id, name: c.name, cls: c.cls, ariaControls: c.ariaControls, identityBase: c.identityBase, identityOccurrence: c.identityOccurrence }, detail }]);
          await maybeScreenshot(page, kind, route, browserName, viewName);
        }
        if (o.ok) for (const d of o.dialogs) {
          const [l, t, r, b] = d.rect;
          if (l < -2 || t < -2 || r > width + 2 || b > height + 2) {
            issues.push(['dialog-outside-viewport', { control: { id: c.id, name: c.name }, dialog: d }]);
            await maybeScreenshot(page, 'dialog-outside-viewport', route, browserName, viewName);
          }
        }
      }
    }
    if (errors.length) { issues.push(['runtime-errors', errors.slice(0, 8)]); await maybeScreenshot(page, 'runtime-errors', route, browserName, viewName); }
    return { route, family: family(route), browser: browserName, view: viewName, controls: snap.controls.length, skippedSpecialized: snap.controls.filter(c => c.specialized && !c.fc && !c.action && !c.homeHref).length, clicks, issues };
  } finally { await page.close().catch(() => {}); await ctx.close().catch(() => {}); }
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const routes = discoverRoutes(), reps = [];
  for (const f of ['hermenevtika', 'gill', 'baptisty', 'hard-texts', 'nagornaya', 'articles']) { const r = routes.find(x => family(x) === f); if (r) reps.push(r); }
  const expected = routes.length * VIEWS.length + reps.length * CLICK_VIEWS.size, scenes = []; let completed = 0;
  const cb = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try { for (const r of routes) for (const v of VIEWS) { const s = await scene(cb, 'chromium', r, v, CLICK_VIEWS.has(v[0])); scenes.push(s); appendProgress(s, ++completed, expected); } } finally { await cb.close(); }
  const wb = await webkit.launch({ headless: true });
  try { for (const r of reps) for (const v of VIEWS.filter(x => CLICK_VIEWS.has(x[0]))) { const s = await scene(wb, 'webkit', r, v, true); scenes.push(s); appendProgress(s, ++completed, expected); } } finally { await wb.close(); }
  const manifestations = scenes.flatMap(s => s.issues.map(([kind, detail]) => ({ route: s.route, family: s.family, browser: s.browser, view: s.view, kind, detail })));
  const issueKinds = manifestations.reduce((a, i) => (a[i.kind] = (a[i.kind] || 0) + 1, a), {});
  const summary = {
    schemaVersion: 5,
    identityMode: 'stable-signature-v1',
    genericGeometryPolicy: 'interactable-non-specialized-controls-only',
    sourceSha: process.env.SOURCE_SHA || '', generatedAt: new Date().toISOString(), routeCount: routes.length, sceneCount: scenes.length,
    controlObservations: scenes.reduce((n, s) => n + s.controls, 0), controlClicks: scenes.reduce((n, s) => n + s.clicks.length, 0), specializedInlineSkipped: scenes.reduce((n, s) => n + s.skippedSpecialized, 0),
    webkitRepresentatives: reps, issueCount: manifestations.length, issueKinds, issues: manifestations,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, 'scenes.json'), `${JSON.stringify(scenes, null, 2)}\n`);
  console.log(`ARTICLE CONTROL CENSUS routes=${summary.routeCount} scenes=${summary.sceneCount} controls=${summary.controlObservations} clicks=${summary.controlClicks} specialized-skipped=${summary.specializedInlineSkipped}`);
  console.log(`ARTICLE CONTROL ISSUE KINDS ${JSON.stringify(issueKinds)}`);
  if (manifestations.length) {
    console.log(`❌ ${manifestations.length} issue manifestation(s)`);
    for (const i of manifestations.slice(0, 180)) console.log(`- ${i.kind} ${i.browser}/${i.view} ${i.route}: ${JSON.stringify(i.detail)}`);
    process.exitCode = 1;
  } else console.log('✅ Article control census passed');
}

main().catch(e => { console.error('FATAL', e); process.exitCode = 1; });
