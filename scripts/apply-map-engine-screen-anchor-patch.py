#!/usr/bin/env python3
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    'engine': (ROOT / 'karty/_engine/map-engine.js', 'a13f9f900b06f4cd6261524b31d75f91166d730e'),
    'guard': (ROOT / 'scripts/map-engine-p0-regression-test.js', 'a391514c99d4535bcd3fdd30e1ec46cff87c9479'),
    'browser': (ROOT / 'scripts/map-engine-correctness-browser-test.mjs', '4aeeb279ded6f2b908dd62df14193e926721e3bf'),
}


def git_blob_sha(text: str) -> str:
    data = text.encode('utf-8')
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def read_verified(name: str) -> str:
    path, expected = FILES[name]
    text = path.read_text(encoding='utf-8')
    actual = git_blob_sha(text)
    if actual != expected:
        raise SystemExit(f'{name}: refusing unexpected blob {actual}; expected {expected}')
    return text


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one source block, got {count}')
    return source.replace(old, new, 1)


engine = read_verified('engine')
engine = replace_once(
    engine,
    """      const canvasRect=canvas.getBoundingClientRect();
      const unitsPerPixel=view.w/Math.max(1,canvasRect.width);
""",
    """      const canvasRect=canvas.getBoundingClientRect();
      const renderedWidth=Math.max(1,canvasRect.width);
      const renderedHeight=Math.max(1,canvasRect.height);
      const viewScale=Math.min(renderedWidth/Math.max(1,view.w),renderedHeight/Math.max(1,view.h));
      const unitsPerPixel=1/Math.max(viewScale,Number.EPSILON);
""",
    'screen-anchor preserveAspectRatio meet scale',
)
engine = replace_once(
    engine,
    """      scaleResizeObserver = new ResizeObserver(() => updateScaleBar());
      scaleResizeObserver.observe(canvas);
""",
    """      scaleResizeObserver = new ResizeObserver(() => applyViewBox());
      scaleResizeObserver.observe(canvas);
""",
    'screen-anchor resize reapplication',
)
FILES['engine'][0].write_text(engine, encoding='utf-8')
print('engine ->', git_blob_sha(engine))

guard = read_verified('guard')
guard = replace_once(
    guard,
    """if (failures) {
  console.error(`\\n❌ map-engine regression guard: ${failures} failed check(s)`);
""",
    """check(
  'Screen-space anchors use SVG meet scale and reapply after canvas resize',
  /const\\s+viewScale\\s*=\\s*Math\\.min\\(renderedWidth\\/Math\\.max\\(1,view\\.w\\),renderedHeight\\/Math\\.max\\(1,view\\.h\\)\\)/.test(source) &&
    /const\\s+unitsPerPixel\\s*=\\s*1\\/Math\\.max\\(viewScale,Number\\.EPSILON\\)/.test(source) &&
    /scaleResizeObserver\\s*=\\s*new ResizeObserver\\(\\(\\)\\s*=>\\s*applyViewBox\\(\\)\\)/.test(source),
  'WAYP-P1-01 and all data-screen-anchor geometry require the actual xMidYMid meet scale to be reapplied on resize.'
);

if (failures) {
  console.error(`\\n❌ map-engine regression guard: ${failures} failed check(s)`);
""",
    'permanent screen-anchor source guard',
)
FILES['guard'][0].write_text(guard, encoding='utf-8')
print('guard ->', git_blob_sha(guard))

browser = read_verified('browser')
browser = replace_once(
    browser,
    """      const params = new URL(location.href).searchParams;
      return {
        place: params.get('place') || '',
        captionTitle: document.querySelector('.me-caption__title')?.textContent || '',
        captionStage: document.querySelector('.me-caption__stage')?.textContent || '',
        stage3Transform: document.querySelector('.me-stage-dot[data-stage=\"3\"]')?.style.transform || '',
        stage0Transform: document.querySelector('.me-stage-dot[data-stage=\"0\"]')?.style.transform || '',
      };
    });
    const openedPlace = route.places.find((place) => place.id === tourFacts.place);
""",
    """      const panel = document.querySelector('.me-panel.me-panel--open');
      return {
        panelOpen: Boolean(panel),
        panelName: panel?.querySelector('.me-panel__name')?.textContent || '',
        panelStage: panel?.querySelector('.me-panel__stage')?.textContent || '',
        captionTitle: document.querySelector('.me-caption__title')?.textContent || '',
        captionStage: document.querySelector('.me-caption__stage')?.textContent || '',
        stage3Transform: document.querySelector('.me-stage-dot[data-stage=\"3\"]')?.style.transform || '',
        stage0Transform: document.querySelector('.me-stage-dot[data-stage=\"0\"]')?.style.transform || '',
      };
    });
    const openedPlace = route.places.find((place) => place.name === tourFacts.panelName);
""",
    'tour dossier ownership witness',
)
browser = replace_once(
    browser,
    """    check('Lot tour opens a place from authored stage 3', openedPlace?.stage === firstLotStage, JSON.stringify(tourFacts));
""",
    """    check('Lot tour opens a dossier from authored stage 3', tourFacts.panelOpen && openedPlace?.stage === firstLotStage && tourFacts.panelStage.includes(expectedStage?.n || ''), JSON.stringify(tourFacts));
""",
    'tour authored-stage assertion',
)
FILES['browser'][0].write_text(browser, encoding='utf-8')
print('browser ->', git_blob_sha(browser))
