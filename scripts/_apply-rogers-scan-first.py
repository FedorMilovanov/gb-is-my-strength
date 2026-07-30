from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BODY = ROOT / "src/components/article-pilots/tma-na-serdce/TmaNaSerdceBody.astro"
AUDIT = ROOT / "scripts/hard-texts-visual-parity-audit.js"
PROVENANCE = ROOT / "docs/ROGERS-1691-SCAN-PROVENANCE.md"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one source fragment, found {count}")
    return text.replace(old, new, 1)


body = BODY.read_text(encoding="utf-8")
body = replace_once(
    body,
    "бороться с ним так же тщетно, как бороться с горячкой или чахоткой, подагрой или каменной болезнью.",
    "бороться с ним так же тщетно, как бороться с горячкой или плевритом, подагрой или каменной болезнью.",
    "Pleurisie translation",
)
old_source = '''<p><strong>Прямые цитаты и локаторы:</strong> Timothy Rogers, <a href="https://quod.lib.umich.edu/e/eebo2/A57573.0001.001?view=toc" target="_blank" rel="noopener"><em>A Discourse Concerning Trouble of Mind and the Disease of Melancholly</em></a> (1691), <em>The Preface: Containing Several Advices to the Relations and Friends of Melancholly People</em>, советы 1, 5 и 6. Первая блочная цитата переведена из совета 1, вторая — из совета 5; краткое предостережение не приписывать дьяволу действие болезни передаёт совет 6. Эти русские фрагменты являются переводом исторического текста, а не современной медицинской формулировкой. Выражение «жизненные духи» передаёт раннемодерное <em>spirits</em> и обозначает историческую физиологическую категорию, а не человеческую душу или Святого Духа.</p>'''
new_source = '''<p><strong>Прямые переводы и локаторы:</strong> Timothy Rogers, <a href="https://books.google.com/books?id=yMRjAAAAcAAJ&amp;printsec=frontcover" target="_blank" rel="noopener"><em>A Discourse Concerning Trouble of Mind and the Disease of Melancholly</em></a> (1691), открытый постраничный скан Google Books, <em>The Preface: Containing Several Advices to the Relations and Friends of Melancholly People</em>. Первая блочная цитата: совет 1, печ. с. ii, PDF с. 17; вторая: совет 5, печ. с. xii, PDF с. 27; краткое предостережение не приписывать дьяволу действие болезни: совет 6, печ. с. xiv, PDF с. 29. Эти русские фрагменты являются переводом исторического текста, а не современной медицинской формулировкой. Выражение «жизненные духи» передаёт раннемодерное <em>spirits</em> и обозначает историческую физиологическую категорию, а не человеческую душу или Святого Духа. Для структурной сверки оглавления и поиска использована <a href="https://quod.lib.umich.edu/e/eebo2/A57573.0001.001?view=toc" target="_blank" rel="noopener">транскрипция EEBO-TCP Университета Мичигана</a>; её условия относятся к современной клавиатурной и кодированной транскрипции и не подменяют provenance открытого скана.</p>'''
body = replace_once(body, old_source, new_source, "Rogers source block")
for required in (
    "горячкой или плевритом",
    "yMRjAAAAcAAJ&amp;printsec=frontcover",
    "совет 1, печ. с. ii, PDF с. 17",
    "совет 5, печ. с. xii, PDF с. 27",
    "совет 6, печ. с. xiv, PDF с. 29",
    "транскрипция EEBO-TCP Университета Мичигана",
):
    if required not in body:
        raise SystemExit(f"article missing required scan-first marker: {required}")
if "горячкой или чахоткой" in body:
    raise SystemExit("article still contains the mistranslation of Pleurisie")
BODY.write_text(body, encoding="utf-8")

