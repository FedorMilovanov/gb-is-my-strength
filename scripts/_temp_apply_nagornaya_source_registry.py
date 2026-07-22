#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src/components/nagornaya/istochniki/NagornayaIstochnikiMainShell.astro"
text = TARGET.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    """ * approved legacy main so Playwright/pixelmatch can verify exact parity.\n */\n---""",
    """ * approved legacy main so Playwright/pixelmatch can verify exact parity.\n */\nimport sourceRegistry from '../../../../data/nagornaya/source-registry.json';\n\ntype SourceRecord = (typeof sourceRegistry.sources)[number];\n\nfunction requireSource(id: string): SourceRecord {\n  const source = sourceRegistry.sources.find((candidate) => candidate.id === id);\n  if (!source) throw new Error(`Missing Nagornaya source registry entry: ${id}`);\n  return source;\n}\n\nconst greenSource = requireSource('tmsj-green-ipsissima-vox');\nconst thomasSource = requireSource('tmsj-thomas-jesus-seminar');\nconst nicholsSource = requireSource('tmsj-nichols-davidic-kingdom');\nconst tmsjCitation = (source: SourceRecord) => `TMSJ ${source.volumeIssueYear}, pp. ${source.pages}`;\n---""",
    "frontmatter registry import",
)

replace_once(
    """<div class="text-xs text-stone-600 mb-0.5"><span class="text-stone-500">Donald E. Green</span><span class="mx-1 text-stone-300"> — </span><strong class="text-stone-800"><a href="https://tms.edu/wp-content/uploads/2021/09/tmsj12d.pdf" target="_blank" rel="noopener">Evangelicals and Ipsissima Vox</a></strong><span class="text-stone-400 text-xs ml-2">TMSJ 12/1 (Spring 2001), pp. 49–68</span></div>\n                <div class="text-xs text-stone-400 italic">Faculty Associate in NT (не full professor). Критика широкого ipsissima vox. Ин 14:26 обеспечивает сверхъестественную точность.</div>""",
    """<div class="text-xs text-stone-600 mb-0.5"><span class="text-stone-500">{greenSource.author}</span><span class="mx-1 text-stone-300"> — </span><strong class="text-stone-800"><a href={greenSource.resolvedUrl} target="_blank" rel="noopener">{greenSource.title}</a></strong><span class="text-stone-400 text-xs ml-2">{tmsjCitation(greenSource)}</span></div>\n                <div class="text-xs text-stone-400 italic">{greenSource.annotation}</div>""",
    "Green registry row",
)

replace_once(
    """<div class="text-xs text-stone-600 mb-0.5"><span class="text-stone-500">Robert L. Thomas</span><span class="mx-1 text-stone-300"> — </span><strong class="text-stone-800"><a href="https://tms.edu/wp-content/uploads/2021/09/tmsj7d.pdf" target="_blank" rel="noopener">Evangelical Responses to the Jesus Seminar</a></strong><span class="text-stone-400 text-xs ml-2">TMSJ 7/1 (Spring 1996), pp. 75–105</span></div>\n                <div class="text-xs text-stone-400 italic">Критика историко-критических реконструкций.</div>""",
    """<div class="text-xs text-stone-600 mb-0.5"><span class="text-stone-500">{thomasSource.author}</span><span class="mx-1 text-stone-300"> — </span><strong class="text-stone-800"><a href={thomasSource.resolvedUrl} target="_blank" rel="noopener">{thomasSource.title}</a></strong><span class="text-stone-400 text-xs ml-2">{tmsjCitation(thomasSource)}</span></div>\n                <div class="text-xs text-stone-400 italic">{thomasSource.annotation}</div>""",
    "Thomas registry row",
)

replace_once(
    """<div class="text-xs text-stone-600 mb-0.5"><span class="text-stone-500">Stephen J. Nichols</span><span class="mx-1 text-stone-300"> — </span><strong class="text-stone-800"><a href="https://tms.edu/wp-content/uploads/2021/09/tmsj7h.pdf" target="_blank" rel="noopener">The Dispensational View of the Davidic Kingdom</a></strong><span class="text-stone-400 text-xs ml-2">TMSJ 7/2 (Fall 1996), pp. 213–239</span></div>\n                <div class="text-xs text-stone-400 italic">Критика прогрессивного диспенсационализма Bock/Blaising.</div>""",
    """<div class="text-xs text-stone-600 mb-0.5"><span class="text-stone-500">{nicholsSource.author}</span><span class="mx-1 text-stone-300"> — </span><strong class="text-stone-800"><a href={nicholsSource.resolvedUrl} target="_blank" rel="noopener">{nicholsSource.title}</a></strong><span class="text-stone-400 text-xs ml-2">{tmsjCitation(nicholsSource)}</span></div>\n                <div class="text-xs text-stone-400 italic">{nicholsSource.annotation}</div>""",
    "Nichols registry row",
)

TARGET.write_text(text, encoding="utf-8")
print(f"patched {TARGET.relative_to(ROOT)}")
