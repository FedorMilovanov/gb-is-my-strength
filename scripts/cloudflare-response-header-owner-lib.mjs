import assert from 'node:assert/strict';

export const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
export const CLOUDFLARE_ZONE_NAME = 'gospod-bog.ru';
export const RESPONSE_HEADER_PHASE = 'http_response_headers_transform';
export const NOSNIFF_RULE_REF = 'gb_x_content_type_options_nosniff_v1';

const RULE_DESCRIPTION = 'GB production transport owner: X-Content-Type-Options nosniff';

function normalizeApiBaseUrl(value) {
  return String(value || CLOUDFLARE_API_BASE_URL).replace(/\/+$/, '');
}

function normalizeZoneName(value) {
  const zoneName = String(value || CLOUDFLARE_ZONE_NAME).trim().toLowerCase();
  assert.match(zoneName, /^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Cloudflare zone name must be a DNS name');
  return zoneName;
}

function normalizeZoneId(value) {
  const zoneId = String(value || '').trim();
  assert.match(zoneId, /^[a-f0-9]{16,64}$/i, 'CLOUDFLARE_ZONE_ID is required and must be a Cloudflare zone id');
  return zoneId;
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

function desiredRule() {
  return {
    ref: NOSNIFF_RULE_REF,
    description: RULE_DESCRIPTION,
    expression: 'true',
    action: 'rewrite',
    action_parameters: {
      headers: {
        'X-Content-Type-Options': {
          operation: 'set',
          value: 'nosniff',
        },
      },
    },
    enabled: true,
  };
}

function comparableRule(rule) {
  return {
    ref: rule?.ref || '',
    description: rule?.description || '',
    expression: rule?.expression || '',
    action: rule?.action || '',
    action_parameters: rule?.action_parameters || {},
    enabled: rule?.enabled !== false,
  };
}

function sameOwnedDefinition(rule) {
  return JSON.stringify(comparableRule(rule)) === JSON.stringify(desiredRule());
}

async function cloudflareRequest(fetchImpl, url, token, options, label) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'gb-cloudflare-response-header-owner/1.0',
      ...(options?.headers || {}),
    },
  });
  return readCloudflareJson(response, label);
}

