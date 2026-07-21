#!/usr/bin/env python3
from pathlib import Path


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)

path = Path('js/floating-cluster-controller.js')
text = path.read_text(encoding='utf-8')

start = text.index("    var GILL_LOCK_KEY = 'gill-toc';\n")
end = text.index('    // Mobile TOC button opens series\n', start)
replacement = '''    var GILL_OVERLAY_OWNERS = {
      seriesTocOverlay: 'gill-series-toc',
      partTocOverlay: 'gill-part-toc',
      gillLearningOverlay: 'gill-learning',
      gillSettingsOverlay: 'gill-settings'
    };

    function getOverlayRuntime() {
      return window.OverlayRuntime || null;
    }

    function gillOverlayOwner(el) {
      if (!el) return 'gill-overlay';
      return GILL_OVERLAY_OWNERS[el.id] || ('gill-overlay-' + (el.id || 'sheet'));
    }

    function syncGillOverlayClass() {
      var open = qs('.toc-overlay.is-open, .gill-settings-overlay.is-open');
      document.documentElement.classList.toggle('gb-gill-toc-open', Boolean(open));
    }

    function openOverlay(el, opener, options) {
      if (!el) return;
      options = options || {};
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      syncGillOverlayClass();
      var owner = gillOverlayOwner(el);
      var runtime = getOverlayRuntime();
      if (runtime && typeof runtime.open === 'function') {
        runtime.open(owner, {
          element: el,
          opener: opener || document.activeElement,
          focusTarget: options.focusTarget || null,
          onRequestClose: options.onRequestClose || function(reason) { closeOverlay(el, reason, true); },
          closeOnEscape: true,
          trapFocus: options.trapFocus !== false,
          lockScroll: true
        });
      } else {
        var utils = window.SiteUtils;
        if (utils && typeof utils.lockScroll === 'function') utils.lockScroll(owner);
      }
      try { document.dispatchEvent(new CustomEvent('gb:gill-sheet-open')); } catch (_) {}
    }

    function closeOverlay(el, reason, restoreFocus) {
      if (!el) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      var owner = gillOverlayOwner(el);
      var runtime = getOverlayRuntime();
      if (runtime && typeof runtime.close === 'function') {
        runtime.close(owner, reason || 'programmatic', { restoreFocus: restoreFocus !== false });
      } else {
        var utils = window.SiteUtils;
        if (utils && typeof utils.unlockScroll === 'function') utils.unlockScroll(owner);
      }
      syncGillOverlayClass();
    }

'''
text = text[:start] + replacement + text[end:]

text = once(
    text,
    "      addCleanListener(mobTocBtn, 'click', function(e) { e.preventDefault(); openOverlay(seriesToc); });",
    "      addCleanListener(mobTocBtn, 'click', function(e) { e.preventDefault(); closeOverlay(partToc, 'switch', false); openOverlay(seriesToc, e.currentTarget); });",
    'series TOC trigger',
)
text = once(
    text,
    "        closeOverlay(seriesToc);\n        openOverlay(partToc);",
    "        closeOverlay(seriesToc, 'switch', false);\n        openOverlay(partToc, e.currentTarget);",
    'part TOC trigger switch',
)
text = once(
    text,
    "          closeOverlay(ov);",
    "          closeOverlay(ov, 'breakpoint', false);",
    'breakpoint close',
)
text = once(
    text,
    "      addCleanListener(backToSeries, 'click', function() {\n        closeOverlay(partToc);\n        openOverlay(seriesToc);\n      });",
    "      addCleanListener(backToSeries, 'click', function() {\n        closeOverlay(partToc, 'switch', false);\n        openOverlay(seriesToc, mobTocBtn || mobPartTocBtn);\n      });",
    'back to series switch',
)
text = once(
    text,
    "          closeOverlay(seriesToc);\n          openOverlay(partToc);",
    "          closeOverlay(seriesToc, 'switch', false);\n          openOverlay(partToc, mobTocBtn || mobPartTocBtn);",
    'current series item switch',
)
text = once(
    text,
    "        if (e.target === overlay) closeOverlay(overlay);",
    "        if (e.target === overlay) closeOverlay(overlay, 'backdrop', true);",
    'TOC backdrop close',
)
text = once(
    text,
    "        addCleanListener(handle, 'click', function() { closeOverlay(overlay); });",
    "        addCleanListener(handle, 'click', function() { closeOverlay(overlay, 'handle', true); });",
    'TOC handle close',
)
old_escape = '''    // Escape closes any open overlay
    addCleanListener(document, 'keydown', function(e) {
      if (e.key === 'Escape') {
        closeOverlay(seriesToc);
        closeOverlay(partToc);
      }
    });
'''
new_escape = '''    // OverlayRuntime owns Escape globally; fallback keeps legacy pages usable.
    addCleanListener(document, 'keydown', function(e) {
      if (getOverlayRuntime() || e.key !== 'Escape') return;
      if (partToc && partToc.classList.contains('is-open')) closeOverlay(partToc, 'escape', true);
      else if (seriesToc && seriesToc.classList.contains('is-open')) closeOverlay(seriesToc, 'escape', true);
    });
'''
text = once(text, old_escape, new_escape, 'TOC Escape ownership')

