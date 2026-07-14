/**
 * atlas-reader.js — тонкий интерактивный слой «читалки» поверх листа Атласа (R1, §14).
 *
 * Лист (SVG из sheet-engine) остаётся полноэкранным и самодостаточным; читалка
 * добавляет: зум/пан (колесо, drag, pinch), корешок с обложками карт,
 * клик по этапу ленты → плавный фокус к вехе, кнопка «погружение»
 * (прячет всё, остаётся чистый лист). Никакой правки листа — только слой.
 */
'use strict';
(function () {
  const svg = document.getElementById('sheet-svg');
  if (!svg) return;
  const vb0 = (svg.getAttribute('data-vb') || svg.getAttribute('viewBox')).split(/\s+/).map(Number);
  let vb = vb0.slice();
  // Zoom-HUD: фурнитура листа (шкала/роза) растворяется на зуме, но масштаб и
  // направление должны оставаться доступными — компактная экранная шкала
  const kmPerUnit = parseFloat(svg.getAttribute('data-km-per-unit')) || 1;
  const hud = document.createElement('div');
  hud.className = 'zoom-hud';
  hud.innerHTML = '<span class="zh-north">С&thinsp;↑</span><span class="zh-bar"></span><span class="zh-km"></span>';
  hud.hidden = true;
  (document.querySelector('.wrap') || document.body).appendChild(hud);
  const updateHud = (zoomed) => {
    hud.hidden = !zoomed;
    if (!zoomed) return;
    // прижать к нижнему краю КАРТЫ (в .wrap ниже лежит строка этапов)
    const wrapR = hud.parentElement.getBoundingClientRect();
    const svgR = svg.getBoundingClientRect();
    hud.style.bottom = Math.max(14, Math.round(wrapR.bottom - svgR.bottom) + 14) + 'px';
    const pxPerUnit = svgR.width / vb[2];
    const pxPerKm = pxPerUnit / kmPerUnit;
    // подобрать «круглую» длину шкалы под ~60–140 px
    const steps = [500, 200, 100, 50, 25, 10, 5];
    let km = steps.find(s => s * pxPerKm <= 140) || 5;
    hud.querySelector('.zh-bar').style.width = Math.round(km * pxPerKm) + 'px';
    hud.querySelector('.zh-km').textContent = km + ' км';
  };
  const apply = () => {
    svg.setAttribute('viewBox', vb.map(n => n.toFixed(1)).join(' '));
    // на зуме растворяем паспарту/фурнитуру — вблизи остаётся чистая карта
    const zoomed = Math.abs(vb[2] - vb0[2]) > vb0[2] * 0.04 || Math.abs(vb[0] - vb0[0]) > vb0[2] * 0.04;
    svg.classList.toggle('zoomed', zoomed);
    // семантический зум: подписи и точки не растут с картой (LOD-ступени)
    const zf = vb0[2] / vb[2];
    svg.classList.toggle('z2', zf >= 1.6 && zf < 3.1);
    svg.classList.toggle('z3', zf >= 3.1 && zf < 5.5);
    svg.classList.toggle('z4', zf >= 5.5);
    updateHud(zoomed);
    cullEdgeLabels(zoomed);
  };

  // viewport-culling крупных подписей (AV-036): если региональный/морской
  // заголовок обрезан краем карты и виден меньше порога — прячем целиком,
  // чтобы у края не оставались случайные 1-3 буквы огромного слова
  const bigLabels = [...svg.querySelectorAll('text.region-label, text.sea-label, text.region-he')]
    .filter(t => parseFloat(t.getAttribute('font-size') || 0) >= 9);
  const cullEdgeLabels = (zoomed) => {
    if (!zoomed) { bigLabels.forEach(t => t.style.visibility = ''); return; }
    const v = svg.getBoundingClientRect();
    for (const t of bigLabels) {
      const b = t.getBoundingClientRect();
      if (!b.width) { t.style.visibility = ''; continue; }
      const ix = Math.max(0, Math.min(b.right, v.right) - Math.max(b.left, v.left));
      const iy = Math.max(0, Math.min(b.bottom, v.bottom) - Math.max(b.top, v.top));
      const visible = (ix * iy) / (b.width * b.height);
      t.style.visibility = visible < 0.6 ? 'hidden' : '';
    }
  };

  // ── Зум/пан ────────────────────────────────────────────────────────────────
  const clampZoom = () => {
    const minW = vb0[2] / 8, maxW = vb0[2] * 1.15;
    if (vb[2] < minW) { const c = cx(); vb[2] = minW; vb[3] = minW / ratio(); setC(c); }
    if (vb[2] > maxW) { const c = cx(); vb[2] = maxW; vb[3] = maxW / ratio(); setC(c); }
  };
  const ratio = () => vb0[2] / vb0[3];
  const cx = () => [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
  const setC = (c) => { vb[0] = c[0] - vb[2] / 2; vb[1] = c[1] - vb[3] / 2; };

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    const r = svg.getBoundingClientRect();
    const mx = vb[0] + (e.clientX - r.left) / r.width * vb[2];
    const my = vb[1] + (e.clientY - r.top) / r.height * vb[3];
    vb[2] *= f; vb[3] *= f;
    vb[0] = mx - (mx - vb[0]) * f;
    vb[1] = my - (my - vb[1]) * f;
    clampZoom(); apply();
  }, { passive: false });

  let drag = null;
  svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vb: vb.slice(), id: e.pointerId, moved: false }; });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) {
      // захватываем указатель только когда начался настоящий пан —
      // иначе capture ретаргетит click и клик по месту не долетает
      drag.moved = true;
      svg.setPointerCapture(drag.id);
      svg.classList.add('grabbing');
    }
    if (!drag.moved) return;
    const r = svg.getBoundingClientRect();
    vb[0] = drag.vb[0] - (e.clientX - drag.x) / r.width * vb[2];
    vb[1] = drag.vb[1] - (e.clientY - drag.y) / r.height * vb[3];
    apply();
  });
  const endDrag = () => { drag = null; svg.classList.remove('grabbing'); };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('dblclick', () => { vb = vb0.slice(); animate(); });

  // ── Плавный полёт ──────────────────────────────────────────────────────────
  let anim = null;
  function animate(target) {
    const from = vb.slice(), to = target || vb0.slice(), t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - p, 3);
      vb = from.map((v, i) => v + (to[i] - v) * e);
      apply();
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  // ── Этапы ленты → фокус к вехе ────────────────────────────────────────────
  const miles = {};
  svg.querySelectorAll('.mile[data-stage]').forEach(m => { miles[m.dataset.stage] = [Number(m.dataset.x), Number(m.dataset.y)]; });
  document.querySelectorAll('.stage-strip .st[data-stage]').forEach(el => {
    const go = () => {
      const m = miles[el.dataset.stage];
      if (!m) return;
      const w = vb0[2] / 2.6, h = w / ratio();
      animate([m[0] - w / 2, m[1] - h / 2, w, h]);
      document.querySelectorAll('.stage-strip .st').forEach(s => s.classList.toggle('st--on', s === el));
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  // ── Корешок карт (данные вписывает генератор в window.ATLAS_SPINE) ────────
  const spine = window.ATLAS_SPINE || [];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  if (spine.length) {
    const nav = document.createElement('nav');
    nav.className = 'spine';
    nav.setAttribute('aria-label', 'Карты Атласа');
    nav.innerHTML = '<div class="spine-tab" title="Карты Атласа">≡ КАРТЫ</div>' +
      '<div class="spine-list"><div class="spine-head">БИБЛЕЙСКИЙ АТЛАС</div>' +
      spine.map((s, i) => `<a class="spine-it${s.current ? ' spine-it--on' : ''}" href="sheet-${s.slug}.html" title="${s.title}">` +
        (s.cover ? `<span class="spine-cover"><img loading="lazy" src="${s.cover}" alt=""><b>${s.slug === 'nachalo' ? '✦' : (ROMAN[i - 1] || i)}</b></span>` : '') +
        `<span>${s.title}</span></a>`).join('') + '</div>';
    document.body.appendChild(nav);
    // листание клавишами ← →
    const cur = spine.findIndex(s => s.current);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && spine[cur - 1]) location.href = `sheet-${spine[cur - 1].slug}.html`;
      if (e.key === 'ArrowRight' && spine[cur + 1]) location.href = `sheet-${spine[cur + 1].slug}.html`;
    });
  }

  // ── Ховер-карточки мест: фото раскопок + небанальный факт ─────────────────
  const cards = window.ATLAS_PLACES || {};
  const card = document.createElement('div');
  card.className = 'place-card';
  card.setAttribute('aria-hidden', 'true');
  document.body.appendChild(card);
  let cardPid = null;
  function showCard(pid, cx2, cy2) {
    const d = cards[pid];
    if (!d) return;
    if (cardPid !== pid) {
      card.innerHTML = (d.t ? `<div class="pc-ph"><img src="${d.t}" alt="" loading="lazy" onerror="this.parentNode.style.display='none'">${d.tl ? `<i>${d.tl}</i>` : ''}</div>` : '') +
        `<div class="pc-body"><b>${d.n}</b>${d.k ? `<u>${d.k}</u>` : ''}${d.f ? `<p>${d.f}</p>` : ''}</div>`;
      cardPid = pid;
    }
    const vw = innerWidth, vh = innerHeight;
    card.style.left = Math.min(cx2 + 16, vw - 320) + 'px';
    card.style.top = Math.min(cy2 + 14, vh - 240) + 'px';
    card.classList.add('pc--on');
  }
  const hideCard = () => { card.classList.remove('pc--on'); };
  const HIT = '.pl[data-pid], .glyph-hit[data-pid], .war[data-pid]';
  svg.addEventListener('pointerover', (e) => {
    const g = e.target.closest(HIT + ', .mile[data-stage]');
    if (g && g.dataset.pid) showCard(g.dataset.pid, e.clientX, e.clientY);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!card.classList.contains('pc--on')) return;
    const g = e.target.closest(HIT);
    if (g) showCard(g.dataset.pid, e.clientX, e.clientY); else if (!drag) hideCard();
  });
  svg.addEventListener('pointerout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest('.pl, .glyph-hit, .war')) hideCard(); });

  // ── Панель-досье по клику: полные тексты и споры из данных карты ──────────
  const panel = document.createElement('aside');
  panel.className = 'dossier';
  panel.setAttribute('aria-label', 'Досье места');
  document.body.appendChild(panel);
  function openDossier(pid) {
    const d = cards[pid];
    if (!d) return;
    const ds = d.dossier || {};
    const gm = window.ATLAS_GLYPHS || {};
    const lex = d.lex ? `<section class="do-sec do-lex">` +
      `<h4>Имя и знак</h4>` +
      `<div class="lex-head">${d.lex.he ? `<span class="he" dir="rtl" lang="he">${d.lex.he}</span>` : ''}` +
      `${d.lex.tr ? `<i class="lex-tr">${d.lex.tr}</i>` : ''}</div>` +
      `${d.lex.ru ? `<p class="lex-ru">${d.lex.ru}</p>` : ''}` +
      `${d.lex.note ? `<p class="lex-note">${d.lex.note}</p>` : ''}` +
      `${d.lex.refs ? `<p class="lex-refs">${d.lex.refs}</p>` : ''}` +
      (d.glyphs || []).map(g2 => gm[g2] ? `<div class="lex-glyph"><b>${gm[g2].t}</b><span>${gm[g2].d}</span></div>` : '').join('') +
      `</section>` : ((d.glyphs || []).length ? `<section class="do-sec do-lex">` +
      d.glyphs.map(g2 => gm[g2] ? `<div class="lex-glyph"><b>${gm[g2].t}</b><span>${gm[g2].d}</span></div>` : '').join('') + `</section>` : '');
    const phs = (ds.photos || []).map(p2 =>
      `<figure class="do-ph"><img loading="lazy" src="${p2.thumb || p2.src}" alt="" onerror="this.closest('figure').style.display='none'">` +
      (p2.label ? `<figcaption>${p2.label}${p2.credit ? `<i>${p2.credit}</i>` : ''}</figcaption>` : '') + '</figure>').join('');
    panel.innerHTML = `<button class="do-x" title="Закрыть (Esc)">×</button>` +
      `<header class="do-head"><b>${d.n}</b>${d.k ? `<u>${d.k}</u>` : ''}</header>` +
      `<div class="do-scroll">` +
      (phs ? `<div class="do-gallery">${phs}</div>` : '') +
      lex +
      (ds.story ? `<section class="do-sec"><h4>История</h4>${ds.story}</section>` : '') +
      (ds.bible ? `<section class="do-sec do-bible">${ds.bible}</section>` : '') +
      (ds.bible_extra && ds.bible_extra !== ds.bible ? `<section class="do-sec do-bible">${ds.bible_extra}</section>` : '') +
      (ds.arch ? `<section class="do-sec"><h4>Археология</h4>${ds.arch}</section>` : '') +
      (ds.dispute ? `<section class="do-sec">${ds.dispute}</section>` : '') +
      `</div>`;
    panel.classList.add('do--on');
    hideCard();
    panel.querySelector('.do-x').addEventListener('click', closeDossier);
  }
  function openGeneric(title, kicker, html) {
    panel.innerHTML = `<button class="do-x" title="Закрыть (Esc)">×</button>` +
      `<header class="do-head"><b>${title}</b>${kicker ? `<u>${kicker}</u>` : ''}</header>` +
      `<div class="do-scroll">${html}</div>`;
    panel.classList.add('do--on');
    hideCard();
    panel.querySelector('.do-x').addEventListener('click', closeDossier);
  }
  const STAGES = window.ATLAS_STAGES || [];
  function openStage(n) {
    const st = STAGES[n];
    if (!st) return;
    const meta = [st.age, st.km].filter(Boolean).join(' · ');
    openGeneric(`Этап ${st.n || n + 1}. ${st.t || ''}`, meta,
      (st.d ? `<section class="do-sec"><h4>Что происходит</h4><p>${st.d}</p></section>` : '') +
      (st.r ? `<section class="do-sec do-bible"><div class="verse">${st.r}</div></section>` : ''));
  }
  const WPS = window.ATLAS_WPS || [];
  function openWp(i) {
    const w = WPS[i];
    if (!w) return;
    openGeneric(w.n, w.role || 'археологическая точка',
      (w.note ? `<section class="do-sec"><p>${w.note}</p></section>` : '') +
      `<section class="do-sec"><p class="lex-refs">Ромб на листе — верифицированная точка раскопок/руин: то, что можно найти на местности.</p></section>`);
  }
  const OVLS = window.ATLAS_OVLS || [];
  function openOvl(i) {
    const o = OVLS[i];
    if (!o) return;
    openGeneric(o.label || 'Слой листа', 'смысловая линия',
      (o.story ? `<section class="do-sec"><p>${o.story}</p></section>` : '') +
      (o.refs ? `<section class="do-sec"><p class="lex-refs">${o.refs}</p></section>` : ''));
  }
  const DECOR = window.ATLAS_DECOR || {};
  function openDecor(kind) {
    const d2 = DECOR[kind];
    if (!d2) return;
    openGeneric(d2.t, 'украшение листа', `<section class="do-sec"><p>${d2.d}</p></section>`);
  }

  function closeDossier() { panel.classList.remove('do--on'); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDossier(); });
  svg.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest(HIT);
    if (g) return openDossier(g.dataset.pid);
    const mi = e.target.closest && e.target.closest('.mile[data-stage]');
    if (mi) return openStage(Number(mi.dataset.stage));
    const wp = e.target.closest && e.target.closest('.wp[data-wpi]');
    if (wp) return openWp(Number(wp.dataset.wpi));
    const ov = e.target.closest && e.target.closest('.ovl-layer[data-ovl]');
    if (ov) return openOvl(Number(ov.dataset.ovl));
    const dc = e.target.closest && e.target.closest('.decor-ship[data-decor]');
    if (dc) return openDecor(dc.dataset.decor);
  });

  // ── Погружение (прячет рамку читалки) ─────────────────────────────────────
  const home = document.createElement('button');
  home.className = 'dive-btn home-btn';
  home.title = 'Весь лист (Esc)';
  home.textContent = '⌂';
  home.addEventListener('click', () => { vb = vb0.slice(); animate(); });
  (document.querySelector('.wrap') || document.body).appendChild(home);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const panelOpen = panel.classList.contains('do--on') || document.body.classList.contains('dive');
    if (!panelOpen && svg.classList.contains('zoomed')) { vb = vb0.slice(); animate(); }
  });

  const dive = document.createElement('button');
  dive.className = 'dive-btn';
  dive.title = 'Полное погружение (Esc — вернуть рамку)';
  dive.textContent = '⛶';
  dive.addEventListener('click', () => document.body.classList.toggle('dive'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('dive'); });
  (document.querySelector('.wrap') || document.body).appendChild(dive);

  // ── Легенда, доступная на зуме (AV-018): фурнитура листа гаснет вблизи,
  //    поэтому дублируем условные обозначения в сворачиваемую HTML-панель
  const spineBtn = document.createElement('button');
  spineBtn.className = 'dive-btn legend-btn';
  spineBtn.title = 'Условные обозначения';
  spineBtn.textContent = '☰';
  const heroLabel = (window.ATLAS_LAYERS && window.ATLAS_LAYERS[0] && window.ATLAS_LAYERS[0].pathLabel) || 'путь героя';
  const legendPanel = document.createElement('div');
  legendPanel.className = 'legend-pop';
  legendPanel.hidden = true;
  legendPanel.innerHTML =
    '<b>Условные обозначения</b>' +
    '<i><span class="lg-route"></span>' + heroLabel + '</i>' +
    '<i><span class="lg-dot"></span>город · стан</i>' +
    '<i><span class="lg-cand"></span>локализация спорна</i>' +
    '<i><span class="lg-arch"></span>археология</i>' +
    '<i><span class="lg-war"></span>поход царей · Быт 14</i>' +
    '<i><span class="lg-lot"></span>путь Лота · Быт 13:11</i>';
  spineBtn.addEventListener('click', () => { legendPanel.hidden = !legendPanel.hidden; });
  const wrap = document.querySelector('.wrap') || document.body;
  wrap.appendChild(spineBtn);
  wrap.appendChild(legendPanel);
})();
