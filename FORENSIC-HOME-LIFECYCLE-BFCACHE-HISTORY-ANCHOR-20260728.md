# Homepage lifecycle/BFCache forensic history anchor — 2026-07-28

Non-merge forensic anchor preserving accepted product evolution, staging/materializer states, rejected hypotheses, environmental controls and current branch tails before any homepage lifecycle ref normalization.

Current site main at anchor creation:
- b40044713b9fa09e404d5f57b2016d31f4cc88c6

Accepted/product authority:
- PR #338 head 8d39dab12e1f999b92551f3c80293ce442887537 — initial Chromium/WebKit homepage interaction contract
- direct accepted main commit a73b57945ebb354a79e723b2939d9f70e3e0c42e — clean lifecycle source/workflow authority
- PR #385 head 32353e0eda7e321a8220f0d9de7253712063e4ee — navigation abort request identity
- PR #388 head b6b3a2b0ab1c64fb143572b6ac818825e50210b6 — Pagefind exact request proof
- PR #405 head 88d17334ec13271c42fe4773308cbd23a4ab4d0f — capability-aware BFCache contract

Staging/materializer/diagnostic PR heads:
- PR #361 507005b9a2c00af9560c2ebd8ec7dbe31af12045
- PR #365 834fa0153eb6d1f2a523830a9fb9d9b7ae49f2fd
- PR #368 4e1efada974676dedbf3b8a81ff09bcabea24ca4
- PR #376 2edd637d255c112fa2a4dd68b9ba86a18998dc5c
- PR #381 b2d25c381d56c4af134f97ca5381e8fcffdb5369
- PR #400 307a9c95281a9abeb49421d1468eeee5058233f8
- PR #402 a21690ef04a2a730a0fdf2cf98575667cadf829f — rejected process-isolation carrier
- PR #404 7bfc0fc82346ad293e9b1a4f4131b950155a830f — minimal cross-platform BFCache control

Current non-PR-tail heads preserved separately from their PR heads:
- fix/home-browser-contract-residuals-20260725 -> 6ccb3616ee810c2845a1f5bb941d658114e55843
- fix/home-browser-lifecycle-final-20260725 -> 00dde6324e3101d77ee9c0c74062eb4a604861d1
- fix/home-browser-lifecycle-final-clean-20260726 -> dfb2087c9db1607a177d0416e5dee3456f032787

Key findings:
- current main retains PR #405 lifecycle blob byte-for-byte;
- PR #388 standalone Pagefind proof is absorbed into the current lifecycle contract;
- process isolation did not change WebKit persisted=false;
- minimal controls showed Chromium capability but no WebKit BFCache admission/restoration across six OS/headless/persistent configurations and three cache policies;
- capability-aware semantics are the accepted contract; no product code may fake browser capability.

Restore a state by checking out its exact SHA. Do not merge this anchor into main.