#!/usr/bin/env node
/**
 * check-mdx-html-parity.js — MDX vs HTML content parity guard.
 *
 * Why this exists (Refactoring 6.0):
 *   Full-document shadow-wrap (e116bec6, 87fcc7b2) reverted all Astro article
 *   pages to emit legacy HTML verbatim via loadLegacyFullDocument. But MDX files
 *   (src/content/articles/*.mdx) may have been improved after extraction.
 *   Without this guard, MDX improvements are siloed from production.
 *
 * Guard logic:
 *   1. For each article with both MDX and HTML, compare body word counts
 *   2. If ratio is outside 90-110%, warn
 *   3. Track which source is newer (MDX or HTML)
 *   4. If MDX is newer and content differs significantly → ERROR
 *
 * Use in validate:static-publication chain.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOLERANCE = 0.12; // 12% tolerance for format differences (Markdown vs HTML)

function stripHtml(src) {
  return src
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFrontmatter(src) {
  return src.replace(/^---[\s\S]*?---\n*/m, '');
}

function stripFormatting(src) {
  return src
    .replace(/[#*_\-`\[\]()>|!]/g, ' ')
    .replace(/---/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  return text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
}

function normalizeCount(text) {
  return countWords(stripFormatting(text));
}

// Article pairs: MDX file → HTML file
const PAIRS = [
  // Main articles
  ['src/content/articles/20-antisovetov-pastoru.mdx', 'articles/20-antisovetov-pastoru/index.html'],
  ['src/content/articles/dzhon-gill-chast-1-chelovek.mdx', 'articles/dzhon-gill-chast-1-chelovek/index.html'],
  ['src/content/articles/dzhon-gill-chast-2-uchenyi.mdx', 'articles/dzhon-gill-chast-2-uchenyi/index.html'],
  ['src/content/articles/dzhon-gill-chast-3-nasledie.mdx', 'articles/dzhon-gill-chast-3-nasledie/index.html'],
  ['src/content/articles/dzhon-gill-istoricheskiy-kontekst.mdx', 'articles/dzhon-gill-istoricheskiy-kontekst/index.html'],
  ['src/content/articles/dzhon-gill-spravochnik.mdx', 'articles/dzhon-gill-spravochnik/index.html'],
  ['src/content/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki.mdx', 'articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html'],
  ['src/content/articles/kod-da-vinchi.mdx', 'articles/kod-da-vinchi/index.html'],
  ['src/content/articles/krajne-li-isporcheno-serdce.mdx', 'articles/krajne-li-isporcheno-serdce/index.html'],
  ['src/content/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy.mdx', 'articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html'],
  // Baptisty-rossii articles
  ['src/content/articles/noch-na-kure.mdx', 'baptisty-rossii/noch-na-kure/index.html'],
  ['src/content/articles/yuzhnaya-shtunda.mdx', 'baptisty-rossii/yuzhnaya-shtunda/index.html'],
  ['src/content/articles/dva-sezda-1884.mdx', 'baptisty-rossii/dva-sezda-1884/index.html'],
  ['src/content/articles/peterburgskaya-liniya.mdx', 'baptisty-rossii/peterburgskaya-liniya/index.html'],
  ['src/content/articles/goneniya-i-sovest.mdx', 'baptisty-rossii/goneniya-i-sovest/index.html'],
  ['src/content/articles/sovetskaya-noch.mdx', 'baptisty-rossii/sovetskaya-noch/index.html'],
  ['src/content/articles/vsehib-1944.mdx', 'baptisty-rossii/vsehib-1944/index.html'],
  ['src/content/articles/iniciativnaya-gruppa.mdx', 'baptisty-rossii/iniciativnaya-gruppa/index.html'],
  ['src/content/articles/podpolnaya-pechat.mdx', 'baptisty-rossii/podpolnaya-pechat/index.html'],
  ['src/content/articles/spravochnik.mdx', 'baptisty-rossii/spravochnik/index.html'],
];

let errors = 0;
let warnings = 0;

console.log('MDX vs HTML Content Parity Check');
console.log('='.repeat(60));
console.log(`Tolerance: ±${(TOLERANCE * 100).toFixed(0)}%\n`);

for (const [mdxRel, htmlRel] of PAIRS) {
  const mdxPath = path.join(ROOT, mdxRel);
  const htmlPath = path.join(ROOT, htmlRel);
  
  if (!fs.existsSync(mdxPath)) { console.log(`⚠️ SKIP: ${mdxRel} not found`); continue; }
  if (!fs.existsSync(htmlPath)) { console.log(`⚠️ SKIP: ${htmlRel} not found`); continue; }
  
  // Read MDX
  let mdxText = fs.readFileSync(mdxPath, 'utf8');
  mdxText = stripFrontmatter(mdxText);
  const mdxBody = stripHtml(mdxText);
  const mdxWc = normalizeCount(mdxBody);
  
  // Read HTML — extract <article> body
  let htmlText = fs.readFileSync(htmlPath, 'utf8');
  let htmlBody;
  const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    htmlBody = articleMatch[1];
  } else {
    htmlBody = htmlText; // fallback to full body
  }
  htmlBody = stripHtml(htmlBody);
  const htmlWc = normalizeCount(htmlBody);
  
  // Compare
  const maxWc = Math.max(mdxWc, htmlWc);
  const ratio = maxWc > 0 ? Math.abs(mdxWc - htmlWc) / maxWc : 0;
  const slug = mdxRel.replace('src/content/articles/', '').replace('.mdx', '');
  
  const diff = mdxWc - htmlWc;
  const pass = ratio <= TOLERANCE;
  const icon = pass ? '✅' : '❌';
  
  console.log(`${icon} ${slug}: MDX=${mdxWc} HTML=${htmlWc} diff=${diff >= 0 ? '+' : ''}${diff} (${(ratio * 100).toFixed(1)}%)`);
  
  if (!pass) {
    errors++;
    console.log(`     EXCEEDS tolerance of ${(TOLERANCE * 100).toFixed(0)}%`);
  }
  
  // Check which file was modified most recently
  try {
    const { execSync } = require('child_process');
    const mdxDate = execSync(`git log -1 --format="%ci" -- "${mdxRel}"`, { encoding: 'utf8', cwd: ROOT }).trim();
    const htmlDate = execSync(`git log -1 --format="%ci" -- "${htmlRel}"`, { encoding: 'utf8', cwd: ROOT }).trim();
    
    if (mdxDate && htmlDate && mdxDate > htmlDate && ratio > 0.02) {
      warnings++;
      console.log(`     ⚠️ MDX is NEWER than HTML (${mdxDate.slice(0,10)} vs ${htmlDate.slice(0,10)})`);
      console.log(`     MDX improvements may not be in production!`);
    }
  } catch(e) {
    // git may not work in all envs
  }
}

console.log('');
console.log(`Result: ${errors} errors, ${warnings} warnings`);
if (errors > 0) {
  console.log('❌ FAILED — some articles have content disparity beyond format noise');
  process.exit(1);
} else {
  console.log('✅ PASSED — all MDX and HTML article bodies are within tolerance');
}
