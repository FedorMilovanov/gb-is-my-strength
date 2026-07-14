/**
 * render-l1-tribes.mjs — статический SVG развёртки «12 колен Израиля» (L1).
 *
 * Демонстрирует раскрытие сжатой группы L0 в реальные узлы (семантический зум):
 * центр — Иаков, вокруг радиально 12 сыновей в порядке рождения, Иуда (мессианская
 * линия) и Левий (священство) акцентированы. Четыре матери (Лия/Рахиль/Валла/Зелфа)
 * кодируются точкой у имени матери + легендой. Единый визуальный язык (palette +
 * commonDefs), тема-параметризован (свет/ночь). Детерминированный вывод.
 */
import { getPalette, commonDefs } from './palette.mjs';
import { iconSymbolDefs } from './icons.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);
const iconUse = (id, x, y, s, col, op = 1) => id ? `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" color="${col}" opacity="${op}"/>` : '';

// Небольшие тематические иконки колен (по значению имени/благословению Иакова).
const TRIBE_ICON = {
  'Judah@Gen.29.35': 'lion', 'Levi@Gen.29.34': 'temple', 'Joseph@Gen.30.24': 'tribes',
  'Benjamin@Gen.35.18': 'person', 'Reuben@Gen.29.32': 'person',
};

// Четыре матери — приглушённые различимые оттенки (не спорят с семантикой линий).
const MOTHER_COLOR = {
  light: { 'Лия': '#7d8a4e', 'Рахиль': '#9a6a8f', 'Валла': '#5f8fa0', 'Зелфа': '#ab7a50' },
  dark:  { 'Лия': '#a9b877', 'Рахиль': '#c491b8', 'Валла': '#86bcce', 'Зелфа': '#d0a37b' },
};

