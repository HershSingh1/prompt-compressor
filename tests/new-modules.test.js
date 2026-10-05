import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressLocal } from '../src/compress-local.js';
import { compactJson, compactJsonIn } from '../src/json-compact.js';
import { dedupeParagraphs } from '../src/dedupe.js';
import { condense } from '../src/extractive.js';
import { estimateTokens } from '../src/tokens.js';

const rows = JSON.stringify([
  { id: 1, name: 'Blue Lake', sunny: true },
  { id: 2, name: 'Ridge, Overlook', sunny: false },
  { id: 3, name: 'true', sunny: true },
], null, 2);

test('json: standard minifies, data is identical', () => {
  const out = compactJson(rows);
  assert.ok(out.length < rows.length);
  assert.deepEqual(JSON.parse(out), JSON.parse(rows));
});

test('json: aggressive turns uniform arrays into a table with quoted ambiguous cells', () => {
  const out = compactJson(rows, { level: 'aggressive' });
  assert.equal(out, '[3]{id,name,sunny}:\n1,Blue Lake,true\n2,"Ridge, Overlook",false\n3,"true",true');
  assert.ok(estimateTokens(out) < estimateTokens(JSON.stringify(JSON.parse(rows))));
});

test('json: non-uniform arrays stay minified; invalid JSON is untouched', () => {
  const mixed = '[{"a":1},{"b":2}]';
  assert.equal(compactJson(mixed, { level: 'aggressive' }), mixed);
  assert.equal(compactJson('{"a": 1,}'), null);
  assert.equal(compactJson('[note] do this'), null);
});

test('json: fenced block inside a prompt is compacted, prose around it is kept', () => {
  const src = 'Summarise:\n```json\n{\n  "a": 1,\n  "b": [1, 2]\n}\n```\nthanks';
  assert.equal(compactJsonIn(src), 'Summarise:\n```json\n{"a":1,"b":[1,2]}\n```\nthanks');
});

test('json: compressLocal handles whole-JSON input and fenced JSON without damaging values', () => {
  assert.equal(compressLocal('{ "msg": "please  keep   this", "n": 1 }'), '{"msg":"please  keep   this","n":1}');
  const out = compressLocal('Please review this:\n```json\n{ "a": "very  big" }\n```');
  assert.ok(out.includes('{"a":"very  big"}'));
});

test('dedupe: repeated long paragraph is dropped, short ones and first copy kept', () => {
  const p = 'The deployment must finish before the cache is warmed, otherwise requests fail.';
  assert.equal(dedupeParagraphs(`${p}\n\nOK\n\n${p.toUpperCase()}\n\nOK`), `${p}\n\nOK\n\nOK`);
});

test('dedupe: blank lines inside a code fence do not split it', () => {
  const code = '```\nconst a = 1;\n\nconst b = 2;\n```';
  assert.equal(compressLocal(`${code}\n\nNext step is the review of the above code block.`).startsWith(code), true);
});

const topics = ['cache', 'queue', 'router', 'parser', 'scheduler', 'gateway', 'indexer', 'planner', 'monitor', 'broker', 'loader', 'writer'];
const prose = topics.map((t, i) =>
  `Part ${t} explains how the ${t} component handles traffic spikes with ${['batching', 'sharding', 'pooling'][i % 3]} during peak hours.`).join(' ')
  + ' The service must not drop messages. Latency matters a lot for every single user of the platform here.';

test('condense: off by default and for short text', () => {
  assert.equal(condense(prose, 0), prose);
  assert.equal(condense('Short text. Only two sentences here.', 0.5), 'Short text. Only two sentences here.');
});

test('condense: shrinks long prose, keeps first/last sentence and constraint sentences', () => {
  const out = condense(prose, 0.6);
  assert.ok(out.length < prose.length);
  assert.ok(out.startsWith('Part cache'));
  assert.ok(out.includes('must not drop messages'));
  assert.ok(out.endsWith('here.'));
});

test('condense: lists and headings pass through whole', () => {
  const src = `# Title\n- keep this item\n- and this one\n${prose}`;
  const out = condense(src, 0.5);
  assert.ok(out.startsWith('# Title\n- keep this item\n- and this one\n'));
});

test('condense: via compressLocal is opt-in and never grows text', () => {
  assert.equal(compressLocal(prose), compressLocal(prose, { condenseRatio: 0 }));
  assert.ok(compressLocal(prose, { condenseRatio: 0.6 }).length < compressLocal(prose).length);
});
