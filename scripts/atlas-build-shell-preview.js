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
for (let y = Math.ceil(R.start / 50) * 50; y <= R.end; y += 50) {
  axis.push(`<line x1="${X(y)}" y1="6" x2="${X(y)}" y2="${Y}" class="grid"/>`);
  axis.push(`<text x="${X(y)}" y="${Y + 16}" text-anchor="middle" class="axis-year">${-y}</text>`);
}
const H = Y + 26;

const timelineSvg =
  `<svg id="tl" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Синхронная шкала: эпохи, цари, пророки, империи и события; подробности — в подсказках и в таблице ниже">` +
  `<defs>` +
  `<linearGradient id="gSeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f1e0"/><stop offset="1" stop-color="#eadfc2"/></linearGradient>` +
  `<linearGradient id="gProph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef4f9"/><stop offset="1" stop-color="#d9e6f0"/></linearGradient>` +
  `<linearGradient id="gEmp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4e7e0"/><stop offset="1" stop-color="#e6cfc4"/></linearGradient>` +
  `</defs>` +
  bands.join('') + axis.join('') +
  `<rect id="era-hl" x="0" y="4" width="0" height="${Y - 2}" class="era-hl" opacity="0"/>` +
  svg.join('') + `</svg>`;

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
};
const ic = (name, cls) => `<span class="ic ${cls || ''}" aria-hidden="true">${IC[name]}</span>`;

// ── Ось «По книгам» ──────────────────────────────────────────────────────────
const SECTIONS = [['law', 'Закон · Тора', 'I'], ['history', 'Исторические книги', 'II'], ['poetry', 'Учительные', 'III'], ['major-prophets', 'Большие пророки', 'IV'], ['minor-prophets', 'Малые пророки', 'V'], ['gospels', 'Евангелия', 'VI'], ['acts', 'Деяния апостолов', 'VII'], ['pauline', 'Послания Павла', 'VIII'], ['general', 'Соборные послания', 'IX'], ['revelation', 'Откровение', 'X']];
const booksHtml = SECTIONS.map(([sec, ru, num]) => {
  const list = books.filter((b) => b.section === sec);
  const covered = list.filter((b) => b.maps && b.maps.length).length;
  return `<div class="book-sec"><div class="book-sec-head"><span class="book-num">${num}</span><h4>${ru}</h4><span class="book-cov">${covered ? `${covered} с картами` : ''}</span></div><div class="chips">` + list.map((b) => {
    const has = b.maps && b.maps.length;
    return `<span class="chip${has ? ' has-map' : ''}" data-tip-t="${esc(b.title.ru)}" data-tip="${esc(`${b.chapters} гл.` + (has ? ` · карты: ${b.maps.join(', ')}` : ' · карт пока нет'))}">${esc(b.title.abbr)}</span>`;
  }).join('') + `</div></div>`;
}).join('');

