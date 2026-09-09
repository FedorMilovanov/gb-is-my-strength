#!/usr/bin/env node
import assert from 'node:assert/strict';
import { purgeCloudflareReleaseCache } from './cloudflare-release-purge-lib.mjs';

const SECRET = 'cf-test-token-that-must-not-leak';
const ZONE_ID = '0123456789abcdef0123456789abcdef';

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

{
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    assert.equal(String(url), `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.authorization, `Bearer ${SECRET}`);
    assert.equal(init.headers['content-type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), { purge_everything: true });
    return response(200, {
      success: true,
      result: { id: ZONE_ID },
    });
  };

  const result = await purgeCloudflareReleaseCache({
    fetchImpl,
    apiToken: SECRET,
    zoneId: ZONE_ID,
    zoneName: 'GOSPOD-BOG.RU',
  });
  assert.equal(calls.length, 1);
  assert.equal(result.result, 'PASS');
  assert.equal(result.zoneName, 'gospod-bog.ru');
  assert.equal(result.purgeEverything, true);
  assert.equal(JSON.stringify(result).includes(SECRET), false, 'result must not expose API token');
  assert.equal(JSON.stringify(result).includes(ZONE_ID), true, 'Cloudflare response id may identify the purge request');
}

await assert.rejects(
  () => purgeCloudflareReleaseCache({ fetchImpl: async () => response(500, {}), apiToken: '', zoneId: ZONE_ID }),
  /CLOUDFLARE_API_TOKEN is required/,
);

await assert.rejects(
  () => purgeCloudflareReleaseCache({ fetchImpl: async () => response(500, {}), apiToken: SECRET, zoneId: '' }),
  /CLOUDFLARE_ZONE_ID is required/,
);

await assert.rejects(
  () => purgeCloudflareReleaseCache({
    apiToken: SECRET,
    zoneId: ZONE_ID,
    fetchImpl: async () => response(403, { success: false, errors: [{ code: 10000 }] }),
  }),
  /cache purge: Cloudflare HTTP 403/,
);

await assert.rejects(
  () => purgeCloudflareReleaseCache({
    apiToken: SECRET,
    zoneId: ZONE_ID,
    fetchImpl: async () => response(200, { success: false, errors: [{ code: 1000 }] }),
  }),
  /cache purge: Cloudflare API reported failure/,
);

console.log('Cloudflare release purge contract: PASS');
