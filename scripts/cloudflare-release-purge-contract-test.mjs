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
    assert.equal(init.headers.authorization, `Bearer ${SECRET}`);
    assert.equal(init.headers['content-type'], 'application/json');

    if (calls.length === 1) {
      const parsed = new URL(String(url));
      assert.equal(parsed.pathname, '/client/v4/zones');
      assert.equal(parsed.searchParams.get('name'), 'gospod-bog.ru');
      assert.equal(parsed.searchParams.get('status'), 'active');
      return response(200, {
        success: true,
        result: [{ id: ZONE_ID, name: 'gospod-bog.ru' }],
      });
    }

    assert.equal(String(url), `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`);
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), { purge_everything: true });
    return response(200, {
      success: true,
      result: { id: ZONE_ID },
    });
  };

  const result = await purgeCloudflareReleaseCache({
    fetchImpl,
    apiToken: SECRET,
    zoneName: 'GOSPOD-BOG.RU',
  });
  assert.equal(calls.length, 2);
  assert.equal(result.result, 'PASS');
  assert.equal(result.zoneName, 'gospod-bog.ru');
  assert.equal(result.zoneId, ZONE_ID);
  assert.equal(result.purgeEverything, true);
  assert.equal(JSON.stringify(result).includes(SECRET), false, 'result must not expose API token');
}

await assert.rejects(
  () => purgeCloudflareReleaseCache({ fetchImpl: async () => response(500, {}), apiToken: '' }),
  /CLOUDFLARE_API_TOKEN is required/,
);

await assert.rejects(
  () => purgeCloudflareReleaseCache({
    apiToken: SECRET,
    fetchImpl: async () => response(200, {
      success: true,
      result: [
        { id: ZONE_ID, name: 'gospod-bog.ru' },
        { id: 'fedcba9876543210fedcba9876543210', name: 'gospod-bog.ru' },
      ],
    }),
  }),
  /expected exactly one active Cloudflare zone named gospod-bog\.ru, found 2/,
);

await assert.rejects(
  () => purgeCloudflareReleaseCache({
    apiToken: SECRET,
    fetchImpl: async () => response(403, { success: false, errors: [{ code: 10000 }] }),
  }),
  /zone lookup: Cloudflare HTTP 403/,
);

console.log('Cloudflare release purge contract: PASS');
