# Teen series — glossary and Scripture-reference plan

Status: **PUBLISHED / SHARED GLOSSARY OWNER RETAINED / POST-RELEASE REGRESSION PLAN**

This plan now documents the published seven-part teen/adult-child series and its regression boundary. It prevents two opposite failures: a prose surface overloaded with glossary decorations, and a Scripture-first series whose biblical citations remain inert plain text.

## 1. Existing glossary owner controls terminology

The current runtime already auto-hydrates canonical glossary aliases inside prose. It is not necessary to hand-wrap ordinary matching terms with `.gterm`.

Current policy:

- prose hydration zones: `p`, `div.reveal`, and explicit prose zones;
- headings, navigation, figures, tables, cards, tooltips, quiz surfaces and other chrome are excluded;
- default cadence: at least 1200 words and 20 prose blocks between repeated placements;
- maximum: 3 auto-hydrated glossary terms per article.

Therefore teen pages MUST reuse `data/glossary.json` + `data/glossary-policy.json` and MUST NOT create a second teen glossary runtime or dictionary.

## 2. Canonical entries already available

The shared glossary already contains suitable canonical entries for several high-value teen-series concepts:

| Concept in teen prose | Canonical glossary entry | Foundation decision |
|---|---|---|
| возрождение | `возрождение` | AUTO-HYDRATE; do not add manual duplicate |
| освящение | `освящение` | AUTO-HYDRATE; do not add manual duplicate |
| тотальная / полная испорченность | `тотальная испорченность` | SHARED ENTRY, `autoHydrate:false`; explain inline unless a deliberate manual placement is separately justified |
| остаточный грех | `остаточный грех` | AUTO-HYDRATE where relevant |
| остаточная порча | `остаточная порча` | SHARED ENTRY, `autoHydrate:false`; explain inline unless a deliberate manual placement is separately justified |

The series should not be rewritten merely to trigger a glossary alias. Good prose controls terminology; glossary hydration is secondary.

## 3. Important concepts without a confirmed standalone canonical entry

The current shared glossary pass did not establish standalone canonical entries for:

- совесть;
- покаяние;
- средства благодати;
- апостасия / отступничество.

Published-series default: **EXPLAIN INLINE, DO NOT CREATE A SHARED ENTRY CASUALLY.**

Reason: all four terms are central enough that a one-sentence tooltip can become doctrinally reductive if added casually. The article itself should carry the distinction it needs (for example, remorse/fear/exposure is not automatically repentance). A later glossary-expansion PR may add a shared term only if it improves the whole site and passes the normal Glossary Contract.

## 4. Bible references are a different runtime

The current shared Bible tooltip owner does not auto-detect plain textual references. It looks for:

` .bref[data-ref] `

and then creates/controls `.btip` through the common tooltip controller.

If the page exposes a JSON map in `#bibleRefs`, the matching reference can show supplied verse text. Without a matching map entry, the runtime falls back to a generic reference label.

Therefore a plain `(Еф. 6:1–4)` is readable but is **not** an interactive Bible reference by itself.

## 5. Teen release markup policy

For the public teen series:

1. Reader-facing Scripture citations in normal prose should be marked with the current `.bref[data-ref]` contract.
2. Do not invent a regex-based teen Bible parser.
3. Do not revive a legacy tooltip owner alongside the current one.
4. Do not wrap references inside headings, source bibliography, URLs, code, captions or other forbidden/non-prose surfaces merely to increase tooltip count.
5. Preserve visible Russian citation text exactly as editorially chosen; `data-ref` is machine identity, not permission to silently renumber Psalms or alter the displayed citation.
6. Psalm numbering must preserve the established Russian/Synodal guard where source traditions differ.
7. High-value controlling texts should receive real verse payloads through the existing Bible-reference data owner when feasible; generic fallback is acceptable only as a temporary prepublication witness, not the desired final Scripture-first UX.

## 6. Priority Scripture-reference families

The release pass should begin with references that carry the article's argument, not incidental cross-references.

### Part I — double life

Priority families include:

- 2 Tim. 3:4–5;
- Prov. 9:17–18 / the stolen-waters motif where cited;
- Heb. 11:25 where temporary pleasure of sin is discussed;
- key conscience/hardening texts actually used in the final prose;
- texts grounding positive sexual ethics and marital goodness.

### Part II — parents after disclosure

Prioritize texts controlling:

- parental duty and child responsibility;
- discipline without provocation;
- confession/repentance distinctions;
- truth, witness and restoration;
- radical cutting-off of occasions of sin where applied.

### Part III — church

Priority families include:

- Eph. 6:1–4;
- 1 Cor. 14:23–25;
- Ps. 49:16–21 in Russian Synodal numbering;
- texts actually controlling admonition, holiness, restoration and protection.

### Companion A

Prioritize the texts that control Luke 15 interpretation, warning/contact, repentance, reception and restoration. Luke 15 must remain a parable/narrative witness, not a no-contact algorithm.

### Companion B

Prioritize household order, work/responsibility, provision/help and consequence texts actually used in the article. Do not manufacture a Bible verse for every house rule.

### Companion C

Prioritize fifth-commandment, honour/obedience/status and mature-responsibility texts. Keep civil adulthood and biblical moral categories distinct.

### Companion D

Prioritize fifth-commandment, marriage/consent and the disputed-text guard around 1 Cor. 7:36–38. Num. 30 must not be surfaced in a way that implies an unqualified universal paternal-veto rule.

## 7. Tooltip accessibility / mobile acceptance criteria

Bible and glossary tooltips must be verified together because they share interaction infrastructure.

Required witness:

- keyboard focus opens the intended tooltip and Escape/blur behavior is sane;
- touch opens one mobile sheet/tooltip owner, not two competing overlays;
- focus returns correctly after close where the owner treats the tooltip as a mobile sheet;
- 320/360/390 px widths do not clip long Russian reference labels;
- a tooltip near the top/bottom edge remains visible and scrollable;
- opening a tooltip does not leave a stale scroll lock after Back/navigation;
- glossary auto-hydration never nests inside `.bref` because links/abbr/`.gterm` and other forbidden surfaces are excluded by policy;
- TTS/linear-text projection reads the visible sentence/reference, not hidden tooltip detail twice.

## 8. Post-release regression gate

The published teen series must not be treated as Scripture-UX regression-safe merely because Scripture Occurrence Index Contract is green. That contract and reader-facing `.bref` interactivity are different concerns.

Regression coverage requires a dedicated reference witness proving, for each of the seven routes:

- important visible citations remain correct;
- intended `.bref[data-ref]` anchors exist;
- no broken/empty `data-ref` values;
- no Psalm-numbering regressions;
- no duplicate tooltip runtime;
- desktop, keyboard and mobile interactions work.

This plan deliberately keeps the shared glossary and shared tooltip engines as the single owners; Teen-specific quality work must test them rather than fork them.
