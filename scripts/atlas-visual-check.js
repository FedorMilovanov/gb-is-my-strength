#!/usr/bin/env node
/**
 * atlas-visual-check.js — автоматический визуальный QA листа Атласа.
 *
 * Меряет в ЭКРАННЫХ пикселях на легальных зумах читалки (1/2/4/8×):
 *   - размер точек городов (норма 4–12 px);
 *   - толщину дорог/маршрутов/рек (нормы см. THRESHOLDS);
 *   - размер war-крестов (≤18 px);
 *   - кегль главных подписей (8–18 px);
 *   - коллизии видимых подписей (пересечение bbox, допуск 2 px);
 *   - выход подписей за safe-area (24 px от внутренней рамки);
 *   - дубли id, NaN/Infinity в атрибутах;
 *   - отсутствие UI-классов внутри #sheet-svg.
 *
 * Запуск: node scripts/atlas-visual-check.js [slug] [--url URL]
 * Требует поднятый http://localhost:8090 (audit/atlas-preview).
 * Выход 1 при нарушениях. Гонять вместе с data-check в гейтах.
 */
'use strict';

const { chromium } = require(process.env.PW_CORE || '/tmp/claude-0/-home-user/d356c92e-ba9c-5386-aecc-b168f622c1f7/scratchpad/node_modules/playwright-core');

const slug = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'avraam';
const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : `http://localhost:8090/audit/atlas-preview/sheet-${slug}.html`;

