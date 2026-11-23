"""Reproducible static witness, not a compiled Astro route. Python Playwright + Chromium."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
p = Path(__file__).parent
src = (p / 'matrix-source-return.html').read_text()
data = json.loads((p / 'matrix-data.json').read_text())
results = []
with sync_playwright() as pw:
    executable = os.environ.get('CHROMIUM_EXECUTABLE')
    b = pw.chromium.launch(**({'executable_path': executable} if executable else {}), args=['--no-sandbox'])
    for width, js in [(390, True), (1440, True), (390, False), (1440, False)]:
        ctx = b.new_context(viewport={'width':width,'height':900}, java_script_enabled=js)
        page = ctx.new_page()
        page.set_content(src)
        count = 0
        for row in data['rows']:
            for y in row['years']:
                id = f'cite-g3-matrix-{row["id"]}-{y}'
                page.locator('#'+id).focus()
                page.keyboard.press('Enter')
                assert page.evaluate('location.hash') == f'#history-source-gnl-{y}'
                back = page.locator(f'#history-source-gnl-{y} [data-journal-source-return]')
                expected = '#'+id if js else f'#g3-year-{y}'
                assert back.get_attribute('href') == expected
                if js:
                    assert row['name'] in back.get_attribute('aria-label') and str(y) in back.get_attribute('aria-label')
                back.focus()
                page.keyboard.press('Enter')
                assert page.evaluate('location.hash') == expected
                count += 1
        assert count == 37
        assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
        results.append({'width':width,'js':js,'pairs':count})
        ctx.close()
    b.close()
print(json.dumps(results, ensure_ascii=False, indent=2))
