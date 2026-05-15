#!/usr/bin/env node
/**
 * _audit-deep.js — внутренний deep-audit (после patch-v2).
 * Запускается вручную: node scripts/_audit-deep.js
 * Помечен '_' чтобы не светиться в npm scripts.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'fonts'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const all = walk(ROOT);
const html = all.filter(p => p.endsWith('.html'));

console.log('═══════════ DEEP AUDIT ═══════════');

// 1. Типографика: ASCII кавычки в видимом русском тексте
console.log('\n[T1] ASCII " в русском тексте:');
let asciiQ = 0;
const asciiQByFile = {};
for (const f of html) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/<(script|style|svg|code|pre|kbd|noscript)\b[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<[^>]+>/g, ' ');
  const m = s.match(/[а-яА-Я]\s*"\s*[а-яА-Я]/g) || [];
  if (m.length) {
    asciiQByFile[f] = m.length;
    asciiQ += m.length;
  }
}
console.log(`  Всего: ${asciiQ}`);
const top = Object.entries(asciiQByFile).sort((a,b)=>b[1]-a[1]).slice(0,5);
top.forEach(([f, n]) => console.log(`  ${f}: ${n}`));

// 2. Двойной дефис -- (должен быть — или –)
console.log('\n[T2] Двойной дефис -- в русском тексте:');
let dashes = 0;
for (const f of html) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/<(script|style|svg|code|pre|kbd|noscript)\b[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<[^>]+>/g, ' ');
  const m = s.match(/[а-яА-Я]\s*--\s*[а-яА-Я]/g) || [];
  if (m.length) console.log(`  ${f}: ${m.length}`);
  dashes += m.length;
}
console.log(`  Всего: ${dashes}`);

// 3. Дефисы вместо тире после предложения «слово - слово»
console.log('\n[T3] Дефис вместо тире (— или –):');
let hyphenIssues = 0;
const hyphenByFile = {};
for (const f of html) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/<(script|style|svg|code|pre|kbd|noscript)\b[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<[^>]+>/g, ' ');
  // паттерн: слово ПРОБЕЛ - ПРОБЕЛ слово  где слово русское и обе стороны имеют пробел
  const m = s.match(/[а-яё]\s+-\s+[а-яё]/gi) || [];
  if (m.length) hyphenByFile[f] = m.length;
  hyphenIssues += m.length;
}
console.log(`  Всего: ${hyphenIssues}`);
Object.entries(hyphenByFile).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([f,n])=>console.log(`  ${f}: ${n}`));

// 4. Пустые href (href="" или href="#")
console.log('\n[T4] Пустые href / href="#":');
let empty = 0;
for (const f of html) {
  const s = fs.readFileSync(f, 'utf8');
  const m1 = s.match(/href=["']\s*["']/g) || [];
  const m2 = s.match(/href=["']#["']/g) || [];
  if (m1.length || m2.length) console.log(`  ${f}: empty=${m1.length}, "#"=${m2.length}`);
  empty += m1.length + m2.length;
}
console.log(`  Всего: ${empty}`);

// 5. Изображения без width/height (CLS-риск)
console.log('\n[T5] <img> без width/height (контентные, не yandex-pixel):');
let noDim = 0;
const noDimByFile = {};
for (const f of html) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (tag.includes('mc.yandex.ru')) continue;
    if (tag.includes('width=') && tag.includes('height=')) continue;
    noDimByFile[f] = (noDimByFile[f] || 0) + 1;
    noDim++;
  }
}
console.log(`  Всего: ${noDim}`);
Object.entries(noDimByFile).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([f,n])=>console.log(`  ${f}: ${n}`));

// 6. <a> с одинаковым текстом но разными href (anchor text confusion)
console.log('\n[T6] Дубликаты якорного текста с разными href:');
let dupAnchors = 0;
for (const f of html) {
  const s = fs.readFileSync(f, 'utf8');
  const linkMap = new Map();
  for (const m of s.matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,150}?)<\/a>/g)) {
    const href = m[1];
    let text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length < 10 || text.length > 80) continue;
    if (!linkMap.has(text)) linkMap.set(text, new Set());
    linkMap.get(text).add(href);
  }
  for (const [text, hrefs] of linkMap) {
    if (hrefs.size > 1) {
      dupAnchors++;
    }
  }
}
console.log(`  Файлов с дублями якорного текста: ${dupAnchors}`);

// 7. CSS-аудит: дубликаты селекторов в site.css (быстрая эвристика)
console.log('\n[T7] CSS site.css — дубликаты селекторов (>3 одинаковых):');
const css = fs.readFileSync(path.join(ROOT, 'css/site.css'), 'utf8');
const selRe = /^([.#][\w\-]+(?:[.#:][\w\-]+)*)\s*\{/gm;
const counts = {};
let m;
while ((m = selRe.exec(css)) !== null) {
  counts[m[1]] = (counts[m[1]] || 0) + 1;
}
const dupes = Object.entries(counts).filter(([_,c]) => c > 3).sort((a,b)=>b[1]-a[1]);
console.log(`  Селекторов с >3 определениями: ${dupes.length}`);
dupes.slice(0, 8).forEach(([s,c])=>console.log(`  ${s}: ×${c}`));

// 8. JSON-LD: дубликаты @id внутри @graph
console.log('\n[T8] JSON-LD — дубликаты @id в одном файле:');
let dupIds = 0;
for (const f of html) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const ids = [];
    function visit(n) {
      if (!n || typeof n !== 'object') return;
      if (n['@id']) ids.push(n['@id']);
      for (const k of Object.keys(n)) visit(n[k]);
    }
    visit(data);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dups.length) {
      console.log(`  ${f}: ${[...new Set(dups)]}`);
      dupIds++;
    }
  }
}
console.log(`  Файлов: ${dupIds}`);

// 9. Метатеги robots: должны быть везде
console.log('\n[T9] meta robots на каждой странице:');
let noRobots = [];
for (const f of html) {
  if (/google7e02|yandex_/.test(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  if (!/<meta\s+name=["']robots["']/i.test(s)) noRobots.push(f);
}
console.log(`  Файлов без meta robots: ${noRobots.length}`);
noRobots.forEach(f => console.log('  ' + f));

// 10. <picture> usage — насколько это распространено
console.log('\n[T10] <picture> с AVIF/WebP source:');
let pictureCount = 0;
let avifSourceCount = 0;
let webpSourceCount = 0;
for (const f of html) {
  const s = fs.readFileSync(f, 'utf8');
  pictureCount += (s.match(/<picture\b/g) || []).length;
  avifSourceCount += (s.match(/type=["']image\/avif["']/g) || []).length;
  webpSourceCount += (s.match(/type=["']image\/webp["']/g) || []).length;
}
console.log(`  <picture>: ${pictureCount}, source[type=avif]: ${avifSourceCount}, source[type=webp]: ${webpSourceCount}`);
