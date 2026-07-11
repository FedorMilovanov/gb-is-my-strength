/**
 * render-app-shell.mjs — камертон ИНТЕРФЕЙСА «Генеалогии Спасителя» (не карта, а вся оболочка).
 *
 * Показывает целевую компоновку приложения из референса владельца: огромная карта в
 * центральном вьюпорте (с «туманом» по краям — намёк, что карта продолжается), а справа —
 * панель-навигатор: миникарта с прямоугольником текущего вида, зум-контролы, семантические
 * уровни L0/L1/L2, поиск, фильтры линий, быстрые виды. Сверху — топ-бар, слева — рейка эпох.
 *
 * Миникарта строится из РЕАЛЬНОЙ раскладки L0 (те же узлы), поэтому это честный прототип
 * навигации, а не декорация. Тема-параметризован (свет/ночь). Детерминированный вывод.
 */
import { getPalette, commonDefs, ERA_ACCENT, ROMAN, CLUSTER_LINE } from './palette.mjs';
import { iconSymbolDefs, ANCHOR_ICON, CLUSTER_ICON } from './icons.mjs';
import { christDefs, christHalo } from './christ-halo.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);
const iconUse = (id, x, y, s, col, op = 1) => id ? `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" color="${col}" opacity="${op}"/>` : '';

const W = 1680, H = 1012;
const TOP = 58, RAIL = 60, PANEL = 320, STAT = 40;

