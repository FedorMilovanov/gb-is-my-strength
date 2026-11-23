#!/usr/bin/env python3
"""Report individual extracted text checks, not browser acceptance."""
import json, re, sys
from pathlib import Path
from pypdf import PdfReader
folder = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/527-variance')
norm = lambda text: re.sub(r'\s+', '', text).casefold()
needles = {
    'paragraph': '1 Ин. 4:18 и 2 Кор. 3:17 здесь служат только осторожным каноническим резонансом в собственном контексте, а не прямыми организационными стихами-доказательствами.',
    'editorial': 'Писание выше личности и системы',
    'sdg': 'SOLI DEO GLORIA',
    'accuracy': 'Богословскую или техническую — напишите, исправим',
}
for r in json.loads((folder / 'manifest.json').read_text())['rows']:
    pdf = PdfReader(folder / r['file'])
    text = norm(''.join(p.extract_text() or '' for p in pdf.pages))
    missing = [name for name, phrase in needles.items() if norm(phrase) not in text]
    print(f"{r['file']}: {len(pdf.pages)} pages; missing={missing}")
