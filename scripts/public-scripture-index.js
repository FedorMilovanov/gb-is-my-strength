'use strict';

const PUBLIC_SCRIPTURE_INDEX_SCHEMA_VERSION = 1;

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(source, key, label) {
  const value = source[key];
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${label}.${key} must be a string when present`);
  return value;
}

function sanitizeOccurrence(value, referenceLabel, index) {
  const occurrence = requireObject(value, `${referenceLabel}.occurrences[${index}]`);
  const publicOccurrence = {
    url: requireString(occurrence.url, `${referenceLabel}.occurrences[${index}].url`),
  };

  for (const key of ['anchor', 'context', 'title']) {
    const field = optionalString(occurrence, key, `${referenceLabel}.occurrences[${index}]`);
    if (field !== undefined) publicOccurrence[key] = field;
  }

  if (occurrence.topics != null) {
    if (!Array.isArray(occurrence.topics) || occurrence.topics.some((topic) => typeof topic !== 'string')) {
      throw new Error(`${referenceLabel}.occurrences[${index}].topics must be an array of strings when present`);
    }
    if (occurrence.topics.length) publicOccurrence.topics = [...occurrence.topics];
  }

  return publicOccurrence;
}

function sanitizePublicScriptureIndex(value) {
  const input = requireObject(value, 'scripture search index');
  if (input.schemaVersion !== PUBLIC_SCRIPTURE_INDEX_SCHEMA_VERSION) {
    throw new Error(`scripture search index schemaVersion must be ${PUBLIC_SCRIPTURE_INDEX_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(input.references)) {
    throw new Error('scripture search index references must be an array');
  }

  return {
    schemaVersion: PUBLIC_SCRIPTURE_INDEX_SCHEMA_VERSION,
    references: input.references.map((value, index) => {
      const reference = requireObject(value, `references[${index}]`);
      const id = requireString(reference.id, `references[${index}].id`);
      const label = requireString(reference.label, `references[${index}].label`);
      if (!Array.isArray(reference.occurrences)) {
        throw new Error(`references[${index}].occurrences must be an array`);
      }
      return {
        id,
        label,
        occurrences: reference.occurrences.map((occurrence, occurrenceIndex) =>
          sanitizeOccurrence(occurrence, `references[${index}]`, occurrenceIndex)),
      };
    }),
  };
}

function serializePublicScriptureIndex(value) {
  return JSON.stringify(sanitizePublicScriptureIndex(value), null, 2) + '\n';
}

module.exports = {
  PUBLIC_SCRIPTURE_INDEX_SCHEMA_VERSION,
  sanitizePublicScriptureIndex,
  serializePublicScriptureIndex,
};
