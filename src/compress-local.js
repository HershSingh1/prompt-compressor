// Local rule-based compressor. Pure function, no I/O.

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

const RULES = [
  [/^(hi|hello|hey)( there)?\b[,!.]?\s*/i, ''],
  [/(^|[.!?]\s+)(could|can|would|will) you (please |kindly )?/gi, '$1'],
  [/\bplease,?\s*/gi, ''],
  [/\bkindly\s+/gi, ''],
  [/\bI (would like|want|need) you to\s+/gi, ''],
  [/\bI was wondering if you could\s+/gi, ''],
  [/\bit is important to note that\s+/gi, ''],
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'now'],
  [/\ba number of\b/gi, 'several'],
  [/\bmake sure that\b/gi, 'ensure'],
  [/\bis able to\b/gi, 'can'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bin the event that\b/gi, 'if'],
  [/\bfor the purpose of\b/gi, 'for'],
  [/\b(basically|essentially|literally|actually|really|simply|very)\s+/gi, ''],
  [/\s*\b(thanks|thank you)( so much| very much| in advance)?[.!]*\s*$/gi, ''],
];

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

function compressLine(line) {
  const indent = line.match(/^\s*/)[0];
  let body = line.slice(indent.length);
  const wasUpper = /^[A-Z]/.test(body);
  for (const [re, rep] of RULES) body = body.replace(re, rep);
  body = body
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trimEnd();
  if (wasUpper && /^[a-z]/.test(body)) body = body[0].toUpperCase() + body.slice(1);
  return body ? indent + body : '';
}

export function compressLocal(input) {
  const { out, spans } = protect(input.replace(/\r\n?/g, '\n'));
  const lines = out.split('\n').map(compressLine);
  const deduped = lines.filter((l, i) => !(l && l === lines[i - 1]));
  const joined = deduped.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return restore(joined, spans);
}
