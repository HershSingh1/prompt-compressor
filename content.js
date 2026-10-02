// Loaded on the AI sites via manifest content_scripts, and injected on demand elsewhere by background.js.
// Reads/replaces text and shows UI. Never logs text and makes no network calls.
(() => {
  if (window.__pc) return;

  const TEXT_INPUT_TYPES = ['', 'text', 'search', 'url', 'email', 'tel'];
  let target = null;

  function deepActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }

  function editingHost(el) {
    let host = el;
    while (host.parentElement && host.parentElement.isContentEditable) host = host.parentElement;
    return host;
  }

  const isTextField = (el) =>
    el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_INPUT_TYPES.includes(el.type)));

  // Only text the user has actually highlighted; used for the recommendation badge.
  function peek() {
    const el = deepActiveElement();
    const text = isTextField(el)
      ? el.value.slice(el.selectionStart, el.selectionEnd)
      : window.getSelection()?.toString() ?? '';
    return text.trim().length >= 15 ? text : null;
  }

  function grab() {
    target = null;
    const el = deepActiveElement();

    if (isTextField(el)) {
      const { selectionStart: start, selectionEnd: end } = el;
      const partial = start !== end;
      const text = partial ? el.value.slice(start, end) : el.value;
      if (!text.trim()) return null;
      target = { kind: 'field', el, start: partial ? start : 0, end: partial ? end : el.value.length, text };
      return { kind: 'editable', text };
    }

    if (el && el.isContentEditable) {
      const host = editingHost(el);
      const sel = window.getSelection();
      if (sel.rangeCount && !sel.isCollapsed && host.contains(sel.anchorNode)) {
        const text = sel.toString();
        target = { kind: 'ce', host, range: sel.getRangeAt(0).cloneRange() };
        return { kind: 'editable', text };
      }
      const text = host.innerText;
      if (!text.trim()) return null;
      const range = document.createRange();
      range.selectNodeContents(host);
      target = { kind: 'ce', host, range };
      return { kind: 'editable', text };
    }

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return { kind: 'readonly', text: sel.toString() };
    return null;
  }

  function apply(text) {
    if (!target) return false;
    if (target.kind === 'field') {
      const { el, start, end } = target;
      if (el.value.slice(start, end) !== target.text) return false; // changed while compressing
      el.focus();
      el.setSelectionRange(start, end);
      // execCommand keeps native undo and fires input events frameworks listen for.
      if (!document.execCommand('insertText', false, text)) {
        el.setRangeText(text, start, end, 'end');
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      }
      return true;
    }
    const { host, range } = target;
    host.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    if (!document.execCommand('insertText', false, text)) {
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      host.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
    return true;
  }

  const STYLE = `
    :host { all: initial; }
    .box { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; max-width: 360px;
      font: 13px/1.4 system-ui, sans-serif; color: #1f1f1f; background: #fff; border: 1px solid #d0d0d0;
      border-left: 4px solid #2e7d32; border-radius: 6px; padding: 10px 12px; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
    .box.warn { border-left-color: #ed8b00; } .box.error { border-left-color: #c62828; } .box.info { border-left-color: #1a73e8; }
    .box.passive { pointer-events: none; }
    .box p { margin: 0 0 4px; } .box p:last-child { margin: 0; }
    pre { margin: 6px 0; max-height: 160px; overflow: auto; white-space: pre-wrap; font: 12px ui-monospace, monospace;
      background: #f5f5f5; padding: 6px; border-radius: 4px; }
    button { font: inherit; cursor: pointer; margin-right: 6px; }
    @media (prefers-color-scheme: dark) { .box { background: #2b2b2b; color: #eee; border-color: #555; } pre { background: #1e1e1e; } }`;

  const timers = {};
  function show(id, { lines, tone = 'ok', text }, { ttl = 7000, passive = false } = {}) {
    document.getElementById(id)?.remove();
    clearTimeout(timers[id]);
    const host = document.createElement('div');
    host.id = id;
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const box = document.createElement('div');
    box.className = `box ${tone}${passive ? ' passive' : ''}`;
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line;
      box.append(p);
    }
    if (text) {
      const pre = document.createElement('pre');
      pre.textContent = text;
      const copy = document.createElement('button');
      copy.textContent = 'Copy';
      copy.onclick = () => navigator.clipboard.writeText(text).then(() => (copy.textContent = 'Copied'), () => {});
      box.append(pre, copy);
    }
    if (!passive) {
      const close = document.createElement('button');
      close.textContent = 'Dismiss';
      close.onclick = () => host.remove();
      box.append(close);
    }
    root.append(style, box);
    document.documentElement.append(host);
    if (ttl) timers[id] = setTimeout(() => host.remove(), ttl);
  }

  const toast = (payload) => {
    hideBadge();
    show('__pc-toast', payload, { ttl: payload.text ? 30000 : 7000 });
  };
  // Recommendation shown while text is highlighted; stays until the selection goes away.
  const badge = (payload) => show('__pc-badge', { ...payload, tone: 'info' }, { ttl: 0, passive: true });
  const hideBadge = () => document.getElementById('__pc-badge')?.remove();

  window.__pc = { grab, peek, apply, toast, badge, hideBadge };
})();
