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

### Added from other token-reduction projects
Ideas reimplemented from scratch (no code copied); all three upstream projects are MIT-licensed.
- **JSON compaction** (from [ZON-Format/zon-TS](https://github.com/ZON-Format/zon-TS)): JSON in a prompt, either the whole selection or a fenced block, is minified. Aggressive also rewrites arrays of uniform flat objects as a header plus value rows (`[3]{id,name}:` then one line per object), quoting any cell that could be misread. Output is our own plain format, not ZON. Invalid JSON is left alone.
- **Duplicate paragraph removal** (from [Emmimal/prompt-pruning-layer](https://github.com/Emmimal/prompt-pruning-layer)): a paragraph of 40+ characters that repeats an earlier one (ignoring case and spacing) is dropped. The upstream's expired-tool-output and REF/DEFINE passes need structured chat messages, so they are not included.
- **Condense long text** (from [Huzaifa785/context-compressor](https://github.com/Huzaifa785/context-compressor)): opt-in on the settings page. For prose of 600+ characters, keeps the highest-scoring sentences (TF-IDF plus position and length bias) in original order. Lists, headings, code, numbers, negations and conditionals are always kept. Lossy, so re-read the result.
- Not used: [jfrog/boost](https://github.com/jfrog/boost). It filters shell-command output rather than prompt text, and its license is All Rights Reserved.

## Privacy
- Only network host: `api.anthropic.com`, and only in LLM mode / exact-count / test connection.
- API key lives in `chrome.storage.local` only. User text is never logged.

## Develop
- `npm test` runs unit tests (Node 20+, no dependencies).
- Edit `models.json` to update the model list and the Haiku compression model.
- Limits: closed shadow roots and cross-origin iframes without focus may not be reachable; restricted pages (`chrome://`, Web Store) cannot be scripted.
