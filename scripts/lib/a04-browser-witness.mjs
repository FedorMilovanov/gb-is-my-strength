/** Representative interaction witnesses for A04 shared tooltip projections. */
import { DESKTOP, MOBILE, INTERACTIVE, configureContext } from './a04-contract.mjs';

export async function inspectRoute(page, surfaces, legacy) {
  return page.evaluate(({ surfaces, legacy, interactiveSelector }) => {
    const isException = (node, selector) => Boolean(selector && (node.matches(selector) || node.closest(selector)));
    const inspect = (surface) => {
      const raw = [...document.querySelectorAll(surface.trigger)];
      const exceptions = raw.filter((node) => isException(node, surface.exception));
      const owned = raw.filter((node) => !isException(node, surface.exception));
      let unpaired = 0;
      let empty = 0;
      let nested = 0;
      const nestedSamples = [];
      const describe = (node) => {
        if (!node) return null;
        const id = node.id ? `#${node.id}` : '';
        const classes = [...node.classList].slice(0, 5).map((name) => `.${name}`).join('');
        return `${node.tagName.toLowerCase()}${id}${classes}`;
      };
      for (const trigger of owned) {
        const tips = [...trigger.querySelectorAll(surface.tip)];
        if (tips.length !== 1) unpaired += 1;
        if (tips.length === 1 && !(tips[0].textContent || '').trim()) empty += 1;
        const ancestor = trigger.parentElement?.closest(interactiveSelector);
        const clone = trigger.cloneNode(true);
        clone.querySelectorAll(surface.tip).forEach((node) => node.remove());
        const authoredDescendant = clone.querySelector(interactiveSelector);
        if (ancestor || authoredDescendant) {
          nested += 1;
          if (nestedSamples.length < 12) nestedSamples.push({
            trigger: describe(trigger),
            text: (trigger.childNodes[0]?.textContent || trigger.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
            ancestor: describe(ancestor),
            descendant: describe(authoredDescendant),
          });
        }
      }
      return {
        rawTriggerCount: raw.length,
        ownedTriggerCount: owned.length,
        exceptionCount: exceptions.length,
        tipCount: document.querySelectorAll(surface.tip).length,
        unpairedTriggerCount: unpaired,
        emptyContentCount: empty,
        nestedAuthoredInteractiveCount: nested,
        nestedSamples,
      };
    };
    const surfacesOut = Object.fromEntries(surfaces.map((surface) => [surface.id, inspect(surface)]));
    const legacyOut = Object.fromEntries(legacy.map((surface) => [surface.id, {
      triggerCount: document.querySelectorAll(surface.trigger).length,
      tipCount: document.querySelectorAll(surface.tip).length,
    }]));
    return { surfaces: surfacesOut, legacy: legacyOut };
  }, { surfaces, legacy, interactiveSelector: INTERACTIVE });
}

async function findHitTestableTrigger(page, surface) {
  const locator = page.locator(surface.trigger);
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const trigger = locator.nth(index);
    const eligible = await trigger.evaluate((node, data) => {
      const excluded = Boolean(data.exception && (node.matches(data.exception) || node.closest(data.exception)));
      return !excluded && node.querySelectorAll(data.tip).length === 1;
    }, surface).catch(() => false);
    if (!eligible) continue;
    await trigger.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(80);
    const hit = await trigger.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') return false;
      const x = Math.max(1, Math.min(innerWidth - 1, rect.left + rect.width / 2));
      const y = Math.max(1, Math.min(innerHeight - 1, rect.top + rect.height / 2));
      const top = document.elementFromPoint(x, y);
      return Boolean(top && (top === node || node.contains(top)));
    }).catch(() => false);
    if (hit) return { trigger, index };
  }
  return null;
}

