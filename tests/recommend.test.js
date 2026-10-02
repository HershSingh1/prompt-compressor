import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommend } from '../src/recommend.js';
import { estimateTokens } from '../src/tokens.js';

const { platforms } = JSON.parse(readFileSync(new URL('../models.json', import.meta.url)));
const byPlatform = (recs, name) => recs.find((r) => r.platform === name).model;

test('short simple task -> fast tier on every platform', () => {
  const recs = recommend('Translate this to French', 6, platforms);
  assert.equal(recs.length, platforms.length);
  for (const r of recs) assert.equal(r.model.tier, 'fast');
});

test('code plus reasoning cues -> stronger than fast', () => {
  const text = 'Debug and refactor this, analyze the root cause:\n```js\nconst a = 1;\n```';
  const recs = recommend(text, 40, platforms);
  assert.ok(['strong', 'frontier'].includes(byPlatform(recs, 'Claude').tier));
});

test('hardest input reaches the frontier tier on every platform', () => {
  const text = 'Debug, refactor and analyze the security trade-offs step by step:\n```js\nconst a = 1;\n```';
  for (const r of recommend(text, 9000, platforms)) assert.equal(r.model.tier, 'frontier');
});

test('platform missing a tier falls back to the nearest model', () => {
  const sparse = [{ name: 'X', hosts: [], models: [{ name: 'small', tier: 'fast' }, { name: 'big', tier: 'strong' }] }];
  const text = 'Debug, refactor and analyze the security trade-offs step by step:\n```js\nconst a = 1;\n```';
  assert.equal(recommend(text, 9000, sparse)[0].model.name, 'big');
  assert.equal(recommend('Translate this', 3, sparse)[0].model.name, 'small');
});

test('estimateTokens: empty is 0, prose ~ chars/4', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd efgh ijkl mnop'), 5);
});
