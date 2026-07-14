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
 *   #17 Russian quote policy: нет английских прямых цитат в русских статьях
 *   CSS нет color-mix в linear-gradient, нет нестандартных bp
 *   sitemap + feed содержат все статьи
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ARTICLES  = path.resolve(__dirname, '../articles');
const CSS_DIR   = path.resolve(__dirname, '../css');
const NAGORNAYA = path.resolve(__dirname, '../nagornaya');
const SITEMAP   = path.resolve(__dirname, '../sitemap.xml');
const FEED      = path.resolve(__dirname, '../feed.xml');
const BASE_URL  = 'https://gospod-bog.ru';
const SITE_NAME = 'Господь Бог — Сила Моя';

const STRICT    = process.argv.includes('--strict');

const VALID_SECTIONS = new Set(['Переводы', 'Публикации', 'Разбор заблуждений', 'Апологетика', 'Богословие', 'Герменевтика', 'Экзегетика', 'Библеистика', 'Служение', 'Тёмная сторона кафедры', 'Биографии служителей']);

// Брейкпоинты дизайн-системы проекта. Чек #8 и CSS-чек предупреждают
// только о значениях ВНЕ этого набора. При расширении — добавляйте сюда.
const PROJECT_BREAKPOINTS = new Set([
  '360px', '380px', '390px', '420px', '430px', '440px', '480px',
  '500px', '540px', '560px', '600px', '640px', '660px', '680px',
  '700px', '760px', '768px', '820px', '860px', '899px',
  '900px', '960px', '1024px', '1100px', '1200px',
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
    .replace(/^q\d+\s+/, '')
    .trim();
}

function findColorMixInsideLinearGradients(text) {
  const out = [];
  const needle = 'linear-gradient(';
  let idx = 0;

  while ((idx = text.indexOf(needle, idx)) !== -1) {
    let i = idx + needle.length;
    let depth = 1;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          const segment = text.slice(idx, i + 1);
          if (segment.includes('color-mix(')) out.push(segment);
          idx = i + 1;
          break;
        }
      }
    }
    if (i >= text.length) break;
  }

  return out;
}

// ── Проверки HTML статьи ──────────────────────────────────────────────────────

