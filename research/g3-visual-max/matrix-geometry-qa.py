"""Static donor witnesses; not Astro compilation. Requires Python Playwright."""
from pathlib import Path
import os, json
from playwright.sync_api import sync_playwright
p=Path(__file__).parent
with sync_playwright() as pw:
    executable=os.environ.get('CHROMIUM_EXECUTABLE')
    b=pw.chromium.launch(**({'executable_path':executable} if executable else {}),args=['--no-sandbox'])
    for file,n,rows,pairs in [('matrix-source-return.html',7,15,37),('matrix-expanded-review.html',9,26,60)]:
        src=(p/file).read_text(); count=0
        for width in [320,390,580,600,640,680,700,740,780,850,1440]:
            for dark in [False,True]:
                for js in [False,True]:
                    ctx=b.new_context(viewport={'width':width,'height':900},java_script_enabled=js)
                    page=ctx.new_page(); page.set_content(src)
                    page.evaluate("(dark)=>document.documentElement.classList.toggle('dark',dark)",dark)
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    assert page.locator('.gm-row:visible').count()==rows
                    assert page.locator('.gm-cell a').count()==pairs
                    if width>680:
                        assert page.locator('.gm-head').evaluate("(e)=>getComputedStyle(e).gridTemplateColumns.split(' ').length")==n+1
                    if width in [390,740] and js:
                        link=page.locator('#cite-g3-matrix-lawson-2013'); link.click()
                        query=page.locator('.gm-filter input'); query.fill('Вошер'); assert not link.is_visible()
                        back=page.locator('#history-source-gnl-2013 [data-journal-source-return]')
                        assert back.get_attribute('href')=='#cite-g3-matrix-lawson-2013'
                        back.click(); link.wait_for(state='visible')
                        assert query.input_value()=='' and link.evaluate('(e)=>document.activeElement===e')
                        page.go_back(); query.fill('Вошер'); assert not link.is_visible()
                        page.go_forward(); link.wait_for(state='visible'); assert query.input_value()==''
                    if width==740 and js and not dark:
                        page.locator('.gm-filter input').fill('Вошер'); page.emulate_media(media='print')
                        assert page.locator('.gm-row:visible').count()==rows
                    count+=1; ctx.close()
        print(file,count,'PASS',rows,pairs)
    b.close()
