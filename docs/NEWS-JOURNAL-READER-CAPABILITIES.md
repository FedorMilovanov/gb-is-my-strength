# NEWS / Journal — shared Reader capability boundary

Owner direction, 26 November 2026. Journal remains a specialized editorial surface, not a fourth Reader engine. This is a NEWS implementation contract under [Universal Reader Platform](READER-PLATFORM-ARCHITECTURE-2026-07-21.md), not a change to the Reader lane or an authorization to publish a research draft.

| Surface | Presentation owner | Capability owner |
|---|---|---|
| Journal index / brief news landing | JournalEditorialShell + page mobile chrome | shared search, preferences, navigation |
| Long-form Journal / G3 | JournalEditorialShell, JournalArticleHeader, native contents/source return, editorial graphics | shared reader preferences, search, opt-in narration via JournalNarration |
| Lawson investigation | ArticleLayout and canonical single-article Reader chrome | existing Reader stack, unchanged |
| ARGON, books, series | canonical article/series Reader | existing Reader stack, unchanged |

JournalNarration is a thin view of GBReaderProjection, GBReaderTTS, GBReaderRatePolicy and the existing lifecycle / media-session owners. No SpeechSynthesis or Vosk fork, no private rate or progress store, no extra global keyboard handler, no duplicate rail. Opt in only on a long-form article with exactly one main[data-reader-range]. The same play button stays reachable during narration; rate and stop delegate to the platform. No controls are exposed if JS or the capability cannot initialize. The index has no article playback. Do not install a full ReaderActionsRuntime merely to make an icon work.

Speech projection includes title, deck, narrative, evidence framing and inline links as prose. Pure navigation, byline, figure captions, matrix/atlas/graphic exhibits, document index, bibliography, standalone references and redundant promotional metadata stay available in HTML, search and print; only narration skips them. Use the shared data-tts-policy="exclude" marker, not data-reader-exclude for speech-only boundaries. No new claim or media rights. Narration is not a replacement for accessible data tables or sources. Real audio playback, stop/pause/resume, playback speed, progress, navigation retirement, error/unsupported state, narrow/mobile/200% text, theme, print/no-JS and keyboard require acceptance on the exact built routes. A source contract or deterministic speech transport alone does not certify audible system/Vosk playback.

Future features: share/save, preferences UI, scripture links and reading state are admitted individually through their canonical owners, not by importing ARGON chrome or inventing parallel localStorage keys. NEWS source discovery, chronology, editorial visuals and contextual citations remain Journal-specific. Shared files or Reader runtime changes require existing lane handoff; do not waive the collision guard.
