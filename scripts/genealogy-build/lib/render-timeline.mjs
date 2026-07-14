/**
 * render-timeline.mjs — камертон «Шкала времени» (консервативная хронология).
 *
 * Горизонтальная линейка AM «от Адама» (МТ/Ашшер) с цветными полосами эпох и
 * вехами-якорями из chronology.json + СРАВНИТЕЛЬНАЯ дорожка LXX (выровнена по
 * Рождеству: видно, что шкала Септуагинты длиннее ВЛЕВО, ~5500 до Р.Х.).
 * Вилки (disputed) — двойная засечка. Позиция проекта — в подвале, честно.
 *
 * Тема-параметризован. Детерминированный вывод. Данные — только chronology.json.
 */
import { getPalette, commonDefs, ERA_ACCENT } from './palette.mjs';
import { iconSymbolDefs } from './icons.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);

// приближённые LXX-позиции ключевых вех (византийская эра, схематично):
// Потоп ~2262 AM-LXX, Авраам ~3312 AM-LXX, Рождество ~5500 AM-LXX
const LXX = { total: 5500, flood: 2262, abraham: 3312, label: 'LXX (визант. эра ≈5508)' };

export function renderTimelineSvg(chrono, { theme = 'light' } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  const W = 1560, H = 640;
  const P = [];

  const AM_MAX = 4040;
  const X0 = 90, X1 = W - 90, SPAN = X1 - X0;
  // единый масштаб лет/пиксель задаёт БОЛЕЕ ДЛИННАЯ шкала (LXX = вся ширина);
  // обе дорожки выровнены по Рождеству справа → МТ короче, LXX длиннее ВЛЕВО
  const pxPerYear = SPAN / LXX.total;
  const mtX0 = X1 - AM_MAX * pxPerYear;
  const mtX = am => mtX0 + Number(am) * pxPerYear;
  const barY = 250, barH = 26;
  const lxxY = 420, lxxX1 = X1, lxxX0 = X0;
  const lxxX = amLxx => lxxX1 - (LXX.total - amLxx) * pxPerYear;

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="Шкала времени — консервативная хронология родословий">`);
  P.push('<defs>');
  P.push(commonDefs(C));
  P.push(iconSymbolDefs());
  P.push('</defs>');
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#paperTex)" opacity="0.5"/>`);
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#grain)" opacity="0.6"/>`);

  // заголовок
  P.push(`<text x="${W / 2}" y="56" text-anchor="middle" font-size="30" fill="${C.ink}" font-weight="bold">Шкала времени родословий</text>`);
  P.push(`<text x="${W / 2}" y="82" text-anchor="middle" font-size="14" fill="${C.gold}" font-style="italic">AM — лет от Адама · масоретский текст (Ашшер) · сравнение с Септуагинтой</text>`);

  // ── дорожка МТ: полосы эпох (короче LXX, выровнена по Рождеству справа) ──
  P.push(`<text x="${f(mtX0)}" y="${barY - 128}" font-size="12" letter-spacing="1.5" fill="${C.inkFaint}">МАСОРЕТСКИЙ ТЕКСТ · 0 → ${AM_MAX} AM (≈4004 → 4 до Р.Х.)</text>`);
  for (const sp of chrono.eraSpans ?? []) {
    const col = ERA_ACCENT[sp.id] ?? C.relation;
    const x = mtX(sp.amFrom), w = Math.max(2, (sp.amTo - sp.amFrom) * pxPerYear);
    P.push(`<rect x="${f(x)}" y="${barY}" width="${f(w)}" height="${barH}" fill="${col}" opacity="${dark ? 0.5 : 0.38}"/>`);
  }
  P.push(`<rect x="${f(mtX0)}" y="${barY}" width="${f(AM_MAX * pxPerYear)}" height="${barH}" rx="4" fill="none" stroke="url(#goldGrad)" stroke-width="1.4"/>`);
  // тики каждые 500 AM
  for (let am = 0; am <= 4000; am += 500) {
    const x = mtX(am);
    P.push(`<line x1="${f(x)}" y1="${barY + barH}" x2="${f(x)}" y2="${barY + barH + 8}" stroke="${C.inkFaint}" stroke-width="1"/>`);
    P.push(`<text x="${f(x)}" y="${barY + barH + 22}" text-anchor="middle" font-size="10" fill="${C.inkFaint}">${am}</text>`);
  }

  // вехи-якоря (подписи в шахматном порядке над полосой)
  const anchors = (chrono.anchors ?? []).filter(a => ['creation', 'flood', 'babel', 'abraham-birth', 'exodus', 'david-king', 'temple', 'exile', 'nativity'].includes(a.id));
  anchors.forEach((a, i) => {
    const am = Number(String(a.am).replace(/[^\d.]/g, ''));
    const x = mtX(am);
    const lvl = i % 3;                                  // три яруса подписей (без коллизий)
    const ly = barY - 18 - lvl * 40;
    const col = a.disputed ? C.cainite : C.gold;
    // засечка (вилка — двойная)
    P.push(`<line x1="${f(x)}" y1="${f(ly + 6)}" x2="${f(x)}" y2="${barY}" stroke="${col}" stroke-width="1.1" opacity="0.65"/>`);
    P.push(`<path d="M${f(x)} ${barY - 7} l4.2 6 -4.2 6 -4.2 -6z" fill="${col}" stroke="${C.paper0}" stroke-width="0.8"/>`);
    if (a.disputed) P.push(`<path d="M${f(x + 6)} ${barY - 5} l3.4 4.8 -3.4 4.8 -3.4 -4.8z" fill="none" stroke="${col}" stroke-width="1"/>`);
    P.push(`<text x="${f(x)}" y="${f(ly - 8)}" text-anchor="middle" font-size="12" fill="${C.ink}" font-weight="bold">${esc(a.labelRu)}${a.disputed ? ' *' : ''}</text>`);
    P.push(`<text x="${f(x)}" y="${f(ly + 5)}" text-anchor="middle" font-size="9.5" fill="${C.inkSoft}">${esc(String(a.am))} AM · ${esc(a.bc)} до Р.Х.</text>`);
  });

  // ── сравнительная дорожка LXX (выровнена по Рождеству) ──
  P.push(`<text x="${X0}" y="${lxxY - 16}" font-size="12" letter-spacing="1.5" fill="${C.inkFaint}">СЕПТУАГИНТА (схематично) · шкала длиннее влево · ${esc(LXX.label)}</text>`);
  // полоса LXX (вся ширина); участок «раньше Сотворения по МТ» — штриховой
  P.push(`<rect x="${f(lxxX0)}" y="${lxxY}" width="${f(lxxX1 - lxxX0)}" height="16" rx="3" fill="${C.luke}" opacity="${dark ? 0.35 : 0.22}"/>`);
  P.push(`<rect x="${f(lxxX0)}" y="${lxxY}" width="${f(Math.max(0, mtX0 - lxxX0))}" height="16" fill="none" stroke="${C.luke}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`);
  P.push(`<rect x="${f(lxxX0)}" y="${lxxY}" width="${f(lxxX1 - lxxX0)}" height="16" rx="3" fill="none" stroke="${C.luke}" stroke-width="1.1" opacity="0.6"/>`);
  // вехи LXX
  const lxxMarks = [
    [0, 'Сотворение', '≈5500 до Р.Х.'],
    [LXX.flood, 'Потоп', `≈${LXX.flood} AM-LXX`],
    [LXX.abraham, 'Авраам', `≈${LXX.abraham} AM-LXX (+Каинан)`],
    [LXX.total, 'Рождество', 'выровнено'],
  ];
  for (const [am, lbl, sub] of lxxMarks) {
    const x = lxxX(am);
    P.push(`<line x1="${f(x)}" y1="${lxxY - 5}" x2="${f(x)}" y2="${lxxY + 21}" stroke="${C.luke}" stroke-width="1.2" opacity="0.8"/>`);
    P.push(`<text x="${f(x)}" y="${lxxY + 38}" text-anchor="middle" font-size="10.5" fill="${C.inkSoft}">${esc(lbl)}</text>`);
    P.push(`<text x="${f(x)}" y="${lxxY + 52}" text-anchor="middle" font-size="9" fill="${C.inkFaint}">${esc(sub)}</text>`);
  }
  // связка выравнивания по Рождеству
  P.push(`<line x1="${X1}" y1="${barY + barH}" x2="${X1}" y2="${lxxY}" stroke="${C.gold}" stroke-width="1" stroke-dasharray="2 4" opacity="0.6"/>`);
  // скобка разницы: от начала LXX до начала МТ (выше заголовка дорожки)
  P.push(`<path d="M ${f(lxxX0)} ${lxxY - 44} L ${f(mtX0)} ${lxxY - 44}" stroke="${C.cainite}" stroke-width="1.1" opacity="0.75"/>`);
  P.push(`<path d="M ${f(lxxX0 + 10)} ${lxxY - 49} L ${f(lxxX0)} ${lxxY - 44} L ${f(lxxX0 + 10)} ${lxxY - 39}" fill="none" stroke="${C.cainite}" stroke-width="1.1" opacity="0.75"/>`);
  P.push(`<line x1="${f(mtX0)}" y1="${lxxY - 49}" x2="${f(mtX0)}" y2="${lxxY - 39}" stroke="${C.cainite}" stroke-width="1.1" opacity="0.75"/>`);
  P.push(`<text x="${f((lxxX0 + mtX0) / 2)}" y="${lxxY - 52}" text-anchor="middle" font-size="10.5" fill="${C.cainite}">≈ +1460 лет длиннее (допотопные +100 каждому · Каинан +130)</text>`);

  // ── подвал: позиция и свидетели ──
  const fy = H - 78;
  P.push(`<text x="${X0}" y="${fy}" font-size="11" letter-spacing="1.5" fill="${C.inkFaint}">ПОЗИЦИЯ ПРОЕКТА</text>`);
  P.push(`<text x="${X0}" y="${fy + 20}" font-size="12.5" fill="${C.inkSoft}">Консервативная (младоземельная): возраст творения — ТЫСЯЧИ лет (по МТ ≈6 тыс.), не миллионы; зазоры поколений — человеческие.</text>`);
  P.push(`<text x="${X0}" y="${fy + 40}" font-size="12.5" fill="${C.inkSoft}">Датировки — вычисления по родословиям (Ашшер; Седер Олам: 3761 до Р.Х.); * — вилки внутри консервативного лагеря; расхождения МТ/LXX/Самаритянского — текстология, показываем честно.</text>`);
  P.push(`<text x="${X1}" y="${fy + 40}" text-anchor="end" font-size="10.5" fill="${C.inkFaint}" font-style="italic">chronology.json · Быт 5; 11; Исх 12:40; 3Цар 6:1</text>`);

  P.push('</svg>');
  return P.join('\n');
}
