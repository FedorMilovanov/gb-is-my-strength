#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });
assert.ok(fs.existsSync(DIST), 'production-like dist is required');

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const ROUTES = [
  {
    id: 'herm',
    route: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
    slot: { root: '.hmtop', rail: '.hm-speedrail', badge: '.hm-spdbadge', alternate: null, chip: '.hm-spd' },
    mobileSurfaces: [
      { id: 'toc', trigger: '#hmSectionBtn', target: '#hmSheet', popup: 'dialog' },
      { id: 'settings', trigger: '#hmSettingsBtn', target: '#hmSettings', popup: 'dialog' },
    ],
    desktopSurfaces: [
      { id: 'settings', trigger: '#hrailSettingsBtn', target: '#hmSettings', popup: 'dialog' },
    ],
  },
  {
    id: 'gill',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    slot: { root: '[data-reader-mobile-speed][data-gill-mobile-bar]', rail: '.mobile-speedrail', badge: '.mobile-spdbadge', alternate: '.reader-mobile-menu-trigger', keepAlternateVisible: false, chip: '.mobile-speed' },
    mobileSurfaces: [
      { id: 'part-toc', trigger: '#mobPartTocBtn', target: '#partTocOverlay', popup: 'dialog' },
      { id: 'settings', trigger: '#mobSettingsBtn', target: '#gillSettingsOverlay', popup: 'dialog' },
      { id: 'research', trigger: '.mobile-top-bar [data-gill-marginalia-open]', target: '#partTocOverlay', popup: 'dialog' },
    ],
    desktopSurfaces: [
      { id: 'settings', trigger: '[data-gill-settings-open]', target: '#gillSettingsOverlay', popup: 'dialog' },
    ],
  },
  { id: 'antisovetov', route: '/articles/20-antisovetov-pastoru/' },
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function record(checks, id, description, pass, evidence = null) {
  checks.push({ id, description, pass: Boolean(pass), evidence });
}

async function installSpeechFixture(context) {
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('gbx-vosk-warmup', 'off');
      localStorage.setItem('gb:audio:rate', '1');
    } catch {}
    window.__controlsA11ySpeech = { speaks: 0, cancels: 0, lastText: '' };
    function FakeUtterance(text) {
      this.text = String(text || ''); this.rate = 1; this.lang = 'ru-RU';
      this.onboundary = null; this.onend = null; this.onerror = null;
    }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => {
        window.__controlsA11ySpeech.speaks += 1;
        window.__controlsA11ySpeech.lastText = utterance.text;
        window.__controlsA11ySpeech.active = utterance;
      },
      cancel: () => {
        window.__controlsA11ySpeech.cancels += 1;
        window.__controlsA11ySpeech.active = null;
      },
      pause: () => {}, resume: () => {}, addEventListener: () => {}, removeEventListener: () => {},
    };
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance }); }
    catch { window.SpeechSynthesisUtterance = FakeUtterance; }
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech }); }
    catch { window.speechSynthesis = speech; }
  });
}

async function slotSnapshot(page, selectors) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel.root);
    const rail = document.querySelector(sel.rail);
    const badge = document.querySelector(sel.badge);
    const alternate = sel.alternate ? document.querySelector(sel.alternate) : null;
    const chips = Array.from(document.querySelectorAll(sel.chip));
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    return {
      rootExists: Boolean(root), railExists: Boolean(rail), badgeExists: Boolean(badge), alternateExists: Boolean(alternate),
      railVisible: visible(rail), railAriaHidden: rail?.getAttribute('aria-hidden') || null,
      railInert: Boolean(rail?.inert || rail?.hasAttribute('inert')),
      alternateAriaHidden: alternate?.getAttribute('aria-hidden') || null,
      alternateInert: Boolean(alternate?.inert || alternate?.hasAttribute('inert')),
      badgeControls: badge?.getAttribute('aria-controls') || null,
      badgeExpanded: badge?.getAttribute('aria-expanded') || null,
      controlledExists: Boolean(badge?.getAttribute('aria-controls') && document.getElementById(badge.getAttribute('aria-controls'))),
      chipCount: chips.length,
      tabIndices: chips.map((chip) => chip.tabIndex),
      tabStops: chips.filter((chip) => chip.tabIndex === 0).length,
      checked: chips.map((chip, index) => chip.getAttribute('aria-checked') === 'true' ? index : -1).filter((index) => index >= 0),
      focused: chips.findIndex((chip) => chip === document.activeElement),
      focusOnBadge: document.activeElement === badge,
      focusInsideRail: Boolean(rail && rail.contains(document.activeElement)),
      rate: (() => { try { return localStorage.getItem('gb:audio:rate'); } catch { return null; } })(),
    };
  }, selectors);
}

