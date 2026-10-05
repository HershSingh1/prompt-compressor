// Settings live in chrome.storage.local only (API key included).

// condense: 0 = off, else the share of long prose to keep (lossy).
// level: 'standard' keeps meaning; 'aggressive' also drops hedges and swaps stronger words.
const DEFAULTS = { mode: 'local', level: 'standard', condense: 0, apiKey: '', exactCount: false };

export async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}
