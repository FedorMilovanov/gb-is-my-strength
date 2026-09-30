# Branch Cleanup Disposition Record — 2026-09-29

**Executed:** owner-approved cleanup batch, 2026-09-29/30 (session `arena/01a0ef9a-gb-is-my-strength`).
**Base:** `main@d0e04a9c7ac78082f44ad70c4b1e3bbf50b5065b` (rollback SHA).
**Authority:** owner approval in Arena session 2026-09-29; `docs/BRANCH_LIFECYCLE_V4.md` §1/§6/§10; read-only inventory via `scripts/branch-hygiene-report.py` + local content-level forensics (ancestry, patch-id, file-equivalence, branch-only files, 195 merged / 140 closed-unmerged PR records).

Deleted **162** remote branches in 6 verified chunks (each ref re-checked: present, exact analyzed SHA, no open PR, not in D/HOLD/C-verify/active). Post-batch inventory: **42 branches remain** (4 active PR heads, 26 D-evidence/recovery, 9 C-verify, 2 HOLD, plus `fix/npm-non-major-security-20260907` counted in C-verify).

## Deleted branches (162)

| # | Ветка | Head SHA (deleted) | Диспозиция |
|---|---|---|---|
| 1 | `agent/atlas-focus-format-helper-20260907` | `a77f69f92fbc` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 2 | `agent/atlas-focus-recovery-helper-20260907` | `b7552d80cde7` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 3 | `agent/deploy-pages-pin-refresh-helper-20260907` | `15d210fca103` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 4 | `agent/deps-security-lock-refresh-20260907` | `aadee4031f4a` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 5 | `arena/01a02907-gb-is-my-strength` | `094023ad218a` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 6 | `arena/01a09bdc-gb-is-my-strength` | `ff08f618885d` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 7 | `arena/01a0a73b-gb-is-my-strength` | `aa8de9391e51` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 8 | `article/teen-double-life-adult-child-return` | `0de543678608` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 9 | `article/teen-double-life-adulthood-parental-authority` | `8c3a70494db0` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 10 | `article/teen-double-life-daughter-father-marriage` | `44f63f2fa029` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 11 | `article/teen-double-life-house-money-consequences` | `7b52d2c4d40f` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 12 | `article/teen-double-life-part-1` | `add68fd49b3a` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 13 | `article/teen-double-life-part-2` | `87eff9a1d888` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 14 | `article/teen-double-life-part-3` | `cec8b49dd778` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 15 | `book/ch06-kargel-source-to-claim` | `bba459001b7c` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 16 | `book/ch07-mazaev-prokhanov-research` | `74dcaa9ee975` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 17 | `book/ch08-print-republic-research` | `58e34295feb3` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 18 | `book/ch09-fetler-house-gospel-research` | `01229056776c` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 19 | `book/ch10-1917-1921-research` | `7e0b5159200e` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 20 | `book/ch11-famine-international-brotherhood-research` | `216b5165e4c8` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 21 | `book/ch12-school-bible-failed-unity-research` | `4c6c7ac8364c` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 22 | `book/ch13-conscience-army-state-research` | `143c1685fe4c` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 23 | `book/ch14-1929-law-church-life-research` | `2b35deeb0667` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 24 | `book/ch15-1930s-unions-great-terror-research` | `223be7bc08e8` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 25 | `book/ch16-war-1944-union-research` | `808697d7307c` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 26 | `book/ch17-vsehb-1945-1959-research` | `d59f1ec3d971` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 27 | `book/ch20-international-1991-memory-research` | `1ebf77285092` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 28 | `book/iniciativnaya-gruppa-golden-chapter` | `fe5a5d253b38` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 29 | `book/podpolnaya-pechat-golden-chapter` | `af4bb4f2a521` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 30 | `book/vsehib-1944-golden-chapter` | `d3f209c90d6e` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 31 | `chore/genealogy-editorial-proof-closure` | `c0cecef9653a` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 32 | `ci/exclude-baptisty-research-render-checks-20260911` | `553f7917a5bf` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 33 | `codex/baptisty-book-authority-v2-check` | `5a390c1c7969` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 34 | `codex/baptisty-book-authority-v2-check2` | `f4ced65432b0` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 35 | `codex/baptisty-book-authority-v2-check3` | `f4ced65432b0` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 36 | `content/baptisty-iniciativnaya-gruppa-golden-body-20260912-g1` | `f0ba6cddca18` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 37 | `content/baptisty-iniciativnaya-gruppa-golden-body-20260912-g2` | `9416a85b7d56` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 38 | `feat/baptist-authentic-media-composition-20260912` | `320866f994f4` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 39 | `feat/baptisty-visual-atlas-rb02-20260912-stage` | `dc84b6660a44` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 40 | `feat/baptisty-visual-atlas-rb06-20260912-stage` | `5ecf3bb2bc62` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 41 | `feat/baptisty-visual-atlas-rb08-20260912-stage` | `e9ad5b088e22` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 42 | `feat/genealogy-publishable-runtime` | `b93496f7b2cc` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 43 | `feat/genealogy-relationship-inspector` | `03595206ba22` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 44 | `feat/genealogy-v2-textual-assertions` | `5901684262ee` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 45 | `feature/journal-g3-foundation-20260909` | `5475f247fa8e` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 46 | `fix/baptisty-retire-transport-meta-batch2-20260911` | `f8478471001c` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 47 | `fix/biografii-recent-heading-20260818` | `c942debca1dc` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 48 | `fix/ci-notifier-policy-reconciliation-20260819` | `d99bd866de09` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 49 | `fix/cloudflare-nosniff-transport-owner-20260909` | `3a9a406d1b49` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 50 | `fix/deploy-pages-pin-authority-20260907` | `ceb6001702c0` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 51 | `fix/deploy-pages-pin-authority-r2-20260907` | `fbdec3dd23ed` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 52 | `fix/genealogy-contract-publishable-fixture` | `88dbc99e98a2` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 53 | `fix/genealogy-contract-publishable-main-v2` | `a9ab00a9ff57` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 54 | `fix/genealogy-contract-publishable-main-v3` | `501c60e4f2c8` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 55 | `fix/genealogy-department-shell` | `3df21cfa0469` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 56 | `fix/genealogy-department-shell-main-v2` | `0a444b7a06df` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 57 | `fix/genealogy-department-shell-main-v3` | `2bcbe48649b2` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 58 | `fix/genealogy-department-shell-main-v4` | `04f769f480e4` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 59 | `fix/genealogy-department-shell-main-v5` | `8d2725562ba6` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 60 | `fix/genealogy-edge-annotation-contract` | `f007882ab3f0` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 61 | `fix/genealogy-edge-annotation-main-v2` | `7d377451e81d` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 62 | `fix/genealogy-fallback-theme-contract` | `79907ee38ae1` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 63 | `fix/genealogy-person-dossier-family-nav` | `41997ac0dcf8` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 64 | `fix/genealogy-person-dossier-family-nav-main-v2` | `8933659c5ae4` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 65 | `fix/genealogy-person-dossier-family-nav-main-v3` | `f8cfff0e4141` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 66 | `fix/genealogy-person-dossier-family-nav-main-v4` | `8979697d6adc` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 67 | `fix/genealogy-person-dossier-family-nav-main-v5` | `161691f1724f` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 68 | `fix/genealogy-person-relations-access` | `1533d0c8314b` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 69 | `fix/genealogy-person-relations-access-main-v4` | `7924f486e2dc` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 70 | `fix/genealogy-person-relations-access-main-v5` | `10842758c6fa` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 71 | `fix/genealogy-person-relations-access-main-v6` | `68fa232eb0ba` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 72 | `fix/genealogy-person-relations-access-main-v7` | `f174422bca5a` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 73 | `fix/genealogy-person-relations-access-v2` | `4eafad110059` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 74 | `fix/genealogy-person-relations-access-v3` | `254d594c4963` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 75 | `fix/genealogy-publishable-runtime` | `b93496f7b2cc` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 76 | `fix/genealogy-publishable-runtime-v2` | `8867706dfe50` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 77 | `fix/genealogy-relation-evidence-triage` | `4f939aaeb5f8` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 78 | `fix/genealogy-relation-evidence-triage-main-v3` | `2f8bb0f1abf1` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 79 | `fix/genealogy-relation-evidence-triage-main-v4` | `886e77655475` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 80 | `fix/genealogy-relation-evidence-triage-main-v5` | `307e18806dc5` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 81 | `fix/genealogy-relation-evidence-triage-main-v6` | `f746cf1e0e46` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 82 | `fix/genealogy-relation-evidence-triage-v2` | `c390ec7c7135` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 83 | `fix/genealogy-relationship-inspector` | `03595206ba22` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 84 | `fix/genealogy-relationship-inspector-main-v2` | `a562f5ef93b8` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 85 | `fix/genealogy-relationship-inspector-main-v3` | `05665f35fc19` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 86 | `fix/genealogy-relationship-inspector-v2` | `b00d3f55f127` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 87 | `fix/genealogy-remove-legacy-runtime-import` | `d9f792cc7f17` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 88 | `fix/genealogy-search-disambiguation` | `3767f91f1cec` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 89 | `fix/genealogy-search-disambiguation-main-v2` | `eae348fe5776` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 90 | `fix/genealogy-search-disambiguation-main-v3` | `fd4aed028e92` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 91 | `fix/genealogy-search-disambiguation-main-v4` | `3df52cda5bdb` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 92 | `fix/genealogy-search-disambiguation-v2` | `bfc55083530b` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 93 | `fix/genealogy-site-theme-contract` | `1e0ba3054a04` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 94 | `fix/genealogy-site-theme-contract-main-v4` | `af9bc32135bd` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 95 | `fix/genealogy-site-theme-contract-main-v5` | `d52f72199a3b` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 96 | `fix/genealogy-site-theme-contract-main-v6` | `b83be7abfe13` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 97 | `fix/genealogy-site-theme-contract-main-v7` | `d9c32cda72ee` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 98 | `fix/genealogy-site-theme-contract-v2` | `44b7b3868867` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 99 | `fix/genealogy-site-theme-contract-v3` | `5cde9d1ab255` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 100 | `fix/home-resume-readerstate-owner-20260906` | `d83d8276884f` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 101 | `fix/native-article-capabilities-20260820` | `01894214765d` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 102 | `fix/teen-series-quality-20260911` | `df0868fdb541` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 103 | `fix/tts-route-trigger-coverage-20260912` | `83465c8ea10a` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 104 | `integration/pastor-core-composition-20260915` | `438eb71b9a26` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 105 | `integration/reader-polish-01a0a73b` | `34edaf5ad30a` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 106 | `integration/reader-polish-final-20260917` | `0d70aaf7f3e4` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 107 | `integration/reader-runtime-composition-20260915` | `0903c98c2dcd` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 108 | `lane/baptist-utf8-repair-20260913` | `b08c623f2448` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 109 | `lane/baptisty-petersburg-deepening-20260902` | `6a45678cc318` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 110 | `lane/journal-editorial-architecture-20260907` | `c20728ef3b85` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 111 | `lane/pastor-series-content-clearance-ii-ix-20260908` | `f006e16a4564` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 112 | `lane/pastor-series-part-ix-terminology-claim-map-20260908` | `f562d9b8eb66` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 113 | `lane/pastor-series-part-v-ecclesiology-source-20260908` | `5f1aa16ec007` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 114 | `lane/pastor-series-part-vi-source-exegesis-20260908` | `f466989f70aa` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 115 | `lane/pastor-series-part-vii-claim-map-20260908` | `d6cecbdccc18` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 116 | `lane/pastor-series-part-viii-prudential-source-map-20260908` | `e5fa2dcdcdaa` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 117 | `lane/pastor-series-source-reconciliation-20260907` | `80dd5c3d2fb3` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 118 | `lane/reader-menu-focus-witness-20260907` | `f0527243bd03` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 119 | `lane/security-meta-debt-baptist-noch-na-kure-20260909` | `b9da40c44783` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 120 | `lane/security-meta-debt-gill-pageheads-20260910` | `8d253c53f3de` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 121 | `lane/security-meta-debt-nagornaya-b1-20260909` | `0672c653eb7d` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 122 | `lane/security-netlify-transport-owner-20260908` | `c65b83a65881` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 123 | `lane/security-ownership-current-20260908` | `1c1f7046cdc0` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 124 | `lane/system-fragmented-security-ownership-20260907` | `60071a8b8be1` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 125 | `lane/system-fragmented-security-ownership-v2-20260907` | `3ec459f69457` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 126 | `polish/teen-series-quality-20260911` | `09c781e25206` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 127 | `reconcile/ch06-kargel-research-20260911` | `d4e2b4e50ac6` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 128 | `reconcile/ch07-mazaev-prokhanov-research-20260911` | `94abbd7b8d02` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 129 | `reconcile/ch08-print-republic-research-20260911` | `b2a7fbd7fb3a` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 130 | `reconcile/ch09-fetler-house-gospel-research-20260911` | `79b5265ad363` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 131 | `reconcile/ch10-1917-1921-research-20260911` | `43f15e206d0e` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 132 | `reconcile/ch11-famine-international-brotherhood-research-20260911` | `7ec892cce9d2` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 133 | `reconcile/ch12-school-bible-failed-unity-research-20260911` | `2c70bbd37603` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 134 | `reconcile/ch13-conscience-army-state-research-20260911` | `673af6d12105` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 135 | `reconcile/ch14-1929-law-church-life-research-20260911` | `95537773650b` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 136 | `reconcile/ch14-1929-law-church-life-research-20260911-g2` | `286c9cf741f6` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 137 | `reconcile/ch14-1929-law-church-life-research-20260911-g3` | `bd7f6a6afb86` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 138 | `reconcile/ch15-1930s-unions-great-terror-research-20260911` | `8857372311c4` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 139 | `reconcile/ch15-1930s-unions-great-terror-research-20260911-g2` | `398b60fbc450` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 140 | `reconcile/ch16-war-1944-union-research-20260911` | `1fd49598e05e` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 141 | `reconcile/ch20-international-1991-memory-research-20260911` | `013164d403ac` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 142 | `reconcile/security-baptist-kura-nosniff-meta-20260911` | `740f48b1d8b9` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 143 | `reconcile/security-gill-nosniff-meta-20260911` | `26dc370830c0` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 144 | `refactor/karty-publication-ssot` | `dbe3f643fbe2` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 145 | `refactor/map-engine-shared-bootstrap-v2` | `472199290dca` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 146 | `repair/app-dual-cta-browser-witness-20260906` | `a699303c8368` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 147 | `repair/dist-css-astro-admission-20260819` | `d4264572e6e4` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 148 | `repair/remove-should-not-create-20260906` | `13a73eca90d3` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 149 | `repair/tts-sharedworker-client-lifecycle-20260906` | `ebd987532e03` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 150 | `repair/wire-engine-contracts-20260819` | `475a8f210529` | SQUASH_OR_PATCH_EQUIVALENT (все затронутые файлы = main); replacement: main@d0e04a9c |
| 151 | `rights/tmsj-current-translation-20260906` | `29204573b78f` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 152 | `sync/metadata-1873-main-a0d45c13-20260908` | `a0d45c13f56f` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 153 | `sync/metadata-main-cd7d1ca8-20260908` | `cd7d1ca82583` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 154 | `sync/security-meta-debt-nagornaya-support-1943` | `cf1ec0f2e9ab` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 155 | `system/journal-production-promotion-20260910` | `6203723881fc` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 156 | `system/mapengine-runtime-repair` | `33f5026affe5` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 157 | `system/sinai-coast-authority` | `29d6776029e9` | SUPERSEDED_VERIFIED (documented merged successor); replacement: main@d0e04a9c |
| 158 | `tmp-do-not-use-1949-sync` | `c96ac8e124a1` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 159 | `tmp-unused` | `81e18524813a` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 160 | `tmp/noop-check` | `a117efda1272` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 161 | `tmp/noop-check-retired` | `a117efda1272` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |
| 162 | `tmp/teen-closure-staging-20260910` | `bab946c13e2f` | FULLY_REPRESENTED_BY_ANCESTRY (ahead=0); replacement: main@d0e04a9c |