async function ownerState(trigger, surface) {
  return trigger.evaluate((anchor, data) => {
    const activeTip = [...document.querySelectorAll(data.tip)].find((node) => node.classList.contains('gb-floating-tip') && node.classList.contains('is-open')) || null;
    const rect = activeTip?.getBoundingClientRect() || null;
    return {
      anchorOpen: anchor.classList.contains('is-open'),
      ariaExpanded: anchor.getAttribute('aria-expanded'),
      focusOnTrigger: document.activeElement === anchor,
      activeTip: Boolean(activeTip),
      mountedToBody: Boolean(activeTip && activeTip.parentElement === document.body),
      insideViewport: Boolean(rect && rect.left >= -6 && rect.top >= -6 && rect.right <= innerWidth + 6 && rect.bottom <= innerHeight + 6),
      rootOpen: document.documentElement.classList.contains('gb-tooltip-open'),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      tipContainsInteractive: Boolean(activeTip?.querySelector('a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])')),
      tipIsNestedInTrigger: Boolean(activeTip && anchor.contains(activeTip)),
      rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
    };
  }, surface);
}

async function closedState(trigger, surface) {
  return trigger.evaluate((anchor, data) => ({
    anchorOpen: anchor.classList.contains('is-open'),
    ariaExpanded: anchor.getAttribute('aria-expanded'),
    focusOnTrigger: document.activeElement === anchor,
    anyOpenTip: [...document.querySelectorAll(data.tip)].some((node) => node.classList.contains('is-open') || node.classList.contains('gb-floating-tip')),
    rootOpen: document.documentElement.classList.contains('gb-tooltip-open'),
  }), surface);
}

async function closeMobileTip(page, trigger, surface) {
  const closeControl = page.locator(`${surface.tip}.gb-floating-tip.is-open [data-tooltip-close]`).first();
  if (await closeControl.count()) {
    const visible = await closeControl.isVisible().catch(() => false);
    if (visible) {
      await closeControl.tap({ timeout: 4000 });
      return { method: 'explicit-close-control', point: null };
    }
  }

  const point = await trigger.evaluate((anchor, data) => {
    const interactive = 'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';
    const tip = [...document.querySelectorAll(data.tip)].find((node) => node.classList.contains('gb-floating-tip') && node.classList.contains('is-open')) || null;
    if (!tip) return null;
    const rect = tip.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const gap = 16;
    const candidates = [
      { x: centerX, y: rect.top - gap },
      { x: rect.left - gap, y: centerY },
      { x: rect.right + gap, y: centerY },
      { x: centerX, y: rect.bottom + gap },
      { x: 10, y: 10 },
      { x: innerWidth - 10, y: 10 },
    ];
    for (const candidate of candidates) {
      const x = Math.max(1, Math.min(innerWidth - 1, candidate.x));
      const y = Math.max(1, Math.min(innerHeight - 1, candidate.y));
      const target = document.elementFromPoint(x, y);
      if (!target) continue;
      if (tip.contains(target) || anchor.contains(target) || target.closest(interactive)) continue;
      return {
        x,
        y,
        target: target.tagName.toLowerCase(),
        targetId: target.id || '',
        targetClass: [...target.classList].slice(0, 5).join(' '),
      };
    }
    return null;
  }, surface);
  if (!point) throw new Error('no physical outside-tip close surface found');
  await page.touchscreen.tap(point.x, point.y);
  return { method: 'outside-tip-surface', point };
}

async function navigateForWitness(page, base, routes, surface) {
  for (const route of routes) {
    const pageErrors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)));
    let response = null;
    try {
      response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(180);
      const found = await findHitTestableTrigger(page, surface);
      if (found) return { ...found, route, responseStatus: response?.status() ?? null, pageErrors };
    } catch {}
  }
  return null;
}

