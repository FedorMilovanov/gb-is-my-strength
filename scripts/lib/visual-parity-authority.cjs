'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED_MODES = new Set(['legacy-diff', 'native-contract', 'built-app-contract']);

function normalizeRoute(value) {
  let route = String(value || '/').trim();
  if (!route.startsWith('/')) route = `/${route}`;
  if (!route.endsWith('/') && !/\.[a-z0-9]+$/i.test(route)) route += '/';
  return route.replace(/\/{2,}/g, '/');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function policyKey(meta) {
  const owner = String(meta?.owner || '').trim();
  const status = String(meta?.status || '').trim();
  if (owner === 'built-app' || status === 'copy-as-built-asset') return 'built-app';
  if (owner.startsWith('astro')) return 'astro';
  return null;
}

function resolveRoutePolicy({ route, ownership, authority, baseline = null }) {
  const normalized = normalizeRoute(route);
  const meta = ownership?.routes?.[normalized] || null;
  const key = policyKey(meta);
  const ownerPolicy = key ? authority?.ownerPolicies?.[key] : null;
  const legacyPolicy = baseline?.routeModes?.[normalized] || null;
  const additions = authority?.routeAdditions?.[normalized] || [];
  const mode = ownerPolicy?.mode || legacyPolicy?.mode || 'legacy-diff';
  const requiredGuards = unique([
    ...(ownerPolicy?.requiredGuards || []),
    ...(legacyPolicy?.requiredGuards || []),
    ...additions,
  ]);
  return {
    route: normalized,
    mode,
    ownerKey: key,
    ownership: meta,
    reason: legacyPolicy?.reason || ownerPolicy?.reason || 'No transferred native authority; legacy pixel comparison remains blocking.',
    requiredGuards,
  };
}

function validateGuard(root, route, guard) {
  if (typeof guard !== 'string' || !guard.trim()) return `${route}: guard must be a non-empty repository path`;
  if (path.isAbsolute(guard)) return `${route}: guard must be repository-relative: ${guard}`;
  const resolved = path.resolve(root, guard);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!(resolved === path.resolve(root) || resolved.startsWith(prefix))) return `${route}: guard escapes repository root: ${guard}`;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return `${route}: guard file does not exist: ${guard}`;
  return null;
}

function validateAuthority({ root, ownership, authority, baseline = null, requireGuardFiles = true }) {
  const problems = [];
  const summary = {
    routes: 0,
    astro: 0,
    builtApp: 0,
    legacyDiff: 0,
    nativeContract: 0,
    builtAppContract: 0,
  };

  if (authority?.ownershipSource !== 'migration/page-ownership.json') {
    problems.push('authority ownershipSource must remain migration/page-ownership.json');
  }
  if (authority?.policy?.legacyHtmlDeletionAuthority !== false) {
    problems.push('authority must not claim legacy HTML deletion authority');
  }

  for (const route of Object.keys(ownership?.routes || {}).sort()) {
    const resolved = resolveRoutePolicy({ route, ownership, authority, baseline });
    summary.routes += 1;
    if (resolved.ownerKey === 'astro') summary.astro += 1;
    if (resolved.ownerKey === 'built-app') summary.builtApp += 1;
    if (resolved.mode === 'legacy-diff') summary.legacyDiff += 1;
    if (resolved.mode === 'native-contract') summary.nativeContract += 1;
    if (resolved.mode === 'built-app-contract') summary.builtAppContract += 1;

    if (!ALLOWED_MODES.has(resolved.mode)) problems.push(`${route}: unknown parity mode ${JSON.stringify(resolved.mode)}`);
    if (resolved.ownerKey === 'astro' && resolved.mode !== 'native-contract') {
      problems.push(`${route}: Astro-owned route must resolve to native-contract, received ${resolved.mode}`);
    }
    if (resolved.ownerKey === 'built-app' && resolved.mode !== 'built-app-contract') {
      problems.push(`${route}: built-app route must resolve to built-app-contract, received ${resolved.mode}`);
    }
    if (resolved.mode !== 'legacy-diff' && resolved.requiredGuards.length < 3) {
      problems.push(`${route}: ${resolved.mode} requires at least three blocking guards`);
    }
    if (requireGuardFiles) {
      for (const guard of resolved.requiredGuards) {
        const issue = validateGuard(root, route, guard);
        if (issue) problems.push(issue);
      }
    }
  }

  return { problems, summary };
}

module.exports = {
  ALLOWED_MODES,
  loadJson,
  normalizeRoute,
  resolveRoutePolicy,
  validateAuthority,
};
