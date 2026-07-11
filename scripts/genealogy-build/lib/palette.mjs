/**
 * palette.mjs — единый визуальный язык «Генеалогии Спасителя» (общий для L0/L1/… рендеров).
 * Цвета — тёплый пергамент + золото + линии по родословным (см. референсы владельца).
 */

export const PALETTE = {
  paper0: '#f6eedb', paper1: '#f0e5cb', paperEdge: '#e6d8b8',
  ink: '#3c3120', inkSoft: '#6e5c3d', inkFaint: '#9c8862',
  gold: '#b8933f', goldLo: '#a07d33', goldHi: '#e6c877', goldGlow: '#f0d488',
  cardTop: '#fdf9ef', cardBot: '#f6eeda', cardBorder: '#c8a961',
  megaTop: '#f6efdd', megaBot: '#efe4cb', megaBorder: '#c9b488',
  // родословные линии
  messianic: '#c19a41', matthew: '#7c5ba6', luke: '#3f8a9a', patriarch: '#6f8a4c',
  cainite: '#a0533f', relation: '#b9a06f', priest: '#8a6db0',
};

/** Тёмная тема — тёплый ночной пергамент/кожа, золото сияет, кремовый текст. */
export const PALETTE_DARK = {
  paper0: '#241c11', paper1: '#1b140b', paperEdge: '#100b06',
  ink: '#efe3c6', inkSoft: '#cbb891', inkFaint: '#94815d',
  gold: '#d4af5f', goldLo: '#b8933f', goldHi: '#f2d789', goldGlow: '#f4dc94',
  cardTop: '#2f2617', cardBot: '#251d11', cardBorder: '#836a34',
  megaTop: '#261e12', megaBot: '#1e1710', megaBorder: '#5f4e2b',
  messianic: '#d4af5f', matthew: '#a98cc8', luke: '#5fb0c0', patriarch: '#93b06a',
  cainite: '#c88066', relation: '#c2ab77', priest: '#a98cc8',
};

export const getPalette = theme => (theme === 'dark' ? PALETTE_DARK : PALETTE);

export const ERA_ACCENT = {
  creation: '#8B6914', antediluvian: '#A0734A', flood: '#5A7A8C',
  postdiluvian: '#6B8E4E', patriarchs: '#C4A04A', kings: '#B8743A',
  exile: '#8C6A4A', incarnation: '#C99A3A',
};

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Цвет коннектора кластера к якорю — по смыслу линии. */
export const CLUSTER_LINE = {
  'matthew-1': PALETTE.matthew, 'luke-3': PALETTE.luke,
  'lords-relatives': PALETTE.relation, 'disciples-apostles': PALETTE.luke,
  'antediluvian-patriarchs': PALETTE.patriarch, 'abraham-descendants': PALETTE.patriarch,
  'tribes-12': PALETTE.patriarch, 'levites': PALETTE.patriarch, 'house-of-david': PALETTE.matthew,
  'nations-of-noah': PALETTE.cainite, 'ishmaelites': PALETTE.cainite, 'esau-edom': PALETTE.cainite,
  'priests': PALETTE.patriarch, 'return-from-exile': PALETTE.relation,
};

/** Общие SVG-defs (градиенты/фильтры), разделяемые рендерами уровней. */
export function commonDefs(C = PALETTE) {
  return `
    <linearGradient id="paperGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.paper0}"/><stop offset="55%" stop-color="${C.paper1}"/>
      <stop offset="100%" stop-color="${C.paperEdge}"/></linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.goldHi}"/><stop offset="50%" stop-color="${C.gold}"/>
      <stop offset="100%" stop-color="${C.goldLo}"/></linearGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.cardTop}"/><stop offset="100%" stop-color="${C.cardBot}"/></linearGradient>
    <linearGradient id="megaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.megaTop}"/><stop offset="100%" stop-color="${C.megaBot}"/></linearGradient>
    <filter id="paperTex" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="3" seed="7" stitchTiles="stitch" result="mot"/>
      <feColorMatrix in="mot" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.32  0 0 0 0 0.15  0 0 0 0.06 0"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" stitchTiles="stitch" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.035 0"/></filter>
    <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="2.2" stdDeviation="3.4" flood-color="#4a3616" flood-opacity="0.26"/></filter>
    <filter id="goldSoft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="desat"><feColorMatrix type="saturate" values="0.15"/></filter>`;
}
