import assert from 'node:assert/strict';

const DEFAULT_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const DEFAULT_ZONE_NAME = 'gospod-bog.ru';

function normalizeApiBaseUrl(value) {
  return String(value || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

function normalizeZoneName(value) {
  const zoneName = String(value || DEFAULT_ZONE_NAME).trim().toLowerCase();
  assert.match(zoneName, /^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Cloudflare zone name must be a DNS name');
  return zoneName;
}

async function readCloudflareJson(response, label) {
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`${label}: Cloudflare returned invalid JSON (${error.message || error})`);
  }

  assert.equal(response.ok, true, `${label}: Cloudflare HTTP ${response.status}`);
  assert.equal(payload?.success, true, `${label}: Cloudflare API reported failure`);
  return payload;
}

export async function purgeCloudflareReleaseCache({
  fetchImpl = globalThis.fetch,
  apiToken,
  zoneId,
  zoneName = DEFAULT_ZONE_NAME,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  signal,
} = {}) {
  assert.equal(typeof fetchImpl, 'function', 'fetch implementation is required');

  const token = String(apiToken || '').trim();
  assert.ok(token, 'CLOUDFLARE_API_TOKEN is required for deterministic production promotion');

  const normalizedZoneId = String(zoneId || '').trim();
  assert.match(normalizedZoneId, /^[a-f0-9]{16,64}$/i, 'CLOUDFLARE_ZONE_ID is required and must be a Cloudflare zone id');

  const normalizedZoneName = normalizeZoneName(zoneName);
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const purgeUrl = `${normalizedApiBaseUrl}/zones/${encodeURIComponent(normalizedZoneId)}/purge_cache`;
  const purgeResponse = await fetchImpl(purgeUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'gb-release-cloudflare-purge/1.0',
    },
    body: JSON.stringify({ purge_everything: true }),
    signal,
  });
  const purgePayload = await readCloudflareJson(purgeResponse, 'cache purge');

  return {
    result: 'PASS',
    provider: 'cloudflare',
    zoneName: normalizedZoneName,
    purgeEverything: true,
    purgeRequestId: String(purgePayload?.result?.id || purgePayload?.result?.zone_id || ''),
  };
}