export function renderAppShell(layoutL0, { theme = 'light', views = null, personsCount = null } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  const panelBg = dark ? '#1c150c' : '#efe6ce';
  const panelEdge = dark ? '#3a2e19' : '#dccdaa';
  const chromeBg = dark ? '#161009' : '#e9dcbf';
  const fieldBg = dark ? '#100b06' : '#fbf6ea';
  const P = [];

  const mapX = RAIL, mapY = TOP, mapW = W - RAIL - PANEL, mapH = H - TOP - STAT;
  const panelX = W - PANEL;

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="Генеалогия Спасителя — прототип интерфейса">`);

  // ── defs ──
  P.push('<defs>');
  P.push(commonDefs(C));
  P.push(christDefs(C, dark));
  const gs = dark ? { a: '#fff0c8', ao: '0.16', b: '#d8b45f', bo: '0.06', far: '0.015' } : { a: '#fff6df', ao: '0.85', b: '#f7eccf', bo: '0.4', far: '0.1' };
  P.push(`<radialGradient id="mapGlow" cx="50%" cy="60%" r="65%">
    <stop offset="0%" stop-color="${gs.a}" stop-opacity="${gs.ao}"/>
    <stop offset="48%" stop-color="${gs.b}" stop-opacity="${gs.bo}"/>
    <stop offset="80%" stop-color="${gs.b}" stop-opacity="${gs.far}"/>
    <stop offset="100%" stop-color="${gs.b}" stop-opacity="0"/></radialGradient>`);
  // «туман» по краям вьюпорта (карта уходит за край)
  const fog = dark ? '#161009' : '#f2e8ce';
  P.push(`<linearGradient id="fogT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${fog}" stop-opacity="0.96"/><stop offset="100%" stop-color="${fog}" stop-opacity="0"/></linearGradient>`);
  P.push(`<linearGradient id="fogB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${fog}" stop-opacity="0"/><stop offset="100%" stop-color="${fog}" stop-opacity="0.96"/></linearGradient>`);
  P.push(`<linearGradient id="fogL" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${fog}" stop-opacity="0.9"/><stop offset="100%" stop-color="${fog}" stop-opacity="0"/></linearGradient>`);
  P.push(`<linearGradient id="fogR" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${fog}" stop-opacity="0"/><stop offset="100%" stop-color="${fog}" stop-opacity="0.9"/></linearGradient>`);
  P.push(`<clipPath id="mapClip"><rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}"/></clipPath>`);
  P.push(`<clipPath id="miniClip"><rect x="${panelX + 20}" y="108" width="${PANEL - 40}" height="188" rx="10"/></clipPath>`);
  P.push(iconSymbolDefs());
  P.push('</defs>');

  // ── подложка приложения ──
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${chromeBg}"/>`);

  // ── центральный вьюпорт карты ──
  P.push(`<g clip-path="url(#mapClip)">`);
  P.push(`<rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" filter="url(#paperTex)" opacity="0.5"/>`);
  P.push(`<ellipse cx="${mapX + mapW / 2}" cy="${mapY + mapH * 0.56}" rx="${mapW * 0.5}" ry="${mapH * 0.5}" fill="url(#mapGlow)"/>`);
  P.push(cameraScene(mapX, mapY, mapW, mapH, C, dark));
  // туман по краям
  P.push(`<rect x="${mapX}" y="${mapY}" width="${mapW}" height="86" fill="url(#fogT)"/>`);
  P.push(`<rect x="${mapX}" y="${mapY + mapH - 86}" width="${mapW}" height="86" fill="url(#fogB)"/>`);
  P.push(`<rect x="${mapX}" y="${mapY}" width="70" height="${mapH}" fill="url(#fogL)"/>`);
  P.push(`<rect x="${mapX + mapW - 70}" y="${mapY}" width="70" height="${mapH}" fill="url(#fogR)"/>`);
  // подсказки продолжения
  P.push(`<text x="${mapX + mapW / 2}" y="${mapY + 30}" text-anchor="middle" font-size="12" fill="${C.inkFaint}" font-style="italic">↑ Адам · первые поколения</text>`);
  P.push(`<text x="${mapX + mapW / 2}" y="${mapY + mapH - 18}" text-anchor="middle" font-size="12" fill="${C.inkFaint}" font-style="italic">Церковь · народы мира ↓</text>`);
  P.push(`</g>`);
  P.push(`<rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" fill="none" stroke="${panelEdge}" stroke-width="1"/>`);

  // ── топ-бар ──
  P.push(`<rect x="0" y="0" width="${W}" height="${TOP}" fill="${chromeBg}"/>`);
  P.push(`<line x1="0" y1="${TOP}" x2="${W}" y2="${TOP}" stroke="${panelEdge}" stroke-width="1"/>`);
  P.push(`<circle cx="34" cy="29" r="17" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.4"/>`);
  P.push(iconUse('tree', 22, 17, 24, C.gold));
  P.push(`<text x="62" y="27" font-size="20" fill="${C.ink}" font-weight="bold">Генеалогия Спасителя</text>`);
  P.push(`<text x="62" y="44" font-size="11" fill="${C.gold}" font-style="italic">От Адама до Христа Спасителя</text>`);
  // хлебные крошки (уровень)
  P.push(breadcrumb(408, 29, C, dark));
  // поиск (центр)
  P.push(searchField(W / 2 - 150, 15, 300, C, fieldBg, panelEdge));
  // тема-переключатель + уровень (справа)
  P.push(themeToggle(panelX - 168, 16, C, dark, fieldBg, panelEdge));
  P.push(pill(panelX - 8 - 92, 16, 92, 26, `Обзор · L0`, C, dark, true));

  // ── рейка эпох (слева) ──
  P.push(`<rect x="0" y="${TOP}" width="${RAIL}" height="${H - TOP - STAT}" fill="${chromeBg}"/>`);
  P.push(`<line x1="${RAIL}" y1="${TOP}" x2="${RAIL}" y2="${H - STAT}" stroke="${panelEdge}" stroke-width="1"/>`);
  P.push(eraRail(layoutL0, mapY, mapH, C));

  // ── правая панель-навигатор ──
  P.push(`<rect x="${panelX}" y="${TOP}" width="${PANEL}" height="${H - TOP - STAT}" fill="${panelBg}"/>`);
  P.push(`<line x1="${panelX}" y1="${TOP}" x2="${panelX}" y2="${H - STAT}" stroke="${panelEdge}" stroke-width="1"/>`);
  P.push(rightPanel(layoutL0, panelX, C, dark, fieldBg, panelEdge, views));

  // ── статус-бар ──
  P.push(`<rect x="0" y="${H - STAT}" width="${W}" height="${STAT}" fill="${chromeBg}"/>`);
  P.push(`<line x1="0" y1="${H - STAT}" x2="${W}" y2="${H - STAT}" stroke="${panelEdge}" stroke-width="1"/>`);
  const nMega = layoutL0.nodes.filter(n => n.kind === 'mega').length;
  const namesPart = personsCount ? ` · ${personsCount} имён` : '';
  P.push(`<text x="16" y="${H - 15}" font-size="11.5" fill="${C.inkSoft}">Обзор · золотой хребет Адам → Христос (${layoutL0.nodes.filter(n => n.kind === 'spine').length} вех) · ${nMega} свёрнутых групп${namesPart}</text>`);
  P.push(`<text x="${W - 16}" y="${H - 15}" text-anchor="end" font-size="11.5" fill="${C.inkFaint}">масштаб 42% · зум колёсиком, двойной клик — раскрыть группу</text>`);

  P.push('</svg>');
  return P.join('\n');
}

