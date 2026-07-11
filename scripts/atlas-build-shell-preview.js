#!/usr/bin/env node
/**
 * atlas-build-shell-preview.js — генератор ЖИВОГО ПРОТОТИПА оболочки Атласа (KA-4 preview).
 *
 * Выход: audit/atlas-preview/index.html — самодостаточный HTML (без внешних зависимостей),
 * в SAFE-зоне audit/ (НЕ production, НЕ витрина, не попадает в контрактные проверки dist).
 * Назначение: owner-review «духа макетов» на РЕАЛЬНЫХ данных реестров data/atlas/**.
 *
 * v2 (визуальный проход по фидбеку владельца «сыровато»):
 *   - sticky-колонка подписей полос (не уезжает при горизонтальном скролле шкалы);
 *   - глубина: SVG-градиенты сегментов, чередование фона полос, капсульные чипы эпох;
 *   - hero-шапка с инлайн-гравюрной компас-розой и ивритом;
 *   - вкладки с инлайн-иконками; секции с декоративными разделителями;
 *   - карточки карт с hero-зоной 16:9: если existsSync images/atlas-<slug>-scene-600w.webp —
 *     подставляется ОБЛОЖКА (конвенция §8.2 VISUAL-DIRECTION), иначе стильный плейсхолдер
 *     сградиентом эпохи карты — владелец пришлёт сцены, они лягут без правок кода;
 *   - интерактив: hover чипа эпохи подсвечивает вертикальный диапазон на всей шкале;
 *   - резолвер подписей сегментов: видимый участок → центр пилюли → переполнение в
 *     пустые соседние промежутки; развязка текст-против-текста сдвигом в пределах
 *     пилюли, при невозможности — приоритет более широкой (у скрытой остаётся тултип).
 *
 * Палитра статусов оценок царей валидирована skill-скриптом dataviz на поверхности
 * #f6f1e7: good #15803d / evil #b91c1c / mixed #a16207 (PASS; CVD-warn в легальной зоне —
 * оценка всегда дублируется словом в тултипе). Чипы эпох — draft-токены periods/*.
 *
 * Перегенерация: node scripts/atlas-build-shell-preview.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const A = (d) => path.join(ROOT, 'data', 'atlas', d);
const OUT = path.join(ROOT, 'audit', 'atlas-preview', 'index.html');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const loadDir = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_index.json').map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  : [];

const timeline = JSON.parse(fs.readFileSync(path.join(A('generated'), 'timeline-kings-prophets.json'), 'utf8'));
const books = loadDir(A('books')).sort((a, b) => a.order - b.order);
const periodsAll = loadDir(A('periods'));
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas-inventory-baseline.json'), 'utf8'));
const routeMeta = {};
for (const m of inventory.maps) {
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'karty', m.slug, 'route.json'), 'utf8'));
  routeMeta[m.slug] = { title: (r.meta && r.meta.title) || m.slug, era: (r.meta && r.meta.era) || '' };
}

// ── Хронополоса (SVG, без label-колонки: подписи — sticky HTML слева) ────────
const R = timeline.range;
const PX_PER_YEAR = 1.9;
const PAD_L = 14, PAD_R = 26;
const W = PAD_L + (R.end - R.start) * PX_PER_YEAR + PAD_R;
const X = (y) => PAD_L + (y - R.start) * PX_PER_YEAR;
const STATUS = { good: '#15803d', evil: '#b91c1c', mixed: '#a16207' };
const STATUS_RU = { good: 'добрый царь («делал угодное»)', evil: 'злой царь («делал неугодное»)', mixed: 'смешанная оценка' };
const REALM_RU = { assyria: 'Ассирия', babylon: 'Вавилон', persia: 'Персия' };
const yearRu = (y) => (y < 0 ? `${-y} до Р.Х.` : `${y} по Р.Х.`);
const tipAttr = (title, rest) => `data-tip-t="${esc(title)}" data-tip="${esc(rest)}"`;

const svg = [];
const bands = [];      // чередующиеся подложки полос
const labelRows = [];  // {y,h,text,cls} → sticky HTML
let Y = 10;

function lane(text, h, cls) { labelRows.push({ y: Y, h, text, cls: cls || '' }); }
function groupCaption(text) {
  labelRows.push({ y: Y, h: 16, text, cls: 'group' });
  svg.push(`<line x1="${PAD_L}" y1="${Y + 12}" x2="${W - PAD_R}" y2="${Y + 12}" class="group-line"/>`);
  Y += 20;
}

// Чипы эпох (капсулы)
{
  const h = 30; lane('Эпоха', h, 'era');
  for (const p of timeline.periods) {
    const x = X(p.start), w = X(p.end) - x;
    svg.push(`<g class="era-chip" data-x1="${x}" data-x2="${x + w}" ${tipAttr(p.label, `${yearRu(p.start)} — ${yearRu(p.end)}${p.colorStatus === 'draft' ? ' · цвет draft (KA-6)' : ''}`)}>` +
      `<rect x="${x + 1}" y="${Y + 1}" width="${Math.max(w - 4, 2)}" height="${h - 2}" rx="${(h - 2) / 2}" fill="${p.color || '#e5dcc4'}" class="era-pill"/>` +
      `<rect x="${x + 5}" y="${Y + 3.5}" width="${Math.max(w - 12, 2)}" height="${(h - 2) / 2.7}" rx="${(h - 2) / 5}" fill="rgba(255,255,255,.32)" pointer-events="none"/>` +
      (w > 84 ? `<text x="${x + w / 2}" y="${Y + h / 2 + 4}" text-anchor="middle" class="chip-text">${esc(p.label)}</text>`
        : w > p.label.length * 6.2 + 8 ? `<text x="${x + w / 2}" y="${Y + h / 2 + 3.5}" text-anchor="middle" class="chip-text chip-text-sm">${esc(p.label)}</text>` : '') + `</g>`);
  }
  Y += h + 12;
}

groupCaption('Престолы');
// Самый широкий участок сегмента i, не накрытый пилюлями, нарисованными ПОЗЖЕ него
// (порядок отрисовки = порядок массива): туда и ставим подпись при сорегентствах.
function visibleRun(segs, i) {
  let runs = [[segs[i].start, segs[i].end]];
  for (let j = i + 1; j < segs.length; j++) {
    const o = segs[j];
    runs = runs.flatMap(([a, b]) => {
      if (o.end <= a || o.start >= b) return [[a, b]];
      const out = [];
      if (o.start > a) out.push([a, o.start]);
      if (o.end < b) out.push([o.end, b]);
      return out;
    });
  }
  return runs.reduce((best, r) => (r[1] - r[0] > best[1] - best[0] ? r : best), [0, 0]);
}

// Кандидат подписи: центр видимого участка, если он вмещает текст; иначе центр полной
// пилюли (текст поверх светлой сорегентской пилюли читается). null — если не влезает никак.
function labelCandidate(segs, i, pxPerChar) {
  const s = segs[i];
  const need = s.label.length * pxPerChar + 10;
  const half = need / 2, pillW = X(s.end) - X(s.start);
  // Пределы сдвига центра: текст обязан остаться в границах СВОЕЙ пилюли.
  const minCx = X(s.start) + half - 2, maxCx = X(s.end) - half + 2;
  const [va, vb] = visibleRun(segs, i);
  if (X(vb) - X(va) > need) return { cx: (X(va) + X(vb)) / 2, half, pillW, minCx, maxCx, label: s.label };
  if (pillW > need) return { cx: (X(s.start) + X(s.end)) / 2, half, pillW, minCx, maxCx, label: s.label };
  // Изолированная пилюля: разрешаем подписи выступать в ПУСТЫЕ соседние промежутки
  // (до 18px на сторону) — так подписываются Салманасар III, Навуходоносор и т.п.
  const over = (need - pillW) / 2;
  if (over <= 18) {
    let gapL = X(s.start) - PAD_L, gapR = (W - PAD_R) - X(s.end);
    for (let j = 0; j < segs.length && (gapL > 0 || gapR > 0); j++) {
      if (j === i) continue;
      const o = segs[j];
      if (o.end <= s.start) gapL = Math.min(gapL, X(s.start) - X(o.end));
      else if (o.start >= s.end) gapR = Math.min(gapR, X(o.start) - X(s.end));
      else { gapL = 0; gapR = 0; } // пересечение (сорегентство) — не выступаем
    }
    if (gapL >= over + 3 && gapR >= over + 3) {
      const cx = (X(s.start) + X(s.end)) / 2;
      return { cx, half, pillW, minCx: cx, maxCx: cx, label: s.label };
    }
  }
  return null;
}

// Развязка текст-против-текста: сперва пытаемся раздвинуть подписи в пределах их пилюль,
// и только если места нет — выживает та, чья пилюля шире (у скрытой остаётся тултип).
function resolveLabels(cands) {
  const PAD = 3;
  const sorted = cands.filter(Boolean).sort((a, b) => a.cx - b.cx);
  const out = [];
  for (const c of sorted) {
    const prev = out[out.length - 1];
    if (prev && c.cx - c.half < prev.cx + prev.half + PAD) {
      let deficit = (prev.cx + prev.half + PAD) - (c.cx - c.half);
      const pushRight = Math.min(deficit, c.maxCx - c.cx);
      c.cx += pushRight; deficit -= pushRight;
      if (deficit > 0) {
        const pushLeft = Math.min(deficit, prev.cx - prev.minCx);
        prev.cx -= pushLeft; deficit -= pushLeft;
      }
      if (deficit > 0.5) { // раздвинуть не вышло — оставляем более широкую пилюлю
        if (c.pillW > prev.pillW) out[out.length - 1] = c;
        continue;
      }
    }
    out.push(c);
  }
  return out;
}

function kingsLane(name, segs, band) {
  const h = 32; lane(name, h);
  if (band) bands.push(`<rect x="${PAD_L}" y="${Y - 2}" width="${W - PAD_L - PAD_R}" height="${h + 2}" class="band"/>`);
  const cands = segs.map((s, i) => {
    const x = X(s.start), w = Math.max(X(s.end) - x, 3);
    const rest = `${yearRu(s.start)} — ${yearRu(s.end)}` +
      (s.assessment ? ` · ${STATUS_RU[s.assessment]}` : '') +
      (s.dynasty ? ` · династия: ${s.dynasty}` : '') + (s.coregency ? ' · сорегентство / параллельное правление' : '');
    svg.push(`<g ${tipAttr(s.labelFull || s.label, rest)}>` +
      `<rect x="${x}" y="${Y}" width="${Math.max(w - 2.5, 2)}" height="${h - 7}" rx="5" class="seg${s.coregency ? ' coreg' : ''}"/>` +
      (s.assessment ? `<rect x="${x + 1.5}" y="${Y + h - 10}" width="${Math.max(w - 5.5, 2)}" height="3" rx="1.5" fill="${STATUS[s.assessment]}" opacity=".9"/>` : '') + `</g>`);
    return labelCandidate(segs, i, 6.6);
  });
  for (const c of resolveLabels(cands)) {
    svg.push(`<text x="${c.cx}" y="${Y + h / 2 - 0.5}" text-anchor="middle" class="seg-text">${esc(c.label)}</text>`);
  }
  Y += h + 5;
}
kingsLane('Единое царство', timeline.lanes.united, false);
kingsLane('Израиль · север', timeline.lanes.israel, true);
kingsLane('Иудея · юг', timeline.lanes.judah, false);
Y += 6;

groupCaption('Пророки');
function prophetLane(name, segs, band) {
  const rowH = 21, gap = 3;
  const tracks = [];
  const placed = segs.map((s) => {
    let t = tracks.findIndex((endX) => X(s.start) >= endX + 5);
    if (t === -1) { tracks.push(0); t = tracks.length - 1; }
    tracks[t] = X(s.end);
    return { s, t };
  });
  const h = tracks.length * rowH + (tracks.length - 1) * gap;
  lane(name, h);
  if (band) bands.push(`<rect x="${PAD_L}" y="${Y - 2}" width="${W - PAD_L - PAD_R}" height="${h + 4}" class="band"/>`);
  for (const { s, t } of placed) {
    const x = X(s.start), w = Math.max(X(s.end) - x, 5);
    const yy = Y + t * (rowH + gap);
    const rest = `служение ~${yearRu(s.start)} — ${yearRu(s.end)}` + (s.bookAbbrs && s.bookAbbrs.length ? ` · книга: ${s.bookAbbrs.join(', ')}` : ' · устный пророк');
    svg.push(`<g ${tipAttr(s.labelFull || s.label, rest)}>` +
      `<rect x="${x}" y="${yy}" width="${Math.max(w - 2.5, 3)}" height="${rowH - 3}" rx="${(rowH - 3) / 2}" class="prophet-seg${s.bookAbbrs && s.bookAbbrs.length ? ' writing' : ''}"/>` +
      (w > s.label.length * 5.8 + 8 ? `<text x="${x + w / 2}" y="${yy + rowH / 2 + 2.5}" text-anchor="middle" class="prophet-text">${esc(s.label)}</text>` : '') + `</g>`);
  }
  Y += h + 5;
}
prophetLane('Север', timeline.lanes['prophets-north'], false);
prophetLane('Юг', timeline.lanes['prophets-south'], true);
prophetLane('Плен и возвращение', timeline.lanes['prophets-exile'], false);
Y += 6;

groupCaption('Империи');
{
  const h = 28; lane('Ассирия → Персия', h);
  let prevRealm = null;
  const emp = timeline.lanes.empires;
  const cands = emp.map((s, i) => {
    const x = X(s.start), w = Math.max(X(s.end) - x, 3);
    if (s.realm !== prevRealm) {
      svg.push(`<text x="${x + 2}" y="${Y - 4}" class="realm-caption">${esc(REALM_RU[s.realm] || s.realm)}</text>`);
      if (prevRealm) svg.push(`<line x1="${x - 1.5}" y1="${Y - 14}" x2="${x - 1.5}" y2="${Y + h - 2}" class="realm-sep"/>`);
      prevRealm = s.realm;
    }
    svg.push(`<g ${tipAttr(s.labelFull || s.label, `${REALM_RU[s.realm] || s.realm} · ${yearRu(s.start)} — ${yearRu(s.end)}`)}>` +
      `<rect x="${x}" y="${Y}" width="${Math.max(w - 2.5, 2)}" height="${h - 6}" rx="5" class="emp-seg"/></g>`);
    return labelCandidate(emp, i, 6.2);
  });
  for (const c of resolveLabels(cands)) {
    svg.push(`<text x="${c.cx}" y="${Y + h / 2 + 1}" text-anchor="middle" class="seg-text">${esc(c.label)}</text>`);
  }
  Y += h + 6;
}

groupCaption('События');
{
  const h = 26; lane('Вехи', h);
  for (const e of timeline.events) {
    const x = X(e.year); const cy = Y + 10;
    const rest = `${e.approx ? '~' : ''}${yearRu(e.year)}` + (e.extraBiblical ? ' · ✦ есть внебиблейское свидетельство (см. реестр событий)' : '');
    if (e.extraBiblical) {
      svg.push(`<g ${tipAttr(e.label, rest)}><path d="M${x},${cy - 8} L${x + 2.4},${cy - 2.4} L${x + 8},${cy} L${x + 2.4},${cy + 2.4} L${x},${cy + 8} L${x - 2.4},${cy + 2.4} L${x - 8},${cy} L${x - 2.4},${cy - 2.4} Z" class="event-star"/></g>`);
    } else {
      svg.push(`<g ${tipAttr(e.label, rest)}><path d="M${x},${cy - 6.5} l5.5,6.5 l-5.5,6.5 l-5.5,-6.5 z" class="event-mark"/></g>`);
    }
  }
  Y += h;
}

// Ось лет (подпись оси — в sticky-колонке, чтобы была видна без прокрутки)
labelRows.push({ y: Y + 6, h: 18, text: 'годы до Р.Х.', cls: 'axis' });
const axis = [];
for (let y = Math.ceil(R.start / 25) * 25; y <= R.end; y += 25) {
  if (y % 50 === 0) {
    axis.push(`<line x1="${X(y)}" y1="6" x2="${X(y)}" y2="${Y}" class="grid"/>`);
    axis.push(`<text x="${X(y)}" y="${Y + 16}" text-anchor="middle" class="axis-year${y % 100 === 0 ? ' century' : ''}">${-y}</text>`);
  } else {
    axis.push(`<line x1="${X(y)}" y1="${Y - 3}" x2="${X(y)}" y2="${Y + 3}" class="grid-minor"/>`); // минорный тик 25 лет
  }
}
const H = Y + 26;

const timelineSvg =
  `<svg id="tl" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Синхронная шкала: эпохи, цари, пророки, империи и события; подробности — в подсказках и в таблице ниже">` +
  `<defs>` +
  `<linearGradient id="gSeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f1e0"/><stop offset="1" stop-color="#eadfc2"/></linearGradient>` +
  `<linearGradient id="gProph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef4f9"/><stop offset="1" stop-color="#d9e6f0"/></linearGradient>` +
  `<linearGradient id="gEmp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4e7e0"/><stop offset="1" stop-color="#e6cfc4"/></linearGradient>` +
  `<pattern id="pCoreg" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">` +
  `<rect width="6" height="6" fill="#f4eedc"/><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(185,138,47,.4)" stroke-width="1.6"/></pattern>` +
  `</defs>` +
  bands.join('') + axis.join('') +
  `<rect id="era-hl" x="0" y="4" width="0" height="${Y - 2}" class="era-hl" opacity="0"/>` +
  svg.join('') +
  `<line id="xhair" x1="0" y1="6" x2="0" y2="${Y}" class="xhair" opacity="0"/>` + `</svg>`;

const labelsHtml = labelRows.map((r) =>
  `<div class="tl-lab ${r.cls}" style="top:${r.y}px;height:${r.h}px">${esc(r.text)}</div>`).join('');

// ── Таблица (a11y/данные) ────────────────────────────────────────────────────
const tableRows = [];
for (const [laneKey, ru] of [['united', 'Единое царство'], ['israel', 'Израиль'], ['judah', 'Иудея']]) {
  for (const s of timeline.lanes[laneKey]) tableRows.push(`<tr><td>${ru}</td><td>${esc(s.labelFull || s.label)}</td><td>${esc(yearRu(s.start))} — ${esc(yearRu(s.end))}</td><td>${s.assessment ? esc(STATUS_RU[s.assessment]) : '—'}</td></tr>`);
}

// ── Инлайн-иконки (штриховые, единый вес 1.6) ────────────────────────────────
const IC = {
  time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2.2"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5.5C6 4.3 8.5 4.3 12 5.8c3.5-1.5 6-1.5 8-.3V18c-2-1.2-4.5-1.2-8 .3-3.5-1.5-6-1.5-8-.3z"/><path d="M12 5.8V18.3"/></svg>',
  theme: '<svg viewBox="0 0 24 24"><path d="M12 3.5l8 4.5-8 4.5-8-4.5z"/><path d="M4 12.5l8 4.5 8-4.5"/><path d="M4 16.5l8 4.5 8-4.5"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4.5L4 6.5v13l5-2 6 2 5-2v-13l-5 2z"/><path d="M9 4.5v13M15 6.5v13"/></svg>',
  route: '<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8 16.5C11 14 9 10.5 12.5 9c2-.9 3-1.4 3.8-1.6" stroke-dasharray="3 2.6"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M4 17.5h16M4.5 16l-1-8 4.8 3.4L12 5.5l3.7 5.9L20.5 8l-1 8z"/></svg>',
  region: '<svg viewBox="0 0 24 24"><path d="M5 6.5l4.5-2 5 2.5 4.5-1.5v12l-4.5 2-5-2.5-4.5 1.5z"/></svg>',
  city: '<svg viewBox="0 0 24 24"><path d="M4 19.5V9.8L8 7v12.5M8 12h4V7.8L16 5v14.5M16 10h4v9.5M2.5 19.5h19"/></svg>',
  layers: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="11" cy="16" r="2"/><path d="M3.5 20.5h17"/></svg>',
  compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5-5 2.2 2.2-5z"/></svg>',
  scroll: '<svg viewBox="0 0 24 24"><path d="M7 4.5h11a2 2 0 012 2v0a2 2 0 01-2 2H7"/><path d="M7 4.5a2 2 0 00-2 2v11a2 2 0 002 2h9.5a2.5 2.5 0 002.5-2.5V8.5"/><path d="M8.5 10.5h6M8.5 14h6"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.3 3.9 5.2 3.9 8.5s-1.3 6.2-3.9 8.5c-2.6-2.3-3.9-5.2-3.9-8.5s1.3-6.2 3.9-8.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l1.8 5.4 5.7.1-4.6 3.4 1.7 5.5-4.6-3.3-4.6 3.3 1.7-5.5-4.6-3.4 5.7-.1z"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.4-6.5-10.2a6.5 6.5 0 0113 0C18.5 15.6 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/></svg>',
  north: '<svg viewBox="0 0 24 24"><path d="M12 3l3.5 9-3.5-2-3.5 2z"/><path d="M12 12v9"/></svg>',
};
const ic = (name, cls) => `<span class="ic ${cls || ''}" aria-hidden="true">${IC[name]}</span>`;

// ── Ось «По книгам» ──────────────────────────────────────────────────────────
const SECTIONS = [['law', 'Закон · Тора', 'I'], ['history', 'Исторические книги', 'II'], ['poetry', 'Учительные', 'III'], ['major-prophets', 'Большие пророки', 'IV'], ['minor-prophets', 'Малые пророки', 'V'], ['gospels', 'Евангелия', 'VI'], ['acts', 'Деяния апостолов', 'VII'], ['pauline', 'Послания Павла', 'VIII'], ['general', 'Соборные послания', 'IX'], ['revelation', 'Откровение', 'X']];
const booksHtml = SECTIONS.map(([sec, ru, num]) => {
  const list = books.filter((b) => b.section === sec);
  const covered = list.filter((b) => b.maps && b.maps.length).length;
  const pct = list.length ? Math.round((covered / list.length) * 100) : 0;
  return `<div class="book-sec">` +
    `<div class="book-sec-head"><span class="book-num">${num}</span><h4>${ru}</h4>` +
    `<span class="book-cov">${covered ? `${covered} из ${list.length} с картами` : ''}</span></div>` +
    (covered ? `<div class="book-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>` : '') +
    `<div class="chips">` + list.map((b) => {
      const has = b.maps && b.maps.length;
      const tipA = `data-tip-t="${esc(b.title.ru)}" data-tip="${esc(`${b.chapters} гл.` + (has ? ` · карты: ${b.maps.join(', ')} · клик — открыть` : ' · карт пока нет'))}"`;
      return has
        ? `<a class="chip has-map" href="../../karty/${b.maps[0]}/" ${tipA}>${esc(b.title.abbr)}<sup>${b.maps.length}</sup></a>`
        : `<span class="chip" tabindex="0" ${tipA}>${esc(b.title.abbr)}</span>`;
    }).join('') + `</div></div>`;
}).join('');

// ── Ось «По темам» ───────────────────────────────────────────────────────────
// [иконка, заголовок, {живые карты: title→slug}, план §9]
const THEMES = [
  ['route', 'Маршруты и путешествия', { 'Путь Авраама': 'avraam', 'Исход': 'ishod', 'Путешествия Павла': 'pavel', 'Жизнь Иисуса': 'yeshua' }, 'Давид · Иаков и Иосиф · Илия и Елисей'],
  ['crown', 'Царства и границы', { 'Царства Израиля и Иудеи': 'melachim', 'Эпоха Судей': 'shoftim', 'Маккавеи': 'maccabim' }, 'Четыре царства Даниила · Мир Ирода'],
  ['region', 'Территории и уделы', { '12 колен Израиля': 'shvatim' }, 'Таблица народов'],
  ['city', 'Планы городов', null, 'Иерусалим по эпохам · Вавилон Даниила'],
  ['layers', 'Тематические слои', { '7 церквей Откровения': 'revelation', 'Ранняя Церковь': 'early-church' }, 'Пророчества о народах'],
  ['compass', 'Обзор и вход', null, 'Земля Библии · Хронология · Сравнение эпох'],
];
const themesHtml = `<div class="themes-grid">` + THEMES.map(([icn, t, now, plan]) =>
  `<div class="theme-card"><span class="theme-medal">${ic(icn, 'theme-ic')}</span><h4>${esc(t)}</h4>` +
  (now
    ? `<div class="theme-thumbs">` + Object.entries(now).map(([title, slug]) =>
        `<a class="thumb" href="../../karty/${slug}/" title="${esc(title)}" style="background-image:url('../../images/atlas-${slug}-scene-600w.webp')"><span>${esc(title)}</span></a>`).join('') + `</div>`
    : `<p class="theme-now theme-empty">карт пока нет — направление открывается каталогом</p>`) +
  `<div class="plan-chips">` + plan.split(' · ').map((x) => `<span class="plan-chip">${esc(x)}</span>`).join('') + `</div></div>`).join('') + `</div>` +
  `<p class="note">Обложки-миниатюры — живые карты (клик — открыть); пунктирные чипы — целевой каталог §9, волны KA-6…KA-9.</p>`;

// ── Карточки карт (hero-слот под будущие обложки-сцены §8.2) ────────────────
const periodById = new Map(periodsAll.map((p) => [p.id, p]));
const mapPeriod = new Map();
for (const p of periodsAll) for (const m of p.maps || []) if (!mapPeriod.has(m)) mapPeriod.set(m, p);
const ARCH_ICON = { avraam: 'route', ishod: 'route', pavel: 'route', melachim: 'crown', maccabim: 'crown', shvatim: 'region', shoftim: 'crown', yeshua: 'route', 'early-church': 'layers', revelation: 'layers' };
// era-токены route.json → русская подпись (ярлыки материальной культуры, ATLAS-CONTRACT §2-бис)
const ERA_RU = {
  bronze: 'бронзовый век · эпоха патриархов',
  bronze_late: 'поздняя бронза · Исход и завоевание',
  iron: 'железный век · эпоха царств',
  hellenistic: 'эллинизм · междузаветье',
  roman: 'римская эпоха · Новый Завет',
};
const plural = (n, [one, few, many]) => {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many}`;
};
// Пилюля hero-статистики: <b>N</b> слово (правильная русская форма)
const hmPill = (n, forms) => `<b>${n}</b> ${plural(n, forms).replace(/^\d+ /, '')}`;
const ST_ORDER = { live: 0, semi: 1, hold: 2 };
const mapsSorted = inventory.maps.map((m) => {
  const st = m.slug === 'avraam' ? ['live', 'на витрине'] : (m.publication === 'none' ? ['semi', 'production · вне витрины'] : ['hold', 'на аудите']);
  return { m, st };
}).sort((a, b) => ST_ORDER[a.st[0]] - ST_ORDER[b.st[0]]);

const mapsHtml = `<div class="maps-grid">` + mapsSorted.map(({ m, st }) => {
  const meta = routeMeta[m.slug];
  const per = mapPeriod.get(m.slug);
  const tone = (per && per.colorToken) || '#d9c69a';
  const cover600 = path.join(ROOT, 'images', `atlas-${m.slug}-scene-600w.webp`);
  const hasCover = fs.existsSync(cover600);
  const hero = hasCover
    ? `<img src="../../images/atlas-${m.slug}-scene-600w.webp"
         srcset="../../images/atlas-${m.slug}-scene-600w.webp 600w, ../../images/atlas-${m.slug}-scene-900w.webp 900w, ../../images/atlas-${m.slug}-scene-1200w.webp 1200w"
         sizes="(max-width:720px) 92vw, 300px" width="600" height="338" alt="" loading="lazy" decoding="async">` +
      `<span class="hero-shade" aria-hidden="true"></span>`
    : `<div class="map-hero-ph" style="--tone:${tone}">${ic(ARCH_ICON[m.slug] || 'map', 'hero-ic')}</div>`;
  return `<a class="map-card" href="../../karty/${m.slug}/">` +
    `<div class="map-hero">${hero}<span class="map-status ${st[0]}">${st[1]}</span></div>` +
    `<div class="map-body"><h4>${esc(meta.title)}</h4>` +
    `<div class="map-era">${esc(ERA_RU[meta.era] || meta.era || (per ? per.title.ru : ''))}</div>` +
    `<div class="map-meta">` +
    `<span class="mm">${ic('pin')}${plural(m.counts.places, ['место', 'места', 'мест'])}</span>` +
    `<span class="mm">${ic('route')}${plural(m.counts.stages, ['этап', 'этапа', 'этапов'])}</span>` +
    `<span class="mm">${ic('book')}${plural(m.counts.stories, ['история', 'истории', 'историй'])}</span></div>` +
    `<div class="map-foot"><span class="map-slug">/karty/${m.slug}/</span><span class="btn-go">Открыть<span class="arr">→</span></span></div></div></a>`;
}).join('') + `</div>` +
  `<p class="note">Hero-зоны карточек готовы под обложки-сцены (images/atlas-&lt;slug&gt;-scene-600w.webp, VISUAL-DIRECTION §8.2): файл появится — карточка подхватит его при перегенерации автоматически.</p>` +

  // Целевой каталог §9: ghost-карточки будущих карт (строки согласованы с THEMES-планом)
  `<div class="sub-head"><h3>Целевой каталог · появится волнами KA-6…KA-9</h3><div class="sec-orn"></div></div>` +
  `<div class="maps-grid ghost-grid">` + [
    ['Земля Библии · обзор', 'compass', 'KA-6'],
    ['Иерусалим по эпохам', 'city', 'KA-6'],
    ['Царство Давида', 'route', 'KA-7'],
    ['Илия и Елисей', 'route', 'KA-7'],
    ['Четыре царства Даниила', 'crown', 'KA-8'],
    ['Вавилон Даниила · план', 'city', 'KA-8'],
    ['Пророчества о народах', 'layers', 'KA-8'],
    ['Мир Ирода', 'crown', 'KA-9'],
    ['Таблица народов', 'region', 'KA-9'],
    ['Иаков и Иосиф', 'route', 'KA-9'],
  ].map(([t, icn, wave]) =>
    `<article class="ghost-card">${ic(icn, 'ghost-ic')}<h4>${esc(t)}</h4><span class="ghost-wave">${wave}</span></article>`).join('') + `</div>`;

// ── Мини-карта Леванта (KA-4c шаг 1): места реестра на реальной подложке ─────
// Подложка: karty/_engine/base-geo.svg (семейство levant, 0 0 1900 1430 — заморожено).
// Точки: placements.levant из data/atlas/places/*.json; кодировка честности §3:
// заливка = уверенная локализация, золото = спорная, пунктирный контур = слабая/традиционная.
const placesAll = loadDir(A('places'));
// KA-3: подписи/маршруты листа — ТОЛЬКО из label-pipeline (scripts/atlas-labels.js)
const LGEN = JSON.parse(fs.readFileSync(path.join(A('generated'), 'labels-levant.json'), 'utf8'));
const CLUSTER = (LGEN.clusters && LGEN.clusters[0]) || { memberIds: [], members: [], extra: 0 };
const CLUSTERED = new Set(CLUSTER.memberIds || []);
const HIDDEN_STATIC = new Set((LGEN.report && LGEN.report.hiddenAtStatic) || []);
const GLYPH = (t) => t === 'mountain' ? 'mount' : (t === 'spring' || t === 'well') ? 'spring' : (t === 'sanctuary') ? 'sanct' : 'city';
const RANK = { consensus: 6, primary: 5, candidate: 4, alternative: 3, caveat: 2, minor: 1, rejected: 0 };
const TYPE_RU = { city: 'город', town: 'посёлок', region: 'регион', mountain: 'гора', river: 'река', sea: 'море', lake: 'озеро', spring: 'источник', road: 'дорога', garden: 'сад', structure: 'сооружение', sanctuary: 'святилище', camp: 'стан', valley: 'долина', other: 'место' };
const STATUS_WORD = { sure: 'уверенная локализация', disputed: 'СПОРНАЯ локализация — есть варианты', weak: 'слабая/традиционная локализация', plain: 'позиция реестра (без внешней идентификации)' };

const baseGeoRaw = fs.readFileSync(path.join(ROOT, 'karty', '_engine', 'base-geo.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// base-geo.svg сознательно поставляется с ПУСТЫМИ defs («градиенты импортируются конкретной
// картой»): 16 url(#…)-ссылок без красок → море/суша/рельеф не рисовались вовсе. Ниже —
// АВТОРСКИЙ СВЕТЛЫЙ paint-set листа Атласа (те же id, пергаментная палитра VISUAL-DIRECTION
// §3): превью арт-направления KA-6 «пергамент-гравюра», сознательно НЕ копия тёмной
// кинематографической гаммы производственного Авраама.
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
  <filter id="terrainTex" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".4 .35" numOctaves="4" seed="12" result="noise"/>
    <feColorMatrix in="noise" type="matrix" values="0 0 0 0 .54  0 0 0 0 .42  0 0 0 0 .12  0 0 0 .05 0" result="tinted"/>
    <feComposite in="SourceGraphic" in2="tinted" operator="over"/>
  </filter>
  <filter id="waterRipple" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur stdDeviation=".8"/>
  </filter>
  <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
  <radialGradient id="edgeFog" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#7a5c26" stop-opacity="0"/>
    <stop offset=".78" stop-color="#7a5c26" stop-opacity="0"/>
    <stop offset="1" stop-color="#7a5c26" stop-opacity=".26"/>
  </radialGradient>
  <filter id="dotShadow" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy=".7" stdDeviation=".8" flood-color="#3a2c10" flood-opacity=".45"/>
  </filter>
</defs>`;

// Хирургия деталей base-geo (правки только в превью-слое; сам файл — SYSTEM):
// Кишон в базе уходит хвостом далеко в море (до x=420 при береге ~586) — укорачиваем устье.
const baseGeoFixed = baseGeoRaw.replace(
  'M613,706 C595,712 575,720 555,728 C535,736 510,738 490,735 C468,730 445,720 420,710',
  'M613,706 C603,712 595,720 588,728'
);

const geoDots = [];
const geoLabels = [];
let inFrame = 0, offFamily = 0, subSkipped = 0, regionSkipped = 0;
const stCount = { sure: 0, disputed: 0, weak: 0, plain: 0 };
for (const p of placesAll.sort((a, b) => (a.rank || 3) - (b.rank || 3))) {
  const pl = p.placements && p.placements.levant;
  if (!pl) { offFamily++; continue; }
  if (p.parentId) { subSkipped++; continue; }
  if (p.type === 'region') { regionSkipped++; continue; }
  if (CLUSTERED.has(p.id)) continue; // члены иерусалимского кластера — в бейдже ⊕N
  if (HIDDEN_STATIC.has(p.id)) continue; // rank3, не вместившиеся на статике — до зума (KA-4c)
  inFrame++;
  const idents = p.identifications || [];
  const best = idents.reduce((b, i) => (RANK[i.status] > RANK[b] ? i.status : b), 'rejected');
  const cls = !idents.length ? 'plain'
    : (best === 'consensus' || best === 'primary') ? 'sure'
    : best === 'candidate' ? 'disputed' : 'weak';
  stCount[cls]++;
  const rk = p.rank || 3;
  const r = rk === 1 ? 6.5 : rk === 2 ? 5 : 3.8;
  const cands = idents.filter((i) => RANK[i.status] >= RANK.alternative).length;
  const tipRest = `${TYPE_RU[p.type] || p.type} · ранг ${rk} · ${STATUS_WORD[cls]}` +
    (cls === 'disputed' && cands > 1 ? ` (${cands} кандидата)` : '') +
    ` · карты: ${(p.maps || []).map((m) => m.slug).join(', ')}`;
  const tip = tipAttr(p.names.ru, tipRest);
  const needle = [p.names.ru, ...(p.names.variants || [])].join(' ').toLowerCase().replace(/ё/g, 'е');
  const firstMap = (p.maps && p.maps[0] && p.maps[0].slug) || "";
  const href = firstMap ? ` data-href="../../karty/${firstMap}/" tabindex="0" role="link" aria-label="${esc(p.names.ru)} — открыть карту"` : '';
  const g = GLYPH(p.type);
  let shape;
  if (g === 'mount') shape = `<path d="M${pl.x - r - 1},${pl.y + r * 0.8} L${pl.x},${pl.y - r - 1} L${pl.x + r + 1},${pl.y + r * 0.8} Z" class="dot-${cls}"/>`;
  else if (g === 'spring') shape = `<circle cx="${pl.x}" cy="${pl.y}" r="${(r * 0.8).toFixed(1)}" class="dot-${cls}"/><circle cx="${pl.x}" cy="${pl.y}" r="${(r * 0.35).toFixed(1)}" fill="#fcf9f1" pointer-events="none"/>`;
  else if (g === 'sanct') shape = `<rect x="${(pl.x - r * 0.85).toFixed(1)}" y="${(pl.y - r * 0.85).toFixed(1)}" width="${(r * 1.7).toFixed(1)}" height="${(r * 1.7).toFixed(1)}" transform="rotate(45 ${pl.x} ${pl.y})" class="dot-${cls}"/>`;
  else shape = `<circle cx="${pl.x}" cy="${pl.y}" r="${r.toFixed(1)}" class="dot-${cls}"/>`;
  geoDots.push(`<g ${tip} class="geo-dot" data-name="${esc(needle)}"${href}>${shape}</g>`);
}
// Кластер Иерусалима (§6: city-inset в интерактиве; на листе — «⊕N»)
{
  const jp = placesAll.find((p) => p.id === 'jerusalem').placements.levant;
  geoDots.push(`<g class="geo-dot geo-cluster" data-name="иерусалим кластер" data-href="../../karty/yeshua/" tabindex="0" role="link" ` +
    tipAttr('Иерусалим и окрестности', `⊕${CLUSTER.extra} мест: ${CLUSTER.members.join(', ')} · городской план — KA-6`) +
    `><circle cx="${jp.x}" cy="${jp.y}" r="10.5" fill="none" class="cluster-ring"/><text x="${jp.x + 13}" y="${jp.y - 8}" class="cluster-badge">⊕${CLUSTER.extra}</text></g>`);
}
// Подписи листа — из pipeline (гало, кегль по бакету, выноски)
for (const L of LGEN.labels) {
  if (L.leader) geoLabels.push(`<line x1="${L.leader.fromX}" y1="${L.leader.fromY}" x2="${L.leader.toX}" y2="${L.leader.toY}" class="leader-line"/>`);
  geoLabels.push(`<text x="${L.x.toFixed(1)}" y="${L.y.toFixed(1)}" font-size="${L.font}" class="geo-lab lab-r${L.rank}" data-name="${esc(L.text.toLowerCase().replace(/ё/g,'е'))}">${esc(L.text)}</text>`);
}
// Дороги (data/atlas/routes) — терракотовый штрих + подпись вдоль (textPath)
const geoRoutes = [];
LGEN.routes.forEach((rt, i) => {
  const d = 'M' + rt.pts.map((pt) => pt.join(',')).join(' L');
  geoRoutes.push(`<path id="rt-${rt.id}" d="${d}" class="route-line"/>`);
  geoRoutes.push(`<text class="route-lab" dy="-4"><textPath href="#rt-${rt.id}" startOffset="${i === 0 ? 38 : 50}%">${esc(rt.title)}</textPath></text>`);
});

// Картографическая фурнитура: линейка масштаба (сегменты по 100 км ≈ 108.7 ед. при 0.92 км/ед.)
// и стрелка севера. 300 км → ~326 ед.: читаемая длина в кадре 1900.
const KM100 = 100 / 0.92;
const sbX = 1185, sbY = 1372; // правый нижний угол пустыни: не пересекается с Нилом и подписями
const geoFurniture =
  `<g class="geo-furn" aria-hidden="true">` +
  `<rect x="${sbX - 16}" y="${sbY - 34}" width="${KM100 * 3 + 32 + 44}" height="60" rx="8" class="furn-plate"/>` +
  `<rect x="${sbX}" y="${sbY}" width="${KM100}" height="10" class="sb-dark"/>` +
  `<rect x="${sbX + KM100}" y="${sbY}" width="${KM100}" height="10" class="sb-light"/>` +
  `<rect x="${sbX + KM100 * 2}" y="${sbY}" width="${KM100}" height="10" class="sb-dark"/>` +
  `<text x="${sbX}" y="${sbY - 10}" class="sb-t">0</text>` +
  `<text x="${sbX + KM100}" y="${sbY - 10}" text-anchor="middle" class="sb-t">100</text>` +
  `<text x="${sbX + KM100 * 2}" y="${sbY - 10}" text-anchor="middle" class="sb-t">200</text>` +
  `<text x="${sbX + KM100 * 3}" y="${sbY - 10}" text-anchor="end" class="sb-t">300 км</text>` +
  `<g transform="translate(1818,108)">` +
  `<circle r="40" class="furn-plate" cx="0" cy="8"/>` +
  `<path d="M0,-22 L8,14 L0,7 L-8,14 Z" class="north-arr"/>` +
  `<text x="0" y="36" text-anchor="middle" class="north-t">С</text></g>` +
  `</g>`;

const placesHtml =
  `<div class="geo-bar">` +
  `<span class="geo-cap">семейство levant · 1900×1430 · 1 ед. ≈ 0,92 км</span>` +
  `<span class="geo-search">${ic('pin')}<input id="geo-q" type="search" placeholder="Найти место…" autocomplete="off" aria-label="Поиск места на мини-карте"><span id="geo-n" aria-live="polite"></span></span>` +
  `</div>` +
  `<div class="geo-frame"><svg viewBox="0 0 1900 1430" class="geo-svg" role="img" aria-label="Мини-карта Леванта: места реестра Атласа со статусами уверенности локализаций">` +
  GEO_DEFS + baseGeoFixed + geoRoutes.join('') + geoDots.join('') + geoLabels.join('') + geoFurniture + `</svg></div>` +
  `<div class="legend geo-legend">` +
  `<span><b style="background:#1e3a63;border-radius:50%"></b> уверенная — ${stCount.sure}</span>` +
  `<span><b style="background:#d9b36a;border:1.5px solid #8a6a1f;border-radius:50%"></b> спорная — ${stCount.disputed}</span>` +
  `<span><b style="background:transparent;border:1.5px dashed #1e3a63;border-radius:50%"></b> слабая / традиционная — ${stCount.weak}</span>` +
  `<span><b style="background:#7d8ba1;border-radius:50%"></b> позиция реестра — ${stCount.plain}</span>` +
  `</div>` +
  `<p class="note">В кадре ${inFrame} мест семейства levant (размер точки — число карт с местом; наведите курсор — статус и карты). ` +
  `Честно за кадром: ${regionSkipped} регионов (уделы колен и т.п.) появятся ПОЛИГОНАМИ в KA-6 — точкой их не изображаем; ${subSkipped} суб-локаций (Горница, Гефсимания…) — на городских планах; ${offFamily} средиземноморских мест (Павел, семь церквей) — в семействе mediterranean со своей подложкой. ` +
  `Подложка — художественная развёртка base-geo.svg (не строгая проекция; линейка масштаба — приближение).</p>`;

const stats = timeline.stats;
const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Библейский Атлас — предпросмотр оболочки (KA-4 preview)</title>
<style>
  :root{--ink:#2b2418;--ink2:#6b5f49;--ink3:#95886c;--blue:#1e3a63;--blue2:#2d4f80;--gold:#b98a2f;--gold2:#d9b36a;
    --parch:#f6f1e7;--parch2:#efe7d4;--card:#fcf9f1;--line:#ddd0b4;--line2:#e9dfc8;
    --serif:Georgia,'Iowan Old Style','Palatino Linotype','Book Antiqua','Times New Roman',serif;
    --sans:'Segoe UI',system-ui,-apple-system,sans-serif}
  *{box-sizing:border-box;margin:0}
  html{scroll-behavior:smooth}
  body{background:
      radial-gradient(1100px 500px at 85% -140px, rgba(217,179,106,.16), transparent 62%),
      radial-gradient(900px 420px at -80px 22%, rgba(30,58,99,.07), transparent 60%),
      var(--parch);
    color:var(--ink);font:15.5px/1.58 var(--serif);-webkit-font-smoothing:antialiased}
  /* бумажное зерно: инлайн-SVG шум, едва заметный — печатное ощущение */
  body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.5;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .38 0 0 0 0 .22 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E")}
  .wrap{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:30px 22px 64px}
  ::selection{background:rgba(217,179,106,.45)}
  :focus-visible{outline:2px solid var(--blue);outline-offset:2px;border-radius:6px}

  /* ── Hero ── */
  header.hero{position:relative;border:1px solid var(--line);border-radius:16px;overflow:hidden;
    background:linear-gradient(160deg,#fbf7ec 0%,#f3ebd8 58%,#eee2c8 100%);
    box-shadow:0 1px 0 #fff inset,0 14px 34px -22px rgba(74,58,24,.45);
    padding:32px 36px 26px;margin-bottom:26px}
  header.hero::after{content:"";position:absolute;inset:8px;border:1px solid rgba(185,138,47,.30);border-radius:11px;pointer-events:none}
  header.hero::before{content:"";position:absolute;inset:11px;border:1px solid rgba(185,138,47,.14);border-radius:9px;pointer-events:none}
  .hero-corner{position:absolute;font-size:11px;color:var(--gold2);pointer-events:none;line-height:1}
  .hero-corner.tl{top:14px;left:16px}.hero-corner.tr{top:14px;right:16px}
  .hero-corner.bl{bottom:13px;left:16px}.hero-corner.br{bottom:13px;right:16px}
  .hero-compass{position:absolute;right:26px;top:50%;transform:translateY(-50%);width:168px;height:168px;opacity:.55;pointer-events:none}
  .hero-compass svg{width:100%;height:100%}
  .kicker{font:600 11px/1 var(--sans);letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}
  .h1row{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin:9px 0 3px}
  h1{font:700 42px/1.04 var(--serif);color:var(--blue);letter-spacing:.005em;
    text-shadow:0 1px 0 rgba(255,255,255,.7)}
  .he{font-size:20px;color:var(--gold);direction:rtl;letter-spacing:.12em}
  .sub{color:var(--ink2);font-style:italic;max-width:620px}
  .epigraph{margin-top:10px;max-width:560px;font:italic 13.5px/1.6 var(--serif);color:#8a7a58}
  .epigraph b{font-style:normal;font-weight:600;color:var(--gold);letter-spacing:.04em}
  .hero-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;font:600 11px/1 var(--sans)}
  .hm{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.66);border:1px solid var(--line);
    border-radius:999px;padding:7px 12px;color:var(--ink2);transition:transform .15s, box-shadow .15s}
  .hm:hover{transform:translateY(-1px);box-shadow:0 4px 10px -6px rgba(74,58,24,.45)}
  .hm .ic{width:13px;height:13px;color:var(--gold)}
  .hm b{color:var(--blue);font-weight:700}
  .hm.warn{background:#f6e7de;border-color:#dcb9a4;color:#8a4a2e}

  /* ── Tabs: сегментный контрол ── */
  nav.tabs{display:inline-flex;gap:3px;margin:0 0 22px;flex-wrap:wrap;padding:4px;
    background:var(--parch2);border:1px solid var(--line);border-radius:13px;
    box-shadow:inset 0 1.5px 4px rgba(74,58,24,.12), 0 1px 0 rgba(255,255,255,.7)}
  .tab{position:relative;display:inline-flex;align-items:center;gap:8px;font:600 13.5px/1 var(--sans);letter-spacing:.01em;
    padding:11px 16px;border:1px solid transparent;background:none;color:var(--ink2);cursor:pointer;border-radius:9px;
    transition:color .15s, background .15s, box-shadow .15s}
  .tab:hover{color:var(--ink);background:rgba(255,255,255,.55)}
  .tab:active{transform:translateY(1px)}
  .tab[aria-selected="true"]{color:var(--blue);background:var(--card);border-color:var(--line);
    box-shadow:0 2px 6px -3px rgba(74,58,24,.4), 0 1px 0 #fff inset}
  .tab[aria-selected="true"]::after{content:"";position:absolute;left:14px;right:14px;bottom:4.5px;height:2px;
    border-radius:2px;background:linear-gradient(90deg,transparent,var(--gold) 22%,var(--gold) 78%,transparent)}
  .tab-n{font:700 9.5px/1 var(--sans);color:var(--gold);background:rgba(185,138,47,.12);
    border:1px solid rgba(185,138,47,.35);border-radius:999px;padding:3px 6px;margin-left:1px}
  .tab[aria-selected="true"] .tab-n{background:rgba(185,138,47,.16)}
  .ic{display:inline-flex;width:17px;height:17px;flex:none}
  .ic svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
  section.pane{display:none}section.pane.on{display:block}

  .sec-head{display:flex;align-items:baseline;gap:14px;margin:6px 0 4px}
  h2{color:var(--blue);font:700 24px/1.2 var(--serif);letter-spacing:.005em}
  .sec-orn{flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent);position:relative}
  .sec-orn::before{content:"✦";position:absolute;left:0;top:-9px;color:var(--gold2);font-size:10px;background:transparent;padding-right:6px}
  .lead{color:var(--ink2);margin:2px 0 16px;max-width:780px}

  /* ── Timeline ── */
  .tl-frame{border:1px solid var(--line);border-radius:14px;background:var(--card);
    box-shadow:0 1px 0 #fff inset,0 10px 26px -20px rgba(74,58,24,.4);overflow:hidden}
  .tl-scroll{overflow-x:auto;overscroll-behavior-x:contain}
  .tl-flex{display:flex;width:max-content}
  .tl-labels{position:sticky;left:0;z-index:3;flex:none;width:150px;height:${H}px;
    background:linear-gradient(90deg,var(--card) 78%,rgba(252,249,241,0))}
  .tl-lab{position:absolute;left:0;width:142px;display:flex;align-items:center;justify-content:flex-end;text-align:right;
    padding-right:12px;font:600 11.5px/1.15 system-ui,sans-serif;color:var(--ink2)}
  .tl-lab.era{color:var(--gold);letter-spacing:.06em;text-transform:uppercase;font-size:10.5px}
  .tl-lab.group{justify-content:flex-start;padding-left:6px;color:var(--gold);letter-spacing:.2em;text-transform:uppercase;font-size:10px}
  .tl-lab.group::before{content:"✦";font-size:8px;margin-right:6px;color:var(--gold2)}
  .tl-lab.axis{font:italic 600 11px/1 var(--serif);color:#a59772}
  .band{fill:rgba(30,58,99,.035)}
  .group-line{stroke:rgba(185,138,47,.35);stroke-width:1;stroke-dasharray:1 5;stroke-linecap:round}
  .chip-text{font:700 11.5px/1 var(--serif);fill:#2b2418;letter-spacing:.05em;pointer-events:none}
  .chip-text-sm{font-size:9.5px;letter-spacing:.01em}
  .era-pill{stroke:rgba(120,95,40,.4);stroke-width:1;filter:none}
  .era-hl{fill:rgba(185,138,47,.10);stroke:rgba(185,138,47,.4);stroke-width:1;stroke-dasharray:2 3;transition:opacity .18s}
  .grid{stroke:#e9dfc6;stroke-width:1}
  .grid-minor{stroke:#d9cca8;stroke-width:1}
  .xhair{stroke:rgba(30,58,99,.45);stroke-width:1;stroke-dasharray:3 3;pointer-events:none}
  .axis-year,.axis-era{font:600 10px/1 var(--sans);fill:#a59772}
  .axis-year.century{font-weight:700;font-size:11px;fill:#8a7a58}
  .seg{fill:url(#gSeg);stroke:#c6b384;stroke-width:1}
  .seg,.prophet-seg,.emp-seg{filter:drop-shadow(0 1px .6px rgba(74,58,24,.26))}
  .event-mark,.event-star{filter:drop-shadow(0 1px 1px rgba(74,58,24,.4))}
  .seg.coreg{fill:url(#pCoreg);stroke-dasharray:3.5 2.5}
  .seg-text{font:600 11px/1 var(--sans);fill:var(--ink);dominant-baseline:middle;pointer-events:none}
  .prophet-seg{fill:url(#gProph);stroke:#a4bcd4;stroke-width:1;stroke-dasharray:3.2 2.2}
  .prophet-seg.writing{stroke:#7d9cbe;stroke-width:1.2;stroke-dasharray:none}
  .prophet-text{font:600 10.5px/1 var(--sans);fill:#1e3a63;dominant-baseline:middle;pointer-events:none}
  .emp-seg{fill:url(#gEmp);stroke:#c39d8b;stroke-width:1}
  .realm-caption{font:700 10px/1 system-ui,sans-serif;fill:#96604a;letter-spacing:.14em;text-transform:uppercase}
  .realm-sep{stroke:#d6bcae;stroke-width:1;stroke-dasharray:2 3}
  .event-mark{fill:#2d4f80;stroke:#fcf9f1;stroke-width:1.6}
  .event-star{fill:#c99a3a;stroke:#fcf9f1;stroke-width:1.4}
  g[data-tip]{cursor:default}
  g[data-tip]:hover .seg,g[data-tip]:hover .prophet-seg,g[data-tip]:hover .emp-seg{stroke:var(--blue);stroke-width:1.7;filter:brightness(1.03)}
  g[data-tip]:hover .event-mark,g[data-tip]:hover .event-star{transform:scale(1.3);transform-box:fill-box;transform-origin:center}
  g[data-tip]:hover .era-pill{stroke:var(--blue);stroke-width:1.5}

  #tip{position:fixed;display:none;max-width:340px;background:#2a2415;color:#f3ecd9;font:12.5px/1.5 var(--sans);
    padding:10px 13px;border-radius:9px;pointer-events:none;z-index:9;box-shadow:0 6px 20px rgba(30,26,14,.4);border:1px solid #4a3f24}
  #tip b{display:block;font:700 13.5px/1.3 var(--serif);color:#ecd9a8;margin-bottom:3px}
  #yearchip{position:fixed;display:none;background:var(--blue);color:#f2ead8;font:700 11.5px/1 var(--sans);
    letter-spacing:.04em;padding:6px 10px;border-radius:999px;pointer-events:none;z-index:8;
    box-shadow:0 4px 12px -4px rgba(30,58,99,.6)}

  .legend{display:flex;gap:16px;flex-wrap:wrap;font:12px/1 system-ui,sans-serif;color:var(--ink2);margin:14px 4px 4px}
  .legend span{display:inline-flex;align-items:center}
  .legend b{display:inline-block;width:12px;height:12px;border-radius:3.5px;margin-right:7px}
  details.tbl{margin-top:16px;font:13px/1.5 var(--sans)}
  details.tbl summary{cursor:pointer;color:var(--blue);font-weight:600;padding:4px 0}
  .tbl-scroll{overflow-x:auto;max-width:100%} /* закрытый details в новых Chromium сохраняет боксы содержимого — таблица не должна распирать страницу */
  table{border-collapse:collapse;margin-top:10px;background:var(--card);border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px var(--line)}
  td,th{border-bottom:1px solid var(--line2);padding:6px 12px;text-align:left}
  th{font:600 11.5px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;background:var(--parch2);color:var(--ink2)}
  tr:last-child td{border-bottom:0}

  /* ── Books ── */
  .book-sec{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:12px;
    box-shadow:0 1px 0 #fff inset}
  .book-sec-head{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  .book-num{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;
    font:700 11px/1 var(--serif);color:var(--gold);border:1px solid var(--gold2);border-radius:50%;
    background:radial-gradient(circle at 32% 28%, #fffdf4, #f4ead2);box-shadow:0 1px 3px -1px rgba(185,138,47,.5)}
  .book-sec h4{font:600 12.5px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--ink2)}
  .book-cov{margin-left:auto;font:600 10.5px/1 var(--sans);color:var(--gold);letter-spacing:.04em}
  .book-bar{height:3px;border-radius:2px;background:var(--line2);margin:-4px 0 12px;overflow:hidden}
  .book-bar i{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,var(--gold2),var(--gold))}
  .chips{display:flex;flex-wrap:wrap;gap:7px}
  .chip{position:relative;font:600 12.5px/1 var(--sans);background:#fff;border:1px solid var(--line);border-radius:9px;
    padding:8px 11px;color:var(--ink2);cursor:default;transition:border-color .15s, box-shadow .15s, transform .15s;
    text-decoration:none;display:inline-block}
  a.chip{cursor:pointer}
  .chip:hover{border-color:var(--blue);box-shadow:0 3px 9px -4px rgba(30,58,99,.45);transform:translateY(-1px)}
  .chip.has-map{border-color:var(--gold2);color:var(--ink);background:linear-gradient(180deg,#fffdf6,#faf3e2);
    box-shadow:0 1px 4px -2px rgba(185,138,47,.5)}
  .chip sup{font:700 8.5px/1 var(--sans);color:var(--gold);margin-left:3px;top:-4px;position:relative}

  /* ── Themes ── */
  .themes-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .theme-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px 16px;
    box-shadow:0 1px 0 #fff inset,0 8px 20px -18px rgba(74,58,24,.5);transition:transform .18s, box-shadow .18s}
  .theme-card:hover{transform:translateY(-2px);box-shadow:0 1px 0 #fff inset,0 14px 26px -18px rgba(74,58,24,.55)}
  .theme-medal{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;margin-bottom:12px;
    border:1px solid var(--gold2);border-radius:50%;
    background:radial-gradient(circle at 32% 28%, #fffdf4, #f2e7cd);box-shadow:0 2px 6px -3px rgba(185,138,47,.6), 0 1px 0 #fff inset}
  .theme-card:hover .theme-medal{box-shadow:0 3px 9px -3px rgba(185,138,47,.75), 0 1px 0 #fff inset}
  .theme-ic{width:22px;height:22px;color:var(--gold)}
  .theme-card h4{color:var(--blue);font:700 17.5px/1.25 var(--serif);margin-bottom:6px}
  .theme-now{font:13.5px/1.55 var(--sans);color:var(--ink)}
  .theme-now.theme-empty{color:var(--ink3);font-style:italic}
  .theme-thumbs{display:flex;flex-wrap:wrap;gap:8px}
  .thumb{position:relative;width:118px;height:64px;border-radius:9px;overflow:hidden;background-size:cover;background-position:center;
    border:1px solid var(--line);box-shadow:0 3px 10px -6px rgba(74,58,24,.6);transition:transform .18s, box-shadow .18s;flex:none}
  .thumb::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 38%,rgba(24,20,10,.78))}
  .thumb span{position:absolute;left:7px;right:6px;bottom:5px;z-index:1;font:600 9.5px/1.25 var(--sans);color:#f2ead8;
    letter-spacing:.02em;text-shadow:0 1px 2px rgba(0,0,0,.6)}
  .thumb:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 6px 14px -6px rgba(74,58,24,.75);border-color:var(--gold2)}
  .thumb:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
  .plan-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  .plan-chip{font:600 11px/1 var(--sans);color:var(--ink3);border:1px dashed var(--line);border-radius:999px;
    padding:5px 9px;background:rgba(255,255,255,.4)}

  /* ── Map cards ── */
  .maps-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(264px,1fr));gap:16px}
  .map-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;
    box-shadow:0 1px 0 #fff inset,0 10px 24px -20px rgba(74,58,24,.5);transition:transform .18s, box-shadow .18s;
    text-decoration:none;color:inherit}
  .map-card:hover{transform:translateY(-3px);box-shadow:0 1px 0 #fff inset,0 18px 32px -20px rgba(74,58,24,.55)}
  .map-card:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
  .map-hero{position:relative;aspect-ratio:16/9;background:var(--parch2);overflow:hidden}
  .map-hero img{width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.001);transition:transform .45s cubic-bezier(.2,.6,.25,1)}
  .map-card:hover .map-hero img{transform:scale(1.055)}
  .hero-shade{position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(180deg, rgba(30,26,14,.16) 0%, transparent 26%, transparent 70%, rgba(30,26,14,.18) 100%)}
  .map-hero-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    border-bottom:3px solid color-mix(in srgb, var(--tone) 65%, #8a6a1f);
    background:
      radial-gradient(120% 100% at 18% -10%, color-mix(in srgb, var(--tone) 36%, #f6efdc) 0%, transparent 58%),
      radial-gradient(140% 120% at 100% 115%, color-mix(in srgb, var(--tone) 28%, #cfbb8e) 0%, transparent 62%),
      linear-gradient(150deg, #f3ead6 0%, #e7dabb 60%, #ddcda6 100%)}
  .map-hero-ph::before{content:"";position:absolute;inset:0;mix-blend-mode:multiply;
    background:repeating-linear-gradient(115deg, rgba(120,95,40,.045) 0 1px, transparent 1px 7px)}
  .map-hero-ph::after{content:"";position:absolute;inset:8px;border:1px solid rgba(120,95,40,.3);border-radius:8px}
  .hero-ic{width:44px;height:44px;color:#a9822f;opacity:.8;filter:drop-shadow(0 1px 0 rgba(255,255,255,.55))}
  .hero-ic svg{stroke-width:1.2}
  .map-status{position:absolute;top:10px;right:10px;font:700 10px/1 system-ui,sans-serif;letter-spacing:.05em;border-radius:999px;padding:5px 10px;backdrop-filter:blur(3px)}
  .map-status.live{background:rgba(227,239,230,.92);color:#15803d;border:1px solid #a9cdb4}
  .map-status.hold{background:rgba(243,234,216,.92);color:#8a6a1f;border:1px solid #d9c391}
  .map-status.semi{background:rgba(232,236,243,.92);color:#1e3a63;border:1px solid #b3c0d6}
  .map-body{padding:14px 16px 13px;display:flex;flex-direction:column;gap:5px;flex:1}
  .map-body h4{color:var(--blue);font:700 17px/1.25 var(--serif)}
  .map-era{font:italic 12px/1.4 var(--serif);color:var(--ink3)}
  .map-meta{display:flex;flex-wrap:wrap;gap:4px 12px;font:12px/1.5 var(--sans);color:var(--ink2)}
  .map-meta .mm{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
  .map-meta .ic{width:12.5px;height:12.5px;color:var(--gold)}
  .map-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:10px;border-top:1px solid var(--line2)}
  .map-slug{font:10.5px/1 ui-monospace,monospace;color:var(--ink3)}
  .btn-go{display:inline-flex;align-items:center;gap:6px;font:600 12px/1 var(--sans);color:var(--gold);
    border:1px solid var(--gold2);border-radius:999px;padding:7px 13px;background:rgba(255,255,255,.5);
    transition:background .16s, color .16s, border-color .16s, box-shadow .16s}
  .btn-go .arr{transition:transform .16s}
  .map-card:active .btn-go{transform:translateY(1px);box-shadow:inset 0 2px 4px rgba(122,92,26,.35)}
  .map-card:hover .btn-go{background:linear-gradient(180deg,#f7ecd2,#efdfb9);color:#7a5c1a;border-color:var(--gold);
    box-shadow:0 3px 8px -4px rgba(185,138,47,.7)}
  .map-card:hover .btn-go .arr{transform:translateX(3px)}

  .sub-head{display:flex;align-items:baseline;gap:14px;margin:30px 0 12px}
  .sub-head h3{font:700 16px/1.2 var(--serif);color:var(--ink2);letter-spacing:.02em}
  .ghost-grid{gap:12px}
  .ghost-card{display:flex;align-items:center;gap:12px;border:1.5px dashed var(--line);border-radius:12px;
    padding:14px 16px;background:rgba(252,249,241,.55);color:var(--ink3)}
  .ghost-card h4{font:600 13.5px/1.3 var(--serif);color:var(--ink2);flex:1}
  .ghost-ic{width:20px;height:20px;color:#c0ab7c;flex:none}
  .ghost-wave{font:700 9.5px/1 var(--sans);letter-spacing:.08em;color:var(--gold);border:1px solid var(--gold2);
    border-radius:999px;padding:4px 8px;background:rgba(185,138,47,.07)}

  .note{font:12px/1.55 var(--sans);color:var(--ink3);margin-top:12px}

  /* ── Мини-карта Леванта ── */
  .geo-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:0 2px 10px}
  .geo-cap{font:600 10.5px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
  .geo-search{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);
    border-radius:999px;padding:7px 14px;box-shadow:inset 0 1px 3px rgba(74,58,24,.09)}
  .geo-search .ic{width:14px;height:14px;color:var(--gold)}
  .geo-search input{border:0;background:none;outline:none;font:600 13px/1 var(--sans);color:var(--ink);width:230px}
  .geo-search input::placeholder{color:var(--ink3);font-weight:500}
  .geo-search:focus-within{border-color:var(--gold2);box-shadow:inset 0 1px 3px rgba(74,58,24,.09), 0 0 0 3px rgba(185,138,47,.16)}
  #geo-n{font:700 10.5px/1 var(--sans);color:var(--gold);min-width:52px;text-align:right}
  .geo-frame{position:relative;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#eae2cd;
    box-shadow:0 1px 0 #fff inset,0 10px 26px -20px rgba(74,58,24,.4)}
  .geo-frame::after{content:"";position:absolute;inset:7px;border:1px solid rgba(120,95,40,.28);border-radius:9px;pointer-events:none}
  .geo-svg{width:100%;height:auto;display:block}
  .geo-dot,.geo-lab{transition:opacity .18s}
  .geo-dot[data-href]{cursor:pointer}
  .geo-dot[data-href]:focus-visible circle{stroke:var(--blue);stroke-width:2.6}
  .geo-dot.dim{opacity:.12}
  .geo-lab.dim{opacity:.15}
  .geo-lab{font-family:Georgia,'Times New Roman',serif;font-weight:600;fill:#2b2418;pointer-events:none;
    paint-order:stroke;stroke:rgba(242,234,216,.88);stroke-width:2.6px;stroke-linejoin:round}
  .lab-r1{font-weight:700;letter-spacing:.02em}
  .lab-r3{fill:#4a3f2c}
  .leader-line{stroke:rgba(90,74,40,.55);stroke-width:.9;pointer-events:none}
  .route-line{fill:none;stroke:#a2683c;stroke-width:2.4;stroke-dasharray:7 4;stroke-linecap:round;opacity:.75}
  .route-lab{font:italic 700 11px Georgia,serif;fill:#8a5a30;letter-spacing:.22em;opacity:.9;
    paint-order:stroke;stroke:rgba(242,234,216,.8);stroke-width:2.4px}
  .cluster-ring{stroke:#1e3a63;stroke-width:1.6;stroke-dasharray:3 2.4}
  .geo-cluster{cursor:pointer}
  .cluster-badge{font:700 11px Georgia,serif;fill:#1e3a63;paint-order:stroke;stroke:rgba(242,234,216,.9);stroke-width:2.4px}
  /* Типографика подложки: серифные картографические подписи (CSS перекрывает презентационные атрибуты base-geo) */
  .geo-svg .sea-label{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-weight:700;fill:#5f8bab;letter-spacing:.42em;opacity:.75}
  .geo-svg .region-label{font-family:Georgia,"Times New Roman",serif;font-weight:700;fill:#8a7a52;letter-spacing:.3em;opacity:.62}
  .geo-svg .region-he{font-family:Georgia,serif;fill:#93a7b8;opacity:.5}
  .geo-svg .lbl-z2{opacity:.45}
  /* Светлая тема вод: прод-заливка Мёртвого/Кинерета #10263a почти чёрная на пергаменте */
  .geo-svg [fill="#10263a"]{fill:#8fb7cb}
  .geo-svg [stroke="#2e4d6b"]{stroke:#6f97ae}
  .geo-svg [stroke="#2d4a66"]{stroke:#6f97ae}
  .dot-sure,.dot-disputed{filter:url(#dotShadow)}
  .geo-dot.hit circle{stroke:var(--blue);stroke-width:2.6;filter:drop-shadow(0 0 6px rgba(30,58,99,.55))}
  .furn-plate{fill:rgba(246,241,231,.82);stroke:rgba(120,95,40,.35);stroke-width:1}
  .sb-dark{fill:#3a3020;stroke:#3a3020}
  .sb-light{fill:#f6f1e7;stroke:#3a3020;stroke-width:1.4}
  .sb-t{font:600 17px/1 var(--sans);fill:#5c4d33}
  .north-arr{fill:#8a6a1f;stroke:#6b5216;stroke-width:1}
  .north-t{font:700 20px/1 var(--serif);fill:#6b5216}
  .dot-sure{fill:#1e3a63;stroke:#f6f1e7;stroke-width:1.1}
  .dot-disputed{fill:#d9b36a;stroke:#8a6a1f;stroke-width:1.2}
  .dot-weak{fill:rgba(246,241,231,.35);stroke:#1e3a63;stroke-width:1.2;stroke-dasharray:2.2 1.7}
  .dot-plain{fill:#7d8ba1;stroke:#f6f1e7;stroke-width:1}
  .dot-region{fill:rgba(150,96,74,.07);stroke:#96604a;stroke-width:1.2;stroke-dasharray:3 2}
  .geo-svg g[data-tip]:hover circle,.geo-svg g[data-tip]:hover rect{stroke:var(--blue);stroke-width:2;transform:scale(1.25);transform-box:fill-box;transform-origin:center}
  .geo-legend{margin-top:14px}
  .geo-legend b{border:0}
  footer{margin-top:42px;padding-top:0;font:12px/1.7 var(--sans);color:var(--ink3)}
  .foot-orn{display:flex;align-items:center;gap:12px;margin-bottom:14px;color:var(--gold2)}
  .foot-orn::before,.foot-orn::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--line))}
  .foot-orn::after{background:linear-gradient(90deg,var(--line),transparent)}
  footer code{font-family:ui-monospace,monospace;background:var(--parch2);padding:1px 5px;border-radius:4px}
  .foot-stamp{margin-top:8px;font:italic 11.5px/1.6 var(--serif);color:#a59772}

  @media (max-width:720px){
    .wrap{padding:18px 13px 44px}
    h1{font-size:29px}.he{font-size:15px}.hero-compass{display:none}
    header.hero{padding:20px 18px 18px}
    .kicker{letter-spacing:.15em;font-size:10px}
    .epigraph{font-size:12.5px}
    .hm{padding:6px 10px;font-size:10px}
    .tab{padding:10px 10px;font-size:12.5px;gap:6px}.tab-n{display:none}
    h2{font-size:20px}
    .tl-labels{width:112px}.tl-lab{width:106px;font-size:10.5px}
    .geo-bar{gap:8px}.geo-search{flex:1}.geo-search input{width:100%;min-width:0}
    .geo-frame{overflow-x:auto}
    .geo-svg{min-width:920px} /* печатный лист листается пальцем, кегли читаемы */
    .maps-grid{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
  }
  @media print{
    body{background:#fff}body::before{display:none}
    nav.tabs,#tip,#yearchip,.geo-search{display:none!important}
    section.pane{display:block!important;page-break-after:always}
    .tl-scroll{overflow:visible}
    header.hero{box-shadow:none}
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <span class="hero-corner tl">❧</span><span class="hero-corner tr">❧</span>
    <span class="hero-corner bl">❧</span><span class="hero-corner br">❧</span>
    <div class="hero-compass"><svg viewBox="0 0 100 100" fill="none" stroke="#a98a4e" stroke-width="1">
      <circle cx="50" cy="50" r="47"/>
      <circle cx="50" cy="50" r="43.5" stroke-dasharray="1 2.03" stroke-width="2.6" opacity=".75"/>
      <circle cx="50" cy="50" r="39"/><circle cx="50" cy="50" r="3" fill="#a98a4e" stroke="none"/>
      <path d="M50 6 L53.6 46.4 L50 50 L46.4 46.4 Z" fill="#b98a2f" fill-opacity=".55"/>
      <path d="M50 94 L53.6 53.6 L50 50 L46.4 53.6 Z M6 50 L46.4 46.4 L50 50 L46.4 53.6 Z M94 50 L53.6 46.4 L50 50 L53.6 53.6 Z"/>
      <path d="M26 26 L46.8 46.8 M74 26 L53.2 46.8 M26 74 L46.8 53.2 M74 74 L53.2 53.2" opacity=".65"/>
      <path d="M50 13v5M50 82v5M13 50h5M82 50h5" stroke-width="1.4"/>
      <text x="50" y="4.5" text-anchor="middle" font-size="7.5" fill="#a98a4e" stroke="none" font-family="Georgia,serif">С</text>
      <text x="50" y="99.7" text-anchor="middle" font-size="7" fill="#a98a4e" stroke="none" font-family="Georgia,serif">Ю</text>
      <text x="1" y="52.6" font-size="7" fill="#a98a4e" stroke="none" font-family="Georgia,serif">З</text>
      <text x="95.5" y="52.6" font-size="7" fill="#a98a4e" stroke="none" font-family="Georgia,serif">В</text>
    </svg></div>
    <div class="kicker">Господь Бог — Сила Моя · предпросмотр оболочки</div>
    <div class="h1row"><h1>Библейский Атлас</h1><span class="he">אַטְלָס הַמִּקְרָא</span></div>
    <div class="sub">Исследуйте события Писания через географию, хронологию и археологию — честно там, где данные спорны.</div>
    <div class="epigraph">«Встань, пройди по земле сей в долготу и в широту её: ибо Я тебе дам её» <b>· Быт 13:17</b></div>
    <div class="hero-meta">
      <span class="hm">${ic('crown')}${hmPill(stats.kings, ['царь', 'царя', 'царей'])}</span>
      <span class="hm">${ic('scroll')}${hmPill(stats.prophets, ['пророк', 'пророка', 'пророков'])}</span>
      <span class="hm">${ic('globe')}${hmPill(stats.emperors, ['император', 'императора', 'императоров'])}</span>
      <span class="hm">${ic('star')}${hmPill(stats.events, ['событие', 'события', 'событий'])}</span>
      <span class="hm">${ic('map')}${hmPill(inventory.maps.length, ['карта', 'карты', 'карт'])}</span>
      <span class="hm">${ic('pin')}${hmPill(placesAll.length, ['место', 'места', 'мест'])}</span>
      <span class="hm warn">KA-4 preview · не production</span>
    </div>
  </header>

  <nav class="tabs" role="tablist" aria-label="Оси Атласа">
    <button class="tab" role="tab" aria-selected="true" data-pane="time" tabindex="0">${ic('time')}По времени</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="books" tabindex="-1">${ic('book')}По книгам</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="themes" tabindex="-1">${ic('theme')}По темам</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="maps" tabindex="-1">${ic('map')}Карты<span class="tab-n">${inventory.maps.length}</span></button>
    <button class="tab" role="tab" aria-selected="false" data-pane="places" tabindex="-1">${ic('compass')}Места<span class="tab-n">${inFrame}</span></button>
  </nav>

  <section class="pane on" id="pane-time">
    <div class="sec-head"><h2>Цари · Пророки · Империи</h2><div class="sec-orn"></div></div>
    <p class="lead">Синхронная шкала из реестров Атласа: наведите курсор на эпоху, правление или событие. Консервативная библейская хронология — ранний Исход 1446 г.; разделённое царство — согласованные даты Тиле.</p>
    <div class="tl-frame"><div class="tl-scroll"><div class="tl-flex">
      <div class="tl-labels">${labelsHtml}</div>
      ${timelineSvg}
    </div></div></div>
    <div class="legend">
      <span><b style="background:#15803d"></b>добрый царь</span>
      <span><b style="background:#b91c1c"></b>злой царь</span>
      <span><b style="background:#a16207"></b>смешанная оценка</span>
      <span><b style="background:#2d4f80"></b>событие</span>
      <span><b style="background:#c99a3a;border-radius:50%"></b>✦ внебиблейское свидетельство</span>
      <span><b style="background:repeating-linear-gradient(45deg,#f4eedc 0 2px,rgba(185,138,47,.5) 2px 3px);border:1px dashed #c6b384"></b>сорегентство</span>
      <span><b style="background:#eef4f9;border:1.5px solid #7d9cbe"></b>пишущий пророк</span>
      <span><b style="background:#eef4f9;border:1.5px dashed #a4bcd4"></b>устный пророк</span>
    </div>
    <details class="tbl"><summary>Данные шкалы таблицей — ${stats.kings} правителей</summary>
      <div class="tbl-scroll"><table><thead><tr><th>Престол</th><th>Правитель</th><th>Годы</th><th>Библейская оценка</th></tr></thead><tbody>${tableRows.join('')}</tbody></table></div>
    </details>
  </section>

  <section class="pane" id="pane-books">
    <div class="sec-head"><h2>Вход по книгам Писания</h2><div class="sec-orn"></div></div>
    <p class="lead">66 книг канона. Золотые карточки — книга уже покрыта картой Атласа; наведите курсор, чтобы увидеть какой.</p>
    ${booksHtml}
  </section>

  <section class="pane" id="pane-themes">
    <div class="sec-head"><h2>Вход по темам</h2><div class="sec-orn"></div></div>
    <p class="lead">Шесть архетипов карт Атласа — от маршрутов патриархов до планов городов.</p>
    ${themesHtml}
  </section>

  <section class="pane" id="pane-maps">
    <div class="sec-head"><h2>Карты Атласа</h2><div class="sec-orn"></div></div>
    <p class="lead">Живой инвентарь: счётчики — из базовой линии контент-паритета (гейт G6).</p>
    ${mapsHtml}
  </section>

  <section class="pane" id="pane-places">
    <div class="sec-head"><h2>Места Атласа · Левант</h2><div class="sec-orn"></div></div>
    <p class="lead">Канонический реестр мест на реальной подложке движка. Фирменная честность §3: точка показывает не только «где», но и «насколько уверенно мы это знаем».</p>
    ${placesHtml}
  </section>

  <footer>
    <div class="foot-orn">✦</div>
    Прототип оболочки Атласа: данные — <code>data/atlas/**</code>, генератор — <code>scripts/atlas-build-shell-preview.js</code>.
    Идентификации мест и веса уверенности частично производны от OpenBible.info Bible Geocoding Data (CC BY 4.0).
    Хронология — позиция сайта (ATLAS-CONTRACT §2-бис). Цвета эпох — draft-токены до дизайн-системы KA-6.
    <div class="foot-stamp">Сборка предпросмотра · ${new Date().toLocaleDateString('ru-RU')} · ветка claude/website-map-audit-ik3ypo · «Господь Бог — сила моя» (Авв 3:19)</div>
  </footer>
</div>
<div id="tip" role="tooltip"></div>
<div id="yearchip"></div>
<script>
(function(){
  var tabs=Array.prototype.slice.call(document.querySelectorAll('.tab'));
  function selectTab(t){
    tabs.forEach(function(x){x.setAttribute('aria-selected','false');x.tabIndex=-1});
    document.querySelectorAll('.pane').forEach(function(p){p.classList.remove('on')});
    t.setAttribute('aria-selected','true');t.tabIndex=0;
    document.getElementById('pane-'+t.dataset.pane).classList.add('on');
    if(history.replaceState) history.replaceState(null,'','#'+t.dataset.pane);
  }
  tabs.forEach(function(t){t.addEventListener('click',function(){selectTab(t)})});
  // клавиатура: ←/→ по вкладкам (roving tabindex)
  document.querySelector('nav.tabs').addEventListener('keydown',function(e){
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    var i=tabs.findIndex(function(t){return t.getAttribute('aria-selected')==='true'});
    var n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
    selectTab(n);n.focus();e.preventDefault();
  });
  var tip=document.getElementById('tip');
  document.addEventListener('mousemove',function(e){
    var g=e.target.closest('[data-tip]'); if(!g){tip.style.display='none';return}
    var t=g.getAttribute('data-tip-t');
    tip.innerHTML=(t?'<b></b>':'')+'';
    if(t){tip.querySelector('b').textContent=t}
    tip.appendChild(document.createTextNode(g.getAttribute('data-tip')||''));
    tip.style.display='block';
    var x=Math.min(e.clientX+14,window.innerWidth-tip.offsetWidth-10);
    var y=Math.min(e.clientY+16,window.innerHeight-tip.offsetHeight-10);
    tip.style.left=x+'px';tip.style.top=y+'px';
  });
  document.addEventListener('mouseleave',function(){tip.style.display='none'});
  // Подсветка диапазона эпохи на всей шкале
  var hl=document.getElementById('era-hl');
  document.querySelectorAll('.era-chip').forEach(function(c){
    c.addEventListener('mouseenter',function(){
      var x1=+c.dataset.x1, x2=+c.dataset.x2;
      hl.setAttribute('x',x1); hl.setAttribute('width',Math.max(x2-x1-2,2)); hl.setAttribute('opacity','1');
    });
    c.addEventListener('mouseleave',function(){hl.setAttribute('opacity','0')});
  });
  // Перекрестье года: вертикаль + плавающий чип «N до Р.Х.»
  var tl=document.getElementById('tl'), xh=document.getElementById('xhair'), yc=document.getElementById('yearchip');
  var R0=${R.start}, PXY=${PX_PER_YEAR}, PADL=${PAD_L}, XMAX=${W - PAD_R};
  if(tl){
    tl.addEventListener('mousemove',function(e){
      var pt=tl.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
      var p=pt.matrixTransform(tl.getScreenCTM().inverse());
      if(p.x<PADL||p.x>XMAX){xh.setAttribute('opacity','0');yc.style.display='none';return}
      var yr=Math.round(R0+(p.x-PADL)/PXY);
      xh.setAttribute('x1',p.x);xh.setAttribute('x2',p.x);xh.setAttribute('opacity','1');
      yc.textContent=(yr<0?(-yr)+' до Р.Х.':yr+' по Р.Х.');
      yc.style.display='block';
      yc.style.left=Math.min(e.clientX+12,window.innerWidth-yc.offsetWidth-8)+'px';
      yc.style.top=Math.max(e.clientY-34,8)+'px';
    });
    tl.addEventListener('mouseleave',function(){xh.setAttribute('opacity','0');yc.style.display='none'});
  }
  // Клик/Enter по точке мини-карты — открыть первую карту места
  document.querySelectorAll('.geo-dot[data-href]').forEach(function(d){
    d.addEventListener('click',function(){location.href=d.getAttribute('data-href')});
    d.addEventListener('keydown',function(e){if(e.key==='Enter'){location.href=d.getAttribute('data-href')}});
  });
  // Поиск по мини-карте: подсветка совпадений, затемнение остальных
  var q=document.getElementById('geo-q'), n=document.getElementById('geo-n');
  if(q){
    var dots=Array.prototype.slice.call(document.querySelectorAll('.geo-dot,.geo-lab[data-name]'));
    q.addEventListener('input',function(){
      var v=q.value.trim().toLowerCase().replace(/ё/g,'е');
      if(!v){dots.forEach(function(d){d.classList.remove('dim','hit')});n.textContent='';return}
      var hits=0;
      dots.forEach(function(d){
        var ok=d.getAttribute('data-name').indexOf(v)!==-1;
        d.classList.toggle('hit',ok);d.classList.toggle('dim',!ok);
        if(ok&&d.classList.contains('geo-dot'))hits++;
      });
      n.textContent=hits?('найдено: '+hits):'не найдено';
    });
  }
  // deep-link вкладки: #books / #themes / #maps / #places
  var h=(location.hash||'').replace('#','');
  if(h){var t0=document.querySelector('.tab[data-pane="'+h+'"]'); if(t0) selectTab(t0);}
})();
</script>
</body>
</html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`[atlas-shell-preview] → ${path.relative(ROOT, OUT)} (${Math.round(html.length / 1024)} KB; шкала ${Math.round(W)}×${H}px; hero-обложек найдено: ${inventory.maps.filter((m) => fs.existsSync(path.join(ROOT, 'images', `atlas-${m.slug}-scene-600w.webp`))).length}/${inventory.maps.length})`);
