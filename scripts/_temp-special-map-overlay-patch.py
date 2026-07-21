#!/usr/bin/env python3
from pathlib import Path
import json


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


map_path = Path('karty/_engine/map-engine.js')
text = map_path.read_text(encoding='utf-8')

text = once(
    text,
    "  const EASE = { outCubic: p => 1 - Math.pow(1 - p, 3) };\n",
    "  const EASE = { outCubic: p => 1 - Math.pow(1 - p, 3) };\n  let mapOverlaySequence = 0;\n",
    'map overlay sequence',
)

helpers = r'''    const overlayRuntime = window.OverlayRuntime || window.SiteUtils?.OverlayRuntime || null;
    const mapInstanceToken = ++mapOverlaySequence;
    const mapOwnerStem = `special:map:${String(route.meta?.id || 'map').replace(/[^a-zA-Z0-9_-]+/g, '-')}:${mapInstanceToken}`;
    const panelOverlayOwner = `${mapOwnerStem}:panel`;
    const photoOverlayOwner = `${mapOwnerStem}:photo`;
    const fallbackOverlayOpeners = new Map();
    const fallbackOverlayOwners = new Set();

    function specialInertTargets(exclusions = []) {
      const excluded = new Set(exclusions.filter(Boolean));
      return Array.from(container.children).filter(element => !excluded.has(element));
    }

    function focusSpecialTarget(target) {
      target = typeof target === 'function' ? target() : target;
      if (!target || typeof target.focus !== 'function') return;
      try { target.focus({preventScroll:true}); }
      catch (_) { try { target.focus(); } catch (_) {} }
    }

    function openSpecialOverlay(ownerId, options = {}) {
      if (overlayRuntime?.open) return overlayRuntime.open(ownerId, options);
      const opener = options.opener || document.activeElement;
      if (opener && opener !== document.body && opener !== document.documentElement) fallbackOverlayOpeners.set(ownerId, opener);
      fallbackOverlayOwners.add(ownerId);
      if (options.lockScroll !== false) window.SiteUtils?.lockScroll?.(ownerId);
      setTimeout(() => focusSpecialTarget(options.focusTarget), 0);
      return {ownerId, element:options.element || null};
    }

    function closeSpecialOverlay(ownerId, reason = 'close', options = {}) {
      if (overlayRuntime?.close) return overlayRuntime.close(ownerId, reason, options);
      if (!fallbackOverlayOwners.has(ownerId)) return false;
      fallbackOverlayOwners.delete(ownerId);
      window.SiteUtils?.unlockScroll?.(ownerId);
      const opener = fallbackOverlayOpeners.get(ownerId);
      fallbackOverlayOpeners.delete(ownerId);
      if (options.restoreFocus !== false && opener) setTimeout(() => focusSpecialTarget(opener), 0);
      return true;
    }

    function destroySpecialOverlay(ownerId) {
      if (overlayRuntime?.destroy) return overlayRuntime.destroy(ownerId);
      return closeSpecialOverlay(ownerId, 'destroy', {restoreFocus:false});
    }

'''
text = once(
    text,
    "    const route = normalizeRouteData(routeData);\n    const cfg = {...DEFAULTS, ...opts};\n    \n",
    "    const route = normalizeRouteData(routeData);\n    const cfg = {...DEFAULTS, ...opts};\n\n" + helpers,
    'map overlay helpers',
)

text = once(
    text,
    "    const panel=document.createElement('div');panel.className='me-panel';\n",
    "    const panel=document.createElement('div');panel.className='me-panel';\n    panel.setAttribute('aria-hidden','true');\n    panel.setAttribute('inert','');\n",
    'panel initial accessibility state',
)

