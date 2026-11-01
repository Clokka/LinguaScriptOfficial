// LinguaScript — Reader (pillar 1: reading on ANY website)
//
// Injected on demand (Alt+L only for now) via
// chrome.scripting with activeTab, so the extension never asks to "read and
// change all your data on all websites". Every word on the page becomes a
// tappable .ls-word span painted by the ONE Deck (red / orange / green / gold);
// tap → the same word card as YouTube/Netflix → save to flashcards.
// Running it again switches reading off and puts the page back exactly as it was.
(() => {
  const C = window.LSCore;
  if (!C) { console.warn('[LinguaScript] core not loaded'); return; }

  // Toggle: a second injection turns the reader off.
  // (The right-click "save" path injects with __lsReaderSaveOnly set: load, don't toggle.)
  if (window.__lsReader) {
    if (window.__lsReaderSaveOnly) delete window.__lsReaderSaveOnly;
    else window.__lsReader.toggle();
    return;
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'BUTTON', 'CODE', 'PRE', 'KBD', 'SAMP', 'SVG', 'MATH', 'CANVAS', 'IFRAME', 'VIDEO', 'AUDIO', 'TEMPLATE', 'HEAD', 'TITLE',
    // Links and menus stay clickable: reading mode is for prose, not navigation.
    'A', 'NAV', 'FOOTER', 'LABEL']);
  const MAX_WORDS = 25000; // keeps giant pages fast
  const CHUNK = 'ls-read-chunk';
  let on = false, wrapped = 0, observer = null, badge = null;

  // Text nodes worth reading: visible prose, not our own UI, not editable fields.
  function readable(node) {
    const t = node.nodeValue;
    if (!t || !/\p{L}/u.test(t)) return false;
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (SKIP.has(el.tagName)) return false;
      if (el.isContentEditable) return false;
      if (el.classList?.contains(CHUNK) || el.classList?.contains('ls-word')) return false;
      if (el.id && /^ls-/.test(el.id)) return false;
      if (el.getAttribute?.('aria-hidden') === 'true') return false;
    }
    return true;
  }

  // One text node → a span of tappable words. Whitespace and punctuation stay
  // exactly where they were, so the page's layout doesn't move.
  function wrapTextNode(node) {
    const text = node.nodeValue;
    const lang = C.learningLang;
    const frag = document.createDocumentFragment();
    const SEG = new Set(['zh', 'ja', 'th']);
    const base = (lang || '').split('-')[0];
    let count = 0;
    const pushWord = (w) => { frag.appendChild(C.makeWordSpan(w, sentenceAround(text, w), '')); count++; };
    if (SEG.has(base) && typeof Intl !== 'undefined' && Intl.Segmenter) {
      for (const seg of new Intl.Segmenter(base, { granularity: 'word' }).segment(text)) {
        if (seg.isWordLike) pushWord(seg.segment); else frag.appendChild(document.createTextNode(seg.segment));
      }
    } else {
      // Words = runs of letters (with inner ' or -), everything else is kept as text.
      const re = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
      let last = 0, m;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        pushWord(m[0]);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    }
    const chunk = document.createElement('span');
    chunk.className = CHUNK;
    if (onLightBackground(node.parentElement)) chunk.classList.add('ls-light');
    chunk.__lsOriginal = node; // put back on switch-off
    chunk.appendChild(frag);
    node.parentNode.replaceChild(chunk, node);
    return count;
  }

  // Is the text sitting on a light background? Walk up to the first element
  // with a solid background colour (cached per element).
  const bgCache = new WeakMap();
  function onLightBackground(el) {
    const seen = [];
    let light = true; // pages without a background are white
    for (let e = el; e; e = e.parentElement) {
      if (bgCache.has(e)) { light = bgCache.get(e); break; }
      seen.push(e);
      const m = getComputedStyle(e).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
      if (a < 0.5) continue;
      light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
      break;
    }
    seen.forEach((e) => bgCache.set(e, light));
    return light;
  }

  // The sentence a word sits in becomes the flashcard's example line.
  function sentenceAround(text, word) {
    const i = text.indexOf(word);
    if (i < 0) return text.trim().slice(0, 300);
    const start = Math.max(text.lastIndexOf('.', i), text.lastIndexOf('!', i), text.lastIndexOf('?', i)) + 1;
    const ends = ['.', '!', '?'].map((p) => text.indexOf(p, i + word.length)).filter((n) => n >= 0);
    const end = ends.length ? Math.min(...ends) + 1 : text.length;
    return text.slice(start, end).trim().slice(0, 300);
  }

  // Walk a root in small idle slices so a long article never freezes the tab.
  function wrapUnder(root) {
    if (!root || wrapped >= MAX_WORDS) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (readable(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    let i = 0;
    const step = (deadline) => {
      while (i < nodes.length && wrapped < MAX_WORDS && (!deadline || deadline.timeRemaining() > 2)) {
        const n = nodes[i++];
        if (n.parentNode && on) wrapped += wrapTextNode(n);
      }
      if (i < nodes.length && wrapped < MAX_WORDS && on) idle(step);
    };
    idle(step);
  }
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 200 }) : setTimeout(() => fn(null), 16));

  function unwrapAll() {
    document.querySelectorAll('.' + CHUNK).forEach((chunk) => {
      const orig = chunk.__lsOriginal || document.createTextNode(chunk.textContent);
      chunk.parentNode?.replaceChild(orig, chunk);
    });
    wrapped = 0;
  }

  // Small chameleon pill bottom-right: shows reading is on, tap to switch off.
  function showBadge() {
    badge = document.createElement('button');
    badge.id = 'ls-reader-badge';
    badge.type = 'button';
    badge.title = 'LinguaScript reading · tap to stop';
    badge.innerHTML = '<span class="ls-rb-dots"><i style="background:#FF3B30"></i><i style="background:#FF8A00"></i><i style="background:#34C759"></i></span><span>📖</span><span class="ls-rb-x">✕</span>';
    badge.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    document.body.appendChild(badge);
  }

  // Reading on a normal page. Style "Text" (default): the word itself turns
  // red / orange / green, gold glimmers. On a light background the brand hexes
  // are too pale to read, so the chunk gets .ls-light and deeper shades of the
  // same four colours. Style "Rings" (html.ls-style-ring): circles instead.
  const READER_CSS = `
    .${CHUNK} .ls-word { font:inherit !important; padding:0 !important; border-radius:4px; color:inherit; text-shadow:none !important; }
    .${CHUNK} .ls-word:hover { background:rgba(123,191,39,0.18); }
    .${CHUNK} .ls-word.ls-ring { animation:none; box-shadow:none; }
    .${CHUNK}.ls-light .ls-word.ls-red    { color:#D92B21 !important; }
    .${CHUNK}.ls-light .ls-word.ls-orange { color:#C05F00 !important; }
    .${CHUNK}.ls-light .ls-word.ls-green  { color:#1E8E3E !important; }
    .${CHUNK} .ls-word.ls-gold { filter:drop-shadow(0 0 5px rgba(255,200,60,0.6)); }
    .${CHUNK}.ls-light .ls-word.ls-gold { color:#B07A00 !important; background-image:linear-gradient(100deg,#B07A00 0%,#B07A00 35%,#FFE27A 50%,#B07A00 65%,#B07A00 100%); filter:drop-shadow(0 0 4px rgba(255,190,40,0.45)); }
    html.ls-style-ring .${CHUNK} .ls-word.ls-red,
    html.ls-style-ring .${CHUNK} .ls-word.ls-orange,
    html.ls-style-ring .${CHUNK} .ls-word.ls-green,
    html.ls-style-ring .${CHUNK} .ls-word.ls-gold { color:inherit !important; background-image:none !important; padding:0 3px !important; }
    #ls-reader-badge { position:fixed; right:16px; bottom:16px; z-index:2147483646; display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; border:1px solid #24242D; background:rgba(8,8,11,0.92); color:#F5F5F7; font:600 14px 'LS Inter',system-ui,sans-serif; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,0.35); }
    #ls-reader-badge:hover { border-color:#7bbf27; }
    #ls-reader-badge .ls-rb-dots { display:flex; gap:3px; }
    #ls-reader-badge .ls-rb-dots i { width:8px; height:8px; border-radius:50%; display:block; }
    #ls-reader-badge .ls-rb-x { opacity:.55; font-size:12px; }
  `;

  async function start() {
    if (on) return; on = true;
    if (!document.getElementById('ls-styles')) C.injectStyles();
    if (!document.getElementById('ls-reader-styles')) {
      const s = document.createElement('style'); s.id = 'ls-reader-styles'; s.textContent = READER_CSS; document.head.appendChild(s);
    }
    await C.loadLangs();
    C.Deck.refresh(true);
    C.Deck.startAutoRefresh(20000);
    wrapUnder(document.querySelector('article, main, [role="main"]') || document.body);
    if (document.querySelector('article, main, [role="main"]')) wrapUnder(document.body);
    // New text that appears later (infinite scroll, comments) gets wrapped too.
    let pending = [];
    observer = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => {
        if (n.nodeType === 1 && !n.classList?.contains(CHUNK) && !(n.id && /^ls-/.test(n.id))) pending.push(n);
      });
      if (pending.length) {
        const batch = pending; pending = [];
        setTimeout(() => batch.forEach((n) => n.isConnected && wrapUnder(n)), 300);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    showBadge();
    C.showToast('📖 Tap any word');
  }

  function stop() {
    if (!on) return; on = false;
    observer?.disconnect(); observer = null;
    C.Deck.stopAutoRefresh();
    C.closeCard();
    unwrapAll();
    badge?.remove(); badge = null;
    document.getElementById('ls-reader-styles')?.remove();
  }

  function toggle() { on ? stop() : start(); }

  // Save one word straight from the right-click menu ("Save “word” to LinguaScript").
  async function saveSelection(text) {
    const word = String(text || '').trim().split(/\s+/).slice(0, 4).join(' ');
    if (!word) return;
    if (!on) await C.loadLangs();
    const sel = window.getSelection();
    const context = sel?.anchorNode?.parentElement?.textContent?.trim().slice(0, 300) || word;
    const res = await new Promise((r) => {
      try { chrome.runtime.sendMessage({ type: 'SAVE_WORD', word, context, language: C.learningLang }, (x) => r(chrome.runtime.lastError ? null : x)); }
      catch { r(null); }
    });
    if (res?.ok) {
      C.Deck.markSaved(word); C.playDing();
      C.showToast(res.already ? '✓ Already in your flashcards' : `🔴 Saved · +${res.xp || 20} XP`);
    } else if (res?.error === 'not_your_language' || res?.error === 'wrong_language') {
      C.showToast('Not your learning language');
    } else {
      C.showToast(res?.error && /log/i.test(res.error) ? 'Log in to LinguaScript first' : 'Couldn’t save — try again');
    }
  }

  window.__lsReader = { toggle, start, stop, saveSelection, get on() { return on; } };
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'READER_SAVE_SELECTION') saveSelection(msg.text);
    if (msg?.type === 'READER_TOGGLE') toggle();
  });
  // Injected to save a word only? background sets this flag first.
  if (window.__lsReaderSaveOnly) { delete window.__lsReaderSaveOnly; return; }
  start();
})();
