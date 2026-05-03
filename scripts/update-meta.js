#!/usr/bin/env node
/**
 * update-meta.js  v2.0
 *
 * Запускается GitHub Actions при каждом push в main.
 * Для каждой изменённой статьи в articles/:
 *   1. article:published_time  — берёт из первого git-коммита (только если отсутствует)
 *   2. article:modified_time   — берёт из последнего git-коммита (всегда обновляет)
 *   3. wordCount               — считает слова в <article>, обновляет SITE_CONFIG
 *   4. readingTime             — wordCount / 200, обновляет SITE_CONFIG и ⏱ N мин
 *   5. sitemap.xml             — lastmod изменённых + добавляет новые статьи
 *   6. feed.xml                — lastBuildDate + новые статьи + правит missing <title>
 *
 * Запуск:
 *   node scripts/update-meta.js           — только изменённые (по git diff)
 *   node scripts/update-meta.js --all     — принудительно все
 *   node scripts/update-meta.js --dry-run — показать без записи
 */

'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const BASE_URL   = 'https://gospod-bog.ru';
const SITE_NAME  = 'Господь Бог — Сила Моя';
const SITEMAP    = path.resolve(__dirname, '../sitemap.xml');
const FEED       = path.resolve(__dirname, '../feed.xml');
const ARTICLES   = path.resolve(__dirname, '../articles');
const TZ_OFFSET  = '+03:00';
const WPM        = 200;

const DRY_RUN   = process.argv.includes('--dry-run');
const FORCE_ALL = process.argv.includes('--all');

const SECTION_CATS = {
  'Переводы':           ['Перевод', 'Богословие'],
  'Публикации':         ['Богословие', 'Экзегетика'],
  'Разбор заблуждений': ['Апологетика'],
};

// ── Даты ─────────────────────────────────────────────────────────────────────

