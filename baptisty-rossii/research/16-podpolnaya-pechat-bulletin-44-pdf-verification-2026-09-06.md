# 16. Подпольная печать — Bulletin №44 (1977) PDF verification

**Дата:** 2026-09-06  
**Lane:** `book/podpolnaya-pechat-golden-chapter` / PR #1794  
**Status:** `PDF/TEXT VERIFIED`; `LOCAL BINARY PRESENT`; `SHA256 VERIFIED`; `FACSIMILE VISUAL PENDING`.

## Source

Public corpus URL:

`https://propovednik.com/media/mp3/Литература/Бюллетени совета родственников и узников 1970-1987/1971-1977 Синька/044-1977.pdf`

The live source resolves as an 87-page PDF. This closes the earlier ambiguity between a merely catalogued URL and an actually reachable issue.

A controlled local binary already exists in the Product repository on `main`:

- path: `baptisty-rossii/research/raw-sources/bulletin-council-relatives-044-1977.pdf`;
- size: **1,171,788 bytes**;
- Git blob SHA: `66f54198e369f836387a18b40c203468c662a4eb`;
- SHA256: `79e9fab61164ffd2c881ac641402e8b8bd9806bad8cf9b1360aa8b35568ce55c`.

Important: the Git blob SHA is repository object identity, **not SHA256 of the PDF bytes**. Both are now recorded independently. On 2026-09-12 the exact file in the primary local clone (`C:\\Users\\Fedor\\Documents\\GitHub\\gb-is-my-strength`) was checked with `Get-FileHash -Algorithm SHA256` and `git hash-object`; its byte length was 1,171,788, its Git blob SHA matched the GitHub repository object exactly, and its SHA256 was fixed as shown above.

## Page-level text anchors

### PDF page 1 / source page P0

The title page identifies:

- issue **44**;
- **Москва, 1977 г.**;
- `БЮЛЛЕТЕНЬ СОВЕТА РОДСТВЕННИКОВ УЗНИКОВ ЕВАНГЕЛЬСКИХ ХРИСТИАН-БАПТИСТОВ В СССР`.

This is sufficient to identify the object as Bulletin no. 44, 1977. It is not yet a visually verified facsimile because the current web screenshot renderer returned a cache-miss error.

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
- the exact PDF binary is already stored in the repository's controlled `raw-sources` corpus;
- repository object identity and byte size are known;
- the issue itself identifies the series and issue number;
- the named `Христианин` workers appear in the issue-level text;
- the 1977 source can serve as a primary-document anchor for the underground-printing chapter.

What remains open:

1. run visual page verification on the title page and the relevant `Христианин` page;
2. create a publication derivative only from that verified local binary;
3. record rights/provenance/caption before web use.

## Important guard

Do **not** mark this issue `FACSIMILE VERIFIED` yet. The web PDF text layer is available and the local binary is present, but the screenshot renderer failed with a cache miss. The correct state is `PDF/TEXT VERIFIED + LOCAL BINARY PRESENT + SHA256 VERIFIED`, while `FACSIMILE VISUAL PENDING` remains in force until a visual page read succeeds from the exact repository binary or another deterministic renderer.
