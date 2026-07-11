/**
 * sheet-engine.js — движок светлого витринного листа Атласа (§13-бис контракта).
 *
 * ЕДИНСТВЕННОЕ место, где живёт рендер листа: карта = данные (route.json) + конфиг.
 * Никакого кода в картах; никаких монолитов на страницу (урок прод-Авраама).
 *
 * API:
 *   renderSheet(route, opts)  → { svg, stageStripHtml, meta }
 *   buildSheetHtml(route, opts) → полный самодостаточный HTML листа
 *   sheetCss()                → CSS листа (для встраивания в другие страницы)
 *
 * opts: { family: 'levant'|'mediterranean', baseSvg: строка-исходник базы,
 *         slug, badge?: строка бейджа (по умолчанию awaiting G9) }
 *
 * Визуальный язык: референсы владельца — светлый пергамент, мягкие моря,
 * атласные глифы, засечковые подписи с гало, терракотовый маршрут с вехами,
 * компас/линейка/картуш. Тёмный движок v0.5x — только донор данных (§13-бис).
 */
'use strict';

const KM_PER_UNIT = { levant: 0.92, mediterranean: 1.354, urheimat: 0.854 };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const STAGE_TINT = ['#8a6a1f', '#a25d33', '#4a7a52', '#8f4a56', '#6b5a43', '#3f6a8a', '#7a5a8a', '#4a6a6a'];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const GEO_DEFS = `<defs>
  <linearGradient id="landG" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f0e7cf"/><stop offset=".45" stop-color="#e8dcbc"/><stop offset="1" stop-color="#dfd1a9"/>
  </linearGradient>
  <linearGradient id="richLandG" x1="0" y1="0" x2=".5" y2="1">
    <stop offset="0" stop-color="#ece1c2"/><stop offset=".5" stop-color="#e5d8b4"/><stop offset="1" stop-color="#decfa6"/>
  </linearGradient>
  <linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#cfe0e9"/><stop offset="1" stop-color="#b4cedd"/>
  </linearGradient>
  <pattern id="seaPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M0,10 Q5,6 10,10 Q15,14 20,10" fill="none" stroke="#7fa7c4" stroke-width=".6" opacity=".38"/>
    <path d="M0,20 Q5,16 10,20 Q15,24 20,20" fill="none" stroke="#7fa7c4" stroke-width=".5" opacity=".26"/>
  </pattern>
  <radialGradient id="fertileG" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#6b8f4a" stop-opacity=".26"/><stop offset="1" stop-color="#6b8f4a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="jordanG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4f7a3f" stop-opacity=".3"/><stop offset="1" stop-color="#4f7a3f" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="desertG" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#c09a55" stop-opacity=".2"/><stop offset="1" stop-color="#c09a55" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="negevG" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#b08050" stop-opacity=".16"/><stop offset="1" stop-color="#b08050" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="sinaiG" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#a07040" stop-opacity=".18"/><stop offset="1" stop-color="#a07040" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="mtG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8b7d5a" stop-opacity=".4"/><stop offset="1" stop-color="#8b7d5a" stop-opacity="0"/>
  </linearGradient>
  <pattern id="mountainHatch" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="#8b7d5a" stroke-width=".6" opacity=".45"/>
  </pattern>
  <pattern id="desertStipple" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r=".7" fill="#9c7c43" opacity=".4"/>
    <circle cx="9" cy="9" r=".5" fill="#9c7c43" opacity=".3"/>
    <circle cx="6" cy="1" r=".4" fill="#b08050" opacity=".25"/>
  </pattern>
  <filter id="waterRipple" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".8"/></filter>
  <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="dotShadow" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy=".7" stdDeviation=".8" flood-color="#3a2c10" flood-opacity=".45"/>
  </filter>
  <radialGradient id="sunGlow" cx=".22" cy=".14" r=".9">
    <stop offset="0" stop-color="#ffdf9a" stop-opacity=".22"/>
    <stop offset=".4" stop-color="#f5d489" stop-opacity=".08"/>
    <stop offset="1" stop-color="#f5d489" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="edgeFog" cx=".5" cy=".5" r=".72">
    <stop offset="0" stop-color="#7a5c26" stop-opacity="0"/>
    <stop offset=".8" stop-color="#7a5c26" stop-opacity="0"/>
    <stop offset="1" stop-color="#6b4f1e" stop-opacity=".18"/>
  </radialGradient>
  <filter id="parchmentGrain">
    <feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 .45  0 0 0 0 .36  0 0 0 0 .2  0 0 0 .05 0"/>
  </filter>
</defs>`;

