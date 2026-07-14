/**
 * render-map-nations.mjs — «Карта расселения народов» (Таблица народов, Быт 10).
 *
 * Стилизованная карта древнего мира в эстетике старинного пергамента: рисованные
 * берега (Средиземное/Чёрное/Каспийское/Чермное моря, Персидский залив), реки
 * (Нил, Евфрат, Тигр), Арарат — исток расселения, Вавилон (Нимрод). Три ветви —
 * мягкие цветовые области-направления: Иафет (север), Хам (юг), Сим (восток).
 *
 * ЧЕСТНОСТЬ: это схема НАПРАВЛЕНИЙ по традиционным отождествлениям, не точная
 * историческая карта — о чём прямо сказано в подписи. Спорные позиции — «(?)».
 * Тема-параметризован. Детерминированный вывод.
 */
import { getPalette, commonDefs } from './palette.mjs';
import { iconSymbolDefs } from './icons.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n, d = 1) => Number(n).toFixed(d);
const iconUse = (id, x, y, s, col, op = 1) => id ? `<use href="#ic-${id}" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" color="${col}" opacity="${op}"/>` : '';

// ── география (стилизованные пути; координаты карты 0..1200 × 0..860) ──
// Средиземное — горизонтальная лента y≈332–566; Анатолия — суша между ним и Чёрным морем.
const SEA_MED = `M 60 520
  C 150 514, 240 516, 330 522 C 380 526, 430 520, 470 526
  C 530 534, 590 538, 636 532
  C 645 528, 649 522, 656 522 C 663 522, 667 528, 673 528
  C 689 524, 700 498, 702 462 C 704 428, 702 396, 695 372
  C 678 352, 640 346, 596 344 C 560 342, 524 344, 492 342 C 464 340, 436 336, 412 338
  C 396 340, 386 332, 383 316 C 380 296, 373 281, 360 275
  C 344 269, 330 275, 325 292 C 320 310, 312 326, 298 333
  C 262 340, 210 342, 160 340 C 122 339, 88 337, 60 334 Z`;
const SEA_BLACK = `M 372 212 C 415 192, 505 183, 580 192 C 645 199, 690 216, 688 238
  C 685 262, 625 276, 550 276 C 480 276, 410 264, 388 240 C 379 230, 370 222, 372 212 Z`;
const SEA_CASPIAN = `M 950 150 C 972 143, 990 152, 995 176 C 1000 208, 995 246, 981 268
  C 968 288, 949 283, 942 258 C 935 232, 934 194, 939 170 C 941 158, 944 152, 950 150 Z`;
const SEA_RED = `M 702 592 C 708 610, 718 636, 732 666 C 751 706, 775 748, 798 784
  L 820 770 C 798 738, 777 702, 759 666 C 742 632, 726 604, 712 586 Z`;
const SEA_GULF = `M 940 660 C 966 672, 1000 692, 1032 714 C 1060 733, 1080 750, 1088 764
  C 1094 776, 1086 784, 1068 776 C 1036 762, 1000 738, 972 714 C 952 696, 936 676, 940 660 Z`;
const ISLE_CYPRUS = `M 606 400 C 622 394, 640 396, 648 404 C 654 411, 644 418, 628 419 C 614 420, 598 412, 606 400 Z`;
const ISLE_CRETE = `M 316 372 C 331 364, 366 364, 378 372 C 366 379, 330 380, 316 372 Z`;
const STRAIT_BOSPORUS = `M 348 282 C 360 270, 372 258, 386 246`;
const RIVER_NILE = `M 653 528 C 649 580, 645 630, 649 680 C 652 720, 647 758, 639 795`;
const RIVER_NILE_D1 = `M 647 530 C 642 521, 636 515, 629 511`;
const RIVER_NILE_D2 = `M 660 530 C 665 521, 672 515, 679 512`;
const RIVER_EUPHRAT = `M 776 306 C 796 332, 822 360, 845 396 C 870 434, 892 472, 907 514 C 919 548, 931 596, 941 658`;
const RIVER_TIGRIS = `M 812 302 C 833 332, 854 366, 872 406 C 890 446, 904 488, 914 530 C 922 566, 931 610, 941 660`;

// области ветвей: мягкие размытые эллипсы-направления (в стороне от воды)
const REGIONS = [
  { branch: 'japheth', blobs: [[520, 315, 270, 50], [298, 306, 70, 44], [640, 100, 210, 48]] },
  { branch: 'ham', blobs: [[555, 672, 225, 115], [733, 460, 48, 72], [688, 782, 118, 48]] },
  { branch: 'shem', blobs: [[875, 480, 175, 110], [885, 715, 195, 95]] },
];

