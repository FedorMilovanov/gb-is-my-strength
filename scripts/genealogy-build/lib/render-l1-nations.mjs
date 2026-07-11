/**
 * render-l1-nations.mjs — SVG архетипа 3 «Народы от Ноя» (Таблица народов, Быт 10).
 *
 * Отступный список-дерево в трёх колонках-ветвях (Иафет · Хам · Сим). Единый визуальный
 * язык (palette + commonDefs), тема-параметризованный. Мессианская нить Сима (до Фалека,
 * «→ Авраам») подсвечена золотом. Детерминированный вывод.
 */
import { getPalette, commonDefs } from './palette.mjs';
import { iconSymbolDefs } from './icons.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);
const iconUse = (id, x, y, s, col, op = 1) => id ? `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" color="${col}" opacity="${op}"/>` : '';

// цвета ветвей: Иафет — море/север (бирюза), Хам — юг/Африка (терракота), Сим — избранный (золото)
const BRANCH = {
  japheth: { col: 'luke', icon: 'globe' },
  ham: { col: 'cainite', icon: 'gate' },
  shem: { col: 'messianic', icon: 'scroll' },
};

export function renderNationsSvg(layout, { title, subtitle, theme = 'light' } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  const bcol = k => C[BRANCH[k].col];
  title = title ?? layout.title; subtitle = subtitle ?? layout.subtitle;
  const { bbox, noah, columns, meta } = layout;

  const padTop = 172, padSide = 76, padBot = 150;
  const vbX = bbox.x - padSide, vbY = bbox.y - padTop;
  const vbW = bbox.w + padSide * 2, vbH = bbox.h + padTop + padBot;
  const cx0 = bbox.x + bbox.w / 2;
  const P = [];

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vbX)} ${f(vbY)} ${f(vbW)} ${f(vbH)}" width="${Math.round(vbW)}" height="${Math.round(vbH)}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="${esc(title)} — Таблица народов Бытие 10">`);

  // defs
  P.push('<defs>');
  P.push(commonDefs(C));
  const glowStops = dark ? { a: '#fff0c8', ao: '0.30', b: '#d8b45f', bo: '0.12' } : { a: '#fff6df', ao: '0.85', b: '#f7eccf', bo: '0.4' };
  P.push(`<radialGradient id="nglow" cx="50%" cy="14%" r="74%">
    <stop offset="0%" stop-color="${glowStops.a}" stop-opacity="${glowStops.ao}"/>
    <stop offset="46%" stop-color="${glowStops.b}" stop-opacity="${glowStops.bo}"/>
    <stop offset="100%" stop-color="${glowStops.b}" stop-opacity="0"/></radialGradient>`);
  const vCol = dark ? '#000000' : '#6a5230', vOp = dark ? '0.4' : '0.12';
  P.push(`<radialGradient id="vignette" cx="50%" cy="40%" r="80%">
    <stop offset="0%" stop-color="${vCol}" stop-opacity="0"/>
    <stop offset="88%" stop-color="${vCol}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${vCol}" stop-opacity="${vOp}"/></radialGradient>`);
  P.push(iconSymbolDefs());
  P.push('</defs>');

  // фон
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" filter="url(#paperTex)" opacity="0.5"/>`);
  P.push(`<ellipse cx="${f(cx0)}" cy="${f(noah.cy + 40)}" rx="${f(vbW * 0.5)}" ry="360" fill="url(#nglow)"/>`);
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" fill="url(#vignette)"/>`);
  P.push(`<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" filter="url(#grain)" opacity="0.6"/>`);

  // заголовок + орнамент
  const titleY = vbY + 78;
  P.push(`<text x="${f(cx0)}" y="${f(titleY)}" text-anchor="middle" font-size="40" fill="${C.ink}" font-weight="bold" letter-spacing="0.5">${esc(title)}</text>`);
  const oy = titleY + 18, ow = 168;
  P.push(`<g stroke="${C.gold}" stroke-width="1" opacity="0.7">
    <line x1="${f(cx0 - ow)}" y1="${f(oy)}" x2="${f(cx0 - 14)}" y2="${f(oy)}"/>
    <line x1="${f(cx0 + 14)}" y1="${f(oy)}" x2="${f(cx0 + ow)}" y2="${f(oy)}"/>
    <path d="M${f(cx0)} ${f(oy - 5)} l6 5 -6 5 -6 -5z" fill="url(#goldGrad)" stroke="none"/></g>`);
  P.push(`<text x="${f(cx0)}" y="${f(titleY + 40)}" text-anchor="middle" font-size="17" fill="${C.gold}" font-style="italic" letter-spacing="1">${esc(subtitle)}</text>`);

  // ── Ной → три ветви (коннекторы под шапками) ──
  for (const col of columns) {
    const h = col.header, hx = h.x + h.w / 2;
    const bc = bcol(col.branch);
    P.push(`<path d="M${f(noah.cx)} ${f(noah.y + noah.h)} C ${f(noah.cx)} ${f(noah.y + noah.h + 42)}, ${f(hx)} ${f(h.y - 44)}, ${f(hx)} ${f(h.y)}" fill="none" stroke="${bc}" stroke-width="2.4" opacity="0.6" stroke-linecap="round"/>`);
  }

  // ── направляющие-дерево (под строками) ──
  for (const col of columns) {
    const bc = bcol(col.branch);
    for (const g of col.guides) {
      const gc = g.messianic ? C.messianic : bc;
      const op = g.messianic ? 0.7 : 0.4;
      const w = g.messianic ? 1.8 : 1.2;
      P.push(`<line x1="${f(g.x1)}" y1="${f(g.y1)}" x2="${f(g.x2)}" y2="${f(g.y2)}" stroke="${gc}" stroke-width="${w}" opacity="${op}" stroke-linecap="round"/>`);
    }
  }

  // ── Ной (золотой якорь) ──
  P.push(`<ellipse cx="${f(noah.cx)}" cy="${f(noah.cy)}" rx="${f(noah.w * 0.95)}" ry="${f(noah.h * 1.25)}" fill="url(#nglow)"/>`);
  P.push(`<g filter="url(#cardShadow)">`);
  P.push(`<rect x="${f(noah.x)}" y="${f(noah.y)}" width="${f(noah.w)}" height="${f(noah.h)}" rx="16" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.2"/>`);
  P.push(`<rect x="${f(noah.x + 3.5)}" y="${f(noah.y + 3.5)}" width="${f(noah.w - 7)}" height="${f(noah.h - 7)}" rx="12.5" fill="none" stroke="${C.goldHi}" stroke-width="0.7" opacity="0.55"/>`);
  P.push(`</g>`);
  P.push(iconUse('ark', noah.x + 16, noah.cy - 15, 30, C.gold));
  P.push(`<text x="${f(noah.x + 56)}" y="${f(noah.cy - 3)}" font-size="22" fill="${C.ink}" font-weight="bold">${esc(noah.ru)}</text>`);
  P.push(`<text x="${f(noah.x + 56)}" y="${f(noah.cy + 16)}" font-size="10.5" fill="${C.gold}" font-style="italic">${esc(noah.sub)}</text>`);

  // ── колонки: шапка-сын + строки ──
  for (const col of columns) {
    const bc = bcol(col.branch);
    const h = col.header, colX = h.x;
    const icon = BRANCH[col.branch].icon;

    // шапка
    P.push(`<g filter="url(#cardShadow)">`);
    P.push(`<rect x="${f(h.x)}" y="${f(h.y)}" width="${f(h.w)}" height="${f(h.h)}" rx="14" fill="url(#cardGrad)" stroke="${h.messianic ? 'url(#goldGrad)' : bc}" stroke-width="${h.messianic ? 2.2 : 1.6}"/>`);
    P.push(`</g>`);
    P.push(`<rect x="${f(h.x)}" y="${f(h.y + 10)}" width="4.5" height="${f(h.h - 20)}" rx="2.5" fill="${bc}" opacity="0.85"/>`);
    P.push(iconUse(icon, h.x + 18, h.y + h.h / 2 - 16, 32, h.messianic ? C.gold : bc, 0.95));
    P.push(`<text x="${f(h.x + 62)}" y="${f(h.y + 30)}" font-size="23" fill="${C.ink}" font-weight="bold">${esc(h.ru)}</text>`);
    if (h.heb) P.push(`<text x="${f(h.x + 62 + h.ru.length * 15 + 14)}" y="${f(h.y + 30)}" font-size="16" fill="${C.inkFaint}" font-family="'Times New Roman', serif">${esc(h.heb)}</text>`);
    P.push(`<text x="${f(h.x + 62)}" y="${f(h.y + 50)}" font-size="11.5" fill="${C.gold}" font-style="italic">${esc(h.gloss)} · ${h.count} народов</text>`);
    P.push(`<text x="${f(h.x + 62)}" y="${f(h.y + 65)}" font-size="10" fill="${C.inkFaint}">${esc(h.region)}</text>`);
    // выравнивание колонок значений
    const identX = colX + 250, refX = colX + h.w - 8;

    // строки
    for (const r of col.rows) {
      const mess = r.messianic;
      const rc = mess ? C.messianic : bc;
      // подсветка мессианской строки
      if (mess) {
        P.push(`<rect x="${f(r.x - 2)}" y="${f(r.y + 1)}" width="${f(r.w + 2)}" height="${f(r.h - 2)}" rx="7" fill="${C.goldGlow}" opacity="${dark ? 0.1 : 0.16}"/>`);
      }
      // маркер строки
      const mx = r.x + 6, my = r.cy;
      if (r.kind === 'person') {
        P.push(`<circle cx="${f(mx)}" cy="${f(my)}" r="3.4" fill="${rc}"/>`);
      } else if (r.id === 'philistines') {
        P.push(`<circle cx="${f(mx)}" cy="${f(my)}" r="3.2" fill="none" stroke="${rc}" stroke-width="1.2" stroke-dasharray="1.4 1.6"/>`);
      } else {
        P.push(`<circle cx="${f(mx)}" cy="${f(my)}" r="3" fill="none" stroke="${rc}" stroke-width="1.3"/>`);
      }
      // имя
      const nameX = r.x + 18;
      P.push(`<text x="${f(nameX)}" y="${f(my + 4.5)}" font-size="13.5" fill="${C.ink}" font-weight="${mess ? 'bold' : '600'}">${esc(r.ru)}</text>`);
      // отождествление (в своей колонке)
      if (r.ident) {
        P.push(`<text x="${f(identX)}" y="${f(my + 4)}" font-size="11" fill="${C.inkSoft}" font-style="italic">${esc(clip(r.ident, 34))}</text>`);
      }
      // ссылка (правый край колонки)
      P.push(`<text x="${f(refX)}" y="${f(my + 4)}" text-anchor="end" font-size="9.5" fill="${C.inkFaint}">${esc(refRu(r.ref))}</text>`);
      // спец-подписи
      if (r.leadsToSpine) {
        const chipX = nameX + r.ru.length * 8.4 + 12;
        P.push(`<g><rect x="${f(chipX)}" y="${f(my - 8)}" width="96" height="16" rx="8" fill="${C.messianic}" opacity="0.16"/><text x="${f(chipX + 10)}" y="${f(my + 3.5)}" font-size="9.5" fill="${C.gold}" font-style="italic">→ к Аврааму</text></g>`);
      } else if (r.id === 'nimrod') {
        const chipX = nameX + r.ru.length * 8.4 + 12;
        P.push(`<text x="${f(chipX)}" y="${f(my + 3.5)}" font-size="9.5" fill="${C.cainite}" font-style="italic">сильный зверолов · Вавилон</text>`);
      }
    }
  }

  // ── подвал: примечание о числе 70 + источник ──
  const fy = bbox.y + bbox.h + 52;
  P.push(`<text x="${f(vbX + padSide)}" y="${f(fy)}" font-size="10" letter-spacing="1.5" fill="${C.inkFaint}">ЧИСЛО НАРОДОВ</text>`);
  const seventy = meta.seventyNote ?? '';
  P.push(wrapText(seventy, vbX + padSide, fy + 18, vbW - padSide * 2, 12.5, C.inkSoft, 4));
  P.push(`<text x="${f(vbX + vbW - padSide)}" y="${f(fy)}" text-anchor="end" font-size="10" fill="${C.inkFaint}" font-style="italic">${esc(meta.source ?? 'Быт 10, Синодальный')}</text>`);

  P.push('</svg>');
  return P.join('\n');
}

function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// Быт 10.2 → Быт 10:2
function refRu(ref) {
  const m = /^Gen\.(\d+)\.(\d+)$/.exec(ref ?? '');
  return m ? `Быт ${m[1]}:${m[2]}` : (ref ?? '');
}

function wrapText(text, x, y, maxW, size, fill, maxLines) {
  const esc2 = esc;
  const words = String(text).split(/\s+/);
  const perChar = size * 0.52;
  const maxChars = Math.floor(maxW / perChar);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.map((ln, i) => `<text x="${f(x)}" y="${f(y + i * (size + 3))}" font-size="${size}" fill="${fill}">${esc2(ln)}</text>`).join('');
}
