// Compacts JSON embedded in a prompt. Idea from ZON-Format/zon-TS (MIT): JSON repeats every key
// per row, so uniform arrays of flat objects are cheaper as a header plus value rows.
// Reimplemented from scratch; the output is our own plain format, not ZON.
import { estimateTokens } from './tokens.js';

const FENCE_RE = /```(json|jsonc|javascript|js)?[ \t]*\n([\s\S]*?)\n?```/gi;

function parseJson(text) {
  const t = text.trim();
  if (!/^[[{]/.test(t)) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch {
    return { ok: false };
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isScalar = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

// Strings that would read as another type, or break the row, are JSON-quoted.
function cell(v) {
  if (typeof v !== 'string') return JSON.stringify(v);
  const risky = v === '' || v !== v.trim() || /[,\n\r"]/.test(v) || /^(true|false|null|-?\d[\d.eE+-]*)$/.test(v);
  return risky ? JSON.stringify(v) : v;
}

// Array of 2+ objects with identical flat keys -> "[n]{k1,k2}:" then one row per object.
function toTable(arr) {
  if (arr.length < 2 || !arr.every(isPlainObject)) return null;
  const keys = Object.keys(arr[0]);
  if (!keys.length) return null;
  const same = arr.every((o) => {
    const k = Object.keys(o);
    return k.length === keys.length && keys.every((key, i) => k[i] === key) && keys.every((key) => isScalar(o[key]));
  });
  if (!same) return null;
  const header = `[${arr.length}]{${keys.map((k) => (/^[\w.-]+$/.test(k) ? k : JSON.stringify(k))).join(',')}}:`;
  return [header, ...arr.map((o) => keys.map((k) => cell(o[k])).join(','))].join('\n');
}

// Tables for any uniform array found at the top level or inside top-level object properties.
function tabulate(value) {
  const direct = Array.isArray(value) ? toTable(value) : null;
  if (direct) return direct;
  if (!isPlainObject(value)) return null;
  const parts = [];
  let any = false;
  for (const [k, v] of Object.entries(value)) {
    const table = Array.isArray(v) ? toTable(v) : null;
    if (table) any = true;
    parts.push(table ? `${JSON.stringify(k)}${table}` : `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  }
  return any ? parts.join('\n') : null;
}

export function compactJson(text, { level = 'standard' } = {}) {
  const parsed = parseJson(text);
  if (!parsed.ok) return null;
  const minified = JSON.stringify(parsed.value);
  if (level !== 'aggressive') return minified;
  const table = tabulate(parsed.value);
  return table && estimateTokens(table) < estimateTokens(minified) ? table : minified;
}

// Rewrites fenced JSON blocks, or the whole input when it is JSON. Only ever shortens.
export function compactJsonIn(input, opts) {
  const whole = compactJson(input, opts);
  if (whole !== null) return whole.length < input.trim().length ? whole : input;
  return input.replace(FENCE_RE, (block, lang, body) => {
    if (!lang && !/^\s*[[{]/.test(body)) return block;
    const out = compactJson(body, opts);
    if (out === null) return block;
    const fenced = '```' + (out.startsWith('[') && out.includes(']{') ? '' : lang || 'json') + '\n' + out + '\n```';
    return fenced.length < block.length ? fenced : block;
  });
}
