#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / 'scripts/build-genesis6-footnote-product.py'
OUT = ROOT / 'out'

spec = importlib.util.spec_from_file_location('genesis6_footnote_builder', BUILDER_PATH)
if spec is None or spec.loader is None:
    raise SystemExit('cannot load canonical footnote builder')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

EXPECTED_MISMATCHES = {
    '6B Matthew 22:30',
    '6B Qumran/Hermon',
    '6B forbidden arts',
    '6B 10:8 text',
    '6B 98:4',
    '6B 10:8 interpretations',
    '6B 15:8-12',
    '6B canonical demonology',
    '6B Enoch role',
    '6B corpus bibliography',
}

FINAL_REFERENCES = [
    ('Книга Стражей понимает «сынов Божиих» Быт. 6 как небесных существ, вступивших в запретную связь с женщинами.', 'Книга Стражей понимает «сынов Божиих» Быт. 6 как небесных существ, вступивших в запретную связь с женщинами.[^4]'),
    ('Быт. 6, Иуд. 6–7 и 2 Пет. 2 этих данных не приводят.', 'Быт. 6, Иуд. 6–7 и 2 Пет. 2 этих данных не приводят.[^5]'),
    ('1 Енох связывает ангельское обучение с оружием, металлами, украшениями, косметикой, заклинаниями, корнями и наблюдением небесных знаков.', '1 Енох связывает ангельское обучение с оружием, металлами, украшениями, косметикой, заклинаниями, корнями и наблюдением небесных знаков.[^6]'),
    ('В распространённых переводах 1 Енох 10:8 Азазелю приписывается развращение земли через запрещённое обучение, после чего следует формула, которую можно передать как «припиши ему весь грех».', 'В распространённых переводах 1 Енох 10:8 Азазелю приписывается развращение земли через запрещённое обучение, после чего следует формула, которую можно передать как «припиши ему весь грех».[^7]'),
    ('В 1 Енох 98:4 грех не представляется посланным на землю: люди сами производят его.', 'В 1 Енох 98:4 грех не представляется посланным на землю: люди сами производят его.[^9]'),
    ('При первом чтении место трудно согласуется с каноническим учением.', 'При первом чтении место трудно согласуется с каноническим учением.[^10]'),
    ('Книга Стражей объясняет злых духов как духов погибших исполинов — потомства небесных существ и женщин.', 'Книга Стражей объясняет злых духов как духов погибших исполинов — потомства небесных существ и женщин.[^11]'),
    ('Но они не отождествляют всех бесов с бесплотными остатками погибших нефилимов.', 'Но они не отождествляют всех бесов с бесплотными остатками погибших нефилимов.[^12]'),
    ('- он выступает писцом и вестником.', '- он выступает писцом и вестником.[^13]'),
    ('Его утверждения необходимо оценивать по отдельности.', 'Его утверждения необходимо оценивать по отдельности.[^27]'),
]


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return source.replace(old, new, 1)


def build_article_6b() -> str:
    mismatches: set[str] = set()
    original = builder.replace_once

    def inventory(source: str, old: str, new: str, label: str) -> str:
        count = source.count(old)
        if count == 1:
            return source.replace(old, new, 1)
        mismatches.add(label)
        return source

    builder.replace_once = inventory
    try:
        source = builder.patch_6b(builder.ARTICLE_6B.read_text(encoding='utf-8'))
    finally:
        builder.replace_once = original

    if mismatches != EXPECTED_MISMATCHES:
        raise SystemExit(f'6B mismatch inventory drift: {sorted(mismatches)}')

    for index, (old, new) in enumerate(FINAL_REFERENCES, start=1):
        source = replace_once(source, old, new, f'6B final reference {index}')
    return source


def main() -> None:
    builder.require_exact_blobs()
    if OUT.exists():
        shutil.rmtree(OUT)

    product = {
        'src/content/articles/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom.mdx': builder.patch_6a(builder.ARTICLE_6A.read_text(encoding='utf-8')),
        'src/content/articles/mozhno-li-doveryat-1-enohu-kanonicheskiy-audit.mdx': build_article_6b(),
        'data/genesis6-enoch-footnote-gates.json': json.dumps(builder.NEW_GATE, ensure_ascii=False, indent=2) + '\n',
        'scripts/genesis6-enoch-footnote-gate.mjs': builder.NEW_GATE_SCRIPT,
    }

    manifest = {'baseCommit': 'd469cd2a697fd5d70c2df877ef625bc8f0bfecb8', 'files': []}
    for relative, content in product.items():
        target = OUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8', newline='')
        data = target.read_bytes()
        manifest['files'].append({
            'path': relative,
            'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest(),
            'gitBlob': subprocess.check_output(['git', 'hash-object', str(target)], cwd=ROOT, text=True).strip(),
        })

    shadow = OUT / '_validation-root'
    for relative in product:
        source = OUT / relative
        destination = shadow / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    subprocess.run(['node', str(shadow / 'scripts/genesis6-enoch-footnote-gate.mjs')], cwd=shadow, check=True)
    shutil.rmtree(shadow)

    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
