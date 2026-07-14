/**
 * render-morph-frames.mjs — пре-виз FLIP-морфа «сжатая группа → развёртка» (Phase 2).
 *
 * Три ключевых кадра семантического зума на примере «12 колен Израиля»:
 *   0 мс — L0: якорь Иаков + мега-карточка группы с веером точек;
 *   ~220 мс — переход: карточка группы растворяется, точки веера ЛЕТЯТ к позициям
 *             будущих карточек (лерп 60%), карточки проявляются призраками;
 *   450 мс — L1: радиальная развёртка (мини-версия реального layout-l1).
 *
 * Это визуальное ТЗ аниматору движка: та же геометрия, что в проде (радиус/порядок/
 * цвета), плюс подписи фаз и easing. Тема-параметризован. Детерминированный вывод.
 */
import { getPalette, commonDefs } from './palette.mjs';
import { iconSymbolDefs } from './icons.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);
const iconUse = (id, x, y, s, col, op = 1) => id ? `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" color="${col}" opacity="${op}"/>` : '';

const SONS = ['Рувим', 'Симеон', 'Левий', 'Иуда', 'Дан', 'Неффалим', 'Гад', 'Асир', 'Иссахар', 'Завулон', 'Иосиф', 'Вениамин'];
const R_MINI = 148, SON_W = 92, SON_H = 30;

