# Prompt Compressor
Chrome extension (Manifest V3, vanilla JS, no build step).
Acts on selected text / text at cursor in any page.
Features: shrink prompt text, show token savings, recommend a model.
Rules: no external network calls except api.anthropic.com in LLM mode.
Store API key in chrome.storage.local only. Never log user text.
Keep model list in models.json so it is easy to update.