// Browser geometry contract for the owner-approved Gill #75 side-swap.
// It catches optical regressions that static selectors and DOM-only QA miss.
async function gillPlayOptics(page) {
  return page.evaluate(() => {
    const top = document.querySelector('.mobile-top-bar[data-gill-mobile-bar]');
    if (!top) return null;
    const el = (selector) => top.querySelector(selector);
    const rect = (selector) => {
      const r = el(selector)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } : null;
    };
    const play = el('.reader-mobile-play');
    const rail = el('.reader-mobile-speedrail');
    const speedRects = Array.from(rail?.querySelectorAll('[data-speed]') || []).map((e) => e.getBoundingClientRect());
    return {
      anchors: ['#mobBackBtn', '.reader-mobile-home', '[data-gill-marginalia-open]',
        '.reader-mobile-play', '.reader-mobile-speed-badge', '.mobile-top-save'].map(rect),
      playBorder: getComputedStyle(play).borderWidth,
      playShadow: getComputedStyle(play).boxShadow,
      ringOpacity: Number(getComputedStyle(el('.reader-mobile-play .gb-ember__ring-svg')).opacity),
      ring: rect('.reader-mobile-play .gb-ember__ring-svg'),
      compound: rect('.reader-mobile-play-group'),
      rateBadge: rect('.reader-mobile-speed-badge'),
      rateChip: rect('.reader-mobile-speed-chip'),
      settingsButton: rect('#mobSettingsBtn'),
      ringTrackWidth: getComputedStyle(el('.reader-mobile-play .gb-ember__ring-track')).strokeWidth,
      ringProgressWidth: getComputedStyle(el('.reader-mobile-play .gb-ember__ring-progress')).strokeWidth,
      ringProgressTransition: getComputedStyle(el('.reader-mobile-play .gb-ember__ring-progress')).transitionDuration,
      speedPseudoPaint: (() => {
        const badge=el('.reader-mobile-speed-badge');
        const ps=getComputedStyle(badge,'::before');
        const actual=getComputedStyle(badge);
        return {border:ps.borderTopWidth,background:ps.backgroundColor,
          shadow:ps.boxShadow,content:ps.content,display:ps.display,
          badgeBackground:actual.backgroundColor,badgeBorder:actual.borderTopWidth};
      })(),
      settingsSvg: rect('#mobSettingsBtn svg'),
      speedGapToSettings: (() => {
        const chip=el('.reader-mobile-speed-chip')?.getBoundingClientRect();
        const icon=el('#mobSettingsBtn svg')?.getBoundingClientRect();
        return chip && icon ? icon.x-chip.right : -1;
      })(),
      chipPointerHitsBadge: (() => {
        const chip=el('.reader-mobile-speed-chip');
        const badge=el('.reader-mobile-speed-badge');
        if (!chip || !badge) return false;
        const r=chip.getBoundingClientRect();
        const hit=document.elementFromPoint(r.left+3,r.top+r.height/2);
        return hit===badge || badge.contains(hit);
      })(),
      playTriangleSafe: (() => {
        const play=el('.reader-mobile-play');
        if (!play) return false;
        const r=play.getBoundingClientRect();
        const hit=document.elementFromPoint(r.left+29,r.top+20);
        return hit===play || play.contains(hit);
      })(),
      rateCenterClickable: (() => {
        const badge=el('.reader-mobile-speed-badge');
        if (!badge) return false;
        const r=badge.getBoundingClientRect();
        const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return hit===badge || badge.contains(hit);
      })(),
      slot: rect('.mobile-top-slot'),
      backActive: ['#mobBackBtn','.reader-mobile-home'].every(s=>{
        const n=el(s);const r=n?.getBoundingClientRect();
        return !!r && !n.inert && getComputedStyle(n).opacity==='1' &&
          getComputedStyle(n).pointerEvents!=='none' &&
          (document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n ||
            n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)));
      }),
      selectedGold: (() => {
        const n=el('.reader-mobile-speed-rate[aria-checked="true"]');
        return n ? { border:getComputedStyle(n,'::before').borderColor,
          background:getComputedStyle(n,'::before').backgroundColor,
          underline:getComputedStyle(n,'::after').content } : null;
      })(),
      rail: rect('.reader-mobile-speedrail'),
      top: top.getBoundingClientRect().toJSON(),
      speedCount: speedRects.length,
      speedMinTap: speedRects.length ? Math.min(...speedRects.map((r) => r.width), ...speedRects.map((r) => r.height)) : 0,
      horizontal: speedRects.length > 1 && speedRects.every((r,i) =>
        !i || (r.left > speedRects[i-1].left && Math.abs(r.top-speedRects[0].top) < 2)),
    };
  });
}