// ── центральная сцена-камера: часть карты крупно (Авраам→Христос) с ауреолой ──
function cameraScene(mx, my, mw, mh, C, dark) {
  const g = [];
  const cx = mx + mw * 0.5;
  const spineTop = my + 120, spineBot = my + mh - 96;
  // золотая нить
  g.push(`<line x1="${cx}" y1="${spineTop}" x2="${cx}" y2="${spineBot}" stroke="${C.goldGlow}" stroke-width="10" stroke-linecap="round" opacity="0.4" filter="url(#goldSoft)"/>`);
  g.push(`<line x1="${cx}" y1="${spineTop}" x2="${cx}" y2="${spineBot}" stroke="url(#goldGrad)" stroke-width="3.4" stroke-linecap="round"/>`);
  const anchors = [
    { y: spineTop + 40, ru: 'Авраам', ref: 'Быт 11:26', icon: 'tent' },
    { y: spineTop + 190, ru: 'Иаков (Израиль)', ref: 'Быт 25:26', icon: 'ladder' },
    { y: spineTop + 340, ru: 'Давид', ref: 'Руф 4:17', icon: 'crown' },
    { y: spineBot - 20, ru: 'Иисус Христос', ref: 'Мессия · Сын Божий', icon: 'cross', messiah: true },
  ];
  const megas = [
    { y: spineTop + 40, side: -1, ru: 'Потомки Авраама', n: 764, cid: 'abraham-descendants' },
    { y: spineTop + 190, side: 1, ru: '12 колен Израиля', n: 12, cid: 'tribes-12' },
    { y: spineTop + 340, side: -1, ru: 'Дом Давида', n: 173, cid: 'house-of-david' },
    { y: spineTop + 265, side: 1, ru: 'Левиты · священство', n: 266, cid: 'levites' },
    { y: spineBot - 20, side: -1, ru: 'Родословие по Матфею', n: 74, cid: 'matthew-1' },
    { y: spineBot - 20, side: 1, ru: 'Родословие по Луке', n: 75, cid: 'luke-3' },
  ];
  // связки к мегам
  for (const m of megas) {
    const col = CLUSTER_LINE[m.cid] ?? C.relation;
    const bx = cx + m.side * 150, by = m.y;
    const ex = cx + m.side * 300;
    g.push(`<path d="M${f(bx)} ${f(by)} C ${f((bx + ex) / 2)} ${f(by)}, ${f((bx + ex) / 2)} ${f(by)}, ${f(ex)} ${f(by)}" fill="none" stroke="${col}" stroke-width="1.6" opacity="0.6"/>`);
  }
  // мега-карточки
  for (const m of megas) {
    const col = CLUSTER_LINE[m.cid] ?? C.relation;
    const cw = 188, ch = 46;
    const x = m.side < 0 ? cx - 300 - cw : cx + 300;
    const y = m.y - ch / 2;
    g.push(`<g filter="url(#cardShadow)"><rect x="${f(x)}" y="${f(y)}" width="${cw}" height="${ch}" rx="11" fill="url(#megaGrad)" stroke="${C.megaBorder}" stroke-width="1.2"/></g>`);
    g.push(`<rect x="${f(x)}" y="${f(y + 8)}" width="3.5" height="${ch - 16}" rx="2" fill="${col}" opacity="0.8"/>`);
    g.push(iconUse(CLUSTER_ICON[m.cid] ?? 'people', x + 12, y + ch / 2 - 11, 22, col, 0.9));
    g.push(`<text x="${f(x + 42)}" y="${f(y + ch / 2 - 3)}" font-size="13" fill="${C.ink}" font-weight="bold">${esc(m.ru)}</text>`);
    g.push(`<text x="${f(x + 42)}" y="${f(y + ch / 2 + 13)}" font-size="11" fill="${C.gold}">+${m.n} имён</text>`);
  }
  // якоря
  for (const a of anchors) {
    if (a.messiah) {
      const cw = 268, ch = 74;
      const x = cx - cw / 2, y = a.y - ch / 2;
      g.push(christHalo(cx, a.y, Math.max(cw * 0.46, ch * 1.06), C, 0.72, dark));
      g.push(`<g filter="url(#cardShadow)"><rect x="${f(x)}" y="${f(y)}" width="${cw}" height="${ch}" rx="16" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.4"/><rect x="${f(x + 4)}" y="${f(y + 4)}" width="${cw - 8}" height="${ch - 8}" rx="12" fill="none" stroke="url(#goldGrad)" stroke-width="0.9"/></g>`);
      g.push(iconUse('cross', x + 20, a.y - 16, 32, C.gold));
      g.push(`<text x="${f(x + 60)}" y="${f(a.y - 3)}" font-size="22" fill="${C.ink}" font-weight="bold">${esc(a.ru)}</text>`);
      g.push(`<text x="${f(x + 60)}" y="${f(a.y + 18)}" font-size="12" fill="${C.gold}" font-style="italic">${esc(a.ref)}</text>`);
    } else {
      const cw = 214, ch = 52;
      const x = cx - cw / 2, y = a.y - ch / 2;
      g.push(`<g filter="url(#cardShadow)"><rect x="${f(x)}" y="${f(y)}" width="${cw}" height="${ch}" rx="14" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.8"/></g>`);
      g.push(iconUse(a.icon, x + 15, a.y - 13, 26, C.gold));
      g.push(`<text x="${f(x + 50)}" y="${f(a.y - 2)}" font-size="17" fill="${C.ink}" font-weight="bold">${esc(a.ru)}</text>`);
      g.push(`<text x="${f(x + 50)}" y="${f(a.y + 15)}" font-size="10.5" fill="${C.inkFaint}">${esc(a.ref)}</text>`);
    }
  }
  return g.join('');
}