export function renderMorphFramesSvg({ theme = 'light' } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  const W = 1560, H = 760;
  const P = [];
  const centers = [270, 780, 1290];
  const midY = 400;

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="FLIP-морф раскрытия группы — три кадра">`);
  P.push('<defs>');
  P.push(commonDefs(C));
  P.push(iconSymbolDefs());
  P.push('</defs>');

  // фон
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#paperTex)" opacity="0.5"/>`);
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#grain)" opacity="0.6"/>`);

  // заголовок
  P.push(`<text x="${W / 2}" y="58" text-anchor="middle" font-size="30" fill="${C.ink}" font-weight="bold">Семантический зум: раскрытие группы</text>`);
  P.push(`<text x="${W / 2}" y="84" text-anchor="middle" font-size="14" fill="${C.gold}" font-style="italic">FLIP-морф «12 колен Израиля» · 450 мс · cubic-bezier(0.22, 1, 0.36, 1)</text>`);

  // фазовые подписи и стрелки таймлайна
  const phase = ['Сжато · L0', 'Переход · ~220 мс', 'Раскрыто · L1'];
  centers.forEach((cxp, i) => {
    P.push(`<text x="${cxp}" y="132" text-anchor="middle" font-size="15" fill="${C.inkSoft}" font-weight="bold" letter-spacing="1">${esc(phase[i])}</text>`);
  });
  for (const [x1, x2] of [[centers[0] + 218, centers[1] - 218], [centers[1] + 218, centers[2] - 218]]) {
    P.push(`<line x1="${x1}" y1="${midY}" x2="${x2 - 10}" y2="${midY}" stroke="${C.gold}" stroke-width="1.6" opacity="0.6" stroke-dasharray="4 5"/>`);
    P.push(`<path d="M ${x2 - 12} ${midY - 6} L ${x2} ${midY} L ${x2 - 12} ${midY + 6}" fill="none" stroke="${C.gold}" stroke-width="1.6" opacity="0.7" stroke-linecap="round"/>`);
  }

  // радиальные целевые позиции (мини-версия layout-l1: старт сверху, по часовой)
  const pos = i => {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    return [Math.cos(a) * R_MINI, Math.sin(a) * R_MINI, a];
  };
  const accent = i => (SONS[i] === 'Иуда' ? C.messianic : SONS[i] === 'Левий' ? C.priest : C.patriarch);

  // ── кадр 1: сжато ──
  P.push(frame1(centers[0], midY, C, dark));
  // ── кадр 2: переход (лерп 0.6) ──
  P.push(frame2(centers[1], midY, C, dark, pos, accent));
  // ── кадр 3: раскрыто ──
  P.push(frame3(centers[2], midY, C, dark, pos, accent));

  // аннотации фаз (низ)
  const notes = [
    'Мега-карточка группы и веер точек — компактное представление; счётчик «+12 имён» обещает содержимое.',
    'Карточка растворяется; точки веера летят к позициям карточек (FLIP: First-Last-Invert-Play); призраки карточек проявляются.',
    'Радиальная развёртка L1: те же данные, тот же порядок рождения; Иуда и Левий сохраняют акценты.',
  ];
  centers.forEach((cxp, i) => {
    P.push(wrapText(notes[i], cxp - 205, 662, 410, 12, C.inkSoft, 4, 'middle', cxp));
  });

  P.push('</svg>');
  return P.join('\n');

  // кадр 1: якорь + мега + веер
  function frame1(cxp, cyp, C2, dark2) {
    const g = [];
    const jw = 150, jh = 52, jx = cxp - 170, jy = cyp - jh / 2;
    const mw = 178, mh = 52, mx0 = cxp + 10, my0 = cyp - mh / 2;
    // связка
    g.push(`<line x1="${jx + jw}" y1="${cyp}" x2="${mx0}" y2="${cyp}" stroke="${C2.patriarch}" stroke-width="1.6" opacity="0.6"/>`);
    // Иаков
    g.push(`<g filter="url(#cardShadow)"><rect x="${jx}" y="${jy}" width="${jw}" height="${jh}" rx="12" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.8"/></g>`);
    g.push(iconUse('ladder', jx + 12, cyp - 11, 22, C2.gold));
    g.push(`<text x="${jx + 42}" y="${cyp - 1}" font-size="14.5" fill="${C2.ink}" font-weight="bold">Иаков</text>`);
    g.push(`<text x="${jx + 42}" y="${cyp + 14}" font-size="9.5" fill="${C2.gold}" font-style="italic">Израиль</text>`);
    // мега-карточка
    g.push(`<g filter="url(#cardShadow)"><rect x="${mx0}" y="${my0}" width="${mw}" height="${mh}" rx="12" fill="url(#megaGrad)" stroke="${C2.megaBorder}" stroke-width="1.3"/></g>`);
    g.push(`<rect x="${mx0}" y="${my0 + 8}" width="3.5" height="${mh - 16}" rx="2" fill="${C2.patriarch}" opacity="0.75"/>`);
    g.push(iconUse('tribes', mx0 + 12, cyp - 11, 22, C2.patriarch, 0.9));
    g.push(`<text x="${mx0 + 42}" y="${cyp - 2}" font-size="12.5" fill="${C2.ink}" font-weight="bold">12 колен Израиля</text>`);
    g.push(`<text x="${mx0 + 42}" y="${cyp + 14}" font-size="10.5" fill="${C2.gold}">+12 имён</text>`);
    // веер точек вправо
    const ox = mx0 + mw, rings = [22, 40, 58, 76];
    rings.forEach((r, ri) => {
      const cnt = 3 + ri;
      for (let j = 0; j < cnt; j++) {
        const a = 0.95 * ((cnt === 1 ? 0 : j / (cnt - 1)) - 0.5);
        g.push(`<circle cx="${f(ox + Math.cos(a) * r)}" cy="${f(cyp + Math.sin(a) * r)}" r="${f(2.4 - ri * 0.3)}" fill="${C2.patriarch}" opacity="${f(0.42 - ri * 0.08, 2)}"/>`);
      }
    });
    return g.join('');
  }

  // кадр 2: переход — точки летят, призраки проявляются
  function frame2(cxp, cyp, C2, dark2, pos2, accent2) {
    const g = [];
    const t = 0.6; // прогресс лерпа
    // растворяющаяся мега-карточка (в центре, масштаб 0.9, прозрачная)
    const mw = 160, mh = 47;
    g.push(`<g opacity="0.22"><rect x="${cxp - mw / 2}" y="${cyp - mh / 2}" width="${mw}" height="${mh}" rx="11" fill="url(#megaGrad)" stroke="${C2.megaBorder}" stroke-width="1.2"/></g>`);
    g.push(`<text x="${cxp}" y="${cyp + 4}" text-anchor="middle" font-size="11" fill="${C2.inkFaint}" opacity="0.5">12 колен…</text>`);
    // спицы-призраки
    for (let i = 0; i < 12; i++) {
      const [tx, ty] = pos2(i);
      g.push(`<line x1="${cxp}" y1="${cyp}" x2="${f(cxp + tx * t)}" y2="${f(cyp + ty * t)}" stroke="${accent2(i)}" stroke-width="1" opacity="0.22"/>`);
    }
    // летящие точки (лерп от веера-происхождения к целям) + призрачные карточки в целях
    for (let i = 0; i < 12; i++) {
      const [tx, ty] = pos2(i);
      // происхождение — компактный пучок правее центра (где был веер)
      const sx = 60 + (i % 4) * 10, sy0 = -18 + Math.floor(i / 4) * 18;
      const px = cxp + sx + (tx - sx) * t, py = cyp + sy0 + (ty - sy0) * t;
      g.push(`<circle cx="${f(px)}" cy="${f(py)}" r="3" fill="${accent2(i)}" opacity="0.85"/>`);
      g.push(`<circle cx="${f(px)}" cy="${f(py)}" r="6.5" fill="${accent2(i)}" opacity="0.18"/>`);
      // призрак карточки в целевой позиции
      g.push(`<rect x="${f(cxp + tx - SON_W / 2)}" y="${f(cyp + ty - SON_H / 2)}" width="${SON_W}" height="${SON_H}" rx="8" fill="url(#cardGrad)" stroke="${accent2(i)}" stroke-width="1" opacity="0.3"/>`);
    }
    return g.join('');
  }

  // кадр 3: раскрытая мини-развёртка
  function frame3(cxp, cyp, C2, dark2, pos2, accent2) {
    const g = [];
    g.push(`<circle cx="${cxp}" cy="${cyp}" r="${R_MINI}" fill="none" stroke="${C2.gold}" stroke-width="0.7" opacity="0.16" stroke-dasharray="1 5"/>`);
    for (let i = 0; i < 12; i++) {
      const [tx, ty] = pos2(i);
      const col = accent2(i);
      const mess = SONS[i] === 'Иуда';
      g.push(`<line x1="${cxp}" y1="${cyp}" x2="${f(cxp + tx)}" y2="${f(cyp + ty)}" stroke="${col}" stroke-width="${mess ? 2.2 : 1.2}" opacity="${mess ? 0.85 : 0.4}"/>`);
    }
    for (let i = 0; i < 12; i++) {
      const [tx, ty] = pos2(i);
      const col = accent2(i);
      const mess = SONS[i] === 'Иуда';
      const bx = cxp + tx - SON_W / 2, by = cyp + ty - SON_H / 2;
      g.push(`<g filter="url(#cardShadow)"><rect x="${f(bx)}" y="${f(by)}" width="${SON_W}" height="${SON_H}" rx="8" fill="url(#cardGrad)" stroke="${mess ? 'url(#goldGrad)' : col}" stroke-width="${mess ? 1.8 : 1.1}"/></g>`);
      g.push(`<text x="${f(cxp + tx)}" y="${f(cyp + ty + 4)}" text-anchor="middle" font-size="11" fill="${C2.ink}" font-weight="${mess ? 'bold' : '600'}">${esc(SONS[i])}</text>`);
    }
    // центр Иаков
    const jw = 110, jh = 40;
    g.push(`<g filter="url(#cardShadow)"><rect x="${cxp - jw / 2}" y="${cyp - jh / 2}" width="${jw}" height="${jh}" rx="10" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.8"/></g>`);
    g.push(`<text x="${cxp}" y="${cyp + 4}" text-anchor="middle" font-size="13" fill="${C2.ink}" font-weight="bold">Иаков</text>`);
    return g.join('');
  }
}

function wrapText(text, x, y, maxW, size, fill, maxLines, anchor = 'start', anchorX = null) {
  const words = String(text).split(/\s+/);
  const maxChars = Math.floor(maxW / (size * 0.52));
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const ax = anchor === 'middle' ? anchorX : x;
  return lines.map((ln, i) => `<text x="${f(ax)}" y="${f(y + i * (size + 5))}" text-anchor="${anchor}" font-size="${size}" fill="${fill}">${ln.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</text>`).join('');
}