old_photo = r'''    // Photo modal
    const photoModal = document.createElement('div');
    photoModal.className = 'me-photo-modal';
    photoModal.innerHTML = '<div class="me-photo-modal__backdrop"></div><button class="me-photo-modal__close" aria-label="Закрыть">×</button><img class="me-photo-modal__img" alt=""><div class="me-photo-modal__caption"></div>';
    container.appendChild(photoModal);
    // Photo swipe
    let photoSwipeStartX = 0;
    let photoCurrentIdx = 0;
    let photoCurrentPlace = null;
    _on(photoModal, 'touchstart', (e) => {
      photoSwipeStartX = e.touches[0].clientX;
    }, {passive: true});
    _on(photoModal, 'touchend', (e) => {
      if (!photoCurrentPlace || !photoCurrentPlace.photos) return;
      const dx = e.changedTouches[0].clientX - photoSwipeStartX;
      if (Math.abs(dx) < 50) return;
      const photos = photoCurrentPlace.photos;
      const newIdx = dx > 0 ? Math.max(0, photoCurrentIdx - 1) : Math.min(photos.length - 1, photoCurrentIdx + 1);
      if (newIdx !== photoCurrentIdx) {
        photoCurrentIdx = newIdx;
        const ph = photos[newIdx];
        photoModal.querySelector('.me-photo-modal__img').src = ph.src || ph.thumb || '';
        photoModal.querySelector('.me-photo-modal__caption').innerHTML = (ph.label||'') + (ph.credit ? ' · <span class="me-photo-modal__credit">' + ph.credit + '</span>' : '');
        haptic(10);
      }
    }, {passive: true});
    _on(photoModal.querySelector('.me-photo-modal__backdrop'), 'click', () => photoModal.classList.remove('me-photo-modal--open'));
    _on(photoModal.querySelector('.me-photo-modal__close'), 'click', () => photoModal.classList.remove('me-photo-modal--open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') photoModal.classList.remove('me-photo-modal--open'); });

    function openPhoto(src, caption, credit, place, idx) {
      if (place) { photoCurrentPlace = place; photoCurrentIdx = idx || 0; }
      photoModal.querySelector('.me-photo-modal__img').src = src;
      photoModal.querySelector('.me-photo-modal__caption').innerHTML = caption ? caption + (credit ? ' · <span class="me-photo-modal__credit">' + credit + '</span>' : '') : '';
      photoModal.classList.add('me-photo-modal--open');
    }
'''
new_photo = r'''    // Photo modal — a nested OverlayRuntime owner above the place panel.
    const photoModal = document.createElement('div');
    photoModal.className = 'me-photo-modal';
    photoModal.setAttribute('aria-hidden','true');
    photoModal.setAttribute('inert','');
    photoModal.innerHTML = '<div class="me-photo-modal__backdrop"></div><button class="me-photo-modal__close" aria-label="Закрыть">×</button><img class="me-photo-modal__img" alt=""><div class="me-photo-modal__caption"></div>';
    container.appendChild(photoModal);
    // Photo swipe
    let photoSwipeStartX = 0;
    let photoCurrentIdx = 0;
    let photoCurrentPlace = null;
    _on(photoModal, 'touchstart', (e) => {
      photoSwipeStartX = e.touches[0].clientX;
    }, {passive: true});
    _on(photoModal, 'touchend', (e) => {
      if (!photoCurrentPlace || !photoCurrentPlace.photos) return;
      const dx = e.changedTouches[0].clientX - photoSwipeStartX;
      if (Math.abs(dx) < 50) return;
      const photos = photoCurrentPlace.photos;
      const newIdx = dx > 0 ? Math.max(0, photoCurrentIdx - 1) : Math.min(photos.length - 1, photoCurrentIdx + 1);
      if (newIdx !== photoCurrentIdx) {
        photoCurrentIdx = newIdx;
        const ph = photos[newIdx];
        photoModal.querySelector('.me-photo-modal__img').src = ph.src || ph.thumb || '';
        photoModal.querySelector('.me-photo-modal__caption').innerHTML = (ph.label||'') + (ph.credit ? ' · <span class="me-photo-modal__credit">' + ph.credit + '</span>' : '');
        haptic(10);
      }
    }, {passive: true});

    function closePhoto(reason = 'close', closeOptions = {}) {
      photoModal.classList.remove('me-photo-modal--open');
      closeSpecialOverlay(photoOverlayOwner, reason, closeOptions);
    }

    _on(photoModal.querySelector('.me-photo-modal__backdrop'), 'click', () => closePhoto('backdrop'));
    _on(photoModal.querySelector('.me-photo-modal__close'), 'click', () => closePhoto('button'));

    function openPhoto(src, caption, credit, place, idx) {
      const opener = document.activeElement;
      if (place) { photoCurrentPlace = place; photoCurrentIdx = idx || 0; }
      photoModal.querySelector('.me-photo-modal__img').src = src;
      photoModal.querySelector('.me-photo-modal__caption').innerHTML = caption ? caption + (credit ? ' · <span class="me-photo-modal__credit">' + credit + '</span>' : '') : '';
      photoModal.classList.add('me-photo-modal--open');
      openSpecialOverlay(photoOverlayOwner, {
        element: photoModal,
        opener,
        focusTarget: () => photoModal.querySelector('.me-photo-modal__close'),
        inertTargets: specialInertTargets([photoModal]),
        onRequestClose: reason => closePhoto(reason),
      });
    }
'''
text = once(text, old_photo, new_photo, 'photo modal lifecycle')