// ── рейка эпох слева ──
function eraRail(layoutL0, mapY, mapH, C) {
  const g = [];
  const eras = layoutL0.eraBands ?? [];
  if (!eras.length) return '';
  const y0 = eras[0].y0, y1 = eras[eras.length - 1].y1, span = y1 - y0 || 1;
  eras.forEach((b, i) => {
    const midFrac = ((b.y0 + b.y1) / 2 - y0) / span;
    const yy = mapY + 40 + midFrac * (mapH - 80);
    const col = ERA_ACCENT[b.id] ?? C.inkSoft;
    g.push(`<circle cx="${RAIL / 2}" cy="${f(yy)}" r="8.5" fill="none" stroke="${C.gold}" stroke-width="0.8" opacity="0.4"/>`);
    g.push(`<circle cx="${RAIL / 2}" cy="${f(yy)}" r="6" fill="${col}" stroke="${C.paper0}" stroke-width="1.4"/>`);
    g.push(`<text x="${RAIL / 2}" y="${f(yy + 22)}" text-anchor="middle" font-size="9.5" letter-spacing="1" fill="${C.inkSoft}">${ROMAN[i + 1] ?? i + 1}</text>`);
  });
  g.push(`<line x1="${RAIL / 2}" y1="${f(mapY + 40)}" x2="${RAIL / 2}" y2="${f(mapY + mapH - 40)}" stroke="${C.gold}" stroke-width="1" opacity="0.25"/>`);
  return g.join('');
}