function validateArticle(slug) {
  const file = path.join(ARTICLES, slug, 'index.html');
  if (!fs.existsSync(file)) { err(slug, 'нет index.html'); return; }

  const html = fs.readFileSync(file, 'utf8');
  const cfg = extractSiteConfigFromHtml(html, slug) || {};

  // #1 canonical совпадает со slugом
  const canonical = html.match(/<link\s+[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]
    ?? html.match(/<link\s+[^>]*href="([^"]+)"[^>]*rel="canonical"/)?.[1];
  if (!canonical) {
    err(slug, 'нет <link rel="canonical">');
  } else if (!canonical.endsWith(`/articles/${slug}/`)) {
    err(slug, `canonical "${canonical}" не совпадает со slug`);
  }

  // #2 article:section присутствует и валиден
  const section = cfg && cfg.page ? cfg.page.section : null;
  if (!section) {
    err(slug, 'page.section не найден в SITE_CONFIG');
  } else if (!VALID_SECTIONS.has(section)) {
    err(slug, `page.section = '${section}' — неизвестное значение`);
  }

  // #3 article:modified_time присутствует
  if (!/<meta\s+[^>]*property="article:modified_time"/.test(html)) {
    warn(slug, 'article:modified_time отсутствует — update-meta.js должен был добавить');
  }

  // #4 OG-изображение: файл существует
  const ogImg = html.match(/<meta\s+[^>]*property="og:image"[^>]*content="([^"]+)"/)?.[1]
    ?? html.match(/<meta\s+[^>]*content="([^"]+)"[^>]*property="og:image"/)?.[1];
  if (!ogImg) {
    err(slug, 'нет og:image');
  } else if (!/^https?:\/\//.test(ogImg)) {
    const imgFile = path.resolve(path.join(ARTICLES, '..'), ogImg.replace(/^\//, ''));
    if (!fs.existsSync(imgFile)) {
      err(slug, `og:image файл не найден: ${ogImg}`);
    }
  }

  // #5 Byline содержит роль перед именем
  const bylineStrong = html.match(/<span class="article-byline__strong">([^<]+)<\/span>/)?.[1];
  if (!bylineStrong) {
    warn(slug, 'article-byline__strong не найден');
  } else if (!/^(Редактор:|Редакция перевода:|Автор-редактор:)/.test(bylineStrong.trim())) {
    err(slug, `byline "${bylineStrong}" не содержит роль (Редактор: / Редакция перевода: / Автор-редактор:)`);
  }

  // #6 author-card присутствует
  if (!html.includes('class="author-card"')) {
    warn(slug, 'author-card не найден — добавьте перед </article>');
  }

  // #7 Нет color-mix внутри linear-gradient
  for (const hit of findColorMixInsideLinearGradients(html)) {
    err(slug, `color-mix внутри linear-gradient: ${hit.slice(0, 80)}`);
  }

  // #8 Нестандартный брейкпоинт в inline-стиле (не из PROJECT_BREAKPOINTS)
  for (const m of html.matchAll(/@media\s*\(max-width:\s*(\d+px)\)/g)) {
    if (!PROJECT_BREAKPOINTS.has(m[1]))
      warn(slug, `нестандартный брейкпоинт в inline-стиле: ${m[1]}`);
  }

  // #9 JSON-LD BreadcrumbList: последний элемент совпадает с og:title
  const ogTitle      = html.match(/<meta\s+[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1]
    ?? html.match(/<meta\s+[^>]*content="([^"]+)"[^>]*property="og:title"/)?.[1];
  let breadcrumbLD = null;
  const allLdBlocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [, raw] of allLdBlocks) {
    try {
      const data = JSON.parse(raw.trim());
      const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
      for (const item of items) {
        if (item['@type'] === 'BreadcrumbList' && Array.isArray(item.itemListElement)) {
          const lastItem = item.itemListElement[item.itemListElement.length - 1];
          if (lastItem) breadcrumbLD = lastItem.name || null;
        }
        /* Also check nested breadcrumb (e.g. ProfilePage.breadcrumb) */
        if (item.breadcrumb && item.breadcrumb['@type'] === 'BreadcrumbList' &&
            Array.isArray(item.breadcrumb.itemListElement)) {
          const lastItem = item.breadcrumb.itemListElement[item.breadcrumb.itemListElement.length - 1];
          if (lastItem) breadcrumbLD = lastItem.name || null;
        }
      }
    } catch {}
  }
  if (breadcrumbLD && ogTitle && breadcrumbLD.trim() !== ogTitle.trim()) {
    warn(slug, `BreadcrumbList "${breadcrumbLD}" ≠ og:title "${ogTitle}"`);
  }

  /* Чек SSR: ssr:true в Яндекс.Метрике — ошибка конфигурации */
  if (html.includes('ssr:true') || html.includes('ssr: true')) {
    err(slug, 'Yandex Metrika: ssr:true — для статического сайта нужен ssr:false');
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
  // <title> может иметь суффикс " — SITE_NAME", " | SITE_NAME" или " | gb"
  const SITE_SUFFIX = ` — ${SITE_NAME}`;
  const titleRaw    = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? '';
  let titleNorm     = titleRaw;
  // Strip any known site suffix variants
  for (const sfx of [SITE_SUFFIX, ` | ${SITE_NAME}`, ' | Господь Бог']) {
    if (titleNorm.endsWith(sfx)) {
      titleNorm = titleNorm.slice(0, -sfx.length).trim();
      break;
    }
  }
  if (titleNorm && ogTitle && titleNorm !== ogTitle) {
    warn(slug,
      `<title> ≠ og:title\\n` +
      `           <title>: "${titleNorm}"\\n` +
      `         og:title: "${ogTitle}"`
    );
  }

  // #14 Все <img src=""> существуют на диске ─────────────────────────────────
  for (const [, src] of html.matchAll(/<img[^>]+\bsrc="([^"]+)"/g)) {
    if (/^https?:\/\//.test(src) || src.startsWith('data:')) continue;
    const abs = path.resolve(path.join(ARTICLES, slug), src);
    const absFromRoot = path.resolve(path.join(ARTICLES, '..'), src);
    if (!fs.existsSync(abs) && !fs.existsSync(absFromRoot)) {
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
      // Flatten: top-level array OR @graph array OR single object
      let schemas = Array.isArray(parsed) ? parsed : [parsed];
      schemas = schemas.flatMap(s =>
        (s && Array.isArray(s['@graph'])) ? s['@graph'] : [s]
      );
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
    for (const hit of findColorMixInsideLinearGradients(css)) {
      err(label, `color-mix внутри linear-gradient: ${hit.slice(0, 80)}`);
    }

    // Нестандартные брейкпоинты (не из PROJECT_BREAKPOINTS)
    for (const m of css.matchAll(/@media\s*\(max-width:\s*(\d+px)\)/g)) {
      if (!PROJECT_BREAKPOINTS.has(m[1]))
        warn(label, `нестандартный брейкпоинт: ${m[1]}`);
    }
  }
}

// ── Проверки sitemap / feed ───────────────────────────────────────────────────

// Nagornaya pages that must be present in sitemap (root + all sub-pages).
// Derived from nagornaya/ directory structure: index.html + sub-folders.
const NAGORNAYA_SITEMAP_PATHS = (function() {
  const paths = ['/nagornaya/'];
  if (!fs.existsSync(NAGORNAYA)) return paths;
  const subdirs = fs.readdirSync(NAGORNAYA, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .filter(d => {
      const htmlPath = path.join(NAGORNAYA, d.name, 'index.html');
      if (!fs.existsSync(htmlPath)) return false;
      const html = fs.readFileSync(htmlPath, 'utf8');
      /* noindex pages must not be required in sitemap. */
      return !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
    })
    .map(d => `/nagornaya/${d.name}/`);
  return paths.concat(subdirs);
})();

function validateSitemapFeed() {
  const slugs = fs.readdirSync(ARTICLES, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

  // sitemap — каждый articles/slug должен быть в нём
  const sitemap = fs.readFileSync(SITEMAP, 'utf8');
  for (const slug of slugs) {
    if (!sitemap.includes(`/articles/${slug}/`)) {
      err('sitemap.xml', `отсутствует статья: ${slug}`);
    }
  }

  // sitemap — все nagornaya-страницы должны присутствовать
  for (const nagPath of NAGORNAYA_SITEMAP_PATHS) {
    if (!sitemap.includes(nagPath)) {
      err('sitemap.xml', `отсутствует nagornaya-страница: ${nagPath}`);
    }
  }

  // feed — каждый articles/slug должен быть как guid
  const feed = fs.readFileSync(FEED, 'utf8');
  for (const slug of slugs) {
    if (!feed.includes(`/articles/${slug}/`)) {
      err('feed.xml', `отсутствует статья: ${slug}`);
    }
  }

  // feed — nagornaya/ должна присутствовать (серия как единица публикации)
  if (!feed.includes('/nagornaya/')) {
    warn('feed.xml', 'серия /nagornaya/ отсутствует в feed.xml');
  }

  // feed — у каждого <item> должен быть <title>
  for (const [, body] of feed.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const guid = body.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1] ?? '?';
    if (!/<title>/.test(body)) {
      err('feed.xml', `<item> без <title>: ${guid}`);
    }
  }
}


// ── JS validation (NEW r58): node-side syntax check + sanity ──────────────────
function validateJS() {
  const { execFileSync } = require('child_process');
  const JS_DIR = path.resolve(__dirname, '../js');
  if (!fs.existsSync(JS_DIR)) return;
  const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));

  for (const f of files) {
    const fp = path.join(JS_DIR, f);
    // 1) node --check — ловит SyntaxError'ы (защита от регрессии r48b)
    try {
      execFileSync('node', ['--check', fp], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      const msg = (e.stderr ? e.stderr.toString() : '').split('\n').slice(0, 3).join(' | ');
      err('js/' + f, 'syntax error — node --check FAILED: ' + msg);
    }

    // 2) sanity-check: var/let/const объявления внутри строк
    //    Защита от dedup-катастрофы r48b: 'var SVG_X = ...;<остаток_строки>'
    const src = fs.readFileSync(fp, 'utf8');
    const lines = src.split('\n');
    lines.forEach((ln, i) => {
      // Шаблон: 'var SOMETHING = '...';СУФФИКС' — где СУФФИКС не пустой и не комментарий
      const m = ln.match(/^\s*(var|let|const)\s+[A-Z_][A-Z0-9_]*\s*=\s*['"][^'"]*['"]\s*;\s*\S/);
      if (m) {
        err('js/' + f, `L${i+1}: подозрение на dedup-катастрофу (объявление склеено с кодом): ${ln.trim().slice(0,120)}`);
      }
    });

    // 3) лишние '}}' подряд после метода объекта — защита от регрессии r44f
    //    (там debounce закрылся '}}' что закрыло весь SiteUtils)
    //    Эвристика: ищем '}},' после которого идёт 'name: function'
    for (let i = 0; i < lines.length - 3; i++) {
      if (/^\s*}},\s*$/.test(lines[i])) {
        // проверим, что следующие 1-3 строки — это property:function
        for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
          if (/^\s*[a-zA-Z_$][\w$]*\s*:\s*function/.test(lines[j])) {
            err('js/' + f, `L${i+1}: подозрение на лишнюю '}' — '}},' за которым через ${j-i} стр. идёт ${lines[j].trim().slice(0,60)}`);
            break;
          }
        }
      }
    }
  }
}

