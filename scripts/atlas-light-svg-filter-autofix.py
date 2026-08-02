from pathlib import Path

path = Path('karty/_engine/map-engine.js')
text = path.read_text(encoding='utf-8')

old_palette = "baseFill:'#d7c5a4',baseOpacity:'0.22',svgFilter:'none'"
new_palette = "baseFill:'#d7c5a4',baseOpacity:'0.22',svgFilter:'brightness(1.015) saturate(1.035) contrast(1.01)'"
old_css = '.me-map[data-map-theme="light"] .me-canvas svg{filter:none}'
new_css = '.me-map[data-map-theme="light"] .me-canvas svg{filter:var(--me-svg-filter)}'

palette_count = text.count(old_palette)
css_count = text.count(old_css)
if palette_count != 1:
    raise SystemExit(f'expected exactly one light palette anchor, found {palette_count}')
if css_count != 2:
    raise SystemExit(f'expected exactly two light SVG filter overrides, found {css_count}')

text = text.replace(old_palette, new_palette, 1)
text = text.replace(old_css, new_css)

if text.count(new_palette) != 1:
    raise SystemExit('light palette filter did not materialize exactly once')
if text.count(new_css) != 2:
    raise SystemExit('light SVG variable filter did not materialize exactly twice')
if old_palette in text or old_css in text:
    raise SystemExit('stale light filter contract remains')

path.write_text(text, encoding='utf-8')
print('LIGHT SVG FILTER APPLIED')