// ── Ось «По темам» ───────────────────────────────────────────────────────────
const THEMES = [
  ['route', 'Маршруты и путешествия', 'Авраам · Исход · Павел', 'Давид · Иаков и Иосиф · Илия и Елисей'],
  ['crown', 'Царства и границы', 'Царства Израиля и Иудеи', 'Четыре царства Даниила · Мир Ирода'],
  ['region', 'Территории и уделы', 'Земля двенадцати колен', 'Таблица народов'],
  ['city', 'Планы городов', '—', 'Иерусалим по эпохам · Вавилон Даниила'],
  ['layers', 'Тематические слои', 'Семь церквей Откровения', 'Пророчества о народах'],
  ['compass', 'Обзор и вход', '—', 'Земля Библии · Хронология · Сравнение эпох'],
];
const themesHtml = `<div class="themes-grid">` + THEMES.map(([icn, t, now, plan]) =>
  `<div class="theme-card">${ic(icn, 'theme-ic')}<h4>${esc(t)}</h4>` +
  (now !== '—' ? `<p class="theme-now">${esc(now)}</p>` : '') +
  `<p class="theme-plan">в каталоге: ${esc(plan)}</p></div>`).join('') + `</div>` +
  `<p class="note">Курсивом-планом отмечены карты целевого каталога (ATLAS-CONTRACT §9) — они появятся волнами KA-7…KA-9.</p>`;

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
const mapsHtml = `<div class="maps-grid">` + inventory.maps.map((m) => {
  const st = m.slug === 'avraam' ? ['live', 'на витрине'] : (m.publication === 'none' ? ['semi', 'production · вне витрины'] : ['hold', 'на аудите']);
  const meta = routeMeta[m.slug];
  const per = mapPeriod.get(m.slug);
  const tone = (per && per.colorToken) || '#d9c69a';
  const cover600 = path.join(ROOT, 'images', `atlas-${m.slug}-scene-600w.webp`);
  const hasCover = fs.existsSync(cover600);
  const hero = hasCover
    ? `<img src="../../images/atlas-${m.slug}-scene-600w.webp" alt="" loading="lazy">`
    : `<div class="map-hero-ph" style="--tone:${tone}">${ic(ARCH_ICON[m.slug] || 'map', 'hero-ic')}</div>`;
  return `<article class="map-card">` +
    `<div class="map-hero">${hero}<span class="map-status ${st[0]}">${st[1]}</span></div>` +
    `<div class="map-body"><h4>${esc(meta.title)}</h4>` +
    `<div class="map-era">${esc(ERA_RU[meta.era] || meta.era || (per ? per.title.ru : ''))}</div>` +
    `<div class="map-meta">${plural(m.counts.places, ['место', 'места', 'мест'])} · ${plural(m.counts.stages, ['этап', 'этапа', 'этапов'])} · ${plural(m.counts.stories, ['история', 'истории', 'историй'])}</div>` +
    `<div class="map-foot"><span class="map-slug">/karty/${m.slug}/</span><span class="map-go">Открыть →</span></div></div></article>`;
}).join('') + `</div>` +
  `<p class="note">Hero-зоны карточек готовы под обложки-сцены (images/atlas-&lt;slug&gt;-scene-600w.webp, VISUAL-DIRECTION §8.2): файл появится — карточка подхватит его при перегенерации автоматически.</p>`;

// ── Мини-карта Леванта (KA-4c шаг 1): места реестра на реальной подложке ─────
// Подложка: karty/_engine/base-geo.svg (семейство levant, 0 0 1900 1430 — заморожено).
// Точки: placements.levant из data/atlas/places/*.json; кодировка честности §3:
// заливка = уверенная локализация, золото = спорная, пунктирный контур = слабая/традиционная.
const placesAll = loadDir(A('places'));
const RANK = { consensus: 6, primary: 5, candidate: 4, alternative: 3, caveat: 2, minor: 1, rejected: 0 };
const TYPE_RU = { city: 'город', town: 'посёлок', region: 'регион', mountain: 'гора', river: 'река', sea: 'море', lake: 'озеро', spring: 'источник', road: 'дорога', garden: 'сад', structure: 'сооружение', sanctuary: 'святилище', camp: 'стан', valley: 'долина', other: 'место' };
const STATUS_WORD = { sure: 'уверенная локализация', disputed: 'СПОРНАЯ локализация — есть варианты', weak: 'слабая/традиционная локализация', plain: 'позиция реестра (без внешней идентификации)' };