audit = AUDIT.read_text(encoding="utf-8")
rogers_contract = '''// ── Rogers 1691 scan-first provenance contract ──────────────────────────────
must(tmaBody, 'горячкой или плевритом', 'Rogers Pleurisie is translated as плеврит');
mustNot(tmaBody, 'горячкой или чахоткой', 'retired mistranslation of Pleurisie');
must(tmaBody, 'https://books.google.com/books?id=yMRjAAAAcAAJ&amp;printsec=frontcover', 'Rogers 1691 Google Books scan is primary provenance');
must(tmaBody, 'совет 1, печ. с. ii, PDF с. 17', 'Rogers advice 1 has printed and PDF locator');
must(tmaBody, 'совет 5, печ. с. xii, PDF с. 27', 'Rogers advice 5 has printed and PDF locator');
must(tmaBody, 'совет 6, печ. с. xiv, PDF с. 29', 'Rogers advice 6 has printed and PDF locator');
must(tmaBody, 'транскрипция EEBO-TCP Университета Мичигана', 'Michigan EEBO-TCP is classified as a transcription aid');
must(tmaBody, 'не подменяют provenance открытого скана', 'Michigan transcription does not replace scan provenance');
mustExist('docs/ROGERS-1691-SCAN-PROVENANCE.md', 'durable Rogers scan provenance record');

'''
audit = replace_once(
    audit,
    "// ── Forbidden generic shells ─────────────────────────────────────────────────\n",
    rogers_contract + "// ── Forbidden generic shells ─────────────────────────────────────────────────\n",
    "Rogers scan-first audit contract",
)
AUDIT.write_text(audit, encoding="utf-8")

PROVENANCE.write_text(
    """# Timothy Rogers 1691 - scan-first provenance\n\n"
    "## Governed claim\n\n"
    "The three Russian Rogers passages in `tma-na-serdce` are governed by the page images of the 1691 edition, not by an unqualified reuse of a modern keyboarded transcription.\n\n"
    "## Primary scan\n\n"
    "- Work: Timothy Rogers, *A Discourse Concerning Trouble of Mind and the Disease of Melancholly* (1691).\n"
    "- Google Books volume id: `yMRjAAAAcAAJ`.\n"
    "- Public reader: `https://books.google.com/books?id=yMRjAAAAcAAJ&printsec=frontcover`.\n"
    "- Downloaded PDF: 531 pages, 28,912,697 bytes.\n"
    "- PDF SHA-256: `12913b3260413648f2bd8caaee50ae9225fce8438750c422dddce893c4f7a288`.\n"
    "- GitHub evidence run: `30501653968`; artifact: `8743711853`; artifact digest: `sha256:b4c3122c6a601336fbbfe9233ba2ca6d64d7500d44d25dba4d74af122310a566`.\n\n"
    "The PDF was used only as verification evidence and is not committed to the repository.\n\n"
    "## Visually verified locators\n\n"
    "Page numbers below use 1-based PDF order. Printed pagination is the roman number visible on the page image.\n\n"
    "| Passage | Printed page | PDF page | Visual finding |\n"
    "|---|---:|---:|---|\n"
    "| Preface, advice 1 | ii | 17 | Begins with melancholy seizing the brain and spirits; the same page compares resistance to fever, pleurisy, gout, or stone. |\n"
    "| Preface, advice 5 | xii | 27 | Begins with the instruction not to urge afflicted friends to what they cannot do and compares them to persons whose bones are broken. |\n"
    "| Preface, advice 6 | xiv | 29 | Begins with the instruction not to attribute the effects of mere disease to the Devil. |\n\n"
    "OCR/text extraction was used to locate candidate pages. The authoritative verification was visual inspection of page renders at 220 DPI.\n\n"
    "## Translation correction\n\n"
    "The first Russian block previously rendered early-modern `Pleurisie` as `чахотка`. The page image reads `a Fever, or a Pleurisie, the Gout, or the Stone`; therefore the governed Russian text now uses `плеврит`, not `чахотка`.\n\n"
    "## Michigan EEBO-TCP status\n\n"
    "The University of Michigan EEBO-TCP page remains useful for table-of-contents and searchable transcription checks. Its notice governs the modern keyboarded/encoded transcription. It is therefore cited as a structural/search aid, while direct Russian translations use the 1691 page images as primary provenance.\n\n"
    "## Publication rule\n\n"
    "Any future direct Rogers quotation or translation requires a visible page image, a 1-based PDF locator, and printed pagination/signature when visible. Search snippets or OCR alone are not sufficient.\n""",
    encoding="utf-8",
)
print("Rogers scan-first migration applied")
