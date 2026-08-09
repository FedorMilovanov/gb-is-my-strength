#!/usr/bin/env node
/*
 * Gill claim surface audit — «правило шести поверхностей».
 *
 * Проблема, которую закрывает этот гейт:
 * резолюция исследования внедрялась в тот файл, над которым шла работа, и не
 * проверялась на остальных Gill-поверхностях. Так ошибка даты первого издания
 * (1767 вместо 1769) пережила несколько волн: таблица трудов справочника уже
 * была исправлена, а карточка «Коротко» той же страницы продолжала публиковать
 * старую дату — страница противоречила сама себе.
 *
 * Что делает аудит:
 * прогоняет запрещённые паттерны из data/gill-verified-claims.json по ВСЕМ шести
 * поверхностям серии сразу — нативные Astro-компоненты, route-файлы, MDX-двойники,
 * legacy HTML, реестры data/*.json и search-манифест.
 *
 * Severity зависит от авторитета поверхности:
 *   - production-авторитетные поверхности (Astro/route/MDX/data) → ❌ blocking;
 *   - reference-only legacy зеркала → ⚠ warning (не блокирует, но виден в отчёте),
 *     если не передан флаг --strict-legacy.
 *
 * Использование:
 *   node scripts/gill-claim-surface-audit.js
 *   node scripts/gill-claim-surface-audit.js --strict-legacy
 *   node scripts/gill-claim-surface-audit.js --json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadRouteProfile,
  resolveDeclaredLegacyReference,
} = require('./lib/legacy-source-authority');

const ROOT = path.join(__dirname, '..');
const REGISTRY = path.join(ROOT, 'data/gill-verified-claims.json');
const STRICT_LEGACY = process.argv.includes('--strict-legacy');
const JSON_OUT = process.argv.includes('--json');

const GILL_SLUGS = [
  'dzhon-gill-istoricheskiy-kontekst',
  'dzhon-gill-chast-1-chelovek',
  'dzhon-gill-chast-2-uchenyi',
  'dzhon-gill-chast-3-nasledie',
  'dzhon-gill-chast-4-ekzeget',
  'dzhon-gill-spravochnik',
];

const COMPONENT_DIRS = [
  'gill-context',
  'gill-part1',
  'gill-part2',
  'gill-part3',
  'gill-part4',
  'gill-spravochnik',
  'gill-series',
];

const blocking = [];
const warnings = [];
const findings = [];

function ok(msg) { if (!JSON_OUT) console.log(`✅ ${msg}`); }
function warn(msg) { warnings.push(msg); if (!JSON_OUT) console.log(`⚠ ${msg}`); }
function bad(msg) { blocking.push(msg); if (!JSON_OUT) console.log(`❌ ${msg}`); }

function walk(dir, exts, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(rel, exts, out);
    else if (exts.some((e) => ent.name.endsWith(e))) out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

function legacyRoute(slug) {
  return `/articles/${slug}/`;
}

function legacyLogicalPath(slug) {
  return `articles/${slug}/index.html`;
}

function resolveLegacySurface(slug, options = {}) {
  const route = legacyRoute(slug);
  const logicalPath = legacyLogicalPath(slug);
  const profileLoader = options.loadRouteProfile || loadRouteProfile;
  const loaded = profileLoader(route) || {};
  const profile = loaded.profile;

  if (!profile) throw new Error(`${route}: route profile missing`);
  if (profile.route !== route) {
    throw new Error(`${route}: route profile identity mismatch: got ${profile.route || 'missing'}`);
  }
  if (profile.legacyPath !== logicalPath) {
    throw new Error(`${route}: legacy profile identity mismatch: expected ${logicalPath}, got ${profile.legacyPath || 'missing'}`);
  }

  const reference = resolveDeclaredLegacyReference(profile, {
    route,
    mustExist: true,
    resolveReferenceForRoute: options.resolveReferenceForRoute,
  });
  if (!reference) throw new Error(`${route}: declared legacy reference unexpectedly absent`);
  if (reference.logicalPath !== logicalPath) {
    throw new Error(`${route}: legacy reference identity mismatch: expected ${logicalPath}, got ${reference.logicalPath}`);
  }

  return {
    file: logicalPath,
    physicalPath: reference.absolutePath,
    storagePath: reference.repositoryPath,
    surface: 'legacy-html',
    authority: 'reference',
  };
}

function readSurface(entry, options = {}) {
  const absolutePath = entry.physicalPath || path.join(ROOT, entry.file);
  const reader = options.readFile || ((file) => fs.readFileSync(file, 'utf8'));
  return reader(absolutePath);
}

function assertLegacyStorageContract() {
  const slug = GILL_SLUGS[0];
  const route = legacyRoute(slug);
  const logicalPath = legacyLogicalPath(slug);
  const storagePath = `migration/legacy-reference/${logicalPath}`;
  const absolutePath = `/synthetic-repo/${storagePath}`;
  const profile = { route, legacyStatus: 'reference-only', legacyPath: logicalPath };
  let observedReadPath = '';

  const entry = resolveLegacySurface(slug, {
    loadRouteProfile: () => ({ file: '/synthetic/profile.json', profile }),
    resolveReferenceForRoute: (requestedRoute) => ({
      route: requestedRoute,
      logicalPath,
      repositoryPath: storagePath,
      absolutePath,
      exists: true,
    }),
  });
  const bytes = readSurface(entry, {
    readFile(file) {
      observedReadPath = file;
      return 'resolver-backed-reference';
    },
  });
  if (entry.storagePath !== storagePath || observedReadPath !== absolutePath || bytes !== 'resolver-backed-reference') {
    throw new Error('Gill claim surface storage contract: resolver-selected physical storage was not consumed');
  }

  let identityFailure = null;
  try {
    resolveLegacySurface(slug, {
      loadRouteProfile: () => ({ file: '/synthetic/profile.json', profile }),
      resolveReferenceForRoute: (requestedRoute) => ({
        route: requestedRoute,
        logicalPath: 'articles/wrong-gill/index.html',
        repositoryPath: 'migration/legacy-reference/articles/wrong-gill/index.html',
        absolutePath: '/synthetic-repo/migration/legacy-reference/articles/wrong-gill/index.html',
        exists: true,
      }),
    });
  } catch (error) {
    identityFailure = error;
  }
  if (!identityFailure || !/identity mismatch/.test(String(identityFailure.message))) {
    throw new Error('Gill claim surface storage contract: profile/ledger identity mismatch did not fail closed');
  }

  let missingProfileFailure = null;
  try {
    resolveLegacySurface(slug, { loadRouteProfile: () => ({ file: null, profile: null }) });
  } catch (error) {
    missingProfileFailure = error;
  }
  if (!missingProfileFailure || !/profile missing/.test(String(missingProfileFailure.message))) {
    throw new Error('Gill claim surface storage contract: missing route profile did not fail closed');
  }

  ok('Gill legacy storage contract: resolved physical read + identity/missing-profile fail-closed');
}

/**
 * Шесть поверхностей серии. Каждая помечена уровнем авторитета:
 * production — источник того, что реально видит читатель;
 * reference  — зеркало, сохраняемое как исторический слепок.
 */