## Ключевые replacement-композиции (merged PR, покрывающие superseded-дельты)

genealogy: #2076 #2080 #2092 #2102 #2103 #2111 #2121 #2129 #2130 #2132 #2137 · karty: #2053 #2054 #2064 #2067 · reader: #2088 #2136 · security/DNS-only: #1935 #1945 · pastor-series receipts + #2087 · teen wave: #1991–#2036 · golden chapters: #1954–#1956 #1993 #1999 #2000 · главы книги: #1962 #1975–#1990 · home resume: #1805 · deploy pin: #1841 · journal: #1931 #1938 · visible-date: #1860 · atlas-focus: #2055

## Оставшиеся 42 ветки (не удалялись)

| Ветка | Класс | Причина сохранения |
|---|---|---|
| `agent/antisovetov-title-suffix-20260818` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `agent/app-integration-zero-debt-20260820` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `agent/bible-app-deep-playwright-audit-20260819` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `agent/bible-app-deep-playwright-r2-20260819` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `arena/01a0a1b2-gb-is-my-strength` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `arena/01a0a1b4-gb-is-my-strength` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `arena/01a0a1ce-gb-is-my-strength` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `audit/baptisty-total-production-audit-20260911` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `book/ch07-mazaev-prokhanov-research-v2` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `codex/baptisty-spravochnik-evidence-language` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `content/apostasy-bible-study` | ACTIVE (open PR) | сохранить до решения владельца / разрешения связного PR |
| `dependabot/npm_and_yarn/npm-non-major-92ac384687` | ACTIVE (open PR) | сохранить до решения владельца / разрешения связного PR |
| `deps/npm-non-major-20260906-r2` | HOLD | сохранить до решения владельца / разрешения связного PR |
| `fix/baptisty-kura-delyakov-quote-hold-20260911` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `fix/baptisty-samizdat-contrast-20260911` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `fix/baptisty-source-provenance-polish-20260911` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `fix/baptisty-visible-date-semantics-20260911` | C-verify | сохранить до решения владельца / разрешения связного PR |
| `fix/genealogy-relation-confidence-localization` | C-verify | сохранить до решения владельца / разрешения связного PR |
| `fix/map-engine-capability-runtime-v1` | C-verify | сохранить до решения владельца / разрешения связного PR |
| `fix/npm-non-major-security-20260907` | ACTIVE (open PR) | сохранить до решения владельца / разрешения связного PR |
| `fix/series-taxonomy-projection-20260911` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `genealogy/editorial-direct-name-batch-20260924` | ACTIVE (open PR) | сохранить до решения владельца / разрешения связного PR |
| `lane/baptisty-book-production-status-20260906` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `lane/metadata-reconcile-diotrophes-wave12-20260908` | C-verify | сохранить до решения владельца / разрешения связного PR |
| `lane/metadata-reconcile-heart-bookends-20260908` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `lane/metadata-reconcile-novoe-serdce-20260908` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `lane/metadata-reconcile-serdce-i-duh-20260908` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `lane/metadata-reconcile-tma-pr518-20260908` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `lane/metadata-review-decision-rimlyanam7-20260908` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `lane/metadata-standalone-three-reconciliation-20260908` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `lane/teen-core-content-clearance-20260908` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `reconcile/baptist-ch01-authority-salvage-20260924` | ACTIVE (open PR) | сохранить до решения владельца / разрешения связного PR |
| `reconcile/baptisty-book-status-20260911` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `reconcile/baptisty-media-recovery-20260911` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `reconcile/ch01-pre-baptist-origins-research-20260911` | HOLD | сохранить до решения владельца / разрешения связного PR |
| `refactor/map-engine-route-bootstrap` | C-verify | сохранить до решения владельца / разрешения связного PR |
| `repair/antisovetov-title-suffix-20260906` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `repair/engine-contracts-current-20260819` | C-verify | сохранить до решения владельца / разрешения связного PR |
| `repair/restore-failure-notifier-contract-20260819` | C-verify | сохранить до решения владельца / разрешения связного PR |
| `repair/retired-notifier-policy-20260819` | C-verify | сохранить до решения владельца / разрешения связного PR |
| `repair/source-surface-audit-completeness-20260906` | D UNIQUE_EVIDENCE/RECOVERY | сохранить до решения владельца / разрешения связного PR |
| `tmp-noop` | C-verify | сохранить до решения владельца / разрешения связного PR |

## Recovery, выполненный в этом же transaction set

- quote-HOLD Делякова + provenance snapshot (из `fix/baptisty-source-provenance-polish-20260911`, superset `fix/baptisty-kura-delyakov-quote-hold-20260911`) — применено 3-way на current main;
- AA-контраст самиздат-темы (из `fix/baptisty-samizdat-contrast-20260911`) + canonical cache-bust (`?v=9e2de1d7`, check exit 0);
- heart-series metadata supplements ×4 (из закрытых metadata-reconcile lane'ов #1881/#1889/#1890/#1892), strict-контракт зелёный.
