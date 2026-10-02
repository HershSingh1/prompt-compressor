import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressLocal } from '../src/compress-local.js';
import { estimateTokens } from '../src/tokens.js';

const std = (s) => compressLocal(s);
const agg = (s) => compressLocal(s, { level: 'aggressive' });

// --- worked examples from prompt_token_efficiency_list.txt (section 16) ---

test('example: polite summary request', () => {
  const out = std('Hello! I was wondering if you could please help me by writing a short summary of the following article. I would really appreciate it if you could keep it brief and to the point. Thank you so much!');
  assert.ok(!/hello|wondering|appreciate|thank|please|really/i.test(out), out);
  assert.ok(/short summary/.test(out) && /brief/.test(out), out);
});

test('example: persona fluff', () => {
  const out = std('I want you to act as a highly experienced and professional career coach with many years of experience. I would like you to review my resume and provide me with detailed and constructive feedback on how I can make it better.');
  assert.ok(out.startsWith('Act as a career coach.'), out);
  assert.ok(!/I want you|I would like you|years of experience/.test(out), out);
});

test('example: audience / take into consideration', () => {
  const out = std('In order to make sure that the response is as helpful as possible, I would like you to take into consideration the fact that the audience is made up of beginners.');
  assert.ok(/^To ensure/.test(out) && /consider/.test(out) && !/I would like you/.test(out), out);
});

test('example: length and tone labels', () => {
  const out = std('The length should be around 500 words.');
  assert.equal(out, 'Length: ~500 words.');
});

test('every example is shorter in tokens', () => {
  for (const s of [
    'Could you please kindly provide me with a summary of the following text? Thanks in advance!',
    'Due to the fact that the file is large, make use of a number of tools in order to read it.',
  ]) assert.ok(estimateTokens(std(s)) < estimateTokens(s), s);
});

// --- section 15: DO NOT CUT ---

test('keeps negations, quantifiers, conditionals, modals, numbers', () => {
  const src = 'Do not use external libraries. Only list the files. You must return at least 3 and at most 5 items unless the list is empty. If the input is empty, never guess. It should not exceed 100 words.';
  for (const lvl of [std, agg]) {
    const out = lvl(src);
    for (const w of ['not', 'Only', 'must', 'at least 3', 'at most 5', 'unless', 'If', 'never', 'should', '100']) {
      assert.ok(out.includes(w), `${w} missing from: ${out}`);
    }
  }
});

test('keeps reasoning cue "think step by step"', () => {
  assert.ok(std('Think step by step. Solve 12 x 7.').includes('Think step by step'));
});

test('does not mangle ordinary uses of mapped words', () => {
  assert.equal(std('What can you do about it?'), 'What can you do about it?');
  assert.equal(std('Write about the very idea of freedom.'), 'Write about the idea of freedom.');
});

// --- mechanics ---

test('fixes a/an after deleting an intensifier', () => {
  assert.equal(std('Write an extremely long essay.'), 'Write a long essay.');
  assert.equal(std('Describe a very old house.'), 'Describe an old house.');
});

test('capitalises the next word after a deleted sentence opener', () => {
  assert.equal(std('Fix the bug. Furthermore, the tests fail.'), 'Fix the bug. The tests fail.');
});

test('capitalises after a deleted "Could you please" mid-line', () => {
  assert.equal(std('I need help. Could you please take a look at this?'), 'I need help. Take a look at this?');
});

test('removes decorative separators and bold markers', () => {
  assert.equal(std('Task: **summarize**\n=====\nText follows'), 'Task: summarize\nText follows');
});

test('drops a repeated long sentence', () => {
  const s = 'Always answer in valid JSON only. Be brief. Always answer in valid JSON only.';
  assert.equal(std(s), 'Always answer in valid JSON only. Be brief.');
});

test('numbers and ranges', () => {
  assert.equal(std('Use between 100 and 200 words, about 50 percent shorter.'), 'Use 100-200 words, about 50% shorter.');
});

test('protected spans are untouched at both levels', () => {
  const src = 'Please explain `in order to` and "very really maybe" at https://x.io/in-order-to.';
  for (const lvl of [std, agg]) {
    const out = lvl(src);
    assert.ok(out.includes('`in order to`') && out.includes('"very really maybe"') && out.includes('https://x.io/in-order-to'), out);
  }
});

// --- levels ---

test('aggressive drops hedges that standard keeps', () => {
  const src = 'Maybe use a very big font, if possible.';
  assert.ok(/maybe/i.test(std(src)) && /if possible/.test(std(src)));
  const out = agg(src);
  assert.ok(!/maybe|if possible/i.test(out) && /huge/.test(out), out);
});

test('aggressive output is never longer in tokens than standard', () => {
  const src = 'I think it is very important to note that we should probably use a very big margin, if you could.';
  assert.ok(estimateTokens(agg(src)) <= estimateTokens(std(src)));
});

test('idempotent: compressing twice changes nothing more', () => {
  const src = 'Could you please, in order to save time, make use of a number of tools? Thanks so much!';
  for (const lvl of [std, agg]) assert.equal(lvl(lvl(src)), lvl(src));
});
