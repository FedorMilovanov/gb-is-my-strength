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
  const apply = () => {
    svg.setAttribute('viewBox', vb.map(n => n.toFixed(1)).join(' '));
    // на зуме растворяем паспарту/фурнитуру — вблизи остаётся чистая карта
    const zoomed = Math.abs(vb[2] - vb0[2]) > vb0[2] * 0.04 || Math.abs(vb[0] - vb0[0]) > vb0[2] * 0.04;
    svg.classList.toggle('zoomed', zoomed);
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
  svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vb: vb.slice() }; svg.setPointerCapture(e.pointerId); svg.classList.add('grabbing'); });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
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
        (s.cover ? `<span class="spine-cover"><img loading="lazy" src="${s.cover}" alt=""><b>${ROMAN[i] || i + 1}</b></span>` : '') +
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
      card.innerHTML = (d.t ? `<div class="pc-ph"><img src="${d.t}" alt="" loading="lazy">${d.tl ? `<i>${d.tl}</i>` : ''}</div>` : '') +
        `<div class="pc-body"><b>${d.n}</b>${d.k ? `<u>${d.k}</u>` : ''}${d.f ? `<p>${d.f}</p>` : ''}</div>`;
      cardPid = pid;
    }
    const vw = innerWidth, vh = innerHeight;
    card.style.left = Math.min(cx2 + 16, vw - 320) + 'px';
    card.style.top = Math.min(cy2 + 14, vh - 240) + 'px';
    card.classList.add('pc--on');
  }
  const hideCard = () => { card.classList.remove('pc--on'); };
  svg.addEventListener('pointerover', (e) => {
    const g = e.target.closest('.pl[data-pid], .mile[data-stage]');
    if (g && g.dataset.pid) showCard(g.dataset.pid, e.clientX, e.clientY);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!card.classList.contains('pc--on')) return;
    const g = e.target.closest('.pl[data-pid]');
    if (g) showCard(g.dataset.pid, e.clientX, e.clientY); else if (!drag) hideCard();
  });
  svg.addEventListener('pointerout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest('.pl')) hideCard(); });

  // ── Погружение (прячет рамку читалки) ─────────────────────────────────────
  const dive = document.createElement('button');
  dive.className = 'dive-btn';
  dive.title = 'Полное погружение (Esc — вернуть рамку)';
  dive.textContent = '⛶';
  dive.addEventListener('click', () => document.body.classList.toggle('dive'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('dive'); });
  document.body.appendChild(dive);
})();
