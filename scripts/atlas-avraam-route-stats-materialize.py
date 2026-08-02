from pathlib import Path

root = Path(__file__).resolve().parents[1]
route_path = root / 'karty/avraam/route.json'
self_path = root / 'scripts/atlas-avraam-route-stats-materialize.py'
workflow_path = root / '.github/workflows/atlas-avraam-route-stats-materialize.yml'

text = route_path.read_text(encoding='utf-8')
old = '"stats": {\n      "places": 22,\n      "stages": 8,\n      "stories": 5,'
new = '"stats": {\n      "places": 19,\n      "stages": 8,\n      "stories": 5,'
if text.count(old) != 1:
    raise SystemExit(f'expected one canonical stats block, found {text.count(old)}')
text = text.replace(old, new, 1)
if '"route_places": 19' not in text or '"context_places": 3' not in text:
    raise SystemExit('explicit route/context count contract missing')
route_path.write_text(text, encoding='utf-8')
self_path.unlink()
workflow_path.unlink()