// Рельефный слой листа (поверх базы, только на листе — SYSTEM-файл не трогаем).
// Свет с северо-запада: хребет = штриховой гребень + мягкая тень на юго-восток.
const RELIEF = {
  levant: `
  <g class="relief" aria-hidden="true">
    <ellipse cx="668" cy="520" rx="16" ry="86" fill="url(#mtG)" transform="rotate(14 668 520)"/>
    <ellipse cx="704" cy="530" rx="12" ry="72" fill="url(#mountainHatch)" transform="rotate(16 704 530)"/>
    <ellipse cx="676" cy="524" rx="15" ry="82" fill="url(#mountainHatch)" transform="rotate(14 676 524)" opacity=".7"/>
    <ellipse cx="628" cy="770" rx="13" ry="92" fill="url(#mountainHatch)" transform="rotate(8 628 770)" opacity=".8"/>
    <ellipse cx="638" cy="778" rx="9" ry="88" fill="url(#mtG)" transform="rotate(8 638 778)" opacity=".55"/>
    <ellipse cx="640" cy="620" rx="12" ry="40" fill="url(#mountainHatch)" transform="rotate(12 640 620)" opacity=".7"/>
    <ellipse cx="608" cy="688" rx="7" ry="26" fill="url(#mountainHatch)" transform="rotate(-38 608 688)" opacity=".8"/>
    <ellipse cx="690" cy="760" rx="11" ry="70" fill="url(#mountainHatch)" transform="rotate(4 690 760)" opacity=".65"/>
    <ellipse cx="700" cy="900" rx="12" ry="80" fill="url(#mountainHatch)" transform="rotate(2 700 900)" opacity=".6"/>
    <ellipse cx="648" cy="820" rx="14" ry="46" fill="url(#negevG)" transform="rotate(6 648 820)"/>
  </g>`,
  urheimat: '',
  mediterranean: `
  <g class="relief" aria-hidden="true">
    <ellipse cx="1470" cy="620" rx="150" ry="20" fill="url(#mtG)" transform="rotate(-4 1470 620)" opacity=".5"/>
    <ellipse cx="890" cy="390" rx="22" ry="13" fill="url(#mtG)" opacity=".6"/>
    <ellipse cx="330" cy="300" rx="18" ry="86" fill="url(#mtG)" transform="rotate(24 330 300)" opacity=".5"/>
  </g>`,
};

// Пиктограммы важных мест (place.glyph в данных) — силуэты старого атласа.
// Рисуются НАД точкой (точка = координата), высота ~14 единиц листа.
function glyphSvg(name, x, y, k) {
  const s = k; // масштаб
  const G = {
    ziggurat: `<g class="glyph"><path d="M${x - 7 * s},${y} h${14 * s} v${-3 * s} h${-2.5 * s} v${-3 * s} h${-2.5 * s} v${-3 * s} h${-4 * s} v${3 * s} h${-2.5 * s} v${3 * s} h${-2.5 * s} Z" transform="translate(0,${-4 * s})"/></g>`,
    pyramid: `<g class="glyph"><path d="M${x - 7 * s},${y - 3 * s} L${x},${y - 15 * s} L${x + 7 * s},${y - 3 * s} Z"/><path d="M${x},${y - 15 * s} L${x + 2 * s},${y - 3 * s}" class="glyph-line"/></g>`,
    altar: `<g class="glyph"><path d="M${x - 5 * s},${y - 3 * s} h${10 * s} v${-2.5 * s} h${-1.5 * s} v${-3 * s} h${-7 * s} v${3 * s} h${-1.5 * s} Z"/><path d="M${x},${y - 12 * s} q${1.6 * s},${1.8 * s} 0,${3.4 * s} q${-1.6 * s},${-1.8 * s} 0,${-3.4 * s} Z" class="glyph-flame"/></g>`,
    well: `<g class="glyph"><path d="M${x - 3.8 * s},${y - 3.2 * s} a${3.8 * s},${1.7 * s} 0 1 0 ${7.6 * s},0 a${3.8 * s},${1.7 * s} 0 1 0 ${-7.6 * s},0 Z"/><path class="glyph-line" d="M${x - 3.2 * s},${y - 4.6 * s} a${3.2 * s},${3.6 * s} 0 0 1 ${6.4 * s},0"/></g>`,
    oak: `<g class="glyph"><path class="glyph-line" d="M${x},${y - 2.2 * s} v${-3.6 * s} m0,${1.8 * s} l${-2.4 * s},${-2.4 * s}"/><path d="M${x - 5.4 * s},${y - 5.4 * s} Q${x - 4.8 * s},${y - 10.6 * s} ${x},${y - 11 * s} Q${x + 4.8 * s},${y - 10.6 * s} ${x + 5.4 * s},${y - 5.4 * s} Q${x + 2 * s},${y - 6.6 * s} ${x},${y - 6.2 * s} Q${x - 2 * s},${y - 6.6 * s} ${x - 5.4 * s},${y - 5.4 * s} Z"/></g>`,
    ruin: `<g class="glyph"><path d="M${x - 5.5 * s},${y - 3 * s} v${-6 * s} h${2.6 * s} v${3.4 * s} h${2.2 * s} v${-6.5 * s} h${2.6 * s} v${9.1 * s} Z"/><path d="M${x + 3.4 * s},${y - 12 * s} q${1.4 * s},${-1.8 * s} ${2.8 * s},${-.6 * s}" class="glyph-smoke"/><path d="M${x + 1.8 * s},${y - 10.6 * s} q${1.2 * s},${-1.5 * s} ${2.4 * s},${-.5 * s}" class="glyph-smoke"/></g>`,
    gate: `<g class="glyph"><path d="M${x - 5 * s},${y - 3 * s} v${-6.5 * s} a${5 * s},${4.6 * s} 0 0 1 ${10 * s},0 v${6.5 * s} h${-2.4 * s} v${-5.8 * s} a${2.6 * s},${2.6 * s} 0 0 0 ${-5.2 * s},0 v${5.8 * s} Z"/></g>`,
    palm: `<g class="glyph"><path d="M${x},${y - 3 * s} q${-.6 * s},${-4 * s} ${.4 * s},${-7.6 * s}" class="glyph-line" style="stroke-width:${1.3 * s}"/><path d="M${x + .4 * s},${y - 10.6 * s} q${2.8 * s},${-1.4 * s} ${4.6 * s},${.6 * s} M${x + .4 * s},${y - 10.6 * s} q${-2.8 * s},${-1.4 * s} ${-4.6 * s},${.6 * s} M${x + .4 * s},${y - 10.6 * s} q${2 * s},${-2.6 * s} ${4 * s},${-2.6 * s} M${x + .4 * s},${y - 10.6 * s} q${-2 * s},${-2.6 * s} ${-4 * s},${-2.6 * s}" class="glyph-line"/></g>`,
    tower: `<g class="glyph"><path d="M${x - 3.4 * s},${y - 3 * s} v${-9 * s} h${-1.2 * s} v${-2 * s} h${2.4 * s} v${1 * s} h${1.6 * s} v${-1 * s} h${2.4 * s} v${1 * s} h${1.6 * s} v${-1 * s} h${2.4 * s} v${2 * s} h${-1.2 * s} v${9 * s} Z" transform="translate(${-1.3 * s},0)"/></g>`,
  };
  return G[name] || '';
}

