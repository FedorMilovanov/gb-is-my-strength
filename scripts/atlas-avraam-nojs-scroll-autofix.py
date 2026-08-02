from pathlib import Path

fallback_path = Path('src/components/karty/_shared/MapRuntimeFallback.astro')
witness_path = Path('scripts/avraam-static-projection-witness.mjs')

fallback = fallback_path.read_text(encoding='utf-8')
style_anchor = '''<noscript>
  <style is:global>
    [data-map-stage] {
'''
style_replacement = '''<noscript>
  <style is:global>
    html {
      position: static !important;
      width: auto !important;
      height: auto !important;
      min-height: 100% !important;
      max-height: none !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
    }

    body {
      position: static !important;
      width: auto !important;
      height: auto !important;
      min-height: 100vh !important;
      max-height: none !important;
      overflow: visible !important;
    }

    [data-map-stage] {
'''
if fallback.count(style_anchor) != 1:
    raise SystemExit(f'no-JS root style anchor count drift: {fallback.count(style_anchor)}')
fallback = fallback.replace(style_anchor, style_replacement, 1)
if fallback.count('overflow-y: auto !important;') != 1:
    raise SystemExit('no-JS root scroll rule did not materialize exactly once')
if fallback.count('min-height: 100vh !important;') != 1:
    raise SystemExit('no-JS body height rule did not materialize exactly once')
fallback_path.write_text(fallback, encoding='utf-8')

witness = witness_path.read_text(encoding='utf-8')

replacements = [
('''    const map = document.querySelector('.me-map,#mapRoot');
    const style = fallback ? getComputedStyle(fallback) : null;
''','''    const map = document.querySelector('.me-map,#mapRoot');
    const scroller = document.scrollingElement || document.documentElement;
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const style = fallback ? getComputedStyle(fallback) : null;
'''),
('''      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      },
''','''      document: {
        width: scroller.scrollWidth,
        height: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        maxScroll: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
        scrollTop: scroller.scrollTop,
        horizontalOverflow: Math.max(0, scroller.scrollWidth - innerWidth),
        rootOverflowY: rootStyle.overflowY,
        bodyOverflowY: bodyStyle.overflowY,
      },
'''),
('''        rect: rect.toJSON(),
        textLength: text.length,
''','''        rect: rect.toJSON(),
        documentBottom: rect.bottom + scroller.scrollTop,
        textLength: text.length,
'''),
('''  const scroll = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    viewportHeight: innerHeight,
    max: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  }));
''','''  const scroll = await page.evaluate(() => {
    const scroller = document.scrollingElement || document.documentElement;
    const fallback = document.querySelector('.map-text-fallback');
    const rect = fallback?.getBoundingClientRect();
    return {
      height: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      viewportHeight: innerHeight,
      max: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
      fallbackBottom: rect ? rect.bottom + scroller.scrollTop : 0,
    };
  });
'''),
('''    await page.evaluate(y => window.scrollTo(0, y), target.y);
''','''    await page.evaluate(y => {
      const scroller = document.scrollingElement || document.documentElement;
      scroller.scrollTop = y;
      window.scrollTo(0, y);
    }, target.y);
'''),
('''      return {
        scrollY,
        maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight),
''','''      const scroller = document.scrollingElement || document.documentElement;
      return {
        scrollY: scroller.scrollTop,
        maxScroll: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
'''),
('''  await page.evaluate(() => window.scrollTo(0, 0));
''','''  await page.evaluate(() => {
    const scroller = document.scrollingElement || document.documentElement;
    scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  });
'''),
('''  if (snapshot.document.horizontalOverflow > 2) fail(`horizontal overflow ${snapshot.document.horizontalOverflow}px`);
''','''  if (snapshot.document.horizontalOverflow > 2) fail(`horizontal overflow ${snapshot.document.horizontalOverflow}px`);
  if (snapshot.fallback?.documentBottom > snapshot.document.height + 2) fail(`fallback clipped by root scroller: ${snapshot.fallback.documentBottom.toFixed(1)} > ${snapshot.document.height}`);
  if (!print && (snapshot.fallback?.rect?.height || 0) > snapshot.viewport.height * 1.5 && snapshot.document.maxScroll < 100) fail(`long fallback is not scrollable (${snapshot.document.maxScroll}px)`);
'''),
('''    if (slice.scrollY < 0 || slice.scrollY > slice.maxScroll + 1) fail(`${slice.id} slice invalid scrollY ${slice.scrollY}/${slice.maxScroll}`);
''','''    if (slice.scrollY < 0 || slice.scrollY > slice.maxScroll + 1) fail(`${slice.id} slice invalid scrollY ${slice.scrollY}/${slice.maxScroll}`);
    if (Math.abs(slice.scrollY - slice.y) > 2) fail(`${slice.id} slice did not reach target ${slice.scrollY}/${slice.y}`);
'''),
('''  if (!top?.firstVisibleBlock?.text) fail('top slice lacks first readable block');
  if (!middle?.firstVisibleBlock?.text) fail('middle slice lacks first readable block');
  if (!bottom?.firstVisibleBlock?.text && !bottom?.noticeIntersects) fail('bottom slice lacks final readable block or notice');
''','''  if (!top?.firstVisibleBlock?.text) fail('top slice lacks first readable block');
  if (!middle?.firstVisibleBlock?.text) fail('middle slice lacks first readable block');
  if (!bottom?.firstVisibleBlock?.text && !bottom?.noticeIntersects) fail('bottom slice lacks final readable block or notice');
  const maxScroll = Math.max(...slices.map(slice => slice.maxScroll || 0));
  if (maxScroll < 100) fail(`long no-JS page has no real scroll range (${maxScroll}px)`);
  if ((middle?.scrollY || 0) < maxScroll * .35 || (middle?.scrollY || 0) > maxScroll * .65) fail(`middle slice is not near mid-scroll ${middle?.scrollY || 0}/${maxScroll}`);
  if ((bottom?.scrollY || 0) < maxScroll - 2) fail(`bottom slice did not reach page end ${bottom?.scrollY || 0}/${maxScroll}`);
  const signatures = new Set(slices.map(slice => `${slice.firstVisibleBlock?.text || ''}|${slice.lastVisibleBlock?.text || ''}`));
  if (signatures.size < 3) fail(`scroll slices are not textually distinct (${signatures.size}/3)`);
'''),
]

for old, new in replacements:
    count = witness.count(old)
    if count != 1:
        raise SystemExit(f'witness anchor count drift ({count}): {old[:80]!r}')
    witness = witness.replace(old, new, 1)

required = [
    'rootOverflowY: rootStyle.overflowY',
    'documentBottom: rect.bottom + scroller.scrollTop',
    'long fallback is not scrollable',
    'scroll slices are not textually distinct',
    'middle slice is not near mid-scroll',
]
for marker in required:
    if witness.count(marker) != 1:
        raise SystemExit(f'witness marker missing or duplicated: {marker}')
witness_path.write_text(witness, encoding='utf-8')

print('AVRAAM NO-JS ROOT SCROLL APPLIED')