// подписи народов: [x, y, имя, ветвь, спорно] — все на суше (Доданим — у острова)
const NATION_LABELS = [
  [520, 96, 'Гомер', 'japheth'], [650, 80, 'Аскеназ', 'japheth'], [760, 100, 'Магог', 'japheth', true],
  [652, 318, 'Фогарма', 'japheth'], [548, 318, 'Фувал', 'japheth'], [458, 322, 'Мешех', 'japheth'],
  [308, 200, 'Фирас', 'japheth', true], [246, 318, 'Иаван', 'japheth'], [404, 354, 'Доданим', 'japheth'],
  [618, 390, 'Елиса', 'japheth'], [630, 434, 'Киттим', 'japheth'], [1005, 305, 'Мадай', 'japheth'],
  [574, 618, 'Мицраим', 'ham'], [310, 608, 'Фут', 'ham'], [666, 780, 'Куш', 'ham'],
  [730, 446, 'Ханаан', 'ham'], [722, 398, 'Сидон', 'ham'], [706, 520, 'Филистимляне', 'ham'],
  [344, 396, 'Кафторим', 'ham'],
  [788, 332, 'Арам', 'shem'], [862, 346, 'Ассур', 'shem'], [1008, 574, 'Елам', 'shem'],
  [852, 424, 'Арфаксад', 'shem', true], [412, 322, 'Луд', 'shem'],
  [866, 748, 'Иоктан', 'shem'], [832, 800, 'Шева', 'shem'], [964, 800, 'Офир', 'shem', true],
];

