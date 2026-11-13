(() => {
  'use strict';

  const VERSION = 4;
  const BOUND_ATTR = 'data-reader-controls-a11y-bound';
  const slots = new Set();
  const surfaceRelations = new Map();

  function setAttr(element, name, value) {
    if (!element) return;
    if (value == null || value === false) {
      if (element.hasAttribute(name)) element.removeAttribute(name);
      return;
    }
    const next = String(value);
    if (element.getAttribute(name) !== next) element.setAttribute(name, next);
  }

  function setInert(element, inert) {
    if (!element) return;
    try { element.inert = Boolean(inert); } catch (_) {}
    if (inert) setAttr(element, 'inert', '');
    else setAttr(element, 'inert', null);
  }

  function ensureId(element, fallback) {
    if (element.id) return element.id;
    let candidate = fallback;
    let suffix = 2;
    while (document.getElementById(candidate)) candidate = `${fallback}-${suffix++}`;
    element.id = candidate;
    return candidate;
  }

  function parseRate(chip) {
    const value = Number.parseFloat(chip?.dataset?.speed || '');
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function persistRate(rate) {
    // The keyboard adapter owns arrow-key navigation, not the rate policy.
    // Persist and broadcast through the same owner as pointer chip selection.
    if (window.GBReaderRatePolicy?.persist(rate) != null) return;
    if (![0.75, 1, 1.25, 1.5, 1.75, 2].includes(rate)) return;
    try {
      localStorage.setItem('gb:audio:rate', String(rate));
      localStorage.setItem('gbx-tts-rate', String(rate));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('gb:tts-rate-change', { detail: { rate } }));
  }

  function bindSpeedSlot(root, config) {
    if (!(root instanceof HTMLElement) || root.hasAttribute(BOUND_ATTR)) return;
    const rail = root.querySelector(config.rail);
    const badge = root.querySelector(config.badge);
    const alternate = root.querySelector(config.alternate);
    if (!(rail instanceof HTMLElement) || !(badge instanceof HTMLElement)) return;
    const chips = Array.from(rail.querySelectorAll(config.chip)).filter((node) => node instanceof HTMLElement);
    if (!chips.length) return;

    root.setAttribute(BOUND_ATTR, config.kind);
    const railId = ensureId(rail, `${config.kind}-speedrail`);
    const initialRailInlineDisplay = rail.style.display;
    const keepAlternateVisible = root.dataset.fcSpeedLayout === 'popover';
    const alternateState = alternate instanceof HTMLElement ? {
      ariaHidden: alternate.getAttribute('aria-hidden'),
      inert: alternate.hasAttribute('inert') || Boolean(alternate.inert),
      tabIndex: alternate.getAttribute('tabindex'),
    } : null;
    const lifecycle = new AbortController();
    let scheduled = false;
    let keyboardHideRequested = false;
    let keyboardCollapsed = false;

    function isOpen() {
      // ReaderSpeedOptions owns one shared slot for both engines. Its
      // speed-open class is canonical; during opening aria-hidden is removed,
      // not set to the literal string "false". Reading the attribute here
      // caused the a11y adapter to immediately hide a newly opened Gill rail.
      return root.classList.contains('speed-open');
    }

    function selectedChip() {
      return chips.find((chip) => chip.getAttribute('aria-checked') === 'true') || chips[0];
    }

    function setRoving(active) {
      chips.forEach((chip) => { chip.tabIndex = chip === active ? 0 : -1; });
    }

    function sync() {
      scheduled = false;
      const open = isOpen();
      const focused = document.activeElement;
      if (!open && rail.contains(focused)) {
        try { badge.focus({ preventScroll: true }); } catch (_) { try { badge.focus(); } catch (_) {} }
      }

      if (open && keyboardCollapsed) {
        rail.hidden = false;
        if (config.kind === 'hermenevtika') rail.style.display = initialRailInlineDisplay;
        keyboardCollapsed = false;
      }
      if (!open && keyboardHideRequested) {
        rail.hidden = true;
        if (config.kind === 'hermenevtika') rail.style.display = 'none';
        keyboardCollapsed = true;
        keyboardHideRequested = false;
      }

      setAttr(rail, 'aria-hidden', open ? 'false' : 'true');
      setInert(rail, !open);
      setAttr(badge, 'aria-controls', railId);
      setAttr(badge, 'aria-expanded', open ? 'true' : 'false');

      if (!keepAlternateVisible && alternate instanceof HTMLElement && alternateState) {
        if (open) {
          setAttr(alternate, 'aria-hidden', 'true');
          setInert(alternate, true);
          alternate.tabIndex = -1;
        } else {
          setAttr(alternate, 'aria-hidden', alternateState.ariaHidden);
          setInert(alternate, alternateState.inert);
          if (alternateState.tabIndex == null) alternate.removeAttribute('tabindex');
          else alternate.setAttribute('tabindex', alternateState.tabIndex);
        }
      }

      if (!open) chips.forEach((chip) => { chip.tabIndex = -1; });
      else {
        const active = rail.contains(document.activeElement) && document.activeElement.matches(config.chip)
          ? document.activeElement
          : selectedChip();
        setRoving(active);
      }
    }

    function scheduleSync() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => requestAnimationFrame(sync));
    }

    function selectForKeyboard(chip) {
      const rate = parseRate(chip);
      chips.forEach((candidate) => setAttr(candidate, 'aria-checked', candidate === chip ? 'true' : 'false'));
      persistRate(rate);
      setRoving(chip);
      try { chip.focus({ preventScroll: true }); } catch (_) { chip.focus(); }
    }

    function closeFromKeyboard() {
      keyboardHideRequested = true;
      try { badge.focus({ preventScroll: true }); } catch (_) { try { badge.focus(); } catch (_) {} }
      if (config.kind === 'gill' && typeof window.__gillCloseSpeedRail === 'function') {
        window.__gillCloseSpeedRail();
      }
      scheduleSync();
    }

    chips.forEach((chip, index) => {
      chip.addEventListener('focus', () => {
        if (isOpen()) setRoving(chip);
      });
      chip.addEventListener('keydown', (event) => {
        if (!isOpen()) return;
        let targetIndex = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') targetIndex = (index + 1) % chips.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') targetIndex = (index - 1 + chips.length) % chips.length;
        else if (event.key === 'Home') targetIndex = 0;
        else if (event.key === 'End') targetIndex = chips.length - 1;
        else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          // Both readers now use the same ReaderSpeedOptions/SpeedSlot owner.
          // The actual chip click applies the chosen rate and closes its rail;
          // do not call Gill's retired __gillCloseSpeedRail controller.
          keyboardHideRequested = true;
          chip.click();
          scheduleSync();
          return;
        } else return;
        event.preventDefault();
        event.stopPropagation();
        selectForKeyboard(chips[targetIndex]);
      });
      chip.addEventListener('click', scheduleSync);
    });

    badge.addEventListener('click', scheduleSync);
    rail.addEventListener('pointerup', scheduleSync);
    window.addEventListener('gb:tts-rate-change', scheduleSync, { signal: lifecycle.signal });

    const observer = new MutationObserver(scheduleSync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    observer.observe(rail, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden', 'aria-checked', 'tabindex', 'class'],
    });

    const record = {
      root, rail, badge, alternate, chips, sync, observer, kind: config.kind,
      dispose() {
        lifecycle.abort();
        observer.disconnect();
        root.removeAttribute(BOUND_ATTR);
      },
    };
    slots.add(record);
    sync();
  }

  function bindSlots() {
    document.querySelectorAll('.hmtop').forEach((root) => bindSpeedSlot(root, {
      kind: 'hermenevtika',
      rail: '.hm-speedrail',
      badge: '.hm-spdbadge',
      alternate: '.hm-slot-search',
      chip: '.hm-spd',
    }));
    document.querySelectorAll('[data-reader-mobile-speed][data-gill-mobile-bar]').forEach((root) => bindSpeedSlot(root, {
      kind: 'gill',
      rail: '.mobile-speedrail',
      badge: '.mobile-spdbadge',
      alternate: '.reader-mobile-menu-trigger',
      chip: '.mobile-speed',
    }));
  }

  function surfaceIsOpen(target) {
    if (!(target instanceof HTMLElement) || target.hidden || target.hasAttribute('inert')) return false;
    const ariaHidden = target.getAttribute('aria-hidden');
    if (ariaHidden === 'false') return true;
    if (ariaHidden === 'true') return false;
    return target.classList.contains('is-open') || target.classList.contains('open') || target.classList.contains('active');
  }

  function bindSurfaceRelation(config) {
    const target = document.querySelector(config.target);
    if (!(target instanceof HTMLElement)) return;
    const targetId = ensureId(target, config.fallbackId);
    let record = surfaceRelations.get(target);
    if (!record) {
      record = {
        target,
        targetId,
        triggers: new Set(),
        popup: config.popup || null,
        sync: null,
        observer: null,
      };
      record.sync = () => {
        const open = surfaceIsOpen(target);
        record.triggers.forEach((trigger) => {
          if (!(trigger instanceof HTMLElement) || !trigger.isConnected) {
            record.triggers.delete(trigger);
            return;
          }
          setAttr(trigger, 'aria-controls', targetId);
          setAttr(trigger, 'aria-expanded', open ? 'true' : 'false');
          if (record.popup) setAttr(trigger, 'aria-haspopup', record.popup);
        });
      };
      record.observer = new MutationObserver(record.sync);
      record.observer.observe(target, { attributes: true, attributeFilter: ['class', 'aria-hidden', 'hidden', 'inert'] });
      surfaceRelations.set(target, record);
    }

    document.querySelectorAll(config.trigger).forEach((trigger) => {
      if (trigger instanceof HTMLElement) record.triggers.add(trigger);
    });
    record.sync();
  }

  function bindSurfaceRelations() {
    [
      { trigger: '#hmBottomBtn, #hmSectionBtn, .hmtop [data-reader-mobile-menu-target="hmSectionBtn"]', target: '#hmSheet', fallbackId: 'hmSheet', popup: 'dialog' },
      { trigger: '#hmSettingsBtn, #hrailSettingsBtn, #gbFcSettings', target: '#hmSettings', fallbackId: 'hmSettings', popup: 'dialog' },
      { trigger: '#mobPartTocBtn, .mobile-top-bar [data-reader-mobile-menu-target="mobPartTocBtn"]', target: '#partTocOverlay', fallbackId: 'partTocOverlay', popup: 'dialog' },
      { trigger: '#mobTocBtn', target: '#seriesTocOverlay', fallbackId: 'seriesTocOverlay', popup: 'dialog' },
      { trigger: '[data-gill-settings-open]', target: '#gillSettingsOverlay', fallbackId: 'gillSettingsOverlay', popup: 'dialog' },
      { trigger: '[data-gill-learning-open]', target: '#gillLearningOverlay', fallbackId: 'gillLearningOverlay', popup: 'dialog' },
      { trigger: '#hMobileMenuBtn', target: '#hMobileNav', fallbackId: 'hMobileNav', popup: null },
    ].forEach(bindSurfaceRelation);
  }


  function syncPlayPopupSemantics() {
    document.querySelectorAll('[data-fc-action="play"]').forEach((button) => {
      const controls = button.getAttribute('aria-controls');
      const target = controls ? document.getElementById(controls) : null;
      if (target) return;
      button.removeAttribute('aria-haspopup');
      button.removeAttribute('aria-expanded');
    });
  }

  function refresh() {
    bindSlots();
    bindSurfaceRelations();
    slots.forEach((slot) => {
      if (!slot.root.isConnected) {
        slot.dispose();
        slots.delete(slot);
      } else slot.sync();
    });
    surfaceRelations.forEach((relation, target) => {
      if (!target.isConnected) {
        relation.observer?.disconnect();
        surfaceRelations.delete(target);
      } else relation.sync();
    });
    syncPlayPopupSemantics();
  }

  function init() {
    refresh();
    requestAnimationFrame(refresh);
    window.setTimeout(refresh, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('astro:before-swap', () => {
    // Do not retain detached speed controls across Astro client navigation.
    // Each surviving relation is rediscovered by the next page-load event.
    slots.forEach((slot) => slot.dispose());
    slots.clear();
    surfaceRelations.forEach((record) => record.observer?.disconnect());
    surfaceRelations.clear();
  });
  document.addEventListener('astro:page-load', init);
  window.addEventListener('pageshow', refresh);

  window.GBReaderControlsA11y = Object.freeze({
    version: VERSION,
    refresh,
    getState: () => Array.from(slots).map((slot) => ({
      kind: slot.kind,
      open: slot.rail.getAttribute('aria-hidden') === 'false',
      tabStops: slot.chips.filter((chip) => chip.tabIndex === 0).length,
      controls: slot.badge.getAttribute('aria-controls'),
      expanded: slot.badge.getAttribute('aria-expanded'),
    })),
    getSurfaceState: () => Array.from(surfaceRelations.values()).map((relation) => ({
      target: relation.targetId,
      open: surfaceIsOpen(relation.target),
      triggers: Array.from(relation.triggers).filter((trigger) => trigger.isConnected).map((trigger) => ({
        id: trigger.id || '',
        controls: trigger.getAttribute('aria-controls'),
        expanded: trigger.getAttribute('aria-expanded'),
        haspopup: trigger.getAttribute('aria-haspopup'),
      })),
    })),
  });
})();
