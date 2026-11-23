"""Read-only built-route inventory; planning evidence, NOT Reader parser/runtime."""
import argparse, collections, csv, json
from pathlib import Path
from html.parser import HTMLParser
p=argparse.ArgumentParser();p.add_argument('--product',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=Path(a.product);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
class Page(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.headings=collections.Counter();self.article=False;self.study=0;self.reader=False;self.engine=''
 def handle_starttag(self,t,attrs):
  d=dict(attrs)
  if d.get('id'):self.ids.append(d['id'])
  if t in ('h1','h2','h3'):self.headings[t]+=1
  if t=='article' and ('article-body' in d.get('class','').split() or 'data-pagefind-body' in d):self.article=True
  if d.get('id')=='gbAnalyticsStudy':self.study+=1
  if 'data-reader-root' in d or 'data-gill-v16' in d:self.reader=True
  if d.get('data-reader-engine'):self.engine=d['data-reader-engine']
manifest=json.loads((root/'migration/page-ownership.json').read_text());rows=[]
for route,meta in sorted(manifest['routes'].items()):
 f=root/'dist'/('index.html' if route=='/' else route.lstrip('/')+'index.html' if route.endswith('/') else route.lstrip('/'))
 if not f.is_file() or f.suffix!='.html':continue
 h=Page();h.feed(f.read_text());duplicates=[i for i,n in collections.Counter(h.ids).items() if n>1]
 protected=any(route.startswith(x) for x in ('/updates/','/journal/','/nagornaya/'))
 cohort='protected' if protected else 'review-article' if h.article else 'no-semantic-article-review'
 rows.append(dict(route=route,owner=meta.get('owner'),status=meta.get('status'),source=meta.get('source'),cohort=cohort,semanticArticle=h.article,readerMarker=h.reader,engine=h.engine,h1=h.headings['h1'],h2=h.headings['h2'],h3=h.headings['h3'],quizOwners=h.study,duplicateIds='|'.join(duplicates)))
summary={'scope':'manifest routes with built HTML only; markers are not runtime/readiness proof; protected G3 outside these prefixes needs manual ownership review','routes':len(rows),'cohorts':dict(collections.Counter(r['cohort'] for r in rows)),'semanticArticle':sum(r['semanticArticle'] for r in rows),'readerMarker':sum(r['readerMarker'] for r in rows),'duplicateIdRoutes':[r['route'] for r in rows if r['duplicateIds']]}
(out/'inventory.json').write_text(json.dumps({'summary':summary,'routes':rows},ensure_ascii=False,indent=2)+'\n')
with (out/'inventory.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
print(json.dumps(summary,ensure_ascii=False,indent=2))
