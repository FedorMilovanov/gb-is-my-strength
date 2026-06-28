#!/usr/bin/env node
/**
 * cache-bust.js
 *
 * Вычисляет MD5-хеш (8 hex-символов) для каждого CSS/JS-файла
 * и проставляет ?v=HASH во все HTML-файлы сайта.
 *
 * При одинаковом содержимом файла хеш не меняется → HTML не трогается
 * → git diff пустой → лишних коммитов нет.
 *
 * Запуск:
 *   node scripts/cache-bust.js
 *   node scripts/cache-bust.js --dry-run   — показать без записи
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOT    = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// Файлы, для которых вычисляем хеш.
// Ключ — относительный путь от корня проекта (именно он ищется в HTML).
const ASSETS = [
  'css/site.css',
  'css/home.css',
  'css/command-palette.css',   /* BUG-01 fix: добавлен в cache-bust */
  'css/mobile-hotfix.css',
  'css/nagornaya-mobile-toc.css',
  'css/floating-cluster.css',
  // PremiumControls runtime styles are consolidated into floating-cluster.css;
  // src/styles/premium-controls.css is source/reference CSS, not a root public asset.
  'fonts/fonts.css',           /* AUDIT V2 / PERF-1: self-host fonts */
  'nagornaya/tw.min.css',
  'js/site.js',
  'js/site-utils.js',
  'js/scroll-perf.js',
  'js/bookmark-engine.js',
  'js/enhancements.js',
  'js/highlights.js',
  'js/search.js',
  'js/sw-register.js',
  'js/nagornaya-mobile-toc.js',
  'js/glossary.js',
  'js/floating-cluster-controller.js',
];

// ── Хеш файла ────────────────────────────────────────────────────────────────

function md5short(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
}

// ── Все HTML-файлы в проекте (рекурсивно, без скрытых папок) ─────────────────

function collectHTML(dir, acc = []) {
  // Cache-bust only the legacy/public source tree. Generated dist output and
  // private/refactor tooling may contain HTML snapshots/prototypes; touching
  // them makes local checks noisy and can mutate ignored artifacts after a
  // strangler build.
  const SKIP_DIRS = new Set([
    'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit',
    '_build-tools', 'src', 'scripts', 'docs', 'migration'
  ]);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())               collectHTML(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

// ── Все Astro-компоненты в src/ (source of truth) ────────────────────────────
//
// FIX (S3-N4 / PC-003 / P0-10 root cause): Astro components hardcode `?v=HASH`
// for the SAME shared CSS/JS assets, but `collectHTML` deliberately skips `src/`.
// Result: asset hashes in `src/**/*.astro` drift forever and only the
// `astro-cache-bust-postbuild.js` rescue keeps dist consistent. By cache-busting
// the Astro source directly, the source of truth stays correct and postbuild
// becomes a pure safety net (idempotent: it will find 0 drift after this).
function collectAstro(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())                 collectAstro(full, acc);
    else if (entry.name.endsWith('.astro'))  acc.push(full);
  }
  return acc;
}

// ── Обновить один .astro файл (строгий режим) ────────────────────────────────
//
// В отличие от legacy HTML, для Astro-источника НЕ добавляем `?v=` там, где его
// не было — только переписываем уже существующий `?v=<8 hex>`. Это исключает
// случайное попадание в import-строки, комментарии или data-атрибуты. Логика
// идентична проверенному `astro-cache-bust-postbuild.js`.
function bustAstroFile(astroPath, hashes) {
  const src = fs.readFileSync(astroPath, 'utf8');
  let updated = src;

  for (const [asset, hash] of Object.entries(hashes)) {
    if (!hash) continue;
    const escapedAsset = asset
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Матчим: (../../ | ../ | / | '')(asset)?v=<8 hex> — только уже хешированные ссылки
    const re = new RegExp(
      `((?:\\.\\.\\/)*|/?)${escapedAsset}\\?v=[a-f0-9]{8}`,
      'g'
    );
    updated = updated.replace(re, (m, prefix) => `${prefix}${asset}?v=${hash}`);
  }

  if (updated === src) return false;
  if (!DRY_RUN) fs.writeFileSync(astroPath, updated, 'utf8');
  return true;
}

