# G43 — exact source custody and joint intake
RESEARCH_HOLD. Mode LANE, GRAPHICS MAX. Canonical main/rollback b3f4e00436fe8dd154694ea5a38d909353f9047e, donor parent 40b78638a7781afe940ef74b2c6db50532a18ff7. MAX0 W23 7136292286 and AGENT2 W6 7136262262: preserve actual assets, no competing renderer or repeated prototype, no Product import. All following Git blobs matched exact local git hash-object, not transcribed approximations. Input-spread transfer initially omitted final LF; restoring it matched exact expected blob.
- g41/atlas.html.txt — 6f478c40dfa85c41beb008d40e7c6d38b6c3ba9c
- g41/spread.html.txt — 84c987315109487d5f261fdbc22a615ea30dd442
- g41/editorial.css — b3073faa2f85d51f800d50c887f96a3821e00788
- g41/input-atlas.html.txt — 23928603e24fc6c91a0f538577607ad42ff53cee
- g41/input-spread.html.txt — 24b6188a036b24eb9036351642bbe981928fa78b
- g41/build.py — 6c4199557fb4383484fd0bfe04dc78302fb2765e
- g41/qa.py — 8dee8a83c7a3d163990e0cae556e8888a7de9b73
- g42/combined-navigation.html.txt — 5e62f91b1d1d358a6cf6fd8eac0cb957ff435178
- g42/qa.py — a9244533cc518a18c07b1cb04eae77a76dedd375
- g42/manifest.json — 8b10c2ce2263e15899528ce4c3dfe58c1da64079
- g42/build.py — b794df4447ad69d9c86de77bfc68bf85bd61d5e8
- g42/atlas.html.txt — 014143d250d69bb6b55b30510cb91fd5e1f4b189
- g42/spread.html.txt — ee3d16fa23ac9cc37b266237951cd94aecdb3bf2

## Reproduction
From this directory: python g41/build.py; copy g41/atlas.html.txt to g42/input-atlas.html.txt and g41/spread.html.txt to g42/input-spread.html.txt; python g42/build.py. Actual clean sandbox replay: all six generated files byte-identical (G41 two HTML; G42 two HTML, combined HTML, manifest). Environment Python 3.13.5, BeautifulSoup 4.14.3, Playwright 1.57.0, PyMuPDF 1.26.7. Run python g41/qa.py and python g42/qa.py in disposable workdir with /usr/bin/chromium; scripts generate reports and captures. G41 historical script reports failures but does not explicitly exit nonzero on failure; inspect qa.json; not a CI gate. G42 fixture contains translated runtime ONLY for testing, not for import. Historical QA reports and actual PDF/screens remain in earlier owner archives (G41 a37cfec91d127acd33146efe168b35140a8f520629212a1746f8141e92e2c1e2, G42 e8bb596ab19fc2a29d3d099703fef63c4c4076c32c3409a9a673c5df3025838f), not duplicated here. No new browser/print pass claimed; exact deterministic build verified.

## Joint intake disposition
Accept AGENT2 W6 division of responsibility: GRAPHICS provides one compact corrected 2018 companion (six dated records, separate May 2025 retrospective, seven source occurrences, same testimony family boundary), ART owns visual language/selection, AGENT2 owns reusable evidence/citation/date interface, MAX0 assigns one production path. Proposed only #g3-year-2018, not second full chronology, preserve existing approved text/claim G3-HIST-PUB-13 and all citations. Atlas is separate optional replacement/support at #g3-meaning; defer it until ART/engineering decision to avoid scope creep. Do not import standalone CSS/runtime, do not merge donor. No new claims/rights, no new branch, no owner workstation/RDC/CUDA. Remaining: cross-lane acceptance, exact authorized path and native build/visual/axe/zoom/hosted engines/physical PDF gates.

## W74 archive storage correction
The seven retained HTML snapshots now use `.html.txt`, preserving their exact Git blobs and excluding them from public route discovery. The historical build/QA script hashes above identify the original versions; current scripts differ only in archive filename suffixes. Both builders and QA scripts read/write `.html.txt`; run in a disposable directory. No publication or route registration implied. Trailing whitespace cleanup is editorial-only.
