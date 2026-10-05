// Drops repeated paragraphs, keeping the first copy. Idea from Emmimal/prompt-pruning-layer (MIT),
// pass 2 "duplicate context elimination": same content after whitespace/case normalisation.
// Reimplemented from scratch. Its other passes (expired tool output, REF/DEFINE restoration)
// need structured chat messages, which a text selection does not have.
const MIN_LENGTH = 40; // short paragraphs ("Thanks", "Example:") are often legitimately repeated

const normalise = (p) => p.toLowerCase().replace(/\s+/g, ' ').trim();

export function dedupeParagraphs(text) {
  const seen = new Set();
  const out = [];
  for (const para of text.split(/\n{2,}/)) {
    const key = normalise(para);
    if (key.length >= MIN_LENGTH) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(para);
  }
  return out.join('\n\n');
}
