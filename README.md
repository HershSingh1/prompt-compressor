# Prompt Compressor

Chrome extension (Manifest V3, vanilla JS, no build step) that shrinks selected prompt text, shows token savings, and recommends a Claude model.

## Install
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** and pick this folder.

## Use
- Select text (or click into a field to compress all of it), then press **Alt+Shift+C** or right-click → **Compress prompt**.
- Works in `<textarea>`, `<input>` (text-like types) and `contenteditable`. Replacement goes through the browser's edit pipeline, so Ctrl+Z restores the original.
- On read-only page text, the compressed version is shown in a toast with a Copy button.
- Chrome may not assign the suggested Alt+Shift+C (it skips shortcuts that conflict). If nothing happens, open `chrome://extensions/shortcuts`, find **Compress the selected prompt text**, and set it yourself. The right-click menu works without a shortcut.
- Open settings by clicking the toolbar icon.
- Google Docs is not supported: it renders text on a canvas, so the extension can't read or replace it.

## Recommendation badge
On chatgpt.com, claude.ai and gemini.google.com, highlighting text (15+ characters) shows a badge with the token estimate, possible local savings, and a suggested model for that platform. Nothing changes until you press the shortcut. After compressing, the toast lists a suggestion for Claude, ChatGPT and Gemini. These are the only sites with an always-on content script; everywhere else the extension injects only when you trigger it.

Model lists live in `models.json` (one list per platform, mapped to fast/balanced/strong/frontier tiers, with the plan needed). Edit it when models change.

## Modes
- **Local rules** (default): offline, driven by `src/rules.js` (built from `prompt_token_efficiency_list.txt`). Removes politeness and filler, swaps wordy phrases for short ones ("in order to" -> "to"), shortens instruction phrases and adds labels ("The tone should be" -> "Tone:"), collapses redundant pairs, numbers and ranges, whitespace, separators and repeated sentences. Code, inline code, URLs and quoted strings are left untouched, and negations, quantifiers, conditionals, modals and numbers are never removed.
  - **Standard** (default): meaning-preserving rules only.
  - **Aggressive** (settings page): also drops hedges ("maybe", "I think", "if possible"), swaps "very big" for "huge", and abbreviates units and dates. Saves more but can shift nuance, so re-read the result.
- **Claude Haiku API** (optional): rewrites with Haiku; falls back to local rules on any error. Optional exact token counts via `count_tokens`.

## Privacy
- Only network host: `api.anthropic.com`, and only in LLM mode / exact-count / test connection.
- API key lives in `chrome.storage.local` only. User text is never logged.

## Develop
- `npm test` runs unit tests (Node 20+, no dependencies).
- Edit `models.json` to update the model list and the Haiku compression model.
- Limits: closed shadow roots and cross-origin iframes without focus may not be reachable; restricted pages (`chrome://`, Web Store) cannot be scripted.