export function renderNationsMapSvg({ theme = 'light' } = {}) {
  const C = getPalette(theme);
  const dark = theme === 'dark';
  const bcol = { japheth: C.luke, ham: C.cainite, shem: C.messianic };
  const sea = dark
    ? { fill: '#0d161c', op: 0.5, coast: '#9db4ad', coastOp: 0.42, name: '#7e94a4' }
    : { fill: '#8fb2b8', op: 0.16, coast: '#6e5c3d', coastOp: 0.5, name: '#7c8f96' };
  const riverCol = dark ? '#7e94a4' : '#7c9aa4';

  const W = 1280, H = 1056;
  const MX = 40, MY = 130, MW = 1200, MH = 860; // поле карты (1:1 с координатами географии)
  const P = [];

  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif" role="img" aria-label="Карта расселения народов — Быт 10">`);
  P.push('<defs>');
  P.push(commonDefs(C));
  P.push(`<filter id="regionBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="24"/></filter>`);
  P.push(`<clipPath id="mapField"><rect x="${MX}" y="${MY}" width="${MW}" height="${MH}" rx="10"/></clipPath>`);
  P.push(iconSymbolDefs());
  P.push('</defs>');

  // фон-пергамент
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#paperGrad)"/>`);
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#paperTex)" opacity="0.5"/>`);
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#grain)" opacity="0.6"/>`);

  // заголовок
  const cx0 = W / 2, titleY = 64;
  P.push(`<text x="${cx0}" y="${titleY}" text-anchor="middle" font-size="38" fill="${C.ink}" font-weight="bold" letter-spacing="0.5">Карта расселения народов</text>`);
  P.push(`<g stroke="${C.gold}" stroke-width="1" opacity="0.7">
    <line x1="${cx0 - 168}" y1="${titleY + 16}" x2="${cx0 - 14}" y2="${titleY + 16}"/>
    <line x1="${cx0 + 14}" y1="${titleY + 16}" x2="${cx0 + 168}" y2="${titleY + 16}"/>
    <path d="M${cx0} ${titleY + 11} l6 5 -6 5 -6 -5z" fill="url(#goldGrad)" stroke="none"/></g>`);
  P.push(`<text x="${cx0}" y="${titleY + 38}" text-anchor="middle" font-size="16" fill="${C.gold}" font-style="italic" letter-spacing="1">Иафет — север · Хам — юг · Сим — восток · Быт 10:5,32</text>`);

  // ── поле карты ──
  P.push(`<g clip-path="url(#mapField)">`);
  P.push(`<g transform="translate(${MX} ${MY})">`);

  // области ветвей (под берегами)
  for (const r of REGIONS) {
    const col = bcol[r.branch];
    for (const [bx, by, brx, bry] of r.blobs) {
      P.push(`<ellipse cx="${bx}" cy="${by}" rx="${brx}" ry="${bry}" fill="${col}" opacity="${dark ? 0.15 : 0.11}" filter="url(#regionBlur)"/>`);
    }
  }

  // моря: заливка + двойной берег (гало + линия)
  for (const p of [SEA_MED, SEA_BLACK, SEA_CASPIAN, SEA_RED, SEA_GULF]) {
    P.push(`<path d="${p}" fill="${sea.fill}" fill-opacity="${sea.op}" stroke="none"/>`);
    P.push(`<path d="${p}" fill="none" stroke="${sea.coast}" stroke-width="3.6" opacity="0.09"/>`);
    P.push(`<path d="${p}" fill="none" stroke="${sea.coast}" stroke-width="1.5" opacity="${sea.coastOp}"/>`);
  }
  // острова
  for (const p of [ISLE_CYPRUS, ISLE_CRETE]) {
    P.push(`<path d="${p}" fill="url(#paperGrad)" stroke="${sea.coast}" stroke-width="1.3" opacity="0.9"/>`);
  }
  P.push(`<circle cx="392" cy="356" r="4.5" fill="none" stroke="${sea.coast}" stroke-width="1.2" opacity="0.7"/>`);
  for (const [ix, iy, ir] of [[344, 300, 2.6], [352, 318, 2.3], [332, 316, 2.2], [356, 284, 2]]) {
    P.push(`<circle cx="${ix}" cy="${iy}" r="${ir}" fill="${sea.coast}" opacity="0.45"/>`);
  }
  // пролив + реки
  P.push(`<path d="${STRAIT_BOSPORUS}" fill="none" stroke="${riverCol}" stroke-width="1.6" opacity="0.5"/>`);
  for (const p of [RIVER_NILE, RIVER_NILE_D1, RIVER_NILE_D2, RIVER_EUPHRAT, RIVER_TIGRIS]) {
    P.push(`<path d="${p}" fill="none" stroke="${riverCol}" stroke-width="1.6" opacity="0.55" stroke-linecap="round"/>`);
  }

  // подписи морей/рек
  P.push(`<text x="400" y="448" font-size="17" fill="${sea.name}" font-style="italic" letter-spacing="3" opacity="0.85">Великое море</text>`);
  P.push(`<text x="748" y="682" font-size="12" fill="${sea.name}" font-style="italic" letter-spacing="1.5" opacity="0.8" transform="rotate(60 748 682)">Чермное море</text>`);
  P.push(`<text x="662" y="662" font-size="11.5" fill="${riverCol}" font-style="italic" opacity="0.8" transform="rotate(87 662 662)">Нил</text>`);
  P.push(`<text x="834" y="380" font-size="11.5" fill="${riverCol}" font-style="italic" opacity="0.8" transform="rotate(52 834 380)">Евфрат</text>`);
  P.push(`<text x="886" y="442" font-size="11.5" fill="${riverCol}" font-style="italic" opacity="0.8" transform="rotate(62 886 442)">Тигр</text>`);

  // большие имена ветвей (в свободной суше, не на воде)
  const BR = [['ИАФЕТ', 240, 130, 'japheth'], ['ХАМ', 415, 706, 'ham'], ['СИМ', 806, 630, 'shem']];
  for (const [t, bx, by, br] of BR) {
    P.push(`<text x="${bx}" y="${by}" text-anchor="middle" font-size="30" fill="${bcol[br]}" font-weight="bold" letter-spacing="7" opacity="0.6">${t}</text>`);
  }

  // подписи народов
  for (const [nx, ny, name, br, disp] of NATION_LABELS) {
    const col = bcol[br];
    P.push(`<circle cx="${nx - 7}" cy="${ny - 4}" r="2.6" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.85"/>`);
    P.push(`<text x="${nx}" y="${ny}" font-size="12.5" fill="${col}" font-weight="600" opacity="0.95">${esc(name)}${disp ? ' (?)' : ''}</text>`);
  }

  // Арарат (исток) + Вавилон (Нимрод)
  P.push(iconUse('mountain', 762, 226, 26, C.gold, 0.95));
  P.push(`<text x="798" y="244" font-size="13" fill="${C.gold}" font-weight="bold">Арарат</text>`);
  P.push(`<text x="798" y="258" font-size="9.5" fill="${C.inkFaint}" font-style="italic">исход расселения · Быт 8:4</text>`);
  P.push(`<circle cx="898" cy="496" r="4" fill="${C.cainite}"/>`);
  P.push(`<circle cx="898" cy="496" r="7.5" fill="none" stroke="${C.cainite}" stroke-width="1" opacity="0.5"/>`);
  P.push(`<text x="910" y="493" font-size="13" fill="${C.cainite}" font-weight="bold">Вавилон</text>`);
  P.push(`<text x="910" y="507" font-size="9.5" fill="${C.inkFaint}" font-style="italic">Нимрод · Быт 10:10 · 11:1–9</text>`);

  // Фарсис — стрелка на дальний запад
  P.push(`<line x1="248" y1="428" x2="96" y2="428" stroke="${bcol.japheth}" stroke-width="1.4" stroke-dasharray="3 5" opacity="0.75"/>`);
  P.push(`<path d="M 104 422 L 92 428 L 104 434" fill="none" stroke="${bcol.japheth}" stroke-width="1.4" opacity="0.75"/>`);
  P.push(`<text x="130" y="420" font-size="12" fill="${bcol.japheth}" font-weight="600">Фарсис (?)</text>`);
  P.push(`<text x="130" y="444" font-size="9.5" fill="${C.inkFaint}" font-style="italic">далёкий запад · Тартесс?</text>`);

  P.push('</g>'); // translate
  P.push('</g>'); // clip

  // рамка поля (двойная, как у старинных карт)
  P.push(`<rect x="${MX}" y="${MY}" width="${MW}" height="${MH}" rx="10" fill="none" stroke="url(#goldGrad)" stroke-width="1.8"/>`);
  P.push(`<rect x="${MX + 6}" y="${MY + 6}" width="${MW - 12}" height="${MH - 12}" rx="7" fill="none" stroke="${C.gold}" stroke-width="0.7" opacity="0.45"/>`);

  // роза ветров (в поле, правый верх)
  const rx0 = MX + MW - 92, ry0 = MY + 86;
  P.push(`<g stroke="${C.gold}" fill="none" opacity="0.85">
    <circle cx="${rx0}" cy="${ry0}" r="26" stroke-width="0.8" opacity="0.5"/>
    <circle cx="${rx0}" cy="${ry0}" r="3" fill="url(#goldGrad)" stroke="none"/>
    <path d="M ${rx0} ${ry0 - 34} L ${rx0 + 6} ${ry0 - 8} L ${rx0} ${ry0 - 2} L ${rx0 - 6} ${ry0 - 8} Z" fill="url(#goldGrad)" stroke="none"/>
    <path d="M ${rx0} ${ry0 + 34} L ${rx0 + 6} ${ry0 + 8} L ${rx0} ${ry0 + 2} L ${rx0 - 6} ${ry0 + 8} Z" fill="${C.gold}" fill-opacity="0.45" stroke="none"/>
    <path d="M ${rx0 - 34} ${ry0} L ${rx0 - 8} ${ry0 - 6} L ${rx0 - 2} ${ry0} L ${rx0 - 8} ${ry0 + 6} Z" fill="${C.gold}" fill-opacity="0.45" stroke="none"/>
    <path d="M ${rx0 + 34} ${ry0} L ${rx0 + 8} ${ry0 - 6} L ${rx0 + 2} ${ry0} L ${rx0 + 8} ${ry0 + 6} Z" fill="${C.gold}" fill-opacity="0.45" stroke="none"/></g>`);
  P.push(`<text x="${rx0}" y="${ry0 - 40}" text-anchor="middle" font-size="11" fill="${C.inkSoft}" font-weight="bold">С</text>`);

  // картуш-легенда (левый низ поля)
  const lx = MX + 22, lyB = MY + MH - 88;
  P.push(`<g filter="url(#cardShadow)"><rect x="${lx}" y="${lyB}" width="330" height="66" rx="10" fill="url(#cardGrad)" stroke="${C.cardBorder}" stroke-width="1" opacity="0.97"/></g>`);
  const chips = [['Иафет · север/острова', bcol.japheth], ['Хам · юг/Африка', bcol.ham], ['Сим · восток/Аравия', bcol.shem]];
  chips.forEach((c, i) => {
    const cyR = lyB + 16 + i * 17;
    P.push(`<circle cx="${lx + 16}" cy="${cyR}" r="4.5" fill="${c[1]}"/>`);
    P.push(`<text x="${lx + 27}" y="${cyR + 4}" font-size="11.5" fill="${C.inkSoft}">${esc(c[0])}</text>`);
  });

  // честная подпись
  P.push(`<text x="${MX + MW - 16}" y="${MY + MH + 34}" text-anchor="end" font-size="11.5" fill="${C.inkFaint}" font-style="italic">Стилизованная схема направлений по традиционным отождествлениям — не точная историческая карта. Спорное — «(?)».</text>`);
  P.push(`<text x="${MX + 16}" y="${MY + MH + 34}" font-size="11.5" fill="${C.inkFaint}">«От сих населились острова народов в землях их…» — Быт 10:5</text>`);

  P.push('</svg>');
  return P.join('\n');
}
