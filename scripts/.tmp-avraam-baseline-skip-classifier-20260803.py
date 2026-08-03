#!/usr/bin/env python3
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
if not args.write:
    raise SystemExit('guard failed: explicit --write is required')

path = Path('scripts/avraam-reference-baseline.mjs')
text = path.read_text(encoding='utf-8')
old_controls = '''    const controls=[...document.querySelectorAll('button,a,[role="button"],[tabindex]:not([tabindex="-1"])')].filter(isVisible).map(el=>{
      const box=rect(el),scroller=el.closest('[data-horizontal-scroll]'),scrollBox=scroller?rect(scroller):null;
      const scrollReachable=Boolean(scroller&&scroller.scrollWidth>scroller.clientWidth+1&&scrollBox&&box.bottom>scrollBox.top&&box.top<scrollBox.bottom);
      return{...describe(el),box,scrollReachable};
    });
    const undersizedControls=controls.filter(({box})=>box.width<43.5||box.height<43.5);
    const offscreenControls=controls.filter(({box,scrollReachable,placeId})=>!placeId&&!scrollReachable&&(box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1));'''
new_controls = '''    const controls=[...document.querySelectorAll('button,a,[role="button"],[tabindex]:not([tabindex="-1"])')].filter(isVisible).map(el=>{
      const box=rect(el),scroller=el.closest('[data-horizontal-scroll]'),scrollBox=scroller?rect(scroller):null;
      const scrollReachable=Boolean(scroller&&scroller.scrollWidth>scroller.clientWidth+1&&scrollBox&&box.bottom>scrollBox.top&&box.top<scrollBox.bottom);
      const focusOnlySkip=el.matches('[data-map-skip-link]')&&!el.matches(':focus');
      return{...describe(el),box,scrollReachable,focusOnlySkip};
    });
    const undersizedControls=controls.filter(({box})=>box.width<43.5||box.height<43.5);
    const offscreenControls=controls.filter(({box,scrollReachable,placeId,focusOnlySkip})=>!placeId&&!scrollReachable&&!focusOnlySkip&&(box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1));'''
if text.count(old_controls) != 1:
    raise SystemExit(f'guard failed: controls classifier block count={text.count(old_controls)}')
text = text.replace(old_controls, new_controls, 1)
old_counts = '''counts:{labels:labels.length,baseDetailLabels:visibleBaseDetailLabels.length,markers:markers.length,controls:controls.length,routes:routes.length,offscreenLabels:offscreenLabels.length,labelOverlaps:labelOverlaps.length,undersizedControls:undersizedControls.length,offscreenControls:offscreenControls.length,scrollReachableControls:controls.filter(control=>control.scrollReachable).length},'''
new_counts = '''counts:{labels:labels.length,baseDetailLabels:visibleBaseDetailLabels.length,markers:markers.length,controls:controls.length,routes:routes.length,offscreenLabels:offscreenLabels.length,labelOverlaps:labelOverlaps.length,undersizedControls:undersizedControls.length,offscreenControls:offscreenControls.length,scrollReachableControls:controls.filter(control=>control.scrollReachable).length,focusOnlySkipControls:controls.filter(control=>control.focusOnlySkip).length},'''
if text.count(old_counts) != 1:
    raise SystemExit(f'guard failed: geometry counts block count={text.count(old_counts)}')
text = text.replace(old_counts, new_counts, 1)
path.write_text(text, encoding='utf-8')
print('classified unfocused route skip links as focus-only controls')
