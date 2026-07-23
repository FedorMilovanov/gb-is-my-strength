from pathlib import Path

engine_path = Path('karty/_engine/map-engine.js')
old_path = Path('scripts/tmp-map-keyboard-old.txt')
new_path = Path('scripts/tmp-map-keyboard-new.txt')
clean_workflow_path = Path('scripts/tmp-map-keyboard-clean-workflow.yml.txt')
workflow_path = Path('.github/workflows/map-keyboard-contract.yml')

source = engine_path.read_text(encoding='utf-8')
old = old_path.read_text(encoding='utf-8')
new = new_path.read_text(encoding='utf-8')
count = source.count(old)
if count != 1:
    raise SystemExit(f'expected one exact keyboard block, found {count}')

engine_path.write_text(source.replace(old, new, 1), encoding='utf-8')
workflow_path.write_text(clean_workflow_path.read_text(encoding='utf-8'), encoding='utf-8')

for path in (
    old_path,
    new_path,
    clean_workflow_path,
    Path('scripts/tmp-apply-map-keyboard-contract.py'),
    Path('.github/workflows/tmp-apply-map-keyboard-contract.yml'),
):
    path.unlink(missing_ok=True)