export function renderTribes12Svg(layout, { title, subtitle, theme = 'light' } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  const MC = MOTHER_COLOR[dark ? 'dark' : 'light'];
  const { bbox, center, sons } = layout;
  title = title ?? layout.title; subtitle = subtitle ?? layout.subtitle;
  const padTop = 150, pad = 70;
  const vbX = bbox.x - pad, vbY = bbox.y - padTop, vbW = bbox.w + pad * 2, vbH = bbox.h + padTop + pad;
  const P = [];
  const cx = n => n.x + n.w / 2, cy = n => n.y + n.h / 2;

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vbX)} ${f(vbY)} ${f(vbW)} ${f(vbH)}" width="${Math.round(vbW)}" height="${Math.round(vbH)}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="${esc(title)}">`);

  // defs
  P.push('<defs>');
  P.push(commonDefs(C));
  // тёмная тема: мягче и с дальним спадом — диск света без границы-«обрыва»
  const gs = dark
    ? { a: '#fff0c8', ao: '0.18', b: '#d8b45f', bo: '0.07', far: '0.02' }
    : { a: '#fff6df', ao: '0.85', b: '#f7eccf', bo: '0.35', far: '0.1' };
  P.push(`<radialGradient id="l1glow" cx="50%" cy="50%" r="60%">
    <stop offset="0%" stop-color="${gs.a}" stop-opacity="${gs.ao}"/>
    <stop offset="50%" stop-color="${gs.b}" stop-opacity="${gs.bo}"/>
    <stop offset="80%" stop-color="${gs.b}" stop-opacity="${gs.far}"/>
    <stop offset="100%" stop-color="${gs.b}" stop-opacity="0"/></radialGradient>`);
  P.push(iconSymbolDefs());
  P.push('</defs>');

  // фон
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" filter="url(#paperTex)" opacity="0.5"/>`);
  P.push(`<ellipse cx="0" cy="0" rx="${f(bbox.w * 0.5)}" ry="${f(bbox.h * 0.5)}" fill="url(#l1glow)"/>`);

  // заголовок
  const titleY = vbY + 74;
  P.push(`<text x="0" y="${f(titleY)}" text-anchor="middle" font-size="38" fill="${C.ink}" font-weight="bold">${esc(title)}</text>`);
  P.push(`<g stroke="${C.gold}" stroke-width="1" opacity="0.7">
    <line x1="-150" y1="${f(titleY + 18)}" x2="-14" y2="${f(titleY + 18)}"/>
    <line x1="14" y1="${f(titleY + 18)}" x2="150" y2="${f(titleY + 18)}"/>
    <path d="M0 ${f(titleY + 13)} l6 5 -6 5 -6 -5z" fill="url(#goldGrad)" stroke="none"/></g>`);
  P.push(`<text x="0" y="${f(titleY + 40)}" text-anchor="middle" font-size="16" fill="${C.gold}" font-style="italic">${esc(subtitle)}</text>`);

  // тонкое направляющее кольцо радиуса (связывает композицию)
  const ringR = Math.hypot(sons[0].cx, sons[0].cy);
  P.push(`<circle cx="0" cy="0" r="${f(ringR)}" fill="none" stroke="${C.gold}" stroke-width="0.8" opacity="0.18" stroke-dasharray="1 6" stroke-linecap="round"/>`);

  // спицы центр→сын (под карточками)
  for (const s of sons) {
    const col = s.messianic ? C.messianic : s.priestly ? C.priest : C.patriarch;
    const w = s.messianic ? 3 : 1.6;
    const op = s.messianic ? 0.9 : s.priestly ? 0.7 : 0.4;
    if (s.messianic) P.push(`<line x1="0" y1="0" x2="${f(s.cx)}" y2="${f(s.cy)}" stroke="${C.goldGlow}" stroke-width="7" opacity="0.4" filter="url(#goldSoft)"/>`);
    P.push(`<line x1="0" y1="0" x2="${f(s.cx)}" y2="${f(s.cy)}" stroke="${col}" stroke-width="${w}" opacity="${op}" stroke-linecap="round"/>`);
  }

  // карточки сыновей
  for (const s of sons) {
    const accent = s.messianic ? C.messianic : s.priestly ? C.priest : C.patriarch;
    const mcol = MC[s.mother] ?? C.inkFaint;
    const icon = TRIBE_ICON[s.key] ?? 'person';
    P.push(`<g filter="url(#cardShadow)">`);
    P.push(`<rect x="${f(s.x)}" y="${f(s.y)}" width="${f(s.w)}" height="${f(s.h)}" rx="12" fill="url(#cardGrad)" stroke="${s.messianic ? 'url(#goldGrad)' : accent}" stroke-width="${s.messianic ? 2 : 1.3}"/>`);
    P.push(`</g>`);
    // номер рождения — медальон
    P.push(`<circle cx="${f(s.x + 16)}" cy="${f(s.y + 14)}" r="10" fill="${accent}" opacity="0.9"/>`);
    P.push(`<text x="${f(s.x + 16)}" y="${f(s.y + 18)}" text-anchor="middle" font-size="11" fill="${dark ? '#1c150c' : '#fff'}" font-weight="bold">${s.order}</text>`);
    P.push(iconUse(icon, s.x + 12, cy(s) - 4, 22, accent, 0.9));
    P.push(`<text x="${f(s.x + 40)}" y="${f(cy(s) - 1)}" font-size="15" fill="${C.ink}" font-weight="bold">${esc(s.name)}</text>`);
    // ссылка + мать (точка цвета матери перед именем матери)
    const subY = cy(s) + 14;
    P.push(`<text x="${f(s.x + 40)}" y="${f(subY)}" font-size="9.5" fill="${C.inkFaint}">${esc(s.ref ?? '')} ·</text>`);
    const refW = ((s.ref ?? '').length + 2) * 5.2;
    P.push(`<circle cx="${f(s.x + 40 + refW + 4)}" cy="${f(subY - 3)}" r="2.6" fill="${mcol}"/>`);
    P.push(`<text x="${f(s.x + 40 + refW + 10)}" y="${f(subY)}" font-size="9.5" fill="${C.inkSoft}">${esc(s.mother)}</text>`);
    // акцентные подписи
    if (s.messianic) P.push(`<text x="${f(cx(s))}" y="${f(s.y + s.h + 15)}" text-anchor="middle" font-size="10.5" fill="${C.messianic}" font-style="italic">→ Мессия</text>`);
    if (s.priestly)  P.push(`<text x="${f(cx(s))}" y="${f(s.y + s.h + 15)}" text-anchor="middle" font-size="10.5" fill="${C.priest}" font-style="italic">священство</text>`);
  }

  // центр — Иаков (сияние + двойная рамка)
  P.push(`<ellipse cx="0" cy="0" rx="${f(center.w)}" ry="${f(center.h)}" fill="url(#l1glow)"/>`);
  P.push(`<g filter="url(#cardShadow)">`);
  P.push(`<rect x="${f(center.x)}" y="${f(center.y)}" width="${f(center.w)}" height="${f(center.h)}" rx="16" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.4"/>`);
  P.push(`<rect x="${f(center.x + 4)}" y="${f(center.y + 4)}" width="${f(center.w - 8)}" height="${f(center.h - 8)}" rx="12" fill="none" stroke="url(#goldGrad)" stroke-width="0.9"/>`);
  P.push(`</g>`);
  P.push(iconUse('ladder', center.x + 18, cy(center) - 15, 30, C.gold));
  P.push(`<text x="${f(center.x + 54)}" y="${f(cy(center) - 2)}" font-size="21" fill="${C.ink}" font-weight="bold">${esc(center.name)}</text>`);
  P.push(`<text x="${f(center.x + 54)}" y="${f(cy(center) + 17)}" font-size="12.5" fill="${C.gold}" font-style="italic">${esc(center.subtitle)}</text>`);

  // легенда: две строки по центру — линии, затем матери
  const ly = bbox.y + bbox.h - 30;
  const row1 = [
    ['Иуда — мессианская линия', C.messianic],
    ['Левий — священство', C.priest],
    ['колена завета', C.patriarch],
  ];
  const w1 = row1.map(it => 16 + it[0].length * 6.6 + 26);
  const tot1 = w1.reduce((a, b) => a + b, 0) - 26;
  let lx = -tot1 / 2;
  for (let i = 0; i < row1.length; i++) {
    P.push(`<circle cx="${f(lx + 5)}" cy="${f(ly)}" r="5" fill="${row1[i][1]}"/>`);
    P.push(`<text x="${f(lx + 16)}" y="${f(ly + 4)}" font-size="12.5" fill="${C.inkSoft}">${esc(row1[i][0])}</text>`);
    lx += w1[i];
  }
  // матери
  const moms = ['Лия', 'Рахиль', 'Валла', 'Зелфа'];
  const lead = 'матери:';
  const w2 = moms.map(m => 12 + m.length * 6.8 + 18);
  const tot2 = lead.length * 6.2 + 12 + w2.reduce((a, b) => a + b, 0) - 18;
  let mx = -tot2 / 2;
  P.push(`<text x="${f(mx)}" y="${f(ly + 25)}" font-size="11.5" fill="${C.inkFaint}" font-style="italic">${lead}</text>`);
  mx += lead.length * 6.2 + 12;
  for (let i = 0; i < moms.length; i++) {
    P.push(`<circle cx="${f(mx + 4)}" cy="${f(ly + 21)}" r="4" fill="${MC[moms[i]]}"/>`);
    P.push(`<text x="${f(mx + 12)}" y="${f(ly + 25)}" font-size="11.5" fill="${C.inkSoft}">${esc(moms[i])}</text>`);
    mx += w2[i];
  }

  P.push('</svg>');
  return P.join('\n');
}
