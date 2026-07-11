/**
 * render-l1-tribes.mjs — статический SVG развёртки «12 колен Израиля» (L1).
 *
 * Демонстрирует раскрытие сжатой группы L0 в реальные узлы (семантический зум):
 * центр — Иаков, вокруг радиально 12 сыновей в порядке рождения, Иуда (мессианская
 * линия) и Левий (священство) акцентированы. Единый визуальный язык (palette + defs).
 * Детерминированный вывод.
 */
import { PALETTE as C, commonDefs } from './palette.mjs';
import { iconSymbolDefs, ANCHOR_ICON } from './icons.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);
const iconUse = (id, x, y, s, col, op = 1) => id ? `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" color="${col}" opacity="${op}"/>` : '';

// Небольшие тематические иконки колен (по значению имени/благословению Иакова).
const TRIBE_ICON = {
  'Judah@Gen.29.35': 'lion', 'Levi@Gen.29.34': 'temple', 'Joseph@Gen.30.24': 'tribes',
  'Benjamin@Gen.35.18': 'person', 'Reuben@Gen.29.32': 'person',
};

export function renderTribes12Svg(layout, { title, subtitle } = {}) {
  const { bbox, center, sons } = layout;
  title = title ?? layout.title; subtitle = subtitle ?? layout.subtitle;
  const padTop = 150, pad = 70;
  const vbX = bbox.x - pad, vbY = bbox.y - padTop, vbW = bbox.w + pad * 2, vbH = bbox.h + padTop + pad;
  const P = [];
  const cx = n => n.x + n.w / 2, cy = n => n.y + n.h / 2;

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vbX)} ${f(vbY)} ${f(vbW)} ${f(vbH)}" width="${Math.round(vbW)}" height="${Math.round(vbH)}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="${esc(title)}">`);

  // defs
  P.push('<defs>');
  P.push(commonDefs());
  P.push(`<radialGradient id="l1glow" cx="50%" cy="50%" r="60%">
    <stop offset="0%" stop-color="#fff6df" stop-opacity="0.85"/>
    <stop offset="55%" stop-color="#f7eccf" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="#f7eccf" stop-opacity="0"/></radialGradient>`);
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
    const icon = TRIBE_ICON[s.key] ?? 'person';
    P.push(`<g filter="url(#cardShadow)">`);
    P.push(`<rect x="${f(s.x)}" y="${f(s.y)}" width="${f(s.w)}" height="${f(s.h)}" rx="12" fill="url(#cardGrad)" stroke="${s.messianic ? 'url(#goldGrad)' : accent}" stroke-width="${s.messianic ? 2 : 1.3}"/>`);
    P.push(`</g>`);
    // номер рождения — медальон
    P.push(`<circle cx="${f(s.x + 16)}" cy="${f(s.y + 14)}" r="10" fill="${accent}" opacity="0.9"/>`);
    P.push(`<text x="${f(s.x + 16)}" y="${f(s.y + 18)}" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">${s.order}</text>`);
    P.push(iconUse(icon, s.x + 12, cy(s) - 4, 22, accent, 0.9));
    P.push(`<text x="${f(s.x + 40)}" y="${f(cy(s) - 1)}" font-size="15" fill="${C.ink}" font-weight="bold">${esc(s.name)}</text>`);
    P.push(`<text x="${f(s.x + 40)}" y="${f(cy(s) + 14)}" font-size="9.5" fill="${C.inkFaint}">${esc(s.ref ?? '')} · ${esc(s.mother)}</text>`);
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

  // легенда (низ)
  const ly = bbox.y + bbox.h - 6;
  P.push(`<g font-size="12.5">
    <circle cx="${f(-260)}" cy="${f(ly)}" r="5" fill="${C.messianic}"/><text x="${f(-248)}" y="${f(ly + 4)}" fill="${C.inkSoft}">Иуда — мессианская линия</text>
    <circle cx="${f(20)}" cy="${f(ly)}" r="5" fill="${C.priest}"/><text x="${f(32)}" y="${f(ly + 4)}" fill="${C.inkSoft}">Левий — священство</text>
    <circle cx="${f(240)}" cy="${f(ly)}" r="5" fill="${C.patriarch}"/><text x="${f(252)}" y="${f(ly + 4)}" fill="${C.inkSoft}">колена завета</text>
  </g>`);

  P.push('</svg>');
  return P.join('\n');
}
