from pathlib import Path
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import json, re, subprocess, os
import fitz
P=Path(__file__).parent
# Exact palette from src/styles/editorial-edition.css @22a44d43 (fonts not bundled in fixture).
base='''html{margin:0}body{margin:0}.journal-edition{--je-paper:#faf7f0;--je-paper-raised:#f2ece0;--je-ink:#142536;--je-gold:#896020;--je-rule:#d5cbb9;--je-muted:#5e5b54;--je-serif:Georgia,serif;--je-body:Georgia,serif;--je-ui:system-ui,sans-serif;color:var(--je-ink);background:var(--je-paper);min-height:100vh}.dark .journal-edition{--je-paper:#111c27;--je-paper-raised:#192735;--je-ink:#f2eadd;--je-gold:#e2bb79;--je-rule:#354554;--je-muted:#bcb8af}.journal-edition .timeline>li{display:grid;grid-template-columns:116px minmax(0,1fr);gap:26px}.journal-edition a{color:var(--je-ink)}.journal-edition a:hover{color:var(--je-gold)}.journal-edition a:focus-visible{outline:2px solid var(--je-gold);outline-offset:5px}.story{max-width:740px;margin:auto;padding:0;min-width:0}.bibliography-item{margin:12px 0;padding:12px;border-top:1px solid var(--je-rule)}.bibliography-item a{display:inline-block;padding:8px}.bibliography-item:target,[data-journal-citation]:target{outline:2px solid var(--je-gold);outline-offset:2px}@page{margin:14mm}@media print{.journal-edition{min-height:0;background:white}.story{max-width:100%!important}}'''
# Fixture-only reproduction of the repository's JournalSourceReturn click handler; no new runtime shipped.
adapter='''document.querySelectorAll('[data-journal-source-navigation]').forEach(article=>{article.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!(event.target instanceof Element))return;const citation=event.target.closest('a[data-journal-citation][id]');if(!citation||!article.contains(citation)||citation.origin!==location.origin||citation.pathname!==location.pathname||citation.search!==location.search)return;let id;try{id=decodeURIComponent(citation.hash.slice(1))}catch{return}const source=document.getElementById(id);if(!source||!article.contains(source)||!source.matches('.bibliography-item'))return;const back=source.querySelector('[data-journal-source-return]');const label=back?.querySelector('[data-journal-source-return-label]');if(!back||!label)return;back.setAttribute('href','#'+citation.id);label.textContent='К месту чтения';back.setAttribute('aria-label','К месту чтения: '+citation.textContent.replace(/\\s+/gu,' ').trim())})});'''
C=P.parents[2]/'src/components/journal/g3-graphics'
if not C.is_dir(): C=P
css=(C/'graphics.css').read_text()
subprocess.run(['node',str(P/'fixture.mjs')],check=True)
def static_fragment(file):
 s=(C/file).read_text().split('---',2)[2]
 return re.sub(r"href=\{historyCitation\('([a-z0-9-]+)'\)\}",r'href="#history-source-\1"',s)
frags={'history':static_fragment('G3HistoricalPanorama.astro'),'ecosystem':static_fragment('G3EcosystemSpread.astro'),'finance':(P/'finance.fragment.html').read_text()}

def witness(name,theme,width,with_sources=True):
 f=frags[name];s=BeautifulSoup(f,'html.parser'); anchors=s.select('a[data-journal-citation]');dest=sorted(set(a['href'][1:] for a in anchors));sources=''.join(f'<section tabindex="-1" class="bibliography-item" id="{d}"><h4>{d}</h4><a data-journal-source-return href="#fallback"><span data-journal-source-return-label>К связанному разделу статьи</span></a></section>' for d in dest) if with_sources else ''
 return '<!doctype html><html lang="ru" class="'+('dark' if theme=='dark' else '')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+base+css+f'.story{{max-width:{width}px}}</style><body class="journal-edition"><main class="story" data-journal-source-navigation><div id="fallback" tabindex="-1"></div>'+f+sources+'</main><script>'+adapter+'</script></body></html>'