async function auditSlot(page, routeId, selectors, checks) {
  const prefix = `${routeId}-slot`;
  await page.waitForFunction(() => Number(window.GBReaderControlsA11y?.version) >= 2, null, { timeout: 10000 });
  await page.evaluate(() => window.GBReaderControlsA11y.refresh());
  await page.waitForTimeout(80);

  const closed = await slotSnapshot(page, selectors);
  const gillBefore = routeId === 'gill' ? await gillPlayOptics(page) : null;
  record(checks, `${prefix}-01`, 'declared slot owners exist', closed.rootExists && closed.railExists && closed.badgeExists && (selectors.alternate ? closed.alternateExists : !closed.alternateExists), closed);
  record(checks, `${prefix}-02`, 'closed rail is aria-hidden', closed.railAriaHidden === 'true', closed);
  record(checks, `${prefix}-03`, 'closed rail is inert', closed.railInert, closed);
  record(checks, `${prefix}-04`, 'closed rail has zero Tab stops', closed.tabStops === 0, closed);
  record(checks, `${prefix}-05`, 'exactly one radio remains selected', closed.checked.length === 1, closed);
  record(checks, `${prefix}-06`, 'badge owns existing rail', Boolean(closed.badgeControls && closed.controlledExists), closed);
  record(checks, `${prefix}-07`, 'badge reports collapsed state', closed.badgeExpanded === 'false', closed);
  record(checks, `${prefix}-08`, 'declared alternate is exposed while closed (or absent by design)', selectors.alternate ? closed.alternateExists && closed.alternateAriaHidden !== 'true' && !closed.alternateInert : !closed.alternateExists, closed);

  await page.locator(selectors.badge).click();
  await page.waitForTimeout(120);
  const opened = await slotSnapshot(page, selectors);
  if (gillBefore) {
    const after = await gillPlayOptics(page);
    const fixed = after && gillBefore.anchors.every((anchor, i) =>
      anchor && after.anchors[i] &&
      Math.abs(anchor.x - after.anchors[i].x) < .5 &&
      Math.abs(anchor.y - after.anchors[i].y) < .5);
    record(checks, `${prefix}-25`, 'Play, bookmark, Back, Home and Marginalia do not shift when speeds expand',
      fixed, { before: gillBefore.anchors, after: after?.anchors });
    record(checks, `${prefix}-33`, 'overlapping rate hitbox never steals a Play triangle tap',
      gillBefore.playTriangleSafe === true && gillBefore.rateCenterClickable === true &&
      gillBefore.chipPointerHitsBadge === true,
      { playTriangleSafe: gillBefore.playTriangleSafe,
        rateCenter: gillBefore.rateCenterClickable,
        paintedChip: gillBefore.chipPointerHitsBadge });
    // W99: Keep separate physical 44px targets and DOM/tab order
    // [speed, Play, Settings]. Play must be adjacent to Settings instead
    // of stranded one full button to the left. The visible speed chip
    // alone overlaps the lower-right Play arc, never Settings.
    record(checks, `${prefix}-31`, 'Gill rate then Play then Settings: adjacent disjoint 44px controls and clickable chip',
      gillBefore.compound?.width >= 87.5 && gillBefore.compound?.width <= 88.5 &&
      gillBefore.rateBadge?.width >= 43.5 && gillBefore.rateBadge?.width <= 44.5 &&
      gillBefore.rateBadge?.height >= 43.5 && gillBefore.rateBadge?.height <= 44.5 &&
      gillBefore.anchors[3]?.x - gillBefore.rateBadge?.x >= 43.5 &&
      gillBefore.anchors[3]?.x - gillBefore.rateBadge?.x <= 44.5 &&
      gillBefore.anchors[3]?.x >= gillBefore.rateBadge?.right - .5 &&
      gillBefore.settingsButton?.x >= gillBefore.anchors[3]?.right - .5 &&
      gillBefore.settingsButton?.x - gillBefore.anchors[3]?.right <= 9 &&
      gillBefore.rateChip?.x >= gillBefore.anchors[3]?.x - .5 &&
      gillBefore.rateChip?.right <= gillBefore.settingsButton?.x + .5 &&
      gillBefore.rateChip?.bottom <= gillBefore.compound.bottom &&
      gillBefore.chipPointerHitsBadge && gillBefore.playTriangleSafe &&
      gillBefore.rateCenterClickable,
      { compound: gillBefore.compound, play: gillBefore.anchors[3],
        badge: gillBefore.rateBadge, chip: gillBefore.rateChip, settings: gillBefore.settingsButton,
        chipClickable: gillBefore.chipPointerHitsBadge,
        playTriangleSafe: gillBefore.playTriangleSafe, rateCenterClickable: gillBefore.rateCenterClickable });
    record(checks, `${prefix}-32`, 'historical W77 fine golden progress ring with smooth transition',
      Number.parseFloat(gillBefore.ringTrackWidth) >= 2.9 && Number.parseFloat(gillBefore.ringTrackWidth) <= 3.1 &&
      Number.parseFloat(gillBefore.ringProgressWidth) >= 3.5 && Number.parseFloat(gillBefore.ringProgressWidth) <= 3.7 &&
      Number.parseFloat(gillBefore.ringProgressTransition) >= 0.5,
      { trackStroke: gillBefore.ringTrackWidth,
        progressStroke: gillBefore.ringProgressWidth, transition: gillBefore.ringProgressTransition });
    record(checks, `${prefix}-34`, 'no painted phantom: pseudo disabled and real speed hit-area transparent',
      (gillBefore.speedPseudoPaint?.content === 'none' ||
        gillBefore.speedPseudoPaint?.display === 'none') &&
      gillBefore.speedPseudoPaint?.badgeBorder === '0px' &&
      ['transparent','rgba(0, 0, 0, 0)'].includes(gillBefore.speedPseudoPaint?.badgeBackground),
      gillBefore.speedPseudoPaint);
    record(checks, `${prefix}-35`, 'rate chip sits on lower-right ring arc, with compact clear Settings spacing',
      // The 24px badge tucks 4px left to meet the newly smaller 29px ring;
      // its hitbox remains the separate 44px rate button.
      gillBefore.rateChip?.x - gillBefore.anchors[3]?.x >= 15 &&
      gillBefore.rateChip?.x - gillBefore.anchors[3]?.x <= 18 &&
      gillBefore.rateChip?.bottom - gillBefore.ring?.bottom <= 6 &&
      gillBefore.speedGapToSettings >= 12 && gillBefore.speedGapToSettings <= 30 &&
      gillBefore.rateChip?.right <= gillBefore.settingsButton?.x + .5,
      {chip:gillBefore.rateChip,ring:gillBefore.ring,paintedGap:gillBefore.speedGapToSettings});
    record(checks, `${prefix}-30`, 'Visible speed chip overlap clicks its badge, never triggers Play',
      gillBefore?.chipPointerHitsBadge === true,{ chipOwner:gillBefore?.chipPointerHitsBadge });
    record(checks, `${prefix}-26`, 'Play uses exactly one SVG progress ring without duplicate CSS border or shadow',
      gillBefore.playBorder === '0px' && gillBefore.playShadow === 'none' && gillBefore.ringOpacity > .95 &&
        gillBefore.ring?.width === 32 && gillBefore.anchors[3]?.width === 44,
      { border: gillBefore.playBorder, shadow: gillBefore.playShadow, ringOpacity: gillBefore.ringOpacity });
    record(checks, `${prefix}-28`, 'Back and Home remain visible and operable while Gill speeds replace research slot',
      after?.backActive === true,{ after:after?.backActive, rail:after?.rail,slot:after?.slot });
    record(checks, `${prefix}-29`, 'Gill selected rate has its own gold capsule without a red underline',
      after?.selectedGold?.underline === 'none' && after?.selectedGold?.border!=='rgba(0, 0, 0, 0)',
      after?.selectedGold);
    record(checks, `${prefix}-27`, 'all six speeds form one scrollable 44px row inside the top bar',
      after && after.speedCount === 6 && after.horizontal && after.speedMinTap >= 43.5 &&
        after.rail.x >= 6 && after.rail.y >= 0 && after.rail.bottom <= after.top.bottom + 4 &&
        Math.abs(after.rail.x-after.slot.x) < .5 &&
        Math.abs(after.rail.width-after.slot.width-after.rateBadge.width) < 1 &&
        after.rail.right <= after.anchors[3].x + .5 &&
        after.rail.right >= after.anchors[3].x - 9,
      { rail: after?.rail, top: after?.top, speedCount: after?.speedCount,
        speedMinTap: after?.speedMinTap, horizontal: after?.horizontal });
  }
  record(checks, `${prefix}-09`, 'badge opens rail', opened.railVisible, opened);
  record(checks, `${prefix}-10`, 'open rail is exposed to AT', opened.railAriaHidden === 'false' && !opened.railInert, opened);
  record(checks, `${prefix}-11`, 'open rail has one roving Tab stop', opened.tabStops === 1, opened);
  record(checks, `${prefix}-12`, 'badge reports expanded state', opened.badgeExpanded === 'true', opened);
  record(checks, `${prefix}-13`, 'alternate visibility follows the declared speed layout', selectors.alternate ?
    opened.alternateExists && (selectors.keepAlternateVisible ?
      opened.alternateAriaHidden !== 'true' && !opened.alternateInert :
      opened.alternateAriaHidden === 'true' && opened.alternateInert) : !opened.alternateExists, opened);

  const selected = page.locator(`${selectors.chip}[aria-checked="true"]`).first();
  await selected.focus();
  const before = await slotSnapshot(page, selectors);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(80);
  const arrow = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-14`, 'ArrowRight moves focus', arrow.focused >= 0 && arrow.focused !== before.focused, { before, arrow });
  record(checks, `${prefix}-15`, 'ArrowRight changes selected rate', arrow.checked.length === 1 && arrow.checked[0] === arrow.focused, arrow);
  record(checks, `${prefix}-16`, 'ArrowRight preserves one Tab stop', arrow.tabStops === 1, arrow);
  record(checks, `${prefix}-17`, 'ArrowRight keeps rail open', arrow.railAriaHidden === 'false', arrow);
  record(checks, `${prefix}-18`, 'ArrowRight persists audio rate', arrow.rate !== before.rate, { before: before.rate, after: arrow.rate });

  await page.keyboard.press('End');
  await page.waitForTimeout(50);
  const end = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-19`, 'End moves to final radio', end.focused === end.chipCount - 1 && end.checked[0] === end.chipCount - 1, end);

  await page.keyboard.press('Home');
  await page.waitForTimeout(50);
  const home = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-20`, 'Home moves to first radio', home.focused === 0 && home.checked[0] === 0, home);

  await page.keyboard.press('Enter');
  // Gill's one-line rail takes 380ms to fold. Assert the settled keyboard/AT
  // state instead of a transient frame in its reversible exit animation.
  await page.waitForFunction(({ rail, badge, alternate }) => {
    const r = document.querySelector(rail);
    const b = document.querySelector(badge);
    const a = alternate ? document.querySelector(alternate) : null;
    // The shared speed slot uses inert + aria-hidden + CSS display:none;
    // unlike the retired Gill rail it does not set the HTML hidden property.
    const trulyClosed = !!r && (r.hidden ||
      (r.inert && r.getAttribute('aria-hidden') === 'true' && getComputedStyle(r).display === 'none'));
    return trulyClosed && r.getAttribute('aria-hidden') === 'true' &&
      b?.getAttribute('aria-expanded') === 'false' &&
      (!a || (!a.inert && a.getAttribute('aria-hidden') !== 'true'));
  }, { rail: selectors.rail, badge: selectors.badge, alternate: selectors.alternate }, { timeout: 2000 });
  const afterEnter = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-21`, 'Enter closes rail after activation', afterEnter.railAriaHidden === 'true' && !afterEnter.railVisible, afterEnter);
  record(checks, `${prefix}-22`, 'closed rail again has zero Tab stops', afterEnter.tabStops === 0, afterEnter);
  record(checks, `${prefix}-23`, 'focus returns to speed badge', afterEnter.focusOnBadge && !afterEnter.focusInsideRail, afterEnter);
  record(checks, `${prefix}-24`, 'alternate layer is restored', afterEnter.alternateAriaHidden !== 'true' && !afterEnter.alternateInert, afterEnter);
}

