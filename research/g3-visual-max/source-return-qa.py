"""All approved and HOLD-review links, keyboard and native return. Static witnesses, not Astro."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
p=Path(__file__).parent
results=[]
with sync_playwright() as pw:
    executable=os.environ.get('CHROMIUM_EXECUTABLE')
    b=pw.chromium.launch(**({'executable_path':executable} if executable else {}),args=['--no-sandbox'])
    for file,years,pairs in [('matrix-source-return.html',7,37),('matrix-expanded-review.html',9,60)]:
        src=(p/file).read_text()
        for width in [390,740]:
            for js in [False,True]:
                ctx=b.new_context(viewport={'width':width,'height':900},java_script_enabled=js)
                page=ctx.new_page(); page.set_content(src)
                links=page.locator('.gm-cell a').evaluate_all('(ls)=>ls.map(a=>({id:a.id,href:a.getAttribute("href"),label:a.getAttribute("aria-label")}))')
                assert len(links)==pairs and len({x['id'] for x in links})==pairs
                for a in links:
                    link=page.locator('#'+a['id'])
                    link.focus(); page.keyboard.press('Enter')
                    assert page.evaluate('location.hash')==a['href']
                    back=page.locator(a['href']+' [data-journal-source-return]')
                    expected='#'+a['id'] if js else '#g3-year-'+a['href'].split('-')[-1]
                    assert back.get_attribute('href')==expected
                    if js:
                        assert a['label'].removesuffix(' года') in back.get_attribute('aria-label')
                    back.focus(); page.keyboard.press('Enter')
                    assert page.evaluate('location.hash')==expected
                results.append({'years':years,'width':width,'js':js,'roundtrips':pairs})
                ctx.close()
    b.close()
assert sum(r['roundtrips'] for r in results)==388
print(json.dumps(results,ensure_ascii=False,indent=2))
