import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressLocal } from '../src/compress-local.js';

test('removes politeness and filler', () => {
  assert.equal(
    compressLocal('Hello there, could you please summarize this article in order to save time? Thanks!'),
    'Summarize this article to save time?'
  );
});

test('does not touch mid-sentence "can you"', () => {
  assert.equal(compressLocal('What can you do?'), 'What can you do?');
});

test('protects code blocks, inline code, URLs and quotes', () => {
  const src = 'Please run `very  simple` and\n```\nplease   keep   this\n```\nsee https://x.io/please and "really   quoted".';
  const out = compressLocal(src);
  assert.ok(out.includes('`very  simple`'));
  assert.ok(out.includes('please   keep   this'));
  assert.ok(out.includes('https://x.io/please'));
  assert.ok(out.includes('"really   quoted"'));
  assert.ok(out.startsWith('Run'));
});

test('collapses blank lines and duplicate lines', () => {
  assert.equal(compressLocal('a\n\n\n\nb\nb\nb'), 'a\n\nb');
});

test('never grows the text', () => {
  const src = 'Refactor the parser to be streaming.';
  assert.ok(compressLocal(src).length <= src.length);
});
