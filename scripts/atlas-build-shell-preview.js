#!/usr/bin/env node
/**
 * atlas-build-shell-preview.js — генератор ЖИВОГО ПРОТОТИПА оболочки Атласа (KA-4 preview).
 *
 * Выход: audit/atlas-preview/index.html — самодостаточный HTML (без внешних зависимостей),
 * в SAFE-зоне audit/ (НЕ production, НЕ витрина, не попадает в контрактные проверки dist).
 * Назначение: owner-review «духа макетов» на РЕАЛЬНЫХ данных реестров data/atlas/**:
 *   - синхронная хронополоса «цари ↔ пророки ↔ империи» (низ макета «Царства»);
 *   - оси навигации хаба: По времени / По книгам / По темам / Карты.
 *
 * Палитра статусов оценок царей валидирована skill-скриптом dataviz на поверхности
 * #f6f1e7: good #15803d / evil #b91c1c / mixed #a16207 (PASS; CVD-warn 8.2 в легальной
 * зоне — оценка ВСЕГДА дублируется словом в тултипе, идентичность сегмента несёт текст).
 * Чипы эпох используют draft-токены periods/* (подписи прямо на чипах = secondary
 * encoding); финальные токены — KA-6.
 *
 * Перегенерация: node scripts/atlas-build-shell-preview.js (после правок реестров).
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
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas-inventory-baseline.json'), 'utf8'));
const routeTitles = {};
for (const m of inventory.maps) {
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'karty', m.slug, 'route.json'), 'utf8'));
  routeTitles[m.slug] = (r.meta && r.meta.title) || m.slug;
}

// ── Хронополоса (SVG) ────────────────────────────────────────────────────────
const R = timeline.range;
const PX_PER_YEAR = 1.9;
const LABEL_W = 118, PAD_R = 24;
const W = LABEL_W + (R.end - R.start) * PX_PER_YEAR + PAD_R;
const X = (y) => LABEL_W + (y - R.start) * PX_PER_YEAR;
const STATUS = { good: '#15803d', evil: '#b91c1c', mixed: '#a16207' };
const STATUS_RU = { good: 'добрый царь («делал угодное»)', evil: 'злой царь («делал неугодное»)', mixed: 'смешанная оценка' };
const REALM_RU = { assyria: 'Ассирия', babylon: 'Вавилон', persia: 'Персия', israel: 'Израиль', judah: 'Иудея', united: 'единое царство' };
const yearRu = (y) => (y < 0 ? `${-y} до Р.Х.` : `${y} по Р.Х.`);

let svg = [];
let Y = 8;
function laneLabel(text, h) {
  svg.push(`<text x="${LABEL_W - 10}" y="${Y + h / 2 + 4}" text-anchor="end" class="lane-label">${esc(text)}</text>`);
}
function grid() {
  const parts = [];
  for (let y = Math.ceil(R.start / 50) * 50; y <= R.end; y += 50) {
    parts.push(`<line x1="${X(y)}" y1="0" x2="${X(y)}" y2="__H__" class="grid"/>`);
    parts.push(`<text x="${X(y)}" y="__H2__" text-anchor="middle" class="axis-year">${-y}</text>`);
  }
  return parts;
}
const gridParts = grid();

// Чипы эпох
{
  const h = 26; laneLabel('Эпоха', h);
  for (const p of timeline.periods) {
    const x = X(p.start), w = X(p.end) - x;
    svg.push(`<g class="era-chip" data-era="${p.id}" data-tip="${esc(p.label)} · ${esc(yearRu(p.start))} — ${esc(yearRu(p.end))}${p.colorStatus === 'draft' ? ' · цвет draft (KA-6)' : ''}">` +
      `<rect x="${x}" y="${Y}" width="${Math.max(w - 2, 2)}" height="${h}" rx="5" fill="${p.color || '#e5dcc4'}" stroke="#b8a97f" stroke-width="1"/>` +
      (w > 70 ? `<text x="${x + w / 2}" y="${Y + h / 2 + 4}" text-anchor="middle" class="chip-text">${esc(p.label)}</text>` : '') + `</g>`);
  }
  Y += h + 10;
}
// Полосы царей
function kingsLane(name, segs) {
  const h = 30; laneLabel(name, h);
  svg.push(`<line x1="${LABEL_W}" y1="${Y + h + 3}" x2="${W - PAD_R}" y2="${Y + h + 3}" class="lane-sep"/>`);
  for (const s of segs) {
    const x = X(s.start), w = Math.max(X(s.end) - x, 3);
    const tip = `${s.label} · ${yearRu(s.start)} — ${yearRu(s.end)}` +
      (s.assessment ? ` · ${STATUS_RU[s.assessment]}` : '') +
      (s.dynasty ? ` · династия: ${s.dynasty}` : '') + (s.coregency ? ' · сорегентство/параллельное правление' : '');
    svg.push(`<g data-tip="${esc(tip)}">` +
      `<rect x="${x}" y="${Y}" width="${Math.max(w - 2, 2)}" height="${h - 5}" rx="4" class="seg${s.coregency ? ' coreg' : ''}"/>` +
      (s.assessment ? `<rect x="${x}" y="${Y + h - 8}" width="${Math.max(w - 2, 2)}" height="3" rx="1.5" fill="${STATUS[s.assessment]}"/>` : '') +
      (w > s.label.length * 6.4 + 8 ? `<text x="${x + w / 2}" y="${Y + h / 2 + 1}" text-anchor="middle" class="seg-text">${esc(s.label)}</text>` : '') + `</g>`);
  }
  Y += h + 6;
}
kingsLane('Единое царство', timeline.lanes.united);
kingsLane('Израиль (север)', timeline.lanes.israel);
kingsLane('Иудея (юг)', timeline.lanes.judah);
Y += 4;
// Пророки
function prophetLane(name, segs) {
  // Служения пересекаются (Иона/Амос/Осия) — greedy-раскладка по под-дорожкам.
  const rowH = 20, gap = 3;
  const tracks = [];
  const placed = segs.map((s) => {
    let tIdx = tracks.findIndex((endX) => X(s.start) >= endX + 4);
    if (tIdx === -1) { tracks.push(0); tIdx = tracks.length - 1; }
    tracks[tIdx] = X(s.end);
    return { s, tIdx };
  });
  const h = tracks.length * rowH + (tracks.length - 1) * gap;
  laneLabel(name, h);
  for (const { s, tIdx } of placed) {
    const x = X(s.start), w = Math.max(X(s.end) - x, 4);
    const yy = Y + tIdx * (rowH + gap);
    const tip = `${s.label} · служение ~${yearRu(s.start)} — ${yearRu(s.end)}` + (s.bookAbbrs && s.bookAbbrs.length ? ` · книга: ${s.bookAbbrs.join(', ')}` : ' · устный пророк');
    svg.push(`<g data-tip="${esc(tip)}">` +
      `<rect x="${x}" y="${yy}" width="${Math.max(w - 2, 2)}" height="${rowH - 3}" rx="8" class="prophet-seg"/>` +
      (w > s.label.length * 5.6 + 6 ? `<text x="${x + w / 2}" y="${yy + rowH / 2 - 1}" text-anchor="middle" class="prophet-text">${esc(s.label)}</text>` : '') + `</g>`);
  }
  Y += h + 6;
}
prophetLane('Пророки · Север', timeline.lanes['prophets-north']);
prophetLane('Пророки · Юг', timeline.lanes['prophets-south']);
prophetLane('Пророки · Плен', timeline.lanes['prophets-exile']);
Y += 4;
// Империи
{
  const h = 26; laneLabel('Империи', h);
  let prevRealm = null;
  for (const s of timeline.lanes.empires) {
    const x = X(s.start), w = Math.max(X(s.end) - x, 3);
    if (s.realm !== prevRealm) {
      svg.push(`<text x="${x + 2}" y="${Y - 3}" class="realm-caption">${esc(REALM_RU[s.realm] || s.realm)}</text>`);
      if (prevRealm) svg.push(`<line x1="${x - 1}" y1="${Y - 12}" x2="${x - 1}" y2="${Y + h}" class="realm-sep"/>`);
      prevRealm = s.realm;
    }
    const tip = `${s.label} (${REALM_RU[s.realm] || s.realm}) · ${yearRu(s.start)} — ${yearRu(s.end)}`;
    svg.push(`<g data-tip="${esc(tip)}">` +
      `<rect x="${x}" y="${Y}" width="${Math.max(w - 2, 2)}" height="${h - 5}" rx="4" class="emp-seg"/>` +
      (w > s.label.length * 6 + 8 ? `<text x="${x + w / 2}" y="${Y + h / 2 + 1}" text-anchor="middle" class="seg-text">${esc(s.label)}</text>` : '') + `</g>`);
  }
  Y += h + 8;
}
// События
{
  const h = 30; laneLabel('События', h);
  for (const e of timeline.events) {
    const x = X(e.year);
    const tip = `${e.label} · ${e.approx ? '~' : ''}${yearRu(e.year)}` + (e.extraBiblical ? ' · ✦ есть внебиблейское свидетельство' : '');
    svg.push(`<g data-tip="${esc(tip)}">` +
      `<path d="M${x},${Y + 4} l6,7 l-6,7 l-6,-7 z" class="event-mark${e.extraBiblical ? ' xb' : ''}"/>` + `</g>`);
  }
  Y += h;
}
const H = Y + 20;
const gridSvg = gridParts.join('').replace(/__H__/g, String(H - 18)).replace(/__H2__/g, String(H - 5));
const timelineSvg = `<svg id="tl" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Синхронная хронологическая шкала: эпохи, цари единого царства, Израиля и Иудеи, пророки Севера, Юга и плена, императоры империй, ключевые события; подробности каждого элемента — во всплывающей подсказке и в таблице под шкалой">${gridSvg}${svg.join('')}</svg>`;

// ── Таблица (a11y/данные) ────────────────────────────────────────────────────
const tableRows = [];
for (const [lane, ru] of [['united', 'Единое царство'], ['israel', 'Израиль'], ['judah', 'Иудея']]) {
  for (const s of timeline.lanes[lane]) tableRows.push(`<tr><td>${ru}</td><td>${esc(s.label)}</td><td>${esc(yearRu(s.start))} — ${esc(yearRu(s.end))}</td><td>${s.assessment ? esc(STATUS_RU[s.assessment]) : '—'}</td></tr>`);
}

// ── Ось «По книгам» ──────────────────────────────────────────────────────────
const SECTIONS = [['law', 'Закон (Тора)'], ['history', 'Исторические'], ['poetry', 'Учительные'], ['major-prophets', 'Большие пророки'], ['minor-prophets', 'Малые пророки'], ['gospels', 'Евангелия'], ['acts', 'Деяния'], ['pauline', 'Послания Павла'], ['general', 'Соборные послания'], ['revelation', 'Откровение']];
const booksHtml = SECTIONS.map(([sec, ru]) => {
  const list = books.filter((b) => b.section === sec);
  return `<div class="book-sec"><h4>${ru}</h4><div class="chips">` + list.map((b) => {
    const has = b.maps && b.maps.length;
    const tip = `${b.title.ru} · ${b.chapters} гл.` + (has ? ` · карты: ${b.maps.join(', ')}` : ' · карт пока нет');
    return `<span class="chip${has ? ' has-map' : ''}" data-tip="${esc(tip)}">${esc(b.title.abbr)}${has ? '<i class="dot"></i>' : ''}</span>`;
  }).join('') + `</div></div>`;
}).join('');

// ── Ось «По темам» (архетипы из ATLAS-CONTRACT §5/§9) ───────────────────────
const THEMES = [
  ['Маршруты и путешествия', 'route', 'Авраам · Исход · Павел · Давид* · Иаков и Иосиф* · Илия и Елисей*'],
  ['Царства и границы', 'political', 'Царства Израиля и Иудеи · Четыре царства Даниила* · Мир Ирода*'],
  ['Территории и уделы', 'territorial', 'Земля двенадцати колен · Таблица народов*'],
  ['Планы городов', 'city', 'Иерусалим по эпохам* · Вавилон Даниила*'],
  ['Тематические слои', 'thematic', 'Пророчества о народах* · Семь церквей Откровения'],
  ['Обзор и вход', 'overview', 'Земля Библии* · Хронология Атласа* · Сравнение эпох*'],
];
const themesHtml = THEMES.map(([t, k, list]) => `<div class="theme-card"><div class="theme-kind">${k}</div><h4>${esc(t)}</h4><p>${esc(list)}</p></div>`).join('') +
  `<p class="note">* — карты целевого каталога (ATLAS-CONTRACT §9), ещё не построены.</p>`;

// ── Карточки карт ────────────────────────────────────────────────────────────
const mapsHtml = inventory.maps.map((m) => {
  // Витрина хаба: только avraam; ishod — production-маршрут вне витрины; прочие — заглушки.
  const st = m.slug === 'avraam' ? ['live', 'на витрине'] : (m.publication === 'none' ? ['semi', 'production · вне витрины'] : ['hold', 'на аудите']);
  return `<div class="map-card"><div class="map-status ${st[0]}">${st[1]}</div>` +
    `<h4>${esc(routeTitles[m.slug])}</h4><div class="map-slug">/karty/${m.slug}/</div>` +
    `<div class="map-meta">${m.counts.places} мест · ${m.counts.stages} этапов · ${m.counts.stories} историй · ${m.counts.scientific_variants} науч. вариантов</div>` +
    (m.signature ? `<div class="map-sig">сигнатура: ${esc(m.signature)}</div>` : '') + `</div>`;
}).join('');

const stats = timeline.stats;
const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Библейский Атлас — предпросмотр оболочки (KA-4 preview)</title>
<style>
  :root{--ink:#2b2418;--ink2:#5c5240;--blue:#1e3a63;--gold:#b98a2f;--parch:#f6f1e7;--card:#fdfaf3;--line:#d8cbae}
  *{box-sizing:border-box;margin:0}
  body{background:var(--parch);color:var(--ink);font:15px/1.55 Georgia,'Times New Roman',serif}
  .wrap{max-width:1180px;margin:0 auto;padding:28px 20px 60px}
  header.hero{border-bottom:3px double var(--line);padding-bottom:18px;margin-bottom:22px}
  .kicker{font:600 11px/1 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
  h1{font-size:34px;color:var(--blue);margin:6px 0 4px}
  .sub{color:var(--ink2);font-style:italic}
  .badge-preview{display:inline-block;margin-top:10px;font:600 11px/1 system-ui,sans-serif;letter-spacing:.06em;color:#7a2e2e;background:#f3e2dd;border:1px solid #d8b3a8;border-radius:999px;padding:6px 12px}
  nav.tabs{display:flex;gap:8px;margin:20px 0 16px;flex-wrap:wrap}
  .tab{font:600 13px/1 system-ui,sans-serif;padding:10px 16px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink2);cursor:pointer}
  .tab[aria-selected="true"]{background:var(--blue);border-color:var(--blue);color:#fff}
  section.pane{display:none}section.pane.on{display:block}
  h2{color:var(--blue);font-size:21px;margin:8px 0 4px}
  .lead{color:var(--ink2);margin-bottom:14px}
  .tl-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:14px 10px 8px}
  .lane-label{font:600 11px/1 system-ui,sans-serif;fill:var(--ink2)}
  .chip-text{font:600 11px/1 system-ui,sans-serif;fill:#2b2418}
  .grid{stroke:#e7ddc6;stroke-width:1}
  .axis-year{font:10px/1 system-ui,sans-serif;fill:#a0946f}
  .lane-sep{stroke:#eee4cd;stroke-width:1}
  .seg{fill:#efe7d4;stroke:#c9b98d;stroke-width:1}
  .seg.coreg{stroke-dasharray:3 2}
  .seg-text{font:600 10.5px/1 system-ui,sans-serif;fill:var(--ink)}
  .prophet-seg{fill:#e3ecf4;stroke:#9db4cc;stroke-width:1}
  .prophet-text{font:600 10px/1 system-ui,sans-serif;fill:#1e3a63;dominant-baseline:middle}
  .emp-seg{fill:#efe0da;stroke:#c9a294;stroke-width:1}
  .realm-caption{font:700 10px/1 system-ui,sans-serif;fill:#8a5a4a;letter-spacing:.08em;text-transform:uppercase}
  .realm-sep{stroke:#d8bfb2;stroke-width:1;stroke-dasharray:2 3}
  .event-mark{fill:#1e3a63;stroke:var(--card);stroke-width:1.5}
  .event-mark.xb{stroke:var(--gold);stroke-width:2}
  g[data-tip]{cursor:default}
  g[data-tip]:hover .seg,g[data-tip]:hover .prophet-seg,g[data-tip]:hover .emp-seg{stroke:var(--blue);stroke-width:1.6}
  g[data-tip]:hover .event-mark{transform:scale(1.25);transform-box:fill-box;transform-origin:center}
  #tip{position:fixed;display:none;max-width:340px;background:#241f14;color:#f3ecd9;font:12.5px/1.5 system-ui,sans-serif;padding:9px 12px;border-radius:8px;pointer-events:none;z-index:9;box-shadow:0 4px 14px rgba(30,26,14,.35)}
  .legend{display:flex;gap:18px;flex-wrap:wrap;font:12px/1 system-ui,sans-serif;color:var(--ink2);margin:12px 2px 4px}
  .legend b{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-2px}
  details.tbl{margin-top:14px;font:13px/1.5 system-ui,sans-serif}
  details.tbl summary{cursor:pointer;color:var(--blue);font-weight:600}
  table{border-collapse:collapse;margin-top:10px;background:var(--card)}
  td,th{border:1px solid var(--line);padding:5px 10px;text-align:left}
  th{font:600 12px/1 system-ui,sans-serif;background:#efe7d4}
  .book-sec{margin-bottom:14px}
  .book-sec h4{font:600 12px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);margin-bottom:8px}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{font:600 12.5px/1 system-ui,sans-serif;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:7px 10px;color:var(--ink2)}
  .chip.has-map{border-color:var(--gold);color:var(--ink)}
  .chip .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--gold);margin-left:6px}
  .theme-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:10px}
  .theme-kind{font:600 10px/1 ui-monospace,monospace;color:var(--gold);letter-spacing:.1em;text-transform:uppercase}
  .theme-card h4{color:var(--blue);margin:4px 0 4px}
  .theme-card p{font:13px/1.6 system-ui,sans-serif;color:var(--ink2)}
  .note{font:12px/1.5 system-ui,sans-serif;color:var(--ink2);margin-top:8px}
  .maps-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
  .map-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;position:relative}
  .map-status{position:absolute;top:12px;right:12px;font:600 10px/1 system-ui,sans-serif;letter-spacing:.05em;border-radius:999px;padding:4px 9px}
  .map-status.live{background:#e3efe6;color:#15803d;border:1px solid #a9cdb4}
  .map-status.hold{background:#f3ead8;color:#8a6a1f;border:1px solid #d9c391}
  .map-status.semi{background:#e8ecf3;color:#1e3a63;border:1px solid #b3c0d6}
  .map-card h4{color:var(--blue);margin:2px 96px 2px 0;font-size:16px}
  .map-slug{font:11px/1 ui-monospace,monospace;color:var(--ink2)}
  .map-meta{font:12px/1.5 system-ui,sans-serif;color:var(--ink2);margin-top:8px}
  .map-sig{font:11px/1 ui-monospace,monospace;color:var(--gold);margin-top:6px}
  footer{margin-top:34px;border-top:1px solid var(--line);padding-top:14px;font:12px/1.6 system-ui,sans-serif;color:var(--ink2)}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="kicker">Господь Бог — Сила Моя · предпросмотр</div>
    <h1>Библейский Атлас</h1>
    <div class="sub">Исследуйте события Писания через географию, хронологию и археологию — честно там, где данные спорны.</div>
    <div class="badge-preview">KA-4 preview · НЕ production · собрано из data/atlas/** · ${stats.kings} царей / ${stats.prophets} пророков / ${stats.emperors} императоров / ${stats.events} событий</div>
  </header>

  <nav class="tabs" role="tablist">
    <button class="tab" role="tab" aria-selected="true" data-pane="time">По времени</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="books">По книгам</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="themes">По темам</button>
    <button class="tab" role="tab" aria-selected="false" data-pane="maps">Карты (${inventory.maps.length})</button>
  </nav>

  <section class="pane on" id="pane-time">
    <h2>Цари · Пророки · Империи</h2>
    <p class="lead">Синхронная шкала из реестров: наведите курсор на любой элемент. Консервативная библейская хронология (ранний Исход 1446; разделённое царство — согласованные даты Тиле).</p>
    <div class="tl-scroll">${timelineSvg}</div>
    <div class="legend">
      <span><b style="background:#15803d"></b>добрый царь</span>
      <span><b style="background:#b91c1c"></b>злой царь</span>
      <span><b style="background:#a16207"></b>смешанная оценка</span>
      <span><b style="background:#1e3a63"></b>событие</span>
      <span><b style="background:#fff;border:2px solid #b98a2f"></b>✦ внебиблейское свидетельство</span>
      <span><b style="background:#efe7d4;border:1px dashed #c9b98d"></b>сорегентство</span>
    </div>
    <details class="tbl"><summary>Данные шкалы таблицей (${stats.kings} правителей)</summary>
      <table><thead><tr><th>Престол</th><th>Правитель</th><th>Годы</th><th>Библейская оценка</th></tr></thead><tbody>${tableRows.join('')}</tbody></table>
    </details>
  </section>

  <section class="pane" id="pane-books">
    <h2>Вход по книгам Писания</h2>
    <p class="lead">66 книг канона; золотая точка — книга уже покрыта картой Атласа.</p>
    ${booksHtml}
  </section>

  <section class="pane" id="pane-themes">
    <h2>Вход по темам</h2>
    <p class="lead">Шесть архетипов карт Атласа (ATLAS-CONTRACT §5) и целевой каталог §9.</p>
    ${themesHtml}
  </section>

  <section class="pane" id="pane-maps">
    <h2>Карты</h2>
    <p class="lead">Живой инвентарь: счётчики — из базовой линии контент-паритета (гейт G6).</p>
    <div class="maps-grid">${mapsHtml}</div>
  </section>

  <footer>
    Прототип оболочки Атласа: данные — <code>data/atlas/**</code> (места/эпохи/персоны/события/книги), генератор — <code>scripts/atlas-build-shell-preview.js</code>.
    Идентификации мест и веса уверенности частично производны от OpenBible.info Bible Geocoding Data (CC BY 4.0). Хронология — позиция сайта (ATLAS-CONTRACT §2-бис).
    Цвета эпох — draft-токены до дизайн-системы KA-6; статусная тройка валидирована (dataviz-скилл).
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
  function show(e){
    var g=e.target.closest('[data-tip]'); if(!g){tip.style.display='none';return}
    tip.textContent=g.getAttribute('data-tip');
    tip.style.display='block';
    var x=Math.min(e.clientX+14,window.innerWidth-tip.offsetWidth-10);
    var y=Math.min(e.clientY+16,window.innerHeight-tip.offsetHeight-10);
    tip.style.left=x+'px';tip.style.top=y+'px';
  }
  document.addEventListener('mousemove',show);
  document.addEventListener('mouseleave',function(){tip.style.display='none'});
  // deep-link вкладки: #books / #themes / #maps
  var h=(location.hash||'').replace('#','');
  if(h){var t=document.querySelector('.tab[data-pane="'+h+'"]'); if(t) t.click();}
})();
</script>
</body>
</html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`[atlas-shell-preview] → ${path.relative(ROOT, OUT)} (${Math.round(html.length / 1024)} KB; шкала ${W}×${H}px)`);
