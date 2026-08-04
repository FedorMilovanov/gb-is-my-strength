const PLAY_SELECTOR = '[data-fc-action="play"]';
const BOUND_KEY = '__gbReaderTtsLongPressClickGuardBound';

if (!window[BOUND_KEY]) {
  window[BOUND_KEY] = true;

  // This listener is imported before reader-tts.js, so both listeners live on
  // document capture and this narrow prefilter can consume the one browser
  // click generated after a confirmed touch/pen long-press stop.
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest(PLAY_SELECTOR) : null;
    if (!(button instanceof HTMLElement)) return;

    const suppressUntil = Number(button.dataset.gbSuppressTtsClickUntil || 0);
    if (!suppressUntil) return;
    delete button.dataset.gbSuppressTtsClickUntil;
    if (Date.now() > suppressUntil) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }, true);
}
