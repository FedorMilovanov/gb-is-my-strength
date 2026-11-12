/**
 * initSpeedSlot — shared slot-swap speed-rail behaviour for the mobile bars.
 *
 * The Gill series bar (GillSeriesMobileBar.astro) and the Hermenevtika bar
 * (HermenevtikaMobileBar.astro) implement the SAME mechanic from the approved
 * mobile reference: tapping Play crossfades the search field out and the
 * 1×–2× speed rail into the same slot (once per session); the picked rate
 * persists as a badge on Play and can reopen the rail. The two bars used to
 * carry a byte-for-byte copy of this ~100-line function each, differing only
 * in class prefixes (.mobile-* vs .hm-*). This is the single shared source;
 * each bar passes its own selectors.
 *
 * Only CSS/palette/scoping differs between the two bars — none of the JS
 * logic did, so nothing here is bar-specific beyond the selector strings.
 */
export interface SpeedSlotSelectors {
  /** Play ember whose data-state drives the auto-open (once per session). */
  ember: string;
  /** The horizontally-scrollable speed-chip rail. */
  speedrail: string;
  /** The speed badge on Play (shows/persists the current rate, reopens rail). */
  badge: string;
  /** Individual speed chips inside the rail (carry data-speed). */
  chip: string;
  /** Optional TOC-search input in the same slot; focusing it closes the rail. */
  searchInput?: string;
  /** Navigation controls visually covered by the speed rail. */
  coveredControls?: string;
}