old_sheet_functions = '''    function openGillSheet(overlay, triggers) {
      if (!overlay) return;
      openOverlay(overlay);
      (triggers || []).forEach(function(t) { t.setAttribute('aria-expanded', 'true'); });
      var focusable = overlay.querySelector('input, button:not([data-overlay-close]):not(.toc-sheet__handle)');
      if (focusable) setTimeout(function() { try { focusable.focus(); } catch(_) {} }, 20);
    }
    function closeGillSheet(overlay, restoreFocus) {
      if (!overlay) return;
      var triggers = triggersFor(overlay);
      closeOverlay(overlay);
      triggers.forEach(function(t) { t.setAttribute('aria-expanded', 'false'); });
      if (restoreFocus && triggers[0] && triggers[0].focus) { try { triggers[0].focus(); } catch(_) {} }
    }
'''
new_sheet_functions = '''    function openGillSheet(overlay, triggers, opener) {
      if (!overlay) return;
      var focusable = overlay.querySelector('input, button:not([data-overlay-close]):not(.toc-sheet__handle)');
      openOverlay(overlay, opener || (triggers && triggers[0]), {
        focusTarget: focusable,
        onRequestClose: function(reason) { closeGillSheet(overlay, true, reason); }
      });
      (triggers || []).forEach(function(t) { t.setAttribute('aria-expanded', 'true'); });
      if (!getOverlayRuntime() && focusable) setTimeout(function() { try { focusable.focus(); } catch(_) {} }, 20);
    }
    function closeGillSheet(overlay, restoreFocus, reason) {
      if (!overlay) return;
      var triggers = triggersFor(overlay);
      closeOverlay(overlay, reason || 'programmatic', restoreFocus !== false);
      triggers.forEach(function(t) { t.setAttribute('aria-expanded', 'false'); });
      if (!getOverlayRuntime() && restoreFocus && triggers[0] && triggers[0].focus) { try { triggers[0].focus(); } catch(_) {} }
    }
'''
text = once(text, old_sheet_functions, new_sheet_functions, 'Gill sheet runtime functions')
text = once(text, "        closeGillSheet(settingsOverlay, false);\n        openGillSheet(learningOverlay, [mobLearningBtn]);", "        closeGillSheet(settingsOverlay, false, 'switch');\n        openGillSheet(learningOverlay, [mobLearningBtn], e.currentTarget);", 'learning switch')
text = once(text, "          closeGillSheet(learningOverlay, false);\n          openGillSheet(settingsOverlay, settingsBtns);", "          closeGillSheet(learningOverlay, false, 'switch');\n          openGillSheet(settingsOverlay, settingsBtns, e.currentTarget);", 'settings switch')
text = once(text, "        if (e.target === overlay) closeGillSheet(overlay, true);", "        if (e.target === overlay) closeGillSheet(overlay, true, 'backdrop');", 'Gill sheet backdrop')
text = once(text, "      if (handle) addCleanListener(handle, 'click', function() { closeGillSheet(overlay, true); });", "      if (handle) addCleanListener(handle, 'click', function() { closeGillSheet(overlay, true, 'handle'); });", 'Gill sheet handle')
text = once(text, "        addCleanListener(btn, 'click', function() { closeGillSheet(overlay, true); });", "        addCleanListener(btn, 'click', function() { closeGillSheet(overlay, true, 'button'); });", 'Gill sheet close button')
text = once(
    text,
    "      addCleanListener(overlay, 'keydown', function(e) {\n        if (e.key !== 'Tab' || !overlay.classList.contains('is-open')) return;",
    "      addCleanListener(overlay, 'keydown', function(e) {\n        if (getOverlayRuntime() || e.key !== 'Tab' || !overlay.classList.contains('is-open')) return;",
    'legacy-only focus trap',
)
old_extra_escape = '''    if (extraOverlays.length) {
      addCleanListener(document, 'keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (learningOverlay && learningOverlay.classList.contains('is-open')) closeGillSheet(learningOverlay, true);
        if (settingsOverlay && settingsOverlay.classList.contains('is-open')) closeGillSheet(settingsOverlay, true);
      });
    }
'''
new_extra_escape = '''    if (extraOverlays.length) {
      addCleanListener(document, 'keydown', function(e) {
        if (getOverlayRuntime() || e.key !== 'Escape') return;
        if (settingsOverlay && settingsOverlay.classList.contains('is-open')) closeGillSheet(settingsOverlay, true, 'escape');
        else if (learningOverlay && learningOverlay.classList.contains('is-open')) closeGillSheet(learningOverlay, true, 'escape');
      });
    }
'''
text = once(text, old_extra_escape, new_extra_escape, 'Gill sheet Escape ownership')

