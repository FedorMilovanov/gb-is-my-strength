from pathlib import Path
from playwright.sync_api import sync_playwright
import json,fitz,hashlib
root=Path(__file__).parent
results=[];prints=[]; failures=[]
probe=r'''()=>{const lum=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);const rgb=s=>{let m=s.match(/^rgba?\(([^)]+)\)$/);if(!m)return null;let a=m[1].split(',').map(Number);return (a[3]??1)===1?a.slice(0,3):null};const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);const items=[],bad=[],unknown=[],outside=[];for(const e of document.querySelectorAll('main,main *')){const st=getComputedStyle(e);if(st.display==='none'||st.visibility==='hidden'||e.closest('svg'))continue;const direct=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());if(!direct.length)continue;let bg=null;for(let p=e;p;p=p.parentElement){const c=getComputedStyle(p);if(c.backgroundImage!=='none'||+c.opacity!==1){bg=null;break}bg=rgb(c.backgroundColor);if(bg)break}const fg=rgb(st.color);if(!fg||!bg){unknown.push(e.tagName);continue}const r=ratio(fg,bg);const large=parseFloat(st.fontSize)>=24||(parseFloat(st.fontSize)>=18.6667&&parseInt(st.fontWeight)>=700);const item={text:direct.map(n=>n.textContent.trim()).join(' ').slice(0,120),ratio:+r.toFixed(3),threshold:large?3:4.5};items.push(item);if(r<item.threshold)bad.push(item);for(const n of direct){const range=document.createRange();range.selectNode(n);for(const rect of range.getClientRects())if(rect.width>0&&(rect.left<-.5||rect.right>innerWidth+.5))outside.push(item.text)}}return {overflow:document.documentElement.scrollWidth-innerWidth,duplicateIds:document.querySelectorAll('[id]').length-new Set([...document.querySelectorAll('[id]')].map(e=>e.id)).size,links:document.querySelectorAll('a[href]').length,minRatio:Math.min(...items.map(x=>x.ratio)),samples:items.length,bad,unknown,outside}}'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for name,links in [('atlas',9),('spread',7)]:
  html=(root/f'{name}.html.txt').read_text()
  for w,theme,mode in [(w,t,m) for m in ['normal','text200','forced'] for w in [320,390,1440] for t in ['light','dark']]:
   c=b.new_context(viewport={'width':w,'height':900},color_scheme=theme,forced_colors='active' if mode=='forced' else 'none',java_script_enabled=False);page=c.new_page();page.set_content(html)
   if mode=='text200':page.evaluate('''()=>{const elements=[...document.querySelectorAll('main,main *')].filter(e=>!e.closest('svg'));const sizes=elements.map(e=>parseFloat(getComputedStyle(e).fontSize));elements.forEach((e,i)=>e.style.fontSize=(sizes[i]*2)+'px')}''')
   state=page.evaluate(probe);expected=page.locator('a[href]').evaluate_all('(a)=>a.map(x=>x.href)');f=[];r=[];focus=[]
   for _ in expected:
    page.keyboard.press('Tab');f.append(page.evaluate('document.activeElement.href'));focus.append(page.evaluate('''()=>{let s=getComputedStyle(document.activeElement);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>=2}'''))
   for _ in expected[1:]:page.keyboard.press('Shift+Tab');r.append(page.evaluate('document.activeElement.href'))
   semantic=page.evaluate('''()=>({lang:document.documentElement.lang,h1:document.querySelectorAll('h1').length,empty:[...document.querySelectorAll('a[href]')].filter(e=>!e.textContent.trim()).length,ariaMismatch:[...document.querySelectorAll('a[aria-label]')].filter(e=>!e.getAttribute('aria-label').includes(e.textContent.trim())).length,retroOutside:!document.querySelector('.retrospective')||!document.querySelector('.lanes').contains(document.querySelector('.retrospective'))})''')
   row=dict(name=name,width=w,theme=theme,mode=mode,**state,forward=len(f),backward=len(r),focus=sum(focus),semantic=semantic)
   ok=state['overflow']==0 and state['duplicateIds']==0 and state['links']==links and not any(state[k] for k in ['bad','unknown','outside']) and f==expected and r==expected[-2::-1] and all(focus) and semantic==dict(lang='ru',h1=1,empty=0,ariaMismatch=0,retroOutside=True)
   row['pass']=ok;results.append(row)
   if not ok:failures.append(row)
   if (w,theme,mode) in [(1440,'light','normal'),(390,'dark','normal'),(320,'light','forced'),(320,'dark','text200')]:page.screenshot(path=str(root/f'{name}-{w}-{theme}-{mode}.png'),full_page=True,animations='disabled')
   c.close()
  c=b.new_context(color_scheme='light',java_script_enabled=False);page=c.new_page();page.set_content(html);page.emulate_media(media='print')
  for fmt in ['A4','Letter']:page.pdf(path=str(root/f'{name}-{fmt}.pdf'),format=fmt,print_background=True)
  c.close()
 b.close()
for name,links in [('atlas',9),('spread',7)]:
 for fmt in ['A4','Letter']:
  with fitz.open(root/f'{name}-{fmt}.pdf') as d:
   words=[len(page.get_text('words')) for page in d];n=sum(len(page.get_links()) for page in d);bbox=all(0<=x[0]<=x[2]<=page.rect.width and 0<=x[1]<=x[3]<=page.rect.height for page in d for x in page.get_text('words'));text=' '.join(' '.join(page.get_text().split()) for page in d);ok=len(d)==1 and n==links and bbox and 'Исследовательский' in text and (name!='spread' or '23 мая 2025' in text)
   for i,page in enumerate(d):page.get_pixmap(matrix=fitz.Matrix(1.25,1.25),alpha=False).save(root/f'{name}-{fmt}-{i+1}.png')
   prints.append(dict(name=name,format=fmt,pages=len(d),words=words,links=n,bbox=bbox,passed=ok))
r=dict(screens=results,print=prints,sha256={f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in ['editorial.css','atlas.html.txt','spread.html.txt','build.py','qa.py']});(root/'qa.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print('screens',len(results),'fail',len(failures),'transitions',sum(x['forward']+x['backward'] for x in results),'contrast samples',sum(x['samples'] for x in results));print('FAIL',json.dumps(failures[:3],ensure_ascii=False));print('print',prints);print(r['sha256'])