export async function desktopWitness(browser, base, routes, surface) {
  const context = await browser.newContext({ viewport: DESKTOP, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  await configureContext(context, base);
  const page = await context.newPage();
  const result = {
    route: null, triggerIndex: null, responseStatus: null, pageErrors: [],
    focusable: false, focusOpens: null, opens: false, mountedToBody: false,
    tipDetachedFromTrigger: false, insideViewport: false, escapeCloses: false,
    focusContinuity: false, openState: null, closedState: null, error: '',
  };
  try {
    const witness = await navigateForWitness(page, base, routes, surface);
    if (!witness) throw new Error('no hit-testable owned trigger found');
    Object.assign(result, {
      route: witness.route, triggerIndex: witness.index,
      responseStatus: witness.responseStatus, pageErrors: witness.pageErrors,
    });
    const trigger = witness.trigger;
    await trigger.focus({ timeout: 3000 });
    result.focusable = await trigger.evaluate((node) => document.activeElement === node);
    await page.waitForTimeout(100);
    let state = await ownerState(trigger, surface);
    result.focusOpens = state.anchorOpen && state.activeTip;
    if (!result.focusOpens) {
      await trigger.click({ timeout: 4000 });
      await page.waitForTimeout(120);
      state = await ownerState(trigger, surface);
    }
    result.openState = state;
    result.opens = state.anchorOpen && state.ariaExpanded === 'true' && state.activeTip;
    result.mountedToBody = state.mountedToBody;
    result.tipDetachedFromTrigger = !state.tipIsNestedInTrigger;
    result.insideViewport = state.insideViewport;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(260);
    const closed = await closedState(trigger, surface);
    result.closedState = closed;
    result.escapeCloses = !closed.anchorOpen && !closed.anyOpenTip;
    result.focusContinuity = closed.focusOnTrigger;
  } catch (error) {
    result.error = String(error?.message || error).slice(0, 500);
  } finally {
    await context.close();
  }
  return result;
}

export async function mobileWitness(browser, base, routes, surface) {
  const context = await browser.newContext({
    viewport: MOBILE, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  await configureContext(context, base);
  const page = await context.newPage();
  const result = {
    route: null, triggerIndex: null, responseStatus: null, pageErrors: [],
    reducedMotion: false, touchOpens: false, mountedToBody: false,
    tipDetachedFromTrigger: false, insideViewport: false, secondTouchCloses: false,
    thirdTouchReopens: false, closeMethod: '', closePoint: null,
    openState: null, closedState: null, reopenedState: null, error: '',
  };
  try {
    const witness = await navigateForWitness(page, base, routes, surface);
    if (!witness) throw new Error('no hit-testable owned trigger found');
    Object.assign(result, {
      route: witness.route, triggerIndex: witness.index,
      responseStatus: witness.responseStatus, pageErrors: witness.pageErrors,
    });
    const trigger = witness.trigger;
    result.reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    await trigger.tap({ timeout: 4000 });
    await page.waitForTimeout(180);
    const state = await ownerState(trigger, surface);
    result.openState = state;
    result.touchOpens = state.anchorOpen && state.ariaExpanded === 'true' && state.activeTip;
    result.mountedToBody = state.mountedToBody;
    result.tipDetachedFromTrigger = !state.tipIsNestedInTrigger;
    result.insideViewport = state.insideViewport;
    if (!result.touchOpens) throw new Error(`first touch did not open tooltip: ${JSON.stringify(state)}`);

    await page.waitForTimeout(380);
    const closeAction = await closeMobileTip(page, trigger, surface);
    result.closeMethod = closeAction.method;
    result.closePoint = closeAction.point;
    await page.waitForTimeout(300);
    const closed = await closedState(trigger, surface);
    result.closedState = closed;
    result.secondTouchCloses = !closed.anchorOpen && !closed.anyOpenTip;
    if (!result.secondTouchCloses) throw new Error(`second touch did not close tooltip via ${result.closeMethod}: ${JSON.stringify(closed)}`);

    await trigger.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(140);
    await trigger.tap({ timeout: 4000 });
    await page.waitForTimeout(220);
    const reopened = await ownerState(trigger, surface);
    result.reopenedState = reopened;
    result.thirdTouchReopens = reopened.anchorOpen && reopened.ariaExpanded === 'true' && reopened.activeTip;
    if (!result.thirdTouchReopens) throw new Error(`third touch did not reopen tooltip: ${JSON.stringify(reopened)}`);
  } catch (error) {
    result.error = String(error?.message || error).slice(0, 500);
  } finally {
    await context.close();
  }
  return result;
}
