#!/usr/bin/env node
/**
 * check-route-profiles.js — verifies route profiles are coherent with page ownership.
 *
 * From: GBS non-excluded living audit (P0 recommendation)
 *
 * Checks:
 * 1. Every production route in page-ownership.json has a route profile
 * 2. Profile.route matches ownership route
 * 3. Profile.source exists (or is marked as legacy-only)
 * 4. Non-excluded routes declare migrationMode or anatomy
 * 5. Excluded semantic lane routes have scope: excluded-semantic-lane
 * 6. Risk level coherence between profile and ownership
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OWNERSHIP_FILE = path.join(ROOT, 'migration/page-ownership.json');
const PROFILES_DIR = path.join(ROOT, 'data/route-profiles');

const strict = process.argv.includes('--strict');
const problems = [];
const warnings = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function routeToProfileName(route) {
  const clean = route.replace(/\/$/, '').replace(/^\//, '');
  return (clean || 'home') + '.json';
}

function existsRel(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// Routes that are in active refactor exclusion (Nagornaya, Gill, heart-series)
const EXCLUDED_ROUTES = new Set([
  '/nagornaya/',
  '/nagornaya/chast-1/',
  '/nagornaya/chast-2/',
  '/nagornaya/chast-3/',
  '/nagornaya/chast-4/',
  '/nagornaya/chast-5/',
  '/nagornaya/seriya/',
  '/nagornaya/istochniki/',
  '/nagornaya/nakhodki/',
  '/articles/dzhon-gill-istoricheskiy-kontekst/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/dzhon-gill-spravochnik/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/',
  '/hard-texts/',
]);

function isExcludedRoute(route) {
  if (EXCLUDED_ROUTES.has(route)) return true;
  if (route.startsWith('/nagornaya/')) return true;
  if (route.startsWith('/hard-texts/')) return true;
  if (route.includes('/dzhon-gill-')) return true;
  if (route === '/articles/krajne-li-isporcheno-serdce/') return true;
  if (route === '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/') return true;
  return false;
}

function checkProfile(route, profile, owner) {
  // Route mismatch
  if (profile.route && profile.route !== route) {
    problems.push(`${route}: profile.route mismatch: ${profile.route}`);
  }

  // Source exists (skip for shadow/legacy routes)
  if (profile.source) {
    const srcOk = existsRel(profile.source);
    if (!srcOk && owner.status !== 'shadow-dist' && owner.status !== 'build-only') {
      // Soft warning — source might be legacy path in migration
      if (owner.owner !== 'legacy') {
        warnings.push(`${route}: source ${profile.source} not found (owner=${owner.owner})`);
      }
    }
  }

  // Migration mode / anatomy for non-excluded production routes
  if (!isExcludedRoute(route) && owner.status === 'production-dist') {
    if (!profile.migrationMode && !profile.anatomy && !profile.scope) {
      problems.push(
        `${route}: non-excluded production route missing migrationMode/anatomy/scope in profile.\n` +
        `  Add one of: migrationMode (native-main/legacy-shadow/mdx-native/legacy-app),\n` +
        `  anatomy (mainContent[], chrome[], footer[]), or scope (excluded-semantic-lane).`
      );
    }
  }

  // Excluded routes must declare scope
  if (isExcludedRoute(route)) {
    if (profile.scope && profile.scope !== 'excluded-semantic-lane') {
      problems.push(
        `${route}: excluded route has scope="${profile.scope}", should be "excluded-semantic-lane"`
      );
    }
    if (!profile.scope && !profile.migrationMode) {
      problems.push(
        `${route}: excluded route should declare scope:"excluded-semantic-lane" in profile`
      );
    }
  }

  // Risk level coherence
  if (profile.risk !== undefined && owner.risk !== undefined) {
    const diff = Math.abs(profile.risk - owner.risk);
    if (diff > 1) {
      warnings.push(
        `${route}: profile.risk=${profile.risk} vs ownership.risk=${owner.risk} (diff=${diff})`
      );
    }
  }
}

// ---------- main ----------
console.log('=== Route Profiles Check ===');
console.log(`Mode: ${strict ? 'STRICT' : 'WARN'}`);
console.log('');

if (!fs.existsSync(OWNERSHIP_FILE)) {
  console.error('❌ migration/page-ownership.json not found');
  if (strict) process.exit(1);
  return;
}

if (!fs.existsSync(PROFILES_DIR)) {
  console.error('❌ data/route-profiles/ directory not found');
  if (strict) process.exit(1);
  return;
}

const ownership = readJson(OWNERSHIP_FILE);
const routes = ownership.routes || {};
const profileFiles = fs.readdirSync(PROFILES_DIR).filter((f) => f.endsWith('.json'));
const knownProfiles = new Set(profileFiles.map((f) => f.replace(/\.json$/, '')));

let checked = 0;
let profilesFound = 0;

for (const [route, owner] of Object.entries(routes)) {
  if (owner.status === 'build-only') continue;
  if (owner.owner === 'built-app') continue;

  checked++;
  const profileName = routeToProfileName(route);
  const profileFile = path.join(PROFILES_DIR, profileName);

  if (!fs.existsSync(profileFile)) {
    // Check if there's a matching profile by other naming convention
    const routeSlug = route.replace(/^\/|\/$/g, '').replace(/\//g, '-');
    const altNames = [
      route.replace(/^\/|\/$/g, '') + '.json',
      routeSlug + '.json',
      route.replace(/^\/|\/$/g, '').replace(/-/g, '-') + '.json',
    ];
    const found = altNames.find((n) => fs.existsSync(path.join(PROFILES_DIR, n)));
    if (found) {
      const profile = readJson(path.join(PROFILES_DIR, found));
      profilesFound++;
      checkProfile(route, profile, owner);
    } else {
      problems.push(`${route}: missing route profile (expected: ${profileName})`);
    }
  } else {
    const profile = readJson(profileFile);
    profilesFound++;
    checkProfile(route, profile, owner);
  }
}

console.log(`Routes checked: ${checked}`);
console.log(`Profiles found: ${profilesFound}`);

if (warnings.length > 0) {
  console.log('');
  console.log('⚠️  Warnings:');
  warnings.forEach((w) => console.log('  ⚠️  ' + w));
}

if (problems.length > 0) {
  console.log('');
  if (strict) {
    console.error('❌ Route profiles check FAILED:');
    problems.forEach((p) => console.error('  ❌ ' + p.split('\n')[0]));
    if (problems.length > 20) {
      console.error(`  …and ${problems.length - 20} more`);
    }
    process.exit(1);
  } else {
    console.warn(`⚠️  Route profiles check: ${problems.length} issue(s) found. Run with --strict to fail.`);
    console.log('');
    console.log('✅ Route profiles check completed (non-strict mode)');
  }
} else {
  console.log('');
  console.log('✅ Route profiles coherent with page ownership');
}