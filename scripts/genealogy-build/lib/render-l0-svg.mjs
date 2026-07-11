/**
 * render-l0-svg.mjs — статический SVG-превью обзорной раскладки «Генеалогии Спасителя»
 * в пергаментном стиле референсов владельца. НЕ движок (движок Phase 3) — это (1)
 * визуальная санитарная проверка цепи данные→layout→картинка и (2) семя статического
 * SEO/print-слоя (engine-contract §8). Детерминированный вывод.
 *
 * Стиль: светлый пергамент, золотой центральный хребет, боковые кластеры-«таблетки»
 * со счётчиками «+N имён», подписи эпох. Одна тема (light) — превью; продакшн-движок
 * поддержит обе.
 */

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const C = {
  bg1: '#f5efe1', bg2: '#efe6d3', ink: '#3f3320', inkSoft: '#6b5a3c',
  gold: '#c39a3f', goldSoft: '#d8b060', line: '#c8b89a',
  megaBorder: '#cabfa0', megaBg: '#faf5ea', era: '#8a7a55',
};

const ERA_COLORS = {
  creation: '#8B6914', antediluvian: '#A0734A', flood: '#5A7A8C',
  postdiluvian: '#6B8E4E', patriarchs: '#C4A04A', kings: '#B8743A',
  exile: '#8C6A4A', incarnation: '#D4A857',
};

export function renderL0Svg(layout, { title = 'Генеалогия Спасителя', subtitle = 'От Адама до Христа Спасителя' } = {}) {
  const { bbox, nodes, edges, eraBands } = layout;
  const padTop = 150, padLeft = 210;   // место под заголовок и колонку эпох
  const vbX = bbox.x - padLeft, vbY = bbox.y - padTop;
  const vbW = bbox.w + padLeft + 60, vbH = bbox.h + padTop + 60;
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const cx = n => n.x + n.w / 2, cy = n => n.y + n.h / 2;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${Math.round(vbW)}" height="${Math.round(vbH)}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="${esc(title)} — обзорная схема L0">`);

  // фон + виньетка
  parts.push(`<defs>
    <radialGradient id="parch" cx="50%" cy="18%" r="90%">
      <stop offset="0%" stop-color="${C.bg1}"/><stop offset="100%" stop-color="${C.bg2}"/>
    </radialGradient>
    <linearGradient id="goldline" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.goldSoft}"/><stop offset="100%" stop-color="${C.gold}"/>
    </linearGradient>
    <filter id="soft"><feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#000" flood-opacity="0.16"/></filter>
  </defs>`);
  parts.push(`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="url(#parch)"/>`);

  // полосы эпох (слева) + подписи
  const eraX = vbX + 18, eraW = 168;
  for (const b of eraBands) {
    const col = ERA_COLORS[b.id] ?? C.era;
    parts.push(`<rect x="${eraX}" y="${b.y0.toFixed(1)}" width="${eraW}" height="${Math.max(2, b.y1 - b.y0).toFixed(1)}" fill="${col}" opacity="0.08"/>`);
    parts.push(`<rect x="${eraX}" y="${b.y0.toFixed(1)}" width="4" height="${Math.max(2, b.y1 - b.y0).toFixed(1)}" fill="${col}" opacity="0.5"/>`);
    parts.push(`<text x="${eraX + 14}" y="${(b.y0 + 20).toFixed(1)}" font-size="15" fill="${C.era}" opacity="0.85">${esc(b.label)}</text>`);
  }

  // заголовок
  const titleY = vbY + 60;
  parts.push(`<text x="${bbox.x + bbox.w / 2}" y="${titleY}" text-anchor="middle" font-size="34" fill="${C.ink}" font-weight="bold">${esc(title)}</text>`);
  parts.push(`<text x="${bbox.x + bbox.w / 2}" y="${titleY + 30}" text-anchor="middle" font-size="16" fill="${C.gold}" font-style="italic">${esc(subtitle)}</text>`);

  // непрерывная золотая мессианская нить по центру (за узлами хребта) — сигнатура
  const spineNodes = nodes.filter(n => n.kind === 'spine');
  if (spineNodes.length > 1) {
    const first = spineNodes[0], last = spineNodes[spineNodes.length - 1];
    parts.push(`<line x1="${cx(first)}" y1="${cy(first)}" x2="${cx(last)}" y2="${cy(last)}" stroke="url(#goldline)" stroke-width="6" stroke-linecap="round" opacity="0.55"/>`);
  }

  // рёбра
  for (const e of edges) {
    const a = nodeById.get(e.from), b = nodeById.get(e.to);
    if (!a || !b) continue;
    if (e.kind === 'golden') {
      parts.push(`<line x1="${cx(a)}" y1="${a.y + a.h}" x2="${cx(b)}" y2="${b.y}" stroke="url(#goldline)" stroke-width="4" stroke-linecap="round"/>`);
    } else {
      // связка кластер→якорь: мягкая дуга-ортолиния
      const mx = (cx(a) + cx(b)) / 2;
      parts.push(`<path d="M ${cx(a)} ${cy(a)} C ${mx} ${cy(a)}, ${mx} ${cy(b)}, ${cx(b)} ${cy(b)}" fill="none" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="2 5" opacity="0.7"/>`);
    }
  }

  // узлы
  for (const n of nodes) {
    if (n.kind === 'spine') {
      parts.push(`<g filter="url(#soft)">`);
      parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="#fffaf0" stroke="${C.gold}" stroke-width="2"/>`);
      parts.push(`<text x="${cx(n)}" y="${cy(n) - 2}" text-anchor="middle" font-size="19" fill="${C.ink}" font-weight="bold">${esc(n.label)}</text>`);
      if (n.am != null) parts.push(`<text x="${cx(n)}" y="${cy(n) + 17}" text-anchor="middle" font-size="11" fill="${C.inkSoft}">AM ${n.am}</text>`);
      parts.push(`</g>`);
    } else {
      parts.push(`<g filter="url(#soft)">`);
      parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10" fill="${C.megaBg}" stroke="${C.megaBorder}" stroke-width="1.5"/>`);
      parts.push(`<text x="${cx(n)}" y="${n.y + 30}" text-anchor="middle" font-size="15" fill="${C.ink}" font-weight="bold">${esc(n.label)}</text>`);
      parts.push(`<text x="${cx(n)}" y="${n.y + 52}" text-anchor="middle" font-size="13" fill="${C.gold}">+${n.count} имён</text>`);
      parts.push(`</g>`);
    }
  }

  // легенда
  const lx = bbox.x + bbox.w - 220, ly = bbox.y + bbox.h + 4;
  parts.push(`<g font-size="12" fill="${C.inkSoft}">
    <line x1="${lx}" y1="${ly}" x2="${lx + 24}" y2="${ly}" stroke="url(#goldline)" stroke-width="4"/>
    <text x="${lx + 32}" y="${ly + 4}">Мессианская линия (хребет)</text>
    <line x1="${lx}" y1="${ly + 20}" x2="${lx + 24}" y2="${ly + 20}" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="2 5"/>
    <text x="${lx + 32}" y="${ly + 24}">Связь кластера с линией</text>
  </g>`);

  parts.push(`</svg>`);
  return parts.join('\n');
}
