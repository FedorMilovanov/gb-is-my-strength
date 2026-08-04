# TTS Reader acceptance record — 2026-08-04

## Scope

This record defines the blocking acceptance boundary for the shared reader TTS implementation in PR #876.

The production architecture is:

- one canonical `GBReaderTTS` playback owner;
- SharedWorker-first Vosk engine with a DedicatedWorker fallback;
- model download, SHA-256 verification, archive extraction, IndexedDB and ONNX ownership outside the document main thread;
- explicit reader FSM and operation-token race protection;
- native Web Speech pause/resume and boundary continuation;
- addressed cross-tab jobs, client heartbeat and stale-client pruning;
- release provenance for the engine, Worker and lazy cache policy.

`js/vosk-tts-worker.js` is a canonical, versioned and attested production asset. The strict `scripts/audit-pro.js` JavaScript allowlist must contain it; unknown files in `js/` remain forbidden.

## Blocking acceptance criteria

1. Deterministic runtime and multitab browser contracts pass.
2. Every production-like TTS route passes on desktop and mobile: 56 routes / 112 checks, zero failures.
3. A real cold model run downloads the model exactly once and produces a non-silent WAV.
4. A second SharedWorker client reuses the ready model without another model request.
5. Navigation reuses the SharedWorker state.
6. DedicatedWorker fallback starts from IndexedDB without another model request and produces a non-silent WAV.
7. Main-thread heartbeat gaps remain below five seconds during model preparation and synthesis.
8. The real-model job is fail-closed with an eight-minute job budget.
9. PASS-to-artifact teardown is immediate; a retained browser or Worker handle must not leave a long green tail.
10. Source, consent, pronunciation, provenance, build-once release and workflow-policy contracts pass.
11. The repository-wide professional audit recognizes the attested Worker while continuing to reject unknown JavaScript files.
12. Chromium, Firefox and WebKit overlay contracts pass, including the bounded Gill mobile ToC activation replay.
13. The branch contains the current `main` tip and remains directly mergeable.

## Verified final evidence before main reconciliation

TTS Reader Polish run `30933443923`, real-model job `92073549402`:

- cold SharedWorker ready: 62,690.6 ms;
- SharedWorker follower ready: 10.4 ms;
- navigation reuse ready: 6.7 ms;
- SharedWorker synthesis: 3,054.6 ms;
- cached DedicatedWorker ready: 50,001.2 ms;
- cached synthesis: 3,098.1 ms;
- maximum measured UI heartbeat gap: 34.5 ms;
- WAV bytes: 45,612 in both synthesis paths;
- model requests: exactly 1;
- model bytes: 280,394,098;
- PASS-to-artifact start: approximately 26 ms;
- playback artifact: `8902297655`;
- real-model artifact: `8902171749`.

The same final-head cycle also completed:

- 56 routes / 112 desktop-mobile TTS checks with zero failures;
- TTS consent browser artifact `8902358261` and source-contract artifact `8902095596`;
- Route Registry Chromium and WebKit public-surface matrices;
- Overlay Runtime Chromium, Firefox and WebKit matrices;
- Runtime Interactive Audit, Visual Parity, Deploy Candidate, Print, Native Source, Source Authority, Search, Glossary and repository-wide audit gates.

## Current-main reconciliation

The TTS lane was reconciled with `main` commit `83875378a31436e235f1296f13d22c816b2945df` by merge commit `eb6893e337082e2f244388035294ce8de7523d60`.

The only shared-file conflict was `src/lib/asset-version.js`. Its resolved registry retains:

- the current `main` search revision `f48e4610` and Nagornaya mobile ToC revision `30051b58`;
- the TTS notice revision `b9ef192f`;
- the TTS engine revision `f9b4905f`;
- the TTS Worker revision `2ea9ada3`.

The post-reconciliation owner-authored HEAD must reproduce all blocking workflows before PR #876 moves from draft to ready.

## Merge boundary

This record does not authorize merging or production deployment. PR #876 may move from draft to ready only after every workflow associated with its final owner-authored HEAD is complete and green.
