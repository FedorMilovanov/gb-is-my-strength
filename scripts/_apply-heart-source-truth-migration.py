from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts"
AUDIT = ROOT / "scripts/hard-texts-visual-parity-audit.js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one source fragment, found {count}")
    return text.replace(old, new, 1)


config = CONFIG.read_text(encoding="utf-8")
config = replace_once(
    config,
    """import {
  HEART_SERIES_ITEMS,
  HEART_TOTAL_MIN,
  heartRoman,
  heartProgress,
  type HeartPageId,
} from '../heartSeriesData';""",
    "import { HEART_SERIES_ITEMS, type HeartPageId } from '../heartSeriesData';",
    "heart data imports",
)
config = replace_once(
    config,
    "{ id: 'tma', slug: 'tma-na-serdce', minutes: 26,",
    "{ id: 'tma', slug: 'tma-na-serdce', minutes: 34,",
    "tma reading time",
)
config = replace_once(
    config,
    """  tma: [
    { href: '#ditya-sveta-vo-tme', label: 'Дитя света, ходящее во тьме', level: 2, current: true },
    { href: '#psalmopevec-sporit', label: 'Псалмопевец спорит с собственной душой', level: 2 },
    { href: '#ne-odin-diagnoz', label: 'Не один диагноз, а много', level: 2 },
    { href: '#kogda-tma-bolezn', label: 'Когда тьма — это болезнь тела', level: 2 },
    { href: '#iliya-pod-mozhzhevelnikom', label: 'Илия под можжевельником', level: 2 },
    { href: '#oblichenie-i-obvinenie', label: 'Обличение и обвинение — не одно и то же', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#so-svoej-tmoj', label: 'Как быть с собственной тьмой', level: 2 },
    { href: '#vyhod', label: 'Выход: не свет по требованию, а верность в темноте', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],""",
    """  tma: [
    { href: '#pered-bogom', label: 'Сначала — человек перед Богом', level: 2, current: true },
    { href: '#ditya-sveta-vo-tme', label: 'Дитя света, ходящее во тьме', level: 2 },
    { href: '#psalmopevec-sporit', label: 'Псалмопевец спорит с собственной душой', level: 2 },
    { href: '#ne-odin-diagnoz', label: 'Одна тьма — несколько уровней вопроса', level: 2 },
    { href: '#kogda-tma-bolezn', label: 'Болезнь души — но не вне тела', level: 2 },
    { href: '#iliya-pod-mozhzhevelnikom', label: 'Илия под можжевельником', level: 2 },
    { href: '#kogda-vina-realna', label: 'Когда тьма связана с реальной виной: Давид', level: 2 },
    { href: '#oblichenie-i-obvinenie', label: 'Обличение и обвинение — не одно и то же', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#so-svoej-tmoj', label: 'Как быть с собственной тьмой', level: 2 },
    { href: '#vyhod', label: 'Выход: не свет по требованию, а верность в темноте', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],""",
    "tma shared TOC",
)
config = replace_once(
    config,
    """const satById = new Map(HEART_SATELLITES.map((s) => [s.id, s]));
const coreById = new Map(HEART_SERIES_ITEMS.map((i) => [i.id, i]));
const declOf = (n: number) => (n === 1 ? 'статья' : n < 5 ? 'статьи' : 'статей');

const items: SeriesItem[] = [];
""",
    """const satById = new Map(HEART_SATELLITES.map((s) => [s.id, s]));
const coreById = new Map(HEART_SERIES_ITEMS.map((i) => [i.id, i]));
const declOf = (n: number) => (n === 1 ? 'статья' : n < 5 ? 'статьи' : 'статей');

interface HeartBookPageDef {
  id: string;
  minutes: number;
}

function requireCorePage(pageId: HeartPageId) {
  const page = coreById.get(pageId);
  if (!page) throw new Error(`Missing heart core page: ${pageId}`);
  return page;
}

function requireSatellitePage(pageId: string) {
  const page = satById.get(pageId);
  if (!page) throw new Error(`Missing heart satellite page: ${pageId}`);
  return page;
}

/**
 * Единственная последовательность фактических страниц книги. Заголовки глав
 * сюда намеренно не входят: они группируют статьи, но не добавляют минуты.
 */
const HEART_BOOK_SEQUENCE: readonly HeartBookPageDef[] = [
  requireCorePage('prolog'),
  ...HEART_CHAPTERS.flatMap((chapter) => [
    requireCorePage(chapter.lead),
    ...chapter.extras.map(requireSatellitePage),
  ]),
  requireCorePage('spravochnik'),
].map(({ id, minutes }) => ({ id, minutes }));

const HEART_BOOK_TOTAL_MIN = HEART_BOOK_SEQUENCE.reduce((sum, page) => sum + page.minutes, 0);

const heartBookProgressById = new Map<string, { doneMin: number; partMin: number; totalMin: number }>();
let heartBookDoneMin = 0;
for (const page of HEART_BOOK_SEQUENCE) {
  if (heartBookProgressById.has(page.id)) throw new Error(`Duplicate heart book page: ${page.id}`);
  heartBookProgressById.set(page.id, {
    doneMin: heartBookDoneMin,
    partMin: page.minutes,
    totalMin: HEART_BOOK_TOTAL_MIN,
  });
  heartBookDoneMin += page.minutes;
}

function heartBookProgress(pageId: string) {
  const progress = heartBookProgressById.get(pageId);
  if (!progress) throw new Error(`Page is absent from heart book sequence: ${pageId}`);
  return progress;
}

const items: SeriesItem[] = [];
""",
    "canonical book sequence",
)
config = replace_once(config, "const prog = heartProgress(item.id);", "const prog = heartBookProgress(item.id);", "label progress")
config = replace_once(config, "const leadProg = heartProgress(lead.id);", "const leadProg = heartBookProgress(lead.id);", "lead progress")
config = replace_once(config, "const prog = heartProgress(ch.lead);", "const prog = heartBookProgress(sat.id);", "satellite progress")
config = replace_once(config, "readingProgressTotalMin: HEART_TOTAL_MIN,", "readingProgressTotalMin: prog.totalMin,", "satellite total")

