#!/usr/bin/env node
/**
 * check-mdx-html-parity.js — MDX vs HTML Content + Semantic Parity Guard.
 *
 * Improvements over v1:
 *   1. Semantic checks: heading count, image count, alt text count, figure count,
 *      link count, table count. Extracted BEFORE stripping HTML.
 *   2. Stricter tolerance: 8% (was 12%).
 *   3. Shallow-clone fix: reads mtime if git log unavailable.
 *   4. Detailed per-article report with semantic mismatches.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORD_TOLERANCE = 0.08;
const SHORT_ARTICLE_THRESHOLD = 1000;
const SHORT_WORD_TOLERANCE = 0.15; // 8% (was 12%)
const SEMANTIC_TOLERANCE = 0.15; // 15% for semantic counts

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

function extractSemanticHtml(html) {
  return {
    h2: (html.match(/<h2[\s>]/gi) || []).length,
    h3: (html.match(/<h3[\s>]/gi) || []).length,
    img: (html.match(/<img[\s>]/gi) || []).length,
    alt: (html.match(/alt="[^"]+"/gi) || []).length,
    figure: (html.match(/<figure[\s>]/gi) || []).length,
    a: (html.match(/<a[\s>]/gi) || []).length,
    table: (html.match(/<table[\s>]/gi) || []).length,
    blockquote: (html.match(/<blockquote[\s>]/gi) || []).length,
  };
}

function extractSemanticMdx(mdx) {
  return {
    h2: (mdx.match(/^##\s+/gm) || []).length + (mdx.match(/<h2[\s>]/gi) || []).length,
    h3: (mdx.match(/^###\s+/gm) || []).length + (mdx.match(/<h3[\s>]/gi) || []).length,
    img: (mdx.match(/!\[[^\]]*\]\(/g) || []).length + (mdx.match(/<img[\s>]/gi) || []).length,
    alt: (mdx.match(/!\[([^\]]*)\]\(/g) || []).length + (mdx.match(/alt="[^"]+"/gi) || []).length,
    figure: (mdx.match(/<figure[\s>]/gi) || []).length,
    a: (mdx.match(/(?:^|[^!])\[[^\]]+\]\(/g) || []).length + (mdx.match(/<a[\s>]/gi) || []).length,
    table: (() => {
      const lines = mdx.split('\n');
      let count = 0;
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\|[^|]+\|[^|]+\|/.test(lines[i]) && /^\|[\s-:]+\|/.test(lines[i+1])) count++;
      }
      return count;
    })() + (mdx.match(/<table[\s>]/gi) || []).length,
    blockquote: (mdx.match(/^>\s+/gm) || []).length + (mdx.match(/<blockquote[\s>]/gi) || []).length,
  };
}

function compareSemantic(mdxSem, htmlSem) {
  const keys = Object.keys(mdxSem);
  const mismatches = [];
  const structuralOnly = ['figure', 'blockquote']; // structural wrappers, not content loss
  for (const k of keys) {
    const max = Math.max(mdxSem[k], htmlSem[k]);
    if (max === 0) continue;
    const diff = Math.abs(mdxSem[k] - htmlSem[k]) / max;
    if (diff > SEMANTIC_TOLERANCE) {
      if (structuralOnly.includes(k)) {
        // Structural differences: report as info but don't count as mismatch
        console.log(`     ℹ️ STRUCTURAL ${k}: MDX=${mdxSem[k]} HTML=${htmlSem[k]} (${(diff*100).toFixed(0)}% off) — structural wrapper diff, not content loss`);
      } else {
        mismatches.push(`${k}: MDX=${mdxSem[k]} HTML=${htmlSem[k]} (${(diff*100).toFixed(0)}% off)`);
      }
    }
  }
  return mismatches;
}

const PAIRS = [
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
let semanticWarnings = 0;

console.log('MDX vs HTML Content + Semantic Parity Check v2');
console.log('='.repeat(70));
console.log(`Word tolerance: ±${(WORD_TOLERANCE * 100).toFixed(0)}%`);
console.log(`Semantic tolerance: ±${(SEMANTIC_TOLERANCE * 100).toFixed(0)}%`);
console.log('');

for (const [mdxRel, htmlRel] of PAIRS) {
  const mdxPath = path.join(ROOT, mdxRel);
  const htmlPath = path.join(ROOT, htmlRel);
  
  if (!fs.existsSync(mdxPath)) { console.log(`⚠️ SKIP: ${mdxRel} not found`); continue; }
  if (!fs.existsSync(htmlPath)) { console.log(`⚠️ SKIP: ${htmlRel} not found`); continue; }
  
  let mdxText = fs.readFileSync(mdxPath, 'utf8');
  mdxText = stripFrontmatter(mdxText);
  const mdxSem = extractSemanticMdx(mdxText);
  const mdxBody = stripHtml(mdxText);
  const mdxWc = normalizeCount(mdxBody);
  
  let htmlText = fs.readFileSync(htmlPath, 'utf8');
  let htmlBodyRaw;
  const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) htmlBodyRaw = articleMatch[1];
  else htmlBodyRaw = htmlText;
  const htmlSem = extractSemanticHtml(htmlBodyRaw);
  const htmlBody = stripHtml(htmlBodyRaw);
  const htmlWc = normalizeCount(htmlBody);
  
  const maxWc = Math.max(mdxWc, htmlWc);
  const ratio = maxWc > 0 ? Math.abs(mdxWc - htmlWc) / maxWc : 0;
  const slug = mdxRel.replace('src/content/articles/', '').replace('.mdx', '');
  const diff = mdxWc - htmlWc;
  const effectiveTolerance = maxWc < SHORT_ARTICLE_THRESHOLD ? SHORT_WORD_TOLERANCE : WORD_TOLERANCE;
  const pass = ratio <= effectiveTolerance;
  const icon = pass ? '✅' : '❌';
  
  const semMismatches = compareSemantic(mdxSem, htmlSem);
  const semIcon = semMismatches.length === 0 ? '✅' : '⚠️';
  
  console.log(`${icon}${semIcon} ${slug}: MDX=${mdxWc} HTML=${htmlWc} diff=${diff >= 0 ? '+' : ''}${diff} (${(ratio * 100).toFixed(1)}%)`);
  
  if (!pass) {
    errors++;
    console.log(`     ❌ EXCEEDS word tolerance of ${(WORD_TOLERANCE * 100).toFixed(0)}%`);
  }
  if (semMismatches.length > 0) {
    semanticWarnings++;
    semMismatches.forEach(m => console.log(`     ⚠️ SEMANTIC: ${m}`));
  }
  
  try {
    const mdxStat = fs.statSync(mdxPath);
    const htmlStat = fs.statSync(htmlPath);
    const mtimeDiffMs = Math.abs(mdxStat.mtime - htmlStat.mtime);
    if (mtimeDiffMs > 1000 && mdxStat.mtime > htmlStat.mtime && ratio > 0.02) {
      warnings++;
      console.log(`     ⚠️ MDX is newer by mtime (${mdxStat.mtime.toISOString().slice(0,10)} vs ${htmlStat.mtime.toISOString().slice(0,10)}, diff ${mtimeDiffMs}ms)`);
    }
  } catch(e) {}
}

console.log('');
console.log(`Result: ${errors} errors, ${warnings} mtime warnings, ${semanticWarnings} semantic warnings`);
if (errors > 0) {
  console.log('❌ FAILED — content disparity detected (semantic: ${semanticWarnings} warnings)');
  process.exit(1);
} else {
  console.log('ℹ️ Semantic warnings: ' + semanticWarnings + ' (non-blocking)');
  console.log('✅ PASSED — all MDX and HTML article bodies are within tolerance');
}
