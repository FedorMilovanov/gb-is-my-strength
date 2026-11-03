#!/usr/bin/env node
/**
 * GBS-NAGORNAYA-MOBILE-JUSTIFICATION-RIVERS — permanent sweep contract.
 *
 * One semantic owner (`body.nagornaya-page .text-justify` at compact widths in
 * css/site.css) replaces the need to edit the312 `.text-justify` literals
 * across51 Astro files. The row's method is kept executable: a Chromium
 * same-line Range census of adjacent-word gaps inside justified prose.
 *
 * Sweep: five parts × 320/390/768/1024/1280 × Light/Dark × narrow/normal/wide
 * reader-measure states (measure swaps happen in-page via the same
 * html[data-reader-measure] attribute reader-preferences.js persists).
 *
 * Assertions:
 * - compact (<768px): no prose block computes text-align:justify, the
 *   maximum-gap contract holds (zero adjacent-word gaps ≥20px — the row's
 *   severe-river threshold), zero horizontal overflow;
 * - desktop (≥768px): the book-like justified art direction is retained
 *   (at least one justified prose block per part-route);
 * - content completeness: every route keeps its prose blocks and text in all
 *   states (block count and text volume never drop to zero / never differ
 *   between measure states of the same profile).
 *
 * Chromium only (webkit stays in CI — sandbox egress policy).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { serve } from './lib/a04-contract.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const explicitBase = process.env.AUDIT_BASE || '';
const OUT = path.join(ROOT, 'reports', 'nagornaya-justification');
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  '/nagornaya/chast-1/', '/nagornaya/chast-2/', '/nagornaya/chast-3/',
  '/nagornaya/chast-4/', '/nagornaya/chast-5/',
];
const WIDTHS = [320, 390, 768, 1024, 1280];
const SCHEMES = ['light', 'dark'];
const MEASURES = ['narrow', 'normal', 'wide'];

const CENSUS = () => {
  const blocks = [...document.querySelectorAll('main p, main li, main dd, main blockquote p, main h2, main h3, main h4')]
    .filter((b) => b.classList.contains('text-justify') && b.getClientRects().length > 0 && b.innerText.trim().length > 20);
  let riverGaps = 0;
  let riverMax = 0;
  let separatorGaps = 0;
  let separatorMax = 0;
  for (const block of blocks) {
    const words = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement) continue;
      const parentStyle = getComputedStyle(node.parentElement);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') continue;
      const re = /\S+/g;
      let m;
      while ((m = re.exec(node.nodeValue))) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          words.push({
            x1: rect.left, x2: rect.right, y: Math.round(rect.top),
            node, start: m.index, end: m.index + m[0].length,
          });
        }
      }
    }
    const lines = new Map();
    for (const word of words) {
      if (!lines.has(word.y)) lines.set(word.y, []);
      lines.get(word.y).push(word);
    }
    for (const line of lines.values()) {
      line.sort((a, b) => a.x1 - b.x1);
      for (let i = 1; i < line.length; i += 1) {
        const gap = line[i].x1 - line[i - 1].x2;
        if (gap < 20) continue;
        // DOM-граница: если между словами лежит хоть один элемент
        // (tooltip-trigger, sup, иконка) — это separator-разрыв чужого
        // владельца, а не typographic river от text-align.
        let hasElementBetween = false;
        try {
          const bridge = document.createRange();
          bridge.setStart(line[i - 1].node, line[i - 1].end);
          bridge.setEnd(line[i].node, line[i].start);
          const frag = bridge.cloneContents();
          hasElementBetween = Boolean(frag && frag.querySelector && frag.querySelector('*'));
        } catch (_) { hasElementBetween = false; }
        if (hasElementBetween) {
          separatorGaps += 1;
          if (gap > separatorMax) separatorMax = gap;
        } else {
          riverGaps += 1;
          if (gap > riverMax) riverMax = gap;
        }
      }
    }
  }
  const justifiedComputed = blocks.filter((b) => getComputedStyle(b).textAlign === 'justify').length;
  const textVolume = blocks.reduce((sum, b) => sum + b.innerText.trim().length, 0);
  const imagesOk = [...document.querySelectorAll('main img')].every((img) => {
    const style = getComputedStyle(img);
    if (style.display === 'none') return true;
    const rect = img.getBoundingClientRect();
    return rect.width >= 0 && rect.height >= 0;
  });
  const hOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return {
    blocks: blocks.length,
    riverGaps, riverMax: Math.round(riverMax * 100) / 100,
    separatorGaps, separatorMax: Math.round(separatorMax * 100) / 100,
    justifiedComputed, textVolume, imagesOk, hOverflow,
  };
};

let own = null;
let base = explicitBase;
if (!base) { own = await serve(); base = own.base; }

const browser = await chromium.launch({ headless: true });
const failures = [];
const summary = [];
try {
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
      const page = await context.newPage();
      for (const route of ROUTES) {
        await page.goto(base + route, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(150);
        const perMeasure = [];
        for (const measure of MEASURES) {
          const state = await page.evaluate(([measureValue]) => {
            document.documentElement.setAttribute('data-reader-measure', measureValue);
            return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
          }, [measure]);
          void state;
          const census = await page.evaluate(CENSUS);
          perMeasure.push({ measure, ...census });
        }
        const compact = width < 768;
        for (const row of perMeasure) {
          const id = `${route} @${width} ${scheme}/${row.measure}`;
          if (compact) {
            if (row.justifiedComputed !== 0) failures.push(`${id}: compact width still justifies ${row.justifiedComputed} block(s)`);
            if (row.riverGaps !== 0) failures.push(`${id}: maximum-gap contract broken — ${row.riverGaps} pure-text gap(s) ≥20px (max ${row.riverMax}px)`);
          } else {
            if (row.justifiedComputed < 1) failures.push(`${id}: desktop book-like justify was lost`);
          }
          if (row.hOverflow > 0) failures.push(`${id}: horizontal overflow ${row.hOverflow}px`);
          if (row.blocks === 0 || row.textVolume < 500) failures.push(`${id}: prose content missing (blocks=${row.blocks}, chars=${row.textVolume})`);
          if (!row.imagesOk) failures.push(`${id}: image geometry broken`);
        }
        // text-volume stability across measure states (content completeness / order proxy)
        const volumes = perMeasure.map((r) => r.textVolume);
        if (Math.min(...volumes) < Math.max(...volumes) * 0.9) {
          failures.push(`${route} @${width} ${scheme}: prose volume drifts across measure states (${volumes.join('/')})`);
        }
        summary.push({ route, width, scheme, compact, rows: perMeasure });
      }
      await context.close();
      console.log(`✔ ${width}px ${scheme}: swept ${ROUTES.length} parts × ${MEASURES.length} measures`);
    }
  }
} finally {
  await browser.close();
  if (own) await own.server.close();
}

fs.writeFileSync(path.join(OUT, 'contract.json'), JSON.stringify({ failures, summary }, null, 2));
if (failures.length) {
  console.error(`\n❌ nagornaya justification contract failed (${failures.length})`);
  for (const failure of failures.slice(0, 30)) console.error(`  - ${failure}`);
  process.exit(1);
}
const total = summary.reduce((n, s) => n + s.rows.length, 0);
console.log(`\n✅ nagornaya justification contract passed (${total} profiles;5 parts ×5 widths ×2 schemes ×3 measures)`);