// ── правая панель ──
function rightPanel(layoutL0, px, C, dark, fieldBg, edge, views) {
  const g = [];
  const x0 = px + 20, innerW = PANEL - 40;
  // заголовок «Навигатор»
  g.push(`<text x="${x0}" y="${TOP + 30}" font-size="12" letter-spacing="2" fill="${C.inkFaint}">НАВИГАТОР КАРТЫ</text>`);
  // миникарта
  const miniY = 108, miniH = 188;
  g.push(`<rect x="${x0}" y="${miniY}" width="${innerW}" height="${miniH}" rx="10" fill="${fieldBg}" stroke="${edge}" stroke-width="1"/>`);
  g.push(`<g clip-path="url(#miniClip)">${miniMap(layoutL0, x0, miniY, innerW, miniH, C)}</g>`);
  g.push(`<text x="${x0 + 8}" y="${miniY + 16}" font-size="9.5" fill="${C.inkFaint}" font-style="italic">вся карта · Адам → Христос</text>`);

  // зум-контролы + семантические уровни
  let y = miniY + miniH + 26;
  g.push(zoomCluster(x0, y, innerW, C, dark, fieldBg, edge));
  y += 96;

  // фильтры линий
  g.push(`<text x="${x0}" y="${y}" font-size="11" letter-spacing="1.5" fill="${C.inkFaint}">ЛИНИИ РОДОСЛОВИЯ</text>`);
  y += 14;
  const lines = [
    ['Мессианская', C.messianic, true], ['Матфей · царская', C.matthew, true],
    ['Лука · кровная', C.luke, true], ['Патриархи · завет', C.patriarch, true],
    ['Побочные линии', C.cainite, false], ['Предание · родство', C.relation, false],
  ];
  lines.forEach((ln, i) => {
    const cxx = x0 + (i % 2) * (innerW / 2), yy = y + Math.floor(i / 2) * 26;
    g.push(`<rect x="${f(cxx)}" y="${f(yy)}" width="16" height="16" rx="4" fill="${ln[2] ? ln[1] : 'none'}" stroke="${ln[1]}" stroke-width="1.5" opacity="${ln[2] ? 1 : 0.6}"/>`);
    if (ln[2]) g.push(`<path d="M${f(cxx + 3.5)} ${f(yy + 8)} l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`);
    g.push(`<text x="${f(cxx + 23)}" y="${f(yy + 12.5)}" font-size="11.5" fill="${C.inkSoft}">${esc(ln[0])}</text>`);
  });
  y += 3 * 26 + 18;

  // быстрые виды — из данных (views.json), не хардкод
  g.push(`<text x="${x0}" y="${y}" font-size="11" letter-spacing="1.5" fill="${C.inkFaint}">БЫСТРЫЕ ВИДЫ</text>`);
  y += 12;
  const items = (views ?? []).map(v => [v.titleRu, v.icon, v.hint ?? '', v.id]);
  items.forEach((v, i) => {
    const yy = y + i * 30;
    const hot = v[3] === 'nations'; // «Народы от Ноя» — подсвечен как только что открытый архетип
    g.push(`<rect x="${x0}" y="${f(yy)}" width="${innerW}" height="26" rx="8" fill="${hot ? (dark ? '#2a2011' : '#f7edd4') : 'none'}" stroke="${hot ? C.gold : edge}" stroke-width="${hot ? 1.3 : 0.8}" opacity="${hot ? 1 : 0.7}"/>`);
    g.push(iconUse(v[1], x0 + 8, yy + 4, 18, hot ? C.gold : C.inkSoft, 0.9));
    g.push(`<text x="${x0 + 34}" y="${f(yy + 17)}" font-size="12" fill="${C.ink}">${esc(v[0])}</text>`);
    g.push(`<text x="${x0 + innerW - 8}" y="${f(yy + 17)}" text-anchor="end" font-size="9.5" fill="${C.inkFaint}">${esc(v[2])}</text>`);
  });
  return g.join('');
}

