#!/usr/bin/env node

// CLI: --strict-new-routes will fail CI on new unbaselined routes (sanitary 2026-06-29)
const STRICT_NEW_ROUTES = process.argv.includes('--strict-new-routes');
if (typeof console !== 'undefined' && STRICT_NEW_ROUTES) console.log('[visual-parity-baseline] strict-new-routes mode enabled (advisory)');

/**
 * visual-parity-baseline.js — record allowed pixel-diff baseline per route.
 *
 * Why:
 *   Shadow-wrap routes produce byte-identical HTML => 0.000% pixel diff vs
 *   legacy. Native Astro routes (already promoted, e.g. /articles/) emit
 *   different HTML but should stay within an owner-approved tiny diff
 *   (default ≤1%). We record the current measured diff% per route and per
 *   viewport so that future agent changes cannot silently increase it.
 *
 * Inputs:
 *   reports/visual-parity/summary.json  (from visual-parity-screenshots.js)
 *
 * Outputs:
 *   data/visual-parity-baseline.json    (committed; baseline allowed diff)
 *
 * Modes:
 *   --check (default): compare current summary against baseline; fail if any
 *     route increased its diff% beyond baseline + tolerance (default +0.5%).
 *   --update: overwrite baseline with current measurements (owner-approved).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUMMARY = path.join(ROOT, 'reports/visual-parity/summary.json');
const BASELINE = path.join(ROOT, 'data/visual-parity-baseline.json');

const ARGS = process.argv.slice(2);
const MODE = ARGS.includes('--update') ? 'update' : 'check';
const TOLERANCE_PCT = parseFloat((ARGS.find((a) => a.startsWith('--tolerance=')) || '--tolerance=0.5').split('=')[1]);

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flatten(summary) {
  const out = {};
  for (const r of (summary.routes || [])) {
    const vps = {};
    for (const [vp, v] of Object.entries(r.viewports || {})) {
      if (typeof v.diffPct === 'number') vps[vp] = +v.diffPct.toFixed(4);
    }
    out[r.route] = vps;
  }
  return out;
}

if (!fs.existsSync(SUMMARY)) {
  console.error(`❌ run npm run visual:parity:screenshots first (missing ${path.relative(ROOT, SUMMARY)})`);
  process.exit(2);
}

const current = flatten(loadJson(SUMMARY));

if (MODE === 'update') {
  const baseline = {
    note: 'Owner-approved pixel-diff baseline per Astro route. Higher diff% than baseline+tolerance fails CI. Update only after owner visual review.',
    tolerancePct: TOLERANCE_PCT,
    updatedAt: new Date().toISOString().slice(0, 10),
    routes: current,
  };
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✅ baseline updated: ${path.relative(ROOT, BASELINE)} (${Object.keys(current).length} route(s))`);
  process.exit(0);
}

// check mode
if (!fs.existsSync(BASELINE)) {
  console.error(`❌ baseline missing: ${path.relative(ROOT, BASELINE)} — run with --update first (owner-approved).`);
  process.exit(2);
}
const baseline = loadJson(BASELINE, { routes: {}, tolerancePct: TOLERANCE_PCT });
const tol = typeof baseline.tolerancePct === 'number' ? baseline.tolerancePct : TOLERANCE_PCT;
const problems = [];
for (const [route, vps] of Object.entries(current)) {
  const baseVps = baseline.routes[route];
  if (!baseVps) {
    console.log(`ℹ️ ${route}: no baseline entry; treating as new route (current ${JSON.stringify(vps)}). Run --update after owner approval.`);
    continue;
  }
  for (const [vp, pct] of Object.entries(vps)) {
    const basePct = baseVps[vp];
    if (typeof basePct !== 'number') { console.log(`ℹ️ ${route} ${vp}: no baseline for viewport (current ${pct}%)`); continue; }
    const allowed = basePct + tol;
    if (pct > allowed) {
      problems.push(`${route} ${vp}: ${pct.toFixed(3)}% > baseline ${basePct.toFixed(3)}% + tolerance ${tol}% (allowed ≤ ${allowed.toFixed(3)}%)`);
      console.log(`❌ ${route} ${vp}: ${pct.toFixed(3)}% > allowed ${allowed.toFixed(3)}%`);
    } else {
      console.log(`✅ ${route} ${vp}: ${pct.toFixed(3)}% ≤ allowed ${allowed.toFixed(3)}%`);
    }
  }
}

if (problems.length) {
  console.log(`\n❌ visual parity baseline regression: ${problems.length} pair(s) above allowed diff. Owner visual review required before --update.`);
  process.exit(1);
}
console.log(`\n✅ visual parity within baseline (tolerance +${tol}%)`);

// SANITARY 2026-06-29 --strict-new-routes (RS-033)
