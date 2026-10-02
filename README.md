# Prompt Compressor

Chrome extension (Manifest V3, vanilla JS, no build step) that shrinks selected prompt text, shows token savings, and recommends a Claude model.

## Install
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** and pick this folder.

## Use
- Select text (or click into a field to compress all of it), then press **Alt+Shift+C** or right-click → **Compress prompt**.
- Works in `<textarea>`, `<input>` (text-like types) and `contenteditable`. Replacement goes through the browser's edit pipeline, so Ctrl+Z restores the original.
- On read-only page text, the compressed version is shown in a toast with a Copy button.
- Remap the shortcut at `chrome://extensions/shortcuts`; open settings by clicking the toolbar icon.

## Modes
- **Local rules** (default): offline, strips filler/politeness, collapses whitespace and duplicate lines; code, inline code, URLs and quoted strings are left untouched.
- **Claude Haiku API** (optional): rewrites with Haiku; falls back to local rules on any error. Optional exact token counts via `count_tokens`.

## Privacy
- Only network host: `api.anthropic.com`, and only in LLM mode / exact-count / test connection.
- API key lives in `chrome.storage.local` only. User text is never logged.

## Develop
- `npm test` runs unit tests (Node 20+, no dependencies).
- Edit `models.json` to update the model list and the Haiku compression model.
- Limits: closed shadow roots and cross-origin iframes without focus may not be reachable; restricted pages (`chrome://`, Web Store) cannot be scripted.
