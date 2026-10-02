// Settings live in chrome.storage.local only (API key included).

const DEFAULTS = { mode: 'local', apiKey: '', exactCount: false };

export async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}
