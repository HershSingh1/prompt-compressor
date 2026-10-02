// Rule-based model recommendation. Tiers map to entries in models.json.

const HARD_CUES = /\b(architect\w*|design|refactor\w*|debug\w*|prove|derive|optimi[sz]\w*|trade-?offs?|step[- ]by[- ]step|analy[sz]\w*|root cause|security|migrat\w*)\b/gi;
const SIMPLE_CUES = /\b(summari[sz]e|translate|rewrite|fix grammar|classify|extract|format|rename)\b/i;
const CODE_CUES = /```|^\s*(def|function|class|import|const|let|var)\s|[{};]\s*$/m;

const TIERS = ['fast', 'balanced', 'strong', 'frontier'];

export function recommend(text, tokens, models) {
  let score = 0;
  const reasons = [];

  if (tokens > 8000) { score += 2; reasons.push('very long input'); }
  else if (tokens > 2000) { score += 1; reasons.push('long input'); }

  if (CODE_CUES.test(text)) { score += 1; reasons.push('contains code'); }

  const hard = (text.match(HARD_CUES) || []).length;
  if (hard >= 3) { score += 2; reasons.push('multi-step reasoning cues'); }
  else if (hard >= 1) { score += 1; reasons.push('reasoning cues'); }

  if (tokens < 500 && SIMPLE_CUES.test(text)) { score -= 1; reasons.push('simple task'); }

  const tier = score <= 0 ? 'fast' : score <= 2 ? 'balanced' : score <= 4 ? 'strong' : 'frontier';
  const model = models.find((m) => m.tier === tier) ?? models[TIERS.indexOf(tier)] ?? models[0];
  return { model, reason: reasons.length ? reasons.join(', ') : model.bestFor };
}