function anchorSpec(a) {
  const A = {
    e: { dx: 1, dy: 0, ta: 'start' }, w: { dx: -1, dy: 0, ta: 'end' },
    n: { dx: 0, dy: -1, ta: 'middle' }, s: { dx: 0, dy: 1, ta: 'middle' },
    ne: { dx: .75, dy: -.7, ta: 'start' }, nw: { dx: -.75, dy: -.7, ta: 'end' },
    se: { dx: .75, dy: .95, ta: 'start' }, sw: { dx: -.75, dy: .95, ta: 'end' },
  };
  return A[a] || A.e;
}

function catmullRom(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function renderSheet(route, opts) {
  const { family, baseSvg, slug } = opts;
  const meta = route.meta || {};
  const places = route.places || [];
  const stages = route.stages || [];

  // Кадр листа: meta.sheet_viewport (своё поле листа) > meta.viewport_init (движковое) > bbox
  const vp = meta.sheet_viewport || meta.viewport_init || (() => {
    const xs = places.map(p => p.x), ys = places.map(p => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return { cx, cy, w: Math.max(Math.max(...xs) - Math.min(...xs) + 260, (Math.max(...ys) - Math.min(...ys) + 200) * 1.5) };
  })();
  const W = vp.w, H = W / 1.5;
  const x0 = vp.cx - W / 2, y0 = vp.cy - H / 2;
  const k = W / 1200;

  let base = String(baseSvg || '').replace(/<svg[^>]*>/, '').replace('</svg>', '');
  if (family === 'levant') {
    // хирургия устья Кишона (файл базы — SYSTEM, правка на потребителе)
    base = base.replace(
      'M613,706 C595,712 575,720 555,728 C535,736 510,738 490,735 C468,730 445,720 420,710',
      'M613,706 C603,712 595,720 588,728');
  } else {
    base = base.replace(/<!--[\s\S]*?-->/g, '');
  }

  // Маршрут героя — только основные станы: кандидаты (cand) и линии спутников
  // (lot и т.п.) в главную нить не входят
  const routePts = places.filter(p => typeof p.stage === 'number' &&
    p.type !== 'region' && p.type !== 'cand' && p.type !== 'lot' && !p.noRoute).map(p => [p.x, p.y]);
  const routePath = catmullRom(routePts);

  const seenStage = new Set(), milestones = [], milestoneIds = new Set();
  for (const p of places) {
    if (typeof p.stage === 'number' && !seenStage.has(p.stage)) {
      seenStage.add(p.stage);
      milestones.push({ x: p.x + (p.mileDx || 0), y: p.y + (p.mileDy || 0), n: p.stage, cand: p.type === 'cand', g: !!p.glyph, fix: p.mileDx != null || p.mileDy != null });
      milestoneIds.add(p.id);
    }
  }

  const dots = [], labels = [], leaders = [], glyphs = [], halos = [];
  // Иерархия кеглей листа: вехи и места с глифами — крупно, остальное — второй кегль
  const fontMain = 13 * k, fontMinor = 11 * k, fontCtx = 11.5 * k;
  for (const p of places) {
    if (p.type === 'region') {
      labels.push(`<text x="${p.x}" y="${p.y}" class="lab-region" font-size="${(12.5 * k).toFixed(2)}" text-anchor="middle">${esc((p.name || '').toUpperCase())}</text>`);
      continue;
    }
    const isMile = milestoneIds.has(p.id);
    const r = (p.type === 'cand' ? 3.7 : 3.5) * k;
    const cls = p.type === 'cand' ? 'pl-cand' : 'pl-city';
    {
      let shape;
      if (p.type === 'mountain') {
        shape = `<path d="M${p.x - r * 1.25},${p.y + r} L${p.x},${p.y - r * 1.3} L${p.x + r * 1.25},${p.y + r} Z" class="${cls}"/>`;
      } else {
        shape = `<circle cx="${p.x}" cy="${p.y}" r="${r.toFixed(2)}" class="${cls}"/>`;
      }
      dots.push(`<g class="pl" data-pid="${esc(p.id)}">${shape}</g>`);
    }
    // Пиктограмма (place.glyph) — контурная, компактная, только уникальный смысл
    if (p.glyph) {
      const g = glyphSvg(p.glyph, p.x + (p.glyphDx || 0), p.y - 3 * k + (p.glyphDy || 0), k * 0.82);
      if (g) glyphs.push(g);
    }

    const fontPlace = (isMile || p.glyph) ? fontMain : fontMinor;
    const a = p.labelAnchor || ((p.side === 'l') ? 'w' : 'e');
    const sp = anchorSpec(a);
    const off = 8.5 * k;
    let lx = p.x + sp.dx * off;
    let ly = p.y + sp.dy * off + fontPlace * 0.34;
    if (sp.dy < 0) ly = p.y - off * 0.9;
    if (sp.dy > 0 && sp.dx === 0) ly = p.y + off + fontPlace * 0.8;
    if (p.leader && typeof p.leader.dx === 'number') {
      const LX = p.leader.dx * 1.6 * k, LY = p.leader.dy * 1.6 * k;
      const tx = lx + LX, ty = ly + LY;
      if (Math.hypot(LX, LY) > 8 * k) {
        const ex = sp.ta === 'end' ? tx + 2 * k : sp.ta === 'middle' ? tx : tx - 2 * k;
        const ey = ty - fontPlace * 0.34;
        const dl = Math.hypot(ex - p.x, ey - p.y) || 1;
        const sx = p.x + (ex - p.x) / dl * (r + 2 * k), sy = p.y + (ey - p.y) / dl * (r + 2 * k);
        leaders.push(`<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="leader"/>`);
      }
      lx = tx; ly = ty;
    }
    labels.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="lab-place${p.type === 'cand' ? ' lab-cand' : ''}" font-size="${fontPlace.toFixed(2)}" text-anchor="${sp.ta}">${esc(p.name)}</text>`);
  }

  const placeXY = places.filter(p => p.type !== 'region');
  const wps = (route.verified_waypoints || []).map(w => {
    const s = 2.3 * k;
    // wp, совпадающий с местом (арх-подтверждение той же точки) — текст вниз,
    // чтобы не бодаться с подписью места
    const near = placeXY.some(p => Math.hypot(p.x - w.x, p.y - w.y) < 8 * k + 4);
    const tx = near ? w.x + 4 * k : w.x + 6 * k;
    const ty = near ? w.y + 14 * k : w.y + 3.6 * k;
    return `<rect x="${(w.x - s).toFixed(1)}" y="${(w.y - s).toFixed(1)}" width="${(s * 2).toFixed(1)}" height="${(s * 2).toFixed(1)}" transform="rotate(45 ${w.x} ${w.y})" class="wp-dot"/>` +
      `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="lab-wp" font-size="${(10 * k).toFixed(2)}">${esc(w.name)}</text>`;
  });
  const ctxs = (route.ctx || []).filter(c => c && typeof c.x === 'number').map(c =>
    `<text x="${c.x}" y="${c.y}" class="lab-ctx" font-size="${fontCtx.toFixed(2)}" text-anchor="middle">${esc((c.name || '').toUpperCase())}</text>`);

  // Минимализм: веха = тонкая римская цифра у точки (без кружков и полей)
  const miles = milestones.map(m =>
    `<g class="mile" data-stage="${m.n}" data-x="${m.x}" data-y="${m.y}">` +
    `<text x="${(m.fix ? m.x : m.x - 6.5 * k).toFixed(1)}" y="${(m.fix ? m.y : m.g ? m.y + 10.5 * k : m.y - 5 * k).toFixed(1)}" text-anchor="${m.fix ? 'middle' : 'end'}" class="mile-t" font-size="${(10 * k).toFixed(2)}" style="fill:${STAGE_TINT[m.n % STAGE_TINT.length]}">${ROMAN[m.n] || m.n + 1}</text></g>`);

  const km100 = 100 / KM_PER_UNIT[family];
  const sbW = km100 * 2;
  const sbX = x0 + W - sbW - 60 * k, sbY = y0 + H - 34 * k;
  const furn = `
  <g class="furn">
    <rect x="${sbX - 14 * k}" y="${sbY - 22 * k}" width="${sbW + 28 * k}" height="${40 * k}" rx="${6 * k}" class="plate"/>
    <rect x="${sbX}" y="${sbY}" width="${km100}" height="${7 * k}" class="sb-d"/>
    <rect x="${sbX + km100}" y="${sbY}" width="${km100}" height="${7 * k}" class="sb-l"/>
    <text x="${sbX}" y="${sbY - 7 * k}" class="sb-t" font-size="${11 * k}">0</text>
    <text x="${sbX + km100}" y="${sbY - 7 * k}" class="sb-t" font-size="${11 * k}" text-anchor="middle">100</text>
    <text x="${sbX + km100 * 2}" y="${sbY - 7 * k}" class="sb-t" font-size="${11 * k}" text-anchor="end">200 км</text>
    <g transform="translate(${x0 + W - 52 * k},${y0 + 56 * k})">
      <circle r="${30 * k}" class="plate"/>
      <path d="M0,${-19 * k} L${6 * k},${11 * k} L0,${5 * k} L${-6 * k},${11 * k} Z" class="north"/>
      <text y="${26 * k}" text-anchor="middle" class="north-t" font-size="${13 * k}">С</text>
    </g>
  </g>`;

  const sheetNo = opts.sheetNo; // номер листа в атласе (римская цифра), опционально
  const cart = `
  <g class="cartouche">
    <rect x="${x0 + 24 * k}" y="${y0 + 18 * k}" width="${400 * k}" height="${86 * k}" rx="${8 * k}" class="plate cart-plate"/>
    <rect x="${x0 + 29 * k}" y="${y0 + 23 * k}" width="${390 * k}" height="${76 * k}" rx="${6 * k}" class="cart-inner"/>
    <text x="${x0 + 44 * k}" y="${y0 + 41 * k}" class="cart-over" font-size="${9.5 * k}">БИБЛЕЙСКИЙ АТЛАС${sheetNo ? ` · ЛИСТ ${sheetNo}` : ''}</text>
    <text x="${x0 + 44 * k}" y="${y0 + 68 * k}" class="cart-title" font-size="${25 * k}">${esc(meta.title || slug)}</text>
    <text x="${x0 + 44 * k}" y="${y0 + 90 * k}" class="cart-sub" font-size="${11.5 * k}">${esc(meta.subtitle || '')}</text>
  </g>`;

  // Легенда глифов — компакт над этап-зоной, левый низ
  const lg = (i) => y0 + H - (36 - i * 0) * k;
  const legY = y0 + H - 36 * k;
  const legend = `
  <g class="legend">
    <rect x="${x0 + 24 * k}" y="${legY - 14 * k}" width="${372 * k}" height="${30 * k}" rx="${6 * k}" class="plate"/>
    <circle cx="${x0 + 42 * k}" cy="${legY + 1 * k}" r="${4.2 * k}" class="pl-city"/>
    <text x="${x0 + 52 * k}" y="${legY + 5 * k}" class="leg-t" font-size="${10.5 * k}">город · стан</text>
    <circle cx="${x0 + 132 * k}" cy="${legY + 1 * k}" r="${4.6 * k}" class="pl-cand"/>
    <text x="${x0 + 142 * k}" y="${legY + 5 * k}" class="leg-t" font-size="${10.5 * k}">локализация спорна</text>
    <rect x="${x0 + 268 * k}" y="${legY - 3 * k}" width="${8 * k}" height="${8 * k}" transform="rotate(45 ${x0 + 272 * k} ${legY + 1 * k})" class="wp-dot"/>
    <text x="${x0 + 282 * k}" y="${legY + 5 * k}" class="leg-t" font-size="${10.5 * k}">археология</text>
  </g>`;

  const stageStripHtml = stages.length ? `
  <div class="stage-strip">
    ${stages.map((s, i) =>
    `<div class="st" data-stage="${i}" role="button" tabindex="0" title="Показать этап на листе"><span class="st-dot" style="background:${STAGE_TINT[i % STAGE_TINT.length]}"></span>` +
    `<span class="st-body"><b>${esc(ROMAN[i] || i + 1)}</b> · ${esc(String(s.t || ''))}` +
    (s.age || s.km ? `<i>${esc(String(s.age || s.km))}</i>` : '') + `</span></div>`).join('')}
  </div>` : '';

  const svg = `<svg id="sheet-svg" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${W} ${H.toFixed(1)}" data-vb="${x0.toFixed(1)} ${y0.toFixed(1)} ${W} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" class="sheet" role="img" aria-label="${esc(meta.title || slug)} — лист Атласа">
${GEO_DEFS}
<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#seaG)"/>
<g class="base">${base}</g>
${RELIEF[family] || ''}
<path d="${routePath}" class="route-under"/>
<path d="${routePath}" class="route"/>
${halos.join('')}
${leaders.join('')}
${dots.join('')}
${miles.join('')}
${glyphs.join('')}
${wps.join('')}
${ctxs.join('')}
${labels.join('')}
${cart}
${legend}
${furn}
<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#sunGlow)" pointer-events="none"/>
<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#edgeFog)" pointer-events="none"/>
<rect x="${x0}" y="${y0}" width="${W}" height="${H}" filter="url(#parchmentGrain)" opacity=".5" pointer-events="none"/>
<rect x="${x0 + 8 * k}" y="${y0 + 8 * k}" width="${W - 16 * k}" height="${H - 16 * k}" class="frame"/>
</svg>`;

  return { svg, stageStripHtml, meta: { title: meta.title || slug, subtitle: meta.subtitle || '' } };
}

function sheetCss() {
  return `
  html,body{margin:0;min-height:100%;background:#efe6cf}
  body{display:grid;place-items:center;padding:12px;box-sizing:border-box}
  .wrap{max-width:1500px;width:100%;box-shadow:0 18px 60px rgba(90,70,30,.35), 0 2px 10px rgba(90,70,30,.22);border-radius:6px;overflow:hidden}
  svg.sheet{display:block;width:100%;height:auto;background:#f5edd8}
  .frame{fill:none;stroke:#8a6a1f;stroke-width:1.2;opacity:.55}
  .base{opacity:.96}
  .base [fill="#10263a"]{fill:#8fb7cb}
  .base [stroke="#2e4d6b"]{stroke:#6f97ae}
  .base [stroke="#2d4a66"]{stroke:#6f97ae}
  .base text{opacity:.85}
  .route-under{fill:none;stroke:#fdf9ef;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;opacity:.3}
  .route{fill:none;stroke:#a2653f;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:.1 8.2;opacity:.82}
  .pl-city{fill:#1e3a63;stroke:#f6f1e7;stroke-width:.9}
  .pl-cand{fill:none;stroke:#8a6a1f;stroke-width:1.2;stroke-dasharray:2.6 2}
  .pl{cursor:pointer}
  #sheet-svg [fill="url(#jordanG)"]{opacity:.22}
  #sheet-svg #tradeRoutes{opacity:.32}
  .glyph path,.glyph circle{fill:none;stroke:#6b5216;stroke-width:.85;stroke-linejoin:round;opacity:.85}
  .glyph .glyph-line{fill:none;stroke:#6b5216;stroke-width:.9;stroke-linecap:round}
  .glyph .glyph-flame{fill:#a25d33;stroke:none}
  .glyph .glyph-smoke{fill:none;stroke:#8a7a58;stroke-width:.8;opacity:.75;stroke-linecap:round}

  .wp-dot{fill:#4a7a52;stroke:none;opacity:.6}
  .leader{stroke:#5c4d33;stroke-width:.75;opacity:.45}
  .mile-t{font:italic 700 1em Georgia,serif;opacity:.9}
  text.lab-place{font-family:Georgia,'Times New Roman',serif;font-weight:600;fill:#2b2418;paint-order:stroke;stroke:#f5edd8;stroke-width:.17em;stroke-linejoin:round}
  text.lab-cand{font-style:italic;fill:#5c4a1e}
  text.lab-region{font-family:Georgia,serif;font-weight:600;letter-spacing:.3em;fill:#7a6a48;opacity:.78;paint-order:stroke;stroke:#f5edd8;stroke-width:.18em}
  text.lab-ctx{font-family:Georgia,serif;letter-spacing:.24em;fill:#8a7a58;opacity:.6;paint-order:stroke;stroke:#f5edd8;stroke-width:.16em}
  text.lab-wp{font-family:Georgia,serif;font-style:italic;fill:#4a6a52;opacity:0;transition:opacity .3s;paint-order:stroke;stroke:#f5edd8;stroke-width:.16em}
  svg.zoomed text.lab-wp{opacity:.85}
  .plate{fill:rgba(246,241,231,.85);stroke:rgba(120,95,40,.35);stroke-width:1}
  .cart-plate{fill:rgba(246,241,231,.92)}
  .cart-inner{fill:none;stroke:rgba(138,106,31,.3);stroke-width:.8}
  .cart-over{font-family:Georgia,serif;fill:#8a6a1f;letter-spacing:.22em;font-weight:600}
  .cart-title{font-family:Georgia,serif;font-weight:700;fill:#1e3a63}
  .cart-sub{font-family:Georgia,serif;fill:#5c4d33;opacity:.85}
  .leg-t{font-family:Georgia,serif;fill:#3a3020;opacity:.9}
  .sb-d{fill:#3a3020}.sb-l{fill:#f6f1e7;stroke:#3a3020;stroke-width:1}
  .sb-t{font-family:Georgia,serif;fill:#5c4d33;font-weight:600}
  .north{fill:#8a6a1f;stroke:#6b5216;stroke-width:1}
  .north-t{font-family:Georgia,serif;font-weight:700;fill:#6b5216}
  .stage-strip{display:flex;flex-wrap:wrap;gap:6px 22px;padding:12px 18px;background:#f0e8d2;border-top:1px solid rgba(138,106,31,.25)}
  .st{display:flex;align-items:center;gap:8px}
  .st-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;box-shadow:0 1px 2px rgba(90,70,30,.4)}
  .st-body{font-family:Georgia,serif;font-size:13px;color:#3a3020}
  .st-body b{color:#8a6a1f}
  .st-body i{color:#7a6a48;margin-left:6px;font-size:11.5px}
  .g9{position:fixed;right:10px;bottom:10px;z-index:9;font:600 10px/1 system-ui;letter-spacing:.08em;color:#7a5c26;background:rgba(246,241,231,.9);border:1px solid rgba(138,106,31,.4);border-radius:999px;padding:6px 10px}
  /* ── Читалка (R1, §14): корешок, погружение, курсоры ── */
  svg.sheet{cursor:grab;touch-action:none}
  .frame,.legend,.cartouche,.furn{transition:opacity .35s}
  svg.zoomed .frame,svg.zoomed .legend,svg.zoomed .cartouche,svg.zoomed .furn{opacity:0;pointer-events:none}
  svg.sheet.grabbing{cursor:grabbing}
  .stage-strip .st{cursor:pointer;border-radius:8px;padding:2px 8px;margin:-2px -8px;transition:background .15s}
  .stage-strip .st:hover{background:rgba(138,106,31,.1)}
  .stage-strip .st--on{background:rgba(138,106,31,.16)}
  .spine{position:fixed;left:0;top:0;bottom:0;z-index:20;display:flex;align-items:stretch}
  .spine-tab{writing-mode:vertical-rl;transform:rotate(180deg);display:flex;align-items:center;gap:6px;padding:14px 5px;background:rgba(246,241,231,.94);border-right:1px solid rgba(138,106,31,.35);color:#8a6a1f;font:700 11px/1 Georgia,serif;letter-spacing:.22em;cursor:pointer;box-shadow:2px 0 10px rgba(90,70,30,.15)}
  .spine-list{width:0;overflow:hidden;overflow-y:auto;background:rgba(246,241,231,.97);transition:width .25s ease;box-shadow:4px 0 18px rgba(90,70,30,.2)}
  .spine:hover .spine-list,.spine:focus-within .spine-list{width:212px}
  .spine-it{display:block;padding:10px 12px;text-decoration:none;color:#3a3020;font:600 13px/1.25 Georgia,serif;border-bottom:1px solid rgba(138,106,31,.14)}
  .spine-it img{display:block;width:100%;border-radius:6px;margin-bottom:6px;box-shadow:0 2px 8px rgba(90,70,30,.25)}
  .spine-it:hover{background:rgba(138,106,31,.08)}
  .spine-it--on{background:rgba(138,106,31,.14);box-shadow:inset 3px 0 0 #8a6a1f}
  .spine-head{padding:12px 12px 8px;font:700 10px/1 Georgia,serif;letter-spacing:.28em;color:#8a6a1f;border-bottom:1px solid rgba(138,106,31,.25)}
  .spine-cover{position:relative;display:block}
  .spine-cover b{position:absolute;left:6px;top:6px;background:rgba(246,241,231,.92);color:#8a6a1f;font:700 10px/1 Georgia,serif;border-radius:6px;padding:3px 6px;border:1px solid rgba(138,106,31,.4)}
  /* ── Ховер-карточка места: фото раскопок + факт ── */
  .place-card{position:fixed;z-index:30;width:300px;background:#f6f1e7;border:1px solid rgba(138,106,31,.45);border-radius:12px;box-shadow:0 14px 40px rgba(60,45,15,.35);overflow:hidden;opacity:0;transform:translateY(6px) scale(.98);transition:opacity .18s,transform .18s;pointer-events:none}
  .place-card.pc--on{opacity:1;transform:none}
  .pc-ph{position:relative;height:130px;background:#e8dcbc}
  .pc-ph img{width:100%;height:100%;object-fit:cover;display:block}
  .pc-ph i{position:absolute;left:0;right:0;bottom:0;padding:14px 10px 5px;font:600 9px/1 system-ui;letter-spacing:.12em;color:#fff;background:linear-gradient(transparent,rgba(20,14,4,.72))}
  .pc-body{padding:10px 12px 12px}
  .pc-body b{display:block;font:700 15px/1.2 Georgia,serif;color:#1e3a63}
  .pc-body u{display:block;text-decoration:none;font:600 10.5px/1.3 Georgia,serif;color:#8a6a1f;letter-spacing:.06em;margin-top:2px}
  .pc-body p{margin:7px 0 0;font:400 12px/1.5 Georgia,serif;color:#3a3020}
  /* ── Панель-досье (клик по месту) ── */
  .dossier{position:fixed;right:0;top:0;bottom:0;width:min(430px,94vw);z-index:26;background:#f6f1e7;border-left:1px solid rgba(138,106,31,.4);box-shadow:-16px 0 44px rgba(60,45,15,.3);transform:translateX(103%);transition:transform .28s ease;display:flex;flex-direction:column}
  .dossier.do--on{transform:none}
  .do-x{position:absolute;right:10px;top:10px;z-index:2;width:34px;height:34px;border-radius:9px;border:1px solid rgba(138,106,31,.4);background:rgba(246,241,231,.95);color:#7a5c26;font-size:19px;cursor:pointer}
  .do-head{padding:16px 54px 12px 18px;border-bottom:1px solid rgba(138,106,31,.25);background:rgba(240,232,210,.6)}
  .do-head b{display:block;font:700 20px/1.2 Georgia,serif;color:#1e3a63}
  .do-head u{display:block;text-decoration:none;font:600 11.5px/1.35 Georgia,serif;color:#8a6a1f;margin-top:3px;letter-spacing:.05em}
  .do-scroll{overflow-y:auto;padding:14px 18px 22px;flex:1}
  .do-gallery{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
  .do-ph{margin:0}
  .do-ph img{width:100%;height:96px;object-fit:cover;border-radius:8px;box-shadow:0 2px 8px rgba(90,70,30,.3);display:block;background:#e8dcbc}
  .do-ph figcaption{font:600 8.5px/1.3 system-ui;letter-spacing:.08em;color:#7a6a48;margin-top:3px}
  .do-ph figcaption i{display:block;font:400 8px/1.2 system-ui;color:#9a8a68;letter-spacing:0}
  .do-sec{margin:0 0 14px}
  .do-sec h4{margin:0 0 5px;font:700 10.5px/1 Georgia,serif;letter-spacing:.22em;color:#8a6a1f;text-transform:uppercase}
  .do-sec p{margin:0 0 8px;font:400 13.5px/1.6 Georgia,serif;color:#2b2418}
  .do-bible .verse{display:block;padding:10px 12px;background:rgba(30,58,99,.06);border-left:3px solid #1e3a63;border-radius:6px;font:italic 400 13.5px/1.55 Georgia,serif;color:#1e3a63;margin-bottom:8px}
  .do-bible .verse span{display:block;font:700 9.5px/1 system-ui;letter-spacing:.16em;color:#8a6a1f;margin-top:6px;font-style:normal}
  .do-sec .dispute-block{border:1px solid rgba(138,106,31,.35);border-radius:10px;padding:10px 12px;background:rgba(240,232,210,.5)}
  .do-sec .dispute-title{font:700 11px/1.2 Georgia,serif;letter-spacing:.1em;color:#8a6a1f;margin-bottom:7px}
  .do-sec .dispute-pos{font:400 12.5px/1.55 Georgia,serif;color:#2b2418;margin-bottom:7px}
  .do-sec .conf-med,.do-sec .conf-lo,.do-sec .conf-hi{display:inline-block;font:600 9px/1 system-ui;letter-spacing:.08em;padding:2px 7px;border-radius:999px;background:rgba(138,106,31,.15);color:#7a5c26}
  .do-sec .act-btn{display:none}
  body.dive .dossier{display:none}
  .dive-btn{position:fixed;right:10px;top:10px;z-index:21;width:38px;height:38px;border-radius:10px;border:1px solid rgba(138,106,31,.4);background:rgba(246,241,231,.92);color:#7a5c26;font-size:17px;cursor:pointer;box-shadow:0 2px 8px rgba(90,70,30,.2)}
  .dive-btn:hover{background:#f6f1e7}
  body.dive .spine,body.dive .stage-strip,body.dive .g9{display:none}
  body.dive .wrap{max-width:none;border-radius:0;box-shadow:none}
  body.dive{padding:0}`;
}

function buildSheetHtml(route, opts) {
  const { svg, stageStripHtml, meta } = renderSheet(route, opts);
  const badge = opts.badge || `${String(opts.slug || '').toUpperCase()} · SHEET · awaiting G9`;
  const spine = JSON.stringify(opts.spine || []);
  // Пакет ховер-карточек: фото раскопок + небанальный факт из данных карты
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const cards = {};
  for (const p of route.places || []) {
    if (p.type === 'region') continue;
    const ph = (p.photos || [])[0] || {};
    const arch = strip(p.arch);
    cards[p.id] = {
      n: p.name, k: p.kick || '',
      t: ph.thumb || ph.src || null, tl: ph.label || '',
      f: (p.id1 && p.ep1) ? `${p.id1} — ${p.ep1}` : (arch ? arch.slice(0, 180) + (arch.length > 180 ? '…' : '') : ''),
      // полное досье для панели (R2); в прод-версии R4 вынести в отдельный fetch
      dossier: {
        story: p.story || '', bible: p.bible || '', arch: p.arch || '',
        dispute: p.dispute || '', bible_extra: p.bible_extra || '',
        photos: (p.photos || []).map(x => ({ src: x.src, thumb: x.thumb, label: x.label || '', credit: x.credit || '' })),
      },
    };
  }
  const cardsJson = JSON.stringify(cards);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(meta.title)} — лист Атласа (светлый, awaiting G9)</title>
<style>${sheetCss()}
</style>
</head>
<body>
<div class="wrap">${svg}${stageStripHtml}</div>
<span class="g9">${esc(badge)}</span>
<script>window.ATLAS_SPINE=${spine};window.ATLAS_PLACES=${cardsJson};</script>
<script src="atlas-reader.js"></script>
</body>
</html>`;
}

module.exports = { renderSheet, buildSheetHtml, sheetCss, KM_PER_UNIT, STAGE_TINT, ROMAN };
