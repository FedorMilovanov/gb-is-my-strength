from pathlib import Path

path = Path('scripts/interactive-audit.js')
text = path.read_text(encoding='utf-8')
old = "target && target.getAttribute('data-term') && target.querySelector('.gtip')"
new = "target && target.hasAttribute('aria-expanded') && target.querySelector('.gtip')"
if text.count(old) != 1:
    raise SystemExit(f'glossary readiness anchor count={text.count(old)}')
updated = text.replace(old, new)
if "target && target.hasAttribute('aria-expanded') && target.querySelector('.gtip')" not in updated:
    raise SystemExit('refined readiness contract missing')
path.write_text(updated, encoding='utf-8')
