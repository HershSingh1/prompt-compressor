import { compressLocal } from './src/compress-local.js';
import { compressWithHaiku } from './src/compress-llm.js';
import { estimateTokens, countTokensApi } from './src/tokens.js';
import { recommend } from './src/recommend.js';
import { getSettings } from './src/settings.js';

const MENU_ID = 'pc-compress';
const busy = new Set();
let modelsCache;

async function loadModels() {
  modelsCache ??= await (await fetch(chrome.runtime.getURL('models.json'))).json();
  return modelsCache;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: 'Compress prompt', contexts: ['selection', 'editable'] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id != null) run(tab.id);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'compress-selection') return;
  tab ??= (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab?.id != null) run(tab.id);
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

function inFrame(tabId, frameId, func, args = []) {
  return chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, func, args });
}

async function run(tabId) {
  if (busy.has(tabId)) return;
  busy.add(tabId);
  try {
    // Some pages embed frames Chrome refuses to script; fall back to the top frame only.
    let target = { tabId, allFrames: true };
    try {
      await chrome.scripting.executeScript({ target, files: ['content.js'] });
    } catch {
      target = { tabId };
      await chrome.scripting.executeScript({ target, files: ['content.js'] });
    }
    const results = await chrome.scripting.executeScript({ target, func: () => window.__pc.grab() });
    const hits = results.filter((r) => r.result);
    const pick = hits.find((r) => r.result.kind === 'editable') ?? hits[0];
    const show = (frameId, payload) => inFrame(tabId, frameId, (p) => window.__pc.toast(p), [payload]);

    if (!pick) {
      await show(0, { lines: ['Prompt Compressor: select text or click into a text field first.'], tone: 'warn' });
      return;
    }

    const { frameId } = pick;
    const { kind, text } = pick.result;
    const outcome = await compress(text);

    if (outcome.afterTokens >= outcome.beforeTokens) {
      await show(frameId, { lines: ['Already compact: no token savings found.', ...outcome.notes], tone: 'warn' });
      return;
    }

    const saved = outcome.beforeTokens - outcome.afterTokens;
    const pct = Math.round((saved / outcome.beforeTokens) * 100);
    const approx = outcome.exact ? '' : '~';
    const { models } = await loadModels();
    const rec = recommend(outcome.output, outcome.afterTokens, models);
    const lines = [
      `Saved ${approx}${saved} tokens (${pct}%): ${approx}${outcome.beforeTokens} → ${approx}${outcome.afterTokens}`,
      `Suggested model: ${rec.model.name} (${rec.reason})`,
      ...outcome.notes,
    ];

    if (kind === 'readonly') {
      await show(frameId, { lines: [...lines, 'Page text is read-only; compressed version:'], text: outcome.output });
      return;
    }
    const [applied] = await inFrame(tabId, frameId, (t) => window.__pc.apply(t), [outcome.output]);
    if (applied?.result) await show(frameId, { lines });
    else await show(frameId, { lines: ['Text changed while compressing; nothing was replaced.'], tone: 'warn' });
  } catch (err) {
    // Message only; it never contains user text.
    console.error('Prompt Compressor:', err.message);
  } finally {
    busy.delete(tabId);
  }
}

async function compress(text) {
  const settings = await getSettings();
  const { llmCompressionModel } = await loadModels();
  const notes = [];
  const beforeEstimate = estimateTokens(text);
  let output = compressLocal(text);

  if (settings.mode === 'llm') {
    if (!settings.apiKey) {
      notes.push('LLM mode needs an API key (see options); used local rules.');
    } else {
      try {
        const llm = await compressWithHaiku(text, {
          apiKey: settings.apiKey,
          model: llmCompressionModel,
          estimatedTokens: beforeEstimate,
        });
        if (estimateTokens(llm) <= estimateTokens(output)) output = llm;
        else notes.push('Local rules beat the LLM result; kept the shorter one.');
      } catch (err) {
        notes.push(`${err.message}; used local rules.`);
      }
    }
  }

  let beforeTokens = beforeEstimate;
  let afterTokens = estimateTokens(output);
  let exact = false;
  if (settings.exactCount && settings.apiKey) {
    try {
      const opts = { apiKey: settings.apiKey, model: llmCompressionModel };
      [beforeTokens, afterTokens] = await Promise.all([countTokensApi(text, opts), countTokensApi(output, opts)]);
      exact = true;
    } catch (err) {
      notes.push(`${err.message}; showing estimates.`);
    }
  }
  return { output, beforeTokens, afterTokens, exact, notes };
}
