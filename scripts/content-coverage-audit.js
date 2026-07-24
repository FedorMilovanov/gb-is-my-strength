#!/usr/bin/env node
'use strict';
// GATE-GAP-NATIVE-TEXT-PARITY (2026-07-05) — word-coverage guard.
//
// Regression class: CONTENT-PARITY-LOSS-01. For routes whose legacy HTML is
// still canonical/runtime-required, compare its WORD MULTISET with built dist.
//
// Strict-native routes use the declared Astro import graph as production truth.
// Their legacy shadow is explicitly `reference-only` (or absent) and MUST NOT be
// promoted back into a blocking content oracle. Those routes are validated by
// the native source/dist contracts instead.
//
// Thresholds: warn > WARN_PCT, fail > FAIL_PCT of authoritative legacy words
// missing from dist. Per-route allowlists below document intentional divergence.
//
// Usage: node scripts/content-coverage-audit.js   (requires built dist/)
const fs = require('fs');
const path = require('path');
const {
  legacyIsAuthoritative,
  loadRouteProfile,
} = require('./lib/legacy-source-authority');

const ROOT = path.resolve(__dirname, '..');
const DIST = process.env.DIST_ROOT || path.join(ROOT, 'dist');
const WARN_PCT = 2;
const FAIL_PCT = 10;

// Routes where dist intentionally diverges from an otherwise authoritative
// legacy surface. Every entry MUST carry a reason.
const ALLOW = new Map([
  // Redesigned hub: legacy page is a thin index; native Astro home is richer
  // and does not embed the legacy word set verbatim.
  ['index.html', 'home hub redesigned natively (h-* system); legacy root is historical'],
]);

// Documented per-route thresholds (still audited — a rise above maxPct fails).
// Use ONLY for pages whose authoritative legacy surface contains client-rendered
// UI text or in-SVG labels that the native app renders at runtime.
const THRESHOLD = new Map([
  // Full-screen MapEngine app. Narrative (8 stages), editorial method note and
  // the complete 14-item «Источники и метод» archaeology list are statically
  // present (sr-only, data-pagefind-body). Remaining legacy-only words are
  // in-SVG geo labels (ЛИВАН, ДЕЛЬТА НИЛА…) and old app UI strings rendered
  // client-side by the engine.
  ['karty/avraam/index.html', { maxPct: 40, reason: 'SVG geo labels + legacy app UI strings render client-side; narrative and sources are statically present' }],
]);

function words(txt) {
  const m = new Map();
  for (const w of txt.matchAll(/[А-Яа-яЁё]{3,}/g)) {
    const k = w[0].toLowerCase();
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function pageText(raw) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function loadOwnership() {
  const p = path.join(ROOT, 'migration', 'page-ownership.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return j.routes || j.pages || j;
}

let failures = 0, checks = 0, warns = 0;
const ok = m => { checks++; console.log('OK ' + m); };
const bad = m => { checks++; failures++; console.log('FAIL ' + m); };
const warn = m => { warns++; console.log('WARN ' + m); };

if (!fs.existsSync(DIST)) {
  console.error('dist not found at ' + DIST + ' — run a strangler build first');
  process.exit(1);
}

const ownership = loadOwnership();
let covered = 0, skipped = 0;
for (const [route, meta] of Object.entries(ownership)) {
  if (!meta || meta.owner !== 'astro') continue;

  const { profile } = loadRouteProfile(route);
  if (!legacyIsAuthoritative(profile)) {
    skipped++;
    const status = profile?.legacyStatus || 'unknown';
    const source = profile?.renderSource || profile?.source || meta.source || 'declared Astro source';
    console.log(`SKIP ${route}: legacyStatus=${status}; production truth is ${source}`);
    continue;
  }

  const rel = route.replace(/^\//, '') + 'index.html';
  const legacyPath = path.join(ROOT, rel === 'index.html' ? 'index.html' : rel);
  const distPath = path.join(DIST, rel === 'index.html' ? 'index.html' : rel);
  if (!fs.existsSync(legacyPath)) { skipped++; continue; }
  if (!fs.existsSync(distPath)) { bad(`${route}: astro-owned but missing in dist`); continue; }
  if (ALLOW.has(rel)) { skipped++; console.log(`SKIP ${route}: ${ALLOW.get(rel)}`); continue; }

  const lw = words(pageText(fs.readFileSync(legacyPath, 'utf8')));
  const dw = words(pageText(fs.readFileSync(distPath, 'utf8')));
  let total = 0, missing = 0;
  const missingWords = [];
  for (const [w, n] of lw) {
    total += n;
    if (!dw.has(w)) { missing += n; if (missingWords.length < 10) missingWords.push(w); }
  }
  if (!total) { skipped++; continue; }
  const pct = (missing / total) * 100;
  covered++;
  const th = THRESHOLD.get(rel);
  if (th) {
    if (pct > th.maxPct) bad(`${route}: ${pct.toFixed(1)}% missing exceeds documented threshold ${th.maxPct}% (${th.reason})`);
    else ok(`${route}: ${pct.toFixed(1)}% missing within documented threshold ${th.maxPct}% (${th.reason})`);
    continue;
  }
  if (pct > FAIL_PCT) {
    bad(`${route}: ${pct.toFixed(1)}% authoritative legacy words missing from dist (${missing}/${total}); sample: ${missingWords.join(', ')}`);
  } else if (pct > WARN_PCT) {
    warn(`${route}: ${pct.toFixed(1)}% authoritative legacy words missing from dist (${missing}/${total}); sample: ${missingWords.join(', ')} — review; fail threshold ${FAIL_PCT}%`);
    ok(`${route}: within fail threshold`);
  } else {
    ok(`${route}: content coverage ${(100 - pct).toFixed(1)}% (${missing}/${total} missing)`);
  }
}

console.log(`\nContent coverage audit: ${covered} authoritative legacy routes compared, ${skipped} non-authoritative/absent routes skipped, ${warns} warnings, ${checks - failures}/${checks} checks passed`);
if (failures) { console.log('\nFAIL content coverage audit failed'); process.exit(1); }
console.log('\nOK content coverage audit passed');
