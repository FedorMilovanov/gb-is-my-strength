#!/usr/bin/env node
/**
 * validate.js
 *
 * Проверяет все статьи и CSS/JS на соответствие стандартам сайта.
 * Запускается после update-meta.js и cache-bust.js.
 *
 * Выход 0 = всё чисто или только предупреждения
 * Выход 1 = есть ошибки (блокирует коммит в CI если нужно)
 *
 * Запуск:
 *   node scripts/validate.js
 *   node scripts/validate.js --strict   — ошибки → exit 1
 *
 * Чеки:
 *   #1  canonical совпадает со slug
 *   #2  article:section присутствует и валиден
 *   #3  article:modified_time присутствует
 *   #4  OG-изображение существует на диске
 *   #5  byline содержит роль (Редактор: / Редакция перевода:)
 *   #6  author-card присутствует
 *   #7  нет color-mix внутри linear-gradient (HTML)
 *   #8  нет нестандартных брейкпоинтов в inline-стилях
 *   #9  BreadcrumbList последний элемент = og:title
 *   #10 дублирующиеся id
 *   #11 img без alt
 *   #12 внутренние ссылки ведут на существующие файлы
 *   #13 <title> совпадает с og:title (с учётом суффикса сайта)   [NEW]
 *   #14 все <img src=""> существуют на диске                      [NEW]
 *   #15 <h1> ровно один раз                                       [NEW]
 *   #16 FAQPage JSON-LD вопросы = вопросы faq-accordion           [NEW]
 *   CSS нет color-mix в linear-gradient, нет нестандартных bp
 *   sitemap + feed содержат все статьи
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ARTICLES  = path.resolve(__dirname, '../articles');
const CSS_DIR   = path.resolve(__dirname, '../css');
const SITEMAP   = path.resolve(__dirname, '../sitemap.xml');
const FEED      = path.resolve(__dirname, '../feed.xml');
const BASE_URL  = 'https://gospod-bog.ru';
const SITE_NAME = 'Господь Бог — Сила Моя';

const STRICT    = process.argv.includes('--strict');

const VALID_SECTIONS = new Set(['Переводы', 'Публикации', 'Разбор заблуждений']);

// Брейкпоинты дизайн-системы проекта. Чек #8 и CSS-чек предупреждают
// только о значениях ВНЕ этого набора. При расширении — добавляйте сюда.
const PROJECT_BREAKPOINTS = new Set([
  '360px', '430px', '440px', '480px',
  '540px', '600px', '640px', '660px', '680px',
  '700px', '768px', '820px', '899px',
  '900px', '1024px', '1100px', '1200px',
]);

let errors   = 0;
let warnings = 0;

// ── Репортинг ─────────────────────────────────────────────────────────────────

function err(slug, msg)  { console.log(`  ❌  [${slug}] ${msg}`); errors++;   }
function warn(slug, msg) { console.log(`  ⚠️  [${slug}] ${msg}`); warnings++; }
function ok(slug, msg)   { console.log(`  ✔  [${slug}] ${msg}`); }

// ── Утилиты ───────────────────────────────────────────────────────────────────

/** Нормализация для нечёткого сравнения вопросов */
function normStr(s) {
  return s
    .toLowerCase()
    .replace(/[«»""''–—-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Проверки HTML статьи ──────────────────────────────────────────────────────

function validateArticle(slug) {
  const file = path.join(ARTICLES, slug, 'index.html');
  if (!fs.existsSync(file)) { err(slug, 'нет index.html'); return; }

  const html = fs.readFileSync(file, 'utf8');

  // #1 canonical совпадает со slugом
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];
  if (!canonical) {
    err(slug, 'нет <link rel="canonical">');
  } else if (!canonical.endsWith(`/articles/${slug}/`)) {
    err(slug, `canonical "${canonical}" не совпадает со slug`);
  }

  // #2 article:section присутствует и валиден
  const section = html.match(/section:\s*'([^']+)'/)?.[1];
  if (!section) {
    err(slug, 'page.section не найден в SITE_CONFIG');
  } else if (!VALID_SECTIONS.has(section)) {
    err(slug, `page.section = '${section}' — неизвестное значение`);
  }

  // #3 article:modified_time присутствует
  if (!/<meta\s+property="article:modified_time"/.test(html)) {
    warn(slug, 'article:modified_time отсутствует — update-meta.js должен был добавить');
  }

  // #4 OG-изображение: файл существует
  const ogImg = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1];
  if (!ogImg) {
    err(slug, 'нет og:image');
  } else {
    const imgFile = ogImg.replace(BASE_URL, path.resolve(__dirname, '..'));
    if (!fs.existsSync(imgFile)) {
      err(slug, `og:image файл не найден: ${ogImg}`);
    }
  }

  // #5 Byline содержит роль перед именем
  const bylineStrong = html.match(/<span class="article-byline__strong">([^<]+)<\/span>/)?.[1];
  if (!bylineStrong) {
    warn(slug, 'article-byline__strong не найден');
  } else if (!/^(Редактор:|Редакция перевода:)/.test(bylineStrong.trim())) {
    err(slug, `byline "${bylineStrong}" не содержит роль (Редактор: / Редакция перевода:)`);
  }

  // #6 author-card присутствует
  if (!html.includes('class="author-card"')) {
    warn(slug, 'author-card не найден — добавьте перед </article>');
  }

  // #7 Нет color-mix внутри linear-gradient
  for (const m of html.matchAll(/linear-gradient\([^)]*color-mix[^)]*\)/g)) {
    err(slug, `color-mix внутри linear-gradient: ${m[0].slice(0, 80)}`);
  }

  // #8 Нестандартный брейкпоинт в inline-стиле (не из PROJECT_BREAKPOINTS)
  for (const m of html.matchAll(/@media\s*\(max-width:\s*(\d+px)\)/g)) {
    if (!PROJECT_BREAKPOINTS.has(m[1]))
      warn(slug, `нестандартный брейкпоинт в inline-стиле: ${m[1]}`);
  }

  // #9 JSON-LD BreadcrumbList: последний элемент совпадает с og:title
  const ogTitle      = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)?.[1];
  const breadcrumbLD = html.match(/"BreadcrumbList"[\s\S]{0,800}"name":\s*"([^"]+)"\s*\}\s*\]/)?.[1];
  if (breadcrumbLD && ogTitle && breadcrumbLD !== ogTitle) {
    warn(slug, `BreadcrumbList последний элемент "${breadcrumbLD}" ≠ og:title "${ogTitle}"`);
  }

  // #10 Дублирующиеся id в HTML
  const ids  = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) warn(slug, `дубль id="${id}"`);
    seen.add(id);
  }

  // #11 img без alt
  for (const m of html.matchAll(/<img(?![^>]*\balt\s*=)[^>]*>/g)) {
    warn(slug, `<img> без alt: ${m[0].slice(0, 80)}`);
  }

  // #12 Внутренние ссылки — проверяем href="../SLUG/" или href="../../SECTION/"
  for (const [, rel] of html.matchAll(/href="(\.\.[/][^"#?]+)"/g)) {
    const abs = path.resolve(path.join(ARTICLES, slug), rel);
    if (!fs.existsSync(abs) && !fs.existsSync(abs + 'index.html')) {
      warn(slug, `внутренняя ссылка не найдена: ${rel}`);
    }
  }

  // #13 <title> совпадает с og:title ─────────────────────────────────────────
  // <title> может иметь суффикс " — SITE_NAME" — сравниваем без него
  const SITE_SUFFIX = ` — ${SITE_NAME}`;
  const titleRaw    = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? '';
  const titleNorm   = titleRaw.endsWith(SITE_SUFFIX)
    ? titleRaw.slice(0, -SITE_SUFFIX.length).trim()
    : titleRaw;
  if (titleNorm && ogTitle && titleNorm !== ogTitle) {
    warn(slug,
      `<title> ≠ og:title\n` +
      `           <title>: "${titleNorm}"\n` +
      `         og:title: "${ogTitle}"`
    );
  }

  // #14 Все <img src=""> существуют на диске ─────────────────────────────────
  for (const [, src] of html.matchAll(/<img[^>]+\bsrc="([^"]+)"/g)) {
    if (/^https?:\/\//.test(src) || src.startsWith('data:')) continue;
    const abs = path.resolve(path.join(ARTICLES, slug), src);
    if (!fs.existsSync(abs)) {
      err(slug, `<img src> не найден на диске: ${src}`);
    }
  }

  // #15 <h1> ровно один раз ──────────────────────────────────────────────────
  const h1count = (html.match(/<h1[\s>]/g) ?? []).length;
  if      (h1count === 0) err(slug, 'нет ни одного <h1>');
  else if (h1count  >  1) err(slug, `<h1> встречается ${h1count} раз — должен быть ровно 1`);

  // #16 FAQPage JSON-LD ↔ faq-accordion ─────────────────────────────────────
  // 1) Парсим все ld+json блоки, ищем FAQPage
  const ldBlocks  = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let ldQuestions = [];
  let ldParseErr  = false;

  for (const [, raw] of ldBlocks) {
    try {
      const parsed  = JSON.parse(raw.trim());
      const schemas = Array.isArray(parsed) ? parsed : [parsed];
      for (const s of schemas) {
        if (s['@type'] === 'FAQPage' && Array.isArray(s.mainEntity)) {
          ldQuestions = s.mainEntity
            .filter(q => q['@type'] === 'Question')
            .map(q => String(q.name ?? '').trim())
            .filter(Boolean);
        }
      }
    } catch {
      ldParseErr = true;
    }
  }

  if (ldParseErr) {
    err(slug, 'невалидный JSON-LD — один из <script type="application/ld+json"> не парсится как JSON');
  }

  // 2) Текст кнопок аккордеона — до <span class="faq-accordion__icon"
  const accQuestions = [...html.matchAll(
    /<button[^>]*class="faq-accordion__q"[^>]*>([\s\S]*?)<span[^>]*class="faq-accordion__icon"/g
  )].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);

  // 3) Сравниваем
  const hasFAQLD  = ldQuestions.length  > 0;
  const hasAccord = accQuestions.length > 0;

  if (hasFAQLD || hasAccord) {
    if (!hasFAQLD) {
      warn(slug, `аккордеон содержит ${accQuestions.length} вопросов — FAQPage JSON-LD отсутствует`);
    } else if (!hasAccord) {
      warn(slug, `FAQPage JSON-LD содержит ${ldQuestions.length} вопросов — faq-accordion не найден в HTML`);
    } else {
      if (ldQuestions.length !== accQuestions.length) {
        warn(slug,
          `FAQPage: JSON-LD ${ldQuestions.length} вопр., аккордеон ${accQuestions.length} вопр.`
        );
      }

      const accNorm = new Set(accQuestions.map(normStr));
      const ldNorm  = new Set(ldQuestions.map(normStr));

      for (const q of ldQuestions) {
        if (!accNorm.has(normStr(q))) {
          warn(slug, `JSON-LD вопрос не найден в аккордеоне: "${q.slice(0, 90)}"`);
        }
      }
      for (const q of accQuestions) {
        if (!ldNorm.has(normStr(q))) {
          warn(slug, `аккордеон вопрос не найден в JSON-LD: "${q.slice(0, 90)}"`);
        }
      }
    }
  }
}

