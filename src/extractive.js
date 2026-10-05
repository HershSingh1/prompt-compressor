// Optional lossy condensing of long prose. Idea from Huzaifa785/context-compressor (MIT),
// "extractive" strategy: score sentences by TF-IDF plus position and length bias, keep the
// best ones up to a target ratio, in original order. Reimplemented from scratch, no dependencies.

const MIN_CHARS = 600; // shorter inputs are left alone
const POSITION_BIAS = 0.2;
const LENGTH_BIAS = 0.1;

const STOP = new Set(('a an and are as at be by for from has have he in is it its of on that the to was were will with ' +
  'would could should this these they them their there where when why how what which who i me my we our you your she her ' +
  'him his am been being do does did doing may might must can or but if so than then too very').split(' '));

const words = (s) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 2 && !STOP.has(w));

// Sentences with these are never dropped: lists, headings, constraints, numbers and protected spans.
const STRUCTURE = /^\s*([-*#>|]|\d+[.)])/;
const MUST_KEEP = /\b(not|never|no|only|must|always|at least|at most|exactly|if|unless)\b|\d/i;

export function condense(text, ratio, { isProtected = () => false } = {}) {
  if (!(ratio > 0 && ratio < 1) || text.length < MIN_CHARS) return text;

  // Units are sentences within prose lines; structured lines pass through whole.
  const units = [];
  text.split('\n').forEach((line, li, lines) => {
    if (!line.trim() || STRUCTURE.test(line) || isProtected(line)) {
      units.push({ text: line, fixed: true, nl: li < lines.length - 1 });
      return;
    }
    const sentences = line.split(/(?<=[.!?])\s+/);
    sentences.forEach((s, si) => {
      const edge = (li === 0 && si === 0) || (li === lines.length - 1 && si === sentences.length - 1);
      units.push({
        text: s,
        fixed: edge || MUST_KEEP.test(s) || isProtected(s),
        sentence: true,
        first: si === 0,
        join: si < sentences.length - 1 ? ' ' : li < lines.length - 1 ? '\n' : '',
      });
    });
  });

  const cands = units.filter((u) => u.sentence);
  if (cands.length < 4) return text;

  const docs = cands.map((u) => words(u.text));
  const df = new Map();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  const raw = docs.map((d) => {
    if (!d.length) return 0;
    const tf = new Map();
    for (const w of d) tf.set(w, (tf.get(w) || 0) + 1);
    let s = 0;
    for (const [w, c] of tf) s += (c / d.length) * Math.log(cands.length / df.get(w));
    return s;
  });
  const max = Math.max(...raw) || 1;
  cands.forEach((u, i) => {
    const lenScore = 1 - Math.min(Math.abs(u.text.length - 100) / 200, 1); // favours mid-length sentences
    u.score = raw[i] / max + (u.first ? POSITION_BIAS : 0) + LENGTH_BIAS * lenScore;
  });

  const total = cands.reduce((n, u) => n + u.text.length, 0);
  let kept = cands.filter((u) => u.fixed).reduce((n, u) => n + u.text.length, 0);
  for (const u of cands.filter((c) => !c.fixed).sort((a, b) => b.score - a.score)) {
    if (kept >= total * ratio) break;
    u.keep = true;
    kept += u.text.length;
  }

  let out = '';
  for (const u of units) {
    if (u.fixed === true && !u.sentence) out += u.text + (u.nl ? '\n' : '');
    else if (u.fixed || u.keep) out += u.text + u.join;
    else if (u.join === '\n') out += '\n';
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
