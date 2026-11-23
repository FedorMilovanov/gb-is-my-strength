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
      searchButton: rect('.reader-mobile-top-search'),
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
      speedGapToSearch: (() => {
        const chip=el('.reader-mobile-speed-chip')?.getBoundingClientRect();
        const search=el('.reader-mobile-top-search')?.getBoundingClientRect();
        return chip && search ? search.x-chip.right : -1;
      })(),
      chipPointerHitsPlay: (() => {
        const chip=el('.reader-mobile-speed-chip');
        const play=el('.reader-mobile-play');
        if (!chip || !play) return false;
        const r=chip.getBoundingClientRect();
        const hit=document.elementFromPoint(r.left+3,r.top+r.height/2);
        return hit===play || play.contains(hit);
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
    const fixed = after && gillBefore.anchors.every((anchor, i) => {
      const later = after.anchors[i];
      // Save legitimately lives in the bottom bar below 440px: both
      // snapshots omit it from the TOP bar, which must not count as drift.
      if (!anchor || !later) return !anchor && !later;
      return Math.abs(anchor.x - later.x) < .5 &&
        Math.abs(anchor.y - later.y) < .5;
    });
    record(checks, `${prefix}-25`, 'Play, bookmark, Back, Home and Marginalia do not shift when speeds expand',
      fixed, { before: gillBefore.anchors, after: after?.anchors });
    record(checks, `${prefix}-33`, 'painted rate echo never steals Play arc taps; separate speed target remains clickable',
      gillBefore.playTriangleSafe === true && gillBefore.rateCenterClickable === true &&
      gillBefore.chipPointerHitsPlay === true,
      { playTriangleSafe: gillBefore.playTriangleSafe,
        rateCenter: gillBefore.rateCenterClickable,
        paintedChipDelegatesToPlay: gillBefore.chipPointerHitsPlay });
    // W124/W126: Keep independent physical 44px targets and DOM/tab order
    // [speed, Play, Search, Settings, Save if room]. The rate echo touches
    // only Play's painted lower arc; Search has its own complete hitbox.
    record(checks, `${prefix}-31`, 'Gill rate then Play then Settings: distinct 44px controls and decorative rate echo',
      gillBefore.compound?.width >= 87.5 && gillBefore.compound?.width <= 88.5 &&
      gillBefore.rateBadge?.width >= 43.5 && gillBefore.rateBadge?.width <= 44.5 &&
      gillBefore.rateBadge?.height >= 43.5 && gillBefore.rateBadge?.height <= 44.5 &&
      gillBefore.anchors[3]?.x - gillBefore.rateBadge?.x >= 43.5 &&
      gillBefore.anchors[3]?.x - gillBefore.rateBadge?.x <= 44.5 &&
      gillBefore.anchors[3]?.x >= gillBefore.rateBadge?.right - .5 &&
      gillBefore.searchButton?.x >= gillBefore.anchors[3]?.right - .5 &&
      gillBefore.searchButton?.x - gillBefore.anchors[3]?.right <= 4 &&
      gillBefore.settingsButton?.x >= gillBefore.searchButton?.right - .5 &&
      gillBefore.settingsButton?.x - gillBefore.searchButton?.right <= 4 &&
      gillBefore.rateChip?.x >= gillBefore.anchors[3]?.x - .5 &&
      gillBefore.rateChip?.right <= gillBefore.searchButton?.x + .5 &&
      gillBefore.rateChip?.bottom <= gillBefore.compound.bottom &&
      gillBefore.chipPointerHitsPlay && gillBefore.playTriangleSafe &&
      gillBefore.rateCenterClickable,
      { compound: gillBefore.compound, play: gillBefore.anchors[3],
        badge: gillBefore.rateBadge, chip: gillBefore.rateChip,
        search: gillBefore.searchButton, settings: gillBefore.settingsButton,
        chipDelegatesToPlay: gillBefore.chipPointerHitsPlay,
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
      gillBefore.speedGapToSearch >= 0 && gillBefore.speedGapToSearch <= 12 &&
      gillBefore.rateChip?.right <= gillBefore.searchButton?.x + .5,
      {chip:gillBefore.rateChip,ring:gillBefore.ring,paintedGap:gillBefore.speedGapToSearch});
    record(checks, `${prefix}-30`, 'painted 1x chip is visual only; tap on its Play-side arc targets Play',
      gillBefore?.chipPointerHitsPlay === true,{ chipDelegatesToPlay:gillBefore?.chipPointerHitsPlay });
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
        const search = top?.querySelector('.reader-mobile-top-search')?.getBoundingClientRect();
        const saveNode = document.querySelector('.mobile-top-save');
        const save = saveNode?.getBoundingClientRect();
        const saveBelow = Boolean(saveNode && bottom?.contains(saveNode));
        const section = bottom?.querySelector('#mobPartTocBtn')?.getBoundingClientRect();
        const actions = bottom?.querySelector('.reader-mobile-action-cluster');
        return {
          count: document.querySelectorAll('#mobSettingsBtn').length,
          top: Boolean(settings), bottom: Boolean(bottom?.querySelector('#mobSettingsBtn')),
          controls: settings?.getAttribute('aria-controls'), label: settings?.getAttribute('aria-label'),
          target: Boolean(document.getElementById('gillSettingsOverlay')),
          order: Boolean(play && search && gear && save &&
            search.x >= play.right - 1 && search.x - play.right <= 4 &&
            gear.x >= search.right - 1 && gear.x - search.right <= 4 &&
            (saveBelow || (save.x >= gear.right - 1 && save.x - gear.right <= 4))),
          saveBelow, save44: Boolean(save && save.width >= 44 && save.height >= 44),
          saveCount: document.querySelectorAll('.mobile-top-save').length,
          target44: Boolean(gear && gear.width >= 44 && gear.height >= 44),
          chapterWidth: section?.width || 0,
          dockActions: actions?.querySelectorAll('.reader-mobile-action').length || 0,
          library: Boolean(actions?.querySelector('#gb-hl-fab')),
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      record(checks, 'gill-mobile-10', 'one Settings follows Play then Search, with one reachable Save',
        placement.count === 1 && placement.top && !placement.bottom &&
        placement.order && placement.target44 && placement.save44 &&
        placement.saveCount === 1 && placement.saveBelow, placement);
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
        const search = bar?.querySelector('.reader-mobile-top-search');
        const chip = bar?.querySelector('.reader-mobile-speed-chip');
        if (!rate || !play || !settings || !search || !chip) return null;
        const r = rate.getBoundingClientRect(), p = play.getBoundingClientRect();
        const s = settings.getBoundingClientRect(), se = search.getBoundingClientRect();
        const c = chip.getBoundingClientRect();
        const ownerAt = (x, y) => {
          const b = document.elementFromPoint(x, y)?.closest('button');
          return b?.id || b?.getAttribute('data-fc-action') || '';
        };
        return {
          widths: [r.width, p.width, se.width, s.width],
          heights: [r.height, p.height, se.height, s.height],
          inline: Math.abs(r.right - p.left) <= .5 &&
            se.x >= p.right - .5 && se.x - p.right <= 4 &&
            s.x >= se.right - .5 && s.x - se.right <= 4,
          chipInBounds: c.right <= se.left + .5 && c.left >= p.left - .5,
          rateOwner: ownerAt(r.x + r.width / 2, r.y + r.height / 2),
          playOwner: ownerAt(p.x + p.width / 2, p.y + p.height / 2),
          gearOwner: ownerAt(s.x + 2, s.y + s.height / 2),
          chipOwner: ownerAt(c.x + c.width / 2, c.y + c.height / 2),
          chipPointerEvents: getComputedStyle(chip).pointerEvents,
          playTapGrid: Array.from({ length: 16 }, (_, i) => ownerAt(
            p.x + p.width * ((i % 4) + .5) / 4,
            p.y + p.height * (Math.floor(i / 4) + .5) / 4)),
          ringStroke: Number(getComputedStyle(play.querySelector('.gb-ember__ring-progress')).strokeWidth.replace('px','')),
        };
      });
      record(checks, 'gill-mobile-13', 'rate Play Search Settings remain distinct 44px targets with safe speed echo',
        Boolean(tight && tight.widths.every(v => v >= 44) && tight.heights.every(v => v >= 44) &&
          tight.inline && tight.chipInBounds &&
          tight.rateOwner === 'mobSpdBadge' && tight.playOwner === 'play' &&
          tight.gearOwner === 'mobSettingsBtn' && tight.chipOwner === 'play' &&
          tight.chipPointerEvents === 'none' &&
          tight.ringStroke >= 3.5 && tight.ringStroke <= 3.7), tight);
      record(checks, 'gill-mobile-15', 'painted 1x echo cannot steal Play taps; speed retains separate 44px hit area',
        Boolean(tight && tight.playTapGrid.length === 16 &&
          tight.playTapGrid.every(v => v === 'play') &&
          tight.rateOwner === 'mobSpdBadge'), tight);
    }
    if (routeInfo.slot) await auditSlot(page, routeInfo.id, routeInfo.slot, checks);
    if (routeInfo.id === 'gill') {
      // W112: W109's decorative painted speed echo remained visible over Play
      // but tapping it after a rate choice started TTS instead of reopening
      // the rail. Test the real touch coordinate, not just elementFromPoint.
      const speechBeforeRateTap = await page.evaluate(() => window.__controlsA11ySpeech.speaks);
      await page.locator('#mobSpdBadge').click();
      await page.locator('#mobileSpeedrail [data-speed="1.25"]').click();
      await page.waitForFunction(() => document.querySelector('#mobSpdBadge')?.getAttribute('aria-expanded') === 'false');
      const rateEcho = await page.locator('.mobile-top-bar .reader-mobile-speed-chip').boundingBox();
      if (rateEcho) await page.touchscreen.tap(rateEcho.x + rateEcho.width / 2, rateEcho.y + rateEcho.height / 2);
      await page.waitForTimeout(80);
      const restored = await page.evaluate(() => ({
        expanded: document.querySelector('#mobSpdBadge')?.getAttribute('aria-expanded'),
        rate: localStorage.getItem('gb:audio:rate'),
        speech: window.__controlsA11ySpeech.speaks,
      }));
      record(checks, 'gill-mobile-16', 'tap on visible selected-rate echo reopens speeds without starting Play',
        Boolean(rateEcho && restored.expanded === 'true' && restored.rate === '1.25' &&
          restored.speech === speechBeforeRateTap), { rateEcho, restored, speechBeforeRateTap });
      if (restored.expanded === 'true') {
        await page.locator('#mobileSpeedrail [data-speed="1.5"]').click();
        await page.waitForFunction(() => document.querySelector('#mobSpdBadge')?.getAttribute('aria-expanded') === 'false');
        const echoAgain = await page.locator('.mobile-top-bar .reader-mobile-speed-chip').boundingBox();
        if (echoAgain) await page.touchscreen.tap(echoAgain.x + echoAgain.width / 2, echoAgain.y + echoAgain.height / 2);
        const reopened = await page.evaluate(() => ({
          expanded: document.querySelector('#mobSpdBadge')?.getAttribute('aria-expanded'),
          rate: localStorage.getItem('gb:audio:rate'),
          speech: window.__controlsA11ySpeech.speaks,
        }));
        record(checks, 'gill-mobile-17', 'speed echo works repeatedly after second selection; no accidental speech',
          Boolean(echoAgain && reopened.expanded === 'true' && reopened.rate === '1.5' &&
            reopened.speech === speechBeforeRateTap), { reopened, echoAgain });
      }
      await page.keyboard.press('Escape');
    }
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
      // Last speed may be outside the narrow rail viewport until the user
      // scrolls horizontally. Check the ACTUAL reachable destination.
      rail.scrollLeft = rail.scrollWidth;
      const scrolledLast=last.getBoundingClientRect();
      const hit=document.elementFromPoint(
        scrolledLast.left+scrolledLast.width/2,
        scrolledLast.top+scrolledLast.height/2)?.closest('button');
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
        total:pill.length,minimumRateSize:Math.min(...pill.map(e=>e.getBoundingClientRect().width)),
        lastVisible:scrolledLast.left>=r.x-1&&scrolledLast.right<=r.right+1,
        gap:p.x-r.right,rateGap:r.right-b.right,scrollLeft:rail.scrollLeft,
        lastHit:hit?.getAttribute('data-speed')||null,
        playHit:document.elementFromPoint(p.x+22,p.y+22)?.closest('button')?.getAttribute('data-fc-action'),
        track:parseFloat(getComputedStyle(play.querySelector('.gb-ember__ring-track')).strokeWidth),
        progress:parseFloat(getComputedStyle(play.querySelector('.gb-ember__ring-progress')).strokeWidth),
        overflow:document.documentElement.scrollWidth-innerWidth};
    });
    record(checks,'gill-wide-speed-02','six 44px speeds remain reachable, including the last after real horizontal scroll',
      geometry.open&&geometry.total===6&&geometry.minimumRateSize>=43.5&&
      geometry.lastVisible&&geometry.lastHit==='2',geometry);
    record(checks,'gill-wide-speed-03','speed rail fills former badge and ends flush before Play',
      geometry.gap>=0&&geometry.gap<=6&&geometry.rateGap<=6&&
      geometry.r.right<=geometry.p.x+.5,geometry);
    await page.locator('#mobileSpeedrail [data-speed="2"]').click();
    await page.waitForFunction(() => document.querySelector('#mobSpdBadge')?.getAttribute('aria-expanded')==='false');
    const selectedTwo=await page.evaluate(() => ({
      checked: document.querySelector('#mobileSpeedrail [data-speed="2"]')?.getAttribute('aria-checked'),
      saved: localStorage.getItem('gb:audio:rate')
    }));
    record(checks,'gill-wide-speed-04','last 2x activates after scroll while Play remains a distinct target',
      geometry.lastHit==='2'&&geometry.playHit==='play'&&geometry.overflow===0&&
      selectedTwo.checked==='true'&&selectedTwo.saved==='2',{geometry,selectedTwo});
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

