/**
 * render-l0-svg.mjs — статический SVG-превью обзорной раскладки «Генеалогии Спасителя».
 *
 * Цель — не «схема», а ремесленный SVG уровня референсов владельца: тёплый пергамент
 * с текстурой и свечением, карточки-лозенги с эмблемами, светящаяся золотая
 * мессианская нить, цветные коннекторы по линиям, лучистая рамка Христа.
 *
 * НЕ движок (движок Phase 3) — это (1) визуальный эталон-камертон для рендера и
 * (2) seed статического SEO/print-слоя (engine-contract §8). Детерминированный вывод
 * (feTurbulence seed фиксирован; без Date/random).
 *
 * Всё self-hosted (CSP): текстура — SVG-фильтры, иконки — инлайновые symbol'ы.
 */
import { iconSymbolDefs, ANCHOR_ICON, CLUSTER_ICON, ANCHOR_SUBTITLE } from './icons.mjs';
import { getPalette, ERA_ACCENT, ROMAN, CLUSTER_LINE } from './palette.mjs';
import { christDefs, christHalo } from './christ-halo.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);

function iconUse(id, x, y, size, color, opacity = 1) {
  if (!id) return '';
  return `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${size}" height="${size}" color="${color}" opacity="${opacity}"/>`;
}

export function renderL0Svg(layout, { title = 'Генеалогия Спасителя', subtitle = 'От Адама до Христа Спасителя', focus = null, theme = 'light', chrono = null } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  // тёплое свечение/виньетка адаптируются под тему
  const glowStops = dark
    ? { a: '#fff0c8', ao: '0.20', b: '#d8b45f', bo: '0.08', far: '0.02' }
    : { a: '#fff6df', ao: '0.9', b: '#f7eccf', bo: '0.45', far: '0.12' };
  const vignetteCol = dark ? '#000000' : '#6a5230';
  const vignetteOp = dark ? '0.42' : '0.13';
  const { bbox, nodes, edges } = layout;
  // focus = { label, brightIds:Set<string> } — фокус-режим: не-фокус приглушается
  const bright = focus?.brightIds ?? null;
  const isBright = id => !bright || bright.has(id);
  const dimAttr = id => (bright && !bright.has(id)) ? ' opacity="0.28" filter="url(#desat)"' : '';
  const padTop = 190, padL = 250, padR = 90, padB = 136;
  // датировки якорей хребта (chronology.json): ключ → [id якоря шкалы, префикс]
  const SPINE_DATE = {
    'Adam@Gen.2.19': ['creation', ''], 'Noah@Gen.5.29': ['flood', 'Потоп: '],
    'Abraham@Gen.11.26': ['abraham-birth', 'род. '], 'David@Rut.4.17': ['david-king', 'воцарение: '],
    'Jesus@Isa.7.14': ['nativity', ''],
  };
  const chronoById = new Map((chrono?.anchors ?? []).map(a => [a.id, a]));
  const dateChip = key => {
    const m = SPINE_DATE[key];
    if (!m || !chrono) return null;
    const a = chronoById.get(m[0]);
    return a ? `${m[1]}${a.am} AM · ${a.bc} до Р.Х.` : null;
  };
  const vbX = bbox.x - padL, vbY = bbox.y - padTop;
  const vbW = bbox.w + padL + padR, vbH = bbox.h + padTop + padB;
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const spineNodes = nodes.filter(n => n.kind === 'spine');
  const cx = n => n.x + n.w / 2, cy = n => n.y + n.h / 2;
  const centerX = spineNodes.length ? cx(spineNodes[0]) : 0;
  const P = [];

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vbX)} ${f(vbY)} ${f(vbW)} ${f(vbH)}" width="${Math.round(vbW)}" height="${Math.round(vbH)}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="${esc(title)} — обзорная генеалогическая схема">`);

  // ─────────── defs ───────────
  P.push('<defs>');
  P.push(`<radialGradient id="glow" cx="50%" cy="86%" r="75%">
    <stop offset="0%" stop-color="${glowStops.a}" stop-opacity="${glowStops.ao}"/>
    <stop offset="42%" stop-color="${glowStops.b}" stop-opacity="${glowStops.bo}"/>
    <stop offset="78%" stop-color="${glowStops.b}" stop-opacity="${glowStops.far}"/>
    <stop offset="100%" stop-color="${glowStops.b}" stop-opacity="0"/></radialGradient>`);
  P.push(`<linearGradient id="paperGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.paper0}"/><stop offset="55%" stop-color="${C.paper1}"/>
    <stop offset="100%" stop-color="${C.paperEdge}"/></linearGradient>`);
  P.push(`<radialGradient id="vignette" cx="50%" cy="42%" r="78%">
    <stop offset="0%" stop-color="${vignetteCol}" stop-opacity="0"/>
    <stop offset="86%" stop-color="${vignetteCol}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${vignetteCol}" stop-opacity="${vignetteOp}"/></radialGradient>`);
  P.push(`<linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.goldHi}"/><stop offset="50%" stop-color="${C.gold}"/>
    <stop offset="100%" stop-color="${C.goldLo}"/></linearGradient>`);
  P.push(`<linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.cardTop}"/><stop offset="100%" stop-color="${C.cardBot}"/></linearGradient>`);
  P.push(`<linearGradient id="megaGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.megaTop}"/><stop offset="100%" stop-color="${C.megaBot}"/></linearGradient>`);
  P.push(christDefs(C, dark));
  // текстура пергамента: крупная мраморность + мелкое зерно
  P.push(`<filter id="paperTex" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="3" seed="7" stitchTiles="stitch" result="mot"/>
    <feColorMatrix in="mot" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.32  0 0 0 0 0.15  0 0 0 0.06 0"/></filter>`);
  P.push(`<filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" stitchTiles="stitch" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.035 0"/></filter>`);
  // мягкая направленная тень карточек
  P.push(`<filter id="cardShadow" x="-30%" y="-30%" width="160%" height="180%">
    <feDropShadow dx="0" dy="2.2" stdDeviation="3.4" flood-color="#4a3616" flood-opacity="0.26"/></filter>`);
  P.push(`<filter id="goldSoft" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="3.2"/></filter>`);
  P.push(`<filter id="desat"><feColorMatrix type="saturate" values="0.15"/></filter>`);
  P.push(iconSymbolDefs());
  P.push('</defs>');

  // ─────────── фон ───────────
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" filter="url(#paperTex)" opacity="0.5"/>`);
  // тёплое свечение вдоль хребта (мягкий вертикальный вымыв, ярче к Христу внизу)
  const glowY = spineNodes.length ? spineNodes[0].y - 40 : vbY;
  const glowH = spineNodes.length ? (cy(spineNodes[spineNodes.length - 1]) - glowY + 120) : vbH;
  P.push(`<ellipse cx="${f(centerX)}" cy="${f(glowY + glowH * 0.58)}" rx="${f(vbW * 0.42)}" ry="${f(glowH * 0.7)}" fill="url(#glow)" opacity="0.7"/>`);
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" fill="url(#vignette)"/>`);
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" filter="url(#grain)" opacity="0.6"/>`);

  // ─────────── колонка эпох (слева) ───────────
  const eraX = vbX + 30;
  const eras = layout.eraBands ?? [];
  P.push(`<line x1="${f(eraX + 150)}" y1="${f((eras[0]?.y0 ?? bbox.y) - 6)}" x2="${f(eraX + 150)}" y2="${f((eras[eras.length - 1]?.y1 ?? bbox.y + bbox.h) + 6)}" stroke="${C.gold}" stroke-width="1" opacity="0.28"/>`);
  const spanById = new Map((chrono?.eraSpans ?? []).map(s => [s.id, s]));
  eras.forEach((b, i) => {
    const col = ERA_ACCENT[b.id] ?? C.inkSoft;
    const midY = (b.y0 + b.y1) / 2;
    P.push(`<rect x="${f(eraX)}" y="${f(b.y0)}" width="150" height="${f(Math.max(3, b.y1 - b.y0))}" fill="${col}" opacity="0.06" rx="4"/>`);
    P.push(`<circle cx="${f(eraX + 150)}" cy="${f(midY)}" r="4.5" fill="url(#goldGrad)" stroke="${C.paper0}" stroke-width="1"/>`);
    P.push(`<text x="${f(eraX + 12)}" y="${f(midY - 3)}" font-size="8.5" letter-spacing="1.5" fill="${C.inkFaint}">ЭПОХА ${ROMAN[i + 1] ?? i + 1}</text>`);
    P.push(`<text x="${f(eraX + 12)}" y="${f(midY + 12)}" font-size="14.5" fill="${C.inkSoft}">${esc(b.label)}</text>`);
    // диапазон шкалы «от Адама» (chronology.json, МТ/Ашшер)
    const sp = spanById.get(b.id);
    if (sp) P.push(`<text x="${f(eraX + 12)}" y="${f(midY + 27)}" font-size="9" fill="${C.gold}" opacity="0.85">${sp.amFrom}–${sp.amTo} AM</text>`);
  });

  // ─────────── заголовок + эмблема ───────────
  const titleCX = centerX, titleY = vbY + 74;
  // эмблема-медальон с древом
  P.push(`<g transform="translate(${f(titleCX - 250)}, ${f(titleY - 34)})">
    <circle cx="26" cy="26" r="25" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.6" filter="url(#cardShadow)"/>
    <circle cx="26" cy="26" r="20" fill="none" stroke="${C.gold}" stroke-width="0.7" opacity="0.5"/>
    ${iconUse('tree', 12, 12, 28, C.gold)}</g>`);
  P.push(`<text x="${f(titleCX + 6)}" y="${f(titleY - 2)}" text-anchor="middle" font-size="40" fill="${C.ink}" font-weight="bold" letter-spacing="0.5">${esc(title)}</text>`);
  // орнаментальная разделительная линия с ромбом
  const oy = titleY + 18, ow = 150;
  P.push(`<g stroke="${C.gold}" stroke-width="1" opacity="0.7">
    <line x1="${f(titleCX + 6 - ow)}" y1="${f(oy)}" x2="${f(titleCX + 6 - 14)}" y2="${f(oy)}"/>
    <line x1="${f(titleCX + 6 + 14)}" y1="${f(oy)}" x2="${f(titleCX + 6 + ow)}" y2="${f(oy)}"/>
    <path d="M${f(titleCX + 6)} ${f(oy - 5)} l6 5 -6 5 -6 -5z" fill="url(#goldGrad)" stroke="none"/></g>`);
  P.push(`<text x="${f(titleCX + 6)}" y="${f(titleY + 40)}" text-anchor="middle" font-size="17" fill="${C.gold}" font-style="italic" letter-spacing="1">${esc(subtitle)}</text>`);

  // ─────────── коннекторы (под узлами) ───────────
  // золотая мессианская нить: свечение + сплошная линия
  if (spineNodes.length > 1) {
    const x = f(centerX);
    const y1 = f(cy(spineNodes[0])), y2 = f(cy(spineNodes[spineNodes.length - 1]));
    P.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${C.goldGlow}" stroke-width="9" stroke-linecap="round" opacity="0.4" filter="url(#goldSoft)"/>`);
    P.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="url(#goldGrad)" stroke-width="3.2" stroke-linecap="round"/>`);
  }
  // связки кластер→якорь: мягкая ортогональная кривая, цвет по линии
  for (const e of edges) {
    if (e.kind !== 'cluster-link') continue;
    const a = nodeById.get(e.from), b = nodeById.get(e.to); // a=якорь, b=кластер
    if (!a || !b) continue;
    const cid = b.clusterId;
    const col = CLUSTER_LINE[cid] ?? C.relation;
    const ax = b.side === 'left' ? a.x : a.x + a.w, bx = b.side === 'left' ? b.x + b.w : b.x;
    const ay = cy(a), by = cy(b);
    const dashed = (cid === 'lords-relatives' || cid === 'return-from-exile') ? ` stroke-dasharray="1.5 5"` : '';
    const dim = (bright && !(isBright(a.id) && isBright(b.id))) ? ' opacity="0.14"' : ` opacity="0.62"`;
    if (b.side === 'center') {
      P.push(`<path d="M${f(cx(a))} ${f(a.y + a.h)} L${f(cx(b))} ${f(b.y)}" fill="none" stroke="${col}" stroke-width="1.6"${dashed}${dim} stroke-linecap="round"/>`);
    } else {
      const mx = (ax + bx) / 2;
      P.push(`<path d="M${f(ax)} ${f(ay)} C ${f(mx)} ${f(ay)}, ${f(mx)} ${f(by)}, ${f(bx)} ${f(by)}" fill="none" stroke="${col}" stroke-width="1.6"${dashed}${dim} stroke-linecap="round"/>`);
    }
  }

  // чип фокуса в верхней панели (если фокус-режим)
  if (focus?.label) {
    const chY = vbY + 118, chW = 30 + focus.label.length * 8.4;
    const chX = centerX - chW / 2;
    P.push(`<g>
      <rect x="${f(chX)}" y="${f(chY)}" width="${f(chW)}" height="30" rx="15" fill="${C.cardTop}" stroke="url(#goldGrad)" stroke-width="1.4" filter="url(#cardShadow)"/>
      <circle cx="${f(chX + 15)}" cy="${f(chY + 15)}" r="5" fill="none" stroke="${C.gold}" stroke-width="1.4"/>
      <circle cx="${f(chX + 15)}" cy="${f(chY + 15)}" r="1.6" fill="${C.gold}"/>
      <text x="${f(chX + 27)}" y="${f(chY + 19.5)}" font-size="13" fill="${C.ink}">${esc(focus.label)}</text></g>`);
  }

  // ─────────── узлы ───────────
  for (const n of nodes) {
    const wrap = s => (bright && !isBright(n.id)) ? `<g${dimAttr(n.id)}>${s}</g>` : s;
    if (n.kind === 'spine' && n.messiah) { P.push(wrap(renderChrist(n))); continue; }
    if (n.kind === 'spine') { P.push(wrap(renderSpine(n))); continue; }
    P.push(wrap(renderMega(n)));
  }

  // ─────────── легенда ───────────
  P.push(renderLegend(bbox));
  // сноска о временной шкале (консервативная позиция, честные вилки)
  if (chrono) {
    P.push(`<text x="${f(bbox.x)}" y="${f(bbox.y + bbox.h + 116)}" font-size="11" fill="${C.inkFaint}" font-style="italic">Шкала времени: родословия масоретского текста (Ашшер) · AM — лет от Адама · по LXX шкала длиннее — текстологические вилки помечены (chronology.json)</text>`);
  }

  P.push('</svg>');
  return P.join('\n');

  // ── карточка якоря ──
  function renderSpine(n) {
    const icon = ANCHOR_ICON[n.key] ?? 'person';
    const sub = ANCHOR_SUBTITLE[n.key] ?? null;
    const g = [`<g filter="url(#cardShadow)">`];
    g.push(`<rect x="${f(n.x)}" y="${f(n.y)}" width="${f(n.w)}" height="${f(n.h)}" rx="15" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.8"/>`);
    g.push(`<rect x="${f(n.x + 2.5)}" y="${f(n.y + 2.5)}" width="${f(n.w - 5)}" height="${f(n.h - 5)}" rx="12.5" fill="none" stroke="${C.goldHi}" stroke-width="0.6" opacity="0.55"/>`);
    g.push(`</g>`);
    g.push(iconUse(icon, n.x + 14, cy(n) - 12, 24, C.gold));
    const tx = n.x + 46;
    if (sub) {
      g.push(`<text x="${f(tx)}" y="${f(cy(n) - 3)}" font-size="18" fill="${C.ink}" font-weight="bold">${esc(n.label)}</text>`);
      g.push(`<text x="${f(tx)}" y="${f(cy(n) + 14)}" font-size="11" fill="${C.gold}" font-style="italic">${esc(sub)}</text>`);
    } else {
      g.push(`<text x="${f(tx)}" y="${f(cy(n) + 1)}" font-size="18" fill="${C.ink}" font-weight="bold">${esc(n.label)}</text>`);
      if (n.refRu) g.push(`<text x="${f(tx)}" y="${f(cy(n) + 16)}" font-size="9.5" fill="${C.inkFaint}">${esc(n.refRu)}</text>`);
    }
    // датировка (шкала AM «от Адама», МТ/Ашшер) — под карточкой
    const dc = dateChip(n.key);
    if (dc) g.push(`<text x="${f(cx(n))}" y="${f(n.y + n.h + 15)}" text-anchor="middle" font-size="9.5" fill="${C.gold}" opacity="0.9">${esc(dc)}</text>`);
    return g.join('');
  }

  // ── особая карточка Христа: лучистая рамка + сияние ──
  function renderChrist(n) {
    const W = n.w + 54, H = n.h + 26;
    const x = cx(n) - W / 2, y = cy(n) - H / 2;
    const g = [];
    // глубокая ауреола: блум + корона лучей + крестчатый нимб + кольцо + искры
    g.push(christHalo(cx(n), cy(n), Math.max(W * 0.47, H * 1.08), C, 0.72, dark));
    g.push(`<g filter="url(#cardShadow)">`);
    g.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(W)}" height="${f(H)}" rx="17" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.4"/>`);
    g.push(`<rect x="${f(x + 4)}" y="${f(y + 4)}" width="${f(W - 8)}" height="${f(H - 8)}" rx="13" fill="none" stroke="url(#goldGrad)" stroke-width="1"/>`);
    g.push(`</g>`);
    g.push(iconUse('cross', cx(n) - W / 2 + 16, cy(n) - 15, 30, C.gold));
    const tx = cx(n) - W / 2 + 52;
    g.push(`<text x="${f(tx)}" y="${f(cy(n) - 2)}" font-size="22" fill="${C.ink}" font-weight="bold">${esc(n.label)}</text>`);
    g.push(`<text x="${f(tx)}" y="${f(cy(n) + 17)}" font-size="12.5" fill="${C.gold}" font-style="italic" letter-spacing="1">Мессия · Сын Божий</text>`);
    const dc = dateChip(n.key);
    if (dc) g.push(`<text x="${f(cx(n))}" y="${f(cy(n) + H / 2 + 17)}" text-anchor="middle" font-size="10" fill="${C.gold}" opacity="0.95">${esc(dc)}</text>`);
    return g.join('');
  }

  // ── «веер точек»: сжатая группа (множество имён), расходится наружу от кластера ──
  function dotFan(n, col) {
    let ox, oy, t0;
    if (n.side === 'left') { ox = n.x; oy = cy(n); t0 = Math.PI; }
    else if (n.side === 'right') { ox = n.x + n.w; oy = cy(n); t0 = 0; }
    else { ox = cx(n); oy = n.y + n.h; t0 = Math.PI / 2; }
    const density = Math.min(1, (n.count ?? 0) / 300);   // больше имён → плотнее веер
    const rings = [26, 47, 69, 92];
    const spread = 0.95;                                  // угловой разброс веера
    const out = [];
    rings.forEach((r, ri) => {
      const cnt = 3 + ri;                                 // 3,4,5,6 точек по кольцам
      for (let j = 0; j < cnt; j++) {
        const a = t0 + spread * ((cnt === 1 ? 0 : j / (cnt - 1)) - 0.5);
        const px = ox + Math.cos(a) * r, py = oy + Math.sin(a) * r;
        const op = (0.4 - ri * 0.075) * (0.45 + 0.55 * density);
        const rad = 2.5 - ri * 0.32;
        out.push(`<circle cx="${f(px)}" cy="${f(py)}" r="${f(rad)}" fill="${col}" opacity="${f(op, 2)}"/>`);
      }
    });
    return out.join('');
  }

  // ── карточка мега-узла кластера ──
  function renderMega(n) {
    const icon = CLUSTER_ICON[n.clusterId] ?? 'people';
    const col = CLUSTER_LINE[n.clusterId] ?? C.relation;
    const g = [dotFan(n, col), `<g filter="url(#cardShadow)">`];
    g.push(`<rect x="${f(n.x)}" y="${f(n.y)}" width="${f(n.w)}" height="${f(n.h)}" rx="13" fill="url(#megaGrad)" stroke="${C.megaBorder}" stroke-width="1.3"/>`);
    g.push(`</g>`);
    // цветная «корешок»-полоска слева = линия кластера
    g.push(`<rect x="${f(n.x)}" y="${f(n.y + 8)}" width="3.5" height="${f(n.h - 16)}" rx="2" fill="${col}" opacity="0.75"/>`);
    g.push(iconUse(icon, n.x + 14, cy(n) - 13, 26, col, 0.92));
    const tx = n.x + 48;
    g.push(`<text x="${f(tx)}" y="${f(cy(n) - 4)}" font-size="14.5" fill="${C.ink}" font-weight="bold">${esc(n.label)}</text>`);
    g.push(`<text x="${f(tx)}" y="${f(cy(n) + 15)}" font-size="12" fill="${C.gold}">+${n.count} имён</text>`);
    return g.join('');
  }

  // ── легенда линий ──
  function renderLegend(bb) {
    const items = [
      ['Мессианская линия', C.messianic, false],
      ['Матфей · царская', C.matthew, false],
      ['Лука · кровная', C.luke, false],
      ['Патриархи · завет', C.patriarch, false],
      ['Побочные линии', C.cainite, false],
      ['Предание · родство', C.relation, true],
    ];
    const lx = bb.x, ly = bb.y + bb.h + 46, colW = 235;
    const g = [`<text x="${f(lx)}" y="${f(ly - 16)}" font-size="10" letter-spacing="2" fill="${C.inkFaint}">УСЛОВНЫЕ ОБОЗНАЧЕНИЯ</text>`];
    items.forEach((it, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = lx + col * colW, y = ly + row * 22;
      const dash = it[2] ? ` stroke-dasharray="1.5 4"` : '';
      g.push(`<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + 26)}" y2="${f(y)}" stroke="${it[1]}" stroke-width="2.6"${dash} stroke-linecap="round"/>`);
      g.push(`<text x="${f(x + 34)}" y="${f(y + 4)}" font-size="12.5" fill="${C.inkSoft}">${esc(it[0])}</text>`);
    });
    return g.join('\n');
  }
}
