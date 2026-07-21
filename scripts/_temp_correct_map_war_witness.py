#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'scripts/map-layers-theme-browser-smoke.js'
text = path.read_text(encoding='utf-8')

old = '''      await clickLayer(page, 'war');
      const warOff = await elementLayerState(page, warSelector);
      await clickLayer(page, 'war');
      const warOn = await elementLayerState(page, warSelector);'''
new = '''      const warDefaultOff = await elementLayerState(page, warSelector);
      await clickLayer(page, 'war');
      const warOn = await elementLayerState(page, warSelector);
      await clickLayer(page, 'war');
      const warOff = await elementLayerState(page, warSelector);'''

if text.count(old) != 1:
    raise SystemExit(f'war interaction block: expected one match, found {text.count(old)}')
text = text.replace(old, new, 1)

old_assert = '''          warOff.hidden === '1' && warOn.hidden === '0' &&
          candOnBeforeStory.hidden === '0' && candOffBeforeStory.hidden === '1' && candOffAfterStory.hidden === '1',
        { theme, candDefaultOff, candToggleDefault, warOff, warOn, candOnBeforeStory, candOffBeforeStory, candOffAfterStory, errors },'''
new_assert = '''          warDefaultOff.hidden === '1' && warOn.hidden === '0' && warOff.hidden === '1' &&
          candOnBeforeStory.hidden === '0' && candOffBeforeStory.hidden === '1' && candOffAfterStory.hidden === '1',
        { theme, candDefaultOff, candToggleDefault, warDefaultOff, warOn, warOff, candOnBeforeStory, candOffBeforeStory, candOffAfterStory, errors },'''

if text.count(old_assert) != 1:
    raise SystemExit(f'war assertion block: expected one match, found {text.count(old_assert)}')
text = text.replace(old_assert, new_assert, 1)
path.write_text(text, encoding='utf-8')
print('default-off war browser witness corrected')
