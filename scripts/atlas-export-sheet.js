#!/usr/bin/env node
/**
 * atlas-export-sheet.js — production export pipeline листа Атласа.
 *
 * Берёт УЖЕ собранный audit/atlas-preview/sheet-<slug>.html (см.
 * atlas-build-sheet.js), поднимает его в headless-браузере, вырезает
 * только #sheet-svg (читалка навешивает свой UI — вкладку карт, кнопки
 * home/fullscreen, статус-строку — рядом с svg, а не внутрь него, поэтому
 * serializeToString(#sheet-svg) их не содержит) и пишет:
 *   images/atlas-export/<slug>.svg          — editable/web SVG (viewBox 0)
 *   images/atlas-export/<slug>-preview.png  — 1536×960 (16:10)
 *   images/atlas-export/<slug>-hires.png    — 6144×3840 (16:10, ×4)
 *
 * Гейтит сам себя: падает, если в сериализованном SVG обнаружены классы
 * читалки (.spine/.dive-btn/.home-btn/.g9/.dossier/.place-card), дубли id,
 * NaN/Infinity в атрибутах или zoom-классы (z2/z3/z4/zoomed) — экспорт
 * обязан быть в базовом (незумленном) состоянии листа.
 *
 * Запуск: node scripts/atlas-export-sheet.js [slug ...]  (по умолчанию — все)
 * Требует поднятый http://localhost:8090 (audit/atlas-preview) и
 * playwright-core + Chromium (см. PW_CORE/PW_CHROMIUM ниже).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTDIR = path.join(ROOT, 'images', 'atlas-export');
const PW_CORE = process.env.PW_CORE || '/tmp/claude-0/-home-user/d356c92e-ba9c-5386-aecc-b168f622c1f7/scratchpad/node_modules/playwright-core';
const PW_CHROMIUM = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const BASE_URL = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';

const UI_CLASSES = ['.spine', '.dive-btn', '.home-btn', '.g9', '.dossier', '.place-card', '.stage-strip'];
const FORBIDDEN_CLASSES = ['zoomed', 'z2', 'z3', 'z4'];

const args = process.argv.slice(2);
const slugs = args.length ? args :
  fs.readdirSync(path.join(ROOT, 'karty')).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(ROOT, 'karty', d, 'route.json'))).sort();

(async () => {
  const { chromium } = require(PW_CORE);
  fs.mkdirSync(OUTDIR, { recursive: true });
  const br = await chromium.launch({ executablePath: PW_CHROMIUM, args: ['--no-sandbox'] });
  let failed = 0;

  for (const slug of slugs) {
    const url = `${BASE_URL}/audit/atlas-preview/sheet-${slug}.html`;
    const pg = await br.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
    try {
      await pg.goto(url, { waitUntil: 'networkidle' });
      await pg.waitForTimeout(300);

      const check = await pg.evaluate(({ uiSelectors, forbiddenClasses }) => {
        const svg = document.getElementById('sheet-svg');
        if (!svg) return { ok: false, issues: ['#sheet-svg не найден'] };
        const issues = [];
        const cls = (svg.getAttribute('class') || '').split(/\s+/);
        forbiddenClasses.forEach((c) => { if (cls.includes(c)) issues.push(`незумленный экспорт содержит класс "${c}"`); });
        uiSelectors.forEach((sel) => { if (svg.querySelector(sel)) issues.push(`UI-элемент читалки ${sel} внутри #sheet-svg`); });
        const ids = {};
        svg.querySelectorAll('[id]').forEach((el) => { ids[el.id] = (ids[el.id] || 0) + 1; });
        Object.entries(ids).filter(([, n]) => n > 1).forEach(([id, n]) => issues.push(`дубль id "${id}" ×${n}`));
        const bad = [...svg.querySelectorAll('*')].filter((el) =>
          ['d', 'x', 'y', 'cx', 'cy', 'r', 'transform', 'viewBox'].some((a) => /NaN|Infinity/.test(el.getAttribute(a) || '')));
        if (bad.length) issues.push(`NaN/Infinity в атрибутах: ${bad.length} элементов`);
        const vb = (svg.getAttribute('data-vb') || svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        return { ok: issues.length === 0, issues, vb, outerHTML: svg.outerHTML };
      }, { uiSelectors: UI_CLASSES, forbiddenClasses: FORBIDDEN_CLASSES });

      if (!check.ok) {
        console.error(`[export] ${slug} FAILED:`);
        check.issues.forEach((i) => console.error(`   - ${i}`));
        failed++;
        continue;
      }

      // editable/web SVG — как сериализовано (viewBox уже базовый, т.к. страница
      // только что загружена и ни один zoom-класс не тронут — см. проверку выше)
      const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>\n${check.outerHTML}\n`;
      fs.writeFileSync(path.join(OUTDIR, `${slug}.svg`), svgDoc);

      // Лист сам по себе 3:2 (1800×1200), а требуемый формат экспорта — 16:10.
      // Растягивать SVG нельзя (исказит карту) — вписываем "meet" в канвас
      // целевых пропорций (letterbox тем же пергаментным фоном листа).
      const renderCanvas = async (page, w, h, outPath) => {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(({ width, height }) => {
          const svg = document.getElementById('sheet-svg');
          const bg = getComputedStyle(document.querySelector('svg.sheet') || svg).backgroundColor;
          document.body.innerHTML = '';
          document.body.style.margin = '0';
          document.documentElement.style.background = '#f5edd8';
          document.body.style.background = '#f5edd8';
          const wrap = document.createElement('div');
          wrap.style.cssText = `width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;background:#f5edd8`;
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          svg.style.width = '100%';
          svg.style.height = '100%';
          svg.style.display = 'block';
          wrap.appendChild(svg);
          document.body.appendChild(wrap);
        }, { width: w, height: h });
        await page.waitForTimeout(150);
        await page.screenshot({ path: outPath });
      };

      const previewPath = path.join(OUTDIR, `${slug}-preview.png`);
      await renderCanvas(pg, 1536, 960, previewPath);

      const pgHi = await br.newPage({ viewport: { width: 6144, height: 3840 } });
      await pgHi.goto(url, { waitUntil: 'networkidle' });
      await pgHi.waitForTimeout(300);
      const hiresPath = path.join(OUTDIR, `${slug}-hires.png`);
      await renderCanvas(pgHi, 6144, 3840, hiresPath);
      await pgHi.close();

      const prevSize = fs.statSync(previewPath).size;
      const hiSize = fs.statSync(hiresPath).size;
      console.log(`[export] ${slug}: ${slug}.svg (${(svgDoc.length / 1024).toFixed(0)}КБ), preview.png (${(prevSize / 1024).toFixed(0)}КБ), hires.png (${(hiSize / 1024 / 1024).toFixed(1)}МБ)`);
    } catch (e) {
      console.error(`[export] ${slug} FAILED: ${e.message}`);
      failed++;
    } finally {
      await pg.close();
    }
  }

  await br.close();
  if (failed) {
    console.error(`\n❌ EXPORT: ${failed} карт(ы) с ошибками`);
    process.exit(1);
  }
  console.log(`\n✅ EXPORT: ${slugs.length} карт(ы) экспортированы в ${path.relative(ROOT, OUTDIR)}/`);
})();
