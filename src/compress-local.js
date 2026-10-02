// Local rule-based compressor. Pure function, no I/O. Rules live in rules.js.
import { getRules, isSeparatorLine } from './rules.js';

const PH_OPEN = '';
const PH_CLOSE = '';
const PH_RE = new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, 'g');

// Spans that must survive untouched. Order matters: code first.
const PROTECTED = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /https?:\/\/[^\s)>\]]+/g,
  /"[^"\n]*"/g,
  /“[^”\n]*”/g,
];

const MAX_PASSES = 3;

function protect(text) {
  const spans = [];
  let out = text;
  for (const re of PROTECTED) {
    out = out.replace(re, (m) => {
      spans.push(m);
      return `${PH_OPEN}${spans.length - 1}${PH_CLOSE}`;
    });
  }
  return { out, spans };
}

function restore(text, spans) {
  let out = text;
  // Spans can contain placeholders of earlier spans, so unwrap until none remain.
  while (PH_RE.test(out)) {
    PH_RE.lastIndex = 0;
    out = out.replace(PH_RE, (_, i) => spans[Number(i)]);
  }
  PH_RE.lastIndex = 0;
  return out;
}

function compressLine(line, rules) {
  const indent = line.match(/^\s*/)[0];
  let body = line.slice(indent.length);
  const wasUpper = /^[A-Z]/.test(body);
  // Deleting one phrase can expose another at a sentence start, so repeat until stable.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = body;
    for (const { re, to } of rules) body = body.replace(re, to);
    if (body === before) break;
  }
  body = body
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=[,;:])/g, '')
    .trimEnd();
  if (wasUpper && /^[a-z]/.test(body)) body = body[0].toUpperCase() + body.slice(1);
  return body ? indent + body : '';
}

// Drop a sentence that repeats an earlier one verbatim (ignoring case); short ones are kept.
function dedupeSentences(lines) {
  const seen = new Set();
  return lines.map((line) => {
    const parts = line.split(/(?<=[.!?])\s+/);
    const kept = parts.filter((s) => {
      const key = s.trim().toLowerCase();
      if (key.length < 25) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return kept.join(' ');
  });
}

export function compressLocal(input, { level = 'standard' } = {}) {
  const rules = getRules(level);
  const { out, spans } = protect(input.replace(/\r\n?/g, '\n'));
  const body = out.split('\n').filter((l) => !isSeparatorLine(l));
  const lines = dedupeSentences(body.map((l) => compressLine(l, rules)));
  const deduped = lines.filter((l, i) => !(l && l === lines[i - 1]));
  const joined = deduped.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return restore(joined, spans);
}
