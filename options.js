import { getSettings, setSettings } from './src/settings.js';
import { countTokensApi } from './src/tokens.js';

const $ = (id) => document.getElementById(id);
const status = (msg) => { $('status').textContent = msg; };

const settings = await getSettings();
document.querySelector(`input[name="mode"][value="${settings.mode}"]`).checked = true;
document.querySelector(`input[name="level"][value="${settings.level}"]`).checked = true;
$('condense').value = String(settings.condense);
$('apiKey').value = settings.apiKey;
$('exactCount').checked = settings.exactCount;

$('save').onclick = async () => {
  await setSettings({
    mode: document.querySelector('input[name="mode"]:checked').value,
    level: document.querySelector('input[name="level"]:checked').value,
    condense: Number($('condense').value),
    apiKey: $('apiKey').value.trim(),
    exactCount: $('exactCount').checked,
  });
  status('Saved.');
};

$('test').onclick = async () => {
  const apiKey = $('apiKey').value.trim();
  if (!apiKey) return status('Enter an API key first.');
  status('Testing...');
  try {
    const { llmCompressionModel } = await (await fetch(chrome.runtime.getURL('models.json'))).json();
    await countTokensApi('ping', { apiKey, model: llmCompressionModel });
    status('Connection OK.');
  } catch (err) {
    status(err.message);
  }
};
