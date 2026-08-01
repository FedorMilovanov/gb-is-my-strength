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

async function physicalTriggerTap(page, trigger, label) {
  await trigger.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(120);
  const point = await trigger.evaluate((node, label) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const describe = (target) => target ? {
      tag: target.tagName?.toLowerCase() || null,
      id: target.id || '',
      className: [...(target.classList || [])].slice(0, 5).join(' '),
    } : null;
    if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') {
      return {
        hit: false,
        label,
        reason: 'trigger-not-visible',
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      };
    }
    const fractions = [
      [0.5, 0.5],
      [0.25, 0.5], [0.75, 0.5],
      [0.5, 0.25], [0.5, 0.75],
      [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75],
    ];
    const attempts = [];
    for (const [fx, fy] of fractions) {
      const x = Math.max(1, Math.min(innerWidth - 1, rect.left + rect.width * fx));
      const y = Math.max(1, Math.min(innerHeight - 1, rect.top + rect.height * fy));
      const top = document.elementFromPoint(x, y);
      const owned = Boolean(top && (top === node || node.contains(top)));
      attempts.push({ x, y, owned, top: describe(top) });
      if (owned) {
        return {
          hit: true,
          label,
          x,
          y,
          top: describe(top),
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
          attempts,
        };
      }
    }
    return {
      hit: false,
      label,
      reason: 'no-hit-testable-trigger-point',
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      attempts,
    };
  }, label);
  if (!point.hit) throw new Error(`${label} has no hit-testable trigger point: ${JSON.stringify(point)}`);
  await page.touchscreen.tap(point.x, point.y);
  return point;
}

async function ownerState(trigger, surface) {
  return trigger.evaluate((anchor, data) => {
    const activeTip = [...document.querySelectorAll(data.tip)].find((node) => node.classList.contains('gb-floating-tip') && node.classList.contains('is-open')) || null;
    const rect = activeTip?.getBoundingClientRect() || null;
    const close = activeTip?.querySelector(':scope > [data-tooltip-close]') || null;
    const closeRect = close?.getBoundingClientRect() || null;
    const anchorRect = anchor.getBoundingClientRect();
    const anchorCenter = {
      x: anchorRect.left + anchorRect.width / 2,
      y: anchorRect.top + anchorRect.height / 2,
    };
    const anchorTop = document.elementFromPoint(
      Math.max(1, Math.min(innerWidth - 1, anchorCenter.x)),
      Math.max(1, Math.min(innerHeight - 1, anchorCenter.y)),
    );
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
      closeControl: Boolean(close),
      closeControlVisible: Boolean(closeRect && closeRect.width > 0 && closeRect.height > 0 && getComputedStyle(close).visibility !== 'hidden'),
      closeControlRect: closeRect ? { left: closeRect.left, top: closeRect.top, right: closeRect.right, bottom: closeRect.bottom } : null,
      anchorRect: { left: anchorRect.left, top: anchorRect.top, right: anchorRect.right, bottom: anchorRect.bottom },
      anchorCenterHit: Boolean(anchorTop && (anchorTop === anchor || anchor.contains(anchorTop))),
      anchorCenterTop: anchorTop ? {
        tag: anchorTop.tagName?.toLowerCase() || null,
        id: anchorTop.id || '',
        className: [...(anchorTop.classList || [])].slice(0, 5).join(' '),
      } : null,
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
    thirdTouchReopens: false, closeMethod: '', touchPoints: [],
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
    result.touchPoints.push(await physicalTriggerTap(page, trigger, 'first-touch'));
    await page.waitForTimeout(180);
    const state = await ownerState(trigger, surface);
    result.openState = state;
    result.touchOpens = state.anchorOpen && state.ariaExpanded === 'true' && state.activeTip;
    result.mountedToBody = state.mountedToBody;
    result.tipDetachedFromTrigger = !state.tipIsNestedInTrigger;
    result.insideViewport = state.insideViewport;
    if (!result.touchOpens) throw new Error(`first physical touch did not open tooltip: ${JSON.stringify(state)}`);

    // SiteUtils deliberately suppresses the compatibility click generated after
    // a touch for 1600 ms. Wait past that owner-defined window so Chromium and
    // WebKit exercise the same second user interaction instead of racing it.
    await page.waitForTimeout(1750);
    result.touchPoints.push(await physicalTriggerTap(page, trigger, 'second-touch'));
    result.closeMethod = 'physical-trigger-toggle-after-suppression-window';
    await page.waitForTimeout(300);
    const closed = await closedState(trigger, surface);
    result.closedState = closed;
    result.secondTouchCloses = !closed.anchorOpen && !closed.anyOpenTip;
    if (!result.secondTouchCloses) throw new Error(`second physical touch did not close tooltip via ${result.closeMethod}: ${JSON.stringify(closed)}`);

    await page.waitForTimeout(1750);
    result.touchPoints.push(await physicalTriggerTap(page, trigger, 'third-touch'));
    await page.waitForTimeout(220);
    const reopened = await ownerState(trigger, surface);
    result.reopenedState = reopened;
    result.thirdTouchReopens = reopened.anchorOpen && reopened.ariaExpanded === 'true' && reopened.activeTip;
    if (!result.thirdTouchReopens) throw new Error(`third physical touch did not reopen tooltip: ${JSON.stringify(reopened)}`);
  } catch (error) {
    result.error = String(error?.message || error).slice(0, 500);
  } finally {
    await context.close();
  }
  return result;
}