function walkHtmlFiles(dir, out = []) {
  const skip = new Set(['.git', 'node_modules', '.arena', '.cache', 'dist', 'build', 'coverage', 'out', 'target', '_app', 'scripts']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function validateInlineScripts() {
  const ROOT = path.resolve(__dirname, '..');
  const htmlFiles = walkHtmlFiles(ROOT);

  htmlFiles.forEach((file) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    let idx = 0;

    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      idx += 1;
      const attrs = match[1] || '';
      const code = match[2] || '';
      if (/\bsrc\s*=\s*/i.test(attrs)) continue;
      if (/type\s*=\s*["']application\/(ld\+json|json)["']/i.test(attrs)) continue;
      if (!code.trim()) continue;

      try {
        new vm.Script(code, { filename: `${rel}#inline-script-${idx}` });
      } catch (e) {
        err(rel, `inline <script> syntax error (#${idx}): ${e.message}`);
      }
    }
  });
}

function extractSiteConfigFromHtml(html, fileLabel) {
  const sandbox = {
    window: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { documentElement: { classList: { add() {} } } },
    matchMedia() { return { matches: false }; },
    console: { warn() {}, log() {}, error() {} }
  };
  sandbox.window = sandbox;
  sandbox.window.matchMedia = sandbox.matchMedia;
  vm.createContext(sandbox);

  let found = false;
  let idx = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    idx += 1;
    const attrs = match[1] || '';
    const code = match[2] || '';
    if (/\bsrc\s*=\s*/i.test(attrs)) continue;
    if (/type\s*=\s*["']application\/(ld\+json|json)["']/i.test(attrs)) continue;
    if (!code.includes('window.SITE_CONFIG')) continue;
    found = true;
    try {
      new vm.Script(code, { filename: `${fileLabel}#site-config-${idx}` }).runInContext(sandbox, { timeout: 1000 });
    } catch (e) {
      err(fileLabel, `SITE_CONFIG runtime parse error (#${idx}): ${e.message}`);
      return null;
    }
  }

  return found ? (sandbox.window.SITE_CONFIG || null) : null;
}

function validateQuizSchema() {
  const ROOT = path.resolve(__dirname, '..');
  const htmlFiles = walkHtmlFiles(ROOT);

  htmlFiles.forEach((file) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    const cfg = extractSiteConfigFromHtml(html, rel);
    if (!cfg || !cfg.quiz) return;

    ['questions', 'bonusQuestions'].forEach((key) => {
      const arr = cfg.quiz[key];
      if (!Array.isArray(arr) || !arr.length) return;
      arr.forEach((q, idx) => {
        const label = `${rel} ${key}[${idx}]`;
        if ('q' in q || 'answer' in q || 'ok' in q || 'err' in q) {
          err(rel, `${key}[${idx}] uses legacy quiz fields (q/answer/ok/err) — source HTML must be canonical`);
        }
        if (!('question' in q) || typeof q.question !== 'string' || !q.question.trim()) {
          err(rel, `${key}[${idx}] missing canonical question text`);
        }
        const type = q.type || 'single';
        if (type === 'single') {
          if (typeof q.correct !== 'number') err(rel, `${key}[${idx}] missing numeric correct`);
        } else if (!Array.isArray(q.correct)) {
          err(rel, `${key}[${idx}] for type=${type} must use array correct`);
        }
        if (!q.explanation || typeof q.explanation !== 'object' || !q.explanation.short || !q.explanation.full) {
          err(rel, `${key}[${idx}] missing explanation.short/full`);
        }
      });
    });
  });
}


function isAllowedEnglishQuoteFragment(fragment) {
  const allowed = [
    'ipsissima', 'Logia Jesu', 'anomia', 'Suo Marte', 'sola scriptura', 'pactum salutis',
    'Semper invictus', 'fervore perpetuo ardenti', 'Coffee House Association', 'Goat',
    'Doctor of Divinity', 'The Master', 'TMSJ', 'CCEL', 'GTY', 'JETS', 'PRDL'
  ];
  return allowed.some(x => fragment.includes(x));
}

function stripHtmlLite(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ');
}

function isLikelyEnglishSourceTitle(fragment) {
  const clean = stripHtmlLite(fragment)
    .replace(/[’']/g, '')
    .replace(/[?!.:;,()\[\]—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = clean.match(/[A-Za-z]+/g) || [];
  if (words.length < 3) return false;
  const small = new Set(['a','an','and','as','at','be','by','for','from','in','into','of','on','or','the','to','with','without','is']);
  let ok = 0;
  for (const w of words) {
    if (small.has(w.toLowerCase()) || /^[A-Z][A-Za-z]*$/.test(w) || /^[A-Z]{2,}$/.test(w)) ok += 1;
  }
  return ok / words.length >= 0.85;
}

function hasEnglishDirectQuote(fragment) {
  const clean = stripHtmlLite(fragment);
  const latinWords = clean.match(/[A-Za-z]{4,}/g) || [];
  if (latinWords.length < 3) return false;
  if (isAllowedEnglishQuoteFragment(clean)) return false;
  if (isLikelyEnglishSourceTitle(clean)) return false;
  // Skip French/Latin/other non-English phrases (accented chars = not English)
  if (/[àâäéèêëïîôùûüçñÉÈ]/.test(clean)) return false;
  return true;
}

function validateRussianQuotePolicy() {
  const ROOT = path.resolve(__dirname, '..');
  const htmlFiles = walkHtmlFiles(ROOT).filter((file) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    return rel.startsWith('articles/') || rel.startsWith('nagornaya/');
  });

  const quoteRe = /[«“]([^»”]{0,260}[A-Za-z]{4,}[^»”]{0,260})[»”]/g;
  const bibliographicLineRe = /(href=|src=|<meta\b|<link\b|rel=|property=|content=|reading-list|sources-list|rl-author|font-mono|sourceRef|data-pagefind|Источник:|Оригинал|Примечание к сноскам|Библиография|Источники|<cite\b)/i;
  let bad = 0;

  function checkText(label, text) {
    for (const m of text.matchAll(quoteRe)) {
      const fragment = stripHtmlLite(String(m[1] || '')).trim();
      if (hasEnglishDirectQuote(fragment)) {
        bad += 1;
        err(label, `английская прямая цитата в русском тексте: «${fragment.slice(0, 100)}»`);
      }
    }
  }

  function walkStrings(label, value) {
    if (typeof value === 'string') {
      checkText(label, value);
    } else if (Array.isArray(value)) {
      value.forEach(v => walkStrings(label, v));
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(v => walkStrings(label, v));
    }
  }

  htmlFiles.forEach((file) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');

    const body = (html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
      .replace(/<span[^>]*class=["'][^"']*tooltip[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');

    body.split(/\n/).forEach((line, idx) => {
      if (bibliographicLineRe.test(line)) return;
      const text = line.replace(/<[^>]+>/g, ' ');
      checkText(`${rel}:L${idx + 1}`, text);
    });

    const cfg = extractSiteConfigFromHtml(html, rel);
    if (cfg && cfg.quiz) {
      walkStrings(`${rel}:SITE_CONFIG.quiz`, cfg.quiz);
    }
  });

  if (!bad) ok('html-contracts', 'Russian quote policy passed: no English direct quotes in reader-facing Russian text');
}

function validateMetaUniqueness() {
  const ROOT = path.resolve(__dirname, '..');
  const htmlFiles = walkHtmlFiles(ROOT);
  const props = [
    'og:image',
    'og:image:width',
    'og:image:height',
    'og:image:type',
    'og:image:alt'
  ];

  htmlFiles.forEach((file) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    props.forEach((prop) => {
      const re = new RegExp(`<meta\\s+[^>]*property=["']${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'gi');
      const count = (html.match(re) || []).length;
      if (prop === 'og:image') {
        if (count > 1) err(rel, `duplicate ${prop} meta (${count})`);
      } else if (count > 1) {
        err(rel, `duplicate ${prop} meta (${count})`);
      }
    });
  });
}


// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n🔍  validate.js\n');

  // CSS
  console.log('  📁  css/');
  validateCSS();

  // JS (NEW r58): syntax + sanity check для js/*.js
  console.log('  📁  js/');
  validateJS();

  // Inline <script> во всех HTML (ловит битый SITE_CONFIG / page-specific JS)
  console.log('  📁  inline-scripts/');
  validateInlineScripts();

  // Глобальный контракт quiz schema / OG meta uniqueness
  console.log('  📁  html-contracts/');
  validateQuizSchema();
  validateMetaUniqueness();
  validateRussianQuotePolicy();

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

// ── V3-FIX: Validate non-article pages (pastor-series, about, index) ──
  const EXTRA_PAGES = [
    { file: path.resolve(__dirname, '../pastor-series/index.html'), slug: 'pastor-series' },
    { file: path.resolve(__dirname, '../biografii/index.html'), slug: 'biografii' },
    { file: path.resolve(__dirname, '../about/index.html'), slug: 'about' },
    { file: path.resolve(__dirname, '../index.html'), slug: 'index' },
  ];

  for (const { file, slug } of EXTRA_PAGES) {
    if (!fs.existsSync(file)) { warn(slug, 'файл не найден'); continue; }
    const html = fs.readFileSync(file, 'utf8');

    // Basic checks
    if (!html.includes('<title>'))           err(slug, 'отсутствует <title>');
    if (!html.includes('og:image'))          err(slug, 'отсутствует og:image');
    if (!html.includes('canonical'))         err(slug, 'отсутствует canonical');
    if (!html.includes('ym('))              warn(slug, 'отсутствует Яндекс.Метрика');
    if (html.includes('javascript:void(0)')) warn(slug, 'содержит javascript:void(0)');

    // Check for consistent theme-color
    const themeMatch = html.match(/theme-color.*?content="([^"]+)"/);
    if (themeMatch && themeMatch[1] !== '#fdfcf9' && themeMatch[1] !== '#171411') {
      warn(slug, `нестандартный theme-color: ${themeMatch[1]}`);
    }
  }



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