function toMoscowISO(d) {
  const m = new Date(new Date(d).getTime() + 3 * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${m.getUTCFullYear()}-${p(m.getUTCMonth()+1)}-${p(m.getUTCDate())}T${p(m.getUTCHours())}:${p(m.getUTCMinutes())}:${p(m.getUTCSeconds())}${TZ_OFFSET}`;
}

function toDate(d)   { return toMoscowISO(d).slice(0, 10); }
function toRFC(d)    { return new Date(d).toUTCString().replace('GMT', '+0000'); }

// ── Git ───────────────────────────────────────────────────────────────────────

function gitDate(file, which) {
  try {
    const cmd = which === 'first'
      ? `git log --follow --diff-filter=A --format="%cI" -- "${file}"`
      : `git log -1 --format="%cI" -- "${file}"`;
    const lines = execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    return which === 'first' ? lines.at(-1) : lines[0];
  } catch { return null; }
}

function getAllSlugs() {
  return fs.readdirSync(ARTICLES, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
}

function getChangedSlugs() {
  try {
    const before = process.env.BEFORE_SHA;
    const after  = process.env.AFTER_SHA || 'HEAD';
    const range  = (before && before !== '0'.repeat(40)) ? `${before} ${after}` : 'HEAD~1 HEAD';
    const files  = execSync(`git diff --name-only ${range}`, { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    const slugs  = new Set();
    for (const f of files) {
      const m = f.match(/^articles\/([^/]+)\//);
      if (m) slugs.add(m[1]);
      if (f === 'index.html' || f.startsWith('css/') || f.startsWith('js/')) {
        getAllSlugs().forEach(s => slugs.add(s)); break;
      }
    }
    return [...slugs];
  } catch { return getAllSlugs(); }
}

// ── Парсинг HTML ──────────────────────────────────────────────────────────────

function parseMeta(html) {
  const g = re => html.match(re)?.[1] ?? null;
  return {
    titleFull:     g(/<title>([^<]+)<\/title>/)?.replace(` — ${SITE_NAME}`, '').trim(),
    title:         g(/<meta\s+property="og:title"\s+content="([^"]+)"/),
    description:   g(/<meta\s+name="description"\s+content="([^"]+)"/),
    publishedTime: g(/<meta\s+property="article:published_time"\s+content="([^"]+)"/),
    section:       g(/section:\s*'([^']+)'/),
    authorName:    g(/"author"[\s\S]{0,80}"name":\s*"([^"]+)"/),
    isTranslation: /section:\s*'Переводы'/.test(html),
    hasPubTime:    /<meta\s+property="article:published_time"/.test(html),
    hasModTime:    /<meta\s+property="article:modified_time"/.test(html),
  };
}

function countWords(html) {
  const art = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)?.[1] ?? '';
  return art
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|nbsp|quot|#\d+);/g, ' ')
    .split(/\s+/).filter(w => w.length > 1).length;
}

// ── Запись ────────────────────────────────────────────────────────────────────

function writeIfChanged(file, content, label) {
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (old === content) { console.log(`    ↔  ${label}`); return false; }
  if (DRY_RUN)         { console.log(`    ✎  ${label} [dry-run]`); return false; }
  fs.writeFileSync(file, content, 'utf8');
  console.log(`    ✔  ${label}`);
  return true;
}

// ── 1. HTML статьи ───────────────────────────────────────────────────────────

function updateHTML(slug, { pubISO, modISO, words, readTime }) {
  const file = path.join(ARTICLES, slug, 'index.html');
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  const meta   = parseMeta(html);
  const newMod = toMoscowISO(modISO);
  const newPub = toMoscowISO(pubISO);

  // published_time — только если отсутствует
  if (!meta.hasPubTime) {
    html = html.replace(/(<meta\s+property="og:type"[^>]*>)/,
      `$1\n  <meta property="article:published_time" content="${newPub}" />`);
    console.log(`    + published_time = ${newPub}`);
  }

  // modified_time — всегда актуальна
  if (meta.hasModTime) {
    html = html.replace(
      /(<meta\s+property="article:modified_time"\s+content=")[^"]*(")/,
      `$1${newMod}$2`);
  } else {
    html = html.replace(/(<meta\s+property="article:published_time"[^>]*>)/,
      `$1\n  <meta property="article:modified_time" content="${newMod}" />`);
  }

  // SITE_CONFIG
  html = html.replace(/(\bwordCount:\s*)\d+/, `$1${words}`);
  html = html.replace(/(\breadingTime:\s*)\d+/, `$1${readTime}`);

  // Spans в HTML
  html = html.replace(/(⏱\s*)\d+(\s*мин<\/span>)/g, `$1${readTime}$2`);
  html = html.replace(/(⏱️\s*~?)\d+(\s*мин чтения<\/span>)/g, `$1${readTime}$2`);

  writeIfChanged(file, html, `articles/${slug}/index.html`);
}

// ── 2. sitemap.xml ────────────────────────────────────────────────────────────

function updateSitemap(changes) {
  let xml = fs.readFileSync(SITEMAP, 'utf8');

  // Обновить lastmod существующих
  for (const [slug, { modISO }] of Object.entries(changes)) {
    const url = `${BASE_URL}/articles/${slug}/`;
    xml = xml.replace(
      new RegExp(`(<loc>${reEsc(url)}<\\/loc>\\s*<lastmod>)[^<]*(<\\/lastmod>)`, 'g'),
      `$1${toDate(modISO)}$2`);
  }

  // Добавить новые
  const have = new Set([...xml.matchAll(/articles\/([^/]+)\//g)].map(m => m[1]));
  for (const slug of getAllSlugs().filter(s => !have.has(s))) {
    const mod = changes[slug]?.modISO ?? gitDate(path.join(ARTICLES, slug), 'last') ?? new Date().toISOString();
    xml = xml.replace('</urlset>',
      `\n  <url>\n    <loc>${BASE_URL}/articles/${slug}/</loc>\n    <lastmod>${toDate(mod)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n</urlset>`);
    console.log(`    + sitemap: ${slug}`);
  }

  // Главная — свежайшая дата
  const latest = Object.values(changes).map(c => c.modISO).filter(Boolean).sort().at(-1);
  if (latest) {
    xml = xml.replace(
      new RegExp(`(<loc>${reEsc(BASE_URL + '/')}<\\/loc>\\s*<lastmod>)[^<]*(<\\/lastmod>)`, 'g'),
      `$1${toDate(latest)}$2`);
  }

  writeIfChanged(SITEMAP, xml, 'sitemap.xml');
}

// ── 3. feed.xml ───────────────────────────────────────────────────────────────

function updateFeed(changes) {
  let xml = fs.readFileSync(FEED, 'utf8');

  // Правим <item> без <title> (баг в krajne и похожих)
  xml = xml.replace(
    /(<item>\s*)(<link>(https:\/\/gospod-bog\.ru\/articles\/([^/]+)\/)<\/link>)/g,
    (match, pre, linkTag, url, slug) => {
      if (match.includes('<title>')) return match; // уже есть
      const htmlPath = path.join(ARTICLES, slug, 'index.html');
      if (!fs.existsSync(htmlPath)) return match;
      const t = parseMeta(fs.readFileSync(htmlPath, 'utf8')).titleFull ?? slug;
      console.log(`    + feed <title> для ${slug}`);
      return `${pre}<title>${xe(t)}</title>\n      ${linkTag}`;
    }
  );

  // Добавить новые статьи
  const have = new Set([...xml.matchAll(/articles\/([^/]+)\/<\/guid>/g)].map(m => m[1]));
  for (const slug of getAllSlugs().filter(s => !have.has(s))) {
    const htmlPath = path.join(ARTICLES, slug, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html  = fs.readFileSync(htmlPath, 'utf8');
    const meta  = parseMeta(html);
    const url   = `${BASE_URL}/articles/${slug}/`;
    const pub   = changes[slug]?.pubISO ?? meta.publishedTime ?? new Date().toISOString();
    const cats  = SECTION_CATS[meta.section] ?? ['Богословие'];
    const cre   = meta.isTranslation && meta.authorName ? `${meta.authorName} (пер. с англ.)` : 'Фёдор Милованов';

    const item = `\n    <item>\n      <title>${xe(meta.titleFull || meta.title || slug)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${toRFC(pub)}</pubDate>\n      <dc:creator>${xe(cre)}</dc:creator>\n${cats.map(c=>`      <category>${xe(c)}</category>`).join('\n')}\n      <description><![CDATA[\n        <p>${xe(meta.description||'')}</p>\n        <p><a href="${url}">Читать статью →</a></p>\n      ]]></description>\n    </item>`;

    xml = xml.replace(/(\s*<item>)/, `${item}\n$1`);
    console.log(`    + feed: ${slug}`);
  }

  // lastBuildDate
  const latest = Object.values(changes).map(c => c.modISO).filter(Boolean).sort().at(-1);
  if (latest) xml = xml.replace(/(<lastBuildDate>)[^<]*(<\/lastBuildDate>)/, `$1${toRFC(latest)}$2`);

  writeIfChanged(FEED, xml, 'feed.xml');
}

// ── Утилиты ───────────────────────────────────────────────────────────────────

function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function xe(s)    { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🔄  update-meta v2.0${DRY_RUN?' [DRY RUN]':''}${FORCE_ALL?' [ALL]':''}\n`);

  const slugs = FORCE_ALL ? getAllSlugs() : getChangedSlugs();
  if (!slugs.length) { console.log('  Нет изменений.\n'); return; }
  console.log(`  Статьи: ${slugs.join(', ')}\n`);

  const changes = {};

  for (const slug of slugs) {
    const file = path.join(ARTICLES, slug, 'index.html');
    if (!fs.existsSync(file)) { console.warn(`  ⚠  ${slug}: нет index.html`); continue; }

    const modISO = gitDate(file, 'last');
    const pubISO = gitDate(file, 'first') ?? modISO;
    if (!modISO) { console.warn(`  ⚠  ${slug}: нет даты из git`); continue; }

    const html     = fs.readFileSync(file, 'utf8');
    const words    = countWords(html);
    const readTime = Math.max(1, Math.round(words / WPM));

    console.log(`\n  📄  ${slug}`);
    console.log(`      pub: ${pubISO?.slice(0,10)}  mod: ${modISO.slice(0,10)}  ${words} сл. → ${readTime} мин`);

    changes[slug] = { pubISO, modISO };
    updateHTML(slug, { pubISO, modISO, words, readTime });
  }

  if (Object.keys(changes).length) {
    console.log('\n  🗺  sitemap.xml');
    updateSitemap(changes);
    console.log('\n  📡  feed.xml');
    updateFeed(changes);
  }

  console.log('\n✅  Готово.\n');
}

main();
