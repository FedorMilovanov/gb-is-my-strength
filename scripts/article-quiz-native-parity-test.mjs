import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimePath = new URL('../src/runtime/article-quiz.js', import.meta.url);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const runtimeUrl = `data:text/javascript;base64,${Buffer.from(runtimeSource).toString('base64')}#native-quiz-parity`;
const runtime = await import(runtimeUrl);

assert.equal(
  typeof runtime.selectQuizResult,
  'function',
  'article-quiz must export selectQuizResult() as the single score-tier semantic owner',
);
assert.equal(
  typeof runtime.normalizeQuizExplanation,
  'function',
  'article-quiz must export normalizeQuizExplanation() as the single explanation semantic owner',
);

const thresholdConfig = {
  scores: [
    { min: 7, title: 'Внимательный экзегет', badge: '📖', desc: 'tier-7' },
    { min: 5, title: 'Хороший читатель', badge: '🔎', desc: 'tier-5' },
    { min: 3, title: 'Нужно перечитать', badge: '🧭', desc: 'tier-3' },
    { min: 0, title: 'Начало пути', badge: '📜', desc: 'tier-0' },
  ],
};

for (const [score, expectedTitle, expectedBadge] of [
  [8, 'Внимательный экзегет', '📖'],
  [7, 'Внимательный экзегет', '📖'],
  [6, 'Хороший читатель', '🔎'],
  [5, 'Хороший читатель', '🔎'],
  [4, 'Нужно перечитать', '🧭'],
  [3, 'Нужно перечитать', '🧭'],
  [2, 'Начало пути', '📜'],
  [0, 'Начало пути', '📜'],
]) {
  const result = runtime.selectQuizResult(thresholdConfig, score, 8);
  assert.equal(result.title, expectedTitle, `min-only score tier drift at score=${score}`);
  assert.equal(result.badge, expectedBadge, `score badge must survive at score=${score}`);
}

const explicitRangeConfig = {
  scores: [
    { min: 0, max: 2, title: 'Диапазон 0–2' },
    { min: 3, max: 4, title: 'Диапазон 3–4' },
  ],
};
assert.equal(
  runtime.selectQuizResult(explicitRangeConfig, 3, 4).title,
  'Диапазон 3–4',
  'explicit {min,max} score ranges must remain compatible',
);
assert.equal(
  runtime.selectQuizResult({ scores: [] }, 1, 2).title,
  '1 из 2',
  'missing score tiers must keep the generic result fallback',
);

assert.deepEqual(
  runtime.normalizeQuizExplanation('Строковое объяснение'),
  { short: 'Строковое объяснение', full: '' },
  'legacy string explanation must remain one visible explanation layer',
);
assert.deepEqual(
  runtime.normalizeQuizExplanation({ short: 'Коротко', full: 'Полное объяснение' }),
  { short: 'Коротко', full: 'Полное объяснение' },
  'distinct short and full teaching explanations must both survive',
);
assert.deepEqual(
  runtime.normalizeQuizExplanation({ short: 'Одинаково', full: 'Одинаково' }),
  { short: 'Одинаково', full: '' },
  'duplicate short/full copy must not be rendered twice',
);
assert.deepEqual(
  runtime.normalizeQuizExplanation({ full: 'Только полное' }),
  { short: '', full: 'Только полное' },
  'full-only structured explanation must remain visible',
);

console.log('✅ native article quiz score/explanation parity contract passed');