async function surfaceSnapshot(page, spec) {
  return page.evaluate(({ trigger, target }) => {
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    const candidates = Array.from(document.querySelectorAll(trigger));
    const triggerNode = candidates.find(visible) || candidates[0] || null;
    const targetNode = document.querySelector(target);
    const targetId = targetNode?.id || '';
    const open = Boolean(targetNode) && (
      targetNode.getAttribute('aria-hidden') === 'false'
      || targetNode.classList.contains('is-open')
      || targetNode.classList.contains('open')
      || targetNode.classList.contains('active')
    );
    return {
      triggerExists: Boolean(triggerNode),
      targetExists: Boolean(targetNode),
      targetId,
      controls: triggerNode?.getAttribute('aria-controls') || null,
      expanded: triggerNode?.getAttribute('aria-expanded') || null,
      haspopup: triggerNode?.getAttribute('aria-haspopup') || null,
      controlledExists: Boolean(triggerNode?.getAttribute('aria-controls') && document.getElementById(triggerNode.getAttribute('aria-controls'))),
      open,
    };
  }, spec);
}

async function clickVisible(page, selector) {
  const candidates = page.locator(selector);
  const count = await candidates.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return true;
    }
  }
  return false;
}

async function auditSurface(page, routeId, viewportId, spec, checks) {
  const prefix = `${routeId}-${viewportId}-surface-${spec.id}`;
  await page.evaluate(() => window.GBReaderControlsA11y.refresh());
  await page.waitForTimeout(80);
  const closed = await surfaceSnapshot(page, spec);
  record(checks, `${prefix}-01`, 'trigger and controlled surface exist', closed.triggerExists && closed.targetExists, closed);
  record(checks, `${prefix}-02`, 'trigger points to the exact surface', Boolean(closed.targetId && closed.controls === closed.targetId && closed.controlledExists), closed);
  record(checks, `${prefix}-03`, 'closed surface reports collapsed trigger state', !closed.open && closed.expanded === 'false', closed);
  if (spec.popup) record(checks, `${prefix}-04`, 'dialog trigger exposes popup semantics', closed.haspopup === spec.popup, closed);

  const clicked = await clickVisible(page, spec.trigger);
  record(checks, `${prefix}-05`, 'a rendered trigger can be activated', clicked, closed);
  await page.waitForTimeout(160);
  const opened = await surfaceSnapshot(page, spec);
  record(checks, `${prefix}-06`, 'trigger opens its declared surface', clicked && opened.open, opened);
  record(checks, `${prefix}-07`, 'open surface reports expanded trigger state', clicked && opened.expanded === 'true', opened);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(160);
  const afterEscape = await surfaceSnapshot(page, spec);
  record(checks, `${prefix}-08`, 'Escape closes surface and restores collapsed state', !afterEscape.open && afterEscape.expanded === 'false', afterEscape);
}

