// Token counting: local heuristic, plus optional exact count via the API.

export function estimateTokens(text) {
  if (!text) return 0;
  const symbols = (text.match(/[^\p{L}\p{N}\s]/gu) || []).length;
  const charsPerToken = symbols / text.length > 0.15 ? 3 : 4;
  return Math.ceil(text.length / charsPerToken);
}

export async function countTokensApi(text, { apiKey, model }) {
  const res = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: text }] }),
  });
  if (!res.ok) throw new Error(`count_tokens failed (HTTP ${res.status})`);
  const data = await res.json();
  return data.input_tokens;
}
