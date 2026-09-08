const OWNER = 'native-v1';
const POPOVER_ID = 'gb-strategic-map-popover';

function isKeyboardActivation(event) {
  return event.key === 'Enter' || event.key === ' ';
}

function positionPopover(popover, trigger) {
  const triggerRect = trigger.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const pad = 12;
  const gap = 10;

  let left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;
  left = Math.max(pad, Math.min(left, window.innerWidth - popoverRect.width - pad));

  let top = triggerRect.top - popoverRect.height - gap;
  if (top < pad) top = Math.min(window.innerHeight - popoverRect.height - pad, triggerRect.bottom + gap);
  top = Math.max(pad, top);

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function createPopover() {
  const existing = document.getElementById(POPOVER_ID);
  if (existing) return existing;

  const popover = document.createElement('div');
  popover.id = POPOVER_ID;
  popover.className = 'singleton-popover gb-strategic-map-popover';
  popover.dataset.gbStrategicMapOwner = OWNER;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.setAttribute('aria-label', 'Пояснение к стратегической карте');
  popover.hidden = true;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'popover-close-btn gb-strategic-map-popover__close';
  close.setAttribute('aria-label', 'Закрыть пояснение');
  close.textContent = '×';

  const body = document.createElement('div');
  body.className = 'gb-strategic-map-popover__body';

  popover.append(close, body);
  document.body.appendChild(popover);
  return popover;
}

function renderRecord(popover, record) {
  const body = popover.querySelector('.gb-strategic-map-popover__body');
  if (!body) return;
  body.replaceChildren();

  const blocks = Array.isArray(record?.blocks) ? record.blocks : [];
  for (const block of blocks) {
    const section = document.createElement('section');
    section.className = 'popover-section';

    if (block?.title) {
      const badge = document.createElement('strong');
      const safeType = String(block.type || '').replace(/[^a-z0-9_-]/gi, '');
      badge.className = `popover-badge${safeType ? ` color-${safeType}` : ''}`;
      badge.textContent = String(block.title);
      section.appendChild(badge);
    }

    if (block?.text) {
      const text = document.createElement('p');
      text.className = 'popover-text';
      text.textContent = String(block.text);
      section.appendChild(text);
    }

    body.appendChild(section);
  }
}

export function installArticleStrategicMap() {
  const dataNode = document.getElementById('strategicMapData');
  const triggers = [...document.querySelectorAll('.map-trigger[data-tip]')];
  if (!dataNode && triggers.length === 0) return Object.freeze({ enabled: false, triggers: 0, records: 0 });

  let records = null;
  try {
    records = JSON.parse(dataNode?.textContent || '{}');
  } catch (error) {
    document.documentElement.dataset.gbStrategicMapInvalid = 'json';
    console.error('[article strategic map] invalid strategicMapData JSON', error);
    return Object.freeze({ enabled: false, triggers: triggers.length, records: 0, invalid: true });
  }

  if (!records || Array.isArray(records) || typeof records !== 'object') {
    document.documentElement.dataset.gbStrategicMapInvalid = 'shape';
    console.error('[article strategic map] strategicMapData must be an object');
    return Object.freeze({ enabled: false, triggers: triggers.length, records: 0, invalid: true });
  }

  const popover = createPopover();
  const closeButton = popover.querySelector('.gb-strategic-map-popover__close');
  let activeTrigger = null;

  function close({ restoreFocus = false } = {}) {
    if (popover.hidden) return;
    popover.hidden = true;
    popover.classList.remove('active');
    if (activeTrigger) activeTrigger.setAttribute('aria-expanded', 'false');
    const previous = activeTrigger;
    activeTrigger = null;
    if (restoreFocus && previous?.focus) previous.focus({ preventScroll: true });
  }

  function open(trigger) {
    const key = trigger.getAttribute('data-tip') || '';
    const record = records[key];
    if (!record) {
      trigger.dataset.gbStrategicMapInvalid = 'missing-record';
      return;
    }

    if (activeTrigger && activeTrigger !== trigger) activeTrigger.setAttribute('aria-expanded', 'false');
    activeTrigger = trigger;
    renderRecord(popover, record);
    popover.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      positionPopover(popover, trigger);
      popover.classList.add('active');
    });
  }

  for (const trigger of triggers) {
    const key = trigger.getAttribute('data-tip') || '';
    trigger.dataset.gbStrategicMapOwner = OWNER;
    trigger.setAttribute('aria-controls', POPOVER_ID);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    if (!trigger.hasAttribute('role')) trigger.setAttribute('role', 'button');
    if (!trigger.hasAttribute('tabindex')) trigger.setAttribute('tabindex', '0');
    if (!trigger.hasAttribute('aria-label')) trigger.setAttribute('aria-label', `Открыть пояснение ${key}`);
    if (!(key in records)) trigger.dataset.gbStrategicMapInvalid = 'missing-record';

    if (trigger.dataset.gbStrategicMapBound === OWNER) continue;
    trigger.dataset.gbStrategicMapBound = OWNER;
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      if (activeTrigger === trigger && !popover.hidden) close();
      else open(trigger);
    });
    trigger.addEventListener('keydown', (event) => {
      if (!isKeyboardActivation(event)) return;
      event.preventDefault();
      event.stopPropagation();
      trigger.click();
    });
  }

  closeButton?.addEventListener('click', () => close({ restoreFocus: true }));
  document.addEventListener('pointerdown', (event) => {
    if (popover.hidden || popover.contains(event.target) || activeTrigger?.contains?.(event.target)) return;
    close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || popover.hidden) return;
    event.preventDefault();
    close({ restoreFocus: true });
  });
  window.addEventListener('resize', () => {
    if (!popover.hidden && activeTrigger) positionPopover(popover, activeTrigger);
  }, { passive: true });

  const unresolved = triggers.filter((trigger) => !(trigger.getAttribute('data-tip') in records)).length;
  document.documentElement.dataset.gbStrategicMapReady = unresolved === 0 ? '1' : 'invalid';
  return Object.freeze({ enabled: true, triggers: triggers.length, records: Object.keys(records).length, unresolved, close });
}