// ── Проверки CSS ──────────────────────────────────────────────────────────────

function validateCSS() {
  const files = fs.readdirSync(CSS_DIR).filter(f => f.endsWith('.css'));

  for (const fname of files) {
    const file  = path.join(CSS_DIR, fname);
    const css   = fs.readFileSync(file, 'utf8');
    const label = `css/${fname}`;

    // color-mix внутри linear-gradient
    for (const m of css.matchAll(/linear-gradient\([^;]*color-mix[^;]*;/g)) {
      err(label, `color-mix внутри linear-gradient: ${m[0].slice(0, 80)}`);
    }

    // Нестандартные брейкпоинты (не из PROJECT_BREAKPOINTS)
    for (const m of css.matchAll(/@media\s*\(max-width:\s*(\d+px)\)/g)) {
      if (!PROJECT_BREAKPOINTS.has(m[1]))
        warn(label, `нестандартный брейкпоинт: ${m[1]}`);
    }
  }
}

// ── Проверки sitemap / feed ───────────────────────────────────────────────────

function validateSitemapFeed() {
  const slugs = fs.readdirSync(ARTICLES, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

  // sitemap — каждый slug должен быть в нём
  const sitemap = fs.readFileSync(SITEMAP, 'utf8');
  for (const slug of slugs) {
    if (!sitemap.includes(`/articles/${slug}/`)) {
      err('sitemap.xml', `отсутствует статья: ${slug}`);
    }
  }

  // feed — каждый slug должен быть как guid
  const feed = fs.readFileSync(FEED, 'utf8');
  for (const slug of slugs) {
    if (!feed.includes(`/articles/${slug}/`)) {
      err('feed.xml', `отсутствует статья: ${slug}`);
    }
  }

  // feed — у каждого <item> должен быть <title>
  for (const [, body] of feed.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const guid = body.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1] ?? '?';
    if (!/<title>/.test(body)) {
      err('feed.xml', `<item> без <title>: ${guid}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n🔍  validate.js\n');

  // CSS
  console.log('  📁  css/');
  validateCSS();

  // Каждая статья
  const slugs = fs.readdirSync(ARTICLES, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

  for (const slug of slugs) {
    console.log(`\n  📄  ${slug}`);
    validateArticle(slug);
  }

  // sitemap + feed
  console.log('\n  🗺  sitemap.xml + feed.xml');
  validateSitemapFeed();

  // Итог
  console.log('\n' + '─'.repeat(50));
  if (errors === 0 && warnings === 0) {
    console.log('✅  Всё чисто.\n');
    process.exit(0);
  }

  console.log(`${errors > 0 ? '❌' : '⚠️'}  Ошибок: ${errors}  Предупреждений: ${warnings}`);

  if (STRICT && errors > 0) {
    console.log('  → --strict: прерываем workflow из-за ошибок.\n');
    process.exit(1);
  }

  console.log('  → Предупреждения не прерывают workflow. Исправьте при возможности.\n');
  process.exit(0);
}

main();
