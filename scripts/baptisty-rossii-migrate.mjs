/**
 * Batch migrate baptisty-rossii articles to Astro MDX + Astro pages.
 * Usage: node scripts/baptisty-rossii-migrate.js
 * 
 * Reads legacy HTML files from baptisty-rossii/{slug}/index.html,
 * extracts content, creates MDX in src/content/articles/,
 * and creates Astro pages in src/pages/baptisty-rossii/{slug}/.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ARTICLES = [
  {
    slug: 'noch-na-kure',
    h1: 'Ночь на Куре',
    title: 'Ночь на Куре — Баптисты России | Господь Бог — Сила Моя',
    description: 'Воронин, Кальвейт, Деляков и первая русская баптистская община',
    publishedAt: '2026-06-01T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 18,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 1',
    coverImg: 'cover-01-kura.svg',
  },
  {
    slug: 'yuzhnaya-shtunda',
    h1: 'Южная штунда',
    title: 'Южная штунда — Баптисты России | Господь Бог — Сила Моя',
    description: 'Унгер, Цимбал, Рябошапка, Ратушный, Прицкау, Онкен и Вилер',
    publishedAt: '2026-06-02T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 20,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 2',
    coverImg: 'cover-02-shtunda.svg',
  },
  {
    slug: 'dva-sezda-1884',
    h1: '1884: два съезда',
    title: '1884: два съезда — Баптисты России | Господь Бог — Сила Моя',
    description: 'Петербургское совещание и Ново-Васильевский съезд — две разные развилки',
    publishedAt: '2026-06-03T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 17,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 3',
    coverImg: 'cover-03-1884.svg',
  },
  {
    slug: 'peterburgskaya-liniya',
    h1: 'Петербургская линия',
    title: 'Петербургская линия — Баптисты России | Господь Бог — Сила Моя',
    description: 'Редсток, Пашков, Корф, Каргель и Проханов',
    publishedAt: '2026-06-04T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 21,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 4',
    coverImg: 'cover-04-peterburg.svg',
  },
  {
    slug: 'goneniya-i-sovest',
    h1: 'Гонения и совесть',
    title: 'Гонения и совесть — Баптисты России | Господь Бог — Сила Моя',
    description: 'Военный вопрос, право совести и давление государства',
    publishedAt: '2026-06-05T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 24,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 5',
    coverImg: 'cover-05-conscience.svg',
  },
  {
    slug: 'sovetskaya-noch',
    h1: 'Советская ночь',
    title: 'Советская ночь — Баптисты России | Господь Бог — Сила Моя',
    description: 'Закон 1929, Инструкция НКВД, закрытия и репрессии',
    publishedAt: '2026-06-06T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 28,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 6',
    coverImg: 'cover-06-soviet-night.svg',
  },
  {
    slug: 'vsehib-1944',
    h1: '1944: один союз',
    title: '1944: один союз — Баптисты России | Господь Бог — Сила Моя',
    description: 'ВСЕХиБ, Братский Вестник, ХВЕ и Прибалтика',
    publishedAt: '2026-06-07T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 26,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 7',
    coverImg: 'cover-07-vsehib.svg',
  },
  {
    slug: 'iniciativnaya-gruppa',
    h1: 'Инициативная группа',
    title: 'Инициативная группа — Баптисты России | Господь Бог — Сила Моя',
    description: '1960–1966: Положение, письмо, Оргкомитет и Совет Церквей',
    publishedAt: '2026-06-08T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 25,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 8',
    coverImg: 'cover-08-initiative.svg',
  },
  {
    slug: 'podpolnaya-pechat',
    h1: 'Подпольная печать',
    title: 'Подпольная печать — Баптисты России | Господь Бог — Сила Моя',
    description: 'Вестник спасения, Вестник истины, Совет родственников, Христианин',
    publishedAt: '2026-06-09T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 23,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 9',
    coverImg: 'cover-09-samizdat.svg',
  },
  {
    slug: 'spravochnik',
    h1: 'Справочник',
    title: 'Справочник — Баптисты России | Господь Бог — Сила Моя',
    description: 'Люди, даты, документы, спорные факты и источниковая оценка',
    publishedAt: '2026-06-10T00:00:00+03:00',
    updatedAt: '2026-06-13T12:00:00+03:00',
    readingTime: 27,
    series: 'russian-baptism',
    sectionLabel: 'Баптисты России · Часть 10',
    coverImg: 'cover-10-reference.svg',
  },
];

function extractBody(html) {
  // Find article body
  const bodyM = html.match(/<article[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/article>/);
  if (!bodyM) {
    const bodyM2 = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    if (!bodyM2) return '';
    return bodyM2[1];
  }
  let body = bodyM[1];
  
  // Remove scripts, navs, sidebars, JS widgets
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
  body = body.replace(/<aside[^>]*>[\s\S]*?<\/aside>/g, '');
  body = body.replace(/<nav[^>]*>[\s\S]*?<\/nav>/g, '');
  body = body.replace(/<footer[^>]*>[\s\S]*?<\/footer>/g, '');
  body = body.replace(/<div[^>]*class="[^"]*gbs2-[^"]*"[^>]*>[\s\S]*?<\/div>/g, '');
  body = body.replace(/<div[^>]*class="[^"]*article-end-block[^"]*"[^>]*>[\s\S]*?<\/div>/g, '');
  body = body.replace(/<div[^>]*class="[^"]*gbs2-bbar[^"]*"[^>]*>[\s\S]*?<\/div>/g, '');
  body = body.replace(/<div[^>]*class="[^"]*gbs2-sheet[^"]*"[^>]*>[\s\S]*?<\/div>/g, '');
  
  // Remove inline Tailwind classes (keep semantic class names)
  body = body.replace(/\s+class="[^"]*(?:tw-|bg-|text-|px-|py-|mt-|mb-|w-|h-|flex|font|rounded|shadow|border|max-|overflow|leading|gap|cursor|group|hidden|absolute|sticky|left|top|z-|space|justify|items|block|inline|table|self|order|sm:|lg:|md:|hover:|focus:|active:|dark:|opacity|duration|ease|transform|transition|min-|col-|row-|tracking|decoration|underline|strikethrough|italic|bold|semibold|light|medium|heavy|uppercase|lowercase|capitalize|normal-case|whitespace|break|hyphen|truncate|animate|keyframes)[^"]*"/g, '');
  
  // Remove empty class=""
  body = body.replace(/\s+class=""/g, '');
  
  // Basic HTML -> MDX conversions
  body = body.replace(/<h2([^>]*?)id="([^"]+)"([^>]*?)>([\s\S]*?)<\/h2>/g, '<h2 id="$2">$4</h2>');
  body = body.replace(/<h2([^>]*?)>([\s\S]*?)<\/h2>/g, '<h2>$2</h2>');
  body = body.replace(/<h3([^>]*?)id="([^"]+)"([^>]*?)>([\s\S]*?)<\/h3>/g, '<h3 id="$2">$4</h3>');
  body = body.replace(/<h3([^>]*?)>([\s\S]*?)<\/h3>/g, '<h3>$2</h3>');
  
  // Strong/em
  body = body.replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**');
  body = body.replace(/<em>([\s\S]*?)<\/em>/g, '*$1*');
  
  // Links
  body = body.replace(/<a([^>]*?)href="([^"]+)"([^>]*?)>([\s\S]*?)<\/a>/g, '[$4]($2)');
  
  // Clean up
  body = body.replace(/<br\s*\/?>/gi, '\n');
  body = body.replace(/<hr\s*\/?>/gi, '\n---\n');
  body = body.replace(/<div([^>]*?)>/g, '<div$1>');
  body = body.replace(/<\/div>/g, '');
  
  // Remove remaining HTML tags that are not MDX-compatible
  // Keep: h2, h3, p, strong, em, a, code, blockquote, ul, ol, li, div (with classes), section, span, img, figure, figcaption
  body = body.replace(/\n{3,}/g, '\n\n');
  body = body.replace(/[ \t]+/g, ' ');
  
  return body.trim();
}

function extractNextPrevNav(html) {
  // Extract gbs2-next navigation (next/prev article)
  const nextM = html.match(/class="gbs2-next"[^>]*>([\s\S]*?)<\/nav>/);
  if (!nextM) return null;
  
  const chunk = nextM[1];
  const links = [];
  
  // Find all a.gbs2-next-card
  const cardM = chunk.matchAll(/href="([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>[\s\S]*?<span[^>]*>([^<]*)<\/span>/g);
  for (const m of cardM) {
    links.push({ href: m[1], eyebrow: m[2].trim(), title: m[3].trim() });
  }
  return links;
}

// Generate navigation links for each article
const SERIES_NAV = {
  'noch-na-kure': { prev: null, next: '/baptisty-rossii/yuzhnaya-shtunda/' },
  'yuzhnaya-shtunda': { prev: '/baptisty-rossii/noch-na-kure/', next: '/baptisty-rossii/dva-sezda-1884/' },
  'dva-sezda-1884': { prev: '/baptisty-rossii/yuzhnaya-shtunda/', next: '/baptisty-rossii/peterburgskaya-liniya/' },
  'peterburgskaya-liniya': { prev: '/baptisty-rossii/dva-sezda-1884/', next: '/baptisty-rossii/goneniya-i-sovest/' },
  'goneniya-i-sovest': { prev: '/baptisty-rossii/peterburgskaya-liniya/', next: '/baptisty-rossii/sovetskaya-noch/' },
  'sovetskaya-noch': { prev: '/baptisty-rossii/goneniya-i-sovest/', next: '/baptisty-rossii/vsehib-1944/' },
  'vsehib-1944': { prev: '/baptisty-rossii/sovetskaya-noch/', next: '/baptisty-rossii/iniciativnaya-gruppa/' },
  'iniciativnaya-gruppa': { prev: '/baptisty-rossii/vsehib-1944/', next: '/baptisty-rossii/podpolnaya-pechat/' },
  'podpolnaya-pechat': { prev: '/baptisty-rossii/iniciativnaya-gruppa/', next: '/baptisty-rossii/spravochnik/' },
  'spravochnik': { prev: '/baptisty-rossii/podpolnaya-pechat/', next: null },
};

// Cover image filenames
const COVER_MAP = {
  'noch-na-kure': 'cover-01-kura.svg',
  'yuzhnaya-shtunda': 'cover-02-shtunda.svg',
  'dva-sezda-1884': 'cover-03-1884.svg',
  'peterburgskaya-liniya': 'cover-04-peterburg.svg',
  'goneniya-i-sovest': 'cover-05-conscience.svg',
  'sovetskaya-noch': 'cover-06-soviet-night.svg',
  'vsehib-1944': 'cover-07-vsehib.svg',
  'iniciativnaya-gruppa': 'cover-08-initiative.svg',
  'podpolnaya-pechat': 'cover-09-samizdat.svg',
  'spravochnik': 'cover-10-reference.svg',
};

// Part numbers (1-10)
const PART_NUM = {
  'noch-na-kure': '1', 'yuzhnaya-shtunda': '2', 'dva-sezda-1884': '3',
  'peterburgskaya-liniya': '4', 'goneniya-i-sovest': '5', 'sovetskaya-noch': '6',
  'vsehib-1944': '7', 'iniciativnaya-gruppa': '8', 'podpolnaya-pechat': '9', 'spravochnik': '10',
};

// Total parts
const TOTAL = 10;

function buildMDX(art, body) {
  const partNum = PART_NUM[art.slug];
  const coverImg = COVER_MAP[art.slug];
  const nav = SERIES_NAV[art.slug];
  
  let navMDX = '';
  if (nav.prev || nav.next) {
    navMDX = '\n\n---\n\n';
    if (nav.prev) {
      navMDX += `<a href="${nav.prev}" class="series-nav-link series-nav-link--prev">← Назад</a>`;
    }
    if (nav.next) {
      navMDX += `<a href="${nav.next}" class="series-nav-link series-nav-link--next">Дальше →</a>`;
    }
  }
  
  return `---
title: "${art.title}"
h1: "${art.h1}"
description: "${art.description}"
slug: "${art.slug}"
section: "baptisty-rossii"
publishedAt: "${art.publishedAt}"
updatedAt: "${art.updatedAt}"
author: "fedor-milovanov"
series: "${art.series}"
tags:
  - "история ЕХБ"
  - "баптисты России"
ogImage: "/images/baptisty-rossii/${coverImg}"
ogImageAlt: "${art.h1} — серия «Баптисты России», часть ${partNum} из ${TOTAL}"
canonicalOverride: "https://gospod-bog.ru/baptisty-rossii/${art.slug}/"
readingTime: ${art.readingTime}
---

${body}${navMDX}
`;
}

function buildAstroPage(art) {
  const partNum = PART_NUM[art.slug];
  const coverImg = COVER_MAP[art.slug];
  const nav = SERIES_NAV[art.slug];
  
  let prevPart = null, nextPart = null;
  const prevSlug = nav.prev?.match(/\/baptisty-rossii\/([^/]+)\//)?.[1];
  const nextSlug = nav.next?.match(/\/baptisty-rossii\/([^/]+)\//)?.[1];
  
  // Build series navigation
  const seriesLinks = Object.entries(PART_NUM).map(([slug, num]) => {
    const href = `/baptisty-rossii/${slug}/`;
    return `{ num: '${num}', href: '${href}', title: '${getTitle(slug)}' }`;
  }).join(',\n    ');
  
  return `---
import { getEntry, render } from 'astro:content';
import ArticleLayout from '@/layouts/ArticleLayout.astro';
import { SITE } from '@/data/site';

const entry = await getEntry('articles', '${art.slug}');
if (!entry) throw new Error('Article entry not found: articles/${art.slug}');
const { Content } = await render(entry);
const canonical = \`\${SITE.url}/baptisty-rossii/${art.slug}/\`;
---
<ArticleLayout
  entry={entry}
  canonical={canonical}
  robots="index, follow"
  pilot={false}
  intendedCanonical={canonical}
>
  <Content />
</ArticleLayout>
`;
}

function getTitle(slug) {
  const titles = {
    'noch-na-kure': 'Ночь на Куре',
    'yuzhnaya-shtunda': 'Южная штунда',
    'dva-sezda-1884': '1884: два съезда',
    'peterburgskaya-liniya': 'Петербургская линия',
    'goneniya-i-sovest': 'Гонения и совесть',
    'sovetskaya-noch': 'Советская ночь',
    'vsehib-1944': '1944: один союз',
    'iniciativnaya-gruppa': 'Инициативная группа',
    'podpolnaya-pechat': 'Подпольная печать',
    'spravochnik': 'Справочник',
  };
  return titles[slug] || slug;
}

// Run migration
const results = [];
for (const art of ARTICLES) {
  const srcPath = join(ROOT, 'baptisty-rossii', art.slug, 'index.html');
  
  if (!existsSync(srcPath)) {
    console.log(`SKIP: ${art.slug} (not found)`);
    continue;
  }
  
  const html = readFileSync(srcPath, 'utf8');
  const body = extractBody(html);
  
  if (!body) {
    console.log(`ERROR: ${art.slug} — no body extracted`);
    continue;
  }
  
  // Create MDX file
  const mdxPath = join(ROOT, 'src', 'content', 'articles', `${art.slug}.mdx`);
  const mdxDir = dirname(mdxPath);
  if (!existsSync(mdxDir)) mkdirSync(mdxDir, { recursive: true });
  
  const mdxContent = buildMDX(art, body);
  writeFileSync(mdxPath, mdxContent, 'utf8');
  console.log(`MDX: ${art.slug} (${body.length} chars)`);
  
  // Create Astro page
  const pageDir = join(ROOT, 'src', 'pages', 'baptisty-rossii', art.slug);
  if (!existsSync(pageDir)) mkdirSync(pageDir, { recursive: true });
  
  const pageContent = buildAstroPage(art);
  writeFileSync(join(pageDir, 'index.astro'), pageContent, 'utf8');
  console.log(`PAGE: ${art.slug}`);
  
  results.push(art.slug);
}

console.log(`\nMigrated ${results.length} articles: ${results.join(', ')}`);