"""Read-only built HTML audit of both native TOC overlays, including cross-route fragments.
Exit1 on unresolved route/fragment; HTML only, not browser/UI acceptance.
"""
import argparse,collections,json,pathlib,urllib.parse
from html.parser import HTMLParser
p=argparse.ArgumentParser();p.add_argument('--dist',required=True);p.add_argument('--output',required=True);args=p.parse_args()
root=pathlib.Path(args.dist).resolve()
void=set('area base br col embed hr img input link meta param source track wbr'.split())
class Doc(HTMLParser):
 def __init__(self,text):
  super().__init__(convert_charrefs=True);self.stack=[];self.ids=collections.Counter();self.links=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);id=a.get('id');self.ids.update([id] if id else [])
  overlay=id if id in ['partTocOverlay','seriesTocOverlay'] else next((s[1] for s in reversed(self.stack) if s[1]),None)
  if tag=='a' and 'href' in a and overlay:self.links.append({'overlay':overlay,'href':a['href'],'ariaCurrent':a.get('aria-current')})
  if tag not in void:self.stack.append((tag,overlay))
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==tag:self.stack=self.stack[:i];break
cache={}
def doc(file):
 if file not in cache:cache[file]=Doc(file.read_text())
 return cache[file]
def target_file(path):
 decoded=urllib.parse.unquote(path).lstrip('/');file=(root/decoded).resolve()
 if not file.is_relative_to(root):return None
 if file.is_dir():file=file/'index.html'
 return file
rows=[]
for file in sorted(root.rglob('index.html')):
 text=file.read_text()
 if 'id="partTocOverlay"' not in text:continue
 route='/'+str(file.relative_to(root).parent)+'/'
 source=doc(file)
 for link in source.links:
  u=urllib.parse.urlsplit(urllib.parse.urljoin('https://audit.invalid'+route,link['href']))
  if u.netloc!='audit.invalid':continue
  dest=target_file(u.path);fragment=urllib.parse.unquote(u.fragment);exists=bool(dest and dest.is_file());count=doc(dest).ids[fragment] if exists and fragment else None
  rows.append({'source':route,**link,'targetPath':u.path,'fragment':fragment,'crossRoute':u.path!=route,'fileExists':exists,'targetIdCount':count,'pass':exists and (not fragment or count==1)})
summary={'routes':len(set(r['source']for r in rows)),'links':len(rows),'crossRouteLinks':sum(r['crossRoute']for r in rows),'crossRouteFragments':sum(r['crossRoute']and bool(r['fragment'])for r in rows),'uniqueCrossRouteDestinations':len(set((r['targetPath'],r['fragment'])for r in rows if r['crossRoute'])),'failures':[r for r in rows if not r['pass']]}
out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
(out/'links.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');(out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2));raise SystemExit(bool(summary['failures']))
