from pathlib import Path

root = Path(__file__).resolve().parents[1]
witness = root / 'scripts/avraam-reference-baseline.mjs'
self_path = root / 'scripts/atlas-avraam-baseline-stats-materialize.py'
workflow = root / '.github/workflows/atlas-avraam-baseline-stats-materialize.yml'

text = witness.read_text(encoding='utf-8')
old = "expect('stats.places',stats.places,places.length);"
new = "expect('stats.places',stats.places,routePlaces.length);"
if text.count(old) != 1:
    raise SystemExit(f'expected one stale stats.places assertion, found {text.count(old)}')
text = text.replace(old, new, 1)
if "expect('stats.route_places',stats.route_places,routePlaces.length);" not in text:
    raise SystemExit('explicit route_places assertion missing')
if "expect('stats.context_places',stats.context_places,contextPlaces.length);" not in text:
    raise SystemExit('explicit context_places assertion missing')
witness.write_text(text, encoding='utf-8')
self_path.unlink()
workflow.unlink()