async function auditGillVisibleGaps(browser, origin, width) {
  const context = await browser.newContext({viewport:{width,height:844},
    isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page = await context.newPage();
  const checks=[];
  try {
    const response=await page.goto(origin+'/articles/dzhon-gill-chast-2-uchenyi/',
      {waitUntil:'load',timeout:45000});
    const metrics=await page.evaluate(()=>{
      const bar=document.querySelector('.mobile-top-bar[data-gill-mobile-bar]');
      const play=bar?.querySelector('.reader-mobile-play');
      const search=bar?.querySelector('.reader-mobile-top-search');
      const settings=bar?.querySelector('#mobSettingsBtn');
      const bookmark=document.querySelector('.mobile-top-save');
      const ink=e=>e?.getBoundingClientRect();
      const ring=ink(play?.querySelector('.gb-ember__ring-track'));
      const glass=ink(search?.querySelector('svg'));
      const gear=ink(settings?.querySelector('svg'));
      const book=ink(bookmark?.querySelector('svg'));
      if(!bar||!ring||!glass||!gear||!book||!bookmark)return null;
      const center=r=>(r.left+r.right)/2;
      const pr=ink(play),sr=ink(search),gr=ink(settings),br=ink(bookmark);
      const pitch1=center(glass)-center(ring);
      const pitch2=center(gear)-center(glass);
      const saveTop=bar.contains(bookmark);
      const pitch3=saveTop?center(book)-center(gear):null;
      const owner=el=>{
        const r=ink(el);
        return !!r && r.width>=43.5 && r.height>=43.5 &&
          document.elementFromPoint(center(r),(r.top+r.bottom)/2)?.closest('button')===el;
      };
      return {pitch1,pitch2,pitch3,saveTop,
        ringCentered:Math.abs(center(ring)-center(pr))<.5,
        searchCentered:Math.abs(center(glass)-center(sr))<.5,
        settingsCentered:Math.abs(center(gear)-center(gr))<.5,
        playHit:owner(play),searchHit:owner(search),settingsHit:owner(settings),saveHit:owner(bookmark),
        properOrder:pr.right<=sr.left+1&&sr.right<=gr.left+1&&(!saveTop||gr.right<=br.left+1),
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    record(checks,'gill-visual-spacing-'+width,
      'current Play Search Settings Save icon centres have one uniform pitch and real 44px hits',
      response?.status()===200&&Boolean(metrics&&
        metrics.pitch1>=43&&metrics.pitch1<=48&&
        Math.abs(metrics.pitch1-metrics.pitch2)<=1&&
        (metrics.pitch3===null||Math.abs(metrics.pitch2-metrics.pitch3)<=1)&&
        metrics.saveTop===(width>=440)&&metrics.properOrder&&
        metrics.ringCentered&&metrics.searchCentered&&metrics.settingsCentered&&
        metrics.playHit&&metrics.searchHit&&metrics.settingsHit&&metrics.saveHit&&metrics.overflow===0),metrics);
    return {caseId:'gill-spacing-'+width,checks};
  } finally {await context.close()}
}

async function auditGillAnalyticsCenter(browser, origin, width) {
  const context = await browser.newContext({ viewport: {width,height:844},
    isMobile:true,hasTouch:true,reducedMotion:'reduce' });
  const page=await context.newPage(),checks=[];
  try {
    const response=await page.goto(origin+'/articles/dzhon-gill-chast-2-uchenyi/',
      {waitUntil:'load',timeout:45000});
    const geometry=await page.evaluate(()=>{
      const bar=document.querySelector('.mobile-top-bar');
      const slot=bar?.querySelector('.mobile-top-slot');
      const button=slot?.querySelector('.reader-mobile-menu-trigger');
      const icon=button?.querySelector('svg'),label=button?.querySelector('span');
      const rate=bar?.querySelector('#mobSpdBadge');
      const homeSvg=bar?.querySelector('#mobHomeBtn svg');
      const ring=bar?.querySelector('.reader-mobile-play .gb-ember__ring-track');
      if(!bar||!slot||!button||!icon||!label||!rate||!homeSvg||!ring)return null;
      const R=e=>e.getBoundingClientRect();
      const a=R(icon),b=R(label),s=R(slot),r=R(rate),t=R(button);
      const home=R(homeSvg),playCircle=R(ring);
      const visibleLabel=getComputedStyle(label).display!=='none'&&b.width>0;
      const left=visibleLabel?Math.min(a.left,b.left):a.left;
      const right=visibleLabel?Math.max(a.right,b.right):a.right;
      const center=(left+right)/2;
      const desired=(home.right+playCircle.left)/2;
      const inkWidth=right-left;
      const low=s.left+1+inkWidth/2;
      const high=s.right-1-inkWidth/2;
      const feasible=low<=high;
      const closest=feasible?Math.max(low,Math.min(high,desired)):null;
      const picked=document.elementFromPoint(center,(t.top+t.bottom)/2)?.closest('button');
      return {
        leftGap:left-home.right,
        rightGap:playCircle.left-right,
        opticalDelta:(left-home.right)-(playCircle.left-right),
        opticalError:feasible?Math.abs(center-closest):null,
        feasible,inkWidth,slotWidth:s.width,
        gapToRate:r.left-right,
        contained:left>=s.left-.25&&right<=s.right+.25,
        fullLabel:!visibleLabel||(label.textContent?.trim()==='Аналитика'&&
          label.scrollWidth<=label.clientWidth+1),
        labelVisible:visibleLabel,
        hit:picked===button,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
    });
    record(checks,'gill-analytics-center-'+width,
      'Analytics ink stays inside its own slot at the closest feasible Home-to-Play optical centre',
      response?.status()===200&&Boolean(geometry&&geometry.feasible&&
        geometry.opticalError<=1.25&&
        geometry.leftGap>=0&&geometry.rightGap>=0&&geometry.gapToRate>=0&&
        geometry.contained&&geometry.fullLabel&&geometry.hit&&geometry.overflow===0),geometry);
    return {caseId:'gill-analytics-'+width,checks};
  } finally {await context.close()}
}

async function auditGillDualProgress(browser, origin, width, dark = false) {
  const context = await browser.newContext({
    viewport: { width, height: 844 }, isMobile: true, hasTouch: true,
    reducedMotion: 'reduce', serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const checks = [];
  const read = () => page.evaluate(() => {
    const root = document.querySelector('#gbs2DualProgress');
    const label = document.querySelector('#gbs2MobPct');
    const article = document.querySelector('#gbs2MobArticleRing');
    const series = document.querySelector('#gbs2MobSeriesRing');
    if (!root || !label || !article || !series) return null;
    const css = getComputedStyle(label);
    const R = root.getBoundingClientRect(), L = label.getBoundingClientRect();
    const aria = root.getAttribute('aria-label') || '';
    const v = aria.match(/Статья\s*(\d+)%,\s*серия\s*(\d+)%/i);
    const articlePct = v ? Number(v[1]) : null;
    const seriesPct = v ? Number(v[2]) : null;
    const ar = Number(article.style.strokeDashoffset);
    const sr = Number(series.style.strokeDashoffset);
    return { value: label.textContent?.trim(), aria, articlePct, seriesPct,
      centerX: (L.left+L.right)/2 - (R.left+R.right)/2,
      centerY: (L.top+L.bottom)/2 - (R.top+R.bottom)/2,
      labelSize: [L.width,L.height], ringSize: [R.width,R.height],
      visible: css.display === 'flex' && css.clipPath === 'none' && L.width >= 30,
      arcsMatch: articlePct !== null && seriesPct !== null &&
        Math.abs(ar - (2*Math.PI*12.5*(1-articlePct/100))) < 1 &&
        Math.abs(sr - (2*Math.PI*16*(1-seriesPct/100))) < 1,
      ringCount: root.querySelectorAll('circle').length,
      semantic: root.getAttribute('role') === 'img',
      overflow: document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    };
  });
  try {
    const response = await page.goto(
      origin + '/articles/dzhon-gill-chast-2-uchenyi/', { waitUntil: 'load' });
    if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForFunction(() => {
      const e = document.querySelector('#gbs2DualProgress');
      return e && /Статья\s*\d+%,\s*серия\s*\d+%/i.test(
        e.getAttribute('aria-label') || '');
    });
    const before = await read();
    record(checks, 'gill-dual-progress-' + width + (dark ? '-dark' : '-light'),
      'Gill center percent visible; inner article and outer series arcs agree with live semantic label',
      Boolean(response?.status() === 200 && before && before.visible &&
        /^\d+%$/.test(before.value || '') &&
        Number(before.value.replace('%','')) === before.articlePct &&
        Math.abs(before.centerX) < .5 && Math.abs(before.centerY) < .5 &&
        before.arcsMatch && before.ringCount === 4 && before.semantic &&
        before.overflow === 0), before);
    await page.evaluate(() => window.scrollTo(0,
      Math.max(1100, Math.floor(document.documentElement.scrollHeight * .47))));
    await page.waitForFunction(() => {
      const v = parseInt(document.querySelector('#gbs2MobPct')?.textContent || '0', 10);
      return v > 8;
    }, undefined, { timeout: 6000 });
    const after = await read();
    record(checks, 'gill-dual-progress-scroll-' + width + (dark ? '-dark' : '-light'),
      'Gill article percent remains readable and updates with both real progress arcs after scroll',
      Boolean(after && after.visible && after.articlePct > before.articlePct &&
        Number(after.value.replace('%','')) === after.articlePct &&
        after.arcsMatch && after.semantic && after.overflow === 0), after);
    return { caseId: 'gill-dual-progress-' + width + (dark ? '-dark':'-light'), checks };
  } finally { await context.close(); }
}

async function auditGillScrollLockPosition(browser, origin, kind, resizeUnderLock) {
  const caseId = 'gill-position-' + kind + (resizeUnderLock ? '-resize' : '-control');
  const checks = [];
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce'
  });
  const p = await ctx.newPage();
  const get = () => p.evaluate(() => ({
    reading: window.GBReaderState?.getSnapshot(),
    saved: window.GBReaderState?.getSaved(),
    lock: document.documentElement.getAttribute('data-scroll-locked'),
    scrollY: Math.round(window.scrollY),
    overlayCount: document.documentElement.getAttribute('data-overlay-count')
  }));
  try {
    const url = origin + '/articles/dzhon-gill-chast-2-uchenyi/';
    await p.goto(url, { waitUntil: 'load' });
    await p.mouse.wheel(0, 16000);
    await p.waitForTimeout(300);
    await p.evaluate(() => window.scrollTo(0,
      Math.floor((document.documentElement.scrollHeight-innerHeight) * .52)));
    await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(650);
    // Gill's top bar intentionally hides during downward reading. Reveal it
    // with a real upward wheel gesture before tapping its Settings button.
    if (kind === 'settings') {
      await p.mouse.wheel(0, -220);
      await p.waitForTimeout(500);
    }
    await p.waitForTimeout(700);
    const before = await get();
    record(checks, caseId+'-starting-position',
      'mid-chapter position has a real section anchor and persisted progress',
      Boolean(before.reading?.progress > 25 && before.reading?.progress < 75 &&
        before.reading?.sectionId && before.saved?.sectionId === before.reading.sectionId),
      before);
    await p.locator(kind === 'settings' ? '#mobSettingsBtn' : '#mobPartTocBtn').click();
    await p.waitForTimeout(250);
    const open = await get();
    if (resizeUnderLock) {
      await p.setViewportSize({ width: 390, height: 720 });
      await p.waitForTimeout(500);
    }
    const locked = await get();
    record(checks, caseId+'-overlay-freeze',
      'scroll-lock and viewport resize preserve logical position instead of 0%/100%',
      Boolean(open.lock === '1' && locked.lock === '1' &&
        open.reading?.sectionId === before.reading?.sectionId &&
        locked.reading?.sectionId === before.reading?.sectionId &&
        Math.abs(locked.reading?.progress - before.reading?.progress) <= 1),
      { before, open, locked });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    const after = await get();
    record(checks, caseId+'-unlock-position',
      'last unlock recalculates geometry without overwriting saved anchor',
      Boolean(after.lock !== '1' && after.reading?.sectionId === before.reading?.sectionId &&
        after.saved?.sectionId === before.reading?.sectionId &&
        Math.abs(after.reading?.progress - before.reading?.progress) <= 2 &&
        Math.abs(after.saved?.progress - before.saved?.progress) <= 2),
      { before, after });
    const newtab = await ctx.newPage();
    await newtab.goto(url, { waitUntil: 'load' });
    await newtab.waitForTimeout(850);
    const button = newtab.locator('.gbs2-resume-go:visible').first();
    const offered = await button.count() > 0;
    if (offered) {
      await button.click();
      await newtab.waitForTimeout(1000);
    }
    const resumed = await newtab.evaluate(() => ({
      snapshot: window.GBReaderState?.getSnapshot(),
      saved: window.GBReaderState?.getSaved(),
      y: Math.round(window.scrollY)
    }));
    record(checks, caseId+'-new-tab-real-resume',
      'actual Continue button restores the same semantic reading section in new tab',
      Boolean(offered && resumed.snapshot?.sectionId === before.reading?.sectionId &&
        resumed.y > 0 && resumed.saved?.sectionId === before.reading?.sectionId),
      { offered, resumed, startingSection: before.reading?.sectionId });
    return { caseId, checks };
  } catch (error) {
    record(checks, caseId+'-exception', 'position scenario must complete',
      false, { message: String(error.stack || error).slice(0, 1100) });
    return { caseId, checks };
  } finally {
    await ctx.close();
  }
}

async function auditGillNestedScrollLock(browser, origin) {
  const caseId = 'gill-position-nested-lock';
  const checks = [];
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true,
    hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce'
  });
  const p = await ctx.newPage();
  const snap = () => p.evaluate(() => ({
    state: window.GBReaderState?.getSnapshot(),
    saved: window.GBReaderState?.getSaved(),
    locked: document.documentElement.getAttribute('data-scroll-locked')
  }));
  try {
    await p.goto(origin + '/articles/dzhon-gill-chast-2-uchenyi/', { waitUntil: 'load' });
    await p.mouse.wheel(0, 12000);
    // Let the real wheel input settle before placing the deterministic
    // mid-chapter target; otherwise its delayed delta can move the fixture
    // close to the next section boundary during the following viewport resize.
    await p.waitForTimeout(300);
    await p.evaluate(() => window.scrollTo(0,
      Math.floor((document.documentElement.scrollHeight-innerHeight) * .52)));
    await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(1300);
    const before = await snap();
    await p.locator('#mobPartTocBtn').click();
    await p.evaluate(() => window.SiteUtils.lockScroll('w106-contract-nested'));
    await p.setViewportSize({ width: 390, height: 720 });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(350);
    const nested = await snap();
    record(checks, caseId+'-still-locked',
      'closing first overlay cannot thaw ReaderState while a second owner holds scroll-lock',
      Boolean(before.state?.sectionId && nested.locked === '1' &&
        nested.state?.sectionId === before.state.sectionId &&
        nested.state?.progress === before.state.progress &&
        nested.saved?.sectionId === before.saved?.sectionId),
      { before, nested });
    await p.evaluate(() => window.SiteUtils.unlockScroll('w106-contract-nested'));
    await p.waitForTimeout(1250);
    const after = await snap();
    record(checks, caseId+'-final-release',
      'last owner unlock restores accurate section and scroll position and retains saved anchor',
      Boolean(after.locked !== '1' &&
        after.state?.sectionId === before.state?.sectionId &&
        after.saved?.sectionId === before.saved?.sectionId &&
        Math.abs(after.state?.scrollY - before.state?.scrollY) <= 1 &&
        Math.abs(after.saved?.scrollY - before.saved?.scrollY) <= 1 &&
        Math.abs(after.state?.progress - before.state?.progress) < 2),
      { before, after });
    return { caseId, checks };
  } catch (error) {
    record(checks, caseId+'-exception','nested-lock case must finish', false, String(error.stack||error).slice(0,1000));
    return { caseId, checks };
  } finally { await ctx.close(); }
}

async function auditGillNarrowZoomBar(browser, origin, width, dark = false) {
  const caseId = 'gill-narrow-zoom-bar-' + width + (dark ? '-dark' : '');
  const checks = [];
  const ctx = await browser.newContext({
    viewport: { width, height: 700 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', reducedMotion: 'reduce'
  });
  const page = await ctx.newPage();
  try {
    const response = await page.goto(origin + '/articles/dzhon-gill-chast-2-uchenyi/',
      { waitUntil: 'load' });
    if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
    const state = await page.evaluate(() => {
      const bar = document.querySelector('[data-gill-v16] .mobile-top-bar');
      const settings = document.getElementById('mobSettingsBtn');
      const save = document.querySelector('.mobile-top-save');
      if (!bar || !settings || !save) return { missing: true };
      const box = el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height };
      };
      const before = {
        width: bar.clientWidth, scrollWidth: bar.scrollWidth,
        overflowX: getComputedStyle(bar).overflowX,
        touchAction: getComputedStyle(bar).touchAction,
        settings: box(settings), save: box(save)
      };
      bar.scrollLeft = bar.scrollWidth;
      return {
        before, scrollLeft: bar.scrollLeft,
        settings: box(settings), save: box(save),
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        viewportWidth: innerWidth
      };
    });
    const inside = b => !!b && b.left >= -1 && b.right <= width + 1 &&
      b.width >= 43.9 && b.height >= 43.9;
    const narrow = width <= 269;
    record(checks, caseId,
      'at <=269px zoom both trailing controls remain reachable; approved 320px+ bar remains unchanged',
      Boolean(response?.status() === 200 && !state.missing &&
        state.documentOverflow <= 1 &&
        inside(state.settings) && inside(state.save) &&
        (narrow
          ? state.before.overflowX === 'auto' &&
            state.before.touchAction.includes('pan-x') &&
            state.before.touchAction.includes('pan-y') &&
            state.before.scrollWidth > state.before.width &&
            state.scrollLeft > 0
          : state.before.overflowX === 'visible' &&
            state.before.scrollWidth <= state.before.width + 1 &&
            state.scrollLeft === 0)),
      state);
  } catch (error) {
    record(checks, caseId+'-exception', 'narrow zoom bar contract completes',
      false, String(error.stack || error).slice(0, 1000));
  } finally { await ctx.close(); }
  return { caseId, checks };
}

async function auditGillStableMobileChrome(browser, origin, width, height, dark = false) {
  const caseId = 'gill-stable-mobile-chrome-' + width + 'x' + height + (dark ? '-dark' : '');
  const checks = [];
  const ctx = await browser.newContext({
    viewport: { width, height }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', reducedMotion: 'reduce'
  });
  const page = await ctx.newPage();
  const read = () => page.evaluate(() => {
    const query = (sel) => document.querySelector(sel);
    const rect = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height,
        right: r.right, bottom: r.bottom,
        scrollH: node.scrollHeight, clientH: node.clientHeight };
    };
    const bar = query('.mobile-bottom-bar');
    const title = query('#gbs2MobSec');
    const toc = query('#gbs2PartToc');
    const research = query('#gbrMarginalia');
    const root = query('#partTocOverlay');
    return {
      bar: rect(bar), titleButton: rect(query('#mobPartTocBtn')),
      actionCluster: rect(query('.reader-mobile-action-cluster')),
      progressRing: rect(query('#gbs2DualProgress')),
      title: title?.textContent?.trim(),
      lineClamp: title ? getComputedStyle(title).webkitLineClamp : null,
      sheet: rect(query('#partTocOverlay .toc-sheet')),
      footer: rect(query('#partTocOverlay .toc-sheet__actions')),
      tabs: rect(query('#partTocOverlay .gbr-marginalia-tabs')),
      toc: rect(toc), tocVisible: !toc?.hidden,
      research: rect(research), researchVisible: !research?.hidden,
      tocOverflow: toc ? getComputedStyle(toc).overflowY : null,
      researchOverflow: research ? getComputedStyle(research).overflowY : null,
      selectedToc: query('#gbrTocTab')?.getAttribute('aria-selected'),
      selectedResearch: query('#gbrMarginaliaTab')?.getAttribute('aria-selected'),
      overlayOpen: root?.classList.contains('is-open'),
      xOverflow: document.documentElement.scrollWidth - innerWidth
    };
  });
  const aligned = (a,b) => !!(a && b &&
    Math.abs(a.x-b.x)<.8 && Math.abs(a.y-b.y)<.8 &&
    Math.abs(a.w-b.w)<.8 && Math.abs(a.h-b.h)<.8);
  try {
    const response = await page.goto(origin + '/articles/dzhon-gill-chast-2-uchenyi/',
      { waitUntil: 'load' });
    if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.evaluate(() => document.fonts.ready);
    const normal = await read();
    await page.locator('#gbs2MobSec').evaluate((node) => {
      node.textContent =
        'Гилл и Джордж Уайтфилд: сотрудничество, разногласия и спор об историческом наследии';
    });
    const long = await read();
    record(checks, caseId+'-reading-bar-fixed',
      'same bar width, height, top and icon centres for short and long H2/H3 titles',
      Boolean(response?.status() === 200 &&
        aligned(normal.bar,long.bar) &&
        aligned(normal.progressRing,long.progressRing) &&
        aligned(normal.actionCluster,long.actionCluster) &&
        aligned(normal.titleButton,long.titleButton) &&
        long.bar?.w <= width + .8 && long.bar?.w >= width - .8 &&
        long.lineClamp === '2' && normal.xOverflow === 0 && long.xOverflow === 0),
      { normal, long });
    // Restore the real section title; no permanent DOM or saved data mutation.
    await page.locator('#gbs2MobSec').evaluate((node, value) => {
      node.textContent = value;
    }, normal.title);
    await page.locator('#mobPartTocBtn').click();
    await page.waitForTimeout(650);
    const first = await read();
    await page.locator('#gbrMarginaliaTab').click();
    await page.waitForTimeout(80);
    const research = await read();
    record(checks, caseId+'-tab-fixed-sheet',
      'TOC and Analytics share the same real outer rectangle and fixed footer location',
      Boolean(first.overlayOpen && research.overlayOpen &&
        first.selectedToc === 'true' && research.selectedResearch === 'true' &&
        aligned(first.sheet,research.sheet) &&
        aligned(first.footer,research.footer) &&
        aligned(first.tabs,research.tabs) &&
        first.tocVisible && !first.researchVisible &&
        !research.tocVisible && research.researchVisible),
      { first, research });
    const firstGroup = page.locator('#gbrMarginalia details.gbr-marginalia-group > summary').first();
    if (await firstGroup.count()) await firstGroup.click();
    const expanded = await read();
    record(checks, caseId+'-research-expansion',
      'opening a large Analytics disclosure only scrolls inner content, never resizes the sheet',
      Boolean(aligned(research.sheet,expanded.sheet) &&
        aligned(research.footer,expanded.footer) &&
        research.researchOverflow === 'auto' &&
        research.research?.clientH > 45 && expanded.xOverflow === 0),
      { research, expanded });
    // W114: the Gill mobile Analytics term rows must be readable without
    // resizing the approved sheet, changing Play or reducing touch targets.
    if (width <= 768) {
      const conceptGroup = page.locator('#gbrMarginalia .gbr-marginalia-group-head')
        .filter({ hasText: 'Понятия' }).first();
      if (await conceptGroup.count()) await conceptGroup.click();
      const termRows = await page.locator('#gbrMarginalia .gbr-marginalia-term > summary')
        .evaluateAll(nodes => {
          // The Analytics title must preserve the real article spelling;
          // canonical glossary keys intentionally normalize word case.
          const sourceLabels = Array.from(document.querySelectorAll('article .gterm[data-term]'))
            .map(term => {
              const plain = term.cloneNode(true);
              plain.querySelectorAll('.gtip,.btip,.tooltip,[hidden],[aria-hidden="true"]')
                .forEach(child => child.remove());
              return (plain.textContent || '').replace(/\s+/g, ' ').trim();
            });
          return nodes.map(node => ({
            label: node.textContent.trim(),
            sourceMatch: sourceLabels.includes(node.textContent.trim()),
            fontPx: parseFloat(getComputedStyle(node).fontSize),
            height: node.getBoundingClientRect().height,
            width: node.getBoundingClientRect().width,
            scrollWidth: node.scrollWidth
          }));
        });
      const withTerms = await read();
      record(checks, caseId+'-analytics-term-readability',
        'Analytics term names use >=15px text, >=44px tap targets and do not resize the approved Gill sheet',
        Boolean(termRows.length > 0 &&
          termRows.every(row => row.sourceMatch && row.fontPx >= 14.9 && row.height >= 43.9 &&
            row.scrollWidth <= row.width + 1) &&
          aligned(first.sheet, withTerms.sheet) &&
          aligned(first.footer, withTerms.footer) &&
          withTerms.xOverflow === 0),
        { termRows, withTerms });
    }
    await page.locator('#gbrTocTab').click();
    const returned = await read();
    const collapsed = page.locator('#partTocOverlay .gbat-part:not(.open) .gbat-hd').first();
    if (await collapsed.count()) await collapsed.click();
    const unfolded = await read();
    record(checks, caseId+'-toc-expansion',
      'returning to TOC and expanding another chapter cannot change the sheet dimensions',
      Boolean(aligned(first.sheet,returned.sheet) &&
        aligned(first.footer,returned.footer) &&
        aligned(first.sheet,unfolded.sheet) &&
        aligned(first.footer,unfolded.footer) &&
        unfolded.tocOverflow === 'auto' && unfolded.toc?.clientH > 45 &&
        unfolded.xOverflow === 0),
      { first, returned, unfolded });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const closed = await read();
    record(checks, caseId+'-close-safe',
      'Escape returns to article with unchanged fixed reading bar and working controls',
      Boolean(!closed.overlayOpen && aligned(normal.bar,closed.bar) &&
        aligned(normal.progressRing,closed.progressRing) &&
        aligned(normal.actionCluster,closed.actionCluster) &&
        closed.xOverflow === 0),
      { normal, closed });
    if (width <= 526 && height >= 700) {
      const directOpener = page.locator('.mobile-top-bar [data-gill-marginalia-open]');
      await directOpener.click();
      await page.waitForTimeout(650);
      const direct = await read();
      record(checks, caseId+'-direct-research-opener',
        'the independent Analytics toolbar opener uses the identical fixed TOC sheet',
        Boolean(direct.overlayOpen && direct.selectedResearch === 'true' &&
          aligned(first.sheet,direct.sheet) && aligned(first.footer,direct.footer) &&
          aligned(first.tabs,direct.tabs)),
        { first, direct });
      await page.keyboard.press('Escape');
    }
    return { caseId, checks };
  } catch (error) {
    record(checks, caseId+'-exception', 'stable chrome scenario completes',
      false, { message:String(error.stack || error).slice(0,1300) });
    return { caseId, checks };
  } finally {
    await ctx.close();
  }
}

async function auditGillTooltipSelection(browser, origin) {
  const caseId = 'gill-tooltip-selection-halo';
  const checks = [];
  const ctx = await browser.newContext({
    viewport: { width: 600, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', reducedMotion: 'reduce'
  });
  const page = await ctx.newPage();
  try {
    await page.goto(origin + '/articles/dzhon-gill-chast-2-uchenyi/', { waitUntil: 'load' });
    await page.locator('abbr.gterm[data-term="солтерс-холл"]').first().scrollIntoViewIfNeeded();
    const result = await page.evaluate(() => {
      const term = document.querySelector('abbr.gterm[data-term="солтерс-холл"]');
      const paragraph = term?.closest('p');
      if (!term || !paragraph) return { missing: true };
      // A native long press / dragged word can leave a selected paragraph
      // behind the modal backdrop, yielding horizontal selection bands.
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const prior = selection.toString().length;
      term.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, detail:1 }));
      return {
        prior,
        remaining: window.getSelection()?.toString().length || 0,
        open: Boolean(document.querySelector('.gtip.gb-floating-tip.is-open')),
        dim: Boolean(document.querySelector('[data-overlay-owner], .gb-overlay-backdrop')),
      };
    });
    record(checks, caseId+'-selected-term',
      'opening the tapped glossary term clears only its own selected paragraph to avoid dimming stripes',
      result.prior > 100 && result.remaining === 0 && result.open,
      result);
    await page.keyboard.press('Escape');
    const distinct = await page.evaluate(() => {
      const term = document.querySelector('abbr.gterm[data-term="солтерс-холл"]');
      const outside = Array.from(document.querySelectorAll('article p'))
        .find(p => p !== term.closest('p') && p.textContent.length > 80);
      if (!outside) return { missing: true };
      const range = document.createRange();
      range.selectNodeContents(outside);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const before = sel.toString();
      term.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, detail:1 }));
      return {
        preserved: window.getSelection()?.toString() === before,
        open: Boolean(document.querySelector('.gtip.gb-floating-tip.is-open')),
      };
    });
    record(checks, caseId+'-unrelated-selection',
      'an unrelated text selection used by Library/W57 is not cleared',
      distinct.preserved && distinct.open, distinct);
  } catch (error) {
    record(checks, caseId+'-exception', 'glossary selection regression case completes',
      false, String(error.stack || error).slice(0,1000));
  } finally {
    await ctx.close();
  }
  return { caseId, checks };
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  const cases = [];
  for (const route of ROUTES) cases.push(await auditMobile(browser, origin, route));
  for (const route of ROUTES.slice(0, 2)) cases.push(await auditDesktop(browser, origin, route));
  cases.push(await auditGillWideSpeed(browser, origin));
  for (const width of [320,390,526]) cases.push(await auditGillVisibleGaps(browser, origin, width));
  // 401–419px has a genuine 44px-touch-target space constraint: keep the full label inside its own button.
  for (const width of [320,390,400,401,405,410,419,420,430,439,440,480,500,526,768]) cases.push(await auditGillAnalyticsCenter(browser, origin, width));
  for (const [width, dark] of [[320,false],[390,false],[390,true],[526,false],[526,true]]) cases.push(await auditGillDualProgress(browser, origin, width, dark));
  for (const [kind, resize] of [['toc',false],['toc',true],['settings',true]]) cases.push(await auditGillScrollLockPosition(browser, origin, kind, resize));
  cases.push(await auditGillNestedScrollLock(browser, origin));
  cases.push(await auditGillTooltipSelection(browser, origin));
  for (const [width,dark] of [[195,false],[195,true],[220,false],[260,false],[268,false],[320,false]]) cases.push(await auditGillNarrowZoomBar(browser, origin, width, dark));
  for (const [width,height,dark] of [[320,700,false],[360,780,false],[361,501,false],[390,500,false],[390,844,false],[390,844,true],[440,844,false],[526,844,false],[768,844,false],[844,390,false],[1024,390,false],[1280,800,false]]) cases.push(await auditGillStableMobileChrome(browser, origin, width, height, dark));
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
