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
  <!-- винтажная палитра ВАРИАНТ 1: тёплый выцветший пергамент, контрастное
       приглушённо-бирюзовое море -->
  <linearGradient id="landG" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ecdcb4"/><stop offset=".45" stop-color="#e1d1a2"/><stop offset="1" stop-color="#d3bf8a"/>
  </linearGradient>
  <linearGradient id="richLandG" x1="0" y1="0" x2=".5" y2="1">
    <stop offset="0" stop-color="#e7d9ae"/><stop offset=".5" stop-color="#dccd98"/><stop offset="1" stop-color="#cfbc86"/>
  </linearGradient>
  <linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#a7c5c2"/><stop offset="1" stop-color="#7ea3a4"/>
  </linearGradient>
  <pattern id="seaPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M0,10 Q5,6 10,10 Q15,14 20,10" fill="none" stroke="#5f8c8b" stroke-width=".6" opacity=".34"/>
    <path d="M0,20 Q5,16 10,20 Q15,24 20,20" fill="none" stroke="#5f8c8b" stroke-width=".5" opacity=".24"/>
  </pattern>
  <radialGradient id="fertileG" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#8a9a4e" stop-opacity=".17"/><stop offset="1" stop-color="#8a9a4e" stop-opacity="0"/>
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
    <line x1="0" y1="0" x2="0" y2="6" stroke="#8b7d5a" stroke-width=".6" opacity=".38" vector-effect="non-scaling-stroke"/>
  </pattern>
  <pattern id="desertStipple" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r=".7" fill="#9c7c43" opacity=".4"/>
    <circle cx="9" cy="9" r=".5" fill="#9c7c43" opacity=".3"/>
    <circle cx="6" cy="1" r=".4" fill="#b08050" opacity=".25"/>
  </pattern>
  <filter id="waterRipple" x="-8%" y="-8%" width="116%" height="116%"><feGaussianBlur stdDeviation=".45"/></filter>
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
  <!-- ═══ БИБЛИОТЕКА РИСОВАННЫХ ОБЪЕКТОВ (гравюрный атлас) ═══
       reusable <symbol>: силуэт скейлится с картой, штриховка-отмывка
       (hachure) держит экранную толщину (non-scaling-stroke) — тонкие
       гравюрные линии на любом зуме. Свет с СЗ, тень (hachure) на ЮВ. -->
  <linearGradient id="peakG" x1="0" y1="0" x2=".35" y2="1">
    <stop offset="0" stop-color="#d7c79c" stop-opacity=".62"/>
    <stop offset="1" stop-color="#ab9366" stop-opacity=".72"/>
  </linearGradient>
  <!-- освещённая грань киношных гор (свет с СЗ) -->
  <linearGradient id="mtLitG" x1="0" y1="0" x2=".25" y2="1">
    <stop offset="0" stop-color="#e7dab6"/><stop offset="1" stop-color="#c8b083"/>
  </linearGradient>
  <symbol id="peak" viewBox="0 0 20 16" overflow="visible">
    <path d="M1,15 L5.5,7 L8,2 L10,6 L11.5,4.6 L13.5,5.4 L16,9 L19,15 Z" fill="url(#mtLitG)" stroke="#6f5b38" stroke-width=".6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <path d="M8,2 L10,6 L11.5,4.6 L13.5,5.4 L16,9 L19,15 L8.6,15 Z" fill="#4a3410" fill-opacity=".2"/>
    <path d="M13.5,5.4 L16,9 L19,15 L14.4,15 Z" fill="#4a3410" fill-opacity=".1"/>
    <g stroke="#5f5038" stroke-width=".5" stroke-linecap="round" fill="none" opacity=".3" vector-effect="non-scaling-stroke">
      <path d="M10.6,6.4 l.9,1.5"/><path d="M12.4,7.8 l.8,1.5"/><path d="M15.4,10 l.7,1.5"/>
    </g>
    <path d="M1,15 L5.5,7 L8,2" fill="none" stroke="rgba(255,250,235,.55)" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </symbol>
  <symbol id="peak-snow" viewBox="0 0 20 16" overflow="visible">
    <path d="M1,15 L5.5,7 L8,2 L10,6 L11.5,4.6 L13.5,5.4 L16,9 L19,15 Z" fill="url(#mtLitG)" stroke="#6f5b38" stroke-width=".6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <path d="M8,2 L10,6 L11.5,4.6 L13.5,5.4 L16,9 L19,15 L8.6,15 Z" fill="#4a3410" fill-opacity=".2"/>
    <path d="M13.5,5.4 L16,9 L19,15 L14.4,15 Z" fill="#4a3410" fill-opacity=".1"/>
    <g stroke="#5f5038" stroke-width=".5" stroke-linecap="round" fill="none" opacity=".28" vector-effect="non-scaling-stroke">
      <path d="M12.4,7.8 l.8,1.5"/><path d="M15.4,10 l.7,1.5"/>
    </g>
    <path d="M5.7,5 L8,2 L10.4,5 C9.2,3.9 6.9,3.9 5.7,5 Z" fill="#f7fafc" fill-opacity=".95" stroke="#8fa3bd" stroke-width=".3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <path d="M1,15 L5.5,7 L8,2" fill="none" stroke="rgba(255,250,235,.5)" stroke-width=".6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </symbol>
  <!-- верблюд-дромадер (вправо) — виньетка каравана старинных карт -->
  <symbol id="camel" viewBox="0 0 20 14" overflow="visible">
    <path d="M3.2,13 L3.9,9.7 C3.2,9.2 3,8.2 3.5,7.5 C3.9,6.9 4.7,6.7 5.3,7
             C5.9,5.4 7.8,4.2 9.6,4.8 C10.8,5.2 11.7,6.1 11.9,7.1
             C12.5,7.3 13,7.7 13.3,8.2 L14.3,4.9 C14.4,4.4 14.2,4 14.5,3.5
             C14.8,3 15.5,2.9 15.9,3.3 C16.3,3.7 16.3,4.3 16,4.7 L15.9,5 L15,8.6
             C14.9,9.5 14.3,10.2 13.4,10.4 L13.7,13 L12.8,13 L12.3,10.5 L11,10.5 L10.7,13 L9.8,13 L9.4,10.4
             L7,10.2 L6.6,13 L5.7,13 L5.4,10 L4.8,9.9 L4.1,13 Z"
      fill="none" stroke="#6b5216" stroke-width=".55" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <path d="M15.6,3.2 l.5,-.5 M3.5,7.8 l-.9,.9" fill="none" stroke="#6b5216" stroke-width=".5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </symbol>
  <!-- угловой завиток картуша/рамки (ориентация — верх-левый угол) -->
  <symbol id="cornerOrn" viewBox="0 0 16 16" overflow="visible">
    <g fill="none" stroke="#8a6a1f" stroke-linecap="round">
      <path d="M15,3 H6 Q3,3 3,6 V15" stroke-width="1.1"/>
      <path d="M3,6 Q3,9.6 6.6,9 Q4.2,8.7 4.7,6.2" stroke-width=".7"/>
      <circle cx="5.3" cy="5.3" r="1" fill="#8a6a1f" stroke="none"/>
    </g>
  </symbol>
  <!-- холм: низкая округлая гряда с лёгкой отмывкой (не острый пик) -->
  <symbol id="hill" viewBox="0 0 18 10" overflow="visible">
    <path d="M1,9.2 Q3.5,4.2 7.5,4 Q9.4,4 10.4,5.2 Q12,3.9 14,4.6 Q16.2,5.6 17,9.2 Z" fill="url(#mtLitG)" stroke="#6f5b38" stroke-width=".55" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <path d="M7.5,4 Q9.4,4 10.4,5.2 Q12,3.9 14,4.6 Q16.2,5.6 17,9.2 L8.5,9.2 Z" fill="#4a3410" fill-opacity=".16"/>
    <path d="M1,9.2 Q3.5,4.2 7.5,4" fill="none" stroke="rgba(255,250,235,.5)" stroke-width=".6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </symbol>
  <!-- ═══ КРАСКИ КИНОШНЫХ ИКОНОК-ГЛИФОВ (объём: тело-эмбосс, тень, акценты) ═══ -->
  <radialGradient id="gShadow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#5a4620" stop-opacity=".1"/>
    <stop offset=".6" stop-color="#5a4620" stop-opacity=".045"/>
    <stop offset="1" stop-color="#5a4620" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="gBody" x1="0" y1="0" x2=".5" y2="1">
    <stop offset="0" stop-color="#f2e7c8"/><stop offset=".55" stop-color="#ddc79a"/><stop offset="1" stop-color="#c3a973"/>
  </linearGradient>
  <linearGradient id="gStone" x1="0" y1="0" x2=".4" y2="1">
    <stop offset="0" stop-color="#e8dcc0"/><stop offset="1" stop-color="#b49f76"/>
  </linearGradient>
  <linearGradient id="gFlame" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f6da5c"/><stop offset=".5" stop-color="#e08a2c"/><stop offset="1" stop-color="#b63c18"/>
  </linearGradient>
  <linearGradient id="gLeaf" x1="0" y1="0" x2=".4" y2="1">
    <stop offset="0" stop-color="#8fa85e"/><stop offset="1" stop-color="#59763c"/>
  </linearGradient>
  <linearGradient id="gTrunk" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#8a6836"/><stop offset="1" stop-color="#5c421d"/>
  </linearGradient>
  <linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8bb0c4"/><stop offset="1" stop-color="#4d7391"/>
  </linearGradient>
</defs>`;

// Рельефный слой листа (поверх базы, только на листе — SYSTEM-файл не трогаем).
// Свет с северо-запада: хребет = штриховой гребень + мягкая тень на юго-восток.
const RELIEF = {
  levant: `
  <g class="relief" aria-hidden="true">
    <ellipse cx="678" cy="538" rx="10" ry="62" fill="url(#mtG)" transform="rotate(14 678 538)" opacity=".55"/>
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

// Декор старинного атласа: одинокий парусник в пустой воде (op низкая, контур)
function shipSvg(x, y, s2) {
  return `<g class="decor-ship" data-decor="ship" transform="translate(${x},${y}) scale(${s2})"><circle r="26" fill="transparent" stroke="none"/>
    <path d="M-16,6 Q0,13 16,6 L11,10 Q0,15 -11,10 Z"/>
    <path d="M-1,6 v-20" class="ds-line"/>
    <path d="M-1,-14 Q9,-9 12,1 L-1,1 Z"/>
    <path d="M-1,-14 Q-9,-10 -11,-2 L-1,-2 Z"/>
    <path d="M-24,12 q4,-2.4 8,0 q4,2.4 8,0 M8,12 q4,-2.4 8,0 q4,2.4 8,0" class="ds-wave"/>
  </g>`;
}
const DECOR = {
  levant: shipSvg(298, 468, 1.15) + shipSvg(430, 300, 0.8) + `<g class="decor-ship" data-decor="whale" transform="translate(255,655) scale(1.05)"><circle r="26" fill="transparent" stroke="none"/>
    <path d="M-14,4 Q-6,-6 6,-4 Q14,-2.6 16,2 Q10,6 0,6 Q-8,6 -14,4 Z M16,2 L21,-3 L19,3 Z"/>
    <path d="M-7,-5 q-1,-4 -3,-5 m3,5 q1,-4 3,-5" class="ds-line"/>
    <path d="M-22,9 q4,-2.4 8,0 q4,2.4 8,0 M6,9 q4,-2.4 8,0 q4,2.4 8,0" class="ds-wave"/>
  </g>
  <!-- караван в пустой Аравии — виньетка старинных карт (Быт 24:10) -->
  <g class="decor-ship decor-caravan" data-decor="caravan" opacity=".55">
    <circle cx="1085" cy="962" r="42" fill="transparent" stroke="none"/>
    <use href="#camel" x="1050" y="946" width="15" height="10.5"/>
    <use href="#camel" x="1072" y="950" width="13" height="9.1"/>
    <use href="#camel" x="1091" y="953" width="11.5" height="8"/>
  </g>`,
  mediterranean: shipSvg(700, 560, 1.2) + shipSvg(360, 810, 0.85),
  urheimat: '',
};

