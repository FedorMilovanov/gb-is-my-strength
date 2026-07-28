# Print/PDF forensic history anchor — 2026-07-28

This commit is a non-merge forensic anchor. Its parents preserve the accepted product chain and the temporary/obsolete diagnostic witnesses inspected before ref normalization.

Current main at anchor creation:
- b40044713b9fa09e404d5f57b2016d31f4cc88c6

Accepted product heads:
- PR #209 — ba52d50177af7c2fde62b80ee623cbf93cd43c84 — system-wide reader/PDF contract
- PR #235 — 565bd033f93a3ee88a51104e7c34aadc2c4c390e — neutral paper/pagination integrity
- PR #257 — 1647e687e8e92dcbd9aaf3e87190bf962bd6d2e4 — Gill series overview pagination
- PR #263 — 15436ad01e75878dd336b865c06f69dcc631a8d6 — universal semantic pagination engine
- PR #283 — b110450cb9cb47974e96e51ff15b618c448f63f5 — gold-progress removal and reversible-card integration
- PR #286 — 4dc1e155b990660687c568ded5541c10768d5d1c — physical front/back reversible-card proof and specificity fix

Diagnostic witnesses:
- PR #234 — 69b8cf0df189434f6e80bdd6a96c8f2336013ea6 — first post-merge production proof
- PR #253 — 2a6881d0be4ce87bdcbc75b3edeea56eb4021ab1 — superseded production-proof lane
- PR #280 — ccbdb6959cc32d8b9f650b02793222b6e99d8c2b — superseded 58-commit decoration/pagination diagnostic
- PR #288 — b7eb9f8d84a375166956dd87c10cc30d9ce89162 — obsolete deployment-timing witness

Key disposition facts:
- PR #280 contained a duplicated paper_ratio_around() definition and is not canonical as a whole.
- Its focused physical reversible-card method was later restored and strengthened by merged PR #286.
- PR #286 proved and repaired the flipped-back matrix3d specificity defect, then made front/back PDF proof permanent.
- Production-witness PRs are evidence only and must never be merged as product code.

Restore by checking out the relevant parent SHA directly. Do not merge this anchor into main.