#!/usr/bin/env node
'use strict';

/**
 * Policy-aware visual parity baseline.
 *
 * `legacy-diff` routes compare root legacy HTML with production-like dist.
 * `native-contract` routes have intentionally retired the legacy presentation;
 * their legacy-vs-dist screenshots remain diagnostic, while source/dist audits
 * and the public-surface browser matrix own the blocking verdict.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2);
const MODE = ARGS.includes('--update') ? 'update' : 'check';
const STRICT_NEW_ROUTES = ARGS.includes('--strict-new-routes');
const ALLOWED_MODES = new Set(['legacy-diff', 'native-contract']);

function valueArg(name, fallback) {
  const inline = ARGS.find((item) => item.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = ARGS.indexOf(name);
  if (index >= 0 && ARGS[index + 1]) return ARGS[index + 1];
  return fallback;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

const SUMMARY = resolveInput(valueArg('--summary', 'reports/visual-parity/summary.json'));
const BASELINE = resolveInput(valueArg('--baseline', 'data/visual-parity-baseline.json'));
const TOLERANCE_PCT = Number.parseFloat(valueArg('--tolerance', '0.5'));

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flatten(summary) {
  const out = {};
  for (const routeResult of summary.routes || []) {
    const viewports = {};
    for (const [viewport, result] of Object.entries(routeResult.viewports || {})) {
      if (typeof result.diffPct === 'number') viewports[viewport] = +result.diffPct.toFixed(4);
    }
    out[routeResult.route] = viewports;
  }
  return out;
}

function routeMode(baseline, route) {
  const policy = baseline.routeModes?.[route];
  return policy?.mode || 'legacy-diff';
}

function validateRouteModes(baseline) {
  const problems = [];
  for (const [route, policy] of Object.entries(baseline.routeModes || {})) {
    const mode = policy?.mode;
    if (!ALLOWED_MODES.has(mode)) {
      problems.push(`${route}: unknown visual comparison mode ${JSON.stringify(mode)}`);
      continue;
    }
    if (mode === 'native-contract') {
      if (typeof policy.reason !== 'string' || policy.reason.trim().length < 12) {
        problems.push(`${route}: native-contract requires a concrete reason`);
      }
      if (!Array.isArray(policy.requiredGuards) || policy.requiredGuards.length < 2) {
        problems.push(`${route}: native-contract requires at least two named blocking guards`);
      }
    }
  }
  return problems;
}

if (!Number.isFinite(TOLERANCE_PCT) || TOLERANCE_PCT < 0) {
  console.error(`❌ invalid tolerance: ${TOLERANCE_PCT}`);
  process.exit(2);
}
if (!fs.existsSync(SUMMARY)) {
  console.error(`❌ screenshot summary missing: ${path.relative(ROOT, SUMMARY)}`);
  process.exit(2);
}

const current = flatten(loadJson(SUMMARY, { routes: [] }));
const existing = loadJson(BASELINE, null);

if (MODE === 'update') {
  if (process.env.OWNER_APPROVED !== 'true') {
    console.error('❌ baseline update requires OWNER_APPROVED=true');
    process.exit(2);
  }
  const baseline = {
    ...(existing || {}),
    note: existing?.note || 'Owner-approved pixel-diff baseline per route. Higher legacy-diff than baseline+tolerance fails CI.',
    tolerancePct: Number.isFinite(existing?.tolerancePct) ? existing.tolerancePct : TOLERANCE_PCT,
    updatedAt: new Date().toISOString().slice(0, 10),
    routes: current,
  };
  const policyProblems = validateRouteModes(baseline);
  if (policyProblems.length) {
    policyProblems.forEach((problem) => console.error(`❌ ${problem}`));
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`✅ baseline measurements updated: ${path.relative(ROOT, BASELINE)} (${Object.keys(current).length} route(s))`);
  process.exit(0);
}

if (!existing) {
  console.error(`❌ baseline missing: ${path.relative(ROOT, BASELINE)}`);
  process.exit(2);
}

const problems = validateRouteModes(existing);
const tol = Number.isFinite(existing.tolerancePct) ? existing.tolerancePct : TOLERANCE_PCT;

for (const [route, viewports] of Object.entries(current)) {
  const mode = routeMode(existing, route);
  if (!ALLOWED_MODES.has(mode)) continue;

  if (mode === 'native-contract') {
    const policy = existing.routeModes[route];
    console.log(`✅ ${route}: native-contract; legacy diff is diagnostic only (${policy.requiredGuards.join(', ')})`);
    continue;
  }

  const baselineViewports = existing.routes?.[route];
  if (!baselineViewports) {
    const detail = `${route}: no legacy-diff baseline entry (current ${JSON.stringify(viewports)})`;
    if (STRICT_NEW_ROUTES) problems.push(detail);
    else console.log(`ℹ️ ${detail}; advisory until explicit owner review`);
    continue;
  }

  for (const [viewport, pct] of Object.entries(viewports)) {
    const baselinePct = baselineViewports[viewport];
    if (typeof baselinePct !== 'number') {
      const detail = `${route} ${viewport}: no baseline value (current ${pct}%)`;
      if (STRICT_NEW_ROUTES) problems.push(detail);
      else console.log(`ℹ️ ${detail}`);
      continue;
    }
    const allowed = baselinePct + tol;
    if (pct > allowed) {
      problems.push(`${route} ${viewport}: ${pct.toFixed(3)}% > baseline ${baselinePct.toFixed(3)}% + tolerance ${tol}% (allowed ≤ ${allowed.toFixed(3)}%)`);
      console.log(`❌ ${route} ${viewport}: ${pct.toFixed(3)}% > allowed ${allowed.toFixed(3)}%`);
    } else {
      console.log(`✅ ${route} ${viewport}: ${pct.toFixed(3)}% ≤ allowed ${allowed.toFixed(3)}%`);
    }
  }
}

if (problems.length) {
  for (const problem of problems) console.error(`  ❌ ${problem}`);
  console.error(`\n❌ visual parity policy failed: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`\n✅ visual parity policy passed (legacy tolerance +${tol}%; native-contract routes delegated to named guards)`);