function glyphSvg(name, x, y, k) {
  const s = k; // масштаб
  // Киношные иконки: тело-эмбосс (gBody), мягкая тень на земле (gShadow),
  // затенённая грань (g-sh/g-sh2), NW-блик (g-hi), сдержанные цвет-акценты
  // (пламя/листва/вода). Свет с СЗ, рост вверх от (x,y); штрихи держат
  // экранную толщину (non-scaling-stroke) на любом зуме.
  const P = (v) => +(v * s).toFixed(2);
  const M = (dx, dy) => `${+(x + dx * s).toFixed(2)},${+(y + dy * s).toFixed(2)}`;
  const B = 'fill="url(#gBody)" class="gb"';
  const ST = 'fill="url(#gStone)" class="gb"';
  const OUT = 'class="g-out"';
  const HI = 'class="g-hi"';
  const SH = 'class="g-sh"';
  const SH2 = 'class="g-sh2"';
  const AC = (u) => `fill="url(#${u})"`;
  // контактная тень-намёк: очень мягкая узкая полоска у основания (не клякса);
  // чистый опрятный вид — объём держат грани, а не тяжёлая тень
  const shadow = (sx, sy, rx) => `<ellipse class="g-shadow" cx="${sx}" cy="${sy}" rx="${+(rx * 0.72).toFixed(2)}" ry="${+(rx * 0.14).toFixed(2)}"/>`;
  switch (name) {

  case 'town': return `<g class="glyph">
    ${shadow(x, y, P(9))}
    <path ${B} d="M${M(2, -2.5)} V${M(2, -12).split(',')[1]} h${P(1)} v${P(-1.2)} h${P(1)} v${P(1.2)} h${P(1)} v${P(-1.2)} h${P(1)} v${P(1.2)} h${P(1)} V${M(0, -2.5).split(',')[1]} Z"/>
    <path ${SH} d="M${M(6, -2.5)} V${M(6, -11.9).split(',')[1]} h${P(1)} V${M(0, -2.5).split(',')[1]} Z"/>
    <path ${OUT} d="M${M(3.6, -8.6)} h${P(2.8)}" style="stroke-width:.5px"/>
    <path ${OUT} d="M${M(4, -12)} v${P(-3)}"/>
    <path fill="#a8412a" d="M${M(4, -15)} l${P(3.2)},${P(1)} l${P(-3.2)},${P(1)} Z"/>
    <path ${B} d="M${M(-6.6, -2.5)} V${M(0, -6.6).split(',')[1]}
      h${P(1.1)} v${P(-1.2)} h${P(1.1)} v${P(1.2)} h${P(1.1)} v${P(-1.2)} h${P(1.1)} v${P(1.2)} h${P(1.1)} v${P(-1.2)} h${P(1.1)} v${P(1.2)}
      h${P(1.2)} V${M(0, -2.5).split(',')[1]} Z"/>
    <path ${SH} d="M${M(1.4, -2.5)} V${M(0, -6.6).split(',')[1]} h${P(1.2)} V${M(0, -2.5).split(',')[1]} Z"/>
    <path fill="#5c3f18" d="M${M(-3.8, -2.5)} v${P(-2.4)} a${P(1.4)},${P(1.6)} 0 0 1 ${P(2.8)},0 v${P(2.4)} Z"/>
    <path ${HI} d="M${M(-6.6, -2.6)} V${M(0, -6.4).split(',')[1]}"/>
  </g>`;

  case 'altar': return `<g class="glyph">
    ${shadow(x, y, P(6.5))}
    <path ${B} d="M${M(-5.6, -2.4)} h${P(11.2)} v${P(-2.8)} h${P(-11.2)} Z"/>
    <path ${SH} d="M${M(3.4, -5.2)} h${P(2.2)} v${P(2.8)} h${P(-2.2)} Z"/>
    <path ${B} d="M${M(-4, -5.2)} h${P(8)} v${P(-3.2)} h${P(-8)} Z"/>
    <path ${SH} d="M${M(2.2, -8.4)} h${P(1.8)} v${P(3.2)} h${P(-1.8)} Z"/>
    <path ${B} d="M${M(-4, -8.4)} l${P(-0.7)},${P(-1.3)} l${P(1.4)},${P(0)} Z M${M(4, -8.4)} l${P(0.7)},${P(-1.3)} l${P(-1.4)},${P(0)} Z"/>
    <path ${AC('gFlame')} d="M${M(0, -8.6)}
      q${P(2.8)},${P(2.4)} ${P(1)},${P(5.6)} q${P(1.2)},${P(-1.4)} ${P(0.5)},${P(-3.2)}
      q${P(1.2)},${P(1.8)} ${P(-0.2)},${P(3.8)} q${P(-1.4)},${P(2)} ${P(-2.6)},${P(0.4)}
      q${P(-1.2)},${P(-1.6)} ${P(-0.3)},${P(-3.2)} q${P(-1.8)},${P(1.2)} ${P(-1)},${P(3.4)}
      q${P(-2.2)},${P(-2.8)} ${P(0.6)},${P(-6.4)} q${P(-0.2)},${P(1.6)} ${P(1.1)},${P(2.4)}
      q${P(0.9)},${P(-1.8)} ${P(0.7)},${P(-3)} Z"/>
  </g>`;

  case 'oak': return `<g class="glyph">
    ${shadow(x, y, P(6.5))}
    <path ${AC('gTrunk')} d="M${M(-1.1, -2.4)} q${P(-0.3)},${P(-3)} ${P(0.4)},${P(-5)} q${P(0.5)},${P(1.9)} ${P(1.5)},${P(0)} q${P(0.6)},${P(2)} ${P(0.3)},${P(5)} Z"/>
    <path ${AC('gLeaf')} d="M${M(0, -6.4)}
      q${P(-5.6)},${P(0.4)} ${P(-5.2)},${P(-4)} q${P(0.1)},${P(-2.6)} ${P(2.6)},${P(-2.8)}
      q${P(0.6)},${P(-3)} ${P(4)},${P(-2.6)} q${P(3)},${P(0.3)} ${P(3.2)},${P(3)}
      q${P(2.6)},${P(0.4)} ${P(2.2)},${P(3.4)} q${P(-0.4)},${P(3.4)} ${P(-4.6)},${P(2.8)}
      q${P(-1)},${P(1.6)} ${P(-3.4)},${P(0.6)} Z"/>
    <path ${SH} d="M${M(1, -6)} q${P(2)},${P(0.4)} ${P(2.6)},${P(-1)} q${P(3.6)},${P(0.3)} ${P(3.8)},${P(-3)} q${P(-0.2)},${P(1.8)} ${P(-2.4)},${P(2.4)} q${P(-2)},${P(0.6)} ${P(-3.6)},${P(0.2)} q${P(-0.8)},${P(0.8)} ${P(-2.4)},${P(1)} Z"/>
    <path ${HI} d="M${M(-3.4, -11)} q${P(1.4)},${P(-1.4)} ${P(3.4)},${P(-1.1)}" style="opacity:.5"/>
  </g>`;

  case 'tent': return `<g class="glyph">
    ${shadow(x, y, P(7))}
    <path ${B} d="M${M(0, -10)} L${M(6.4, -2.4)} L${M(-6.4, -2.4)} Z"/>
    <path ${SH2} d="M${M(0, -10)} L${M(6.4, -2.4)} L${M(1.4, -2.4)} Z"/>
    <path fill="#5c3f18" d="M${M(0, -2.4)} L${M(-1.7, -6.2)} q${P(1.7)},${P(-1.1)} ${P(3.4)},${P(0)} Z"/>
    <path ${OUT} d="M${M(0, -10)} v${P(-1.6)}"/>
    <path ${OUT} d="M${M(-6.4, -2.4)} l${P(-1.6)},${P(1.2)} M${M(6.4, -2.4)} l${P(1.6)},${P(1.2)}" style="opacity:.6"/>
    <path ${HI} d="M${M(0, -9.6)} L${M(-5.7, -2.6)}"/>
  </g>`;

  case 'well': return `<g class="glyph">
    ${shadow(x, y, P(5.5))}
    <path ${ST} d="M${M(-4.2, -2.6)} a${P(4.2)},${P(1.9)} 0 0 0 ${P(8.4)},0 v${P(-2.4)} a${P(4.2)},${P(1.9)} 0 0 0 ${P(-8.4)},0 Z"/>
    <ellipse ${AC('gWater')} cx="${x}" cy="${(y - 5 * s).toFixed(2)}" rx="${P(4.2)}" ry="${P(1.9)}"/>
    <ellipse cx="${x}" cy="${(y - 5 * s).toFixed(2)}" rx="${P(4.2)}" ry="${P(1.9)}" class="g-out" fill="none"/>
    <path ${OUT} d="M${M(-3.4, -6)} a${P(3.4)},${P(4)} 0 0 1 ${P(6.8)},0"/>
    <path ${AC('gTrunk')} d="M${M(-4, -9.4)} h${P(8)} v${P(0.9)} h${P(-8)} Z"/>
    <path ${OUT} d="M${M(-3.4, -9)} v${P(-1.4)} M${M(3.4, -9)} v${P(-1.4)}"/>
  </g>`;

  case 'palm': return `<g class="glyph">
    ${shadow(x, y, P(5.5))}
    <path ${AC('gTrunk')} d="M${M(-0.9, -2.4)} q${P(-1)},${P(-4.6)} ${P(0.6)},${P(-8)} q${P(1)},${P(0.4)} ${P(1.4)},${P(0)} q${P(-1.4)},${P(3.6)} ${P(-0.2)},${P(8)} Z"/>
    <g ${AC('gLeaf')}>
      <path d="M${M(0.2, -10.4)} q${P(3.4)},${P(-1.8)} ${P(6)},${P(0.4)} q${P(-3.2)},${P(-0.6)} ${P(-6)},${P(1.2)} Z"/>
      <path d="M${M(0.2, -10.4)} q${P(-3.4)},${P(-1.8)} ${P(-6)},${P(0.4)} q${P(3.2)},${P(-0.6)} ${P(6)},${P(1.2)} Z"/>
      <path d="M${M(0.2, -10.4)} q${P(2.4)},${P(-3.4)} ${P(5)},${P(-3.2)} q${P(-2.6)},${P(1)} ${P(-4.4)},${P(3.6)} Z"/>
      <path d="M${M(0.2, -10.4)} q${P(-2.4)},${P(-3.4)} ${P(-5)},${P(-3.2)} q${P(2.6)},${P(1)} ${P(4.4)},${P(3.6)} Z"/>
      <path d="M${M(0.2, -10.4)} q${P(0.4)},${P(-3.8)} ${P(-0.2)},${P(-5.2)} q${P(1)},${P(3)} ${P(1.4)},${P(5)} Z"/>
    </g>
    <circle cx="${(x + 0.2 * s).toFixed(2)}" cy="${(y - 10.4 * s).toFixed(2)}" r="${P(0.8)}" fill="#5c421d"/>
  </g>`;

  case 'gate': return `<g class="glyph">
    ${shadow(x, y, P(6))}
    <path ${B} d="M${M(-5.4, -2.4)} v${P(-6.4)} a${P(5.4)},${P(5)} 0 0 1 ${P(10.8)},0 v${P(6.4)} h${P(-2.6)} v${P(-5.6)} a${P(2.8)},${P(2.8)} 0 0 0 ${P(-5.6)},0 v${P(5.6)} Z"/>
    <path ${SH} d="M${M(2.8, -2.4)} v${P(-5.6)} a${P(2.8)},${P(2.8)} 0 0 0 ${P(-1)},${P(-2.1)} a${P(2.8)},${P(2.8)} 0 0 1 ${P(1)},${P(2.1)} v${P(5.6)} h${P(2.6)} v${P(-6.4)} a${P(5.4)},${P(5)} 0 0 0 ${P(-2.4)},${P(-4.1)} a${P(5.4)},${P(5)} 0 0 1 ${P(2.4)},${P(4.1)} v${P(6.4)} Z"/>
    <path fill="#5c3f18" d="M${M(-2.6, -2.4)} v${P(-5.6)} a${P(2.8)},${P(2.8)} 0 0 1 ${P(5.6)},0 v${P(5.6)} Z" opacity=".55"/>
    <path ${HI} d="M${M(-5.2, -2.5)} v${P(-6.2)} a${P(5.2)},${P(4.8)} 0 0 1 ${P(2.6)},${P(-3.9)}"/>
  </g>`;

  case 'pyramid': return `<g class="glyph">
    ${shadow(x, y, P(8))}
    <path ${B} d="M${M(-7, -2.4)} L${M(-0.4, -13.4)} L${M(1.6, -2.4)} Z"/>
    <path ${SH2} d="M${M(-0.4, -13.4)} L${M(6, -2.4)} L${M(1.6, -2.4)} Z"/>
    <path ${AC('gStone')} d="M${M(4, -2.4)} L${M(7.2, -7.6)} L${M(10.4, -2.4)} Z" opacity=".85"/>
    <path ${HI} d="M${M(-0.4, -13.4)} L${M(-6.6, -2.6)}"/>
  </g>`;

  case 'ziggurat': return `<g class="glyph">
    ${shadow(x, y, P(8))}
    <path ${B} d="M${M(-7, -2.4)} h${P(14)} v${P(-2.6)} h${P(-2)} v${P(-2.6)} h${P(-2.3)} v${P(-2.6)} h${P(-1.4)} v${P(-2.4)} h${P(-1.2)} v${P(2.4)} h${P(-1.4)} v${P(2.6)} h${P(-2.3)} v${P(2.6)} h${P(-2)} Z"/>
    <path ${SH} d="M${M(0.6, -12.6)} h${P(1.2)} v${P(2.4)} h${P(1.4)} v${P(2.6)} h${P(2.3)} v${P(2.6)} h${P(2)} v${P(2.4)} h${P(-7)} Z"/>
    <path ${OUT} d="M${M(0, -9.6)} v${P(-2.9)}" style="stroke-width:.55px;opacity:.6"/>
  </g>`;

  case 'ruin': return `<g class="glyph">
    ${shadow(x, y, P(6))}
    <path class="g-smoke" d="M${M(-1.4, -8)} q${P(-2)},${P(-2.6)} ${P(-0.2)},${P(-4.6)} q${P(1.6)},${P(-1.4)} ${P(0.2)},${P(-3.4)}"/>
    <path class="g-smoke" d="M${M(2.6, -7)} q${P(2.2)},${P(-2.2)} ${P(0.8)},${P(-4.8)} q${P(-0.8)},${P(-1.6)} ${P(0.8)},${P(-3.2)}"/>
    <path ${B} d="M${M(-6.6, -2.4)} V${M(0, -7).split(',')[1]} l${P(1.1)},${P(-1.4)} l${P(1.1)},${P(1.2)} l${P(1)},${P(-2)} l${P(0.9)},${P(1.6)} V${M(0, -2.4).split(',')[1]} Z"/>
    <path ${SH} d="M${M(-3.5, -3.8)} l${P(0.9)},${P(1.6)} V${M(0, -2.4).split(',')[1]} h${P(-0.9)} Z"/>
    <path ${B} d="M${M(-1.4, -2.4)} V${M(0, -11).split(',')[1]} l${P(2.6)},${P(1.4)} l${P(0.2)},${P(6.8)} V${M(0, -2.4).split(',')[1]} Z"/>
    <path ${SH} d="M${M(0.8, -9.8)} l${P(0.4)},${P(1.2)} l${P(0.2)},${P(6.2)} h${P(-0.6)} Z"/>
    <path fill="#5c3f18" d="M${M(-0.7, -2.4)} v${P(-2.4)} a${P(0.9)},${P(1.1)} 0 0 1 ${P(1.8)},0 v${P(2.4)} Z"/>
    <path ${B} d="M${M(3, -2.4)} V${M(0, -4.8).split(',')[1]} l${P(1.1)},${P(-1.2)} l${P(1.2)},${P(1.4)} V${M(0, -2.4).split(',')[1]} Z"/>
    <path ${AC('gFlame')} d="M${M(-2.6, -4)} q${P(1.8)},${P(1.8)} ${P(0.7)},${P(4)} q${P(0.9)},${P(-1)} ${P(0.5)},${P(-2.4)} q${P(1)},${P(1.4)} ${P(-0.2)},${P(3)} q${P(-1.2)},${P(1.6)} ${P(-2.2)},${P(0.3)} q${P(-1)},${P(-1.3)} ${P(-0.2)},${P(-2.6)} q${P(-1.4)},${P(0.9)} ${P(-0.8)},${P(2.6)} q${P(-1.6)},${P(-2.2)} ${P(0.4)},${P(-5)} q${P(-0.1)},${P(1.2)} ${P(0.9)},${P(1.8)} q${P(0.7)},${P(-1.3)} ${P(0.5)},${P(-2.2)} Z"/>
    <path ${AC('gFlame')} d="M${M(2.4, -3.6)} q${P(1.4)},${P(1.4)} ${P(0.5)},${P(3.2)} q${P(0.7)},${P(-0.8)} ${P(0.4)},${P(-1.9)} q${P(0.8)},${P(1.1)} ${P(-0.2)},${P(2.4)} q${P(-0.9)},${P(1.2)} ${P(-1.7)},${P(0.2)} q${P(-0.8)},${P(-1)} ${P(-0.1)},${P(-2)} q${P(-1.1)},${P(0.7)} ${P(-0.6)},${P(2)} q${P(-1.2)},${P(-1.7)} ${P(0.3)},${P(-3.8)} q${P(-0.1)},${P(0.9)} ${P(0.7)},${P(1.4)} q${P(0.5)},${P(-1)} ${P(0.3)},${P(-1.7)} Z"/>
  </g>`;

  case 'spring': return `<g class="glyph">
    ${shadow(x, y, P(5.5))}
    <path ${ST} d="M${M(-5, -2.4)} a${P(5)},${P(2.4)} 0 0 0 ${P(10)},0 v${P(-1.2)} a${P(5)},${P(2)} 0 0 1 ${P(-10)},0 Z"/>
    <path ${AC('gWater')} d="M${M(-4.4, -4)} a${P(4.4)},${P(1.8)} 0 0 0 ${P(8.8)},0 a${P(4.4)},${P(1.8)} 0 0 0 ${P(-8.8)},0 Z"/>
    <path fill="none" stroke="url(#gWater)" stroke-width="${P(1.1)}" stroke-linecap="round" d="M${M(0, -4.6)} q${P(-1.4)},${P(-2.6)} ${P(0)},${P(-5)} q${P(1.4)},${P(2.4)} ${P(0)},${P(5)}"/>
    <path ${HI} d="M${M(-3.6, -4.3)} a${P(3.6)},${P(1.4)} 0 0 1 ${P(3)},${P(-0.7)}" style="opacity:.55"/>
    <circle cx="${x}" cy="${(y - 10 * s).toFixed(2)}" r="${P(0.9)}" ${AC('gWater')}/>
  </g>`;

  case 'sheep': return `<g class="glyph">
    ${shadow(x, y, P(6))}
    <path class="g-legs" d="M${M(-2.6, -3.2)} v${P(2)} M${M(-0.4, -3.2)} v${P(2)} M${M(2.6, -3.4)} v${P(2.2)}"/>
    <path ${B} d="M${M(-4.6, -4.2)}
      a${P(1.4)},${P(1.4)} 0 0 1 ${P(0.4)},${P(-2.6)} a${P(1.6)},${P(1.6)} 0 0 1 ${P(2.6)},${P(-1)}
      a${P(1.7)},${P(1.7)} 0 0 1 ${P(3)},${P(0.2)} a${P(1.5)},${P(1.5)} 0 0 1 ${P(2)},${P(1.7)}
      a${P(1.4)},${P(1.4)} 0 0 1 ${P(0.1)},${P(2.4)} q${P(0)},${P(1.4)} ${P(-1.6)},${P(1.4)} h${P(-6.4)}
      q${P(-1.6)},${P(0)} ${P(-1.6)},${P(-1.5)} Z"/>
    <path ${SH} d="M${M(4.2, -6.2)} a${P(1.4)},${P(1.4)} 0 0 1 ${P(0.1)},${P(2.4)} q${P(0)},${P(1.4)} ${P(-1.6)},${P(1.4)} h${P(-2)} q${P(2)},${P(-1.8)} ${P(1.6)},${P(-4)} Z"/>
    <path ${AC('gTrunk')} d="M${M(-4.8, -4.4)} q${P(-2)},${P(0.2)} ${P(-2.2)},${P(2)} q${P(0)},${P(1)} ${P(1)},${P(1.1)} q${P(1.4)},${P(0)} ${P(1.6)},${P(-1.4)} Z"/>
    <circle cx="${(x - 5.6 * s).toFixed(2)}" cy="${(y - 3.4 * s).toFixed(2)}" r="${P(0.35)}" fill="#2a1c0a"/>
  </g>`;

  case 'tower': return `<g class="glyph">
    ${shadow(x, y, P(5))}
    <path ${B} d="M${M(-3.4, -2.4)} v${P(-9.4)} h${P(-1.1)} v${P(-1.8)} h${P(2.1)} v${P(1)} h${P(1.4)} v${P(-1)} h${P(2.1)} v${P(1)} h${P(1.4)} v${P(-1)} h${P(2.1)} v${P(1.8)} h${P(-1.1)} v${P(9.4)} Z"/>
    <path ${SH} d="M${M(2.6, -2.4)} v${P(-9.4)} h${P(1.1)} v${P(-1.8)} h${P(-1.1)} v${P(1)} Z"/>
    <path fill="#5c3f18" d="M${M(-1.2, -2.4)} v${P(-3)} a${P(1.2)},${P(1.4)} 0 0 1 ${P(2.4)},0 v${P(3)} Z"/>
    <rect x="${(x - 0.8 * s).toFixed(2)}" y="${(y - 8.4 * s).toFixed(2)}" width="${P(1.6)}" height="${P(2)}" fill="#5c3f18" opacity=".7"/>
    <path ${HI} d="M${M(-3.2, -2.5)} v${P(-9.2)}"/>
  </g>`;

  case 'ark': return `<g class="glyph">
    ${shadow(x, y, P(7.5))}
    <path ${B} d="M${M(-7, -4)} q${P(7)},${P(2.6)} ${P(14)},${P(0)} l${P(-1.6)},${P(3)} q${P(-5.4)},${P(1.8)} ${P(-10.8)},${P(0)} Z"/>
    <path ${SH} d="M${M(6.4, -3.6)} l${P(-1.6)},${P(3)} q${P(-2)},${P(0.7)} ${P(-4.2)},${P(1)} q${P(3.2)},${P(-0.2)} ${P(4.2)},${P(-1.4)} Z"/>
    <path ${ST} d="M${M(-3.4, -4.3)} h${P(6.8)} v${P(-2.6)} h${P(-6.8)} Z"/>
    <path ${OUT} d="M${M(-0.8, -6.9)} v${P(-1.6)}"/>
  </g>`;

  }
  return '';
}