async function auditMobile(browser, origin, routeInfo) {
  const context = await browser.newContext({ viewport: MOBILE, isMobile: true, hasTouch: true });
  await installSpeechFixture(context);
  const page = await context.newPage();
  const checks = []; const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
  try {
    const response = await page.goto(origin + routeInfo.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(400);
    record(checks, `${routeInfo.id}-mobile-01`, 'route loads', Boolean(response && response.status() < 400), response?.status());
    record(checks, `${routeInfo.id}-mobile-02`, 'no uncaught page errors', pageErrors.length === 0, pageErrors);
    const base = await page.evaluate(() => ({
      controlsApi: window.GBReaderControlsA11y?.version || null,
      ttsApi: window.GBReaderTTS?.version || null,
      visiblePlay: Array.from(document.querySelectorAll('[data-fc-action="play"]')).filter((node) => {
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }).map((node) => ({ haspopup: node.getAttribute('aria-haspopup'), controls: node.getAttribute('aria-controls') })),
    }));
    record(checks, `${routeInfo.id}-mobile-03`, 'a11y controller API v2 is ready', Number(base.controlsApi) >= 2, base);
    record(checks, `${routeInfo.id}-mobile-04`, 'canonical TTS API remains ready', Number(base.ttsApi) >= 2, base);
    record(checks, `${routeInfo.id}-mobile-05`, 'exactly one Play is visible', base.visiblePlay.length === 1, base.visiblePlay);
    record(checks, `${routeInfo.id}-mobile-06`, 'mobile Play makes no false popup claim', base.visiblePlay.every((item) => item.haspopup !== 'true'), base.visiblePlay);

    // One canonical Settings trigger: Gill moves it beside Play, freeing
    // one full 44px bottom-bar slot for the real current chapter label.
    // Hermenevtika intentionally keeps its established bottom placement.
    if (routeInfo.id === 'gill') {
      const placement = await page.evaluate(() => {
        const top = document.querySelector('.mobile-top-bar[data-gill-mobile-bar]');
        const bottom = document.querySelector('.mobile-bottom-bar[data-gill-mobile-bar]');
        const settings = top?.querySelector('#mobSettingsBtn');
        const play = top?.querySelector('.reader-mobile-play-group')?.getBoundingClientRect();
        const gear = settings?.getBoundingClientRect();
        const save = top?.querySelector('.mobile-top-save')?.getBoundingClientRect();
        const section = bottom?.querySelector('#mobPartTocBtn')?.getBoundingClientRect();
        const actions = bottom?.querySelector('.reader-mobile-action-cluster');
        return {
          count: document.querySelectorAll('#mobSettingsBtn').length,
          top: Boolean(settings), bottom: Boolean(bottom?.querySelector('#mobSettingsBtn')),
          controls: settings?.getAttribute('aria-controls'), label: settings?.getAttribute('aria-label'),
          target: Boolean(document.getElementById('gillSettingsOverlay')),
          order: Boolean(play && gear && save && gear.x >= play.right - 1 && gear.right <= save.x + 1),
          target44: Boolean(gear && gear.width >= 44 && gear.height >= 44),
          chapterWidth: section?.width || 0,
          dockActions: actions?.querySelectorAll('.reader-mobile-action').length || 0,
          library: Boolean(actions?.querySelector('#gb-hl-fab')),
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      record(checks, 'gill-mobile-10', 'exactly one settings trigger beside Play, before bookmark',
        placement.count === 1 && placement.top && !placement.bottom && placement.order && placement.target44, placement);
      record(checks, 'gill-mobile-11', 'settings shares existing reader dialog and accessible name',
        placement.controls === 'gillSettingsOverlay' && placement.target && Boolean(placement.label), placement);
      record(checks, 'gill-mobile-12', 'bottom chapter reclaims 44px without displacing library/PDF/share',
        placement.chapterWidth >= 185 && placement.dockActions === 2 && placement.library && placement.overflow === 0, placement);

      // W99 owner geometry regression: 44px speed FIRST, then 44px Play,
      // then 44px Settings. Prior W77 pushed the visible Play a full slot
      // away; earlier W63 overlapped Play and Settings target hit areas.
      const tight = await page.evaluate(() => {
        const bar = document.querySelector('.mobile-top-bar[data-gill-mobile-bar]');
        const rate = bar?.querySelector('#mobSpdBadge');
        const play = bar?.querySelector('.reader-mobile-play');
        const settings = bar?.querySelector('#mobSettingsBtn');
        const chip = bar?.querySelector('.reader-mobile-speed-chip');
        if (!rate || !play || !settings || !chip) return null;
        const r = rate.getBoundingClientRect(), p = play.getBoundingClientRect();
        const s = settings.getBoundingClientRect(), c = chip.getBoundingClientRect();
        const ownerAt = (x, y) => {
          const b = document.elementFromPoint(x, y)?.closest('button');
          return b?.id || b?.getAttribute('data-fc-action') || '';
        };
        return {
          widths: [r.width, p.width, s.width], heights: [r.height, p.height, s.height],
          inline: Math.abs(r.right - p.left) <= .5 && Math.abs(p.right - s.left) <= .5,
          paintGap: s.x + s.width / 2 - (p.x + p.width / 2),
          chipInBounds: c.right <= s.left + .5 && c.left >= p.left - .5,
          rateOwner: ownerAt(r.x + r.width / 2, r.y + r.height / 2),
          playOwner: ownerAt(p.x + p.width / 2, p.y + p.height / 2),
          gearOwner: ownerAt(s.x + 2, s.y + s.height / 2),
          chipOwner: ownerAt(c.x + c.width / 2, c.y + c.height / 2),
          ringStroke: Number(getComputedStyle(play.querySelector('.gb-ember__ring-progress')).strokeWidth.replace('px','')),
        };
      });
      record(checks, 'gill-mobile-13', 'rate Play Settings are separate 44px targets with adjacent Play and safe chip',
        Boolean(tight && tight.widths.every(v => v >= 44) && tight.heights.every(v => v >= 44) &&
          tight.inline && tight.paintGap <= 44.5 && tight.chipInBounds &&
          tight.rateOwner === 'mobSpdBadge' && tight.playOwner === 'play' &&
          tight.gearOwner === 'mobSettingsBtn' && tight.chipOwner === 'mobSpdBadge' &&
          tight.ringStroke >= 3.5 && tight.ringStroke <= 3.7), tight);
    }
    if (routeInfo.slot) await auditSlot(page, routeInfo.id, routeInfo.slot, checks);
    for (const surface of routeInfo.mobileSurfaces || []) await auditSurface(page, routeInfo.id, 'mobile', surface, checks);

    if (routeInfo.id === 'gill') {
      await page.locator('#mobPartTocBtn').click();
      await page.waitForTimeout(200);
      const roman = await page.evaluate(() => {
        const nums = [...document.querySelectorAll('#partTocOverlay .gbat-num:not(.gbat-num--label)')];
        return {
          open: document.getElementById('partTocOverlay')?.classList.contains('is-open'),
          values: nums.map(e => e.textContent?.trim()),
          sizes: nums.map(e => parseFloat(getComputedStyle(e).fontSize)),
          styles: nums.map(e => getComputedStyle(e).fontStyle),
          visible: nums.some(e => e.getBoundingClientRect().width >= 40),
        };
      });
      record(checks, 'gill-mobile-14', 'mobile Roman headings are large, upright and visible inside the native TOC',
        Boolean(roman.open && roman.visible && roman.values.includes('I') &&
          roman.values.includes('II') && roman.sizes.every(n => n >= 24) &&
          roman.styles.every(s => s === 'normal')), roman);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
    }

    const play = page.locator('[data-fc-action="play"]:visible').first();
    const before = await page.evaluate(() => window.__controlsA11ySpeech.speaks);
    await play.click();
    await page.waitForTimeout(150);
    const speech = await page.evaluate(() => ({ ...window.__controlsA11ySpeech, state: window.GBReaderTTS?.getState?.() || null }));
    record(checks, `${routeInfo.id}-mobile-07`, 'one Play click starts one speech owner', speech.speaks - before === 1, speech);
    record(checks, `${routeInfo.id}-mobile-08`, 'speech projection remains non-empty', speech.lastText.length > 1, { length: speech.lastText.length });
    record(checks, `${routeInfo.id}-mobile-09`, 'no page errors after interaction', pageErrors.length === 0, pageErrors);

    if (checks.some((item) => !item.pass)) await page.screenshot({ path: path.join(REPORTS, `reader-controls-a11y-${routeInfo.id}-mobile.png`), fullPage: false });
    return { caseId: `${routeInfo.id}-mobile`, checks, pageErrors };
  } finally {
    await context.close();
  }
}

async function auditDesktop(browser, origin, routeInfo) {
  const context = await browser.newContext({ viewport: DESKTOP });
  await installSpeechFixture(context);
  const page = await context.newPage();
  const checks = []; const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
  try {
    const response = await page.goto(origin + routeInfo.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(350);
    const state = await page.evaluate(() => {
      const visible = Array.from(document.querySelectorAll('[data-fc-action="play"]')).filter((node) => {
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
      return {
        controlsApi: window.GBReaderControlsA11y?.version || null,
        plays: visible.map((node) => {
          const controls = node.getAttribute('aria-controls');
          return { haspopup: node.getAttribute('aria-haspopup'), controls, target: Boolean(controls && document.getElementById(controls)) };
        }),
      };
    });
    record(checks, `${routeInfo.id}-desktop-01`, 'desktop route loads', Boolean(response && response.status() < 400), response?.status());
    record(checks, `${routeInfo.id}-desktop-02`, 'desktop controller API v2 is ready', Number(state.controlsApi) >= 2, state);
    record(checks, `${routeInfo.id}-desktop-03`, 'desktop has one visible Play', state.plays.length === 1, state.plays);
    record(checks, `${routeInfo.id}-desktop-04`, 'desktop popup claim remains truthful', state.plays.every((item) => item.haspopup !== 'true' || (item.controls && item.target)), state.plays);
    record(checks, `${routeInfo.id}-desktop-05`, 'desktop has no page errors', pageErrors.length === 0, pageErrors);
    for (const surface of routeInfo.desktopSurfaces || []) await auditSurface(page, routeInfo.id, 'desktop', surface, checks);
    return { caseId: `${routeInfo.id}-desktop`, checks, pageErrors };
  } finally {
    await context.close();
  }
}

// W100 visual regression guard for the 526px phone/tablet screenshot.
// At this width all six canonical 44px rates fit. The historical W77
// fine ring remains 3px/3.6px, and rates must terminate just before Play
// rather than leaving the inaccessible 44px badge as blank space.
async function auditGillWideSpeed(browser, origin) {
  const context = await browser.newContext({ viewport: {width:526,height:844},
    isMobile:true, hasTouch:true, reducedMotion:'reduce' });
  const page = await context.newPage();
  const checks = [];
  try {
    const response = await page.goto(origin + '/articles/dzhon-gill-chast-2-uchenyi/',
      {waitUntil:'load', timeout:45000});
    record(checks,'gill-wide-speed-01','Gill wide mobile route loads',response?.status()===200,response?.status());
    await page.locator('#mobSpdBadge').click();
    await page.waitForTimeout(160);
    const geometry = await page.evaluate(() => {
      const rect = e => { const r=e?.getBoundingClientRect();return r?
        {x:r.x,y:r.y,width:r.width,right:r.right,bottom:r.bottom}:null; };
      const rail=document.querySelector('#mobileSpeedrail');
      const play=document.querySelector('.mobile-top-bar .reader-mobile-play');
      const rate=document.querySelector('#mobSpdBadge');
      const pill=[...rail.querySelectorAll('[data-speed]')];
      const r=rect(rail),p=rect(play),b=rect(rate);
      const last=pill[pill.length-1],l=rect(last);
      const hit=document.elementFromPoint(l.right-6,l.y+20)?.closest('button');
      const svg=play.querySelector('.gb-ember__ring-svg');
      const active=rail.querySelector('[aria-checked="true"]');
      const arc=play.querySelector('.gb-ember__ring-progress');
      const previous=play.style.getPropertyValue('--p');
      arc.style.setProperty('transition','none','important');
      const progressOffsets=[0,.5,1].map(value=>{
        play.style.setProperty('--p',String(value));
        const val=getComputedStyle(arc).strokeDashoffset;
        return Number(val.match(/[0-9.]+/)?.[0]);
      });
      if(previous) play.style.setProperty('--p',previous);
      else play.style.removeProperty('--p');
      arc.style.removeProperty('transition');
      return {open:rail.getAttribute('aria-hidden')==='false',r,p,b,ringSvgWidth:svg?.getBoundingClientRect().width,
        selectedShadow:active?getComputedStyle(active).boxShadow:null,progressOffsets,
        total:pill.length,allVisible:pill.every(e=>{const q=e.getBoundingClientRect();
          return q.left>=r.x-1&&q.right<=r.right+1}),
        gap:p.x-r.right,rateGap:r.right-b.right,scrollLeft:rail.scrollLeft,
        lastHit:hit?.getAttribute('data-speed')||null,
        playHit:document.elementFromPoint(p.x+22,p.y+22)?.closest('button')?.getAttribute('data-fc-action'),
        track:parseFloat(getComputedStyle(play.querySelector('.gb-ember__ring-track')).strokeWidth),
        progress:parseFloat(getComputedStyle(play.querySelector('.gb-ember__ring-progress')).strokeWidth),
        overflow:document.documentElement.scrollWidth-innerWidth};
    });
    record(checks,'gill-wide-speed-02','all six 44px rate options are visible without scrolling',
      geometry.open&&geometry.total===6&&geometry.allVisible&&geometry.scrollLeft===0,geometry);
    record(checks,'gill-wide-speed-03','speed rail fills former badge and ends flush before Play',
      geometry.gap>=0&&geometry.gap<=6&&geometry.rateGap<=6&&
      geometry.r.right<=geometry.p.x+.5,geometry);
    record(checks,'gill-wide-speed-04','last 2x option and Play have independent hit areas',
      geometry.lastHit==='2'&&geometry.playHit==='play'&&geometry.overflow===0,geometry);
    record(checks,'gill-wide-speed-05','historical W77 fine ring is 3px track and 3.6px progress',
      Math.abs(geometry.track-3)<.15&&Math.abs(geometry.progress-3.6)<.15,geometry);
    record(checks,'gill-wide-speed-06','selected 1x has no rectangular full-button shadow',
      geometry.selectedShadow==='none',{shadow:geometry.selectedShadow});
    record(checks,'gill-wide-speed-07','Play ring is 32px SVG inside independent 44px hit target',
      Math.abs(geometry.ringSvgWidth-32)<.2&&geometry.p.width===44,geometry);
    record(checks,'gill-wide-speed-08','real TTS --p from 0 to 1 drives ring arc at 0,50,100%',
      geometry.progressOffsets.length===3&&
      Math.abs(geometry.progressOffsets[0]-283)<1&&
      Math.abs(geometry.progressOffsets[1]-141.5)<1&&
      Math.abs(geometry.progressOffsets[2])<1,
      {offsets:geometry.progressOffsets});
    return {caseId:'gill-wide-speed',checks};
  } finally {await context.close()}
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  const cases = [];
  for (const route of ROUTES) cases.push(await auditMobile(browser, origin, route));
  for (const route of ROUTES.slice(0, 2)) cases.push(await auditDesktop(browser, origin, route));
  cases.push(await auditGillWideSpeed(browser, origin));
  const checks = cases.flatMap((item) => item.checks);
  const failures = checks.filter((item) => !item.pass);
  const summary = {
    sha: process.env.GITHUB_SHA || null,
    cases: cases.length,
    checks: checks.length,
    pass: checks.length - failures.length,
    failures: failures.length,
  };
  assert.ok(checks.length >= 100, `expected at least 100 named checks, got ${checks.length}`);
  assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'check IDs must be unique');
  fs.writeFileSync(path.join(REPORTS, 'reader-controls-a11y-browser-contract.json'), JSON.stringify({ summary, cases }, null, 2));
  const lines = [
    '# Reader controls accessibility browser contract', '',
    `- SHA: \`${summary.sha}\``, `- Cases: **${summary.cases}**`, `- Checks: **${summary.checks}**`,
    `- Pass: **${summary.pass}**`, `- Failures: **${summary.failures}**`, '',
    '| Case | Checks | Pass | Fail |', '|---|---:|---:|---:|',
    ...cases.map((item) => `| ${item.caseId} | ${item.checks.length} | ${item.checks.filter((check) => check.pass).length} | ${item.checks.filter((check) => !check.pass).length} |`),
    '', '## Failures', '',
    ...(failures.length ? failures.map((item) => `- **${item.id}** — ${item.description}; evidence: \`${JSON.stringify(item.evidence).slice(0, 700)}\``) : ['None.']),
  ];
  fs.writeFileSync(path.join(REPORTS, 'reader-controls-a11y-browser-contract.md'), lines.join('\n'));
  for (const item of checks) console.log(`[READER-CONTROLS-A11Y] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`);
  console.log('[READER-CONTROLS-A11Y-SUMMARY]', JSON.stringify(summary));
  assert.equal(failures.length, 0, `${failures.length} reader controls accessibility checks failed`);
  console.log('Reader controls accessibility browser contract: PASS.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
