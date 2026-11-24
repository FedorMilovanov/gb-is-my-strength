# NEWS visual engineering — document exhibit
W2/W3 candidate, independent NEWS AGENT 2 lane. Base 22a44d43e347d141924dfa93a3ec7bfad822dbae.
No routes/imports, no G3 changes, no new dependency, no new evidence registry.
Component consumes canonical journal tokens and native bibliography anchors. Caller owns exact accepted evidence projection, globally unique exhibit ID, source-return fallback and publication/rights gates. This component validates structure; it is not an admission gate.
Only editorial paraphrase is supported; no facsimile, quotations, image or reconstructed document. Distinct document/publication/capture dates, null means not established. Each row needs an admitted claim, an existing source, exact locator bound to that claim, meaning and limitation. Pass references projected from accepted authority, never a new evidence ledger. Claim/source/locator membership is checked, not historical truth or permission.
Run: node --test research/news-visual-engineering/document-exhibit.test.mjs
Browser witness: `node research/news-visual-engineering/browser-test.mjs` (existing repo Node dependencies and three installed Playwright engines; no dependency install). Creates an isolated temporary Astro build, uses actual source-return component, existing fonts and editorial tokens, produces JSON, screenshots and four PDFs in the printed temporary directory.
Before route intake: compile actual Astro; validate links and noJS; actual Chromium/Firefox/WebKit 320–1440 light/dark, keyboard, zoom and A4/Letter print. Confirm art direction with AGENT 1 and independent QA with AGENT 3. No release claim.

W3.2: long fixture has eight rows plus a second exhibit with two rows; both are synthetic. Runner adds 24 scenarios, verifies two exhibits have unique IDs, all ten citation round trips, computed border colors/widths and print border overrides. Inspect long PNGs and PDF page breaks separately before admission; no historical or media content is authorized.

Print text regression: `node research/news-visual-engineering/pdf-test.mjs <browser evidence directory>` with existing Poppler. Validates all ten rows and citation/annotation labels in four actual long PDFs, plus page-edge orphan checks. Visual page review remains a separate gate. Print links remove screen touch-target height and stay with their preceding paragraph.
