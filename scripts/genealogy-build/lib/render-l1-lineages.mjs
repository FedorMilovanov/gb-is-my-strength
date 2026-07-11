/**
 * render-l1-lineages.mjs — SVG колоночной развёртки «Матфей 1 / Лука 3» (L1).
 *
 * Две родословные Христа рядом, сходятся ко Христу. Единый визуальный язык (palette).
 * Матфей — пурпур (царская), Лука — бирюза (кровная), общие узлы и хребет — золото.
 * Детерминированный вывод.
 */
import { getPalette, commonDefs } from './palette.mjs';
import { iconSymbolDefs } from './icons.mjs';
import { christDefs, christHalo } from './christ-halo.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);
const iconUse = (id, x, y, s, col, op = 1) => id ? `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" color="${col}" opacity="${op}"/>` : '';

export function renderMatthewLukeSvg(layout, { title, subtitle, theme = 'light' } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  const COL = { mt: C.matthew, lk: C.luke };
  const { bbox, nodes } = layout;
  title = title ?? layout.title; subtitle = subtitle ?? layout.subtitle;
  const padTop = 150, padSide = 70, padBot = 250;
  const vbX = bbox.x - padSide, vbY = bbox.y - padTop;
  const vbW = bbox.w + padSide * 2, vbH = bbox.h + padTop + padBot;
  const P = [];
  const cx = n => n.x + n.w / 2, cy = n => n.y + n.h / 2;
  const byRow = new Map();
  for (const n of nodes) { if (!byRow.has(n.row)) byRow.set(n.row, {}); byRow.get(n.row)[n.kind] = n; }
  const rows = [...byRow.keys()].sort((a, b) => a - b);

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vbX)} ${f(vbY)} ${f(vbW)} ${f(vbH)}" width="${Math.round(vbW)}" height="${Math.round(vbH)}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="${esc(title)}">`);
  P.push('<defs>');
  P.push(commonDefs(C));
  // тёмная тема: мягче и с дальним спадом — без границы-«обрыва» у купола
  const gs = dark
    ? { a: '#fff0c8', ao: '0.18', b: '#d8b45f', bo: '0.07', far: '0.02' }
    : { a: '#fff6df', ao: '0.9', b: '#f7eccf', bo: '0.35', far: '0.1' };
  P.push(`<radialGradient id="l1glow" cx="50%" cy="92%" r="70%">
    <stop offset="0%" stop-color="${gs.a}" stop-opacity="${gs.ao}"/>
    <stop offset="45%" stop-color="${gs.b}" stop-opacity="${gs.bo}"/>
    <stop offset="78%" stop-color="${gs.b}" stop-opacity="${gs.far}"/>
    <stop offset="100%" stop-color="${gs.b}" stop-opacity="0"/></radialGradient>`);
  P.push(christDefs(C, dark));
  P.push(iconSymbolDefs());
  P.push('</defs>');
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" filter="url(#paperTex)" opacity="0.5"/>`);
  const lastN = nodes.find(n => n.messiah);
  if (lastN) P.push(`<ellipse cx="0" cy="${f(cy(lastN))}" rx="${f(vbW * 0.4)}" ry="240" fill="url(#l1glow)"/>`);

  // заголовок
  const titleY = vbY + 70;
  P.push(`<text x="0" y="${f(titleY)}" text-anchor="middle" font-size="36" fill="${C.ink}" font-weight="bold">${esc(title)}</text>`);
  P.push(`<text x="0" y="${f(titleY + 28)}" text-anchor="middle" font-size="15" fill="${C.gold}" font-style="italic">${esc(subtitle)}</text>`);
  // ярлыки колонок
  const topMt = rows.map(r => byRow.get(r).mt).find(Boolean);
  const topLk = rows.map(r => byRow.get(r).lk).find(Boolean);
  if (topMt) P.push(`<text x="${f(cx(topMt))}" y="${f(topMt.y - 16)}" text-anchor="middle" font-size="16" fill="${C.matthew}" font-weight="bold">Матфей 1 · царская</text>`);
  if (topLk) P.push(`<text x="${f(cx(topLk))}" y="${f(topLk.y - 16)}" text-anchor="middle" font-size="16" fill="${C.luke}" font-weight="bold">Лука 3 · кровная</text>`);

  // ── коннекторы (под узлами) ──
  const nodeAt = (row, kind) => byRow.get(row)?.[kind];
  const centerColOf = row => byRow.get(row).center ?? byRow.get(row).shared;
  // вертикальные связи внутри колонок + через центр/общие
  const connect = (a, b, col, wdt = 2, dash = '') => {
    if (!a || !b) return;
    P.push(`<path d="M${f(cx(a))} ${f(a.y + a.h)} C ${f(cx(a))} ${f(a.y + a.h + 26)}, ${f(cx(b))} ${f(b.y - 26)}, ${f(cx(b))} ${f(b.y)}" fill="none" stroke="${col}" stroke-width="${wdt}"${dash} opacity="0.72" stroke-linecap="round"/>`);
  };
  // строим последовательность по колонкам, «перепрыгивая» центр/общие узлы
  const seqMt = [], seqLk = [];
  for (const r of rows) {
    const c = centerColOf(r);
    if (c) { seqMt.push(c); seqLk.push(c); }
    if (nodeAt(r, 'mt')) seqMt.push(nodeAt(r, 'mt'));
    if (nodeAt(r, 'lk')) seqLk.push(nodeAt(r, 'lk'));
  }
  for (let i = 0; i + 1 < seqMt.length; i++) connect(seqMt[i], seqMt[i + 1], C.matthew, seqMt[i + 1]?.messiah || seqMt[i]?.kind === 'center' ? 2.4 : 2);
  for (let i = 0; i + 1 < seqLk.length; i++) connect(seqLk[i], seqLk[i + 1], C.luke, 2);
  // «=» между колонками на общих рядах уже покрыто shared-узлом (центр)

  // ── узлы ──
  for (const n of nodes) P.push(renderNode(n));

  // ── врезка-пояснение (по центру под Христом, чтобы не перекрывать колонки) ──
  const jn = nodes.find(n => n.messiah);
  const bw = 430, bh = 128;
  const bxL = -bw / 2, byT = (jn ? jn.y + jn.h : bbox.y + bbox.h) + 46;
  P.push(`<g>
    <rect x="${f(bxL)}" y="${f(byT)}" width="${bw}" height="${bh}" rx="12" fill="${C.cardTop}" stroke="${C.cardBorder}" stroke-width="1" opacity="0.97" filter="url(#cardShadow)"/>
    <text x="${f(bxL + 18)}" y="${f(byT + 24)}" font-size="12.5" fill="${C.ink}" font-weight="bold">Ключ к двум линиям</text>
    ${layout.notes.map((t, i) => `<circle cx="${f(bxL + 22)}" cy="${f(byT + 42 + i * 21)}" r="2" fill="${C.gold}"/><text x="${f(bxL + 32)}" y="${f(byT + 46 + i * 21)}" font-size="10.5" fill="${C.inkSoft}">${esc(t)}</text>`).join('')}
  </g>`);

  P.push('</svg>');
  return P.join('\n');

  function renderNode(n) {
    if (n.ellipsis) {
      return `<text x="${f(cx(n))}" y="${f(cy(n) + 6)}" text-anchor="middle" font-size="22" fill="${C.inkFaint}" letter-spacing="2">···</text>
        <text x="${f(cx(n))}" y="${f(cy(n) + 22)}" text-anchor="middle" font-size="9" fill="${C.inkFaint}" font-style="italic">${esc(n.name === '…' ? 'поколения' : n.name)}</text>`;
    }
    const g = [];
    if (n.kind === 'center' && n.messiah) return renderChrist(n);
    if (n.kind === 'center' || n.kind === 'shared') {
      const badge = n.kind === 'shared' ? 'обе линии' : (n.sub ?? '');
      g.push(`<g filter="url(#cardShadow)"><rect x="${f(n.x)}" y="${f(n.y)}" width="${f(n.w)}" height="${f(n.h)}" rx="14" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2"/></g>`);
      if (n.icon) g.push(iconUse(n.icon, n.x + 14, cy(n) - 12, 24, C.gold));
      const tx = n.icon ? n.x + 44 : cx(n);
      const anchor = n.icon ? 'start' : 'middle';
      g.push(`<text x="${f(tx)}" y="${f(cy(n) - 1)}" text-anchor="${anchor}" font-size="17" fill="${C.ink}" font-weight="bold">${esc(n.name)}</text>`);
      g.push(`<text x="${f(tx)}" y="${f(cy(n) + 15)}" text-anchor="${anchor}" font-size="10" fill="${C.gold}" font-style="italic">${esc(badge)}${n.ref ? ' · ' + esc(n.ref) : ''}</text>`);
      return g.join('');
    }
    // колоночная карточка (mt/lk)
    const col = COL[n.kind];
    g.push(`<g filter="url(#cardShadow)"><rect x="${f(n.x)}" y="${f(n.y)}" width="${f(n.w)}" height="${f(n.h)}" rx="11" fill="url(#cardGrad)" stroke="${n.disputed ? C.cainite : col}" stroke-width="${n.disputed ? 1.8 : 1.2}"/></g>`);
    g.push(`<rect x="${f(n.x)}" y="${f(n.y + 7)}" width="3" height="${f(n.h - 14)}" rx="1.5" fill="${col}" opacity="0.8"/>`);
    if (n.icon) g.push(iconUse(n.icon, n.x + 11, cy(n) - 10, 20, col, 0.9));
    const tx = n.icon ? n.x + 38 : n.x + 14;
    g.push(`<text x="${f(tx)}" y="${f(cy(n) - 2)}" font-size="14" fill="${C.ink}" font-weight="bold">${esc(n.name)}</text>`);
    g.push(`<text x="${f(tx)}" y="${f(cy(n) + 13)}" font-size="9" fill="${C.inkFaint}">${esc(n.sub ? n.sub + ' · ' : '')}${esc(n.ref ?? '')}</text>`);
    if (n.disputed) {
      g.push(`<circle cx="${f(n.x + n.w - 12)}" cy="${f(n.y + 12)}" r="9" fill="${C.cainite}"/><text x="${f(n.x + n.w - 12)}" y="${f(n.y + 16)}" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">?</text>`);
      if (n.note) g.push(`<text x="${f(cx(n))}" y="${f(n.y + n.h + 13)}" text-anchor="middle" font-size="9.5" fill="${C.cainite}" font-style="italic">${esc(n.note)}</text>`);
    } else if (n.note) {
      g.push(`<text x="${f(cx(n))}" y="${f(n.y + n.h + 13)}" text-anchor="middle" font-size="9.5" fill="${C.gold}" font-style="italic">${esc(n.note)}</text>`);
    }
    return g.join('');
  }

  function renderChrist(n) {
    const g = [];
    // глубокая ауреола: блум + корона лучей + крестчатый нимб + кольцо + искры
    g.push(christHalo(cx(n), cy(n), Math.max(n.w * 0.5, n.h * 1.05), C, 0.74, dark));
    g.push(`<g filter="url(#cardShadow)"><rect x="${f(n.x)}" y="${f(n.y)}" width="${f(n.w)}" height="${f(n.h)}" rx="16" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.4"/><rect x="${f(n.x + 4)}" y="${f(n.y + 4)}" width="${f(n.w - 8)}" height="${f(n.h - 8)}" rx="12" fill="none" stroke="url(#goldGrad)" stroke-width="0.9"/></g>`);
    g.push(iconUse('cross', n.x + 16, cy(n) - 14, 28, C.gold));
    g.push(`<text x="${f(n.x + 50)}" y="${f(cy(n) - 1)}" font-size="19" fill="${C.ink}" font-weight="bold">${esc(n.name)}</text>`);
    g.push(`<text x="${f(n.x + 50)}" y="${f(cy(n) + 16)}" font-size="11.5" fill="${C.gold}" font-style="italic">${esc(n.sub ?? '')}</text>`);
    return g.join('');
  }
}
