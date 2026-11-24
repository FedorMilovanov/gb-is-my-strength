from pathlib import Path
from bs4 import BeautifulSoup
import json, hashlib
root=Path(__file__).parent
# Exact canonical source identities read at b3f4e004; fixture uses no invented sources.
rows=[
('gnl-2015','gnli.com/titles/2015','Каталог GNL, 2015','g3-year-2015'),('white-manuscripts-2022','making-sense-of-manuscripts','Джеймс Уайт · Making Sense of Manuscripts','g3-year-2022'),('white-bible-2022','how-we-got-our-bible','Джеймс Уайт · How We Got Our Bible','g3-year-2022'),('gnl-2014','gnli.com/titles/2014','Каталог GNL, 2014','g3-year-2014'),('challies-2018-lessons','seven-key-lessons-in-diversity','Статья Тима Чаллиса · 2 февраля 2018','g3-year-2018'),('gnl-2016','gnli.com/titles/2016','Каталог GNL, 2016','g3-year-2016'),('crotts-2021','anchoragegrace.org/gospel-grace-and-glory','Свидетельство Джеффа Кроттса · 2021','g3-growth'),('gnl-2013','gnli.com/titles/2013','Каталог GNL, 2013','g3-year-2013'),('piper-2019','the-invincible-power-of-joy-for-world-missions','Авторский текст Джона Пайпера · 2019','g3-year-2019'),('challies-2018-video','from-every-tribe-and-language','Сообщение Чаллиса · 23 января 2018','g3-year-2018'),('firstlove-2018','g3-conference-in-atlanta-georgia','Отчёт FirstLove · 30 января 2018','g3-year-2018'),('ascol-2018','founders.org/articles/the-statement','Рассказ Тома Аскола','g3-year-2018'),('statement-2018','socialjusticestatement.com','Текст заявления и история подготовки','g3-year-2018'),('responses-2018','churchleaders.com/news/333017','Отклики 2018 года','g3-year-2018'),('challies','challies.com/articles/you-me-and-g3','Воспоминания Чаллиса · 23 мая 2025','g3-history')]
manifest=[]
script='''document.querySelectorAll('[data-journal-source-navigation]').forEach(article=>{if(article.dataset.journalSourceNavigationBound)return;article.dataset.journalSourceNavigationBound='true';article.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!(event.target instanceof Element))return;const citation=event.target.closest('a[data-journal-citation][id]');if(!citation||!article.contains(citation)||citation.origin!==location.origin||citation.pathname!==location.pathname||citation.search!==location.search)return;let id;try{id=decodeURIComponent(citation.hash.slice(1))}catch{return}const source=document.getElementById(id);if(!source||!article.contains(source)||!source.matches('.bibliography-item'))return;const back=source.querySelector('[data-journal-source-return]');const label=back?.querySelector('[data-journal-source-return-label]');if(!back||!label)return;back.setAttribute('href',`#${citation.id}`);label.textContent='К месту чтения';back.setAttribute('aria-label',`К месту чтения: ${citation.textContent?.replace(/\\s+/gu,' ').trim()}`)})});'''
for name in ['atlas','spread']:
 s=BeautifulSoup((root/f'input-{name}.html').read_text(),'html.parser');main=s.main;main['data-journal-source-navigation']='';main['id']='main-content';main.header['id']='g3-meaning' if name=='atlas' else 'g3-year-2018'; bibliography=s.new_tag('section',id='history-bibliography');bibliography['aria-labelledby']='fixture-biblio-title';h=s.new_tag('h2',id='fixture-biblio-title');h.string='Источники · тестовый фрагмент';bibliography.append(h);ol=s.new_tag('ol');bibliography.append(ol);used={};links=[]
 for i,a in enumerate(main.find_all('a'),1):
  url=a['href'];matches=[r for r in rows if r[1] in url];assert len(matches)==1,(url,matches);sid,_,label,canonical_return=matches[0];cid=f'cite-g42-{name}-{i:02d}';a['id']=cid;a['data-journal-citation']='';a['href']='#history-source-'+sid;a.string=label
  links.append(dict(citationId=cid,sourceId=sid,href=a['href'],canonicalReturn=canonical_return,fixtureReturn='#'+main.header['id'],label=label,originalUrl=url))
  if sid in used:continue
  used[sid]=1;li=s.new_tag('li',id='history-source-'+sid);li['class']='bibliography-item';li['tabindex']='-1';title=s.new_tag('h3');title.string=label;li.append(title);orig=s.new_tag('a',href=url);orig.string='Оригинальный документ';li.append(orig);back=s.new_tag('a',href='#'+main.header['id']);back['data-journal-source-return']='';back['data-pagefind-ignore']='';back['class']='je-source-return';span=s.new_tag('span');span['data-journal-source-return-label']='';span.string='К связанному разделу статьи';back.append(span);li.append(back);ol.append(li)
 main.append(bibliography);css=s.new_tag('style');css.string='''#history-bibliography{margin-top:3rem;border-top:2px solid currentColor;padding-top:1rem} .bibliography-item{padding:1rem 0;border-bottom:1px solid currentColor;overflow-wrap:anywhere} .bibliography-item a{display:block;min-height:44px;padding:.5rem 0} .bibliography-item:target{outline:2px solid currentColor;outline-offset:3px} a[data-journal-citation]{scroll-margin-top:12px}''';s.head.append(css);js=s.new_tag('script');js.string=script;s.body.append(js)
 (root/f'{name}.html').write_text(str(s));manifest.extend(dict(specimen=name,**x) for x in links)
assert len(manifest)==16 and len({x['citationId'] for x in manifest})==16
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
# Combine both candidate blocks to test shared bibliography target and last-citation return.
a=BeautifulSoup((root/'atlas.html').read_text(),'html.parser');b=BeautifulSoup((root/'spread.html').read_text(),'html.parser');a.main.header['tabindex']='-1';b.main.header['tabindex']='-1';bib=a.select_one('#history-bibliography').extract();other=b.select_one('#history-bibliography').extract();s=a.new_tag('section',id='fixture-atlas-placement');s['aria-label']='Тематический атлас';
for child in list(a.main.children):s.append(child.extract())
a.main.append(s);t=a.new_tag('section',id='fixture-spread-placement');t['aria-label']='Документальный разворот';
for child in list(b.main.children):t.append(child.extract())
# Avoid collision between specimen layout classes: spread CSS is not merged here; this fixture tests navigation, not visual fidelity.
a.main.append(t)
for li in other.select('li.bibliography-item'):
 if not bib.find(id=li['id']):bib.ol.append(li.extract())
a.main.append(bib)
# In combined fixture, use a stand-in for each canonical fallback section rather than invent new anchor IDs.
for link in bib.select('[data-journal-source-return]'):
 sid=link.find_parent('li')['id'].removeprefix('history-source-');target=next(r[3] for r in rows if r[0]==sid);link['href']='#'+target
 if not a.find(id=target):
  section=a.new_tag('section',id=target);section['tabindex']='-1';h=a.new_tag('h2');h.string='Тестовая точка возврата · '+target;section.append(h);bib.insert_before(section)
ids=[x['id'] for x in a.select('[id]')];assert len(ids)==len(set(ids));assert len(bib.select('.bibliography-item'))==15
(root/'combined-navigation.html').write_text(str(a))