function collectSurfaces() {
  const surfaces = [];

  // 1. Нативные Astro-компоненты (владелец production-рендера).
  for (const dir of COMPONENT_DIRS) {
    for (const f of walk(`src/components/article-pilots/${dir}`, ['.astro', '.ts'])) {
      surfaces.push({ file: f, surface: 'astro-component', authority: 'production' });
    }
  }

  // 2. Route-файлы Astro.
  for (const slug of GILL_SLUGS) {
    for (const f of walk(`src/pages/articles/${slug}`, ['.astro'])) {
      surfaces.push({ file: f, surface: 'astro-route', authority: 'production' });
    }
  }

  // 3. MDX-двойники.
  for (const slug of GILL_SLUGS) {
    const f = `src/content/articles/${slug}.mdx`;
    if (fs.existsSync(path.join(ROOT, f))) {
      surfaces.push({ file: f, surface: 'mdx-twin', authority: 'production' });
    }
  }

  // 4. Legacy HTML зеркала — логическая идентичность берётся из route profile,
  // а физическое хранение только через центральный reference resolver.
  for (const slug of GILL_SLUGS) {
    try {
      surfaces.push(resolveLegacySurface(slug));
    } catch (error) {
      bad(`${legacyRoute(slug)}: legacy reference resolution failed — ${error.message}`);
    }
  }

  // 5. Реестры данных серии.
  for (const f of ['data/series.json', 'data/links-graph.json', 'data/editorial-metadata.json']) {
    if (fs.existsSync(path.join(ROOT, f))) {
      surfaces.push({ file: f, surface: 'series-data', authority: 'production' });
    }
  }

  // 6. Search-манифест и route-профили.
  for (const f of ['data/search-manifest.json']) {
    if (fs.existsSync(path.join(ROOT, f))) {
      surfaces.push({ file: f, surface: 'search-manifest', authority: 'production' });
    }
  }
  for (const slug of GILL_SLUGS) {
    const f = `data/route-profiles/articles-${slug}.json`;
    if (fs.existsSync(path.join(ROOT, f))) {
      surfaces.push({ file: f, surface: 'route-profile', authority: 'production' });
    }
  }

  return surfaces;
}

function isGillRelevant(entry, content) {
  // Общие реестры проверяем только по Gill-фрагментам.
  if (['series-data', 'search-manifest'].includes(entry.surface)) {
    return /dzhon-gill|Гилл/i.test(content);
  }
  return true;
}

