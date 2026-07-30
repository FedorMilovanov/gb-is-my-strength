from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BODY = ROOT / "src/components/article-pilots/tma-na-serdce/TmaNaSerdceBody.astro"
HEAD = ROOT / "src/components/article-pilots/tma-na-serdce/TmaNaSerdcePageHead.astro"
AUDIT = ROOT / "scripts/hard-texts-visual-parity-audit.js"


def replace_exact(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} source occurrence(s), found {count}")
    return text.replace(old, new)


body = BODY.read_text(encoding="utf-8")
body = replace_exact(
    body,
    "<span>Обн. 29 июля 2026</span>",
    "<span>Обн. 30 июля 2026</span>",
    1,
    "visible tma modified date",
)
BODY.write_text(body, encoding="utf-8")

head = HEAD.read_text(encoding="utf-8")
head = replace_exact(
    head,
    "2026-07-29T00:00:00+03:00",
    "2026-07-30T00:00:00+03:00",
    2,
    "machine modified timestamps",
)
head = replace_exact(
    head,
    "modified: '2026-07-29'",
    "modified: '2026-07-30'",
    1,
    "SITE_CONFIG modified date",
)
HEAD.write_text(head, encoding="utf-8")

audit = AUDIT.read_text(encoding="utf-8")
dateline_contract = '''// ── tma editorial dateline parity contract ──────────────────────────────────
must(tmaBody, '<span>Обн. 30 июля 2026</span>', 'tma visible modified date is 30 July 2026');
mustNot(tmaBody, '<span>Обн. 29 июля 2026</span>', 'retired visible modified date');
const tmaModifiedTimestamp = '2026-07-30T00:00:00+03:00';
const tmaModifiedTimestampCount = tmaHead.split(tmaModifiedTimestamp).length - 1;
if (tmaModifiedTimestampCount === 2) ok('tma Open Graph and JSON-LD modified timestamps agree on 30 July 2026');
else bad(`tma machine modified timestamp count drift: ${tmaModifiedTimestampCount} (expected 2)`);
must(tmaHead, "modified: '2026-07-30'", 'tma SITE_CONFIG modified date is 30 July 2026');
mustNot(tmaHead, '2026-07-29T00:00:00+03:00', 'retired machine modified timestamp');
mustNot(tmaHead, "modified: '2026-07-29'", 'retired SITE_CONFIG modified date');

'''
marker = "// ── Rogers 1691 scan-first provenance contract ──────────────────────────────\n"
if marker not in audit:
    raise SystemExit("dateline audit insertion marker missing")
if "tma editorial dateline parity contract" in audit:
    raise SystemExit("dateline audit contract already present")
audit = audit.replace(marker, dateline_contract + marker, 1)
AUDIT.write_text(audit, encoding="utf-8")

if "Обн. 29 июля 2026" in BODY.read_text(encoding="utf-8"):
    raise SystemExit("retired visible dateline remains in article body")
head_after = HEAD.read_text(encoding="utf-8")
for retired in ("2026-07-29T00:00:00+03:00", "modified: '2026-07-29'"):
    if retired in head_after:
        raise SystemExit(f"retired machine dateline remains in page head: {retired}")

print("tma dateline parity migration applied")
