#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/_temp-materialize-tts-webkit-painted-status.mjs')
source = path.read_text(encoding='utf-8')

count = source.count('\n  `')
if count < 10:
    raise SystemExit(f'guarded writer raw-template normalization found only {count} candidates')
source = source.replace('\n  `', '\n  String.raw`')
source = source.replace('{0,1200}fallbackTtsNoticeStylesApplied', '{0,3200}fallbackTtsNoticeStylesApplied', 1)
source = source.replace('{0,500}TTS_NOTICE_STYLE_TIMEOUT_MS', '{0,1800}TTS_NOTICE_STYLE_TIMEOUT_MS', 1)
source = source.replace('{0,2600}setTimeout', '{0,8000}setTimeout', 1)
source = source.replace(
    r"function waitForFallbackTtsNoticePaint\(\)[\s\S]{0,1000}fallbackBrowserStatusPainted",
    r"function waitForFallbackTtsNoticePaint\(\)[\s\S]{0,260}return ensureFallbackTtsNoticeStyles\(\)\.then[\s\S]{0,1200}fallbackBrowserStatusPainted",
    1,
)
source = source.replace(
    """    window.__engineScriptAppendCount = 0;
    const nativeHeadAppendChild = HTMLHeadElement.prototype.appendChild;""",
    """    window.__engineScriptAppendCount = 0;
    window.__engineScriptAppendAt = 0;
    window.__browserStatusPaintedAt = 0;
    function captureBrowserStatusPaint() {
      if (window.__browserStatusPaintedAt) return;
      const el = document.querySelector('.gb-tts-download-notice[data-state=\"browser\"].is-visible');
      if (el) {
        const style = getComputedStyle(el);
        if (style.position === 'fixed' && style.visibility === 'visible' && Number.parseFloat(style.opacity) >= 0.99) {
          window.__browserStatusPaintedAt = performance.now();
          return;
        }
      }
      requestAnimationFrame(captureBrowserStatusPaint);
    }
    requestAnimationFrame(captureBrowserStatusPaint);
    const nativeHeadAppendChild = HTMLHeadElement.prototype.appendChild;""",
    1,
)
source = source.replace(
    """        window.__engineScriptAppendCount += 1;
      }""",
    """        window.__engineScriptAppendCount += 1;
        if (!window.__engineScriptAppendAt) window.__engineScriptAppendAt = performance.now();
      }""",
    1,
)
source = source.replace("    const paintedAt = Date.now();\n", "", 1)
source = source.replace(
    """    const postPaintDelay = Date.now() - paintedAt;
    assert.ok(postPaintDelay >= 650, 'post-paint dwell was only ' + postPaintDelay + 'ms');""",
    """    const timing = await page.evaluate(() => ({
      paintedAt: window.__browserStatusPaintedAt,
      engineAt: window.__engineScriptAppendAt,
    }));
    assert.ok(timing.paintedAt > 0, 'browser paint timestamp was not captured');
    assert.ok(timing.engineAt > 0, 'engine append timestamp was not captured');
    const postPaintDelay = timing.engineAt - timing.paintedAt;
    assert.ok(postPaintDelay >= 700, 'browser-local post-paint dwell was only ' + postPaintDelay + 'ms');""",
    1,
)

required = [
    'String.raw`',
    'window.__browserStatusPaintedAt = 0;',
    'window.__engineScriptAppendAt = performance.now();',
    'browser-local post-paint dwell was only',
]
for marker in required:
    if marker not in source:
        raise SystemExit(f'normalizer did not materialize required marker: {marker}')

path.write_text(source, encoding='utf-8')
print('TTS WebKit guarded writer normalization: PASS')
