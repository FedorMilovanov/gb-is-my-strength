/**
 * Read-only HTTP evidence for opt-in acceptance runners, not product runtime.
 * Fetch real bytes before forwarding them unchanged. Do not retrieve CDP page
 * response bodies after navigation, cache reuse or document/context disposal.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** FIFO API-fetch cap: no-JS can eagerly request every lazy image. No retries. */
export function createArtifactAssetQueue(limit = 6) {
  assert.ok(Number.isInteger(limit) && limit > 0, 'Positive asset concurrency required');
  let active = 0;
  const waiting = [];
  return async (task) => {
    if (active < limit) active++; else await new Promise((resolve) => waiting.push(resolve));
    try { return await task(); }
    finally { if (waiting.length) waiting.shift()(); else active--; }
  };
}

/** The caller owns safe artifact-path resolution. HTML documents stay native;
 * their independent HTTP/artifact checks must not be replaced by this helper. */
export async function verifiedArtifactRoute(route, { origin, readArtifact, onPin, schedule = (task) => task() }) {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== origin) return route.abort();
  if (request.resourceType() === 'document') return route.continue();
  return schedule(async () => {
    const response = await route.fetch({ timeout: 15000, maxRedirects: 0 });
    assert.equal(response.status(), 200, `Asset HTTP failure: ${url.pathname}`);
    // This is a fully fetched APIResponse, NOT a navigation-sensitive Page Response.
    const bytes = await response.body(), local = readArtifact(decodeURIComponent(url.pathname).slice(1));
    assert.equal(sha256(bytes), sha256(local), `Served asset differs from artifact: ${url.pathname}`);
    onPin({ url: url.pathname + url.search, sha256: sha256(local) });
    return route.fulfill({ response, body: bytes });
  });
}

/** Install before navigation and drain before closing each context. Every pin
 * failure is reported with its original cause; an abort failure cannot hide it. */
export function createVerifiedArtifactTransport({ origin, readArtifact, onPin, onError, concurrency = 6 }) {
  const url = new URL(origin);
  assert.ok(['http:', 'https:'].includes(url.protocol) && url.origin === origin, 'Canonical HTTP origin required');
  assert.equal(typeof readArtifact, 'function');
  assert.equal(typeof onPin, 'function');
  assert.equal(typeof onError, 'function');
  const schedule = createArtifactAssetQueue(concurrency), jobs = new Set(), installed = new WeakSet();
  return {
    get pending() { return jobs.size; },
    async install(context, label) {
      assert.ok(!installed.has(context), 'Artifact transport already installed on this context');
      installed.add(context);
      await context.route('**/*', (route) => {
        const job = verifiedArtifactRoute(route, { origin, readArtifact, onPin, schedule }).catch(async (error) => {
          onError({ label, url: route.request().url(), error });
          try { await route.abort(); } catch { /* Preserve the original pin failure. */ }
        }).finally(() => jobs.delete(job));
        jobs.add(job); return job;
      });
    },
    async drain({ timeout = 60000 } = {}) {
      assert.ok(Number.isInteger(timeout) && timeout > 0, 'Positive drain timeout required');
      let timer;
      try {
        await Promise.race([
          (async () => { while (jobs.size) await Promise.all([...jobs]); })(),
          new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(`Artifact transport drain timed out with ${jobs.size} pending request(s)`)), timeout); }),
        ]);
      } finally { clearTimeout(timer); }
    },
  };
}
