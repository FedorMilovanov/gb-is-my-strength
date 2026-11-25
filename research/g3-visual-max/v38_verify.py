"""Standalone V37 review witness; never a routed release gate."""
import argparse
import hashlib
import json
from pathlib import Path

import fitz
from playwright.sync_api import sync_playwright

EXPECTED = 'd9aac51adcf206072a41848bbf9db97748724df77a9f2816ac08a2bf9beec2ac'
SOURCES = ('reformation', '316', 'host')

def verify(source, out, chromium):
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == EXPECTED, 'Wrong frozen V37 input'
    html = raw.decode('utf-8')
    out.mkdir(parents=True, exist_ok=True)
    cases, paper = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium, args=['--no-sandbox'], timeout=8000)
        try:
            for width in (320, 390, 768, 1440):
                for theme in ('light', 'dark'):
                    ctx = browser.new_context(viewport={'width': width, 'height': 900}, color_scheme=theme, java_script_enabled=False)
                    try:
                        page = ctx.new_page()
                        requests = []
                        page.on('request', lambda request: requests.append(request.url))
                        page.set_content(html)
                        metrics = page.evaluate('''()=>({width:document.documentElement.scrollWidth, viewport:innerWidth, bodyFont:getComputedStyle(document.querySelector('.detail')).fontSize, internal:[...document.querySelectorAll('a[href^="#"]')].every(a=>document.getElementById(a.hash.slice(1))), uniqueIds:new Set([...document.querySelectorAll('[id]')].map(a=>a.id)).size===document.querySelectorAll('[id]').length})''')
                        assert metrics['width'] == width and metrics['bodyFont'] == '17px' and metrics['internal'] and metrics['uniqueIds']
                        expected = page.locator('a[href]').evaluate_all('(links)=>links.map(a=>a.getAttribute("href"))')
                        for direction, order in [('Tab', expected), ('Shift+Tab', list(reversed(expected[:-1])))]:
                            for href in order:
                                page.keyboard.press(direction)
                                assert page.evaluate('document.activeElement.getAttribute("href")') == href, (width, theme, direction, href)
                        for key in SOURCES:
                            page.locator('#v37-cite-' + key).focus()
                            page.keyboard.press('Enter')
                            assert page.evaluate('location.hash') == '#v37-source-' + key
                            page.locator('#v37-source-' + key + ' .return').focus()
                            page.keyboard.press('Enter')
                            assert page.evaluate('location.hash') == '#v37-cite-' + key
                        assert not requests
                        cases.append({'width': width, 'theme': theme, 'forwardTabs': len(expected), 'reverseTabs': len(expected)-1, 'keyboardRoundTrips': len(SOURCES), 'externalRequests': len(requests), **metrics})
                    finally:
                        ctx.close()
            for fmt in ('A4', 'Letter'):
                ctx = browser.new_context(java_script_enabled=False, color_scheme='light')
                try:
                    page = ctx.new_page()
                    # Keep the frozen input intact; only the paper-size setting changes for Letter.
                    assert html.count('@page{size:A4;') == 1
                    page.set_content(html.replace('@page{size:A4;', '@page{size:'+fmt+';'), timeout=3000)
                    page.emulate_media(media='print')
                    target = out / f'V38-{fmt}.pdf'
                    page.pdf(path=str(target), prefer_css_page_size=True, print_background=True)
                finally:
                    ctx.close()
                with fitz.open(target) as pdf:
                    assert len(pdf) == 1
                    sheet = pdf[0]
                    words = sheet.get_text('words')
                    links = sheet.get_links()
                    outside = sum(not sheet.rect.contains(fitz.Rect(word[:4])) for word in words)
                    assert outside == 0 and len(links) == 6 and 'ожидает принятия Research' in sheet.get_text()
                    assert abs(sheet.rect.width - (595 if fmt == 'A4' else 612)) < 2
                    assert abs(sheet.rect.height - (842 if fmt == 'A4' else 792)) < 2
                    sheet.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(out / f'V38-{fmt}.png')
                    paper.append({'format': fmt, 'pages': len(pdf), 'sizePt': [sheet.rect.width, sheet.rect.height], 'words': len(words), 'links': len(links), 'outside': outside, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
        finally:
            browser.close()
    result = {'inputSha256': EXPECTED, 'screens': cases, 'paper': paper, 'scope': 'standalone noJS Chromium; not real-route, axe or multi-engine acceptance'}
    (out / 'V38-report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'screens':len(cases),'keyboardRoundTrips':sum(c['keyboardRoundTrips'] for c in cases),'forwardTabs':sum(c['forwardTabs'] for c in cases),'reverseTabs':sum(c['reverseTabs'] for c in cases),'paper':paper}, ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('out', type=Path)
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    args = parser.parse_args()
    verify(args.source, args.out, args.chromium)
