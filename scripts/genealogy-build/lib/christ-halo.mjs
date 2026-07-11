/**
 * christ-halo.mjs — глубокая божественная ауреола Христа (общая для L0/L1).
 *
 * Слои (снизу вверх): мягкий блум → корона лучей-лепестков (длинные/короткие
 * чередуются) → крестчатый нимб (традиционный атрибут Христа) → внутреннее золотое
 * кольцо → искры-звёзды на кончиках. Заменяет плоские 16 прямых лучей («костыль»).
 * Детерминированный вывод.
 */
const f = (n, d = 1) => Number(n).toFixed(d);

/** Градиенты ауреолы — включить в <defs> рендера. */
export function christDefs(C) {
  return `
    <radialGradient id="christBloom" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.goldGlow}" stop-opacity="0.55"/>
      <stop offset="38%" stop-color="${C.goldHi}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${C.goldHi}" stop-opacity="0"/></radialGradient>
    <linearGradient id="christRay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.goldHi}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${C.goldGlow}" stop-opacity="0"/></linearGradient>
    <radialGradient id="christCore" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff7e2" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="${C.goldGlow}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${C.goldGlow}" stop-opacity="0"/></radialGradient>`;
}

/**
 * Разметка ауреолы вокруг (cx,cy). R — базовый радиус; sy — вертикальное сжатие
 * (карточка Христа шире высоты → эллиптическая корона). Рисовать ДО карточки.
 */
export function christHalo(cx, cy, R, C, sy = 0.72) {
  const g = [];
  const P = (x, y) => `${f(x)} ${f(y)}`;
  const pt = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy];

  // 1) мягкий блум (два эллипса) + тёплое ядро
  g.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(R * 2.15)}" ry="${f(R * 2.15 * sy)}" fill="url(#christBloom)"/>`);
  g.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(R * 1.15)}" ry="${f(R * 1.05 * sy)}" fill="url(#christCore)"/>`);

  // 2) корона: лучи-лепестки, длинные/короткие чередуются
  const N = 32;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const long = i % 2 === 0;
    const r1 = R * 0.82, r2 = long ? R * 1.78 : R * 1.2;
    const dth = long ? 0.03 : 0.021;
    const [tx, ty] = pt(a, r2);
    const [b1x, b1y] = pt(a - dth, r1);
    const [b2x, b2y] = pt(a + dth, r1);
    g.push(`<path d="M${P(b1x, b1y)} L${P(tx, ty)} L${P(b2x, b2y)} Z" fill="url(#christRay)" opacity="${long ? 0.6 : 0.34}"/>`);
  }

  // 3) крестчатый нимб — 4 усиленных луча (⊤ ⊣ ⊥ ⊢), традиционный атрибут Христа
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const r1 = R * 0.8, r2 = R * 2.02, dth = 0.055;
    const [tx, ty] = pt(a, r2);
    const [b1x, b1y] = pt(a - dth, r1);
    const [b2x, b2y] = pt(a + dth, r1);
    g.push(`<path d="M${P(b1x, b1y)} L${P(tx, ty)} L${P(b2x, b2y)} Z" fill="url(#christRay)" opacity="0.7"/>`);
  }

  // 4) внутреннее золотое кольцо (нимб)
  g.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(R * 0.9)}" ry="${f(R * 0.9 * sy)}" fill="none" stroke="${C.goldHi}" stroke-width="1.3" opacity="0.55"/>`);

  // 5) искры-звёздочки на кончиках крестчатых лучей
  for (const a of [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4]) {
    const [sx, sy2] = pt(a, R * 1.55);
    g.push(sparkle(sx, sy2, 3.4, C.goldHi));
  }
  return g.join('');
}

function sparkle(x, y, s, col) {
  return `<path d="M${f(x)} ${f(y - s)} L${f(x + s * 0.28)} ${f(y - s * 0.28)} L${f(x + s)} ${f(y)} L${f(x + s * 0.28)} ${f(y + s * 0.28)} L${f(x)} ${f(y + s)} L${f(x - s * 0.28)} ${f(y + s * 0.28)} L${f(x - s)} ${f(y)} L${f(x - s * 0.28)} ${f(y - s * 0.28)} Z" fill="${col}" opacity="0.8"/>`;
}