export async function ensureNosniffResponseHeader({
  fetchImpl = globalThis.fetch,
  apiToken,
  zoneId,
  zoneName = CLOUDFLARE_ZONE_NAME,
  apiBaseUrl = CLOUDFLARE_API_BASE_URL,
  signal,
} = {}) {
  assert.equal(typeof fetchImpl, 'function', 'fetch implementation is required');
  const token = String(apiToken || '').trim();
  assert.ok(token, 'CLOUDFLARE_TRANSFORM_API_TOKEN is required for the production response-header owner');

  const normalizedZoneId = normalizeZoneId(zoneId);
  const normalizedZoneName = normalizeZoneName(zoneName);
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const rulesetsUrl = `${baseUrl}/zones/${encodeURIComponent(normalizedZoneId)}/rulesets`;

  const listPayload = await cloudflareRequest(
    fetchImpl,
    rulesetsUrl,
    token,
    { method: 'GET', signal },
    'list zone rulesets',
  );

  const phaseRulesets = (Array.isArray(listPayload.result) ? listPayload.result : [])
    .filter((ruleset) => ruleset?.kind === 'zone' && ruleset?.phase === RESPONSE_HEADER_PHASE);
  assert.ok(phaseRulesets.length <= 1, `multiple ${RESPONSE_HEADER_PHASE} zone rulesets found`);

  if (phaseRulesets.length === 0) {
    await cloudflareRequest(
      fetchImpl,
      rulesetsUrl,
      token,
      {
        method: 'POST',
        signal,
        body: JSON.stringify({
          name: 'GB production response header transforms',
          description: 'Repository-owned production response-header transport controls.',
          kind: 'zone',
          phase: RESPONSE_HEADER_PHASE,
          rules: [desiredRule()],
        }),
      },
      'create response-header phase ruleset',
    );
    return {
      result: 'PASS',
      provider: 'cloudflare',
      zoneName: normalizedZoneName,
      phase: RESPONSE_HEADER_PHASE,
      ruleRef: NOSNIFF_RULE_REF,
      operation: 'created-ruleset',
    };
  }

  const rulesetId = String(phaseRulesets[0]?.id || '').trim();
  assert.ok(rulesetId, 'response-header phase ruleset is missing an id');
  const rulesetUrl = `${rulesetsUrl}/${encodeURIComponent(rulesetId)}`;
  const detailPayload = await cloudflareRequest(
    fetchImpl,
    rulesetUrl,
    token,
    { method: 'GET', signal },
    'read response-header phase ruleset',
  );
  const rules = Array.isArray(detailPayload.result?.rules) ? detailPayload.result.rules : [];
  const ownedRules = rules.filter((rule) => rule?.ref === NOSNIFF_RULE_REF);
  assert.ok(ownedRules.length <= 1, `multiple rules use owned ref ${NOSNIFF_RULE_REF}`);

  if (ownedRules.length === 0) {
    await cloudflareRequest(
      fetchImpl,
      `${rulesetUrl}/rules`,
      token,
      { method: 'POST', signal, body: JSON.stringify(desiredRule()) },
      'add nosniff response-header rule',
    );
    return {
      result: 'PASS',
      provider: 'cloudflare',
      zoneName: normalizedZoneName,
      phase: RESPONSE_HEADER_PHASE,
      ruleRef: NOSNIFF_RULE_REF,
      operation: 'created-rule',
    };
  }

  const ownedRule = ownedRules[0];
  if (sameOwnedDefinition(ownedRule)) {
    return {
      result: 'PASS',
      provider: 'cloudflare',
      zoneName: normalizedZoneName,
      phase: RESPONSE_HEADER_PHASE,
      ruleRef: NOSNIFF_RULE_REF,
      operation: 'noop',
    };
  }

  const ruleId = String(ownedRule?.id || '').trim();
  assert.ok(ruleId, `owned rule ${NOSNIFF_RULE_REF} is missing an id`);
  await cloudflareRequest(
    fetchImpl,
    `${rulesetUrl}/rules/${encodeURIComponent(ruleId)}`,
    token,
    { method: 'PATCH', signal, body: JSON.stringify(desiredRule()) },
    'update nosniff response-header rule',
  );

  return {
    result: 'PASS',
    provider: 'cloudflare',
    zoneName: normalizedZoneName,
    phase: RESPONSE_HEADER_PHASE,
    ruleRef: NOSNIFF_RULE_REF,
    operation: 'updated-rule',
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyLiveNosniff({
  fetchImpl = globalThis.fetch,
  zoneName = CLOUDFLARE_ZONE_NAME,
  paths = ['/', '/articles/', '/__transport-nosniff-witness-not-found__'],
  attempts = 6,
  delayMs = 5000,
  signal,
} = {}) {
  assert.equal(typeof fetchImpl, 'function', 'fetch implementation is required');
  const normalizedZoneName = normalizeZoneName(zoneName);
  assert.ok(Number.isInteger(attempts) && attempts >= 1 && attempts <= 20, 'attempts must be an integer from 1 to 20');
  assert.ok(Number.isInteger(delayMs) && delayMs >= 0 && delayMs <= 30000, 'delayMs must be an integer from 0 to 30000');
  assert.ok(Array.isArray(paths) && paths.length >= 1, 'at least one live witness path is required');

  const normalizedPaths = paths.map((value) => {
    const path = String(value || '').trim();
    assert.ok(path.startsWith('/') && !path.startsWith('//'), `invalid live witness path: ${path}`);
    return path;
  });

  let lastFailure = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const evidence = [];
    let allPass = true;
    for (const path of normalizedPaths) {
      try {
        const response = await fetchImpl(`https://${normalizedZoneName}${path}`, {
          method: 'GET',
          redirect: 'follow',
          cache: 'no-store',
          headers: { 'user-agent': 'gb-nosniff-live-witness/1.0' },
          signal,
        });
        const value = String(response.headers?.get?.('x-content-type-options') || '').trim().toLowerCase();
        const passed = value === 'nosniff';
        allPass &&= passed;
        evidence.push({ path, status: response.status, header: value, passed });
      } catch (error) {
        allPass = false;
        evidence.push({ path, status: null, header: '', passed: false, error: String(error?.message || error) });
      }
    }

    if (allPass) {
      return {
        result: 'PASS',
        zoneName: normalizedZoneName,
        attemptsUsed: attempt,
        evidence,
      };
    }

    lastFailure = evidence;
    if (attempt < attempts && delayMs > 0) await sleep(delayMs);
  }

  const error = new Error(`live X-Content-Type-Options witness failed after ${attempts} attempt(s)`);
  error.evidence = lastFailure;
  throw error;
}
