#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)

site_path = Path('js/site-utils.js')
site = site_path.read_text(encoding='utf-8')
old_open = '''  function openOverlayOwner(ownerId, options) {
    options = options || {};
    var record = overlayRecord(ownerId, options);
    if (!record.opener) {
      var active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) record.opener = active;
    }
    overlayStack = overlayStack.filter(function (id) { return id !== record.ownerId; });
    overlayStack.push(record.ownerId);
    record.open = true;
    record.sequence = ++overlaySequence;
    if (record.element) {
      record.element.setAttribute('aria-hidden', 'false');
      record.element.removeAttribute('inert');
      if ('inert' in record.element) record.element.inert = false;
      record.element.setAttribute('data-overlay-owner', record.ownerId);
      record.element.setAttribute('data-overlay-open', '1');
    }
    claimOverlayInert(record);
    if (record.lockScroll) lockScroll('overlay:' + record.ownerId);
    syncOverlayDiagnostics();
    overlayEvent('gb:overlay-open', record, options.reason || 'open');
    var target = firstOverlayFocus(record);
    if (target) setTimeout(function () { if (record.open) overlayFocus(target); }, 0);
    return { ownerId: record.ownerId, element: record.element, sequence: record.sequence };
  }
'''
new_open = '''  function openOverlayOwner(ownerId, options) {
    options = options || {};
    var id = overlayId(ownerId);
    var existing = overlayRecords.get(id);
    var wasOpen = Boolean(existing && existing.open);
    var originalOpener = wasOpen && existing ? existing.opener : null;
    var record = overlayRecord(id, options);
    if (wasOpen && originalOpener) record.opener = originalOpener;
    if (!record.opener) {
      var active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) record.opener = active;
    }
    overlayStack = overlayStack.filter(function (stackId) { return stackId !== record.ownerId; });
    overlayStack.push(record.ownerId);
    record.open = true;
    record.sequence = ++overlaySequence;
    if (record.element) {
      record.element.setAttribute('aria-hidden', 'false');
      record.element.removeAttribute('inert');
      if ('inert' in record.element) record.element.inert = false;
      record.element.setAttribute('data-overlay-owner', record.ownerId);
      record.element.setAttribute('data-overlay-open', '1');
    }
    if (!wasOpen) {
      claimOverlayInert(record);
      if (record.lockScroll) lockScroll('overlay:' + record.ownerId);
      overlayEvent('gb:overlay-open', record, options.reason || 'open');
    }
    syncOverlayDiagnostics();
    var target = firstOverlayFocus(record);
    if (target) setTimeout(function () { if (record.open) overlayFocus(target); }, 0);
    return { ownerId: record.ownerId, element: record.element, sequence: record.sequence };
  }
'''
site = replace_once(site, old_open, new_open, 'idempotent openOverlayOwner')
site = replace_once(
    site,
    "    destroy: destroyOverlayOwner,\n    topLayer: function () {\n",
    "    destroy: destroyOverlayOwner,\n    lockScroll: lockScroll,\n    unlockScroll: unlockScroll,\n    topLayer: function () {\n",
    'public lock API',
)
site_path.write_text(site, encoding='utf-8')

contract_path = Path('scripts/overlay-runtime-contract-test.js')
contract = contract_path.read_text(encoding='utf-8')
contract = replace_once(
    contract,
    "for (const name of ['register', 'open', 'close', 'requestClose', 'destroy', 'topLayer', 'forceRecover']) {",
    "for (const name of ['register', 'open', 'close', 'requestClose', 'destroy', 'lockScroll', 'unlockScroll', 'topLayer', 'forceRecover']) {",
    'contract API list',
)
contract_path.write_text(contract, encoding='utf-8')

test_path = Path('scripts/runtime-integrity-test.js')
test = test_path.read_text(encoding='utf-8')
anchor = "openOverlay('a', overlayA, openerA, focusA);\nopenOverlay('b', overlayB, openerB, focusB);\n"
insert = '''const repeatBackground = new Element('repeat-background');
const repeatOverlay = new Element('repeat-overlay');
const repeatFocus = new Element('repeat-focus');
const repeatOpener = new Element('repeat-opener');
repeatOverlay.focusables = [repeatFocus];
const repeatOptions = {
  element: repeatOverlay,
  opener: repeatOpener,
  focusTarget: repeatFocus,
  inertTargets: [repeatBackground],
};
overlayRuntime.open('repeat-owner', repeatOptions);
overlayRuntime.open('repeat-owner', repeatOptions);
assert.equal(overlayRuntime.size(), 1, 'repeated open must not duplicate the owner stack');
overlayRuntime.close('repeat-owner', 'programmatic');
assert.equal(repeatBackground.inert, false, 'repeated open must not leak inert claims');
assert.equal(body.style.position, 'relative', 'repeated open must release its single scroll claim');

openOverlay('a', overlayA, openerA, focusA);
openOverlay('b', overlayB, openerB, focusB);
'''
test = replace_once(test, anchor, insert, 'idempotence runtime witness')
test_path.write_text(test, encoding='utf-8')

print('OverlayRuntime hardening patch applied')
