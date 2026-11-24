"""Inspect actual A4 print evidence from joint-component-qa.mjs. No network or source edits."""
from pathlib import Path
import json, re, unicodedata
import fitz
root=Path(__file__).resolve().parents[2]
data=json.loads((root/'src/components/journal/g3-visual/adopted-visual-data.json').read_text(encoding='utf-8'))
base=json.loads((root/'src/components/journal/g3-visual/matrix-data.json').read_text(encoding='utf-8'))
names=set(r['name'] for r in base['rows'])|set(r['name'] for r in data['matrix']['entries'])
norm=lambda s: re.sub(r'\s+|\u00ad','',unicodedata.normalize('NFKC',s)).replace('−','-')
out=[]
for kind in ['history','finance']:
 for theme in ['light','dark']:
  p=root/'pdf-evidence'/f'{kind}-{theme}.pdf'
  with fitz.open(p) as doc:
   text=norm(''.join(page.get_text(sort=True) for page in doc))
   assert all(abs(page.rect.width-595.28)<2 and abs(page.rect.height-841.89)<2 for page in doc), str(p)
   if kind=='history':
    # Source bibliography does not contain all 26 names. Matrix rows must survive filter.
    # Verify exact names and all year header values in PDF text, not just print DOM.
    missing=sorted(n for n in names if norm(n) not in text)
    assert not missing, f'{p.name}: missing {missing}'
    assert all(str(y) in text for y in range(2013,2022))
    check=len(names)
   else:
    expected=[r[k] for r in data['finance']['rows'] for k in ['revenue','expenses','result','netAssets']]
    missing=[v for v in expected if str(v) not in text]
    assert not missing,f'{p.name}: missing {missing}'
    assert 'Внутренняяприёмка' not in text
    check=len(expected)
   out.append(dict(file=p.name,pages=len(doc),verified=check,links=sum(len(page.get_links()) for page in doc)))
print('PDF_RESULT '+json.dumps(out,ensure_ascii=True))