const DECOR_META = {
  ship: { t: 'Корабль Великого моря', d: 'Декор в традиции старинных атласов — и напоминание, что Средиземное («Великое», Чис 34:6) море для патриархов было краем мира: их пути шли по суше. Морская торговля (корабли Фарсиса — 3 Цар 10:22; Ион 1:3) расцветёт много позже.' },
  whale: { t: '«Левиафан, которого Ты сотворил играть в нём»', d: 'Пс 103:25–26 о Великом море: «Это — море великое и пространное: там пресмыкающиеся, которым нет числа… там плавают корабли, там этот левиафан, которого Ты сотворил играть в нём». Кит на пустой воде — цитата старинной картографии и псалма разом.' },
  caravan: { t: 'Караван в Аравийской пустыне', d: 'Виньетка в традиции старинных карт — и напоминание о верблюжьих караванах эпохи патриархов: «И взял раб из верблюдов господина своего десять верблюдов… и пошёл в Месопотамию» (Быт 24:10). Великие караванные пути огибали сердце Аравии — прямых дорог через пустыню не было.' },
};

// Что означает каждый знак на листе — панель показывает по клику на глиф
const GLYPH_META = {
  ziggurat: { t: 'Зиккурат', d: 'Ступенчатая храмовая башня Междуречья. У Ура — зиккурат Ур-Намму (~2100 г. до н.э.), раскопан Л. Вулли; святилище бога луны Нанны/Сина, городского божества Ура и Харрана.' },
  pyramid: { t: 'Пирамида', d: 'Великие пирамиды Гизы к приходу Аврама уже стояли века (Древнее царство). Знак Египта — «дома фараонов», куда голод погнал патриарха (Быт 12:10).' },
  ruin: { t: 'Разрушенный город', d: 'Знак городов долины Сиддим, «ниспроверженных» серой и огнём (Быт 19:24–25). Дым над руиной — то, что увидел Авраам с высоты у Хеврона: «дым поднимается с земли, как дым из печи» (Быт 19:28).' },
  oak: { t: 'Дубрава Мамре', d: 'Элоне-Мамре — «дубрава Мамре» (Быт 13:18; 18:1): вековые деревья, под которыми Авраам принял трёх гостей. Знак дерева — место шатра и жертвенника патриарха.' },
  well: { t: 'Колодец', d: 'Беэр — колодец: главная валюта кочевника в Негеве. За колодцы клялись (Беэр-Шева, Быт 21:25–31), из-за них спорили пастухи (Быт 26). Знак вырытого колодца с воротом.' },
  tent: { t: 'Шатёр патриарха', d: '«Авраам сидел при входе в шатёр, во время зноя дневного» (Быт 18:1). Шатёр — дом странника, не построившего города: «ибо он ожидал города, имеющего основание» (Евр 11:9–10).' },
  sheep: { t: 'Стада', d: 'Богатство патриархов измерялось скотом (Быт 13:2; 24:35). Из-за пастбищ разошлись Авраам и Лот (Быт 13:5–9); мелкий скот — предмет клятвы в Гераре и Беэр-Шеве (Быт 21:27–30).' },
  ark: { t: 'Ковчег', d: 'Знак традиции, не находки: Быт 8:4 говорит о «горах Араратских» (страна Урарту), а не о пике. Все заявленные «находки ковчега» — от Дурупынара до «Арарат-аномалии» — не верифицированы; лодкообразную формацию Дурупынар первыми разобрали креационные геологи (Snelling, 1992). Атлас показывает регион и честно называет традиции.' },
  spring: { t: 'Источник', d: 'Аин — источник живой воды в пустыне; у источников останавливаются и встречают Бога (Агарь — Быт 16:7,13–14).' },
  altar: { t: 'Жертвенник', d: 'Маршрут Аврама размечен жертвенниками: Сихем (Быт 12:7), Бет-Эль (12:8), Хеврон (13:18), Мория (22:9) — богословская нить листа.' },
  gate: { t: 'Ворота', d: 'Городские ворота — суд и сделки (Быт 23:10,18). У Тель-Дана сохранилась сырцовая арка ворот средней бронзы — «ворота времён Авраама».' },
  palm: { t: 'Пальма', d: 'Знак оазиса; Хацацон-Фамар — «Фамарь» значит «пальма» (Эн-Геди, 2 Пар 20:2).' },
  tower: { t: 'Башня', d: 'Знак города-крепости; на листе-прологе — Вавилонская башня (Быт 11).' },
};