text = once(
    text,
    "    function open(id){\n      try {\n",
    "    function open(id){\n      try {\n      const panelOpener = document.activeElement;\n",
    'panel opener capture',
)
text = once(
    text,
    "      // Auto-focus first tab for keyboard navigation\n      _tm(() => {\n        const firstTab = panel.querySelector('.me-tab');\n        if (firstTab) firstTab.focus();\n      }, 400);\n      document.body.style.overflow = 'hidden';\n",
    "",
    'remove panel direct focus and body writer',
)
text = once(
    text,
    "      renderMarkers();\n      renderPanel();\n      // Animate content entrance\n",
    "      renderMarkers();\n      renderPanel();\n      openSpecialOverlay(panelOverlayOwner, {\n        element: panel,\n        opener: panelOpener,\n        focusTarget: () => panel.querySelector('.me-tab:not([disabled])') || panel.querySelector('.me-panel__close'),\n        inertTargets: specialInertTargets([panel, panelBackdrop, photoModal]),\n        onRequestClose: reason => close(reason),\n      });\n      // Animate content entrance\n",
    'open panel runtime owner',
)
text = once(
    text,
    "    function close(){\n      activePlaceId=null;\n",
    "    function close(reason = 'close', closeOptions = {}){\n      closePhoto('panel-close', {restoreFocus:false});\n      activePlaceId=null;\n",
    'panel close signature',
)
text = once(
    text,
    "      panelBackdrop.classList.remove('me-panel__backdrop--active');\n      document.body.style.overflow = '';\n      // Return focus to search input\n      _tm(() => { if (searchInput) searchInput.focus(); }, 100);\n",
    "      panelBackdrop.classList.remove('me-panel__backdrop--active');\n      closeSpecialOverlay(panelOverlayOwner, reason, closeOptions);\n",
    'close panel runtime owner',
)

old_trap = r'''    // Focus trap in panel
    panel.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !panel.classList.contains('me-panel--open')) return;
      const focusable = panel.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

'''
text = once(text, old_trap, '', 'remove route-local panel focus trap')
text = once(
    text,
    "      if(e.key==='Escape'){close();return}\n",
    "      if(e.key==='Escape'){if(!overlayRuntime)close('escape');return}\n",
    'top-layer Escape fallback',
)
text = once(
    text,
    "       destroy(){\n         stopTour();\n         _cleanupAll();\n         container.innerHTML='';container.className='';\n       }\n",
    "       destroy(){\n         stopTour();\n         photoModal.classList.remove('me-photo-modal--open');\n         panel.classList.remove('me-panel--open');\n         panelBackdrop.classList.remove('me-panel__backdrop--active');\n         destroySpecialOverlay(photoOverlayOwner);\n         destroySpecialOverlay(panelOverlayOwner);\n         _cleanupAll();\n         container.innerHTML='';container.className='';\n       }\n",
    'destroy overlay owners',
)

