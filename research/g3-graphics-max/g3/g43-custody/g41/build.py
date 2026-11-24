from pathlib import Path
from bs4 import BeautifulSoup
import re
root=Path(__file__).parent
css=(root/'editorial.css').read_text()
# Preserve previously tested bodies as input specimens; exact copies packaged.
for name,src in [('atlas',root/'input-atlas.html'),('spread',root/'input-spread.html')]:
 s=BeautifulSoup(src.read_text(),'html.parser')
 if name=='atlas':
  entries=s.select('.entry');entries[-1].decompose()
  s.select_one('.kicker').string='Историко-богословский атлас · 2013–2022'
  s.select_one('.intro').string='Четыре тематических сопоставления материалов разных лет. Каталог, авторский текст и свидетельство участника имеют разные границы достоверности.'
  e=entries[2]; e.select_one('h2').string='Троица и дело Христа';w=e.select_one('.witness');w.h3.string='Х. Б. Чарльз';w.select_one('.topic').string='Воскресение Христа как событие Троицы';w.a['aria-label']='Источник: Х. Б. Чарльз, 2016';e.select_one('.boundary').string='Два богословских ракурса дела Христа: воскресение и страдающий Раб. Второе содержание передано по свидетельству Джеффа Кроттса.'
  s.select_one('footer p:last-child').string='Исследовательский макет G41 · не для публикации. Нет заявлений о прослушивании записей, новых правах или точных цитатах.'
 if name=='atlas':
  for w in s.select('.witness'):
   a=w.a; label='Источник: '+w.h3.get_text(strip=True)+', '+w.select_one('.year').get_text(strip=True);a.string=label;a.attrs.pop('aria-label',None)
 main=str(s.main).replace('viewbox=','viewBox=')
 title='G41 · '+('Тематический атлас' if name=='atlas' else 'Две линии 2018 года')
 (root/f'{name}.html').write_text(f'<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>{css}</style></head><body>{main}</body></html>')
