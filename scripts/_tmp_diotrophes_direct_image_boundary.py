from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
draft = ROOT / "src/components/article-pilots/diotrophes/DiotrophesDraft.astro"
head = ROOT / "src/components/article-pilots/diotrophes/DiotrophesPageHead.astro"
page = ROOT / "src/pages/articles/diotrefy-nashego-vremeni/index.astro"
route_css = ROOT / "public/css/diotrophes-wave12.css"
workflow = ROOT / ".github/workflows/_tmp-diotrophes-direct-image-boundary.yml"
self_path = Path(__file__).resolve()


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")


replace_exact(
    draft,
    '    <figure class="article-img wide">\n      <picture>\n',
    '    <figure class="article-img wide">\n      <picture style="display:block;width:100%;max-width:100%;">\n',
    "lead picture boundary",
)
replace_exact(
    draft,
    '        <img src="/images/pastor-series/mirror.webp" width="1536" height="1024" loading="eager" fetchpriority="high" decoding="async" alt="Одинокая кафедра как образ пастырской власти, оставшейся без подотчётности">',
    '        <img src="/images/pastor-series/mirror.webp" width="1536" height="1024" loading="eager" fetchpriority="high" decoding="async" style="display:block;width:100%;max-width:100%;height:auto;" alt="Одинокая кафедра как образ пастырской власти, оставшейся без подотчётности">',
    "lead image boundary",
)

inline_style = '''<style is:inline>
  .wave12-publication-boundary .article-img.wide > picture,
  .wave12-publication-boundary .article-img.wide > picture > img {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    inline-size: 100%;
    max-inline-size: 100%;
    block-size: auto;
  }
</style>
'''
replace_exact(head, inline_style, "", "retired PageHead style experiment")
replace_exact(
    page,
    '    <link rel="stylesheet" href="/css/diotrophes-wave12.css?v=b07db6e5">\n',
    "",
    "retired route stylesheet link",
)
replace_exact(page, '    data-page="diotrophes"\n', "", "retired route marker")

if not route_css.exists():
    raise SystemExit("retired route stylesheet is missing before cleanup")
route_css.unlink()

workflow.unlink()
self_path.unlink()
