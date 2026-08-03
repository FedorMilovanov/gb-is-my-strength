#!/usr/bin/env python3
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
engine = root / 'karty/_engine/map-engine.js'
self_path = root / 'scripts/.tmp-atlas-overlay-opener-materialize-20260803.py'
workflow = root / '.github/workflows/.tmp-atlas-overlay-opener-materialize-20260803.yml'
text = engine.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
    '    const fallbackOverlayStates = new Map();\n',
    '    const fallbackOverlayStates = new Map();\n    let panelRestoreMarkerOnClose = false;\n',
    'overlay restore state declaration',
)
replace_once(
    """      const panelOpener = document.activeElement;
      const place=(route.places||[]).find(p=>p.id===id);
      if(!place)return;
      activePlaceId=id;""",
    """      const panelOpener = document.activeElement;
      const place=(route.places||[]).find(p=>p.id===id);
      if(!place)return;
      if(!panel.classList.contains('me-panel--open')){
        const openerPlaceId=panelOpener?.closest?.('[data-place-id]')?.getAttribute('data-place-id')||null;
        panelRestoreMarkerOnClose=openerPlaceId===id;
      }
      activePlaceId=id;""",
    'panel opener classification',
)
replace_once(
    """    function close(reason = 'close', closeOptions = {}){
      const closingPlaceId=activePlaceId;
      closePhoto('panel-close', {restoreFocus:false});""",
    """    function close(reason = 'close', closeOptions = {}){
      const closingPlaceId=activePlaceId;
      const restoreMarkerOnClose=panelRestoreMarkerOnClose;
      panelRestoreMarkerOnClose=false;
      closePhoto('panel-close', {restoreFocus:false});""",
    'capture marker restore ownership',
)
replace_once(
    "if(closeOptions.restoreFocus!==false&&closingPlaceId){",
    "if(closeOptions.restoreFocus!==false&&restoreMarkerOnClose&&closingPlaceId){",
    'conditional marker focus restoration',
)
engine.write_text(text, encoding='utf-8')
subprocess.run(['node','--check',str(engine.relative_to(root))], cwd=root, check=True)
subprocess.run(['git','diff','--check'], cwd=root, check=True)
changed = {line[3:] for line in subprocess.check_output(['git','status','--porcelain'], cwd=root, text=True).splitlines()}
allowed = {
  'karty/_engine/map-engine.js',
  'scripts/.tmp-atlas-overlay-opener-materialize-20260803.py',
  '.github/workflows/.tmp-atlas-overlay-opener-materialize-20260803.yml',
}
if not changed.issubset(allowed):
    raise SystemExit(f'unexpected paths: {sorted(changed - allowed)}')
self_path.unlink()
workflow.unlink()
print('materialized conditional map overlay opener restoration')