out=[];trips=[];forced=[];compact=[];disclosure=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 for n in frags:
  for t in ['light','dark']:
   for w in [320,360,390,430,580,640,660,680,740,850,1024]:
    pg=b.new_page(viewport={'width':max(1024,w),'height':900},java_script_enabled=False)
    pg.set_content(witness(n,t,w));root=pg.locator('.g3g');height=root.bounding_box()['height'];compact.append({'name':n,'theme':t,'width':w,'height':height})
    if w in [390,740]:root.screenshot(path=str(P/f'{n}-{w}-{t}.png'))
    if n=='history':
     assert pg.locator('details').get_attribute('open') is None
     pg.locator('summary').focus();pg.keyboard.press('Enter');assert pg.locator('details').get_attribute('open') is not None
    d=pg.evaluate('''()=>{let r=document.querySelector('.g3g'),b=r.getBoundingClientRect(),links=[...r.querySelectorAll('a')];return {width:b.width,overflow:r.scrollWidth>r.clientWidth+1,documentOverflow:document.documentElement.scrollWidth>innerWidth,linkMin:Math.min(...links.map(a=>a.getBoundingClientRect().height)),duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((v,i,a)=>a.indexOf(v)!==i),clipped:[...r.querySelectorAll('h3,h4,h5,p,td,th,a')].filter(e=>e.scrollWidth>e.clientWidth+2&&e.clientWidth>0).map(e=>e.textContent.slice(0,70)),linkNames:links.map(a=>a.textContent.trim()),badLocal:links.filter(a=>a.hasAttribute('data-journal-citation')&&!document.getElementById(a.hash.slice(1))).length}}''')
    d.update(name=n,theme=t,target=w);d['pass']=abs(d['width']-w)<1 and not d['overflow'] and not d['documentOverflow'] and d['linkMin']>=43.9 and not d['duplicateIds'] and not d['clipped'] and len(set(d['linkNames']))==len(d['linkNames']) and d['badLocal']==0;out.append(d)
    if n=='history' and w in [390,740]:pg.locator('.g3g').screenshot(path=str(P/f'{n}-{w}-{t}-expanded.png'))
    pg.close()
   pg=b.new_page(viewport={'width':1024,'height':900},forced_colors='active',java_script_enabled=False);pg.set_content(witness(n,t,390));forced.append({'name':n,'theme':t,'pass':pg.locator('.g3g').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')});pg.close()
  for fmt in ['A4','Letter']:
   pg=b.new_page(viewport={'width':1024,'height':900},java_script_enabled=False);pg.set_content(witness(n,'light',740,False));pg.pdf(path=str(P/f'{n}-{fmt}.pdf'),format=fmt,print_background=True);pg.close()
  # Native hash navigation in about:blank fixture (no external request).
  for w in [390,740]:
   for js in [True,False]:
    pg=b.new_page(viewport={'width':max(1024,w),'height':900},java_script_enabled=js)
    pg.set_content(witness(n,'light',w));
    if n=='history':pg.locator('summary').focus();pg.keyboard.press('Enter')
    ids=pg.locator('.g3g a[data-journal-citation]').evaluate_all('(xs)=>xs.map(a=>a.id)')
    for id in ids:
     link=pg.locator('#'+id);href=link.get_attribute('href');link.focus();pg.keyboard.press('Enter');pg.wait_for_url('**'+href)
     back=pg.locator(href+' [data-journal-source-return]');expected='#'+id if js else '#fallback';actual=back.get_attribute('href');back.focus();pg.keyboard.press('Enter');pg.wait_for_url('**'+expected);trips.append({'name':n,'width':w,'js':js,'id':id,'pass':actual==expected})
    if n=='history':
     pg.set_content(witness(n,'light',w));pg.evaluate("location.hash='cite-g3g-history-6'")
     pg.wait_for_timeout(120)
     opened=pg.locator('details').get_attribute('open') is not None
     disclosure.append({'width':w,'js':js,'pass':opened and pg.locator('#cite-g3g-history-6').is_visible()})
    pg.close()
 b.close()
(P/'qa.json').write_text(json.dumps({'geometry':out,'forced':forced,'sourceReturn':trips,'compact':compact,'disclosure':disclosure},ensure_ascii=False,indent=2))
for k,x in [('geometry',out),('forced',forced),('sourceReturn',trips),('disclosure',disclosure)]:
 print(k,sum(r['pass'] for r in x),'/',len(x));print([r for r in x if not r['pass']][:3])

print_rows=[]
for name in frags:
 for fmt in ['A4','Letter']:
  pdf=P/f'{name}-{fmt}.pdf'
  with fitz.open(pdf) as doc:
   counts=[len(page.get_text()) for page in doc];full=' '.join(' '.join(page.get_text().split()) for page in doc);labels=[a.get_text(' ',strip=True) for a in BeautifulSoup(frags[name],'html.parser').select('a')];missing=[a for a in labels if a not in full]
   print_rows.append({'file':pdf.name,'pages':len(doc),'textChars':counts,'missingLabels':missing,'pass':all(c>0 for c in counts) and not missing and len(doc)<=(2 if name=='history' else 2)})
(P/'qa-print.json').write_text(json.dumps(print_rows,indent=2))
print('print',sum(r['pass'] for r in print_rows),'/',len(print_rows))
if not all(r['pass'] for r in out+forced+trips+print_rows+disclosure): raise SystemExit(1)
