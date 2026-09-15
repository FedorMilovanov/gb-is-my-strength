#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateEdgeAnnotations } from './genealogy-build/lib/publishable-projection.mjs';

const source = JSON.parse(fs.readFileSync(
  new URL('../data/genealogy/v2/edge-annotations.json', import.meta.url),
  'utf8',
));

const clone = value => structuredClone(value);
const expectFailure = (label, mutate, pattern) => {
  const fixture = clone(source);
  mutate(fixture);
  assert.throws(
    () => validateEdgeAnnotations(fixture),
    pattern,
    label,
  );
};

assert.deepEqual(
  validateEdgeAnnotations(source),
  { annotations: source.annotations.length },
  'Committed edge annotations must satisfy the fail-closed contract',
);

expectFailure(
  'Duplicate relation annotation must not silently overwrite evidence',
  fixture => fixture.annotations.push(clone(fixture.annotations[1])),
  /Duplicate edge annotation target/,
);

expectFailure(
  'Qualified evidence requires confidence',
  fixture => { delete fixture.annotations[0].set.confidence; },
  /requires confidence classification/,
);

expectFailure(
  'Qualified evidence requires editorial position',
  fixture => { delete fixture.annotations[0].set.editorialPosition; },
  /requires editorialPosition classification/,
);

expectFailure(
  'Reviewed refs must be non-empty strings',
  fixture => { fixture.annotations[0].set.refs = ['']; },
  /requires reviewed non-empty refs/,
);

expectFailure(
  'Editorial harmonization cannot claim direct Scripture',
  fixture => { fixture.annotations[1].set.directScripture = true; },
  /editorial-harmonization must use directScripture=false/,
);

expectFailure(
  'Legal annotation must remain a parent-kind annotation',
  fixture => { fixture.annotations[0].kind = 'spouse'; },
  /legal relation must annotate parent kind/,
);

expectFailure(
  'Legal annotation must explicitly remain non-biological',
  fixture => { fixture.annotations[0].set.biology = 'unknown'; },
  /legal relation requires biology=non-biological/,
);

expectFailure(
  'Legal annotation requires a legalAssertion classification',
  fixture => { delete fixture.annotations[0].set.legalAssertion; },
  /legal relation requires legalAssertion/,
);

expectFailure(
  'Annotation cannot target itself',
  fixture => { fixture.annotations[1].to = fixture.annotations[1].from; },
  /cannot target the same identity/,
);

console.log(JSON.stringify({
  status: 'genealogy-edge-annotation-contract-ok',
  committedAnnotations: source.annotations.length,
  negativeCases: 9,
}, null, 2));