// Градусная сетка листа — из выведенных калибровок (§ контракта KA-4/D-13).
// levant: юг (y > maxY) — художественная проекция, широты там не подписываем.
const GRID = {
  levant: { lonToX: (L) => 623 + (L - 35.22) * 100, latToY: (B) => 800 - (B - 31.78) * 120, lonStep: 2, latStep: 2, maxY: 950 },
  mediterranean: { lonToX: (L) => 40 + (L - 10) * 65, latToY: (B) => 120 + (43 - B) * 82, lonStep: 4, latStep: 2, maxY: Infinity },
  urheimat: { lonToX: (L) => 40 + (L - 38) * 130, latToY: (B) => 60 + (40 - B) * 130, lonStep: 2, latStep: 2, maxY: Infinity },
};
function graticule(family, x0, y0, W, H, k) {
  const g = GRID[family];
  if (!g) return '';
  const parts = [];
  const inX = (x) => x > x0 + 40 * k && x < x0 + W - 40 * k;
  const inY = (y) => y > y0 + 40 * k && y < y0 + H - 40 * k && y < g.maxY;
  for (let lon = -20; lon <= 60; lon++) {
    const x = g.lonToX(lon);
    if (!inX(x)) continue;
    const major = lon % g.lonStep === 0;
    parts.push(`<line x1="${x.toFixed(1)}" y1="${(y0 + 8 * k).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y0 + (major ? 15 : 12) * k).toFixed(1)}" class="grat"/>`);
    if (major) parts.push(`<text x="${x.toFixed(1)}" y="${(y0 + 25 * k).toFixed(1)}" text-anchor="middle" class="grat-t" font-size="${(8 * k).toFixed(2)}">${lon}°</text>`);
  }
  for (let lat = 0; lat <= 60; lat++) {
    const y = g.latToY(lat);
    if (!inY(y)) continue;
    const major = lat % g.latStep === 0;
    for (const [ex, ta, dx] of [[x0 + 8 * k, 'start', 15], [x0 + W - 8 * k, 'end', -15]]) {
      parts.push(`<line x1="${ex.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(ex + (ta === 'start' ? 1 : -1) * (major ? 7 : 4) * k).toFixed(1)}" y2="${y.toFixed(1)}" class="grat"/>`);
      if (major) parts.push(`<text x="${(ta === 'start' ? ex + 10 * k : ex - 10 * k).toFixed(1)}" y="${(y + 2.8 * k).toFixed(1)}" text-anchor="${ta}" class="grat-t" font-size="${(8 * k).toFixed(2)}">${lat}°</text>`);
    }
  }
  return `<g class="graticule" aria-hidden="true">${parts.join('')}</g>`;
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
    // Кишон: вдоль сев. подножия Кармеля в Хайфский залив (устье в воду)
    base = base.replace(
      'M613,706 C595,712 575,720 555,728 C535,736 510,738 490,735 C468,730 445,720 420,710',
      'M631,704 C620,700 610,694 601,688 C596,685 592,683 588,680');
  } else {
    base = base.replace(/<!--[\s\S]*?-->/g, '');
  }

  // Маршрут героя — только основные станы: кандидаты (cand) и линии спутников
  // (lot и т.п.) в главную нить не входят
  const routeStops = places.filter(p => typeof p.stage === 'number' &&
    p.type !== 'region' && p.type !== 'cand' && p.type !== 'lot' && !p.noRoute);
  // route_via: невидимые формирующие точки между станами — гнут нить вокруг
  // воды/гор там, где прямая интерполяция между городами шла бы по озеру
  // (сами станы — данные, кривая между ними — интерполяция, ей нужны опоры)
  const viaMap = {};
  for (const v of (route.route_via || [])) viaMap[v.after] = v.pts || [];
  const routePts = [];
  for (const p of routeStops) {
    routePts.push([p.x, p.y]);
    if (viaMap[p.id]) routePts.push(...viaMap[p.id]);
  }
  const routePath = catmullRom(routePts);

  // Направление движения (AV-022): ОДИН шеврон на перегон между станами —
  // на самом длинном сегменте фактической полилинии этого перегона (с учётом
  // via-опор, иначе стрелка прямой «город→город» ложится в море). Больше
  // одного шеврона на перегон — визуальный шум. Экранный размер держит
  // non-scaling-stroke (.route-arrow).
  const routeArrows = [];
  {
    // границы перегонов в routePts: индексы точек-станов
    const stopIdx = [];
    let k2 = 0;
    for (const p of routeStops) { stopIdx.push(k2); k2 += 1 + (viaMap[p.id] ? viaMap[p.id].length : 0); }
    for (let s = 0; s < stopIdx.length - 1; s++) {
      let best = null;
      for (let i = stopIdx[s]; i < stopIdx[s + 1]; i++) {
        const a = routePts[i], b = routePts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!best || len > best.len) best = { a, b, len, i };
      }
      if (!best || best.len < 90) continue; // короткие перегоны не помечаем
      // точка и касательная НА КРИВОЙ (midpoint хорды при сильной кривизне
      // Catmull-Rom отходит от нити на десятки юнитов — шеврон висел в пустоте).
      // Контрольные точки Безье сегмента — та же формула, что в catmullRom().
      const i0 = best.i, p0 = routePts[Math.max(0, i0 - 1)], p1 = routePts[i0],
        p2 = routePts[i0 + 1], p3 = routePts[Math.min(routePts.length - 1, i0 + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      // B(t)/B'(t) при t=.5
      const mx = (p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8;
      const my = (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8;
      const tx = (-3 * p1[0] - 3 * c1[0] + 3 * c2[0] + 3 * p2[0]) / 4;
      const ty = (-3 * p1[1] - 3 * c1[1] + 3 * c2[1] + 3 * p2[1]) / 4;
      const ang = Math.atan2(ty, tx) * 180 / Math.PI;
      routeArrows.push(`<path d="M-3.4,-3 L0,0 L-3.4,3" transform="translate(${mx.toFixed(1)},${my.toFixed(1)}) rotate(${ang.toFixed(1)})" class="route-arrow"/>`);
    }
  }

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
    if (p.type === 'ctx') {
      dots.push(`<g class="pl" data-pid="${esc(p.id)}"><circle cx="${p.x}" cy="${p.y}" r="${(2.5 * k).toFixed(2)}" class="pl-ctx"/></g>`);
      const ca = anchorSpec(p.labelAnchor || 'e');
      labels.push(`<text x="${(p.x + ca.dx * 7 * k).toFixed(1)}" y="${(p.y + ca.dy * 7 * k + 10 * k * 0.34).toFixed(1)}" text-anchor="${ca.ta}" class="lab-ctx" font-size="${(10 * k).toFixed(2)}">${esc(p.name)}</text>`);
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
    // Пиктограммы (place.glyph / glyph2) — контурные, кликабельные (лексикон места)
    for (const [gname, gdx, gdy] of [[p.glyph, p.glyphDx, p.glyphDy], [p.glyph2, p.glyph2Dx, p.glyph2Dy]]) {
      if (!gname) continue;
      const gx = p.x + (gdx || 0), gy = p.y - 3 * k + (gdy || 0);
      // glyphScale — акцент сюжетно-ключевых объектов (дуб Мамре и т.п.)
      const g = glyphSvg(gname, gx, gy, k * 0.6 * (p.glyphScale || 1));
      if (g) glyphs.push(`<g class="glyph-hit" data-pid="${esc(p.id)}"><circle cx="${gx}" cy="${(gy - 4 * k).toFixed(1)}" r="${(5.4 * k * (p.glyphScale || 1)).toFixed(1)}" fill="transparent" stroke="none"/>${g}</g>`);
    }

    const fontPlace = (isMile || (p.glyph && p.type !== 'cand')) ? fontMain : fontMinor;
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
    labels.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="lab-place ${fontPlace === fontMain ? 'lab-main' : 'lab-minor'}${p.type === 'cand' ? ' lab-cand' : ''}" font-size="${fontPlace.toFixed(2)}" text-anchor="${sp.ta}">${esc(p.name)}</text>`);
  }

  const placeXY = places.filter(p => p.type !== 'region');
  const wps = (route.verified_waypoints || []).map((w, wpi) => {
    const s = 2.3 * k;
    // wp, совпадающий с местом (арх-подтверждение той же точки) — текст вниз,
    // чтобы не бодаться с подписью места
    const near = placeXY.some(p => Math.hypot(p.x - w.x, p.y - w.y) < 8 * k + 4);
    const tx = near ? w.x + 4 * k : w.x + 6 * k;
    const ty = near ? w.y + 14 * k : w.y + 3.6 * k;
    return `<g class="wp" data-wpi="${wpi}"><circle cx="${w.x}" cy="${w.y}" r="${(7 * k).toFixed(1)}" fill="transparent" stroke="none"/>` +
      `<rect x="${(w.x - s).toFixed(1)}" y="${(w.y - s).toFixed(1)}" width="${(s * 2).toFixed(1)}" height="${(s * 2).toFixed(1)}" transform="rotate(45 ${w.x} ${w.y})" class="wp-dot"/>` +
      `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="lab-wp" font-size="${(10 * k).toFixed(2)}">${esc(w.name)}</text></g>`;
  });
  const ctxs = (route.ctx || []).filter(c => c && typeof c.x === 'number').map(c =>
    `<text x="${c.x}" y="${c.y}" class="lab-ctxnote" font-size="${fontCtx.toFixed(2)}" text-anchor="middle">${esc((c.name || '').toUpperCase())}</text>`);

  // Смысловые оверлеи (route.overlays): границы обетования, путь Лота и т.п.
  const ovls = (route.overlays || []).map((o, oi) => {
    const od = catmullRom(o.path || []);
    let arrow = '';
    if (o.arrow && o.path && o.path.length > 1) {
      const oe = o.path[o.path.length - 1], op2 = o.path[o.path.length - 2];
      const oa = Math.atan2(oe[1] - op2[1], oe[0] - op2[0]);
      const ah = (a2) => [oe[0] - 6 * k * Math.cos(oa + a2), oe[1] - 6 * k * Math.sin(oa + a2)];
      const [x1, y1] = ah(0.45), [x2, y2] = ah(-0.45);
      arrow = `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} L${oe[0]},${oe[1]} L${x2.toFixed(1)},${y2.toFixed(1)}" class="ovl ovl-${o.style || 'ctxpath'}" style="stroke-dasharray:none;fill:none"/>`;
    }
    const la = anchorSpec(o.labelAnchor || 'e');
    const lab = (o.label && o.labelPos) ?
      `<text x="${o.labelPos[0]}" y="${o.labelPos[1]}" text-anchor="${la.ta}" class="lab-ovl lab-ovl-${o.style || 'ctxpath'}" font-size="${(9.5 * k).toFixed(2)}">${esc(o.label)}</text>` : '';
    return `<g class="ovl-layer" data-ovl="${oi}">${od ? `<path d="${od}" class="ovl-hit" fill="none" stroke="transparent" stroke-width="${(9 * k).toFixed(1)}"/><path d="${od}" class="ovl ovl-${o.style || 'ctxpath'}"/>` : ''}${arrow}${lab}</g>`;
  });

  // Врезка-заметка (route.sidenote) — честные оговорки листа в пустой зоне
  let sidenote = '';
  if (route.sidenote && route.sidenote.lines) {
    const sn = route.sidenote;
    const nw = (sn.w || 300) * k, lh = 13.5 * k;
    const nh = (22 + 10) * k + sn.lines.length * lh;
    sidenote = `<g class="sidenote" aria-label="Примечание листа">
      <rect x="${sn.x}" y="${sn.y}" width="${nw.toFixed(1)}" height="${nh.toFixed(1)}" rx="${5 * k}" class="sn-plate"/>
      <text x="${sn.x + 12 * k}" y="${sn.y + 17 * k}" class="sn-title" font-size="${(9.5 * k).toFixed(2)}">${esc(sn.title || 'ПРИМЕЧАНИЕ')}</text>
      ${sn.lines.map((ln, i) => `<text x="${sn.x + 12 * k}" y="${(sn.y + 32 * k + i * lh).toFixed(1)}" class="sn-line" font-size="${(10 * k).toFixed(2)}">${esc(ln)}</text>`).join('')}
    </g>`;
  }

  // Минимализм: веха = тонкая римская цифра у точки (без кружков и полей)
  // Поход царей (Быт 14): тонкая линия вторжения + узлы-крестики (кликабельны)
  let warSvg = '';
  const camp = route.campaign;
  if (camp && Array.isArray(camp.places) && camp.places.length) {
    const wpath = (camp.path && camp.path.length > 1) ? camp.path : camp.places.map(w => [w.x, w.y]);
    const wd = catmullRom(wpath);
    const wpts = camp.places.map(w => {
      const wa = anchorSpec(w.labelAnchor || 'e');
      return `<g class="war" data-pid="${esc(w.id)}"><circle cx="${w.x}" cy="${w.y}" r="${(6 * k).toFixed(1)}" fill="transparent" stroke="none"/>` +
        (w.noX ? '' : `<path d="M${w.x - 2.3 * k},${w.y - 2.3 * k} L${w.x + 2.3 * k},${w.y + 2.3 * k} M${w.x - 2.3 * k},${w.y + 2.3 * k} L${w.x + 2.3 * k},${w.y - 2.3 * k}" class="war-x"/>`) +
        `<text x="${(w.x + wa.dx * 6.5 * k).toFixed(1)}" y="${(w.y + wa.dy * 6.5 * k + 9 * k * 0.34).toFixed(1)}" text-anchor="${wa.ta}" class="lab-war" font-size="${(9 * k).toFixed(2)}">${esc(w.name)}</text></g>`;
    }).join('');
    const wend = wpath[wpath.length - 1], wprev = wpath[wpath.length - 2] || wend;
    const ang = Math.atan2(wend[1] - wprev[1], wend[0] - wprev[0]);
    const ah = (a2) => [wend[0] - 7 * k * Math.cos(ang + a2), wend[1] - 7 * k * Math.sin(ang + a2)];
    const [a1x, a1y] = ah(0.42), [a2x, a2y] = ah(-0.42);
    warSvg = `<g class="war-layer" aria-label="${esc(camp.label || 'Поход царей')}">` +
      `<path d="${wd}" class="war-route"/>` +
      `<path d="M${a1x.toFixed(1)},${a1y.toFixed(1)} L${wend[0]},${wend[1]} L${a2x.toFixed(1)},${a2y.toFixed(1)}" class="war-route" style="stroke-dasharray:none"/>` +
      (camp.note ? `<text x="${(camp.notePos ? camp.notePos[0] : wpath[0][0] + 8 * k).toFixed(1)}" y="${(camp.notePos ? camp.notePos[1] : wpath[0][1] - 6 * k).toFixed(1)}" class="lab-war lab-war-note" font-size="${(9 * k).toFixed(2)}">${esc(camp.note)}</text>` : '') +
      wpts + `</g>`;
  }

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
      <g class="rose">
        <circle r="${25 * k}" class="rose-ring"/>
        <g class="rose-ticks">${Array.from({ length: 16 }, (_, i) =>
    `<path d="M0,${-25 * k} v${(i % 4 === 0 ? 3.2 : 1.8) * k}" transform="rotate(${i * 22.5})"/>`).join('')}</g>
        <path d="M0,${-15 * k} L${2 * k},${-2 * k} L${15 * k},0 L${2 * k},${2 * k} L0,${15 * k} L${-2 * k},${2 * k} L${-15 * k},0 L${-2 * k},${-2 * k} Z" transform="rotate(45)" class="rose-sec"/>
        <path d="M0,${-22 * k} L${3 * k},${-3 * k} L${22 * k},0 L${3 * k},${3 * k} L0,${22 * k} L${-3 * k},${3 * k} L${-22 * k},0 L${-3 * k},${-3 * k} Z"/>
        <path d="M0,${-22 * k} L${3 * k},${-3 * k} L0,0 Z M${22 * k},0 L${3 * k},${3 * k} L0,0 Z M0,${22 * k} L${-3 * k},${3 * k} L0,0 Z M${-22 * k},0 L${-3 * k},${-3 * k} L0,0 Z" class="rose-shade"/>
        <circle r="${2.1 * k}" class="rose-hub"/>
      </g>
      <path d="M0,${-22 * k} L${3 * k},${-3 * k} L0,${-6 * k} L${-3 * k},${-3 * k} Z" class="north"/>
      <text y="${26 * k}" text-anchor="middle" class="north-t" font-size="${13 * k}">С</text>
    </g>
  </g>`;

  const sheetNo = opts.sheetNo; // номер листа в атласе (римская цифра), опционально
    const cartW = Math.max(400, 46 + Math.max((meta.title || slug).length * 14.6, ((meta.subtitle || '').length) * 6.6)) * k;
  // орнаментальные углы картуша (внутр. рамка): 4 завитка + двойная линия
  const inX = x0 + 29 * k, inY = y0 + 23 * k, inW = cartW - 10 * k, inH = 76 * k, o = 15 * k, oi = 3 * k;
  const orn = (px, py, deg) => `<use href="#cornerOrn" width="16" height="16" transform="translate(${px.toFixed(1)},${py.toFixed(1)}) scale(${k.toFixed(3)}) rotate(${deg} 8 8)"/>`;
  const cart = `
  <g class="cartouche">
    <rect x="${x0 + 24 * k}" y="${y0 + 18 * k}" width="${cartW.toFixed(1)}" height="${86 * k}" rx="${8 * k}" class="plate cart-plate"/>
    <rect x="${inX.toFixed(1)}" y="${inY.toFixed(1)}" width="${inW.toFixed(1)}" height="${inH.toFixed(1)}" rx="${6 * k}" class="cart-inner"/>
    <rect x="${(inX + 2.5 * k).toFixed(1)}" y="${(inY + 2.5 * k).toFixed(1)}" width="${(inW - 5 * k).toFixed(1)}" height="${(inH - 5 * k).toFixed(1)}" rx="${4.5 * k}" class="cart-inner2"/>
    ${orn(inX + oi, inY + oi, 0)}
    ${orn(inX + inW - oi - o, inY + oi, 90)}
    ${orn(inX + inW - oi - o, inY + inH - oi - o, 180)}
    ${orn(inX + oi, inY + inH - oi - o, 270)}
    <text x="${x0 + 44 * k}" y="${y0 + 41 * k}" class="cart-over" font-size="${9.5 * k}">БИБЛЕЙСКИЙ АТЛАС${sheetNo ? ` · ЛИСТ ${sheetNo}` : ''}</text>
    <text x="${x0 + 44 * k}" y="${y0 + 68 * k}" class="cart-title" font-size="${25 * k}">${esc(meta.title || slug)}</text>
    <text x="${x0 + 44 * k}" y="${y0 + 90 * k}" class="cart-sub" font-size="${11.5 * k}">${esc(meta.subtitle || '')}</text>
  </g>`;

  // Легенда глифов — компакт над этап-зоной, левый низ
  const lg = (i) => y0 + H - (36 - i * 0) * k;
  const legY = y0 + H - 36 * k;
  const hasWar = !!(route.campaign && (route.campaign.places || []).length);
  const legOvl = (route.overlays || []).find(o => o.legend && o.label);
  const heroPathLabel = (route.layers && route.layers[0] && (route.layers[0].pathLabel || `путь ${route.layers[0].label}`)) || 'маршрут';
  const heroOff = 250 + Math.max(0, heroPathLabel.length - 24) * 8;
  const legW = 372 + heroOff + (hasWar ? 140 : 0) + (legOvl ? 36 + legOvl.label.length * 5.6 : 0);
  const legend = `
  <g class="legend">
    <rect x="${x0 + 24 * k}" y="${legY - 14 * k}" width="${(legW * k).toFixed(1)}" height="${30 * k}" rx="${6 * k}" class="plate"/>
    <path d="M${x0 + 34 * k},${legY + 1 * k} h${26 * k}" class="route"/>
    <text x="${x0 + 66 * k}" y="${legY + 5 * k}" class="leg-t" font-size="${10.5 * k}">${esc(heroPathLabel)}</text>
    <circle cx="${x0 + (42 + heroOff) * k}" cy="${legY + 1 * k}" r="${4.2 * k}" class="pl-city"/>
    <text x="${x0 + (52 + heroOff) * k}" y="${legY + 5 * k}" class="leg-t" font-size="${10.5 * k}">город · стан</text>
    <circle cx="${x0 + (132 + heroOff) * k}" cy="${legY + 1 * k}" r="${4.6 * k}" class="pl-cand"/>
    <text x="${x0 + (142 + heroOff) * k}" y="${legY + 5 * k}" class="leg-t" font-size="${10.5 * k}">локализация спорна</text>
    <rect x="${x0 + (268 + heroOff) * k}" y="${legY - 3 * k}" width="${8 * k}" height="${8 * k}" transform="rotate(45 ${x0 + (272 + heroOff) * k} ${legY + 1 * k})" class="wp-dot"/>
    <text x="${x0 + (282 + heroOff) * k}" y="${legY + 5 * k}" class="leg-t" font-size="${10.5 * k}">археология</text>${hasWar ? `
    <path d="M${x0 + (352 + heroOff) * k},${legY - 2 * k} l${6 * k},${6 * k} m${-6 * k},0 l${6 * k},${-6 * k}" class="war-x"/>
    <text x="${x0 + (364 + heroOff) * k}" y="${legY + 5 * k}" class="leg-t" font-size="${10.5 * k}">поход царей · Быт 14</text>` : ''}${legOvl ? `
    <path d="M${x0 + ((hasWar ? 512 : 372) + heroOff) * k},${legY + 1 * k} h${22 * k}" class="ovl ovl-${legOvl.style || 'ctxpath'}"/>
    <text x="${x0 + ((hasWar ? 512 : 372) + heroOff + 30) * k}" y="${legY + 5 * k}" class="leg-t" font-size="${(10.5 * k).toFixed(2)}">${esc(legOvl.label)}</text>` : ''}
  </g>`;

  const stageStripHtml = stages.length ? `
  <div class="stage-strip">
    ${stages.map((s, i) =>
    `<div class="st" data-stage="${i}" role="button" tabindex="0" title="Показать этап на листе"><span class="st-dot" style="background:${STAGE_TINT[i % STAGE_TINT.length]}"></span>` +
    `<span class="st-body"><b>${esc(ROMAN[i] || i + 1)}</b> · ${esc(String(s.t || ''))}` +
    (s.age || s.km ? `<i>${esc(String(s.age || s.km))}</i>` : '') + `</span></div>`).join('')}
  </div>` : '';

  const svg = `<svg id="sheet-svg" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${W} ${H.toFixed(1)}" data-vb="${x0.toFixed(1)} ${y0.toFixed(1)} ${W} ${H.toFixed(1)}" data-km-per-unit="${KM_PER_UNIT[family]}" xmlns="http://www.w3.org/2000/svg" class="sheet" role="img" aria-label="${esc(meta.title || slug)} — лист Атласа">
