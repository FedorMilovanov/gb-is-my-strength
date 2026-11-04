(() => {
  'use strict';

  const READER_ACTIONS_VERSION = 1;
  const PRINT_ENGINE_VERSION = 2.1;
  if (window.GBReaderActions?.version === READER_ACTIONS_VERSION && window.GBPrintEngine?.version === PRINT_ENGINE_VERSION) {
    document.documentElement.dataset.gbReaderActionsReady = '1';
    return;
  }

  let report = null;
  let preparationCount = 0;
  let printing = false;

  function copyReport(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function errorMessage(error) {
    return error instanceof Error ? error.message : String(error || 'unknown error');
  }

  function preparePagination() {
    const pagination = window.GBPrintPagination;
    if (!pagination || typeof pagination.prepare !== 'function') {
      return { status: 'unavailable' };
    }
    try {
      return { status: 'prepared', report: pagination.prepare() || null };
    } catch (error) {
      console.error('[GBReaderActions] print pagination preparation failed', error);
      return { status: 'failed', error: errorMessage(error) };
    }
  }

  function resetPagination() {
    const pagination = window.GBPrintPagination;
    if (!pagination || typeof pagination.reset !== 'function') return;
    try {
      pagination.reset();
    } catch (error) {
      console.error('[GBReaderActions] print pagination reset failed', error);
    }
  }

  function preparePrint(source = 'api') {
    if (report?.prepared) return copyReport(report);

    preparationCount += 1;
    const pagination = preparePagination();
    report = {
      version: PRINT_ENGINE_VERSION,
      prepared: true,
      source: String(source || 'api'),
      preparationCount,
      pagination,
    };
    document.documentElement.dataset.gbPrintPrepared = '1';
    return copyReport(report);
  }

  function resetPrint() {
    resetPagination();
    printing = false;
    report = null;
    document.documentElement.removeAttribute('data-gb-print-prepared');
  }

  function print(source = 'api') {
    if (printing) return copyReport(report);
    // A reader overlay can hold body{position:fixed} while printing. Use the
    // canonical named-owner transaction before pagination; unknown owners
    // fail closed instead of silently producing a truncated one-page PDF.
    const prepareLocks = window.SiteUtils?.suspendScrollForPrint;
    const lockState = typeof prepareLocks === 'function'
      ? prepareLocks()
      : document.documentElement.getAttribute('data-scroll-locked') === '1'
        ? { ok: false, reason: 'scroll-owner-unavailable' }
        : { ok: true };
    if (!lockState.ok) {
      report = {
        version: PRINT_ENGINE_VERSION,
        prepared: false,
        source: String(source || 'api'),
        status: 'blocked',
        reason: lockState.reason,
      };
      notify('Закройте открытое меню перед печатью', false);
      console.error('[GBReaderActions] print blocked by active scroll owner:', lockState.reason);
      return copyReport(report);
    }
    printing = true;
    preparePrint(source);
    try {
      window.print();
      return copyReport(report);
    } catch (error) {
      window.SiteUtils?.resumeScrollAfterPrint?.();
      resetPrint();
      notify('Не удалось подготовить печать', false);
      console.error('[GBReaderActions] native print failed', error);
      return { version: PRINT_ENGINE_VERSION, status: 'failed', reason: errorMessage(error) };
    }
  }

  function getSharePayload() {
    const config = window.SITE_CONFIG || {};
    const feature = config.features?.share || {};
    return {
      title: String(feature.title || config.page?.title || document.title || ''),
      text: String(feature.text || ''),
      url: location.href,
    };
  }

  async function copyText(value) {
    if (window.SiteUtils?.copyText) {
      const delegated = await window.SiteUtils.copyText(value);
      return delegated !== false;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;inset:0 auto auto 0;opacity:0;pointer-events:none';
    document.body.appendChild(area);
    try {
      area.select();
      // SYS-READER-SHARE-COPY-OUTCOME-CONTRACT: return the real copy result;
      // a refusal or exception must never be reported as a successful copy.
      return document.execCommand('copy');
    } finally {
      // Even if selection or execCommand throws, the temporary node must not
      // survive in the reader DOM. The caller owns the failed-share status.
      area.remove();
    }
  }

  let toastTimer = 0;

  // B15: visible feedback for share/copy. Reuses the .gb-fc-toast surface
  // contract (same markup the engine's getToast() creates), so whichever
  // module shows first owns the element and the other reuses it.
  function notify(message, showCheck) {
    let toast = document.querySelector('.gb-fc-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'gb-fc-toast';
      toast.setAttribute('aria-live', 'polite');
      toast.setAttribute('aria-atomic', 'true');
      toast.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span></span>';
      document.body.appendChild(toast);
    }
    const label = toast.querySelector('span');
    if (label) label.textContent = message;
    const icon = toast.querySelector('svg');
    if (icon) icon.style.display = showCheck ? '' : 'none';
    toast.classList.add('is-open');
    // Same shared token as the engine's showToast() — a stale timeout must
    // not hide the other module's fresh message.
    window.clearTimeout(toastTimer);
    window.__gbFcToastToken = (window.__gbFcToastToken || 0) + 1;
    const shownToken = window.__gbFcToastToken;
    toastTimer = window.setTimeout(function () {
      if (window.__gbFcToastToken === shownToken) toast.classList.remove('is-open');
    }, 2200);
  }

  async function share(trigger) {
    const payload = getSharePayload();
    try {
      if (navigator.share) {
        await navigator.share(payload);
        trigger.dataset.shareStatus = 'shared';
      } else {
        const copied = await copyText(payload.url);
        if (copied) {
          trigger.dataset.shareStatus = 'copied';
          notify('Ссылка скопирована', true);
        } else {
          trigger.dataset.shareStatus = 'failed';
          notify('Не удалось скопировать ссылку', false);
        }
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        trigger.dataset.shareStatus = 'failed';
        notify('Не удалось поделиться', false);
        console.error('[GBReaderActions] share failed', error);
      }
    }
  }

  function goBack(trigger) {
    const fallback = trigger.getAttribute('data-home-href') || '/';
    let sameOriginReferrer = false;
    try {
      sameOriginReferrer = Boolean(document.referrer)
        && new URL(document.referrer, location.href).origin === location.origin;
    } catch {}
    if (sameOriginReferrer && history.length > 1) history.back();
    else location.assign(fallback);
  }

  function claimAction(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function onClick(event) {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-action="print"],[data-action="share"],[data-home-href]')
      : null;
    if (!trigger) return;

    if (trigger.matches('[data-action="print"]')) {
      claimAction(event);
      print('button');
      return;
    }
    if (trigger.matches('[data-action="share"]')) {
      claimAction(event);
      void share(trigger);
      return;
    }
    if (trigger.matches('[data-home-href]')) {
      claimAction(event);
      goBack(trigger);
    }
  }

  const printEngine = Object.freeze({
    version: PRINT_ENGINE_VERSION,
    prepare: preparePrint,
    print,
    reset: resetPrint,
    getReport: () => copyReport(report),
  });

  window.GBPrintEngine = printEngine;
  window.GBReaderActions = Object.freeze({
    version: READER_ACTIONS_VERSION,
    print: printEngine,
    share,
    goBack,
  });

  document.addEventListener('click', onClick, true);
  window.addEventListener('beforeprint', () => preparePrint('native'));
  window.addEventListener('afterprint', resetPrint);
  document.documentElement.dataset.gbReaderActionsReady = '1';
  window.dispatchEvent(new CustomEvent('gb:reader-actions-ready', {
    detail: { version: READER_ACTIONS_VERSION, printVersion: PRINT_ENGINE_VERSION },
  }));
})();