// ── миникарта из реальной раскладки L0 ──
function miniMap(layoutL0, x, y, w, h, C) {
  const bb = layoutL0.bbox;
  const pad = 16;
  const scale = Math.min((w - pad * 2) / bb.w, (h - pad * 2) / bb.h);
  const ox = x + (w - bb.w * scale) / 2, oy = y + (h - bb.h * scale) / 2;
  const tx = n => ox + (n - bb.x) * scale;
  const ty = n => oy + (n - bb.y) * scale;
  const g = [];
  const spine = layoutL0.nodes.filter(n => n.kind === 'spine');
  if (spine.length > 1) {
    g.push(`<line x1="${f(tx(spine[0].x + spine[0].w / 2))}" y1="${f(ty(spine[0].y))}" x2="${f(tx(spine[0].x + spine[0].w / 2))}" y2="${f(ty(spine[spine.length - 1].y + spine[spine.length - 1].h))}" stroke="${C.gold}" stroke-width="2" stroke-linecap="round" opacity="0.9"/>`);
  }
  for (const n of layoutL0.nodes) {
    const isSpine = n.kind === 'spine';
    const col = isSpine ? C.gold : (CLUSTER_LINE[n.clusterId] ?? C.relation);
    const r = isSpine ? (n.messiah ? 3.6 : 2.6) : 2;
    g.push(`<circle cx="${f(tx(n.x + n.w / 2))}" cy="${f(ty(n.y + n.h / 2))}" r="${r}" fill="${col}" opacity="${isSpine ? 1 : 0.7}"/>`);
  }
  // прямоугольник текущего вида — из РЕАЛЬНЫХ якорей сцены (Авраам→Христос),
  // не из хардкод-долей: миникарта честна к камере
  const ab = layoutL0.nodes.find(n => n.key === 'Abraham@Gen.11.26');
  const ms = layoutL0.nodes.find(n => n.messiah);
  let vx, vy, vw, vh;
  if (ab && ms) {
    const y0 = ab.y - 60, y1 = ms.y + ms.h + 60;
    vx = ox + 6; vw = bb.w * scale - 12;
    vy = ty(y0); vh = ty(y1) - ty(y0);
  } else {
    vx = ox + bb.w * scale * 0.16; vw = bb.w * scale * 0.68;
    vy = oy + bb.h * scale * 0.52; vh = bb.h * scale * 0.46;
  }
  g.push(`<rect x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" rx="3" fill="${C.gold}" fill-opacity="0.1" stroke="${C.gold}" stroke-width="1.5"/>`);
  return g.join('');
}

// ── зум-кластер: +/−, по размеру, уровни L0/L1/L2 ──
function zoomCluster(x, y, w, C, dark, fieldBg, edge) {
  const g = [];
  const btn = (bx, by, s, label, big) => {
    g.push(`<rect x="${f(bx)}" y="${f(by)}" width="34" height="34" rx="8" fill="${fieldBg}" stroke="${edge}" stroke-width="1"/>`);
    g.push(`<text x="${f(bx + 17)}" y="${f(by + (big ? 24 : 23))}" text-anchor="middle" font-size="${big ? 22 : 15}" fill="${C.inkSoft}">${label}</text>`);
  };
  btn(x, y, 34, '+', true); btn(x + 40, y, 34, '−', true);
  // «по размеру»
  g.push(`<rect x="${f(x + 80)}" y="${f(y)}" width="34" height="34" rx="8" fill="${fieldBg}" stroke="${edge}" stroke-width="1"/>`);
  g.push(`<path d="M${f(x + 88)} ${f(y + 12)} v-4 h4 M${f(x + 106)} ${f(y + 12)} v-4 h-4 M${f(x + 88)} ${f(y + 22)} v4 h4 M${f(x + 106)} ${f(y + 22)} v4 h-4" fill="none" stroke="${C.inkSoft}" stroke-width="1.4" stroke-linecap="round"/>`);
  // семантические уровни
  const lx = x + 130, lw = w - 130;
  g.push(`<text x="${f(lx)}" y="${f(y - 4)}" font-size="9" letter-spacing="1" fill="${C.inkFaint}">УРОВЕНЬ ЗУМА</text>`);
  const levels = ['L0', 'L1', 'L2'];
  const seg = lw / 3;
  levels.forEach((lv, i) => {
    const active = i === 0;
    const bx = lx + i * seg;
    g.push(`<rect x="${f(bx)}" y="${f(y)}" width="${f(seg - 4)}" height="34" rx="7" fill="${active ? C.gold : fieldBg}" stroke="${active ? C.gold : edge}" stroke-width="1"/>`);
    g.push(`<text x="${f(bx + (seg - 4) / 2)}" y="${f(y + 16)}" text-anchor="middle" font-size="12" fill="${active ? (dark ? '#1c150c' : '#fff') : C.inkSoft}" font-weight="bold">${lv}</text>`);
    g.push(`<text x="${f(bx + (seg - 4) / 2)}" y="${f(y + 28)}" text-anchor="middle" font-size="7.5" fill="${active ? (dark ? '#1c150c' : '#fff') : C.inkFaint}">${['обзор', 'группы', 'лица'][i]}</text>`);
  });
  return g.join('');
}

