/** Lazy, Journal-only capability entry; the same ordered side-effect imports
 * as ReaderActionsRuntime, with no competing service, storage or playback.
 * Keep this an ES module so Astro/TypeScript can validate dynamic import.
 */
import '../../runtime/reader-projection.js';
import '../../runtime/reader-tts-defaults.js';
import '../../runtime/reader-tts-click-guard.js';
import '../../runtime/reader-tts-lifecycle.js';
import '../../runtime/reader-tts.js';
import '../../runtime/reader-tts-media-session.js';
export {};
