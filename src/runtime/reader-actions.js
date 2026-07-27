(() => {
  'use strict';

  const PRINT_ENGINE_VERSION = 2.1;
  if (window.GBReaderActions?.version === 1 && window.GBPrintEngine?.version === PRINT_ENGINE_VERSION) return;

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
    printing = true;
    preparePrint(source);
    window.print();
    return copyReport(report);
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
      await window.SiteUtils.copyText(value);
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;inset:0 auto auto 0;opacity:0;pointer-events:none';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }

  async function share(trigger) {
    const payload = getSharePayload();
    try {
      if (navigator.share) {
        await navigator.share(payload);
        trigger.dataset.shareStatus = 'shared';
      } else {
        await copyText(payload.url);
        trigger.dataset.shareStatus = 'copied';
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        trigger.dataset.shareStatus = 'failed';
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

  function onClick(event) {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-action="print"],[data-action="share"],[data-home-href]')
      : null;
    if (!trigger) return;

    if (trigger.matches('[data-action="print"]')) {
      event.preventDefault();
      print('button');
      return;
    }
    if (trigger.matches('[data-action="share"]')) {
      event.preventDefault();
      void share(trigger);
      return;
    }
    if (trigger.matches('[data-home-href]')) {
      event.preventDefault();
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
    version: 1,
    print: printEngine,
    share,
    goBack,
  });

  document.addEventListener('click', onClick, true);
  window.addEventListener('beforeprint', () => preparePrint('native'));
  window.addEventListener('afterprint', resetPrint);
})();