// ── Обновить один HTML-файл ───────────────────────────────────────────────────
//
// Для каждого ресурса ищем паттерн вида:
//   ../../css/site.css              →  ../../css/site.css?v=NEWHASH
//   ../css/site.css?v=<любой хеш>  →  ../css/site.css?v=NEWHASH
//   css/site.css?v=<любой хеш>     →  css/site.css?v=NEWHASH
//
// [^\s"&]+ вместо [a-f0-9]{8} — захватывает любое существующее значение
// ?v=..., в том числе нестандартные (version-1.2, oldold12 и т.д.),
// не допуская двойного ?v=...?v=... при повторном прогоне.

function bustFile(htmlPath, hashes) {
  let src     = fs.readFileSync(htmlPath, 'utf8');
  let updated = src;

  for (const [asset, hash] of Object.entries(hashes)) {
    if (!hash) continue;

    // Экранируем точки и слэши для использования в RegExp
    const escapedAsset = asset
      .replace(/\./g, '\\.')
      .replace(/\//g, '\\/');

    // Матчим: (любые ../../)(css/site.css)(?v=что-угодно)?
    const re = new RegExp(
      `((?:\\.\\.\\/)*${escapedAsset})(?:\\?v=[^\\s"&]+)?`,
      'g'
    );

    updated = updated.replace(re, `$1?v=${hash}`);
  }

  if (updated === src) return false;
  if (!DRY_RUN) fs.writeFileSync(htmlPath, updated, 'utf8');
  return true;
}

// ── Обновить src/lib/asset-version.js (PC-003) ──────────────────────────────
function syncAssetVersionHelper(hashes) {
  const helperPath = path.join(ROOT, 'src', 'lib', 'asset-version.js');
  if (!fs.existsSync(helperPath)) return false;
  const src = fs.readFileSync(helperPath, 'utf8');
  const body = Object.keys(hashes)
    .filter(asset => hashes[asset])
    .sort()
    .map(asset => `  '${asset}': '${hashes[asset]}',`)
    .join('\n');
  const updated = src.replace(
    /export const ASSET_VERSIONS = \{[\s\S]*?\n\};/,
    `export const ASSET_VERSIONS = {\n${body}\n};`
  );
  if (updated === src) return false;
  if (!DRY_RUN) fs.writeFileSync(helperPath, updated, 'utf8');
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n⚡  cache-bust.js${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  // 1. Вычислить хеши
  const hashes = {};
  for (const asset of ASSETS) {
    const h = md5short(asset);
    hashes[asset] = h;
    if (h) console.log(`  ✔  ${asset.padEnd(30)}  →  ?v=${h}`);
    else   console.log(`  ⚠  ${asset}: файл не найден, пропускаем`);
  }

  if (syncAssetVersionHelper(hashes)) {
    console.log(`  ✔  src/lib/asset-version.js  →  синхронизирован`);
  }

  // 2. Обойти все HTML (legacy/public source tree)
  const htmlFiles = collectHTML(ROOT);
  let changed = 0;

  console.log(`\n  HTML-файлов в проекте: ${htmlFiles.length}`);
  for (const f of htmlFiles) {
    if (bustFile(f, hashes)) {
      console.log(`  ✎  ${path.relative(ROOT, f)}`);
      changed++;
    }
  }

  // 3. Обойти все Astro-компоненты (source of truth) — S3-N4 / PC-003 fix
  const astroFiles = collectAstro(path.join(ROOT, 'src'));
  let astroChanged = 0;

  console.log(`\n  Astro-компонентов в src/: ${astroFiles.length}`);
  for (const f of astroFiles) {
    if (bustAstroFile(f, hashes)) {
      console.log(`  ✎  ${path.relative(ROOT, f)}`);
      astroChanged++;
    }
  }

  // Итог
  console.log('\n' + '─'.repeat(50));
  const totalChanged = changed + astroChanged;
  if (totalChanged === 0) {
    console.log('✅  Хеши не изменились — HTML/Astro не тронуты.\n');
  } else {
    const action = DRY_RUN ? '(dry-run, не записано)' : 'обновлено';
    console.log(`✅  Файлов ${action}: ${totalChanged} (HTML: ${changed}, Astro: ${astroChanged})\n`);
  }
}

main();
