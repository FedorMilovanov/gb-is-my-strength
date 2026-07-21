#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/special-overlay-runtime-browser-test.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "    await page.setContent(html);\n    await page.addScriptTag({content:siteUtils});",
        "    await page.route('https://fixture.test/map/**', request => request.fulfill({status:200,contentType:'text/html',body:html}));\n    await page.goto('https://fixture.test/map/ownership/');\n    await page.addScriptTag({content:siteUtils});",
        'canonical map URL fixture',
    ),
    (
        "    await page.setContent('<!doctype html><html><body><button id=\"outside\">Open</button><div id=\"map\" style=\"height:390px;width:844px;position:relative\"></div></body></html>');\n    await page.evaluate(() => { window.SiteUtils={locks:[],unlocks:[],lockScroll(id){this.locks.push(id)},unlockScroll(id){this.unlocks.push(id)}}; });",
        "    const html='<!doctype html><html><body><button id=\"outside\">Open</button><div id=\"map\" style=\"height:390px;width:844px;position:relative\"></div></body></html>';\n    await page.route('https://fixture.test/fallback/**', request => request.fulfill({status:200,contentType:'text/html',body:html}));\n    await page.goto('https://fixture.test/fallback/map/');\n    await page.evaluate(() => { window.SiteUtils={locks:[],unlocks:[],lockScroll(id){this.locks.push(id)},unlockScroll(id){this.unlocks.push(id)}}; });",
        'fallback map URL fixture',
    ),
    (
        "    await page.click('.me-photo-modal__close');",
        "    await page.evaluate(() => document.querySelector('.me-photo-modal__close').click());",
        'fallback photo close activation',
    ),
    (
        "    await page.click('.me-panel__close');",
        "    await page.evaluate(() => document.querySelector('.me-panel__close').click());",
        'fallback panel close activation',
    ),
    (
        "    window;\n  } finally { await page.close(); }",
        "  } finally { await page.close(); }",
        'fallback witness cleanup',
    ),
]

for old, new, label in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label} anchor: {count}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('✅ final special overlay browser witnesses use stable DOM activation')
