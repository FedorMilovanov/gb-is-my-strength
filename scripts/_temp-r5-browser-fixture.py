#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/overlay-runtime-browser-test.js')
text = path.read_text(encoding='utf-8')

text = text.replace(
    '<main id="background"><button id="openA">Open A</button><div style="height:2600px"></div></main>',
    '<main id="background"><button id="openA">Open A</button><button id="openBRoot">Open B root</button><div style="height:3600px"></div></main>',
    1,
)

start_marker = "    await page.evaluate(() => {\n      scrollTo(0, 420);"
end_marker = "    await page.waitForTimeout(30);\n"
start = text.index(start_marker)
end = text.index(end_marker, start) + len(end_marker)
replacement = r'''    await page.evaluate(() => {
      document.body.style.overflow = 'auto';
      document.body.style.position = 'relative';
      document.body.style.top = '4px';
      document.body.classList.add('no-scroll');
      document.documentElement.classList.add('cp-scroll-lock');
      document.documentElement.setAttribute('data-scroll-locked', 'legacy');
    });
    await page.evaluate(() => {
      document.scrollingElement.scrollTop = 420;
      window.scrollTo(0, 420);
    });
    await page.waitForFunction(() => Math.round(window.scrollY) === 420, null, { timeout: 5000 });
    await page.evaluate(() => {
      document.getElementById('openA').focus();
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const overlayB = document.getElementById('overlayB');
      const closeA = (reason) => runtime.close('browser-a', reason);
      const closeB = (reason) => runtime.close('browser-b', reason);
      runtime.open('browser-a', {
        element: overlayA,
        opener: document.getElementById('openA'),
        focusTarget: document.getElementById('focusA'),
        inertTargets: [background],
        onRequestClose: closeA,
      });
      document.getElementById('openB').focus();
      runtime.open('browser-b', {
        element: overlayB,
        opener: document.getElementById('openB'),
        focusTarget: document.getElementById('focusB'),
        inertTargets: [background, overlayA],
        onRequestClose: closeB,
      });
    });
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'focusB');
'''
text = text[:start] + replacement + text[end:]

anchor = """    assert.deepEqual(state, {
      size: 0,
      overflow: 'auto',
      position: 'relative',
      topStyle: '4px',
      noScroll: true,
      cpLock: true,
      lockAttr: 'legacy',
      backgroundInert: false,
      active: 'openA',
      scrollY: 420,
    });

"""
if text.count(anchor) != 1:
    raise SystemExit(f'reverse-order anchor mismatch: {text.count(anchor)}')
reverse = anchor + r'''    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const overlayB = document.getElementById('overlayB');
      document.getElementById('openBRoot').focus();
      runtime.open('reverse-b', {
        element: overlayB,
        opener: document.getElementById('openBRoot'),
        focusTarget: document.getElementById('focusB'),
        inertTargets: [background],
        onRequestClose: (reason) => runtime.close('reverse-b', reason),
      });
      runtime.open('reverse-a', {
        element: overlayA,
        opener: document.getElementById('focusB'),
        focusTarget: document.getElementById('focusA'),
        inertTargets: [background, overlayB],
        onRequestClose: (reason) => runtime.close('reverse-a', reason),
      });
    });
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'focusA');
    await page.evaluate(() => window.OverlayRuntime.close('reverse-a', 'programmatic'));
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'focusB');
    assert.deepEqual(await page.evaluate(() => ({
      b: window.OverlayRuntime.isOpen('reverse-b'),
      a: window.OverlayRuntime.isOpen('reverse-a'),
      top: window.OverlayRuntime.topLayer()?.ownerId,
      position: document.body.style.position,
      overlayBInert: document.getElementById('overlayB').inert,
      active: document.activeElement?.id,
    })), {
      b: true,
      a: false,
      top: 'reverse-b',
      position: 'fixed',
      overlayBInert: false,
      active: 'focusB',
    });
    await page.evaluate(() => window.OverlayRuntime.close('reverse-b', 'programmatic'));
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'openBRoot');
    assert.deepEqual(await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      position: document.body.style.position,
      scrollY: Math.round(window.scrollY),
    })), { size: 0, position: 'relative', scrollY: 420 });

'''
text = text.replace(anchor, reverse, 1)
text = text.replace(
    'nested stack + exact restore + focus + Escape + pagehide + reduced motion',
    'forward/reverse nested stack + exact restore + focus + Escape + pagehide + reduced motion',
)
path.write_text(text, encoding='utf-8')
print('Browser fixture now proves initial scroll and reverse ownership order')
