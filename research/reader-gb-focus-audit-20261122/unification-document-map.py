"""Read-only documentation discovery; index is evidence, never new authority."""
import argparse,hashlib,json,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--product',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=Path(a.product);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
terms=re.compile(r'ReaderProjection|SeriesReaderChrome|OverlayRuntime|mobileChromeRegistry|readerTocProjection|GBReaderPreferences|унификац|unification',re.I)
rows=[];scanned=0
for area in ['docs','research']:
 for f in sorted((root/area).rglob('*.md')):
  b=f.read_bytes();s=b.decode('utf-8',errors='replace');scanned+=1;hits=list(terms.finditer(s))
  if not hits:continue
  rows.append({'path':str(f.relative_to(root)),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'hits':len(hits),'headings':re.findall(r'^#{1,3} .+',s,re.M)[:18]})
(out/'document-index.json').write_text(json.dumps({'sha':'ce08ef67b975b2264ceda0e45e9cd2eae6bf9fec','method':'All Markdown bytes under docs/research scanned; matches are discovery only, not manual full reading or authority. Unrelated engine docs are not read end-to-end.','scannedMarkdown':scanned,'matched':len(rows),'documents':rows},ensure_ascii=False,indent=2)+'\n')
print(scanned,len(rows))
