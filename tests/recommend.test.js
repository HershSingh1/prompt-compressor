import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommend } from '../src/recommend.js';
import { estimateTokens } from '../src/tokens.js';

const { models } = JSON.parse(readFileSync(new URL('../models.json', import.meta.url)));

test('short simple task -> fast tier', () => {
  assert.equal(recommend('Translate this to French', 6, models).model.tier, 'fast');
});

test('code plus reasoning cues -> stronger tier', () => {
  const text = 'Debug and refactor this, analyze the root cause:\n```js\nconst a = 1;\n```';
  const tier = recommend(text, 40, models).model.tier;
  assert.ok(['strong', 'frontier'].includes(tier), tier);
});

test('very long input bumps tier up', () => {
  assert.notEqual(recommend('x', 9000, models).model.tier, 'fast');
});

test('estimateTokens: empty is 0, prose ~ chars/4', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd efgh ijkl mnop'), 5);
});
