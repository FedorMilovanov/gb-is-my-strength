/**
 * render-l2-person.mjs — камертон уровня L2 «лица»: личная карточка персоны.
 *
 * Демонстрирует самый глубокий уровень семантического зума: крупная карточка персоны
 * с эмблемой, титулом и коленом; отец сверху и сыновья снизу (с цветами евангельских
 * линий — у Давида расходятся царская Мф и кровная Лк); СТИХ первого упоминания из
 * Синодального текста (данные пайплайна, не хардкод-цитата); чипы эпохи/линии/кластера.
 *
 * Контракт данных — build.mjs собирает из persons.json + SynodalText:
 *   { person:{ru,sub,icon,refRu,tribeRu}, father:{ru,refRu}, sons:[{ru,refRu,line,lineRu}],
 *     verse:{text,refRu}, chips:[{label,kind}], related:[{label,hint}] }
 * Тема-параметризован. Детерминированный вывод.
 */
import { getPalette, commonDefs } from './palette.mjs';
import { iconSymbolDefs } from './icons.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);
const iconUse = (id, x, y, s, col, op = 1) => id ? `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" color="${col}" opacity="${op}"/>` : '';

export function renderPersonL2Svg(data, { theme = 'light' } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  const { person, father, sons = [], verse, chips = [], related = [] } = data;
  const W = 1180, H = 820, cx0 = W / 2;
  const P = [];
  const lineCol = k => (k === 'matthew' ? C.matthew : k === 'luke' ? C.luke : C.messianic);

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="${esc(person.ru)} — личная карточка (L2)">`);
  P.push('<defs>');
  P.push(commonDefs(C));
  const gs = dark
    ? { a: '#fff0c8', ao: '0.16', b: '#d8b45f', bo: '0.06', far: '0.015' }
    : { a: '#fff6df', ao: '0.8', b: '#f7eccf', bo: '0.3', far: '0.08' };
  P.push(`<radialGradient id="l2glow" cx="50%" cy="38%" r="66%">
    <stop offset="0%" stop-color="${gs.a}" stop-opacity="${gs.ao}"/>
    <stop offset="46%" stop-color="${gs.b}" stop-opacity="${gs.bo}"/>
    <stop offset="80%" stop-color="${gs.b}" stop-opacity="${gs.far}"/>
    <stop offset="100%" stop-color="${gs.b}" stop-opacity="0"/></radialGradient>`);
  P.push(iconSymbolDefs());
  P.push('</defs>');

  // фон
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#paperTex)" opacity="0.5"/>`);
  P.push(`<ellipse cx="${cx0}" cy="330" rx="${W * 0.46}" ry="330" fill="url(#l2glow)"/>`);
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#grain)" opacity="0.6"/>`);

  // хлебные крошки + бейдж уровня
  P.push(`<text x="36" y="46" font-size="13" fill="${C.inkFaint}">Обзор</text>
    <text x="86" y="46" font-size="13" fill="${C.inkFaint}">›</text>
    <text x="100" y="46" font-size="13" fill="${C.inkFaint}">Хребет Спасителя</text>
    <text x="232" y="46" font-size="13" fill="${C.inkFaint}">›</text>
    <text x="246" y="46" font-size="13" fill="${C.gold}" font-weight="bold">${esc(person.ru)}</text>`);
  P.push(`<rect x="${W - 132}" y="28" width="96" height="28" rx="14" fill="${dark ? '#2a2011' : '#f7edd4'}" stroke="${C.gold}" stroke-width="1.2"/>
    <text x="${W - 84}" y="47" text-anchor="middle" font-size="12.5" fill="${C.gold}" font-weight="bold">L2 · лица</text>`);

  // ── отец (сверху) ──
  const faW = 250, faH = 64, faX = cx0 - faW / 2, faY = 92;
  if (father) {
    P.push(`<line x1="${cx0}" y1="${faY + faH}" x2="${cx0}" y2="${faY + faH + 62}" stroke="url(#goldGrad)" stroke-width="2.4"/>`);
    P.push(`<g filter="url(#cardShadow)"><rect x="${faX}" y="${faY}" width="${faW}" height="${faH}" rx="13" fill="url(#cardGrad)" stroke="${C.cardBorder}" stroke-width="1.3"/></g>`);
    P.push(iconUse('person', faX + 14, faY + faH / 2 - 12, 24, C.gold, 0.9));
    P.push(`<text x="${faX + 48}" y="${faY + faH / 2 - 2}" font-size="16.5" fill="${C.ink}" font-weight="bold">${esc(father.ru)}</text>`);
    P.push(`<text x="${faX + 48}" y="${faY + faH / 2 + 15}" font-size="10" fill="${C.inkFaint}">отец · ${esc(father.refRu ?? '')}</text>`);
  }

  // ── центральная карточка персоны ──
  const pcW = 460, pcH = 128, pcX = cx0 - pcW / 2, pcY = faY + faH + 62;
  P.push(`<ellipse cx="${cx0}" cy="${pcY + pcH / 2}" rx="${pcW * 0.72}" ry="${pcH * 1.05}" fill="url(#l2glow)"/>`);
  P.push(`<g filter="url(#cardShadow)">`);
  P.push(`<rect x="${pcX}" y="${pcY}" width="${pcW}" height="${pcH}" rx="18" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.4"/>`);
  P.push(`<rect x="${pcX + 4}" y="${pcY + 4}" width="${pcW - 8}" height="${pcH - 8}" rx="14" fill="none" stroke="url(#goldGrad)" stroke-width="0.9"/>`);
  P.push(`</g>`);
  // медальон с эмблемой
  const mdX = pcX + 62, mdY = pcY + pcH / 2;
  P.push(`<circle cx="${mdX}" cy="${mdY}" r="34" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.8"/>`);
  P.push(`<circle cx="${mdX}" cy="${mdY}" r="27" fill="none" stroke="${C.gold}" stroke-width="0.7" opacity="0.5"/>`);
  P.push(iconUse(person.icon ?? 'person', mdX - 17, mdY - 17, 34, C.gold));
  const txX = pcX + 118;
  P.push(`<text x="${txX}" y="${pcY + 52}" font-size="34" fill="${C.ink}" font-weight="bold">${esc(person.ru)}</text>`);
  // имя в оригинале (иврит) — с пунктирным подчёркиванием: у него есть тултип
  if (person.heb) {
    const hx = txX + person.ru.length * 21 + 26;
    P.push(`<text x="${hx}" y="${pcY + 50}" font-size="24" fill="${C.gold}" font-family="'Times New Roman', serif">${esc(person.heb)}</text>`);
    P.push(`<line x1="${hx - 2}" y1="${pcY + 57}" x2="${hx + person.heb.length * 13.5}" y2="${pcY + 57}" stroke="${C.gold}" stroke-width="1" stroke-dasharray="2 3" opacity="0.65"/>`);
  }
  P.push(`<text x="${txX}" y="${pcY + 78}" font-size="14" fill="${C.gold}" font-style="italic">${esc(person.sub ?? '')}</text>`);
  P.push(`<text x="${txX}" y="${pcY + 100}" font-size="11" fill="${C.inkFaint}">${esc(person.tribeRu ?? '')}${person.tribeRu && person.refRu ? ' · ' : ''}первое упоминание: ${esc(person.refRu ?? '')}</text>`);

  // ── ТУЛТИП «имя в оригинале» (макет hover-состояния для движка) ──
  if (person.heb && person.hebMeaning) {
    const tw = 316, th = 118;
    const tx0 = pcX + pcW + 26, ty0 = pcY - 66;
    // указатель к ивритскому имени
    P.push(`<path d="M ${tx0 + 26} ${ty0 + th} L ${tx0 + 8} ${ty0 + th + 26} L ${tx0 + 48} ${ty0 + th - 2} Z" fill="${C.cardTop}" stroke="${C.gold}" stroke-width="1" opacity="0.98"/>`);
    P.push(`<g filter="url(#cardShadow)"><rect x="${tx0}" y="${ty0}" width="${tw}" height="${th}" rx="12" fill="${C.cardTop}" stroke="url(#goldGrad)" stroke-width="1.4" opacity="0.99"/></g>`);
    P.push(`<text x="${tx0 + 18}" y="${ty0 + 32}" font-size="21" fill="${C.gold}" font-family="'Times New Roman', serif">${esc(person.heb)}</text>`);
    P.push(`<text x="${tx0 + 18 + person.heb.length * 12 + 14}" y="${ty0 + 31}" font-size="13" fill="${C.ink}" font-weight="bold">${esc(person.hebTranslit ?? '')}</text>`);
    P.push(`<text x="${tx0 + 18}" y="${ty0 + 56}" font-size="12.5" fill="${C.inkSoft}">значение: <tspan font-style="italic" fill="${C.ink}">${esc(person.hebMeaning)}</tspan></text>`);
    if (person.hebNote) P.push(`<text x="${tx0 + 18}" y="${ty0 + 76}" font-size="10.5" fill="${C.inkFaint}">${esc(person.hebNote)}</text>`);
    P.push(`<text x="${tx0 + 18}" y="${ty0 + th - 14}" font-size="9.5" fill="${C.gold}" font-style="italic">масоретский текст · тултип при наведении на имя</text>`);
  }

  // ── чипы (эпоха/линия/значимость) ──
  let chX = cx0 - chipsWidth(chips) / 2;
  const chY = pcY + pcH + 22;
  for (const ch of chips) {
    const w = ch.label.length * 7.3 + 30;
    const col = ch.kind === 'messianic' ? C.messianic : ch.kind === 'era' ? C.patriarch : C.relation;
    P.push(`<rect x="${f(chX)}" y="${chY}" width="${f(w)}" height="26" rx="13" fill="${col}" opacity="${dark ? 0.16 : 0.12}"/>`);
    P.push(`<rect x="${f(chX)}" y="${chY}" width="${f(w)}" height="26" rx="13" fill="none" stroke="${col}" stroke-width="1" opacity="0.55"/>`);
    P.push(`<circle cx="${f(chX + 14)}" cy="${chY + 13}" r="3.2" fill="${col}"/>`);
    P.push(`<text x="${f(chX + 24)}" y="${chY + 17.5}" font-size="12" fill="${C.inkSoft}">${esc(ch.label)}</text>`);
    chX += w + 12;
  }

  // ── сыновья (снизу; линии расходятся цветами Мф/Лк) ──
  const snW = 250, snH = 72, snY = chY + 78;
  const gap = 190;
  sons.forEach((s, i) => {
    const sX = i === 0 ? cx0 - gap - snW : cx0 + gap;
    const col = lineCol(s.line);
    const scx = sX + snW / 2;
    // коннектор от нижних углов карточки персоны, дугой в обход чипов
    const x0 = cx0 + (i === 0 ? -(pcW / 2 - 70) : (pcW / 2 - 70));
    const cxx = cx0 + (i === 0 ? -340 : 340);
    P.push(`<path d="M${f(x0)} ${pcY + pcH - 4} C ${f(cxx)} ${pcY + pcH + 46}, ${scx} ${snY - 52}, ${scx} ${snY}" fill="none" stroke="${col}" stroke-width="2.2" opacity="0.75" stroke-linecap="round"/>`);
    P.push(`<g filter="url(#cardShadow)"><rect x="${sX}" y="${snY}" width="${snW}" height="${snH}" rx="13" fill="url(#cardGrad)" stroke="${col}" stroke-width="1.5"/></g>`);
    P.push(`<rect x="${sX}" y="${snY + 9}" width="3.5" height="${snH - 18}" rx="2" fill="${col}" opacity="0.8"/>`);
    P.push(iconUse(s.icon ?? 'person', sX + 14, snY + snH / 2 - 11, 22, col, 0.9));
    P.push(`<text x="${sX + 46}" y="${snY + snH / 2 - 4}" font-size="16" fill="${C.ink}" font-weight="bold">${esc(s.ru)}</text>`);
    P.push(`<text x="${sX + 46}" y="${snY + snH / 2 + 14}" font-size="10" fill="${col}" font-style="italic">${esc(s.lineRu ?? '')}</text>`);
    P.push(`<text x="${sX + snW - 10}" y="${snY + snH / 2 + 14}" text-anchor="end" font-size="9" fill="${C.inkFaint}">${esc(s.refRu ?? '')}</text>`);
  });
  if (sons.length === 2) {
    P.push(`<text x="${cx0}" y="${snY + snH / 2 + 4}" text-anchor="middle" font-size="10.5" fill="${C.inkFaint}" font-style="italic">две евангельские линии</text>`);
  }

  // ── стих первого упоминания (Синодальный, из данных) ──
  if (verse?.text) {
    const vW = 700, vX = cx0 - vW / 2, vY = snY + snH + 46;
    const lines = wrap(verse.text, 78);
    const vH = 56 + lines.length * 19;
    P.push(`<g filter="url(#cardShadow)"><rect x="${vX}" y="${vY}" width="${vW}" height="${vH}" rx="13" fill="${C.cardTop}" stroke="${C.cardBorder}" stroke-width="1" opacity="0.97"/></g>`);
    P.push(`<text x="${vX + 22}" y="${vY + 40}" font-size="34" fill="${C.gold}" opacity="0.55" font-family="Georgia, serif">«</text>`);
    lines.forEach((ln, i) => {
      P.push(`<text x="${vX + 52}" y="${vY + 34 + i * 19}" font-size="13" fill="${C.inkSoft}" font-style="italic">${esc(ln)}</text>`);
    });
    P.push(`<text x="${vX + vW - 20}" y="${vY + vH - 16}" text-anchor="end" font-size="11.5" fill="${C.gold}">${esc(verse.refRu)} · Синодальный перевод</text>`);
  }

  // ── связано (правый низ) ──
  if (related.length) {
    let ry = H - 30 - related.length * 24;
    P.push(`<text x="${W - 36}" y="${ry - 10}" text-anchor="end" font-size="10" letter-spacing="1.5" fill="${C.inkFaint}">СВЯЗАНО</text>`);
    for (const r of related) {
      P.push(`<text x="${W - 36}" y="${ry + 6}" text-anchor="end" font-size="12" fill="${C.inkSoft}">${esc(r.label)} <tspan fill="${C.gold}">${esc(r.hint ?? '')}</tspan></text>`);
      ry += 24;
    }
  }

  P.push('</svg>');
  return P.join('\n');
}

function chipsWidth(chips) {
  return chips.reduce((a, ch) => a + ch.label.length * 7.3 + 30 + 12, -12);
}

function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
