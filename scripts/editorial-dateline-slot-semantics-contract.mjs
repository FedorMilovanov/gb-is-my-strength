#!/usr/bin/env node
/**
 * Editorial Dateline Slot Semantics Contract (SYS-EDITORIAL-DATELINE-SLOT-SEMANTICS)
 *
 * Verifies across built dist/ routes using parse5 DOM traversal:
 * 1. Explicit publication slots (`data-editorial-date-slot="published"` or
 *    visible prefix `Опубликовано`) project `editorialPublishedAt`, never
 *    `editorialModifiedAt`.
 * 2. All 9 publication-slot routes in `data/editorial-dateline-slot-authority.json`
 *    synchronize both `<time datetime>` and visible Russian date copy.
 * 3. Intentional dual-slot controls (`/baptisty-rossii/noch-na-kure/`,
 *    `/baptisty-rossii/peterburgskaya-liniya/`, `/articles/kod-da-vinchi/`)
 *    preserve their historical visible modification labels untouched.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as parse5 from 'parse5';

const require = createRequire(import.meta.url);
const { ROOT, readRegistry, normalizeInstant } = require('./lib/editorial-metadata.js');
const { readDatelineSlotAuthority, classifyDatelineSlot } = require('./lib/editorial-metadata-v3.js');

const DIST = path.join(ROOT, 'dist');
assert.ok(fs.existsSync(DIST), 'dist/ missing; build dist before running editorial-dateline-slot-semantics-contract');

const registry = readRegistry();
const authority = readDatelineSlotAuthority();
const publishedRoutes = authority.publishedSlotRoutes || {};
assert.equal(Object.keys(publishedRoutes).length, 9, 'expected 9 publication-slot authority routes');

function attr(node, name) {
  return node?.attrs?.find((a) => a.name === name)?.value ?? '';
}

function textOf(node) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value || '';
  return (node.childNodes || []).map(textOf).join('');
}

function hasClass(node, token) {
  return attr(node, 'class').split(/\s+/).includes(token);
}

function walk(node, fn, ancestors = []) {
  if (!node) return;
  fn(node, ancestors);
  const next = node.tagName ? [...ancestors, node] : ancestors;
  for (const c of node.childNodes || []) walk(c, fn, next);
}

function textBefore(container, target) {
  const parts = [];
  let done = false;
  (function visit(curr) {
    if (!curr || done) return;
    if (curr === target) { done = true; return; }
    if (curr.nodeName === '#text') parts.push(curr.value || '');
    for (const c of curr.childNodes || []) visit(c);
  })(container);
  return parts.join(' ');
}

function datelineSlotsForRoute(route) {
  const rel = route.replace(/^\/+|\/+$/g, '');
  const file = path.join(DIST, rel, 'index.html');
  assert.ok(fs.existsSync(file), `${route}: missing dist HTML`);
  const doc = parse5.parse(fs.readFileSync(file, 'utf8'));
  const slots = [];
  walk(doc, (node, ancestors) => {
    if (node.tagName !== 'time') return;
    const updatedOwner = [...ancestors, node].reverse().find(
      (el) => hasClass(el, 'article-updated') || hasClass(el, 'article-byline__updated')
    );
    const bylineOwner = [...ancestors].reverse().find((el) => hasClass(el, 'article-byline'));
    if (!updatedOwner && !bylineOwner) return;
    const owner = updatedOwner || bylineOwner;
    const attrsBlob = [owner, node]
      .filter(Boolean)
      .map((el) => (el.attrs || []).map((a) => `${a.name}="${a.value}"`).join(' '))
      .join(' ');
    const prefix = textBefore(owner, node);
    const slot = classifyDatelineSlot(attrsBlob, prefix, updatedOwner ? 'modified' : 'published');
    slots.push({
      slot,
      datetime: attr(node, 'datetime'),
      label: textOf(node).replace(/\s+/g, ' ').trim(),
    });
  });
  return slots;
}

for (const [route, spec] of Object.entries(publishedRoutes)) {
  const record = registry.records?.[route];
  assert.ok(record, `${route}: missing registry record`);
  assert.equal(record.reviewStatus, 'approved', `${route}: expected approved record`);
  assert.equal(
    normalizeInstant(record.editorialPublishedAt),
    normalizeInstant(spec.editorialPublishedAt),
    `${route}: slot authority editorialPublishedAt drifted from registry`
  );

  const slots = datelineSlotsForRoute(route).filter((s) => s.slot === 'published');
  assert.equal(slots.length, 1, `${route}: expected exactly 1 published dateline slot`);
  assert.equal(
    normalizeInstant(slots[0].datetime),
    normalizeInstant(record.editorialPublishedAt),
    `${route}: published slot datetime mismatch (${slots[0].datetime})`
  );
  assert.notEqual(
    normalizeInstant(slots[0].datetime),
    normalizeInstant(record.editorialModifiedAt),
    `${route}: published slot received editorialModifiedAt`
  );
  assert.equal(slots[0].label, spec.visibleLabel, `${route}: published slot visible label mismatch`);
}

const dualSlotControls = [
  {
    route: '/baptisty-rossii/noch-na-kure/',
    pubLabel: '1 июня 2026',
    modLabel: '13 июня 2026',
  },
  {
    route: '/baptisty-rossii/peterburgskaya-liniya/',
    pubLabel: '4 июня 2026',
    modLabel: '20 августа 2026',
  },
  {
    route: '/articles/kod-da-vinchi/',
    pubLabel: '1 апреля 2026',
    modLabel: '9 мая 2026',
  },
];

for (const ctrl of dualSlotControls) {
  const record = registry.records?.[ctrl.route];
  assert.ok(record, `${ctrl.route}: missing registry record`);
  const slots = datelineSlotsForRoute(ctrl.route);
  assert.equal(slots.length, 2, `${ctrl.route}: expected 2 dateline slots`);
  assert.equal(slots[0].slot, 'published', `${ctrl.route}: first slot must be published`);
  assert.equal(slots[1].slot, 'modified', `${ctrl.route}: second slot must be modified`);
  assert.equal(normalizeInstant(slots[0].datetime), normalizeInstant(record.editorialPublishedAt), `${ctrl.route}: pub datetime`);
  assert.equal(normalizeInstant(slots[1].datetime), normalizeInstant(record.editorialModifiedAt), `${ctrl.route}: mod datetime`);
  assert.equal(slots[0].label, ctrl.pubLabel, `${ctrl.route}: pub label preserved`);
  assert.equal(slots[1].label, ctrl.modLabel, `${ctrl.route}: mod label preserved`);
}

console.log('✅ Editorial dateline slot semantics contract passed (9 publication slots + 3 dual-slot controls)');
