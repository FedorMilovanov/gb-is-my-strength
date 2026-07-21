#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/runtime-integrity-test.js')
text = path.read_text(encoding='utf-8')
anchor = "console.log('✅ runtime-integrity-test: dedupe + ARIA bootstrap + coordinated idempotent scroll lock');"
if text.count(anchor) != 1:
    raise SystemExit('runtime assertion anchor mismatch')
cases = r'''
const overlayRuntime = window.OverlayRuntime;
assert.ok(overlayRuntime, 'OverlayRuntime must be installed');
assert.strictEqual(window.SiteUtils.OverlayRuntime, overlayRuntime, 'SiteUtils must expose the same runtime');

html.clientWidth = 1180;
body.style.overflow = 'auto';
body.style.position = 'relative';
body.style.top = '4px';
body.classList.add('no-scroll');
html.classList.add('cp-scroll-lock');
html.setAttribute('data-scroll-locked', 'legacy');

const background = new Element('background');
const overlayA = new Element('overlay-a');
const overlayB = new Element('overlay-b');
const focusA = new Element('focus-a');
const focusB = new Element('focus-b');
const openerA = new Element('opener-a');
const openerB = new Element('opener-b');
overlayA.focusables = [focusA];
overlayB.focusables = [focusB];
const requested = [];

function openOverlay(owner, element, opener, focus) {
  overlayRuntime.open(owner, {
    element,
    opener,
    focusTarget: focus,
    inertTargets: [background],
    onRequestClose(reason) {
      requested.push([owner, reason]);
      overlayRuntime.close(owner, reason);
    },
  });
}

openOverlay('a', overlayA, openerA, focusA);
openOverlay('b', overlayB, openerB, focusB);
assert.equal(overlayRuntime.size(), 2);
assert.equal(overlayRuntime.topLayer().ownerId, 'b');
assert.equal(body.style.position, 'fixed');
assert.equal(background.inert, true);
assert.equal(focusB.focusCount, 1);

overlayRuntime.close('b', 'programmatic');
assert.equal(overlayRuntime.size(), 1);
assert.equal(body.style.position, 'fixed', 'lower owner must retain the scroll lock');
assert.equal(background.inert, true, 'nested inert claim must remain');
assert.equal(openerB.focusCount, 1);

overlayRuntime.close('a', 'programmatic');
assert.equal(body.style.overflow, 'auto');
assert.equal(body.style.position, 'relative');
assert.equal(body.style.top, '4px');
assert.equal(body.classList.contains('no-scroll'), true);
assert.equal(html.classList.contains('cp-scroll-lock'), true);
assert.equal(html.getAttribute('data-scroll-locked'), 'legacy');
assert.equal(background.inert, false);
assert.equal(openerA.focusCount, 1);

openOverlay('b', overlayB, openerB, focusB);
openOverlay('a', overlayA, openerA, focusA);
overlayRuntime.close('a', 'programmatic');
assert.equal(overlayRuntime.isOpen('b'), true, 'reverse close order must retain the other owner');
overlayRuntime.close('b', 'programmatic');

openOverlay('a', overlayA, openerA, focusA);
openOverlay('b', overlayB, openerB, focusB);
let prevented = 0;
let stopped = 0;
document.dispatchEvent({
  type: 'keydown',
  key: 'Escape',
  preventDefault() { prevented += 1; },
  stopImmediatePropagation() { stopped += 1; },
});
assert.deepEqual(requested.at(-1), ['b', 'escape']);
assert.equal(overlayRuntime.isOpen('a'), true, 'Escape closes only the top layer');
assert.equal(overlayRuntime.isOpen('b'), false);
assert.equal(prevented, 1);
assert.equal(stopped, 1);
overlayRuntime.close('a', 'programmatic');

openOverlay('a', overlayA, openerA, focusA);
openOverlay('b', overlayB, openerB, focusB);
window.dispatch('pagehide');
assert.equal(overlayRuntime.size(), 0, 'pagehide must recover all owners');
assert.equal(body.style.position, 'relative');

const protectedRuntime = window.OverlayRuntime;
window.OverlayRuntime = { broken: true };
assert.strictEqual(window.OverlayRuntime, protectedRuntime, 'global runtime must reject replacement');

'''
text = text.replace(anchor, cases + anchor.replace('coordinated idempotent scroll lock', 'coordinated lock + OverlayRuntime lifecycle'), 1)
path.write_text(text, encoding='utf-8')
print('OverlayRuntime behavior cases added')
