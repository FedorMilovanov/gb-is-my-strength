from pathlib import Path

path = Path('scripts/map-browser-smoke.js')
source = path.read_text(encoding='utf-8')
old_header = """const DEFAULT_LIVE_MAPS = ['ishod','avraam'];
const HOLDING_MAPS = ['pavel','melachim','shoftim','shvatim','yeshua','maccabim','early-church','revelation'];
const MAPS = (process.env.MAP_SMOKE_ROUTES || DEFAULT_LIVE_MAPS.join(','))
"""
new_header = """const DEFAULT_MAP_ENGINE_MAPS = ['ishod'];
const LEGACY_BESPOKE_MAPS = ['avraam'];
const HOLDING_MAPS = ['pavel','melachim','shoftim','shvatim','yeshua','maccabim','early-church','revelation'];
const MAPS = (process.env.MAP_SMOKE_ROUTES || DEFAULT_MAP_ENGINE_MAPS.join(','))
"""
if source.count(old_header) != 1:
    raise SystemExit(f'expected one map classification header, found {source.count(old_header)}')
source = source.replace(old_header, new_header, 1)
old_intro = """(async () => {
  if (!process.env.MAP_SMOKE_ROUTES && HOLDING_MAPS.length) {
"""
new_intro = """(async () => {
  if (!process.env.MAP_SMOKE_ROUTES && LEGACY_BESPOKE_MAPS.length) {
    console.log(`ℹ️ Skipping bespoke legacy maps outside the shared MapEngine contract: ${LEGACY_BESPOKE_MAPS.join(', ')}`);
  }
  if (!process.env.MAP_SMOKE_ROUTES && HOLDING_MAPS.length) {
"""
if source.count(old_intro) != 1:
    raise SystemExit(f'expected one smoke intro, found {source.count(old_intro)}')
path.write_text(source.replace(old_intro, new_intro, 1), encoding='utf-8')
