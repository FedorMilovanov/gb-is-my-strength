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

## Verified evidence before the final repository-wide rerun

TTS Reader Polish run `30923060492`, real-model job `92038310375`:

- cold SharedWorker ready: 49,346.8 ms;
- SharedWorker follower ready: 8.2 ms;
- navigation reuse ready: 6.8 ms;
- SharedWorker synthesis: 2,727.8 ms;
- cached DedicatedWorker ready: 40,041.3 ms;
- cached synthesis: 2,847.4 ms;
- maximum measured UI heartbeat gap: 34.8 ms;
- WAV bytes: 45,612 in both synthesis paths;
- model requests: exactly 1;
- model bytes: 280,394,098;
- PASS-to-artifact start: approximately 26 ms;
- real-model artifact: `8898001209`.

The same run completed the TTS playback route lane successfully. The final HEAD must reproduce all blocking gates after the repository audit allowlist correction.

## Merge boundary

This record does not authorize merging or production deployment. PR #876 may move from draft to ready only after every workflow associated with its final HEAD is complete and green.
