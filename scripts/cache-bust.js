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
  'js/site.js',
  'js/bookmark-engine.js',
];

// ── Хеш файла ────────────────────────────────────────────────────────────────

function md5short(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
}

// ── Все HTML-файлы в проекте (рекурсивно, без скрытых папок) ─────────────────

function collectHTML(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())               collectHTML(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
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

  // 2. Обойти все HTML
  const htmlFiles = collectHTML(ROOT);
  let changed = 0;

  console.log(`\n  HTML-файлов в проекте: ${htmlFiles.length}`);
  for (const f of htmlFiles) {
    if (bustFile(f, hashes)) {
      console.log(`  ✎  ${path.relative(ROOT, f)}`);
      changed++;
    }
  }

  // Итог
  console.log('\n' + '─'.repeat(50));
  if (changed === 0) {
    console.log('✅  Хеши не изменились — HTML не тронут.\n');
  } else {
    const action = DRY_RUN ? '(dry-run, не записано)' : 'обновлено';
    console.log(`✅  Файлов ${action}: ${changed}\n`);
  }
}

main();
