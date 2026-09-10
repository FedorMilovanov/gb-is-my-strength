#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  buildScriptureOccurrenceIndex,
  serializeScriptureOccurrenceIndex,
} from './build-scripture-occurrence-index.mjs';

const output = process.env.TEEN_SCRIPTURE_INDEX_EXPORT;
if (!output) throw new Error('TEEN_SCRIPTURE_INDEX_EXPORT is required');

const serialized = serializeScriptureOccurrenceIndex(buildScriptureOccurrenceIndex());
fs.writeFileSync(output, serialized, 'utf8');
const sha256 = crypto.createHash('sha256').update(serialized).digest('hex');
console.log(`Teen Scripture index export: ${Buffer.byteLength(serialized)} bytes sha256=${sha256}`);