map_path.write_text(text, encoding='utf-8')

contract_path = Path('scripts/overlay-runtime-contract-test.js')
contract = contract_path.read_text(encoding='utf-8')
contract = once(
    contract,
    "const floating = fs.readFileSync('js/floating-cluster-controller.js', 'utf8');\n",
    "const floating = fs.readFileSync('js/floating-cluster-controller.js', 'utf8');\nconst mapEngine = fs.readFileSync('karty/_engine/map-engine.js', 'utf8');\n",
    'contract map source',
)
contract = once(
    contract,
    "assert.ok(!directWriter.test(floating), 'floating cluster overlays must not write body lock styles');\n",
    "assert.ok(!directWriter.test(floating), 'floating cluster overlays must not write body lock styles');\nassert.ok(!directWriter.test(mapEngine), 'map special overlays must not write body lock styles');\n",
    'contract direct writer guard',
)
contract = once(
    contract,
    "for (const owner of ['gill-series-toc', 'gill-part-toc', 'gill-learning', 'gill-settings', 'gbs2-sheet']) {\n  assert.ok(floating.includes(owner), `floating cluster must register ${owner}`);\n}\n",
    "for (const owner of ['gill-series-toc', 'gill-part-toc', 'gill-learning', 'gill-settings', 'gbs2-sheet']) {\n  assert.ok(floating.includes(owner), `floating cluster must register ${owner}`);\n}\nassert.ok(mapEngine.includes('special:map:'), 'map instances must use namespaced special owners');\nassert.ok(mapEngine.includes('panelOverlayOwner') && mapEngine.includes('photoOverlayOwner'), 'map panel and photo must have separate owners');\nassert.ok(!mapEngine.includes('Focus trap in panel'), 'map panel must use the shared focus trap');\nassert.ok(!mapEngine.includes(\"document.addEventListener('keydown', e => { if (e.key === 'Escape')\"), 'photo modal must not own a competing Escape listener');\n",
    'contract map ownership assertions',
)
contract_path.write_text(contract, encoding='utf-8')

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
scripts = package.setdefault('scripts', {})
if 'overlay:map:browser:test' in scripts:
    raise SystemExit('overlay:map:browser:test already exists')
scripts['overlay:map:browser:test'] = 'node scripts/map-overlay-runtime-browser-test.js'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

browser_path = Path('scripts/map-overlay-runtime-browser-test.js')
if browser_path.exists():
    raise SystemExit(f'{browser_path} already exists')