${GEO_DEFS}
<clipPath id="mapClip"><rect x="${(x0 + 8 * k).toFixed(1)}" y="${(y0 + 8 * k).toFixed(1)}" width="${(W - 16 * k).toFixed(1)}" height="${(H - 16 * k).toFixed(1)}"/></clipPath>
<g class="geo" clip-path="url(#mapClip)">
<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#seaG)"/>
<g class="base">${base}</g>
${RELIEF[family] || ''}
${DECOR[family] || ''}
<path d="${routePath}" class="route-under"/>
<path d="${routePath}" class="route"/>
${routeArrows.join('')}
${halos.join('')}
${leaders.join('')}
${dots.join('')}
${miles.join('')}
${warSvg}
${glyphs.join('')}
${wps.join('')}
${ctxs.join('')}
${ovls.join('')}
${sidenote}
${labels.join('')}
</g>
${cart}
${legend}
${furn}
<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#sunGlow)" pointer-events="none" class="paper-fx"/>
<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#edgeFog)" pointer-events="none" class="paper-fx"/>
<rect x="${x0}" y="${y0}" width="${W}" height="${H}" filter="url(#parchmentGrain)" opacity=".5" pointer-events="none" class="paper-fx paper-grain"/>
${graticule(family, x0, y0, W, H, k)}
<rect x="${x0 + 8 * k}" y="${y0 + 8 * k}" width="${W - 16 * k}" height="${H - 16 * k}" class="frame"/>
<rect x="${x0 + 12 * k}" y="${y0 + 12 * k}" width="${W - 24 * k}" height="${H - 24 * k}" class="frame frame-inner"/>
<g class="frame-orn">
  <use href="#cornerOrn" width="16" height="16" transform="translate(${(x0 + 14 * k).toFixed(1)},${(y0 + 14 * k).toFixed(1)}) scale(${(k * 1.5).toFixed(3)}) rotate(0 8 8)"/>
  <use href="#cornerOrn" width="16" height="16" transform="translate(${(x0 + W - 14 * k - 24 * k).toFixed(1)},${(y0 + 14 * k).toFixed(1)}) scale(${(k * 1.5).toFixed(3)}) rotate(90 8 8)"/>
  <use href="#cornerOrn" width="16" height="16" transform="translate(${(x0 + W - 14 * k - 24 * k).toFixed(1)},${(y0 + H - 14 * k - 24 * k).toFixed(1)}) scale(${(k * 1.5).toFixed(3)}) rotate(180 8 8)"/>
  <use href="#cornerOrn" width="16" height="16" transform="translate(${(x0 + 14 * k).toFixed(1)},${(y0 + H - 14 * k - 24 * k).toFixed(1)}) scale(${(k * 1.5).toFixed(3)}) rotate(270 8 8)"/>
