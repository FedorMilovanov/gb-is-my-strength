'use strict';

(function (global) {
  const STYLE_ID = 'map-archaeology-projection-css';
  const ROOT_SELECTOR = '[data-archaeology-projection-root]';

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''), global.location.href);
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .map-arch-projection{margin-top:18px;padding:14px 0 4px;border-top:1px solid rgba(232,200,121,.2)}
      .map-arch-projection__eyebrow{display:flex;align-items:center;gap:7px;color:var(--me-accent,#e8c879);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
      .map-arch-projection__eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 10px rgba(232,200,121,.55)}
      .map-arch-projection__title{margin:7px 0 2px;color:var(--me-text,#e9e4d6);font-family:Georgia,serif;font-size:16px}
      .map-arch-projection__note{color:var(--me-muted,#9aa2ae);font-size:10px;line-height:1.5}
      .map-arch-card{padding:12px 0;border-top:1px solid rgba(255,255,255,.07)}
      .map-arch-card:first-of-type{margin-top:8px}
      .map-arch-card__badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px}
      .map-arch-badge{padding:2px 7px;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:var(--me-muted,#9aa2ae);font-size:8px;line-height:1.4}
      .map-arch-badge--accepted-context,.map-arch-badge--primary-identification,.map-arch-badge--high,.map-arch-badge--supporting{border-color:rgba(74,222,128,.28);color:rgba(134,239,172,.92)}
      .map-arch-badge--project-interpretation,.map-arch-badge--interpretation{border-color:rgba(232,200,121,.3);color:var(--me-accent,#e8c879)}
      .map-arch-badge--rejected,.map-arch-badge--negative,.map-arch-badge--retracted{border-color:rgba(248,113,113,.3);color:rgba(252,165,165,.94)}
      .map-arch-card__statement{color:var(--me-text,#e9e4d6);font-size:12px;line-height:1.55}
      .map-arch-card__limitations{margin-top:6px;color:var(--me-muted,#9aa2ae);font-size:10px;line-height:1.5}
      .map-arch-sources{display:grid;gap:7px;margin-top:9px}
      .map-arch-source{display:block;padding-left:9px;border-left:2px solid rgba(232,200,121,.22)}
      .map-arch-source__link{color:var(--me-accent,#e8c879);font-size:10px;line-height:1.4;text-decoration:none}
      .map-arch-source__link:hover{text-decoration:underline}
      .map-arch-source__meta{display:block;margin-top:2px;color:var(--me-muted,#9aa2ae);font-size:9px;line-height:1.4}
    `;
    document.head.appendChild(style);
  }

  function text(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = String(value || '');
    return node;
  }

  function badge(value) {
    const normalized = String(value || 'unknown').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    return text('span', `map-arch-badge map-arch-badge--${normalized}`, value);
  }

  function sourceNode(source) {
    const node = document.createElement('div');
    node.className = 'map-arch-source';
    node.dataset.sourceId = source.id;
    node.dataset.evidenceUse = source.evidenceUse;
    node.dataset.sourceStatus = source.status;
    node.dataset.sourcePerspective = source.perspective;

    const href = safeUrl(source.url);
    if (href) {
      const link = text('a', 'map-arch-source__link', source.title);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      node.appendChild(link);
    } else {
      node.appendChild(text('span', 'map-arch-source__link', source.title));
    }

    const details = [
      source.organization,
      Number.isInteger(source.year) ? String(source.year) : '',
      source.evidenceUse,
      source.perspective === 'yec' ? 'YEC-интерпретация' : source.perspective,
      source.status,
    ].filter(Boolean).join(' · ');
    node.appendChild(text('span', 'map-arch-source__meta', details));
    return node;
  }

  function projectionNode(placeId, cards, projection) {
    const root = document.createElement('section');
    root.className = 'map-arch-projection';
    root.dataset.archaeologyProjectionRoot = '1';
    root.dataset.placeId = placeId;
    root.dataset.projectionVersion = projection.schemaVersion || '1.0.0';
    root.appendChild(text('div', 'map-arch-projection__eyebrow', 'Проверенный аппарат источников'));
    root.appendChild(text('h3', 'map-arch-projection__title', 'Археология и исторический контекст'));
    root.appendChild(text('p', 'map-arch-projection__note', 'Материальные данные, академическая оценка и YEC-интерпретация показаны раздельно.'));

    for (const card of cards) {
      const article = document.createElement('article');
      article.className = 'map-arch-card';
      article.dataset.claimId = card.claimId;
      article.dataset.claimStatus = card.status;

      const badges = document.createElement('div');
      badges.className = 'map-arch-card__badges';
      badges.appendChild(badge(card.status));
      article.appendChild(badges);
      article.appendChild(text('div', 'map-arch-card__statement', card.statement));
      if (card.limitations) article.appendChild(text('div', 'map-arch-card__limitations', `Ограничение: ${card.limitations}`));

      const ids = [...new Set([...(card.evidenceSourceIds || []), ...(card.interpretationSourceIds || [])])];
      if (ids.length) {
        const sources = document.createElement('div');
        sources.className = 'map-arch-sources';
        for (const id of ids) {
          const source = projection.sourceMeta && projection.sourceMeta[id];
          if (!source) continue;
          badges.appendChild(badge(source.evidenceUse));
          sources.appendChild(sourceNode(source));
        }
        article.appendChild(sources);
      }
      root.appendChild(article);
    }
    return root;
  }

  function attach(container, projection) {
    if (!container || !projection || typeof projection !== 'object') return null;
    addStyle();
    const allowedTabs = new Set(Array.isArray(projection.allowedTabs) ? projection.allowedTabs : ['arch', 'sci']);
    let queued = false;
    let destroyed = false;

    function render() {
      queued = false;
      if (destroyed || !container.isConnected) return;
      const content = container.querySelector('.me-content');
      if (!content) return;

      content.querySelectorAll('.me-arch-footer').forEach((node) => node.remove());
      const activeTab = container.querySelector('.me-tab--active[data-tab]')?.dataset.tab || '';
      const placeId = new URL(global.location.href).searchParams.get('place') || '';
      const cards = projection.byPlace && projection.byPlace[placeId];
      const key = `${placeId}|${activeTab}|${cards ? cards.length : 0}`;
      const existing = content.querySelector(ROOT_SELECTOR);

      if (!allowedTabs.has(activeTab) || !Array.isArray(cards) || cards.length === 0) {
        if (existing) existing.remove();
        return;
      }
      if (existing && existing.dataset.renderKey === key) return;
      if (existing) existing.remove();
      const root = projectionNode(placeId, cards, projection);
      root.dataset.renderKey = key;
      content.appendChild(root);
    }

    function schedule() {
      if (queued || destroyed) return;
      queued = true;
      queueMicrotask(render);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    global.addEventListener('popstate', schedule);
    schedule();

    return Object.freeze({
      render: schedule,
      destroy() {
        destroyed = true;
        observer.disconnect();
        global.removeEventListener('popstate', schedule);
        container.querySelector(ROOT_SELECTOR)?.remove();
      },
    });
  }

  function autoAttach() {
    const container = document.getElementById('stage');
    const payload = document.getElementById('map-archaeology-projection');
    if (!container || !payload || container.dataset.archaeologyAdapter === 'attached') return;
    try {
      const projection = JSON.parse(payload.textContent || 'null');
      const instance = attach(container, projection);
      if (instance) {
        container.dataset.archaeologyAdapter = 'attached';
        global.MapArchaeologyAdapterInstance = instance;
      }
    } catch (error) {
      console.error('[map-archaeology] projection bootstrap failed:', error);
    }
  }

  global.MapArchaeologyAdapter = Object.freeze({ attach });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoAttach, { once: true });
  } else {
    queueMicrotask(autoAttach);
  }
})(window);
