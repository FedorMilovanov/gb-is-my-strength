"""Generate fixture first with finance-build.py; static witness only, not Astro."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, fitz, tempfile
p=Path(__file__).parent
html=(p/'finance-compact.html.txt').read_text()
report=[]
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    executable=os.environ.get('CHROMIUM_EXECUTABLE')
    b=pw.chromium.launch(**({'executable_path':executable} if executable else {}),args=['--no-sandbox'])
    for w in [280,320,360,390,430,520,560,680,704,740,768,850,1440]:
        for dark in [False,True]:
            page=b.new_page(viewport={'width':w,'height':900},java_script_enabled=False)
            page.set_content(html);page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert page.get_by_role('columnheader').count()==5 and page.get_by_role('rowheader').count()==7 and page.get_by_role('cell').count()==28
            assert page.locator('figure').count()==3 and page.locator('rect.gaf-expense').count()==7
            assert page.locator('table caption').bounding_box()['width']>=page.locator('table').bounding_box()['width']-1
            assert page.locator('td').evaluate_all('(els)=>els.every(e=>e.scrollWidth<=e.clientWidth+1)')
            columns=page.locator('.gaf-pair').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").length')
            assert columns==(2 if min(w,850)-24>=680 else 1)
            report.append({'width':w,'dark':dark,'height':round(page.locator('.g3-annual-finance').bounding_box()['height']),'columns':columns})
            page.close()
    for dark in [False,True]:
        page=b.new_page(viewport={'width':740,'height':900},forced_colors='active',java_script_enabled=False)
        page.set_content(html);page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
        assert page.locator('rect.gaf-expense').first.evaluate('(e)=>getComputedStyle(e).fill')=='none'
        assert page.locator('rect.gaf-expense').first.evaluate('(e)=>getComputedStyle(e).stroke')!='none'
        page.close()
    for dark in [False,True]:
        page=b.new_page(viewport={'width':740,'height':900},java_script_enabled=False)
        page.set_content(html);page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
        page.emulate_media(media='print')
        assert page.locator('rect.gaf-revenue').first.evaluate('(e)=>getComputedStyle(e).fill')=='rgb(20, 103, 95)'
        path=Path(tmp)/('print-dark.pdf' if dark else 'print-light.pdf')
        page.pdf(path=str(path),format='A4',print_background=True,margin={'top':'12mm','bottom':'12mm','left':'12mm','right':'12mm'})
        with fitz.open(path) as doc:
            assert len(doc)==1
            digits=''.join(' '.join(x.get_text() for x in doc).split())
            assert all(x in digits for x in ['1735978','2071986','550997','304459'])
        page.close()
    b.close()
assert len(report)==26
print(json.dumps(report,indent=2))