const baseGeoRaw = fs.readFileSync(path.join(ROOT, 'karty', '_engine', 'base-geo.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const geoDots = [];
const geoLabels = [];
let inFrame = 0, offFamily = 0, subSkipped = 0, regionSkipped = 0;
for (const p of placesAll.sort((a, b) => (b.maps || []).length - (a.maps || []).length)) {
  const pl = p.placements && p.placements.levant;
  if (!pl) { offFamily++; continue; }
  if (p.parentId) { subSkipped++; continue; } // суб-локации — дело городских планов (KA-6)
  if (p.type === 'region') { regionSkipped++; continue; } // регионы — полигоны KA-6, точкой не врём
  inFrame++;
  const idents = p.identifications || [];
  const best = idents.reduce((b, i) => (RANK[i.status] > RANK[b] ? i.status : b), 'rejected');
  const cls = !idents.length ? 'plain'
    : (best === 'consensus' || best === 'primary') ? 'sure'
    : best === 'candidate' ? 'disputed' : 'weak';
  const nMaps = (p.maps || []).length;
  const r = 3 + 1.15 * Math.sqrt(Math.max(nMaps - 1, 0));
  const cands = idents.filter((i) => RANK[i.status] >= RANK.alternative).length;
  const tipRest = `${TYPE_RU[p.type] || p.type} · ${STATUS_WORD[cls]}` +
    (cls === 'disputed' && cands > 1 ? ` (${cands} кандидата)` : '') +
    ` · карты: ${(p.maps || []).map((m) => m.slug).join(', ')}`;
  const tip = tipAttr(p.names.ru, tipRest);
  geoDots.push(`<g ${tip}><circle cx="${pl.x}" cy="${pl.y}" r="${r.toFixed(1)}" class="dot-${cls}"/></g>`);
  if (nMaps >= 3 || (cls === 'disputed' && nMaps >= 2)) {
    const side = pl.x > 1550 ? -1 : 1;
    geoLabels.push(`<text x="${pl.x + side * (r + 5)}" y="${pl.y + 3.5}" ${side < 0 ? 'text-anchor="end"' : ''} class="geo-lab">${esc(p.names.ru)}</text>`);
  }
}

const placesHtml =
  `<div class="geo-frame"><svg viewBox="0 0 1900 1430" class="geo-svg" role="img" aria-label="Мини-карта Леванта: места реестра Атласа со статусами уверенности локализаций">` +
  baseGeoRaw + geoDots.join('') + geoLabels.join('') + `</svg></div>` +
  `<div class="legend geo-legend">` +
  `<span><b style="background:#1e3a63;border-radius:50%"></b> уверенная локализация</span>` +
  `<span><b style="background:#d9b36a;border:1.5px solid #8a6a1f;border-radius:50%"></b> спорная — варианты в реестре</span>` +
  `<span><b style="background:transparent;border:1.5px dashed #1e3a63;border-radius:50%"></b> слабая / традиционная</span>` +
  `<span><b style="background:#7d8ba1;border-radius:50%"></b> позиция реестра</span>` +
  `</div>` +
  `<p class="note">В кадре ${inFrame} мест семейства levant (размер точки — число карт с местом; наведите курсор — статус и карты). ` +
  `Честно за кадром: ${regionSkipped} регионов (уделы колен и т.п.) появятся ПОЛИГОНАМИ в KA-6 — точкой их не изображаем; ${subSkipped} суб-локаций (Горница, Гефсимания…) — на городских планах; ${offFamily} средиземноморских мест (Павел, семь церквей) — в семействе mediterranean со своей подложкой. ` +
  `Подложка — художественная развёртка base-geo.svg (не строгая проекция; kmPerUnit ≈ 0.92).</p>`;

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
    --parch:#f6f1e7;--parch2:#efe7d4;--card:#fcf9f1;--line:#ddd0b4;--line2:#e9dfc8}
  *{box-sizing:border-box;margin:0}
  html{scroll-behavior:smooth}
  body{background:
      radial-gradient(1100px 500px at 85% -140px, rgba(217,179,106,.16), transparent 62%),
      radial-gradient(900px 420px at -80px 22%, rgba(30,58,99,.07), transparent 60%),
      var(--parch);
    color:var(--ink);font:15px/1.55 Georgia,'Times New Roman',serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1200px;margin:0 auto;padding:30px 22px 64px}

  /* ── Hero ── */
  header.hero{position:relative;border:1px solid var(--line);border-radius:16px;overflow:hidden;
    background:linear-gradient(160deg,#fbf7ec 0%,#f3ebd8 58%,#eee2c8 100%);
    box-shadow:0 1px 0 #fff inset,0 14px 34px -22px rgba(74,58,24,.45);
    padding:30px 34px 26px;margin-bottom:24px}
  header.hero::after{content:"";position:absolute;inset:7px;border:1px solid rgba(185,138,47,.28);border-radius:11px;pointer-events:none}
  .hero-compass{position:absolute;right:22px;top:50%;transform:translateY(-50%);width:150px;height:150px;opacity:.5;pointer-events:none}
  .hero-compass svg{width:100%;height:100%;fill:none;stroke:#a98a4e;stroke-width:1}
  .kicker{font:600 11px/1 system-ui,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}
  .h1row{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin:8px 0 2px}
  h1{font-size:40px;line-height:1.05;color:var(--blue);letter-spacing:.01em}
  .he{font-size:19px;color:var(--gold);direction:rtl;letter-spacing:.14em}
  .sub{color:var(--ink2);font-style:italic;max-width:600px}
  .hero-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;font:600 11px/1 system-ui,sans-serif}
  .hm{background:rgba(255,255,255,.65);border:1px solid var(--line);border-radius:999px;padding:7px 12px;color:var(--ink2)}
  .hm b{color:var(--blue);font-weight:700}
  .hm.warn{background:#f6e7de;border-color:#dcb9a4;color:#8a4a2e}

  /* ── Tabs ── */
  nav.tabs{display:flex;gap:6px;margin:0 0 20px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:0}
  .tab{display:inline-flex;align-items:center;gap:8px;font:600 13.5px/1 system-ui,sans-serif;letter-spacing:.01em;
    padding:12px 16px 13px;border:0;border-bottom:2.5px solid transparent;background:none;color:var(--ink2);cursor:pointer;border-radius:8px 8px 0 0}
  .tab:hover{background:rgba(185,138,47,.07);color:var(--ink)}
  .tab[aria-selected="true"]{color:var(--blue);border-bottom-color:var(--gold)}
  .ic{display:inline-flex;width:17px;height:17px;flex:none}
  .ic svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
  section.pane{display:none}section.pane.on{display:block}

  .sec-head{display:flex;align-items:baseline;gap:14px;margin:6px 0 4px}
  h2{color:var(--blue);font-size:23px}
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
  .tl-lab.axis{font:italic 600 11px/1 Georgia,'Times New Roman',serif;color:#a59772}
  .band{fill:rgba(30,58,99,.035)}
  .group-line{stroke:rgba(185,138,47,.35);stroke-width:1;stroke-dasharray:1 5;stroke-linecap:round}
  .chip-text{font:700 11px/1 system-ui,sans-serif;fill:#2b2418;letter-spacing:.03em;pointer-events:none}
  .chip-text-sm{font-size:9.5px;letter-spacing:0}
  .era-pill{stroke:rgba(120,95,40,.4);stroke-width:1;filter:none}
  .era-hl{fill:rgba(185,138,47,.10);stroke:rgba(185,138,47,.4);stroke-width:1;stroke-dasharray:2 3;transition:opacity .18s}
  .grid{stroke:#e9dfc6;stroke-width:1}
  .axis-year,.axis-era{font:600 10px/1 system-ui,sans-serif;fill:#a59772}
  .seg{fill:url(#gSeg);stroke:#c6b384;stroke-width:1}
  .seg.coreg{stroke-dasharray:3.5 2.5}
  .seg-text{font:600 11px/1 system-ui,sans-serif;fill:var(--ink);dominant-baseline:middle;pointer-events:none}
  .prophet-seg{fill:url(#gProph);stroke:#a4bcd4;stroke-width:1}
  .prophet-seg.writing{stroke:#7d9cbe;stroke-width:1.2}
  .prophet-text{font:600 10.5px/1 system-ui,sans-serif;fill:#1e3a63;dominant-baseline:middle}
  .emp-seg{fill:url(#gEmp);stroke:#c39d8b;stroke-width:1}
  .realm-caption{font:700 10px/1 system-ui,sans-serif;fill:#96604a;letter-spacing:.14em;text-transform:uppercase}
  .realm-sep{stroke:#d6bcae;stroke-width:1;stroke-dasharray:2 3}
  .event-mark{fill:#2d4f80;stroke:#fcf9f1;stroke-width:1.6}
  .event-star{fill:#c99a3a;stroke:#fcf9f1;stroke-width:1.4}
  g[data-tip]{cursor:default}
  g[data-tip]:hover .seg,g[data-tip]:hover .prophet-seg,g[data-tip]:hover .emp-seg{stroke:var(--blue);stroke-width:1.7;filter:brightness(1.03)}
  g[data-tip]:hover .event-mark,g[data-tip]:hover .event-star{transform:scale(1.3);transform-box:fill-box;transform-origin:center}
  g[data-tip]:hover .era-pill{stroke:var(--blue);stroke-width:1.5}

  #tip{position:fixed;display:none;max-width:340px;background:#2a2415;color:#f3ecd9;font:12.5px/1.5 system-ui,sans-serif;
    padding:10px 13px;border-radius:9px;pointer-events:none;z-index:9;box-shadow:0 6px 20px rgba(30,26,14,.4);border:1px solid #4a3f24}
  #tip b{display:block;font-size:13px;color:#ecd9a8;margin-bottom:3px}

  .legend{display:flex;gap:16px;flex-wrap:wrap;font:12px/1 system-ui,sans-serif;color:var(--ink2);margin:14px 4px 4px}
  .legend span{display:inline-flex;align-items:center}
  .legend b{display:inline-block;width:12px;height:12px;border-radius:3.5px;margin-right:7px}
  details.tbl{margin-top:16px;font:13px/1.5 system-ui,sans-serif}
  details.tbl summary{cursor:pointer;color:var(--blue);font-weight:600;padding:4px 0}
  table{border-collapse:collapse;margin-top:10px;background:var(--card);border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px var(--line)}
  td,th{border-bottom:1px solid var(--line2);padding:6px 12px;text-align:left}
  th{font:600 11.5px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;background:var(--parch2);color:var(--ink2)}
  tr:last-child td{border-bottom:0}

  /* ── Books ── */
  .book-sec{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:12px;
    box-shadow:0 1px 0 #fff inset}
  .book-sec-head{display:flex;align-items:baseline;gap:12px;margin-bottom:10px}
  .book-num{font:700 12px/1 Georgia,serif;color:var(--gold);letter-spacing:.1em}
  .book-sec h4{font:600 12.5px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--ink2)}
  .book-cov{margin-left:auto;font:600 10.5px/1 system-ui,sans-serif;color:var(--gold);letter-spacing:.04em}
  .chips{display:flex;flex-wrap:wrap;gap:7px}
  .chip{font:600 12.5px/1 system-ui,sans-serif;background:#fff;border:1px solid var(--line);border-radius:9px;
    padding:8px 11px;color:var(--ink2);transition:border-color .15s, box-shadow .15s}
  .chip:hover{border-color:var(--blue);box-shadow:0 2px 8px -4px rgba(30,58,99,.4)}
  .chip.has-map{border-color:var(--gold2);color:var(--ink);background:linear-gradient(180deg,#fffdf6,#faf3e2);
    box-shadow:0 1px 4px -2px rgba(185,138,47,.5)}

  /* ── Themes ── */
  .themes-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .theme-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px 16px;
    box-shadow:0 1px 0 #fff inset,0 8px 20px -18px rgba(74,58,24,.5);transition:transform .18s, box-shadow .18s}
  .theme-card:hover{transform:translateY(-2px);box-shadow:0 1px 0 #fff inset,0 14px 26px -18px rgba(74,58,24,.55)}
  .theme-ic{width:26px;height:26px;color:var(--gold);margin-bottom:10px}
  .theme-card h4{color:var(--blue);font-size:17px;margin-bottom:6px}
  .theme-now{font:13.5px/1.55 system-ui,sans-serif;color:var(--ink)}
  .theme-plan{font:italic 12.5px/1.55 Georgia,serif;color:var(--ink3);margin-top:4px}

  /* ── Map cards ── */
  .maps-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(264px,1fr));gap:16px}
  .map-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;
    box-shadow:0 1px 0 #fff inset,0 10px 24px -20px rgba(74,58,24,.5);transition:transform .18s, box-shadow .18s}
  .map-card:hover{transform:translateY(-3px);box-shadow:0 1px 0 #fff inset,0 18px 32px -20px rgba(74,58,24,.55)}
  .map-hero{position:relative;aspect-ratio:16/9;background:var(--parch2)}
  .map-hero img{width:100%;height:100%;object-fit:cover;display:block}
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
  .map-body h4{color:var(--blue);font-size:16.5px;line-height:1.25}
  .map-era{font:italic 12px/1.4 Georgia,serif;color:var(--ink3)}
  .map-meta{font:12px/1.5 system-ui,sans-serif;color:var(--ink2)}
  .map-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:9px;border-top:1px solid var(--line2)}
  .map-slug{font:10.5px/1 ui-monospace,monospace;color:var(--ink3)}
  .map-go{font:600 12px/1 system-ui,sans-serif;color:var(--gold);letter-spacing:.02em}
  .map-card:hover .map-go{color:var(--blue)}

  .note{font:12px/1.55 system-ui,sans-serif;color:var(--ink3);margin-top:12px}

  /* ── Мини-карта Леванта ── */
  .geo-frame{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#eae2cd;
    box-shadow:0 1px 0 #fff inset,0 10px 26px -20px rgba(74,58,24,.4)}
  .geo-svg{width:100%;height:auto;display:block}
  .dot-sure{fill:#1e3a63;stroke:#f6f1e7;stroke-width:1.1}
  .dot-disputed{fill:#d9b36a;stroke:#8a6a1f;stroke-width:1.2}
  .dot-weak{fill:rgba(246,241,231,.35);stroke:#1e3a63;stroke-width:1.2;stroke-dasharray:2.2 1.7}
  .dot-plain{fill:#7d8ba1;stroke:#f6f1e7;stroke-width:1}
  .dot-region{fill:rgba(150,96,74,.07);stroke:#96604a;stroke-width:1.2;stroke-dasharray:3 2}
  .geo-svg g[data-tip]:hover circle,.geo-svg g[data-tip]:hover rect{stroke:var(--blue);stroke-width:2;transform:scale(1.25);transform-box:fill-box;transform-origin:center}
  .geo-lab{font:600 12.5px Georgia,'Times New Roman',serif;fill:#2b2418;pointer-events:none;
    paint-order:stroke;stroke:rgba(242,234,216,.85);stroke-width:3px;stroke-linejoin:round}
  .geo-legend{margin-top:14px}
  .geo-legend b{border:0}
  footer{margin-top:38px;border-top:1px solid var(--line);padding-top:15px;font:12px/1.7 system-ui,sans-serif;color:var(--ink3)}
  footer code{font-family:ui-monospace,monospace;background:var(--parch2);padding:1px 5px;border-radius:4px}
  @media (max-width:720px){
    h1{font-size:30px}.hero-compass{display:none}header.hero{padding:22px 20px}
    .tab{padding:10px 10px 11px;font-size:12.5px}.tl-labels{width:112px}.tl-lab{width:106px;font-size:10.5px}
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="hero-compass"><svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="38.5"/><circle cx="50" cy="50" r="3.2"/>
      <path d="M50 8 L54.5 45.5 L50 50 L45.5 45.5 Z M50 92 L54.5 54.5 L50 50 L45.5 54.5 Z M8 50 L45.5 45.5 L50 50 L45.5 54.5 Z M92 50 L54.5 45.5 L50 50 L54.5 54.5 Z"/>
      <path d="M50 16v6M50 78v6M16 50h6M78 50h6M26 26l4 4M70 70l4 4M74 26l-4 4M30 70l-4 4" />
    </svg></div>
    <div class="kicker">Господь Бог — Сила Моя · предпросмотр оболочки</div>
    <div class="h1row"><h1>Библейский Атлас</h1><span class="he">אַטְלָס הַמִּקְרָא</span></div>
    <div class="sub">Исследуйте события Писания через географию, хронологию и археологию — честно там, где данные спорны.</div>
    <div class="hero-meta">
      <span class="hm"><b>${stats.kings}</b> царей</span>
      <span class="hm"><b>${stats.prophets}</b> пророков</span>
      <span class="hm"><b>${stats.emperors}</b> императоров</span>
      <span class="hm"><b>${stats.events}</b> событий</span>
      <span class="hm"><b>${inventory.maps.length}</b> карт</span>
      <span class="hm warn">KA-4 preview · не production</span>
    </div>
  </header>

  <nav class="tabs" role="tablist">
    <button class="tab" role="tab" aria-selected="true" data-pane="time">${ic('time')}По времени</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="books">${ic('book')}По книгам</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="themes">${ic('theme')}По темам</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="maps">${ic('map')}Карты</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="places">${ic('compass')}Места</button>
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
      <span><b style="background:#f7f1e0;border:1px dashed #c6b384"></b>сорегентство</span>
    </div>
    <details class="tbl"><summary>Данные шкалы таблицей — ${stats.kings} правителей</summary>
      <table><thead><tr><th>Престол</th><th>Правитель</th><th>Годы</th><th>Библейская оценка</th></tr></thead><tbody>${tableRows.join('')}</tbody></table>
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
    Прототип оболочки Атласа: данные — <code>data/atlas/**</code>, генератор — <code>scripts/atlas-build-shell-preview.js</code>.
    Идентификации мест и веса уверенности частично производны от OpenBible.info Bible Geocoding Data (CC BY 4.0).
    Хронология — позиция сайта (ATLAS-CONTRACT §2-бис). Цвета эпох — draft-токены до дизайн-системы KA-6.
  </footer>
</div>
<div id="tip" role="tooltip"></div>
<script>
(function(){
  var tabs=document.querySelectorAll('.tab');
  tabs.forEach(function(t){t.addEventListener('click',function(){
    tabs.forEach(function(x){x.setAttribute('aria-selected','false')});
    document.querySelectorAll('.pane').forEach(function(p){p.classList.remove('on')});
    t.setAttribute('aria-selected','true');
    document.getElementById('pane-'+t.dataset.pane).classList.add('on');
  })});
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
  // deep-link вкладки: #books / #themes / #maps
  var h=(location.hash||'').replace('#','');
  if(h){var t=document.querySelector('.tab[data-pane="'+h+'"]'); if(t) t.click();}
})();
</script>
</body>
</html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`[atlas-shell-preview] → ${path.relative(ROOT, OUT)} (${Math.round(html.length / 1024)} KB; шкала ${Math.round(W)}×${H}px; hero-обложек найдено: ${inventory.maps.filter((m) => fs.existsSync(path.join(ROOT, 'images', `atlas-${m.slug}-scene-600w.webp`))).length}/${inventory.maps.length})`);