function main() {
  if (!JSON_OUT) {
    console.log('GILL CLAIM SURFACE AUDIT — правило шести поверхностей\n');
  }

  assertLegacyStorageContract();
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const surfaces = collectSurfaces();

  const bySurface = surfaces.reduce((acc, s) => {
    acc[s.surface] = (acc[s.surface] || 0) + 1;
    return acc;
  }, {});
  if (!JSON_OUT) {
    console.log(`Поверхностей просканировано: ${surfaces.length}`);
    console.log(`Разбивка: ${JSON.stringify(bySurface)}\n`);
  }

  // Все шесть классов поверхностей обязаны существовать — иначе аудит
  // молча проверял бы неполный набор и создавал ложную уверенность.
  const REQUIRED = ['astro-component', 'astro-route', 'mdx-twin', 'legacy-html', 'series-data', 'search-manifest'];
  for (const req of REQUIRED) {
    if (bySurface[req]) ok(`поверхность присутствует: ${req} (${bySurface[req]})`);
    else bad(`поверхность не найдена: ${req} — набор проверки неполон`);
  }

  const legacySurfaces = surfaces.filter((entry) => entry.surface === 'legacy-html');
  const legacyFiles = new Set(legacySurfaces.map((entry) => entry.file));
  const expectedLegacyFiles = GILL_SLUGS.map(legacyLogicalPath);
  if (
    legacySurfaces.length === GILL_SLUGS.length
    && legacyFiles.size === GILL_SLUGS.length
    && expectedLegacyFiles.every((file) => legacyFiles.has(file))
  ) {
    ok(`legacy Gill reference coverage complete: ${GILL_SLUGS.length}/${GILL_SLUGS.length}`);
  } else {
    bad(`legacy Gill reference coverage incomplete: expected ${GILL_SLUGS.length} unique routes, got ${legacySurfaces.length} surface(s) / ${legacyFiles.size} unique path(s)`);
  }

  const cache = new Map();
  function readCached(entry) {
    const key = `${entry.surface}:${entry.file}`;
    if (!cache.has(key)) cache.set(key, readSurface(entry));
    return cache.get(key);
  }

  for (const claim of registry.claims) {
    const forbidden = claim.forbidden || [];
    let claimHits = 0;

    for (const rule of forbidden) {
      const re = new RegExp(rule.pattern, 'gi');
      for (const entry of surfaces) {
        const content = readCached(entry);
        if (!isGillRelevant(entry, content)) continue;
        re.lastIndex = 0;
        const m = re.exec(content);
        if (!m) continue;

        claimHits += 1;
        const line = content.slice(0, m.index).split('\n').length;
        const record = {
          claim: claim.id,
          file: entry.file,
          surface: entry.surface,
          authority: entry.authority,
          line,
          match: m[0].slice(0, 80),
          why: rule.why,
        };
        findings.push(record);

        const label = `${claim.id}: ${entry.file}:${line} (${entry.surface}) — «${m[0].slice(0, 60)}» — ${rule.why}`;
        if (entry.authority === 'production' || STRICT_LEGACY) bad(label);
        else warn(`${label} [reference-only зеркало, не блокирует]`);
      }
    }

    // requiredNear: утверждение обязано сопровождаться оговоркой.
    if (claim.requiredNear) {
      const { trigger, anyOf, why } = claim.requiredNear;
      for (const entry of surfaces) {
        if (entry.authority !== 'production') continue;
        const content = readCached(entry);
        if (!content.includes(trigger)) continue;
        const has = anyOf.some((token) => content.includes(token));
        if (has) {
          ok(`${claim.id}: ${entry.file} — оговорка присутствует рядом с «${trigger}»`);
        } else {
          claimHits += 1;
          findings.push({
            claim: claim.id, file: entry.file, surface: entry.surface,
            authority: entry.authority, line: 0, match: trigger, why,
          });
          bad(`${claim.id}: ${entry.file} упоминает «${trigger}» без обязательной оговорки — ${why}`);
        }
      }
    }

    if (claimHits === 0) ok(`${claim.id}: чисто на всех поверхностях`);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({
      surfaces: surfaces.length, bySurface, findings,
      blocking: blocking.length, warnings: warnings.length,
    }, null, 2));
  } else {
    console.log(`\n=== Итог ===`);
    console.log(`Утверждений в реестре: ${registry.claims.length}`);
    console.log(`Блокирующих нарушений: ${blocking.length}`);
    console.log(`Предупреждений (reference-only): ${warnings.length}`);
    if (blocking.length === 0) {
      console.log('\n✅ Gill claim surface audit passed');
    } else {
      console.log('\n❌ Gill claim surface audit FAILED');
    }
  }

  process.exit(blocking.length === 0 ? 0 : 1);
}

main();