export function initSpeedSlot(topbar: HTMLElement, sel: SpeedSlotSelectors): void {
  const ember = topbar.querySelector(sel.ember) as HTMLElement | null;
  const speedrail = topbar.querySelector(sel.speedrail) as HTMLElement | null;
  const badge = topbar.querySelector(sel.badge) as HTMLElement | null;
  if (!ember || !speedrail || !badge) return;
  // Capture narrowed, non-null references for the async event handlers below.
  const rail = speedrail;
  const rateTrigger = badge;
  const chips = Array.prototype.slice.call(speedrail.querySelectorAll(sel.chip)) as HTMLElement[];
  // The displaced search/Learning control must leave keyboard and AX while
  // its transparent state is replaced by the speed rail in the same slot.
  const displaced = Array.from(speedrail.parentElement?.children || [])
    .filter((element): element is HTMLElement => element !== speedrail && element instanceof HTMLElement);
  const covered = sel.coveredControls ? Array.from(topbar.querySelectorAll<HTMLElement>(sel.coveredControls)) : [];
  const suspended = Array.from(new Set([...displaced, ...covered]));
  const previousInert = new Map<HTMLElement, boolean>();
  let offeredThisSession = false;
  let closeTimer: number | undefined;
  let choiceCloseTimer: number | undefined;

  function fmt(r: number): string { return String(r).replace(/\.0$/, '') + '×'; }
  function readRate(): number {
    try {
      const r = parseFloat(localStorage.getItem('gb:audio:rate') || localStorage.getItem('gbx-tts-rate') || '1');
      // Legacy Gill saved 0.8×; the approved sitewide scale starts at 0.75×.
      return (!isNaN(r) && r > 0) ? (r === 0.8 ? 0.75 : r) : 1;
    } catch (_) { return 1; }
  }
  function syncActive(rate: number) {
    chips.forEach((c) => {
      const on = parseFloat(c.dataset.speed || '1') === rate;
      c.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    (badge as HTMLElement).textContent = fmt(rate);
    (badge as HTMLElement).setAttribute('aria-label', 'Выбрать скорость, сейчас ' + fmt(rate));
  }
  syncActive(readRate());
  // Opacity alone does not remove speed buttons from keyboard navigation.
  // Keep the closed rail out of both the tab order and accessibility tree.
  speedrail.inert = true;
  speedrail.setAttribute('aria-hidden', 'true');
  badge.setAttribute('aria-expanded', 'false');
  if (speedrail.id) badge.setAttribute('aria-controls', speedrail.id);

  function open(autoClose: boolean) {
    clearTimeout(closeTimer);
    clearTimeout(choiceCloseTimer);
    if (suspended.some((element) => element.contains(document.activeElement))) {
      rateTrigger.focus({ preventScroll: true });
    }
    suspended.forEach((element) => {
      if (!previousInert.has(element)) previousInert.set(element, element.inert);
      element.inert = true;
    });
    rail.inert = false;
    rail.removeAttribute('aria-hidden');
    rateTrigger.setAttribute('aria-expanded', 'true');
    topbar.classList.add('speed-open');
    const active = (speedrail as HTMLElement).querySelector(sel.chip + '[aria-checked="true"]') as HTMLElement | null;
    if (active) setTimeout(() => { active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' }); }, 20);
    if (autoClose) closeTimer = window.setTimeout(close, 4500);
  }
  function close() {
    clearTimeout(closeTimer);
    clearTimeout(choiceCloseTimer);
    // Keyboard focus must not remain on an element about to become inert.
    if (rail.contains(document.activeElement)) rateTrigger.focus({ preventScroll: true });
    topbar.classList.remove('speed-open');
    previousInert.forEach((wasInert, element) => { element.inert = wasInert; });
    previousInert.clear();
    rail.inert = true;
    rail.setAttribute('aria-hidden', 'true');
    rateTrigger.setAttribute('aria-expanded', 'false');
  }

  let prevState = ember.dataset.state || 'idle';
  new MutationObserver(() => {
    const state = ember.dataset.state || 'idle';
    if (state === 'playing' && (prevState === 'idle' || prevState === 'complete') && !offeredThisSession) {
      offeredThisSession = true;
      open(true);
    }
    prevState = state;
  }).observe(ember, { attributes: true, attributeFilter: ['data-state'] });

  topbar.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && topbar.classList.contains('speed-open')) {
      e.preventDefault(); close(); rateTrigger.focus({ preventScroll: true });
    }
  });

  badge.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    topbar.classList.contains('speed-open') ? close() : open(false);
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const rate = parseFloat(chip.dataset.speed || '1');
      syncActive(rate);
      badge.classList.remove('is-bump'); void badge.offsetWidth; badge.classList.add('is-bump');
      // C3: keep live playback uninterrupted; only non-playing states wait
      // for Play. The canonical rate event updates the active TTS engine.
      const activeReading = ember.dataset.state === 'playing' || ember.dataset.state === 'starting';
      if (activeReading) delete ember.dataset.speedConfirm;
      else ember.dataset.speedConfirm = 'true';
      try {
        localStorage.setItem('gb:audio:rate', String(rate));
        localStorage.setItem('gbx-tts-rate', String(rate));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('gb:tts-rate-change', { detail: { rate: rate } }));
      choiceCloseTimer = window.setTimeout(close, 220);
    });
  });

  new MutationObserver(() => {
    if (ember.dataset.state === 'playing') delete ember.dataset.speedConfirm;
  }).observe(ember, { attributes: true, attributeFilter: ['data-state'] });

  window.addEventListener('gb:tts-rate-change', ((ev: CustomEvent) => {
    const r = ev && ev.detail && ev.detail.rate;
    if (typeof r === 'number' && !isNaN(r)) syncActive(r);
  }) as EventListener);

  document.addEventListener('pointerdown', (e: PointerEvent) => {
    if (topbar.classList.contains('speed-open') && !topbar.contains(e.target as Node)) close();
  }, { passive: true });

  let dragging = false, startX = 0, startScroll = 0, moved = false, pid: number | null = null;
  speedrail.addEventListener('pointerdown', (e: PointerEvent) => {
    dragging = true; moved = false; startX = e.clientX; startScroll = (speedrail as HTMLElement).scrollLeft; pid = e.pointerId;
  });
  speedrail.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pid) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) {
      moved = true;
      (speedrail as HTMLElement).classList.add('is-dragging');
      try { (speedrail as HTMLElement).setPointerCapture(pid); } catch (_) {}
    }
    if (moved) (speedrail as HTMLElement).scrollLeft = startScroll - dx;
  });
  function endDrag(e: PointerEvent) {
    if (!dragging || (pid !== null && e.pointerId !== pid)) return;
    dragging = false; pid = null;
    (speedrail as HTMLElement).classList.remove('is-dragging');
  }
  speedrail.addEventListener('pointerup', endDrag);
  speedrail.addEventListener('pointercancel', endDrag);
  speedrail.addEventListener('click', (e: MouseEvent) => { if (moved) { e.stopPropagation(); moved = false; } }, true);

  // Search field in the same slot: focusing it closes the speed rail
  // (same UX as the reference — search.addEventListener('focus', closeSpeeds)).
  if (sel.searchInput) {
    const searchInput = topbar.querySelector(sel.searchInput) as HTMLInputElement | null;
    if (searchInput) searchInput.addEventListener('focus', () => close());
  }
}
