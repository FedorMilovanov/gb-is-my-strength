#!/usr/bin/env node
/**
 * atlas-localize-photos.js — локализация внешних фото панелей Атласа (долг D-15).
 *
 * Скачивает photos[].src/thumb с внешних хостов (Wikimedia и т.п.) в
 * images/atlas-dossier/, по возможности пережимает в webp (нужен sharp;
 * без него сохраняет оригинал), и переписывает route.json на локальные пути.
 * Поля label/credit сохраняются как есть — лицензии остаются подписанными.
 *
 * ЗАПУСК ТРЕБУЕТ ОТКРЫТОЙ СЕТИ (из CI/локальной машины):
 *   node scripts/atlas-localize-photos.js            # все карты
 *   node scripts/atlas-localize-photos.js avraam     # одна карта
 *   node scripts/atlas-localize-photos.js --dry-run  # только план
 *
 * Хосты с неясной лицензией на перераздачу (ritmeyer.com) пропускаются —
 * остаются hotlink'ами; в отчёте помечаются SKIP-LICENSE.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'atlas-dossier');
const SKIP_HOSTS = ['ritmeyer.com'];
const dry = process.argv.includes('--dry-run');
const slugsArg = process.argv.slice(2).filter((a) => !a.startsWith('--'));

let sharp = null;
try { sharp = require('sharp'); } catch (_) { /* без sharp — сохраняем оригинал */ }

function fetchBin(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'gospod-bog.ru atlas (photo localization; contact site owner)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchBin(new URL(res.headers.location, url).href, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function saveVariants(buf, base) {
  if (sharp) {
    await sharp(buf).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(OUT, `${base}.webp`));
    await sharp(buf).resize({ width: 320, withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(OUT, `${base}-thumb.webp`));
    return { src: `images/atlas-dossier/${base}.webp`, thumb: `images/atlas-dossier/${base}-thumb.webp` };
  }
  fs.writeFileSync(path.join(OUT, `${base}.img`), buf);
  return { src: `images/atlas-dossier/${base}.img`, thumb: `images/atlas-dossier/${base}.img` };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const KARTY = path.join(ROOT, 'karty');
  const slugs = slugsArg.length ? slugsArg :
    fs.readdirSync(KARTY).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(KARTY, d, 'route.json')));
  let done = 0, skipped = 0, failed = 0;
  for (const slug of slugs) {
    const rp = path.join(KARTY, slug, 'route.json');
    const route = JSON.parse(fs.readFileSync(rp, 'utf8'));
    let changed = false;
    for (const p of route.places || []) {
      for (let i = 0; i < (p.photos || []).length; i++) {
        const ph = p.photos[i];
        const src = String(ph.src || '');
        if (!src.startsWith('http')) continue;
        const host = new URL(src).hostname;
        if (SKIP_HOSTS.some((h) => host.endsWith(h))) { console.log(`SKIP-LICENSE ${slug}:${p.placeId} ${host}`); skipped++; continue; }
        const base = `${slug}-${p.placeId || p.id}-${i + 1}`;
        if (dry) { console.log(`PLAN ${base} ← ${src.slice(0, 100)}`); continue; }
        try {
          const buf = await fetchBin(src);
          const paths = await saveVariants(buf, base);
          ph.src = paths.src; ph.thumb = paths.thumb;
          changed = true; done++;
          console.log(`OK ${base} (${(buf.length / 1024).toFixed(0)} КБ)`);
          await new Promise((r) => setTimeout(r, 350)); // вежливость к Wikimedia
        } catch (e) {
          failed++;
          console.error(`FAIL ${base}: ${e.message}`);
        }
      }
    }
    if (changed && !dry) {
      fs.writeFileSync(rp, JSON.stringify(route, null, 2) + '\n');
      console.log(`[${slug}] route.json обновлён`);
    }
  }
  console.log(`\nИтог: ${done} скачано, ${skipped} пропущено (лицензия), ${failed} ошибок.`);
  if (failed) process.exitCode = 1;
})();