// ── мелкие UI-элементы ──
function searchField(x, y, w, C, fieldBg, edge) {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="28" rx="14" fill="${fieldBg}" stroke="${edge}" stroke-width="1"/>
    <circle cx="${f(x + 16)}" cy="${f(y + 14)}" r="5" fill="none" stroke="${C.inkFaint}" stroke-width="1.4"/>
    <line x1="${f(x + 20)}" y1="${f(y + 18)}" x2="${f(x + 24)}" y2="${f(y + 22)}" stroke="${C.inkFaint}" stroke-width="1.4" stroke-linecap="round"/>
    <text x="${f(x + 30)}" y="${f(y + 18.5)}" font-size="12.5" fill="${C.inkFaint}" font-style="italic">Поиск имени, места или стиха…</text>`;
}

function breadcrumb(x, y, C) {
  return `<text x="${f(x)}" y="${f(y + 5)}" font-size="12.5" fill="${C.inkFaint}">Обзор</text>
    <text x="${f(x + 52)}" y="${f(y + 5)}" font-size="12.5" fill="${C.inkFaint}">›</text>
    <text x="${f(x + 66)}" y="${f(y + 5)}" font-size="12.5" fill="${C.gold}">Хребет Спасителя</text>`;
}

function pill(x, y, w, h, label, C, dark, gold) {
  return `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx="${h / 2}" fill="${gold ? (dark ? '#2a2011' : '#f7edd4') : 'none'}" stroke="${gold ? C.gold : C.inkFaint}" stroke-width="1.2"/>
    <text x="${f(x + w / 2)}" y="${f(y + h / 2 + 4)}" text-anchor="middle" font-size="12" fill="${gold ? C.gold : C.inkSoft}">${esc(label)}</text>`;
}

function themeToggle(x, y, C, dark, fieldBg, edge) {
  const on = dark;
  const gx = x + (on ? 15 : 32), gy = y + 13; // глиф на свободной половине
  // солнце/луна рисуются путями (текстовые ☀/☾ фолбэчат в шрифте на «‹»)
  const glyph = on
    ? `<path d="M${f(gx + 2.6)} ${f(gy - 4.4)} a4.6 4.6 0 1 0 2.4 8.1 5.4 5.4 0 0 1 -2.4 -8.1z" fill="${C.inkFaint}"/>`
    : `<circle cx="${f(gx)}" cy="${f(gy)}" r="2.8" fill="none" stroke="${C.inkFaint}" stroke-width="1.1"/>
       <g stroke="${C.inkFaint}" stroke-width="1" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
    const r = a * Math.PI / 180, x1 = gx + Math.cos(r) * 4.2, y1 = gy + Math.sin(r) * 4.2, x2 = gx + Math.cos(r) * 5.8, y2 = gy + Math.sin(r) * 5.8;
    return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
  }).join('')}</g>`;
  return `<rect x="${f(x)}" y="${f(y)}" width="52" height="26" rx="13" fill="${fieldBg}" stroke="${edge}" stroke-width="1"/>
    <circle cx="${f(x + (on ? 39 : 13))}" cy="${f(y + 13)}" r="9" fill="${C.gold}"/>
    ${glyph}`;
}