</g>
</svg>`;

  return { svg, stageStripHtml, meta: { title: meta.title || slug, subtitle: meta.subtitle || '' } };
}

function sheetCss() {
  return `
  html,body{margin:0;min-height:100%;background:#e3d4ac}
  body{display:grid;place-items:center;padding:12px;box-sizing:border-box}
  .wrap{position:relative;max-width:1500px;width:100%;box-shadow:0 18px 60px rgba(90,70,30,.35), 0 2px 10px rgba(90,70,30,.22);border-radius:6px;overflow:hidden}
  svg.sheet{display:block;width:100%;height:auto;background:#ecdcb4}
  .frame{fill:none;stroke:#8a6a1f;stroke-width:1.2;opacity:.55}
  .frame-inner{stroke-width:.5;opacity:.35}
  .frame-orn use{opacity:.5}
  svg.zoomed .frame-inner,svg.zoomed .frame-orn{opacity:0}
  /* ════ СИСТЕМА МАСШТАБИРОВАНИЯ ЛИСТА ════
     Линейные объекты держат ЭКРАННУЮ толщину (non-scaling-stroke);
     точки/подписи/символы — ступени LOD z2/z3/z4 (целевые размеры в
     экранных px, пересчитаны на середину каждой ступени).            */
  #sheet-svg path[fill="none"][stroke="#2d4a66"],
  #sheet-svg path[fill="none"][stroke="#2e4d6b"],
  #sheet-svg g[stroke="#2d4a66"] path,
  #sheet-svg path[stroke="#4a80a8"], #sheet-svg path[stroke="#4a80a0"],
  #sheet-svg #tradeRoutes path,
  #sheet-svg .route, #sheet-svg .route-under, #sheet-svg .route-arrow,
  #sheet-svg .war-route, #sheet-svg .ovl,
  #sheet-svg .leader, #sheet-svg .grat,
  #sheet-svg .glyph path, #sheet-svg .glyph circle,
  #sheet-svg .decor-ship path,
  #sheet-svg path[stroke="#2e4d6b"], #sheet-svg ellipse[stroke="#2e4d6b"],
  #sheet-svg path[stroke="#8b7d5a"], #sheet-svg path[stroke="#3a4150"]
  {vector-effect:non-scaling-stroke}
  #sheet-svg .pl-city, #sheet-svg .pl-cand, #sheet-svg .pl-ctx, #sheet-svg .wp-dot
  {vector-effect:non-scaling-stroke}
  #sheet-svg .pl-city{stroke-width:1px}
  #sheet-svg .pl-cand{stroke-width:1.1px}
  /* при non-scaling-stroke dash-паттерн тоже в ЭКРАННЫХ px — задаём один раз */
  #sheet-svg #tradeRoutes path{stroke-width:2.1px;stroke-dasharray:.1 6.5}
  #sheet-svg .route{stroke-width:2.1px;stroke-dasharray:.1 8}
  #sheet-svg .route-arrow{fill:none;stroke:#b0472e;stroke-width:1.5px;stroke-linecap:round;stroke-linejoin:round;opacity:.72}
  /* издательский halo подписей: обводка цветом бумаги ПОД заливкой букв
     (paint-order) — пунктиры маршрутов/рек не перечёркивают текст;
     non-scaling держит толщину halo на всех зумах */
  #sheet-svg text.lab-place, #sheet-svg .lab-war, #sheet-svg .lab-ctx,
  #sheet-svg .mile-t, #sheet-svg text.lab-wp
  {paint-order:stroke;stroke:rgba(245,237,216,.88);stroke-width:2.6px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  #sheet-svg .route-under{stroke-width:3px}
  #sheet-svg .war-route{stroke-width:1.15px;stroke-dasharray:9 5.5}
  #sheet-svg .ovl-covenant{stroke-width:1.5px;stroke-dasharray:10 6}
  #sheet-svg .ovl-ctxpath{stroke-width:1.2px;stroke-dasharray:2.8 4.6}
  #sheet-svg .grat{stroke-width:.8px}
  #sheet-svg .leader{stroke-width:.75px}
  /* ── ступень z2 (≈1.6–3.1×, целевые экранные: main 13 · minor 11 · точка 4.4) ── */
  svg.z2 text.lab-main{font-size:7.1px}
  svg.z2 text.lab-minor{font-size:6px}
  svg.z2 text.lab-cand{font-size:5.5px}
  svg.z2 .pl-city{transform:scale(.257);transform-box:fill-box;transform-origin:center}
  svg.z2 .pl-cand{transform:scale(.27);transform-box:fill-box;transform-origin:center}
  svg.z2 .pl-ctx{transform:scale(.293);transform-box:fill-box;transform-origin:center}
  svg.z2 .mile-t{font-size:5.5px}
  svg.z2 .lab-war{font-size:4.7px}
  svg.z2 .lab-ovl{font-size:4.4px}
  svg.z2 .lab-ctx{font-size:4.7px}
  svg.z2 text.lab-wp{font-size:4.4px}
  svg.z2 .war-x{transform:scale(.6);transform-box:fill-box;transform-origin:center}
  /* ── ступень z3 (≈3.1–5.5×) ── */
  svg.z3 text.lab-main{font-size:3.7px}
  svg.z3 text.lab-minor{font-size:3.2px}
  svg.z3 text.lab-cand{font-size:2.9px}
  svg.z3 .pl-city{transform:scale(.137);transform-box:fill-box;transform-origin:center}
  svg.z3 .pl-cand{transform:scale(.144);transform-box:fill-box;transform-origin:center}
  svg.z3 .pl-ctx{transform:scale(.16);transform-box:fill-box;transform-origin:center}
  svg.z3 .mile-t{font-size:2.9px}
  svg.z3 .lab-war{font-size:2.4px}
  svg.z3 .lab-ovl{font-size:2.3px}
  svg.z3 .lab-ctx{font-size:2.4px}
  svg.z3 text.lab-wp{font-size:2.3px}
  svg.z3 .war-x{transform:scale(.34);transform-box:fill-box;transform-origin:center}
  svg.z3 .lab-region{opacity:.22}
  /* ── ступень z4 (≥5.5×) ── */
  svg.z4 text.lab-main{font-size:2.3px}
  svg.z4 text.lab-minor{font-size:2px}
  svg.z4 text.lab-cand{font-size:1.8px}
  svg.z4 .pl-city{transform:scale(.0857);transform-box:fill-box;transform-origin:center}
  svg.z4 .pl-cand{transform:scale(.09);transform-box:fill-box;transform-origin:center}
  svg.z4 .pl-ctx{transform:scale(.107);transform-box:fill-box;transform-origin:center}
  svg.z4 .mile-t{font-size:1.8px}
  svg.z4 .lab-war{font-size:1.5px}
  svg.z4 .lab-ovl{font-size:1.4px}
  svg.z4 .lab-ctx{font-size:1.5px}
  svg.z4 text.lab-wp{font-size:1.4px}
  svg.z4 .war-x{transform:scale(.2);transform-box:fill-box;transform-origin:center}
  svg.z4 .lab-region{opacity:0}
  /* глифы: контур постоянный (ve), геометрия скейлится — тоньше не нужно */
  /* ── базовые подписи (донор): родная LOD-семантика lbl-z1/lbl-z2 ──
     ДВА бага разом: (1) селектор был ограничен text./g. — сырые ellipse/path
     с классом lbl-z2 (озеро Хула, стрелки течения, мелкие притоки) не
     попадали под гейт и были видны ВСЕГДА на любом зуме; (2) базовое
     правило с #sheet-svg (id) по специфичности ВСЕГДА перебивало
     "svg.z2 .lbl-z2" (id > class×2 в каскаде CSS) — из-за этого "Киннерет"
     и все донорские lbl-z2 подписи не проявлялись НИ НА ОДНОМ зуме за всё
     время существования этой LOD-системы. База без #id — тогда zoom-правило
     (0,2,0) законно перебивает базовое (0,1,0). */
  .lbl-z2{opacity:0}
  svg.z2 .lbl-z2{opacity:.85}
  svg.z3 .lbl-z2, svg.z4 .lbl-z2{opacity:.9}
  /* крупные надписи базы (моря/макрорегионы без lbl-классов) — хороши как фоновый
     "водяной знак" на обзоре, но перечёркивают локальные подписи при малейшем
     приближении: гасим уже на первой ступени зума, а не только с z3 */
  svg.zoomed text.sea-label:not(.lbl-z1):not(.lbl-z2),
  svg.zoomed text.region-label:not(.lbl-z1):not(.lbl-z2){opacity:.45}
  svg.z3 text.sea-label:not(.lbl-z1):not(.lbl-z2),
  svg.z3 text.region-label:not(.lbl-z1):not(.lbl-z2){opacity:.15}
  svg.z4 text.sea-label:not(.lbl-z1):not(.lbl-z2),
  svg.z4 text.region-label:not(.lbl-z1):not(.lbl-z2){opacity:0}
  svg.z3 text.region-he, svg.z4 text.region-he{opacity:.1}
  /* штриховка рельефа хороша как фактура на обзоре, но при зуме тайл растёт
     (userSpaceOnUse) и превращается в редкие гигантские полосы — гасим её
     к близким масштабам, оставляя мягкий рельефный тон (mtG-эллипсы) */
  #sheet-svg .relief{transition:none}
  svg.zoomed .relief{opacity:.5}
  svg.z3 .relief{opacity:.22}
  svg.z4 .relief{opacity:.08}
  /* бумажная фактура/виньетка — для обзора; feTurbulence-грейн на сильном
     зуме даёт тайловые артефакты (вертикальные полосы) — гасим на близких */
  svg.z3 .paper-grain{opacity:.2}
  svg.z4 .paper-grain{opacity:0}
  svg.z4 .paper-fx{opacity:.4}
  /* прибрежная тень-мелководье: глубина на обзоре, но на зуме читается
     тёмным клином вдоль берега — растворяем */
  svg.zoomed path[fill="rgba(13,40,70,.3)"]{opacity:.22}
  svg.z3 path[fill="rgba(13,40,70,.3)"], svg.z4 path[fill="rgba(13,40,70,.3)"]{opacity:0}
  svg.z3 text.lbl-z1, svg.z3 g.lbl-z1 text{font-size:2.4px}
  svg.z4 text.lbl-z1, svg.z4 g.lbl-z1 text{font-size:1.6px}
  svg.z3 text.lbl-z2, svg.z3 g.lbl-z2 text{font-size:2.2px}
  svg.z4 text.lbl-z2, svg.z4 g.lbl-z2 text{font-size:1.5px}
  svg.z2 .wp-dot{opacity:.75}
  /* без transition: смена LOD всегда совпадает с синхронной сменой viewBox
     (см. atlas-reader.js apply()), а CSS-transition для font-size/r в этом
     случае у части браузеров "застревает" на нескомпенсированном значении —
     переход в одном тике должен быть мгновенным и детерминированным */
  .grat{stroke:#8a6a1f;stroke-width:.8;opacity:.4}
  .grat-t{font-family:Lora,Georgia,serif;font-weight:500;fill:#8a6a1f;opacity:.5}
  .rose path{fill:rgba(138,106,31,.32);stroke:#8a6a1f;stroke-width:.5;opacity:.8}
  .rose .rose-ring{fill:none;stroke:#8a6a1f;stroke-width:.6;opacity:.5}
  .rose .rose-ticks path{fill:none;stroke:#8a6a1f;stroke-width:.6;opacity:.55}
  .rose .rose-sec{fill:rgba(138,106,31,.16);stroke:#8a6a1f;stroke-width:.4;opacity:.75}
  .rose .rose-shade{fill:rgba(107,82,22,.45);stroke:none}
  .rose .rose-hub{fill:#8a6a1f;stroke:none;opacity:.7}
  .graticule{transition:opacity .35s}
  svg.zoomed .graticule{opacity:0}
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
  .lab-ctxnote{font-family:Lora,Georgia,serif;font-weight:500;fill:#8a7a5e;letter-spacing:.3em;opacity:.7;paint-order:stroke;stroke:#ecdcb4;stroke-width:.16em}
  .ovl{fill:none;stroke-linecap:round}
  .ovl-covenant{stroke:#7d8f4e;stroke-width:1.5;stroke-dasharray:11 7;opacity:.5}
  .ovl-ctxpath{stroke:#7a8fa0;stroke-width:1.2;stroke-dasharray:3 5;opacity:.55}
  .lab-ovl{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;paint-order:stroke;stroke:#ecdcb4;stroke-width:.14em;stroke-linejoin:round}
  .lab-ovl-covenant{fill:#6e7f42;letter-spacing:.12em}
  .lab-ovl-ctxpath{fill:#63798a}
  .sn-plate{fill:rgba(246,241,231,.72);stroke:rgba(138,106,31,.28);stroke-width:.7}
  .sn-title{font-family:Lora,Georgia,serif;font-weight:600;fill:#8a6a30;letter-spacing:.22em}
  .sn-line{font-family:Lora,Georgia,serif;font-style:italic;fill:#5a4c30}
  .decor-ship path{fill:none;stroke:#5c718a;stroke-width:1.1;opacity:.5;stroke-linejoin:round}
  .decor-ship .ds-line{stroke-width:.9}
  .decor-ship .ds-wave{opacity:.35}
  .pl-ctx{fill:#6e5f43;stroke:#f6f1e7;stroke-width:.7;opacity:.9}
  .lab-ctx{font-family:Lora,Georgia,serif;font-style:italic;font-weight:400;fill:#8a7a5e;opacity:.9;paint-order:stroke;stroke:#ecdcb4;stroke-width:.14em;stroke-linejoin:round}
  .war-x{stroke:#8a5a5c;stroke-width:1.05;opacity:.72;fill:none}
  .war-route{fill:none;stroke:#8a6668;stroke-width:1.15;stroke-dasharray:10 6;opacity:.42;stroke-linecap:round}
  .lab-war{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;fill:#8a4a38;opacity:.92;paint-order:stroke;stroke:#ecdcb4;stroke-width:.14em;stroke-linejoin:round}
  .lab-war-note{opacity:.8}
  .glyph-hit{cursor:pointer}
  /* иконки живут мелко; при наведении — плавно вырастают из своего основания
     (transform-origin у «земли»), штрихи non-scaling держат тонкость */
  #sheet-svg .glyph{transition:transform .2s cubic-bezier(.34,1.35,.5,1)}
  #sheet-svg .glyph-hit:hover .glyph,
  #sheet-svg .glyph-hit:focus-visible .glyph{transform:scale(1.7);transform-box:fill-box;transform-origin:50% 90%}
  .mile,.wp,.ovl-layer,.decor-ship,.war{cursor:pointer}
  #sheet-svg [fill="url(#jordanG)"]{opacity:.09}
  #sheet-svg #tradeRoutes{opacity:.32}
  /* ── киношные иконки-глифы: объём, светотень, цвет-акцент ── */
  .glyph .gb{stroke:#6a5028;stroke-width:.62px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  .glyph .g-out{fill:none;stroke:#6a5028;stroke-width:.68px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  .glyph .g-sh{fill:#3d2c0f;opacity:.2;stroke:none}
  .glyph .g-sh2{fill:#3d2c0f;opacity:.32;stroke:none}
  .glyph .g-hi{fill:none;stroke:rgba(255,250,235,.6);stroke-width:.55px;stroke-linecap:round;vector-effect:non-scaling-stroke}
  .glyph .g-smoke{fill:none;stroke:#8a7a58;stroke-width:.85px;opacity:.7;stroke-linecap:round;vector-effect:non-scaling-stroke}
  .glyph .g-legs{fill:none;stroke:#5c421d;stroke-width:.8px;stroke-linecap:round;vector-effect:non-scaling-stroke}
  .glyph .g-shadow{stroke:none}
  /* мягкое гашение объёма иконок на глубоких зумах, чтобы не давить карту */
  svg.z3 .glyph .g-shadow{opacity:.6}
  svg.z4 .glyph .g-shadow{opacity:.35}

  .wp-dot{fill:#4a7a52;stroke:none;opacity:.6}
  .leader{stroke:#5c4d33;stroke-width:.75;opacity:.45}
  .mile-t{font:italic 500 1em 'Cormorant Garamond',Georgia,serif;opacity:.95;letter-spacing:.04em}
  text.lab-place{font-family:Lora,Georgia,serif;font-weight:600;fill:#2b2418;letter-spacing:.01em;paint-order:stroke;stroke:#ecdcb4;stroke-width:.17em;stroke-linejoin:round}
  text.lab-cand{font-family:Lora,Georgia,serif;font-style:italic;font-weight:400;fill:#6b5a35;paint-order:stroke;stroke:#ecdcb4;stroke-width:.15em;stroke-linejoin:round}
  text.lab-region{font-family:Lora,Georgia,serif;font-weight:500;fill:#7a6a48;letter-spacing:.34em;opacity:.78;paint-order:stroke;stroke:#ecdcb4;stroke-width:.18em;stroke-linejoin:round}
  text.lab-ctx{font-family:Georgia,serif;letter-spacing:.24em;fill:#8a7a58;opacity:.6;paint-order:stroke;stroke:#ecdcb4;stroke-width:.16em}
  text.lab-wp{font-family:Georgia,serif;font-style:italic;fill:#4a6a52;opacity:0;transition:opacity .3s;paint-order:stroke;stroke:#ecdcb4;stroke-width:.16em}
  svg.zoomed text.lab-wp{opacity:.85}
  .plate{fill:rgba(246,241,231,.85);stroke:rgba(120,95,40,.35);stroke-width:1}
  .cart-plate{fill:rgba(246,241,231,.92)}
  .cart-inner{fill:none;stroke:rgba(138,106,31,.42);stroke-width:1}
  .cart-inner2{fill:none;stroke:rgba(138,106,31,.22);stroke-width:.5}
  .cartouche use{opacity:.72}
  .cart-over{font-family:Lora,Georgia,serif;fill:#8a6a1f;letter-spacing:.26em;font-weight:500}
  .cart-title{font-family:'Playfair Display',Georgia,serif;font-weight:700;fill:#243a56;letter-spacing:.01em}
  .cart-sub{font-family:Lora,Georgia,serif;font-style:italic;font-weight:400;fill:#5c6e86}
  .leg-t{font-family:Lora,Georgia,serif;font-weight:500;fill:#3a3020;opacity:.9}
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
  /* было position:fixed + bottom:10 — на широких вьюпортах съезжал за
     край листа (как dive-btn), да ещё и садился на масштабную линейку;
     теперь внутри .wrap (position:absolute) и в верхнем правом углу, где
     после переноса dive-btn ниже розы ветров освободилось место */
  .g9{position:absolute;right:10px;top:10px;z-index:9;font:600 10px/1 system-ui;letter-spacing:.08em;color:#7a5c26;background:rgba(246,241,231,.9);border:1px solid rgba(138,106,31,.4);border-radius:999px;padding:6px 10px}
  /* компактный HUD зума: экранная шкала + север (фурнитура листа на зуме скрыта) */
  .zoom-hud{position:absolute;left:14px;bottom:14px;z-index:20;display:flex;align-items:center;gap:9px;font:600 11px/1 Georgia,serif;color:#6b5216;background:rgba(246,241,231,.92);border:1px solid rgba(138,106,31,.4);border-radius:8px;padding:7px 11px;box-shadow:0 2px 8px rgba(90,70,30,.18);pointer-events:none}
  /* display:flex выше перебивает UA-стиль [hidden] — возвращаем скрытие явно */
  .zoom-hud[hidden]{display:none}
  .zoom-hud .zh-bar{display:inline-block;height:5px;background:#4a3f28;border:1px solid #6b5216;border-radius:1px}
  .zoom-hud .zh-north{letter-spacing:.05em}
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
  .place-card{position:fixed;z-index:30;width:300px;background:#f6f1e7;border:1px solid rgba(138,106,31,.45);border-radius:12px;box-shadow:0 14px 40px rgba(60,45,15,.35);overflow:hidden;opacity:0;transform:translateY(6px) scale(.98);transition:opacity .18s,transform .18s;pointer-events:none;font-family:Lora,Georgia,serif}
  .place-card.pc--on{opacity:1;transform:none}
  .pc-ph{position:relative;height:130px;background:#e8dcbc}
  .pc-ph img{width:100%;height:100%;object-fit:cover;display:block}
  .pc-ph i{position:absolute;left:0;right:0;bottom:0;padding:14px 10px 5px;font:600 9px/1 system-ui;letter-spacing:.12em;color:#fff;background:linear-gradient(transparent,rgba(20,14,4,.72))}
  .pc-body{padding:10px 12px 12px}
  .pc-body b{display:block;font:700 15px/1.2 Georgia,serif;color:#1e3a63}
  .pc-body u{display:block;text-decoration:none;font:600 10.5px/1.3 Georgia,serif;color:#8a6a1f;letter-spacing:.06em;margin-top:2px}
  .pc-body p{margin:7px 0 0;font:400 12px/1.5 Georgia,serif;color:#3a3020}
  /* ── Панель-досье (клик по месту) ── */
  .dossier{position:fixed;right:0;top:0;bottom:0;width:min(430px,94vw);z-index:26;background:#f6f1e7;border-left:1px solid rgba(138,106,31,.4);box-shadow:-16px 0 44px rgba(60,45,15,.3);transform:translateX(103%);transition:transform .28s ease;display:flex;flex-direction:column;font-family:Lora,Georgia,serif}
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
  .do-lex{background:rgba(138,106,31,.06);border:1px solid rgba(138,106,31,.16);border-radius:10px;padding:12px 14px}
  .do-lex .lex-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:6px}
  .do-lex .he{font-family:'Noto Serif Hebrew',serif;font-size:1.7em;line-height:1.2;color:#3a3020}
  .do-lex .lex-tr{font-family:Lora,Georgia,serif;color:#8a6a30;font-size:.95em}
  .do-lex .lex-ru{font-family:Lora,Georgia,serif;font-weight:600;margin:.2em 0 .35em}
  .do-lex .lex-note{margin:.25em 0;line-height:1.55}
  .do-lex .lex-refs{margin:.35em 0 0;font-style:italic;color:#6b5a35;font-size:.92em}
  .do-lex .lex-glyph{display:flex;flex-direction:column;gap:2px;margin-top:.7em;padding-top:.6em;border-top:1px dashed rgba(138,106,31,.25)}
  .do-lex .lex-glyph b{font-family:Lora,Georgia,serif}
  .do-lex .lex-glyph span{line-height:1.5;font-size:.94em}
  .do-sec p{margin:0 0 8px;font:400 13.5px/1.6 Georgia,serif;color:#2b2418}
  .do-bible .verse{display:block;padding:10px 12px;background:rgba(30,58,99,.06);border-left:3px solid #1e3a63;border-radius:6px;font:italic 400 13.5px/1.55 Georgia,serif;color:#1e3a63;margin-bottom:8px}
  .do-bible .verse span{display:block;font:700 9.5px/1 system-ui;letter-spacing:.16em;color:#8a6a1f;margin-top:6px;font-style:normal}
  .do-sec .dispute-block{border:1px solid rgba(138,106,31,.35);border-radius:10px;padding:10px 12px;background:rgba(240,232,210,.5)}
  .do-sec .dispute-title{font:700 11px/1.2 Georgia,serif;letter-spacing:.1em;color:#8a6a1f;margin-bottom:7px}
  .do-sec .dispute-pos{font:400 12.5px/1.55 Georgia,serif;color:#2b2418;margin-bottom:7px}
  .do-sec .conf-med,.do-sec .conf-lo,.do-sec .conf-hi{display:inline-block;font:600 9px/1 system-ui;letter-spacing:.08em;padding:2px 7px;border-radius:999px;background:rgba(138,106,31,.15);color:#7a5c26}
  .do-sec .act-btn{display:none}
  body.dive .dossier{display:none}
  /* position:absolute относительно .wrap (не viewport) — иначе на широких
     экранах кнопки съезжают за реальный правый край листа (обрезаются
     тенью контейнера); top сдвинут ниже розы ветров (компас в SVG кончается
     на ~108px при ширине листа 1500px) — иначе кнопка "Домой" ложится
     поверх компаса */
  .dive-btn{position:absolute;right:10px;top:120px;z-index:21;width:38px;height:38px;border-radius:10px;border:1px solid rgba(138,106,31,.4);background:rgba(246,241,231,.92);color:#7a5c26;font-size:17px;cursor:pointer;box-shadow:0 2px 8px rgba(90,70,30,.2)}
  .home-btn{right:64px}
  .legend-btn{top:166px}
  .legend-pop{position:absolute;right:10px;top:210px;z-index:22;background:rgba(246,241,231,.96);border:1px solid rgba(138,106,31,.4);border-radius:10px;padding:10px 13px;box-shadow:0 4px 14px rgba(90,70,30,.28);font:400 12px/1.5 Georgia,serif;color:#3a3020;max-width:220px}
  .legend-pop b{display:block;font:700 11px/1 Georgia,serif;letter-spacing:.1em;color:#8a6a1f;margin-bottom:8px}
  .legend-pop i{display:flex;align-items:center;gap:8px;font-style:normal}
  .legend-pop span{flex:0 0 20px;height:10px;display:inline-block}
  .legend-pop .lg-route{border-top:2.2px dotted #b0472e}
  .legend-pop .lg-dot{flex-basis:9px;width:9px;height:9px;border-radius:50%;background:#1e3a63;border:1.5px solid #f6f1e7}
  .legend-pop .lg-cand{flex-basis:9px;width:9px;height:9px;border-radius:50%;border:1.4px dashed #8a6a1f}
  .legend-pop .lg-arch{flex-basis:9px;width:8px;height:8px;background:#4e7a52;transform:rotate(45deg)}
  .legend-pop .lg-war{border-top:0;color:#8a6668;font-weight:700}
  .legend-pop .lg-war::before{content:"✕";color:#8a6668}
  .legend-pop .lg-lot{border-top:1.5px dashed #7c93a8}
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
      f: (p.id1 && p.ep1) ? `${p.id1} — ${p.ep1}` : (arch ? arch.slice(0, 180) + (arch.length > 180 ? '…' : '') : (p.lex && p.lex.ru ? p.lex.ru : '')),
      // полное досье для панели (R2); в прод-версии R4 вынести в отдельный fetch
      lex: p.lex || null, glyphs: [p.glyph, p.glyph2].filter(Boolean),
      dossier: {
        story: p.story || '', bible: p.bible || '', arch: p.arch || '',
        dispute: p.dispute || '', bible_extra: p.bible_extra || '',
        photos: (p.photos || []).map(x => ({ src: x.src, thumb: x.thumb, label: x.label || '', credit: x.credit || '' })),
      },
    };
  }
  for (const w of ((route.campaign || {}).places || [])) {
    cards[w.id] = { n: w.name, k: w.kick || 'Быт 14 · поход царей', t: null, tl: '',
      f: w.note || '', lex: w.lex || null, glyphs: [],
      dossier: { story: w.story || '', bible: w.bible || '', arch: w.arch || '', dispute: w.dispute || '', bible_extra: '', photos: [] } };
  }
  const cardsJson = JSON.stringify(cards);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(meta.title)} — лист Атласа (светлый, awaiting G9)</title>
<link rel="stylesheet" href="${opts.fontsHref || '../../fonts/fonts.css'}">
<style>${sheetCss()}
</style>
</head>
<body>
<div class="wrap">${svg}${stageStripHtml}<span class="g9" hidden>${esc(badge)}</span></div>
<script>if (/[?&]dev=1/.test(location.search)) document.querySelector('.g9').hidden = false;</script>
<script>window.ATLAS_SPINE=${spine};window.ATLAS_LAYERS=${JSON.stringify((route.layers || []).map(l => ({ id: l.id, label: l.label, pathLabel: l.pathLabel || `путь ${l.label}` })))};window.ATLAS_PLACES=${cardsJson};window.ATLAS_GLYPHS=${JSON.stringify(GLYPH_META)};window.ATLAS_STAGES=${JSON.stringify((route.stages || []).map(st => ({ n: st.n, t: st.t, d: st.d || '', age: st.age || '', km: st.km || '', r: st.r || '' })))};window.ATLAS_WPS=${JSON.stringify((route.verified_waypoints || []).map(w2 => ({ n: w2.name, role: w2.role || '', note: w2.note || '' })))};window.ATLAS_OVLS=${JSON.stringify((route.overlays || []).map(o2 => ({ label: o2.label || '', story: o2.story || '', refs: o2.refs || '' })))};window.ATLAS_DECOR=${JSON.stringify(DECOR_META)};</script>
<script src="atlas-reader.js"></script>
</body>
</html>`;
}

module.exports = { renderSheet, buildSheetHtml, sheetCss, KM_PER_UNIT, STAGE_TINT, ROMAN };