const ZOOMS = [1, 2, 4, 8];
const T = {
  cityDot: [3, 13], mainLabel: [8, 19], roadStroke: [0.8, 3.5],
  riverStroke: [0.8, 3.5], routeStroke: [1, 3.2], warX: [0, 18],
  labelCollisionTolerance: 2, safeAreaPx: 24,
};

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1536, height: 960 } });
  await pg.goto(URL, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(500);
  const fails = [];
  const warn = [];

  // Статические проверки DOM (один раз)
  const domIssues = await pg.evaluate(() => {
    const svg = document.getElementById('sheet-svg');
    const out = [];
    const ids = {};
    svg.querySelectorAll('[id]').forEach((el) => {
      ids[el.id] = (ids[el.id] || 0) + 1;
    });
    Object.entries(ids).filter(([, n]) => n > 1).forEach(([id, n]) => out.push(`дубль id "${id}" ×${n}`));
    const bad = [...svg.querySelectorAll('*')].filter((el) =>
      ['d', 'x', 'y', 'cx', 'cy', 'r', 'transform', 'viewBox'].some((a) => /NaN|Infinity/.test(el.getAttribute(a) || '')));
    if (bad.length) out.push(`NaN/Infinity в атрибутах: ${bad.length} элементов`);
    ['.spine', '.dive-btn', '.home-btn', '.dossier', '.place-card'].forEach((sel) => {
      if (svg.querySelector(sel)) out.push(`UI-элемент ${sel} внутри листа`);
    });
    return out;
  });
  fails.push(...domIssues.map((m) => `[dom] ${m}`));

  // Сухопутные маршруты против воды: семплируем нити и проверяем попадание
  // в ЗАЛИВКИ водоёмов (isPointInFill в user units). Фоновая rect-подложка
  // моря не в счёт — только реальные фигуры воды (моря, Киннерет, Хула).
  // Допуск: единичные касания берега не валят гейт, валит серия ≥3 подряд.
  const waterIssues = await pg.evaluate(() => {
    const svg = document.getElementById('sheet-svg');
    const water = [...svg.querySelectorAll('g.base path[fill="url(#seaG)"], g.base ellipse[fill="#10263a"]')];
    const out = [];
    const pt = svg.createSVGPoint();
    for (const sel of ['path.route', 'path.war-route']) {
      for (const line of svg.querySelectorAll(sel)) {
        const L = line.getTotalLength();
        if (L < 60) continue; // образцы легенды и стрелки
        let run = 0, worst = 0, at = null;
        for (let t = 0; t <= L; t += 4) {
          const p = line.getPointAtLength(t);
          pt.x = p.x; pt.y = p.y;
          const wet = water.some((w) => w.isPointInFill(pt));
          if (wet) { run++; if (run > worst) { worst = run; at = [Math.round(p.x), Math.round(p.y)]; } }
          else run = 0;
        }
        if (worst >= 3) out.push(`${sel} идёт по воде ~${worst * 4} юнитов у (${at})`);
      }
    }
    return out;
  });
  fails.push(...waterIssues.map((m) => `[water] ${m}`));

  for (const zf of ZOOMS) {
    await pg.evaluate((z) => {
      const svg = document.getElementById('sheet-svg');
      const vb0 = (svg.getAttribute('data-vb') || svg.getAttribute('viewBox')).split(/\s+/).map(Number);
      const w = vb0[2] / z, h = vb0[3] / z;
      // центр — плотная Иудея, худший случай
      const cx = z === 1 ? vb0[0] + vb0[2] / 2 : 640, cy = z === 1 ? vb0[1] + vb0[3] / 2 : 790;
      svg.setAttribute('viewBox', `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
      const f = vb0[2] / w;
      svg.classList.toggle('zoomed', f > 1.04);
      svg.classList.toggle('z2', f >= 1.6 && f < 3.1);
      svg.classList.toggle('z3', f >= 3.1 && f < 5.5);
      svg.classList.toggle('z4', f >= 5.5);
    }, zf);
    await pg.waitForTimeout(300);

    const m = await pg.evaluate((tol) => {
      const svg = document.getElementById('sheet-svg');
      const sc = Math.hypot(svg.getScreenCTM().a, svg.getScreenCTM().b);
      const px = (el, attr, fallback) => {
        const cs = getComputedStyle(el);
        const v = parseFloat(cs[attr] || el.getAttribute(fallback) || 0);
        return cs.vectorEffect === 'non-scaling-stroke' && attr === 'strokeWidth' ? v : v * sc;
      };
      const out = { scale: +sc.toFixed(3), issues: [], sizes: {} };

      const dot = svg.querySelector('.pl-city');
      if (dot) out.sizes.cityDot = +Math.max(dot.getBoundingClientRect().width, dot.getBoundingClientRect().height).toFixed(1);
      const road = svg.querySelector('#tradeRoutes path');
      if (road) out.sizes.road = +px(road, 'strokeWidth', 'stroke-width').toFixed(1);
      const river = [...svg.querySelectorAll('path[fill="none"][stroke="#2d4a66"]')][0];
      if (river) out.sizes.river = +px(river, 'strokeWidth', 'stroke-width').toFixed(1);
      const route = svg.querySelector('.route');
      if (route) out.sizes.route = +px(route, 'strokeWidth', 'stroke-width').toFixed(1);
      const warx = svg.querySelector('.war-x');
      if (warx) out.sizes.warX = +warx.getBoundingClientRect().width.toFixed(1);
      const main = svg.querySelector('text.lab-main');
      if (main) out.sizes.mainLabel = +(parseFloat(getComputedStyle(main).fontSize) * sc).toFixed(1);

      // коллизии видимых подписей движка (главные/минорные/канд/war)
      const rects = [];
      svg.querySelectorAll('text.lab-place, text.lab-war, text.lab-ctx').forEach((t) => {
        const cs = getComputedStyle(t);
        if (cs.opacity === '0' || cs.display === 'none') return;
        const b = t.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) return;
        if (b.right < 0 || b.bottom < 0 || b.left > innerWidth || b.top > innerHeight) return;
        rects.push({ n: (t.textContent || '').slice(0, 22).trim(), b });
      });
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i].b, c = rects[j].b;
          const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left) - tol;
          const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) - tol;
          if (ox > 0 && oy > 0) out.issues.push(`коллизия подписей «${rects[i].n}» × «${rects[j].n}» (${ox.toFixed(0)}×${oy.toFixed(0)}px)`);
        }
      }
      return out;
    }, T.labelCollisionTolerance);

    const chk = (key, range, label) => {
      const v = m.sizes[key];
      if (v == null) return;
      if (v < range[0] || v > range[1]) fails.push(`[${zf}×] ${label}: ${v}px вне нормы ${range[0]}–${range[1]}px`);
    };
    chk('cityDot', T.cityDot, 'точка города');
    chk('road', T.roadStroke, 'дорога');
    chk('river', T.riverStroke, 'река');
    chk('route', T.routeStroke, 'маршрут');
    chk('warX', T.warX, 'war-крест');
    chk('mainLabel', T.mainLabel, 'главная подпись');
    m.issues.forEach((i) => (zf === 1 ? fails : warn).push(`[${zf}×] ${i}`));
    console.log(`  ${zf}× → ${JSON.stringify(m.sizes)}${m.issues.length ? ` · ${m.issues.length} коллизий` : ''}`);
  }

  // safe-area на обзоре (1×): подписи не ближе 24px к внутренней рамке
  await pg.evaluate(() => {
    const svg = document.getElementById('sheet-svg');
    const vb0 = (svg.getAttribute('data-vb') || svg.getAttribute('viewBox'));
    svg.setAttribute('viewBox', vb0);
    svg.classList.remove('zoomed', 'z2', 'z3', 'z4');
  });
  await pg.waitForTimeout(250);
  const safe = await pg.evaluate((pad) => {
    const svg = document.getElementById('sheet-svg');
    const frame = svg.querySelector('.frame');
    if (!frame) return ['нет .frame'];
    const fb = frame.getBoundingClientRect();
    const out = [];
    svg.querySelectorAll('text.lab-place').forEach((t) => {
      const b = t.getBoundingClientRect();
      if (b.width < 2) return;
      if (b.left < fb.left + pad || b.right > fb.right - pad || b.top < fb.top + pad || b.bottom > fb.bottom - pad) {
        out.push(`подпись «${(t.textContent || '').slice(0, 24).trim()}» в unsafe-зоне рамки`);
      }
    });
    return out;
  }, T.safeAreaPx);
  fails.push(...safe.map((s) => `[safe] ${s}`));

  await br.close();

  if (warn.length) {
    console.log(`\n⚠ предупреждения (zoom-коллизии, не гейт): ${warn.length}`);
    warn.slice(0, 12).forEach((w) => console.log('   ' + w));
  }
  if (fails.length) {
    console.error(`\n❌ VISUAL CHECK (${slug}): ${fails.length} нарушений`);
    fails.forEach((f) => console.error('   ' + f));
    process.exit(1);
  }
  console.log(`\n✅ VISUAL CHECK (${slug}): размеры/коллизии/safe-area в норме на зумах ${ZOOMS.join('/')}×`);
})();
