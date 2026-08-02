from pathlib import Path

root = Path(__file__).resolve().parents[1]
fallback_path = root / 'src/components/karty/_shared/MapRuntimeFallback.astro'
witness_path = root / 'scripts/avraam-static-projection-witness.mjs'
self_path = root / 'scripts/atlas-avraam-nojs-scroll-materialize.py'
workflow_path = root / '.github/workflows/atlas-avraam-nojs-scroll-materialize.yml'

fallback = fallback_path.read_text(encoding='utf-8')
old_css = '''  <style is:global>
    [data-map-stage] {
      display: none !important;
    }
'''
new_css = '''  <style is:global>
    html,
    body {
      height: auto !important;
      min-height: 100% !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
    }

    [data-map-stage] {
      display: none !important;
    }
'''
if fallback.count(old_css) != 1:
    raise SystemExit(f'expected one no-JS style anchor, found {fallback.count(old_css)}')
fallback = fallback.replace(old_css, new_css, 1)
fallback_path.write_text(fallback, encoding='utf-8')

witness = witness_path.read_text(encoding='utf-8')
old_verify = '''  const top = slices.find(slice => slice.id === 'top');
  const middle = slices.find(slice => slice.id === 'middle');
  const bottom = slices.find(slice => slice.id === 'bottom');
  if (!top?.firstVisibleBlock?.text) fail('top slice lacks first readable block');
  if (!middle?.firstVisibleBlock?.text) fail('middle slice lacks first readable block');
  if (!bottom?.firstVisibleBlock?.text && !bottom?.noticeIntersects) fail('bottom slice lacks final readable block or notice');
'''
new_verify = '''  const top = slices.find(slice => slice.id === 'top');
  const middle = slices.find(slice => slice.id === 'middle');
  const bottom = slices.find(slice => slice.id === 'bottom');
  const maxScroll = Math.max(...slices.map(slice => Number(slice.maxScroll || 0)));
  if (maxScroll < 1) fail('document has no vertical scroll range for long fallback content');
  if (!top?.firstVisibleBlock?.text) fail('top slice lacks first readable block');
  if (!middle?.firstVisibleBlock?.text) fail('middle slice lacks first readable block');
  if (!bottom?.firstVisibleBlock?.text && !bottom?.noticeIntersects) fail('bottom slice lacks final readable block or notice');
  if (middle && top && middle.scrollY <= top.scrollY) fail(`middle slice did not advance (${middle.scrollY} <= ${top.scrollY})`);
  if (bottom && middle && bottom.scrollY <= middle.scrollY) fail(`bottom slice did not advance (${bottom.scrollY} <= ${middle.scrollY})`);
'''
if witness.count(old_verify) != 1:
    raise SystemExit(f'expected one scroll verifier block, found {witness.count(old_verify)}')
witness = witness.replace(old_verify, new_verify, 1)
witness_path.write_text(witness, encoding='utf-8')

self_path.unlink()
workflow_path.unlink()