for forbidden in ("HEART_TOTAL_MIN", "heartProgress(ch.lead)", "minutes: 26,\n    railTitle: 'Тьма на сердце'"):
    if forbidden in config:
        raise SystemExit(f"config still contains forbidden source: {forbidden}")
CONFIG.write_text(config, encoding="utf-8")

audit = AUDIT.read_text(encoding="utf-8")
audit = replace_once(
    audit,
    "const profile    = read('data/route-profiles/hard-texts.json');\n",
    """const profile    = read('data/route-profiles/hard-texts.json');
const heartConfig = read('src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts');
const heartData   = read('src/components/article-pilots/_shared/heartSeriesData.ts');
const tmaBody     = read('src/components/article-pilots/tma-na-serdce/TmaNaSerdceBody.astro');
const tmaHead     = read('src/components/article-pilots/tma-na-serdce/TmaNaSerdcePageHead.astro');
const tmaRoute    = read('src/pages/articles/tma-na-serdce/index.astro');
""",
    "audit source inputs",
)
contract = r"""
// ── Heart book source-of-truth contract ─────────────────────────────────────
const expectedTmaToc = [
  ['#pered-bogom', 'Сначала — человек перед Богом'],
  ['#ditya-sveta-vo-tme', 'Дитя света, ходящее во тьме'],
  ['#psalmopevec-sporit', 'Псалмопевец спорит с собственной душой'],
  ['#ne-odin-diagnoz', 'Одна тьма — несколько уровней вопроса'],
  ['#kogda-tma-bolezn', 'Болезнь души — но не вне тела'],
  ['#iliya-pod-mozhzhevelnikom', 'Илия под можжевельником'],
  ['#kogda-vina-realna', 'Когда тьма связана с реальной виной: Давид'],
  ['#oblichenie-i-obvinenie', 'Обличение и обвинение — не одно и то же'],
  ['#tverdo-ne-dubinkoy', 'Твёрдо, но не дубинкой'],
  ['#so-svoej-tmoj', 'Как быть с собственной тьмой'],
  ['#vyhod', 'Выход: не свет по требованию, а верность в темноте'],
  ['#istochniki', 'Источники и сверка'],
];

const tmaTocBlock = heartConfig.match(/  tma: \[([\s\S]*?)  \],\s+skorb:/)?.[1] ?? '';
const actualTmaToc = [...tmaTocBlock.matchAll(/href: '([^']+)', label: '([^']+)'/g)]
  .map((match) => [match[1], match[2]]);
if (JSON.stringify(actualTmaToc) === JSON.stringify(expectedTmaToc)) ok('tma shared TOC matches the exact 12-section article order');
else bad(`tma shared TOC drift: ${JSON.stringify(actualTmaToc)}`);
const currentRows = [...tmaTocBlock.matchAll(/current: true/g)].length;
if (currentRows === 1 && /href: '#pered-bogom'[\s\S]*?current: true/.test(tmaTocBlock)) ok('tma TOC has exactly one current row on #pered-bogom');
else bad('tma TOC current-row contract failed');

const bodyH2 = [...tmaBody.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)]
  .map((match) => [`#${match[1]}`, match[2]])
  .filter(([href]) => href !== '#summary-title-auto');
if (tmaBody.includes('<section class="sources-block" id="istochniki">')) bodyH2.push(['#istochniki', 'Источники и сверка']);
if (JSON.stringify(bodyH2) === JSON.stringify(expectedTmaToc)) ok('tma body H2 anchors and labels match the shared TOC');
else bad(`tma body/shared TOC mismatch: ${JSON.stringify(bodyH2)}`);

must(heartConfig, "{ id: 'tma', slug: 'tma-na-serdce', minutes: 34,", 'tma canonical series time is 34 minutes');
must(tmaBody, '<span data-pagefind-meta="readTime" hidden>34</span>', 'tma Pagefind time is 34 minutes');
must(tmaBody, '<span>⏱ 34 мин</span>', 'tma visible article time is 34 minutes');
must(tmaHead, 'readingTime: 34', 'tma SITE_CONFIG time is 34 minutes');
must(tmaRoute, "HARD_TEXTS_SERIES.pages['tma']", 'tma route reads progress from canonical series page data');
mustNot(heartConfig, 'heartProgress(ch.lead)', 'no chapter-lead progress reused for extra articles');
mustNot(heartConfig, 'readingProgressTotalMin: HEART_TOTAL_MIN', 'no core-only total for extra articles');
must(heartConfig, 'heartBookProgress(sat.id)', 'extra articles use their own cumulative progress');

function parseMinuteMap(source, entryPattern) {
  const out = new Map();
  for (const match of source.matchAll(entryPattern)) out.set(match[1], Number(match[2]));
  return out;
}
const coreMinutes = parseMinuteMap(heartData, /\{\s+id: '([^']+)',[\s\S]*?\n\s+minutes: (\d+),[\s\S]*?\n\s+\},/g);
const satelliteMinutes = parseMinuteMap(heartConfig, /\{ id: '([^']+)', slug: '[^']+', minutes: (\d+),/g);
const chapterBlock = heartConfig.match(/const HEART_CHAPTERS:[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1] ?? '';
const chapters = [...chapterBlock.matchAll(/lead: '([^']+)',\s+extras: \[([^\]]*)\]/g)].map((match) => ({
  lead: match[1],
  extras: [...match[2].matchAll(/'([^']+)'/g)].map((entry) => entry[1]),
}));
const bookSequence = [{ id: 'prolog', minutes: coreMinutes.get('prolog') }];
for (const chapter of chapters) {
  bookSequence.push({ id: chapter.lead, minutes: coreMinutes.get(chapter.lead) });
  for (const id of chapter.extras) bookSequence.push({ id, minutes: satelliteMinutes.get(id) });
}
bookSequence.push({ id: 'spravochnik', minutes: coreMinutes.get('spravochnik') });
const missingMinutes = bookSequence.filter((pageDef) => !Number.isInteger(pageDef.minutes));
if (missingMinutes.length === 0) ok('all 24 heart-book pages have canonical integer minutes');
else bad(`missing book-page minutes: ${missingMinutes.map((pageDef) => pageDef.id).join(', ')}`);
const uniqueIds = new Set(bookSequence.map((pageDef) => pageDef.id));
if (bookSequence.length === 24 && uniqueIds.size === 24) ok('book sequence contains 24 unique pages and no chapter headings');
else bad(`book sequence shape drift: ${bookSequence.length} entries / ${uniqueIds.size} unique`);
let doneMin = 0;
let monotonic = true;
for (const pageDef of bookSequence) {
  if (pageDef.minutes <= 0) monotonic = false;
  const nextDone = doneMin + pageDef.minutes;
  if (nextDone <= doneMin) monotonic = false;
  doneMin = nextDone;
}
if (monotonic) ok('book progress is strictly cumulative across every article');
else bad('book progress is not strictly cumulative');
if (doneMin === 727) ok('full heart-book reading total is exactly 727 minutes');
else bad(`heart-book total drift: ${doneMin} minutes (expected 727)`);
const lastPage = bookSequence.at(-1);
if (lastPage?.id === 'spravochnik' && doneMin - lastPage.minutes === 704 && doneMin === 727) ok('last page completes progress exactly at 727 minutes');
else bad(`last-page progress contract failed: ${JSON.stringify(lastPage)} / ${doneMin}`);

"""
audit = replace_once(
    audit,
    "// ── Forbidden generic shells ─────────────────────────────────────────────────\n",
    contract + "// ── Forbidden generic shells ─────────────────────────────────────────────────\n",
    "heart source-truth contract",
)
AUDIT.write_text(audit, encoding="utf-8")
print("heart source-truth migration applied")