browser_path.write_text(r'''#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const playwright = require('playwright');

const browserName = process.env.PW_BROWSER || 'chromium';
const browserType = playwright[browserName];
if (!browserType) throw new Error(`Unsupported PW_BROWSER: ${browserName}`);

const siteUtils = fs.readFileSync('js/site-utils.js', 'utf8');
const mapEngine = fs.readFileSync('karty/_engine/map-engine.js', 'utf8');

(async () => {
  const browser = await browserType.launch({headless:true});
  const page = await browser.newPage({viewport:{width:844,height:390}});
  try {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;min-height:2200px} body{overflow:auto;position:relative;top:4px}
      #pre{height:420px} #outside{display:block;margin:0 0 12px 12px}
      #map{height:390px;width:844px;position:relative}
    </style></head><body><div id="pre"></div><button id="outside">Open map</button><div id="map"></div></body></html>`);
    await page.addScriptTag({content:siteUtils});
    await page.addScriptTag({content:mapEngine});
    await page.evaluate(() => scrollTo(0, 420));
    await page.waitForFunction(() => Math.round(scrollY) === 420);
    await page.evaluate(() => document.getElementById('outside').focus({preventScroll:true}));

    await page.evaluate(() => {
      const route = {
        meta:{id:'runtime-fixture',title:'Runtime fixture',viewport_init:{cx:500,cy:350,w:1000}},
        stages:[{n:'I',t:'Stage'}],
        stories:[{id:'main',label:'Main',places:['p1'],stage_ids:[0],active_by_default:true}],
        places:[{
          id:'p1',name:'Place',stage:0,x:500,y:350,story:'Story text',
          photos:[{thumb:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',src:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',label:'Photo',credit:'Fixture'}]
        }]
      };
      window.fixtureMap = MapEngine.createMap(document.getElementById('map'), route, {showIntro:false,showCompass:false});
      window.fixtureMap.open('p1');
    });

    await page.waitForFunction(() => document.querySelector('.me-panel--open') && window.OverlayRuntime.size() === 1);
    let state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      top:window.OverlayRuntime.topLayer()?.ownerId,
      bodyPosition:document.body.style.position,
      active:document.activeElement?.className || '',
    }));
    assert.equal(state.size, 1);
    assert.match(state.top, /special:map:runtime-fixture:\d+:panel$/);
    assert.equal(state.bodyPosition, 'fixed');
    assert.match(state.active, /me-tab/);

    await page.evaluate(() => {
      const photos = document.querySelector('.me-tab[data-tab="photos"]');
      photos.click();
      const image = document.querySelector('.me-clickable-photo');
      image.tabIndex = 0;
      image.focus({preventScroll:true});
      image.click();
    });
    await page.waitForFunction(() => document.querySelector('.me-photo-modal--open') && window.OverlayRuntime.size() === 2);
    state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      top:window.OverlayRuntime.topLayer()?.ownerId,
      panelOpen:document.querySelector('.me-panel').classList.contains('me-panel--open'),
      active:document.activeElement?.className || '',
    }));
    assert.equal(state.size, 2);
    assert.match(state.top, /:photo$/);
    assert.equal(state.panelOpen, true);
    assert.match(state.active, /me-photo-modal__close/);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.me-photo-modal--open') && window.OverlayRuntime.size() === 1);
    state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      top:window.OverlayRuntime.topLayer()?.ownerId,
      panelOpen:document.querySelector('.me-panel').classList.contains('me-panel--open'),
      bodyPosition:document.body.style.position,
      active:document.activeElement?.className || '',
    }));
    assert.equal(state.size, 1, 'first Escape closes only the photo owner');
    assert.match(state.top, /:panel$/);
    assert.equal(state.panelOpen, true);
    assert.equal(state.bodyPosition, 'fixed');
    assert.match(state.active, /me-clickable-photo/);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
    await page.waitForFunction(() => Math.round(scrollY) === 420);
    state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      panelOpen:document.querySelector('.me-panel').classList.contains('me-panel--open'),
      overflow:document.body.style.overflow,
      position:document.body.style.position,
      topStyle:document.body.style.top,
      scrollY:Math.round(scrollY),
      active:document.activeElement?.id || '',
    }));
    assert.deepEqual(state, {size:0,panelOpen:false,overflow:'auto',position:'relative',topStyle:'4px',scrollY:420,active:'outside'});

    await page.evaluate(() => {
      document.getElementById('outside').focus({preventScroll:true});
      window.fixtureMap.open('p1');
    });
    await page.waitForFunction(() => window.OverlayRuntime.size() === 1);
    await page.evaluate(() => {
      document.querySelector('.me-tab[data-tab="photos"]').click();
      const image = document.querySelector('.me-clickable-photo');
      image.tabIndex = 0;
      image.focus({preventScroll:true});
      image.click();
    });
    await page.waitForFunction(() => window.OverlayRuntime.size() === 2);
    await page.evaluate(() => window.fixtureMap.destroy());
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
    await page.waitForFunction(() => Math.round(scrollY) === 420);
    state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      position:document.body.style.position,
      scrollY:Math.round(scrollY),
      mapChildren:document.getElementById('map').children.length,
    }));
    assert.deepEqual(state, {size:0,position:'relative',scrollY:420,mapChildren:0});

    console.log(`✅ map-overlay-runtime-browser-test [${browserName}]: nested photo/panel ownership + Escape + exact restore + destroy + landscape`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
''', encoding='utf-8')

print('Special map overlay adapter patch prepared')
