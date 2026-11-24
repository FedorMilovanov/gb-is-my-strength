from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
manifest=json.loads((root/'manifest.json').read_text());out=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for js in [False,True]:
   for width in [320,390,1440]:
    c=browser.new_context(java_script_enabled=js,viewport={'width':width,'height':800});page=c.new_page()
    try:
     page.set_content((root/'combined-navigation.html').read_text());ids=page.locator('[id]').evaluate_all('(els)=>els.map(x=>x.id)');assert len(ids)==len(set(ids));assert page.locator('.bibliography-item').count()==15;assert page.locator('[data-journal-citation]').count()==16
     for r in manifest:
      cid=r['citationId'];target=r['href'];a=page.locator('#'+cid);a.focus();a.press('Enter');assert page.evaluate('location.hash')==target,(cid,page.url)
      focus=page.evaluate('document.activeElement.id');assert focus==target[1:],(cid,focus,target)
      back=page.locator(target+' [data-journal-source-return]');expected='#'+cid if js else '#'+r['canonicalReturn'];assert back.get_attribute('href')==expected,(cid,back.get_attribute('href'),expected)
      back.focus();back.press('Enter');assert page.evaluate('location.hash')==expected
      if js:assert page.evaluate('document.activeElement.id')==cid
      out.append({'js':js,'width':width,'citation':cid,'target':target,'fallbackOrExact':expected,'pass':True})
     if js:
      # Both specimens cite the same source: the second navigation must replace the first return target.
      shared=[x for x in manifest if x['sourceId']=='challies-2018-lessons'];assert len(shared)==2
      for r in shared:
       a=page.locator('#'+r['citationId']);a.focus();a.press('Enter');assert page.locator(r['href']+' [data-journal-source-return]').get_attribute('href')=='#'+r['citationId']
    finally:c.close()
 finally:browser.close()
(root/'qa.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print('navigation journeys',len(out),'PASS')
