(() => {
  'use strict';

  const VERSION = 1;
  const TOOLTIP_OWNER = 'article-inline-tooltip';
  const IMAGE_OWNER = 'article-image-viewer';
  const IMAGE_SELECTOR = '.article-figure img, .article-img img, .nagornaya-hero-img';
  const TOOLTIP_SELECTOR = '.gterm, .fn-marker, .bref[data-ref]';

  if (window.GBArticleInteractions?.version === VERSION) {
    document.documentElement.dataset.gbArticleInteractionsReady = '1';
    return;
  }

  let activeTooltip = null;
  let tooltipCloseTimer = 0;
  let imageViewer = null;
  let imageOverlayOpen = false;

  function ready(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  }

  function overlayRuntime() {
    return window.OverlayRuntime || window.SiteUtils?.OverlayRuntime || null;
  }

  function mobileTooltipMode() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function cancelTooltipClose() {
    if (tooltipCloseTimer) window.clearTimeout(tooltipCloseTimer);
    tooltipCloseTimer = 0;
  }

  function scheduleTooltipClose(delay = 220) {
    cancelTooltipClose();
    tooltipCloseTimer = window.setTimeout(() => closeTooltip('leave'), delay);
  }

  function scriptureText(reference) {
    const sources = [
      window.SITE_CONFIG?.scripture,
      window.SITE_CONFIG?.bible,
      window.BIBLE_VERSES,
      window.SCRIPTURE_DATA,
    ];
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      const value = source[reference];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (value && typeof value.text === 'string' && value.text.trim()) return value.text.trim();
    }
    return '';
  }

  function createScriptureTip(anchor) {
    const reference = String(anchor.dataset.ref || anchor.textContent || '').trim();
    const tip = document.createElement('span');
    tip.className = 'btip';
    tip.dataset.generatedScriptureTip = '1';

    const label = document.createElement('strong');
    label.className = 'btip__reference';
    label.textContent = reference;
    tip.appendChild(label);

    const configuredText = scriptureText(reference);
    const body = document.createElement('span');
    body.className = 'btip__text';
    body.textContent = configuredText || 'Ссылка на указанное место Священного Писания.';
    tip.appendChild(body);
    anchor.appendChild(tip);
    return tip;
  }

  function inlineTip(anchor) {
    if (anchor.matches('.gterm')) return anchor.querySelector('.gtip');
    if (anchor.matches('.fn-marker')) return anchor.querySelector('.tooltip');
    if (anchor.matches('.bref[data-ref]')) return anchor.querySelector('.btip') || createScriptureTip(anchor);
    return null;
  }

  function restoreTooltip(record) {
    if (!record?.tip) return;
    const { tip, placeholder } = record;
    tip.classList.remove('gb-floating-tip', 'is-open');
    tip.style.removeProperty('left');
    tip.style.removeProperty('top');
    tip.style.removeProperty('max-height');
    tip.style.removeProperty('--gb-tip-arrow-x');
    if (placeholder?.parentNode) {
      placeholder.parentNode.insertBefore(tip, placeholder);
      placeholder.remove();
    }
  }

  function closeTooltip(reason = 'close') {
    cancelTooltipClose();
    const record = activeTooltip;
    if (!record) return;
    activeTooltip = null;
    record.anchor.classList.remove('is-open');
    record.anchor.setAttribute('aria-expanded', 'false');
    if (record.mobile) overlayRuntime()?.close(TOOLTIP_OWNER, reason);
    restoreTooltip(record);
  }

  function positionTooltip(tip, anchor) {
    if (mobileTooltipMode()) {
      tip.style.removeProperty('left');
      tip.style.removeProperty('top');
      return;
    }
    const margin = 16;
    const gap = 10;
    const anchorRect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let left = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - tipRect.width));
    let top = anchorRect.top - tipRect.height - gap;
    if (top < margin) top = Math.min(window.innerHeight - margin - tipRect.height, anchorRect.bottom + gap);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(Math.max(margin, top))}px`;
    tip.style.setProperty('--gb-tip-arrow-x', `${Math.round(anchorRect.left + anchorRect.width / 2 - left)}px`);
  }

  function openTooltip(anchor, reason = 'open') {
    const tip = inlineTip(anchor);
    if (!tip) return;
    if (activeTooltip?.anchor === anchor) {
      positionTooltip(tip, anchor);
      return;
    }
    closeTooltip('replace');
    cancelTooltipClose();

    const placeholder = document.createComment('gb-inline-tooltip');
    tip.parentNode?.insertBefore(placeholder, tip);
    document.body.appendChild(tip);
    tip.classList.add('gb-floating-tip', 'is-open');
    anchor.classList.add('is-open');
    anchor.setAttribute('aria-expanded', 'true');

    const record = { anchor, tip, placeholder, mobile: mobileTooltipMode() };
    activeTooltip = record;
    positionTooltip(tip, anchor);

    if (!tip.dataset.gbInteractionBound) {
      tip.dataset.gbInteractionBound = '1';
      tip.addEventListener('pointerenter', cancelTooltipClose);
      tip.addEventListener('pointerleave', () => scheduleTooltipClose());
      tip.addEventListener('click', (event) => event.stopPropagation());
    }

    if (record.mobile) {
      const runtime = overlayRuntime();
      if (runtime) {
        runtime.open(TOOLTIP_OWNER, {
          element: tip,
          opener: anchor,
          closeOnEscape: true,
          trapFocus: false,
          restoreFocus: true,
          lockScroll: true,
          onRequestClose: (closeReason) => {
            closeTooltip(closeReason || 'request');
            return false;
          },
          reason,
        });
      } else window.SiteUtils?.lockScroll?.(`overlay:${TOOLTIP_OWNER}`);
    }
  }

  function initializeTooltipAnchor(anchor) {
    if (!(anchor instanceof Element) || anchor.dataset.gbTooltipReady === '1') return;
    const tip = inlineTip(anchor);
    if (!tip) return;
    anchor.dataset.gbTooltipReady = '1';
    anchor.setAttribute('aria-expanded', 'false');
    if (!anchor.hasAttribute('tabindex') && !anchor.matches('button, a[href], input, select, textarea')) anchor.tabIndex = 0;
    if (!anchor.hasAttribute('role') && !anchor.matches('button, a[href]')) anchor.setAttribute('role', 'button');

    anchor.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch' || mobileTooltipMode()) return;
      openTooltip(anchor, 'hover');
    });
    anchor.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch' || mobileTooltipMode()) return;
      scheduleTooltipClose();
    });
    anchor.addEventListener('focus', () => openTooltip(anchor, 'focus'));
    anchor.addEventListener('blur', () => scheduleTooltipClose(120));
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeTooltip?.anchor === anchor) closeTooltip('toggle');
      else openTooltip(anchor, 'click');
    });
    anchor.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (activeTooltip?.anchor === anchor) closeTooltip('toggle');
      else openTooltip(anchor, 'keyboard');
    });
  }

  function initGlossaryTooltips(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    root.querySelectorAll('.gterm').forEach(initializeTooltipAnchor);
  }

  function initInlineTooltips(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    root.querySelectorAll(TOOLTIP_SELECTOR).forEach(initializeTooltipAnchor);
  }

  function quizResult(config, score, total) {
    const entries = Array.isArray(config?.scores) ? config.scores : [];
    return entries.find((entry) => score >= Number(entry.min) && score <= Number(entry.max)) || {
      title: `${score} из ${total}`,
      desc: score === total ? 'Все ответы верны.' : 'Вернитесь к отмеченным разделам и попробуйте ещё раз.',
    };
  }

  function buildQuiz(placeholder, config) {
    if (placeholder.dataset.gbQuizReady === '1') return;
    const questions = Array.isArray(config?.questions) ? config.questions.filter((item) => item && Array.isArray(item.options) && item.options.length >= 2) : [];
    if (!questions.length) return;
    placeholder.dataset.gbQuizReady = '1';
    placeholder.classList.add('gb-quiz-host');

    const launch = document.createElement('button');
    launch.type = 'button';
    launch.id = 'quizLaunch';
    launch.className = 'quiz-launch';
    launch.textContent = 'Начать проверку';

    const panel = document.createElement('section');
    panel.className = 'quiz-wrapper';
    panel.hidden = true;
    panel.setAttribute('aria-live', 'polite');

    placeholder.replaceChildren(launch, panel);
    let index = 0;
    let score = 0;

    function emitRendered() {
      document.dispatchEvent(new CustomEvent('gb:quiz-rendered', { detail: { root: panel } }));
    }

    function restart() {
      index = 0;
      score = 0;
      renderQuestion();
    }

    function renderResult() {
      const result = quizResult(config, score, questions.length);
      panel.replaceChildren();
      const eyebrow = document.createElement('p');
      eyebrow.className = 'quiz-progress';
      eyebrow.textContent = `Результат: ${score} из ${questions.length}`;
      const title = document.createElement('h3');
      title.id = 'quizQuestion';
      title.textContent = result.title || `${score} из ${questions.length}`;
      const description = document.createElement('p');
      description.className = 'quiz-result-copy';
      description.textContent = result.desc || '';
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'quiz-next';
      again.textContent = 'Пройти ещё раз';
      again.addEventListener('click', restart);
      panel.append(eyebrow, title, description, again);
      emitRendered();
    }

    function renderQuestion() {
      if (index >= questions.length) {
        renderResult();
        return;
      }
      const question = questions[index];
      panel.replaceChildren();

      const progress = document.createElement('p');
      progress.className = 'quiz-progress';
      progress.textContent = `Вопрос ${index + 1} из ${questions.length}`;
      const title = document.createElement('h3');
      title.id = 'quizQuestion';
      title.textContent = String(question.question || 'Вопрос');
      const options = document.createElement('div');
      options.className = 'quiz-options';
      options.setAttribute('role', 'group');
      options.setAttribute('aria-labelledby', 'quizQuestion');
      panel.append(progress, title, options);

      question.options.forEach((option, optionIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-option';
        button.textContent = String(option);
        button.addEventListener('click', () => {
          const correctIndex = Number(question.correct);
          const correct = optionIndex === correctIndex;
          if (correct) score += 1;
          options.querySelectorAll('.quiz-option').forEach((candidate, candidateIndex) => {
            candidate.disabled = true;
            candidate.classList.toggle('is-correct', candidateIndex === correctIndex);
            candidate.classList.toggle('is-incorrect', candidateIndex === optionIndex && !correct);
          });

          const feedback = document.createElement('div');
          feedback.className = `quiz-feedback ${correct ? 'is-correct' : 'is-incorrect'}`;
          const feedbackTitle = document.createElement('strong');
          feedbackTitle.textContent = correct ? 'Верно' : 'Неверно';
          const explanation = document.createElement('p');
          const explanationData = question.explanation;
          explanation.textContent = typeof explanationData === 'string'
            ? explanationData
            : String(explanationData?.short || explanationData?.full || '');
          feedback.append(feedbackTitle, explanation);

          if (question.sourceRef?.href) {
            const source = document.createElement('a');
            source.href = String(question.sourceRef.href);
            source.textContent = String(question.sourceRef.label || 'Вернуться к разделу');
            feedback.appendChild(source);
          }

          const next = document.createElement('button');
          next.type = 'button';
          next.className = 'quiz-next';
          next.textContent = index + 1 < questions.length ? 'Следующий вопрос' : 'Показать результат';
          next.addEventListener('click', () => {
            index += 1;
            renderQuestion();
          });
          panel.append(feedback, next);
          next.focus({ preventScroll: true });
          emitRendered();
        }, { once: true });
        options.appendChild(button);
      });
      emitRendered();
    }

    launch.addEventListener('click', () => {
      launch.hidden = true;
      panel.hidden = false;
      renderQuestion();
      panel.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }

  function initQuizzes(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    const config = window.SITE_CONFIG?.quiz;
    if (!Array.isArray(config?.questions) || !config.questions.length) return;
    root.querySelectorAll('#quizPlaceholder').forEach((placeholder) => buildQuiz(placeholder, config));
  }

  function ensureImageViewer() {
    if (imageViewer) return imageViewer;
    const viewer = document.createElement('div');
    viewer.className = 'img-viewer';
    viewer.setAttribute('aria-hidden', 'true');
    viewer.setAttribute('inert', '');
    viewer.innerHTML = '<div class="img-viewer__dialog" role="dialog" aria-modal="true" aria-label="Просмотр изображения"><button type="button" class="img-viewer__close" aria-label="Закрыть просмотр">×</button><figure><img class="img-viewer__image" alt=""><figcaption class="img-viewer__caption"></figcaption></figure></div>';
    document.body.appendChild(viewer);
    viewer.querySelector('.img-viewer__close').addEventListener('click', () => closeImageViewer('button'));
    viewer.addEventListener('click', (event) => {
      if (event.target === viewer) closeImageViewer('backdrop');
    });
    imageViewer = viewer;
    return viewer;
  }

  function closeImageViewer(reason = 'close') {
    if (!imageViewer || !imageOverlayOpen) return;
    imageOverlayOpen = false;
    imageViewer.classList.remove('is-open');
    imageViewer.setAttribute('aria-hidden', 'true');
    imageViewer.setAttribute('inert', '');
    overlayRuntime()?.close(IMAGE_OWNER, reason);
  }

  function openImageViewer(source) {
    const viewer = ensureImageViewer();
    const image = viewer.querySelector('.img-viewer__image');
    const caption = viewer.querySelector('.img-viewer__caption');
    const close = viewer.querySelector('.img-viewer__close');
    image.src = source.currentSrc || source.src;
    image.alt = source.alt || '';
    const figureCaption = source.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
    caption.textContent = figureCaption || source.alt || '';
    caption.hidden = !caption.textContent;
    viewer.classList.add('is-open');
    viewer.setAttribute('aria-hidden', 'false');
    viewer.removeAttribute('inert');
    imageOverlayOpen = true;

    const runtime = overlayRuntime();
    if (runtime) {
      const inertTargets = Array.from(document.body.children).filter((child) => child !== viewer);
      runtime.open(IMAGE_OWNER, {
        element: viewer,
        opener: source,
        focusTarget: close,
        inertTargets,
        closeOnEscape: true,
        trapFocus: true,
        restoreFocus: true,
        lockScroll: true,
        onRequestClose: (reason) => {
          closeImageViewer(reason || 'request');
          return false;
        },
      });
    } else {
      window.SiteUtils?.lockScroll?.(`overlay:${IMAGE_OWNER}`);
      close.focus({ preventScroll: true });
    }
  }

  function initImageViewer() {
    if (document.documentElement.dataset.gbImageViewerBound === '1') return;
    document.documentElement.dataset.gbImageViewerBound = '1';
    document.addEventListener('click', (event) => {
      const image = event.target instanceof Element ? event.target.closest(IMAGE_SELECTOR) : null;
      if (!image || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openImageViewer(image);
    });
  }

  function install() {
    window.SiteUtils = window.SiteUtils || {};
    window.SiteUtils.initGlossaryTooltips = initGlossaryTooltips;
    initInlineTooltips(document);
    initQuizzes(document);
    initImageViewer();

    document.addEventListener('gb:quiz-rendered', (event) => initInlineTooltips(event.detail?.root || document));
    document.addEventListener('pointerdown', (event) => {
      if (!activeTooltip) return;
      if (activeTooltip.anchor.contains(event.target) || activeTooltip.tip.contains(event.target)) return;
      closeTooltip('outside');
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeTooltip && !activeTooltip.mobile) closeTooltip('escape');
    }, true);
    window.addEventListener('resize', () => {
      if (activeTooltip) positionTooltip(activeTooltip.tip, activeTooltip.anchor);
    }, { passive: true });
    window.addEventListener('scroll', () => {
      if (activeTooltip && !activeTooltip.mobile) closeTooltip('scroll');
    }, { passive: true });

    window.GBArticleInteractions = Object.freeze({
      version: VERSION,
      init: install,
      initGlossaryTooltips,
      initQuizzes,
      closeTooltip,
      closeImageViewer,
    });
    document.documentElement.dataset.gbArticleInteractionsReady = '1';
    window.dispatchEvent(new CustomEvent('gb:article-interactions-ready', { detail: { version: VERSION } }));
  }

  ready(install);
})();
