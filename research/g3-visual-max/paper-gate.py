"""Poppler-backed actual-PDF validation, no third-party Python dependencies."""
from pathlib import Path
import json,re,subprocess,unicodedata,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
dir=root/'pdf-evidence'
data=json.loads((root/'src/components/journal/g3-visual/adopted-visual-data.json').read_text(encoding='utf-8'))
base=json.loads((root/'src/components/journal/g3-visual/matrix-data.json').read_text(encoding='utf-8'))
names=set(r['name'] for r in base['rows'])|set(r['name'] for r in data['matrix']['entries'])
norm=lambda s: re.sub(r'\s+|\u00ad','',unicodedata.normalize('NFKC',s)).replace('−','-')
def call(*args):
 return subprocess.check_output(args,encoding='utf-8',errors='replace')
out=[]
for p in sorted(dir.glob('*-A4-*.pdf'))+sorted(dir.glob('*-Letter-*.pdf')):
 kind,theme,paper,mode=p.stem.split('-')
 record={'file':p.name,'paper':paper,'mode':mode,'theme':theme}
 info=call('pdfinfo',str(p))
 size=re.search(r'Page size:\s+([\d.]+) x ([\d.]+)',info)
 assert size,info
 w,h=map(float,size.groups())
 expected=(595.28,841.89) if paper=='A4' else (612,792)
 assert all(abs(a-b)<2 for a,b in zip((w,h),expected)),(p.name,w,h)
 raw=call('pdftotext','-layout','-enc','UTF-8',str(p),'-')
 pages=raw.split('\f')
 pages=[t for t in pages if t.strip()]
 normalized=[norm(t) for t in pages]
 if kind=='history':
  match=[i for i,t in enumerate(normalized) if norm('Имена в каталогах G3') in t and all(norm(n) in t for n in names)]
  assert len(match)==1,(p.name,'matrix split',[(i+1,sum(norm(n) in t for n in names)) for i,t in enumerate(normalized)])
  idx=match[0]
  assert all(str(y) in normalized[idx] for y in range(2013,2022)),p.name
  record.update(verified=26,years=9,matrixPage=idx+1)
 else:
  expected_rows=[''.join(str(r[k]) for k in ['fy','revenue','expenses','result','netAssets']) for r in data['finance']['rows']]
  match=[i for i,t in enumerate(normalized) if all(row in t for row in expected_rows)]
  assert len(match)==1,(p.name,'finance rows split or absent')
  idx=match[0]
  record.update(verified=28,financePage=idx+1)
  assert not re.search(r'(?m)^\s*(201|202)\s*$',raw),(p.name,'split institutional year')
 # Check actual text word bounding boxes against physical sheet.
 xml=ET.fromstring(call('pdftotext','-bbox','-enc','UTF-8',str(p),'-'))
 pg=xml.findall('.//{*}page')
 assert len(pg)>=idx+1
 words=pg[idx].findall('.//{*}word')
 outside=[(word.text,dict(word.attrib)) for word in words if float(word.attrib['xMin'])<-.5 or float(word.attrib['yMin'])<-.5 or float(word.attrib['xMax'])>w+.5 or float(word.attrib['yMax'])>h+.5]
 assert not outside,(p.name,outside[:5])
 record.update(pages=len(pages),width=w,height=h,words=len(words),outside=0)
 # Actual rendered page, not a browser screenshot.
 subprocess.run(['pdftoppm','-f',str(idx+1),'-l',str(idx+1),'-r','120','-png','-singlefile',str(p),str(dir/(p.stem+'-page'))],check=True)
 out.append(record)
 assert 'Внутренняяприёмка' not in ''.join(normalized),p.name
assert len(out)==16,len(out)
(dir/'paper-report.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('PAPER_RESULT '+json.dumps(out,ensure_ascii=True,separators=(',',':')))
