// Content script for the AI sites only: when text is highlighted, ask the background for a
// recommendation and show it. Highlighted text goes only to this extension's own service worker.
(() => {
  if (window.__pcBadgeOn || !window.__pc) return;
  window.__pcBadgeOn = true;

  let timer;
  let last = null;

  async function check() {
    const text = window.__pc.peek();
    if (!text) {
      last = null;
      window.__pc.hideBadge();
      return;
    }
    if (text === last) return;
    last = text;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'peek', text });
      if (!res || last !== text) return;
      window.__pc.badge({
        lines: [
          `~${res.tokens} tokens${res.saved > 0 ? ` · could save ~${res.saved} locally` : ''}`,
          `Suggested for ${res.rec.platform}: ${res.label} (${res.rec.reason})`,
          res.shortcut ? `Press ${res.shortcut} to compress` : 'Right-click → Compress prompt',
        ],
      });
    } catch {
      // Extension was reloaded or the worker is unavailable; skip the badge.
    }
  }

  for (const ev of ['selectionchange', 'mouseup', 'keyup']) {
    document.addEventListener(ev, () => {
      clearTimeout(timer);
      timer = setTimeout(check, 350);
    }, true);
  }
})();
