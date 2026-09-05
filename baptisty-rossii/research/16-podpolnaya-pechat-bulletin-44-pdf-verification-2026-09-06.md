# 16. Подпольная печать — Bulletin №44 (1977) PDF verification

**Дата:** 2026-09-06  
**Lane:** `book/podpolnaya-pechat-golden-chapter` / PR #1794  
**Status:** `PDF/TEXT VERIFIED`; `FACSIMILE VISUAL PENDING`; `LOCAL HASH PENDING`.

## Source

Public corpus URL:

`https://propovednik.com/media/mp3/Литература/Бюллетени совета родственников и узников 1970-1987/1971-1977 Синька/044-1977.pdf`

The live source resolves as an 87-page PDF. This closes the earlier ambiguity between a merely catalogued URL and an actually reachable issue.

## Page-level text anchors

### PDF page 1 / source page P0

The title page identifies:

- issue **44**;
- **Москва, 1977 г.**;
- `БЮЛЛЕТЕНЬ СОВЕТА РОДСТВЕННИКОВ УЗНИКОВ ЕВАНГЕЛЬСКИХ ХРИСТИАН-БАПТИСТОВ В СССР`.

This is sufficient to identify the object as Bulletin no. 44, 1977. It is not yet a visually verified facsimile because the current screenshot renderer returned a cache-miss error.

### PDF page 7 / source page P6

The issue asks readers to continue prayer and petitions for arrested workers of the underground publisher `Христианин` and names:

- И. И. Левен;
- Д. И. Кооп;
- Людмила Зайцева;
- Лариса Зайцева.

The text states that they were still under investigation in a Leningrad prison. This directly supports the current source-to-claim ledger's 1977 printing/publisher layer.

Adjacent pages also contain contemporaneous notices about G. P. Vins in the Tabaga camp, Ya. P. Volf, military-service cases and petitions to Soviet authorities. These may be used as issue context but should not be expanded into quantitative repression claims without a separate corpus-wide inventory.

## Production classification

What may now be treated as verified:

- Bulletin no. 44 is a real, reachable 1977 PDF object;
- the issue itself identifies the series and issue number;
- the named `Христианин` workers appear in the issue-level text;
- the 1977 source can serve as a primary-document anchor for the underground-printing chapter.

What remains open:

1. retrieve/copy the exact PDF bytes into the controlled archive lane;
2. compute SHA256 on the received binary;
3. run visual page verification on the title page and the relevant `Христианин` page;
4. create a publication derivative only from the verified local binary;
5. record rights/provenance/caption before web use.

## Important guard

Do **not** mark this issue `FACSIMILE VERIFIED` yet. The web PDF text layer is available, but the screenshot renderer failed with a cache miss. The correct state is `PDF/TEXT VERIFIED` until a visual page read succeeds from the received bytes or another deterministic renderer.