text = once(text, "            closeSheet();\n            var target = document.getElementById(h.id);", "            closeSheet('navigate', false);\n            var target = document.getElementById(h.id);", 'gbs2 navigate close')
start = text.index("    var SHEET_LOCK_KEY = 'gbs2-sheet';\n")
end = text.index('    // Bottom bar opens sheet\n', start)
gbs2 = '''    var GBS2_OVERLAY_OWNER = 'gbs2-sheet';
    function openSheet(opener) {
      if (!sheet || sheet.classList.contains('gbs2-open')) return;
      sheet.setAttribute('aria-hidden', 'false');
      sheet.style.display = 'block';
      sheet.classList.add('gbs2-open');
      var runtime = window.OverlayRuntime;
      if (runtime && typeof runtime.open === 'function') {
        runtime.open(GBS2_OVERLAY_OWNER, {
          element: sheet,
          opener: opener || document.activeElement,
          focusTarget: sheet.querySelector('[data-gbs2-close], [data-gbs2-tab], a[href], button'),
          onRequestClose: function(reason) { closeSheet(reason, true); },
          closeOnEscape: true,
          trapFocus: true,
          lockScroll: true
        });
      } else {
        var utils = window.SiteUtils;
        if (utils && typeof utils.lockScroll === 'function') utils.lockScroll(GBS2_OVERLAY_OWNER);
      }
    }
    function closeSheet(reason, restoreFocus) {
      if (!sheet) return;
      sheet.setAttribute('aria-hidden', 'true');
      sheet.classList.remove('gbs2-open');
      sheet.style.display = '';
      var runtime = window.OverlayRuntime;
      if (runtime && typeof runtime.close === 'function') {
        runtime.close(GBS2_OVERLAY_OWNER, reason || 'programmatic', { restoreFocus: restoreFocus !== false });
      } else {
        var utils = window.SiteUtils;
        if (utils && typeof utils.unlockScroll === 'function') utils.unlockScroll(GBS2_OVERLAY_OWNER);
      }
    }

'''
text = text[:start] + gbs2 + text[end:]
text = once(text, "      addCleanListener(bbar, 'click', function() { openSheet(); });", "      addCleanListener(bbar, 'click', function(e) { openSheet(e.currentTarget); });", 'gbs2 opener')
text = once(text, "        closeSheet();\n      });", "        closeSheet('button', true);\n      });", 'gbs2 close button')
old_gbs2_escape = '''    // Escape closes sheet
    addCleanListener(document, 'keydown', function(e) {
      if (e.key === 'Escape' && sheet && sheet.classList.contains('gbs2-open')) {
        closeSheet();
      }
    });
'''
new_gbs2_escape = '''    // OverlayRuntime owns Escape globally; fallback keeps legacy pages usable.
    addCleanListener(document, 'keydown', function(e) {
      if (!window.OverlayRuntime && e.key === 'Escape' && sheet && sheet.classList.contains('gbs2-open')) {
        closeSheet('escape', true);
      }
    });
'''
text = once(text, old_gbs2_escape, new_gbs2_escape, 'gbs2 Escape ownership')
path.write_text(text, encoding='utf-8')

contract_path = Path('scripts/overlay-runtime-contract-test.js')
contract = contract_path.read_text(encoding='utf-8')
contract = once(contract, "const hermenevtika = fs.readFileSync('src/components/article-pilots/hermenevtika/HermenevtikaMobileBar.astro', 'utf8');\n", "const hermenevtika = fs.readFileSync('src/components/article-pilots/hermenevtika/HermenevtikaMobileBar.astro', 'utf8');\nconst floating = fs.readFileSync('js/floating-cluster-controller.js', 'utf8');\n", 'floating contract source')
contract = once(contract, "assert.ok(!directWriter.test(hermenevtika), 'Hermenevtika TOC must not write body lock styles');\n", "assert.ok(!directWriter.test(hermenevtika), 'Hermenevtika TOC must not write body lock styles');\nassert.ok(!directWriter.test(floating), 'floating cluster overlays must not write body lock styles');\n", 'floating direct writer contract')
contract = once(contract, "assert.ok(hermenevtika.includes(\"OVERLAY_OWNER = 'hermenevtika-toc'\"));\n", "assert.ok(hermenevtika.includes(\"OVERLAY_OWNER = 'hermenevtika-toc'\"));\nfor (const owner of ['gill-series-toc', 'gill-part-toc', 'gill-learning', 'gill-settings', 'gbs2-sheet']) {\n  assert.ok(floating.includes(owner), `floating cluster must register ${owner}`);\n}\n", 'floating owner contracts')
contract_path.write_text(contract, encoding='utf-8')

print('floating cluster overlay migration applied')
