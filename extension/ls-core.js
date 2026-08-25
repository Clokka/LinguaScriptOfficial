// LinguaScript — shared engine (ls-core.js)
// ─────────────────────────────────────────────────────────────────────────────
// One core, many platforms. This file owns everything that is IDENTICAL across
// Netflix, YouTube and any future platform: translation, the saved-word colour
// map, the word card, the transcript panel shell, controls, keyboard shortcuts,
// the toast, and the SubtitleShield (safe native-subtitle hiding).
//
// Platform adapters (adapters/netflix.js, adapters/youtube.js) implement ONLY
// the bits that genuinely differ — how to obtain the current subtitle and how
// to seek — and call into window.LSCore for all the shared behaviour.
//
// Content scripts from the same extension injected together share one isolated
// world, so attaching to `window.LSCore` is a reliable way to share code.
(() => {
  if (window.LSCore) return; // guard against double-injection

  // ── MV3 keep-alive ─────────────────────────────────────────────────────────
  function keepAlive() {
    try {
      const port = chrome.runtime.connect({ name: 'ls-keepalive' });
      port.onDisconnect.addListener(() => setTimeout(keepAlive, 25000));
    } catch {}
  }

  const getStorage = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));

  // ── Canonical token normalisation ──────────────────────────────────────────
  // MUST stay byte-for-byte identical to normalizeToken() in background.js and
  // src/lib/vocab.ts. The extension, the background worker and the web app all
  // share ONE keyspace; if these diverge, a saved word (e.g. a green "le") is
  // stored under one key but looked up under another, so its colour silently
  // falls back to red/unseen. Keeping a single definition here is the fix for
  // "my green words show red".
  function normalizeToken(raw) {
    return (raw || '')
      .toLowerCase()
      .replace(/[.,!?;:"'`«»()\[\]…]/g, '')
      .trim();
  }

  // The red/orange/green colour feature lives entirely in the Deck module below
  // (defined after config, since it reads learningLang). Deck.PALETTE is the
  // single source of truth for the three hexes.

  // ── Brand identity ──────────────────────────────────────────────────────────
  // The one gradient LinguaScript is built on — src/index.css --gradient-primary
  // (green → orange). Every accent in this file must come from here, not from
  // an unrelated colour invented for the extension.
  const BRAND = {
    green: 'hsl(145 63% 49%)',
    orange: 'hsl(32 100% 50%)',
    gradient: 'linear-gradient(135deg, hsl(145 63% 49%), hsl(32 100% 50%))',
    greenA: (a) => `hsla(145, 63%, 49%, ${a})`,
  };

  // ══ GreenScore — "how green is this line" ═══════════════════════════════════
  // Direct port of src/lib/understanding.ts. Function words (articles,
  // pronouns, prepositions…) carry low weight so "le / la / de" can't inflate
  // comprehension on every line — MUST stay identical to the website's copy or
  // Line Blast will fire on different lines than it would on linguascript.co.uk.
  const FUNCTION_WORDS = {
    fr: new Set(['le','la','les','l','un','une','des','de','du','d','au','aux','à','a','et','ou','mais','donc','or','ni','car','que','qu','qui','quoi','dont','où','je','tu','il','elle','on','nous','vous','ils','elles','me','te','se','lui','leur','y','en','ce','cet','cette','ces','mon','ma','mes','ton','ta','tes','son','sa','ses','notre','nos','votre','vos','leurs','est','sont','était','être','ai','as','avoir','ont','pas','ne','n','si','oui','non','plus','moins','très','bien','pour','par','sur','sous','dans','avec','sans','entre','vers','chez','comme','aussi','alors','puis']),
    es: new Set(['el','la','los','las','un','una','unos','unas','de','del','al','a','y','o','u','pero','que','si','no','sí','yo','tú','él','ella','usted','nosotros','vosotros','ellos','ellas','me','te','se','lo','le','nos','os','les','mi','tu','su','nuestro','vuestro','mis','tus','sus','es','son','era','ser','ha','han','hay','muy','más','menos','para','por','con','sin','en','entre','sobre','bajo','desde','hasta','como','también','ya','todavía']),
    de: new Set(['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines','und','oder','aber','doch','ich','du','er','sie','es','wir','ihr','mich','dich','sich','uns','euch','ihm','ihn','ihnen','mein','dein','sein','unser','ist','sind','war','waren','habe','hat','haben','nicht','kein','keine','ja','nein','sehr','mehr','auch','für','von','mit','ohne','auf','unter','über','zu','zur','zum','in','im','ans','aus','bei','nach','seit','wie','als','dass']),
    it: new Set(['il','lo','la','i','gli','le','un','uno','una','di','del','della','dei','degli','delle','a','al','alla','ai','agli','alle','e','o','ma','se','che','chi','cui','io','tu','lui','lei','noi','voi','loro','mi','ti','si','ci','vi','è','sono','era','essere','ho','ha','abbiamo','hanno','non','sì','no','molto','più','meno','anche','già','per','con','senza','su','sotto','tra','fra','da','in','come','quando']),
    pt: new Set(['o','a','os','as','um','uma','uns','umas','de','do','da','dos','das','no','na','nos','nas','e','ou','mas','que','se','eu','tu','você','ele','ela','nós','vós','eles','elas','me','te','lhe','vos','lhes','é','são','era','ser','tenho','tem','têm','não','sim','muito','mais','menos','também','já','para','por','com','sem','em','entre','sobre','sob','como','quando']),
    en: new Set(['the','a','an','of','to','in','on','at','by','for','with','from','as','is','are','was','were','be','been','being','and','or','but','if','then','than','so','because','while','that','this','these','those','it','its','i','you','he','she','we','they','me','him','her','us','them','my','your','his','our','their']),
  };
  function tokenWeight(token, language) {
    const set = FUNCTION_WORDS[(language || '').toLowerCase()];
    if (!set) return 1;
    return set.has(token) ? 0.25 : 1;
  }
  function tokenize(text) {
    return (text || '').split(/\s+/).map(normalizeToken).filter((t) => t.length > 0 && /\p{L}/u.test(t));
  }
  // Unlike understanding.ts (which takes a deck Map), this reads live from
  // Deck.stateOf — the extension has no separate deck-map plumbing to keep in
  // sync, so Deck itself is the single source of truth.
  function greenScoreForLine(text, language) {
    const tokens = tokenize(text);
    let knownW = 0, totalW = 0, knownC = 0;
    for (const t of tokens) {
      const w = tokenWeight(t, language);
      totalW += w;
      if (Deck.stateOf(t) === 'green') { knownW += w; knownC += 1; }
    }
    const pct = totalW > 0 ? Math.round((knownW / totalW) * 100) : 0;
    return { pct, knownWeight: knownW, totalWeight: totalW, knownCount: knownC, totalCount: tokens.length };
  }
  const GreenScore = { tokenize, tokenWeight, greenScoreForLine };

  // ── Config (set by the adapter) ─────────────────────────────────────────────
  let learningLang = 'fr';
  let nativeLang = 'en';
  let DEBUG = false;
  function setLangs(l, n) { learningLang = l || 'fr'; nativeLang = n || 'en'; }
  function setDebug(v) { DEBUG = !!v; }
  const log = (...a) => { if (DEBUG) console.log('[LinguaScript]', ...a); };

  // ── Translation (GTX direct → background chain) ─────────────────────────────
  async function translate(text, targetLang, sourceLang = 'auto') {
    const sl = sourceLang && sourceLang !== 'auto' ? sourceLang : learningLang;
    const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await Promise.race([fetch(url), timeout(2000)]);
      if (res.ok) {
        const data = await res.json();
        const tr = (data[0] || []).map((c) => c?.[0] || '').join('').trim();
        if (tr && tr.toLowerCase() !== text.toLowerCase()) return tr;
      }
    } catch {}
    return new Promise((resolve) => {
      let tries = 0;
      (function attempt() {
        tries++;
        chrome.runtime.sendMessage({ type: 'TRANSLATE', text, targetLang, sourceLang }, (res) => {
          if (chrome.runtime.lastError) {
            if (tries < 3) { setTimeout(attempt, 500); return; }
            resolve(null); return;
          }
          resolve(res?.translation ?? null);
        });
      })();
    });
  }

  // ══ Deck — THE red/orange/green colour feature ═══════════════════════════════
  // Single source of truth for word colours in the extension. It mirrors the
  // user's flashcard decks 1:1:
  //   • background GET_DECK returns { normalizedWord → state } for the CURRENT
  //     learning language — the exact same language-scoped saved_words the app's
  //     Flashcards page reads — so a word wears the same colour here as on its
  //     card (red = UNKNOWN, orange = LEARNING, green = KNOWN).
  //   • state is read straight from saved_words.state (what flashcard review
  //     writes); no SRS re-derivation.
  //   • lookups are keyed by normalizeToken(), identical on both sides, so a
  //     stored "Les." / "le " can't miss its span and fall back to red.
  // Nothing else in the codebase should read or write word colours directly —
  // go through Deck.
  // Gold — the celebration tier layered on top of green. Deliberately outside
  // the red/orange/green PALETTE, exactly mirroring src/lib/goldenReveal.ts:
  // GOLD.core/GOLD.deep/GOLD.glow. Gold is a reward to be claimed, not a
  // status — it decorates a green word the learner hasn't witnessed being
  // promoted yet, and clicking it claims it (see claimGoldWord below).
  const GOLD = { core: '#FFD54A', deep: '#FFAA1A', glow: 'rgba(255, 200, 60, 0.55)' };
  // A gold word auto-reveals after appearing in this many lines (matches
  // GOLD_DECAY_APPEARANCES) and at most this many show gold on screen at once
  // per rendered line (matches MAX_GOLD_PER_LINE) — see goldenReveal.ts for why.
  const GOLD_DECAY_APPEARANCES = 3;
  const MAX_GOLD_PER_LINE = 2;

  const Deck = {
    // Exact hexes from DECK_CONFIG in src/pages/Flashcards.tsx.
    PALETTE: { red: '#FF3B30', orange: '#FF8A00', green: '#34C759' },
    STATES: ['red', 'orange', 'green'],
    GOLD,
    _map: new Map(),          // normalizedWord → 'red' | 'orange' | 'green'
    _ids: new Map(),          // normalizedWord → saved_words.id (for claim/touch RPCs)
    _gold: new Set(),         // normalizedWord → currently a pending (unclaimed) gold reveal
    _timer: null,
    _onRefresh: [],           // callbacks fired after every successful refresh()

    // Fired after refresh() and after any local promotion to green (markKnown)
    // — anything that could change whether the line on screen just completed.
    // Adapters use this to re-check the current line for Line Blast.
    onRefresh(fn) { this._onRefresh.push(fn); },
    _notify() { this._onRefresh.forEach((fn) => { try { fn(); } catch (e) { log('onRefresh handler failed', e); } }); },

    // The deck state for a word, or null if it isn't in any deck (unseen).
    stateOf(word) { return this._map.get(normalizeToken(word)) || null; },
    idOf(word) { return this._ids.get(normalizeToken(word)) || null; },
    isGold(word) { return this._gold.has(normalizeToken(word)); },

    // Paint one span to match its deck (clears all three tier classes first so a
    // recolour red→green never leaves a stale class behind).
    paint(el, word) {
      const key = normalizeToken(word ?? el.dataset.word ?? '');
      const s = this._map.get(key);
      el.classList.remove('ls-red', 'ls-orange', 'ls-green', 'ls-gold');
      if (s) el.classList.add('ls-' + s);
      if (this._gold.has(key) && el.dataset.lsGoldEligible !== 'false') el.classList.add('ls-gold');
    },

    // Repaint every rendered word span from the current map.
    repaintAll() { document.querySelectorAll('.ls-word').forEach((el) => this.paint(el)); },

    // Pull the deck for the active learning language from the background and
    // repaint. Called on mount and every refresh tick. GET_DECK returns
    // { word: { state, gold, id } } — gold mirrors isPendingGreen() server-side.
    refresh(force = false) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_DECK', language: learningLang, force }, (res) => {
          if (chrome.runtime.lastError || !res?.ok) { log('GET_DECK failed'); resolve(false); return; }
          this._map.clear(); this._ids.clear(); this._gold.clear();
          for (const [word, entry] of Object.entries(res.deck || {})) {
            const key = normalizeToken(word);
            const state = typeof entry === 'string' ? entry : entry?.state;
            if (!this.STATES.includes(state)) continue;
            this._map.set(key, state);
            if (entry && typeof entry === 'object') {
              if (entry.id) this._ids.set(key, entry.id);
              if (entry.gold) this._gold.add(key);
            }
          }
          const dist = { red: 0, orange: 0, green: 0 };
          this._map.forEach((s) => dist[s]++);
          log('deck loaded:', this._map.size, 'words', dist, 'gold:', this._gold.size);
          this.repaintAll();
          this._notify();
          resolve(true);
        });
      });
    },

    // A word just saved from the overlay enters the red (UNKNOWN) deck; reflect
    // that instantly without waiting for the next refresh.
    markSaved(word) {
      const key = normalizeToken(word);
      if (!key) return;
      this._map.set(key, 'red');
      document.querySelectorAll(`.ls-word[data-word="${CSS.escape(key)}"]`).forEach((el) => this.paint(el, key));
    },

    // Claim a gold word — mirrors revealGreenWord() in goldenReveal.ts via the
    // same reveal_green_word RPC. Returns { revealed, awardedXp }.
    claim(word) {
      const key = normalizeToken(word);
      const id = this._ids.get(key);
      if (!id) return Promise.resolve({ revealed: false, awardedXp: 0 });
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CLAIM_GOLD', wordId: id }, (res) => {
          if (!chrome.runtime.lastError && res?.ok && res.revealed) {
            this._gold.delete(key);
            document.querySelectorAll(`.ls-word[data-word="${CSS.escape(key)}"]`).forEach((el) => this.paint(el, key));
          }
          resolve(res?.ok ? { revealed: !!res.revealed, awardedXp: res.awardedXp || 0 } : { revealed: false, awardedXp: 0 });
        });
      });
    },

    // Record a gold word appeared again; background auto-claims it once it has
    // decayed (appeared GOLD_DECAY_APPEARANCES times unseen). Debounced to one
    // call per line by the caller (see touchGoldSeen below).
    touch(word) {
      const key = normalizeToken(word);
      const id = this._ids.get(key);
      if (!id) return;
      chrome.runtime.sendMessage({ type: 'TOUCH_GOLD', wordId: id, decayAt: GOLD_DECAY_APPEARANCES }, (res) => {
        if (!chrome.runtime.lastError && res?.ok && res.claimed) {
          this._gold.delete(key);
          document.querySelectorAll(`.ls-word[data-word="${CSS.escape(key)}"]`).forEach((el) => this.paint(el, key));
        }
      });
    },

    // Upsert a word straight into the green deck — mirrors markWordKnown() in
    // Watch.tsx. Used by the extension's "I already know this" action.
    markKnown(word, context, translation) {
      const key = normalizeToken(word);
      if (!key) return Promise.resolve(false);
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'MARK_KNOWN', word: key, context: context || '', translation: translation || '', language: learningLang },
          (res) => {
            if (!chrome.runtime.lastError && res?.ok) {
              this._map.set(key, 'green');
              document.querySelectorAll(`.ls-word[data-word="${CSS.escape(key)}"]`).forEach((el) => this.paint(el, key));
              this._notify();
            }
            resolve(!!res?.ok);
          },
        );
      });
    },

    // Poll so a card promoted in the app (red→orange→green) recolours live. The
    // background force-refreshes past its cache when we ask on the tick.
    startAutoRefresh(ms = 15000) {
      if (this._timer) return;
      this._timer = setInterval(() => this.refresh(true), ms);
    },
    stopAutoRefresh() { clearInterval(this._timer); this._timer = null; },
  };

  // ── Toast ────────────────────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    let t = document.getElementById('ls-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ls-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('ls-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('ls-show'), 2200);
  }

  // ── Word card ──────────────────────────────────────────────────────────────
  let activeCard = null;
  function closeCard() { activeCard?.remove(); activeCard = null; }

  function openCard({ word, clean, fullLine, anchorEl }) {
    closeCard();
    const tier = Deck.stateOf(clean);
    const tierLabel = tier === 'green' ? '🟢 Known' : tier === 'orange' ? '🟠 Learning' : tier === 'red' ? '🔴 New word' : '⬜ Unseen';
    const tierColor = tier === 'green' ? Deck.PALETTE.green : tier === 'orange' ? Deck.PALETTE.orange : tier === 'red' ? Deck.PALETTE.red : '#888';
    const alreadySaved = !!tier;

    const alreadyKnown = tier === 'green';
    const card = document.createElement('div'); card.id = 'ls-card'; activeCard = card;
    card.innerHTML = `
      <button id="ls-card-close">✕</button>
      <div id="ls-card-word">${word}</div>
      <div id="ls-card-tier" style="color:${tierColor}">${tierLabel}</div>
      <div id="ls-card-trans" style="color:#888;font-style:italic;font-size:14px;">looking up…</div>
      <div id="ls-card-body"></div>
      ${alreadyKnown ? '' : '<button id="ls-card-mark-known">✓ I already know this</button>'}
      <button id="ls-card-save"${alreadySaved ? ' disabled' : ''}>${alreadySaved ? '✓ In your flashcards' : '+ Save to flashcards'}</button>`;
    document.body.appendChild(card);
    card.querySelector('#ls-card-close').addEventListener('click', closeCard);

    // "I already know this" — mirrors markWordKnown() in Watch.tsx: upserts the
    // word straight into the green deck, which is exactly the kind of external
    // promotion Line Blast watches for on the line currently on screen.
    const markKnownBtn = card.querySelector('#ls-card-mark-known');
    if (markKnownBtn) {
      markKnownBtn.addEventListener('click', () => {
        markKnownBtn.textContent = 'Marking…'; markKnownBtn.disabled = true;
        Deck.markKnown(clean, fullLine, resolvedTranslation).then((ok) => {
          if (!ok) { markKnownBtn.textContent = '✓ I already know this'; markKnownBtn.disabled = false; return; }
          markKnownBtn.textContent = '✓ Known!';
          setTimeout(closeCard, 700);
        });
      });
    }

    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - 150;
    left = Math.max(8, Math.min(left, window.innerWidth - 308));
    const top = rect.top - 180 < 8 ? rect.bottom + 8 : rect.top - 180;
    card.style.left = left + 'px'; card.style.top = top + 'px';
    setTimeout(() => document.addEventListener('click', (e) => { if (!card.contains(e.target)) closeCard(); }, { once: true }), 0);

    let resolvedTranslation = '';
    chrome.runtime.sendMessage({ type: 'WORD_DETAIL', word: clean, sourceLang: learningLang, targetLang: nativeLang }, (detail) => {
      if (!activeCard) return;
      const transEl = card.querySelector('#ls-card-trans');
      const bodyEl = card.querySelector('#ls-card-body');
      if (detail?.ok && detail.translation) {
        resolvedTranslation = detail.translation;
        if (transEl) { transEl.style.cssText = 'font-size:17px;font-weight:700;color:#fff;margin-bottom:10px;'; transEl.textContent = detail.translation; }
        let bodyHTML = '';
        if (detail.synonymGroups?.length) {
          const chips = detail.synonymGroups.flatMap((g) => g.words).slice(0, 10).map((w) => `<span class="ls-card-syn-chip">${w}</span>`).join('');
          bodyHTML += `<div class="ls-card-section-label">Synonyms</div><div class="ls-card-synonyms">${chips}</div>`;
        }
        const examples = [];
        if (fullLine && fullLine !== clean) {
          examples.push(`<div class="ls-card-example">${fullLine.replace(new RegExp(`\\b${clean}\\b`, 'gi'), (m) => `<em>${m}</em>`)}</div>`);
        }
        if (detail.examples?.length) {
          detail.examples.slice(0, 2).forEach((ex) => examples.push(`<div class="ls-card-example">${ex.replace(new RegExp(`\\b${clean}\\b`, 'gi'), (m) => `<em>${m}</em>`)}</div>`));
        }
        if (examples.length) bodyHTML += `<div class="ls-card-section-label">Examples</div><div class="ls-card-examples">${examples.join('')}</div>`;
        if (bodyEl) bodyEl.innerHTML = bodyHTML;
      } else {
        translate(clean, nativeLang, learningLang).then((tr) => {
          resolvedTranslation = tr || '';
          if (transEl) { transEl.style.cssText = 'font-size:15px;color:#e5e5e5;margin-bottom:12px;'; transEl.textContent = tr || 'Translation unavailable'; }
        });
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, (authRes) => {
      if (!activeCard) return;
      const saveBtn = card.querySelector('#ls-card-save');
      if (!authRes?.session) {
        saveBtn.replaceWith(buildMiniLogin(clean, fullLine, () => resolvedTranslation));
      } else {
        saveBtn.addEventListener('click', () => {
          saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
          chrome.runtime.sendMessage({ type: 'SAVE_WORD', word: clean, context: fullLine, language: learningLang, translation: resolvedTranslation }, (res) => {
            if (chrome.runtime.lastError || !res?.ok) { saveBtn.textContent = '+ Save to flashcards'; saveBtn.disabled = false; return; }
            Deck.markSaved(clean);
            // The 2D chameleon pop — "a new word just caught" — only for a
            // genuinely new save, not a re-tap on an already-saved word.
            if (!res.already) mountChameleonReaction('red', saveBtn);
            saveBtn.textContent = res.already ? '✓ Already saved' : '✓ Saved!'; saveBtn.disabled = true;
            setTimeout(closeCard, 900);
          });
        });
      }
    });
  }

  function buildMiniLogin(word, context, getTranslation) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="ls-card-login-note">Log in to save words to your flashcards.</p>
      <input class="ls-card-login-input" id="ls-mini-email" type="email" placeholder="Email" autocomplete="email" />
      <input class="ls-card-login-input" id="ls-mini-pw" type="password" placeholder="Password" autocomplete="current-password" />
      <button class="ls-card-login-btn" id="ls-mini-submit">Log in &amp; Save</button>
      <div class="ls-card-login-err" id="ls-mini-err"></div>`;
    wrap.addEventListener('click', (e) => e.stopPropagation());
    const submit = () => {
      const email = wrap.querySelector('#ls-mini-email').value.trim();
      const pw = wrap.querySelector('#ls-mini-pw').value;
      const errEl = wrap.querySelector('#ls-mini-err');
      const btn = wrap.querySelector('#ls-mini-submit');
      if (!email || !pw) { errEl.textContent = 'Enter your email and password.'; return; }
      btn.textContent = 'Logging in…'; btn.disabled = true; errEl.textContent = '';
      chrome.runtime.sendMessage({ type: 'SIGN_IN', email, password: pw }, (res) => {
        if (!res?.ok) { errEl.textContent = res?.error || 'Login failed — check credentials.'; btn.textContent = 'Log in & Save'; btn.disabled = false; return; }
        btn.textContent = 'Saving…';
        chrome.runtime.sendMessage({ type: 'SAVE_WORD', word, context, language: learningLang, translation: getTranslation() }, (saveRes) => {
          if (!saveRes?.ok) { btn.textContent = 'Saved (refresh to colour words)'; btn.disabled = true; return; }
          Deck.markSaved(word);
          if (!saveRes.already) mountChameleonReaction('red', btn);
          btn.textContent = '✓ Saved!'; btn.disabled = true;
          setTimeout(closeCard, 900);
        });
      });
    };
    wrap.querySelector('#ls-mini-submit').addEventListener('click', submit);
    wrap.querySelector('#ls-mini-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    return wrap;
  }

  // ── Claim chime ──────────────────────────────────────────────────────────────
  // Direct port of src/lib/chime.ts: a synthesised glass-shimmer tone, muted by
  // default (this plays over whatever the learner is watching). The mute
  // preference lives in the HOST page's localStorage (Netflix's / YouTube's
  // own origin, not the extension's), so — unlike the deck colours — it does
  // not sync from linguascript.co.uk; it is opt-in per platform, which keeps
  // the safe-by-default behaviour intact.
  const CHIME_PREF_KEY = 'linguascript.chimeEnabled';
  let audioCtx = null;
  function isChimeEnabled() { try { return localStorage.getItem(CHIME_PREF_KEY) === '1'; } catch { return false; } }
  function playClaimChime() {
    if (!isChimeEnabled()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ac = audioCtx;
      if (ac.state === 'suspended') void ac.resume();
      const now = ac.currentTime;
      const partials = [
        { freq: 1318.5, gain: 0.22, decay: 1.5 },
        { freq: 1975.5, gain: 0.13, decay: 1.0 },
        { freq: 2637.0, gain: 0.07, decay: 0.6 },
      ];
      const master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
      for (const p of partials) {
        const osc = ac.createOscillator(); const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, now);
        osc.frequency.exponentialRampToValueAtTime(p.freq * 1.01, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(p.gain, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);
        osc.connect(gain); gain.connect(master);
        osc.start(now); osc.stop(now + p.decay + 0.05);
      }
      setTimeout(() => master.disconnect(), 1800);
    } catch {}
  }

  // ── Golden dust ──────────────────────────────────────────────────────────────
  // Direct port of GoldenDust.tsx: one canvas for the whole overlay, additive
  // blending so gold reads as light against dark video, drifting off every
  // currently-visible gold word. Driven by requestAnimationFrame (no GSAP
  // dependency here, unlike the website — same visual result).
  const GoldenDust = (() => {
    let canvas = null, ctx2d = null, raf = 0, last = 0;
    const pools = new Map(); // key → particles[]
    const anchors = new Map(); // key → element
    const PER_WORD = 20;
    function ensureCanvas() {
      if (canvas) return;
      canvas = document.createElement('canvas');
      canvas.id = 'ls-golden-dust';
      canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483642;pointer-events:none;';
      document.body.appendChild(canvas);
      ctx2d = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
      tick(performance.now());
    }
    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px';
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(r) {
      return {
        x: r.left + Math.random() * r.width, y: r.top + r.height * (0.3 + Math.random() * 0.7),
        vx: (Math.random() - 0.5) * 0.22, vy: -0.18 - Math.random() * 0.35,
        life: 0, maxLife: 900 + Math.random() * 900, size: 0.7 + Math.random() * 1.6,
      };
    }
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { ctx2d?.clearRect(0, 0, window.innerWidth, window.innerHeight); return; }
      const dt = Math.min(now - last, 48); last = now;
      if (!ctx2d) return;
      ctx2d.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const live = new Set(anchors.keys());
      for (const key of pools.keys()) if (!live.has(key)) pools.delete(key);
      ctx2d.globalCompositeOperation = 'lighter';
      for (const [key, el] of anchors) {
        if (!el.isConnected) { anchors.delete(key); continue; }
        const rect = el.getBoundingClientRect();
        let pool = pools.get(key);
        if (!pool) {
          pool = Array.from({ length: PER_WORD }, () => { const p = spawn(rect); p.life = Math.random() * p.maxLife; return p; });
          pools.set(key, pool);
        }
        for (const p of pool) {
          p.life += dt;
          if (p.life >= p.maxLife) Object.assign(p, spawn(rect));
          p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06;
          const t = p.life / p.maxLife;
          const alpha = Math.sin(t * Math.PI) * 0.85;
          ctx2d.beginPath(); ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx2d.fillStyle = t < 0.5 ? GOLD.core : GOLD.deep;
          ctx2d.globalAlpha = alpha; ctx2d.fill();
        }
      }
      ctx2d.globalAlpha = 1; ctx2d.globalCompositeOperation = 'source-over';
    }
    return {
      registerAnchor(key, el) { ensureCanvas(); anchors.set(key, el); },
      unregisterAnchor(key) { anchors.delete(key); pools.delete(key); },
    };
  })();

  // Claim a gold word: mirrors SubtitleOverlay's "claiming takes precedence
  // over the translation popup" rule — a tap on a gold word means "this one's
  // mine", not "what does it mean".
  function claimGoldWord(clean) {
    GoldenDust.unregisterAnchor(clean);
    Deck.claim(clean).then(({ revealed, awardedXp }) => {
      if (!revealed) return;
      playClaimChime();
      showToast(awardedXp > 0 ? `Claimed! +${awardedXp} XP` : 'Claimed!');
    });
  }

  // ── Word spans ───────────────────────────────────────────────────────────────
  // MAX_GOLD_PER_LINE caps how many gold words actually render gold in one
  // rendered line — a heavy reviewer reopening the player would otherwise get
  // a screen full of gold at once. Extras still count toward decay (touched
  // silently) but paint plain green. Reset per call, since each call renders
  // exactly one line's worth of spans (primary line, or one transcript-panel
  // line) — mirrors the per-line cap in SubtitleOverlay.tsx.
  //
  // `panelMode` disables gold entirely (renders plain green, no dust, no
  // claim-click, no decay touch) for the transcript panel: unlike the primary
  // line, the panel pre-renders every line in the video at once, and gold
  // decay is meant to track what the learner actually watched pass by, not
  // what happened to scroll past in a list on mount.
  function makeWordSpan(word, fullLine, goldBudget, panelMode) {
    const clean = normalizeToken(word);
    if (!clean) return document.createTextNode(word + ' ');
    const span = document.createElement('span');
    span.className = 'ls-word'; span.dataset.word = clean; span.textContent = word + ' ';

    const isGold = !panelMode && Deck.isGold(clean);
    let eligible = true;
    if (isGold && goldBudget) {
      eligible = goldBudget.count < MAX_GOLD_PER_LINE;
      if (eligible) goldBudget.count++;
      else Deck.touch(clean); // capped out — still progresses decay, silently
    }
    // Permanently excludes this span from gold styling on every future
    // repaint too (Deck.paint() checks this dataset flag, not just isGold
    // computed here) — panel spans must never light up gold, even after a
    // later deck refresh.
    span.dataset.lsGoldEligible = panelMode ? 'false' : eligible ? 'true' : 'false';
    Deck.paint(span, clean);

    if (isGold && eligible) {
      GoldenDust.registerAnchor(clean, span);
      Deck.touch(clean); // appeared on screen while still gold — counts toward decay
      span.addEventListener('click', (e) => { e.stopPropagation(); claimGoldWord(clean); });
    } else {
      span.addEventListener('click', (e) => { e.stopPropagation(); openCard({ word, clean, fullLine, anchorEl: span }); });
    }
    return span;
  }
  function makeWordSpansFor(text, panelMode) {
    const frag = document.createDocumentFragment();
    const goldBudget = { count: 0 };
    text.split(/\s+/).filter(Boolean).forEach((w) => frag.appendChild(makeWordSpan(w, text, goldBudget, panelMode)));
    return frag;
  }

  // ══ Chameleon (2D) ═══════════════════════════════════════════════════════════
  // Exact SVG + CSS from ChameleonMascot.tsx — "it is not LinguaScript without
  // the chameleon." Skin tones are the canonical deck colours; identical
  // markup to the website's, just mounted with plain DOM instead of React.
  const CHAM_SVG = `
<svg viewBox="0 0 400 270" class="cham-idle" role="img" aria-label="LinguaScript chameleon">
  <path d="M20 236 Q200 222 380 240 L380 254 Q200 236 20 250 Z" fill="#5b4332"></path>
  <path class="tailstroke" d="M272 176 C322 168 348 190 344 214 C340 236 316 242 304 230 C295 220 302 206 314 207" fill="none" stroke-width="15" stroke-linecap="round"></path>
  <rect class="skin2" x="233" y="196" width="15" height="38" rx="7.5"></rect>
  <path class="skin" d="M136 196 Q128 118 205 106 Q276 96 285 160 Q290 202 244 208 L164 210 Q140 208 136 196 Z"></path>
  <path class="ridge" d="M158 130 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 l-2 10 q-49 -10 -94 2 Z"></path>
  <path class="belly" d="M150 196 Q152 168 178 166 Q166 190 190 206 L164 208 Q152 206 150 196 Z"></path>
  <rect class="skin2" x="182" y="198" width="15" height="40" rx="7.5"></rect>
  <circle class="skin2" cx="189.5" cy="238" r="9"></circle>
  <path class="skin" d="M162 118 Q160 92 134 88 Q104 84 88 112 Q74 138 84 162 Q94 186 126 188 Q152 189 160 168 Q166 148 162 118 Z"></path>
  <path d="M82 148 Q104 162 128 154" fill="none" stroke="#3d2b1f" stroke-width="4.5" stroke-linecap="round"></path>
  <circle class="belly" cx="118" cy="126" r="21"></circle>
  <circle cx="118" cy="126" r="11.5" fill="#fffef9"></circle>
  <circle class="pupil" cx="118" cy="126" r="5.5" fill="#241a12" transform="translate(4.27 -1.42)"></circle>
  <circle cx="120.5" cy="123.5" r="2" fill="#ffffff" opacity="0.9" transform="translate(4.27 -1.42)"></circle>
</svg>`;
  const CHAM_CSS = `
    .ls-cham { --skin:#FF8A00; --skin2:#D97100; --belly:#FFE0B8; --ridge:#B35A00; display:inline-block; line-height:0; }
    .ls-cham.tier-red    { --skin:#FF3B30; --skin2:#D32B22; --belly:#FFC4C0; --ridge:#B02018; }
    .ls-cham.tier-orange { --skin:#FF8A00; --skin2:#D97100; --belly:#FFE0B8; --ridge:#B35A00; }
    .ls-cham.tier-green  { --skin:#34C759; --skin2:#26A047; --belly:#B8EFC8; --ridge:#1B7A35; }
    .ls-cham .skin  { fill:var(--skin);  transition:fill .7s; }
    .ls-cham .skin2 { fill:var(--skin2); transition:fill .7s; }
    .ls-cham .belly { fill:var(--belly); transition:fill .7s; }
    .ls-cham .ridge { fill:var(--ridge); transition:fill .7s; }
    .ls-cham .tailstroke { stroke:var(--skin2); transition:stroke .7s; }
    .ls-cham svg { width:100%; height:auto; display:block; overflow:visible; }
    @media (prefers-reduced-motion: no-preference) {
      .ls-cham .cham-idle { animation: ls-cham-bob 3.2s ease-in-out infinite; transform-origin:50% 78%; }
      @keyframes ls-cham-bob { 50% { transform: translateY(-5px); } }
      .ls-cham.party .cham-idle { animation: ls-cham-party .55s ease-in-out 3; }
      @keyframes ls-cham-party { 25% { transform: translateY(-10px) rotate(-2.5deg); } 75% { transform: translateY(-10px) rotate(2.5deg); } }
    }
    #ls-cham-reaction { position:fixed; z-index:2147483643; display:flex; flex-direction:column; align-items:center; pointer-events:none; left:50%; }
    #ls-cham-reaction .ls-cham { width:100px; }
    #ls-cham-reaction .ls-cham-label {
      margin-top:4px; border-radius:999px; padding:4px 12px; font-size:11px; font-weight:700;
      letter-spacing:.02em; backdrop-filter:blur(6px); background:rgba(0,0,0,0.55);
      font-family:'Inter',-apple-system,sans-serif; white-space:nowrap; transition:color .7s;
    }
    @keyframes ls-cham-react-in { 0% { opacity:0; transform:translate(-50%,26px) scale(.6); } 60% { opacity:1; transform:translate(-50%,-6px) scale(1.06); } 100% { opacity:1; transform:translate(-50%,0) scale(1); } }
    @keyframes ls-cham-react-out { to { opacity:0; transform:translate(-50%,-14px) scale(.9); } }
  `;

  // mode: 'red' (a new word just caught) | 'orange-to-green' (line completed).
  // Timings match ChameleonReaction.tsx exactly.
  function mountChameleonReaction(mode, anchorEl) {
    document.getElementById('ls-cham-reaction')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'ls-cham-reaction';
    const anchorRect = (anchorEl || document.getElementById('ls-primary'))?.getBoundingClientRect();
    if (anchorRect) { wrap.style.left = (anchorRect.left + anchorRect.width / 2) + 'px'; wrap.style.bottom = (window.innerHeight - anchorRect.top + 8) + 'px'; }
    else { wrap.style.left = '50%'; wrap.style.bottom = '160px'; }
    wrap.style.transform = 'translateX(-50%)';
    wrap.style.animation = 'ls-cham-react-in 460ms cubic-bezier(0.16,1,0.3,1)';

    let tier = mode === 'red' ? 'red' : 'orange';
    const cham = document.createElement('div'); cham.className = `ls-cham tier-${tier}`; cham.innerHTML = CHAM_SVG;
    const label = document.createElement('span'); label.className = 'ls-cham-label';
    const setLabel = () => {
      label.textContent = mode === 'red' ? 'New word caught!' : tier === 'green' ? 'Line complete — turned green!' : 'Almost there…';
      label.style.color = tier === 'green' ? Deck.PALETTE.green : tier === 'orange' ? Deck.PALETTE.orange : Deck.PALETTE.red;
    };
    setLabel();
    wrap.appendChild(cham); wrap.appendChild(label);
    document.body.appendChild(wrap);

    const timers = [];
    if (mode === 'orange-to-green') {
      timers.push(setTimeout(() => { tier = 'green'; cham.className = 'ls-cham tier-green party'; setLabel(); }, 620));
    }
    const leaveAt = mode === 'red' ? 1500 : 2200;
    const removeAt = mode === 'red' ? 1900 : 2600;
    timers.push(setTimeout(() => { wrap.style.animation = 'ls-cham-react-out 380ms ease-in forwards'; }, leaveAt));
    timers.push(setTimeout(() => wrap.remove(), removeAt));
  }

  // ══ Chameleon (3D) — level-up celebration ════════════════════════════════════
  // The 3D chameleon (same rigged Chameleon_Animations.glb the website's
  // Chameleon3D.tsx uses) fires only on a level-up — a genuinely rare,
  // deliberately bigger moment than the 2D reaction. Lazily loads the vendored
  // three.js bundle (extension/vendor/chameleon3d.bundle.js) on first use so
  // the ~580 KB library is never fetched unless a learner actually levels up.
  let chameleon3DLoading = null;
  function loadChameleon3DScript() {
    if (window.LSChameleon3D) return Promise.resolve();
    if (chameleon3DLoading) return chameleon3DLoading;
    chameleon3DLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('vendor/chameleon3d.bundle.js');
      s.onload = () => resolve();
      s.onerror = reject;
      document.documentElement.appendChild(s);
    });
    return chameleon3DLoading;
  }

  function mountChameleon3DLevelUp(level) {
    loadChameleon3DScript().then(() => {
      if (!window.LSChameleon3D) return;
      document.getElementById('ls-levelup')?.remove();
      const overlay = document.createElement('div'); overlay.id = 'ls-levelup';
      overlay.innerHTML = `
        <div id="ls-levelup-card">
          <div id="ls-levelup-3d"></div>
          <div id="ls-levelup-kicker">Level up</div>
          <div id="ls-levelup-title">Level ${level}</div>
        </div>`;
      document.body.appendChild(overlay);
      const host = overlay.querySelector('#ls-levelup-3d');
      const instance = window.LSChameleon3D.mount(host, {
        tier: 'gold', size: 200, glbUrl: chrome.runtime.getURL('vendor/Chameleon_Animations.glb'),
      });
      requestAnimationFrame(() => overlay.classList.add('ls-in'));
      const HOLD_MS = 3200;
      setTimeout(() => {
        overlay.classList.remove('ls-in'); overlay.classList.add('ls-out');
        setTimeout(() => { instance.dispose(); overlay.remove(); }, 380);
      }, HOLD_MS);
      loadConfettiScript().then(() => {
        if (!window.LSConfetti) return;
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;';
        document.body.appendChild(canvas);
        const fire = window.LSConfetti.create(canvas, { resize: true, useWorker: true });
        void fire({ particleCount: 160, spread: 100, startVelocity: 36, origin: { x: 0.5, y: 0.5 }, colors: ['#34d399', '#fbbf24', '#6ee7b7', '#f4f7f5', '#a78bfa'], disableForReducedMotion: true });
        setTimeout(() => canvas.remove(), 3000);
      });
    });
  }

  // ── Confetti (lazy) ──────────────────────────────────────────────────────────
  let confettiLoading = null;
  function loadConfettiScript() {
    if (window.LSConfetti) return Promise.resolve();
    if (confettiLoading) return confettiLoading;
    confettiLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('vendor/confetti.bundle.js');
      s.onload = () => resolve();
      s.onerror = reject;
      document.documentElement.appendChild(s);
    });
    return confettiLoading;
  }

  // ══ XP bridge ═════════════════════════════════════════════════════════════════
  // Awards XP through the background worker (which owns profiles.xp_total the
  // same way persistXP()/XpContext.award() do on the website) and triggers the
  // 3D chameleon the moment a level threshold is crossed.
  function awardXp(action) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'AWARD_XP', action }, (res) => {
        if (!chrome.runtime.lastError && res?.ok && res.leveledUp) mountChameleon3DLevelUp(res.newLevel);
        resolve(res?.ok ? res : null);
      });
    });
  }

  // ══ Line Blast ════════════════════════════════════════════════════════════════
  // Direct port of useLineBlast.ts + lib/lineBlast.ts's rules and presentation:
  // a line only ever blasts on the transition into 100% green, never on a line
  // that was already green when it appeared (armLine/completeLine), combo
  // escalates 1..5 with the exact same praise ladder and XP formula, and it can
  // only ever fire once per line per video (blastedRef).
  const LineBlast = (() => {
    const PRAISE = [
      ['', ''],
      ['LINE COMPLETE!', ''],
      ['GREAT!', 'combo ×2'],
      ['AMAZING!', 'combo ×3'],
      ['INCREDIBLE!', 'combo ×4'],
      ['UNBELIEVABLE!', 'combo ×5'],
    ];
    const COMBO_CAP = 5;
    const BASE_XP = 15;
    let combo = 0;
    let seen = new Set(), armed = new Set(), blasted = new Set();
    let lineEl = null, stageEl = null;

    function reset() { combo = 0; seen = new Set(); armed = new Set(); blasted = new Set(); }
    function breakCombo() { combo = 0; }

    // Adapters call this once, telling LineBlast which live DOM elements hold
    // the current line's word spans (#ls-primary) and the stage they sit in.
    function bindElements(line, stage) { lineEl = line; stageEl = stage; }

    function armLine(text, language) {
      const line = (text || '').trim();
      if (!line || seen.has(line)) return;
      seen.add(line);
      const score = GreenScore.greenScoreForLine(line, language);
      if (score.totalCount > 0 && score.pct < 100) armed.add(line);
    }

    function goldSweep(line) {
      if (!line) return;
      Array.from(line.children).forEach((span, i) => {
        span.animate(
          [{ color: '#f4f7f5' }, { color: '#fbbf24', textShadow: '0 0 16px rgba(251,191,36,0.8)', offset: 0.4 }, { color: 'rgba(52,211,153,0.72)', textShadow: 'none' }],
          { duration: 460, delay: i * 30, easing: 'ease-out', fill: 'forwards' },
        );
      });
    }
    function scatterClones(stage, line) {
      if (!line) return;
      const fontSize = getComputedStyle(line).fontSize;
      Array.from(line.children).forEach((span) => {
        const b = span.getBoundingClientRect();
        const clone = document.createElement('span');
        clone.textContent = (span.textContent || '').trim();
        clone.className = 'ls-blast-clone';
        clone.style.fontSize = fontSize;
        clone.style.left = b.left + 'px'; clone.style.top = b.top + 'px';
        document.body.appendChild(clone);
        const angle = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * 190;
        const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist - 45;
        const rot = (Math.random() * 2 - 1) * 200;
        clone.animate(
          [{ transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(0.08)`, opacity: 0 }],
          { duration: 560, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' },
        ).addEventListener('finish', () => clone.remove());
      });
    }

    function showPraise(big, sub, comboN) {
      const el = document.createElement('div'); el.id = 'ls-blast-praise';
      el.innerHTML = `<div class="ls-blast-big" style="font-size:${22 + comboN * 4}px">${big}</div>${sub ? `<div class="ls-blast-sub">${sub}</div>` : ''}`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
    function showFloatXp(text) {
      const el = document.createElement('div'); el.id = 'ls-blast-xp'; el.textContent = text;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    }
    function flashGlow() {
      const el = document.createElement('div'); el.id = 'ls-blast-glow';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }

    function fire() {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      combo = Math.min(combo + 1, COMBO_CAP);
      const [big, sub] = PRAISE[combo];
      const xp = BASE_XP * combo;

      if (!reduced) { goldSweep(lineEl); scatterClones(stageEl, lineEl); flashGlow(); }
      showPraise(big, sub, combo);
      showFloatXp(`+${xp} XP${combo > 1 ? ` (${BASE_XP} × ${combo})` : ''}`);
      mountChameleonReaction('orange-to-green', lineEl);
      for (let i = 0; i < combo; i++) awardXp('line_blast');

      if (combo >= 2 && !reduced) {
        loadConfettiScript().then(() => {
          if (!window.LSConfetti) return;
          let canvas = document.getElementById('ls-blast-confetti');
          if (!canvas) {
            canvas = document.createElement('canvas'); canvas.id = 'ls-blast-confetti';
            canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483644;pointer-events:none;';
            document.body.appendChild(canvas);
            canvas._lsFire = window.LSConfetti.create(canvas, { resize: true, useWorker: true });
          }
          void canvas._lsFire({
            particleCount: Math.min(40 + combo * 30, 170), spread: 80, startVelocity: 32,
            origin: { x: 0.5, y: 0.62 }, colors: ['#34d399', '#fbbf24', '#6ee7b7', '#f4f7f5', '#a78bfa'], disableForReducedMotion: true,
          });
        });
      }
    }

    function completeLine(text, language) {
      const line = (text || '').trim();
      if (!line || blasted.has(line)) return false;
      if (!armed.has(line)) return false;
      const score = GreenScore.greenScoreForLine(line, language);
      if (score.totalCount === 0 || score.pct < 100) return false;
      blasted.add(line); armed.delete(line);
      fire();
      return true;
    }

    return { reset, breakCombo, bindElements, armLine, completeLine };
  })();

  // ── Subtitle shield — SAFE native-subtitle hiding ─────────────────────────────
  // The blank-screen bug came from hiding native subs up-front and never
  // restoring them if our overlay failed or the extension reloaded. Rules:
  //   1. Only hide native subs once WE actually have text to show (noteContent).
  //   2. Restore them the moment our overlay is empty, on error, or on teardown.
  //   3. A watchdog un-hides if no content has been shown for a few seconds, so
  //      an orphaned hide-style can never strand the viewer with a blank screen.
  function SubtitleShield(selector) {
    let styleEl = null, hidden = false, lastContentTs = 0, watchdog = null;
    function hide() {
      if (hidden) return;
      styleEl = document.getElementById('ls-native-hide') || document.createElement('style');
      styleEl.id = 'ls-native-hide';
      styleEl.textContent = `${selector} { visibility: hidden !important; }`;
      document.head.appendChild(styleEl);
      hidden = true;
    }
    function show() {
      document.getElementById('ls-native-hide')?.remove();
      styleEl = null; hidden = false;
    }
    function noteContent() { lastContentTs = Date.now(); hide(); }
    function start() {
      stop();
      watchdog = setInterval(() => { if (hidden && Date.now() - lastContentTs > 4000) show(); }, 2000);
      // Always restore native subs if the page/extension goes away.
      window.addEventListener('pagehide', show, { once: true });
      window.addEventListener('beforeunload', show, { once: true });
    }
    function stop() { clearInterval(watchdog); watchdog = null; }
    return { hide, show, noteContent, start, stop, isHidden: () => hidden };
  }

  // ── Panel shell ────────────────────────────────────────────────────────────
  let panelVisible = true;
  function buildPanelShell(metaLabel = 'Transcript') {
    if (document.getElementById('ls-panel')) return document.getElementById('ls-panel-list');
    const panel = document.createElement('div'); panel.id = 'ls-panel';
    panel.innerHTML = `
      <div id="ls-panel-header">
        <div><div id="ls-panel-logo">Lingua<span>Script</span></div><div id="ls-panel-meta">${metaLabel}</div></div>
        <button id="ls-panel-toggle">Hide</button>
      </div>
      <div id="ls-panel-list"></div>`;
    document.body.appendChild(panel);
    panel.querySelector('#ls-panel-toggle').addEventListener('click', () => togglePanel(false));
    return panel.querySelector('#ls-panel-list');
  }
  function togglePanel(show) {
    panelVisible = show ?? !panelVisible;
    document.getElementById('ls-panel')?.classList.toggle('ls-hidden', !panelVisible);
    document.getElementById('ls-overlay')?.classList.toggle('ls-panel-hidden', !panelVisible);
    document.getElementById('ls-controls')?.classList.toggle('ls-panel-hidden', !panelVisible);
    document.getElementById('ls-panel-btn')?.classList.toggle('ls-on', panelVisible);
  }

  // ── Controls + keyboard shortcuts ─────────────────────────────────────────────
  // spec: { seekBack, seekRepeat, seekForward, onSpeed(rate), onAutoPause(bool),
  //         onToggleOverlay(bool), extraLinks: [{label, href}] }
  function buildControls(spec) {
    if (document.getElementById('ls-controls')) return;
    const bar = document.createElement('div'); bar.id = 'ls-controls';
    const inner = document.createElement('div'); inner.id = 'ls-controls-inner'; bar.appendChild(inner);
    const mk = (label, hint, onClick, id) => {
      const b = document.createElement('button'); b.className = 'ls-btn'; if (id) b.id = id;
      b.innerHTML = hint ? `${label}<span class="ls-kbd">${hint}</span>` : label;
      b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b); });
      return b;
    };
    const sep = () => { const d = document.createElement('div'); d.className = 'ls-sep'; return d; };

    let autoPause = false;
    const apBtn = mk('A|P Off', 'Q', () => { autoPause = !autoPause; apBtn.innerHTML = `${autoPause ? 'A|P On' : 'A|P Off'}<span class="ls-kbd">Q</span>`; apBtn.classList.toggle('ls-on', autoPause); spec.onAutoPause?.(autoPause); }, 'ls-ap-btn');
    const panelBtn = mk('≡ Transcript', '', () => togglePanel(), 'ls-panel-btn'); panelBtn.classList.add('ls-on');
    const speedBtns = [0.5, 0.75, 1, 1.25, 1.5].map((sp) => {
      const b = mk(sp + '×', '', () => { spec.onSpeed?.(sp); speedBtns.forEach((x) => x.classList.remove('ls-on')); b.classList.add('ls-on'); });
      if (sp === 1) b.classList.add('ls-on');
      return b;
    });
    let overlayVisible = true;
    const hideBtn = mk('LS', '', () => { overlayVisible = !overlayVisible; hideBtn.classList.toggle('ls-on', overlayVisible); document.getElementById('ls-overlay')?.style && (document.getElementById('ls-overlay').style.opacity = overlayVisible ? '1' : '0'); spec.onToggleOverlay?.(overlayVisible); }, 'ls-hide-btn');
    hideBtn.classList.add('ls-on');

    const nodes = [
      mk('⏮', 'A', () => spec.seekBack?.()),
      mk('↩', 'S', () => spec.seekRepeat?.()),
      mk('⏭', 'D', () => spec.seekForward?.()),
      sep(), apBtn, sep(), ...speedBtns, sep(), panelBtn, hideBtn,
    ];
    (spec.extraLinks || []).forEach(({ label, href }) => {
      nodes.push(sep());
      const a = document.createElement('a'); a.className = 'ls-btn ls-link'; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label;
      nodes.push(a);
    });
    nodes.forEach((n) => inner.appendChild(n));
    document.body.appendChild(bar);

    // Reflect keyboard toggles back onto the A|P button.
    window.__lsSetAutoPause = (v) => { autoPause = v; apBtn.innerHTML = `${v ? 'A|P On' : 'A|P Off'}<span class="ls-kbd">Q</span>`; apBtn.classList.toggle('ls-on', v); };
  }

  function attachKeyboardShortcuts(spec) {
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); spec.seekRepeat?.(); }
      else if (k === 'a') { e.preventDefault(); spec.seekBack?.(); }
      else if (k === 'd') { e.preventDefault(); spec.seekForward?.(); }
      else if (k === 'q') {
        e.preventDefault();
        const next = !(spec.getAutoPause?.() ?? false);
        spec.onAutoPause?.(next); window.__lsSetAutoPause?.(next);
        showToast(next ? 'Auto-pause ON' : 'Auto-pause OFF');
      }
    }, true);
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const SHARED_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    .ls-word { cursor:pointer; border-radius:4px; padding:0 3px; transition:color .35s ease, background .12s; display:inline; }
    .ls-word:hover { background:rgba(255,255,255,0.16); }
    /* The ONE deck palette — three distinct hexes, one per deck. */
    .ls-red    { color:${Deck.PALETTE.red}   !important; }
    .ls-orange { color:${Deck.PALETTE.orange}!important; }
    .ls-green  { color:${Deck.PALETTE.green} !important; }
    /* Gold — a reward layered on green, never a deck of its own. */
    .ls-gold { color:${GOLD.core} !important; text-shadow:0 0 14px ${GOLD.glow}; }

    #ls-controls { position:fixed; z-index:2147483641; display:flex; align-items:center; justify-content:center; gap:6px; pointer-events:none; transition:right .3s ease; left:0; right:360px; }
    #ls-controls.ls-panel-hidden { right:0; }
    #ls-controls-inner { display:flex; align-items:center; gap:6px; background:rgba(10,8,20,0.92); border:1px solid ${BRAND.greenA(0.28)}; border-radius:12px; padding:7px 12px; backdrop-filter:blur(16px); pointer-events:auto; box-shadow:0 4px 24px rgba(0,0,0,0.7); font-family:'Inter',-apple-system,sans-serif; }
    .ls-btn { background:rgba(255,255,255,0.08); color:#fff; border:none; border-radius:6px; padding:5px 11px; font-size:12px; font-weight:600; cursor:pointer; transition:background .12s, transform .1s; white-space:nowrap; font-family:inherit; text-decoration:none; display:inline-flex; align-items:center; }
    .ls-btn:hover { background:rgba(255,255,255,0.2); transform:scale(1.04); }
    .ls-btn:active { transform:scale(0.96); }
    .ls-btn.ls-on { background:${BRAND.gradient}; }
    .ls-btn.ls-link { background:rgba(52,199,89,0.14); color:#34C759; }
    .ls-btn.ls-link:hover { background:rgba(52,199,89,0.24); }
    .ls-sep { width:1px; height:18px; background:rgba(255,255,255,0.13); margin:0 2px; }
    .ls-kbd { font-size:10px; color:rgba(255,255,255,0.4); margin-left:3px; }

    #ls-card { position:fixed; z-index:2147483647; width:300px; background:rgba(10,10,18,0.97); border:1px solid ${BRAND.greenA(0.4)}; border-radius:14px; padding:16px 18px 14px; font-family:'Inter',-apple-system,sans-serif; box-shadow:0 16px 48px rgba(0,0,0,0.9); backdrop-filter:blur(20px); pointer-events:auto; color:#fff; animation:ls-card-in .22s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes ls-card-in { from{opacity:0;transform:scale(.88) translateY(6px);} to{opacity:1;transform:scale(1) translateY(0);} }
    #ls-card-word { font-size:22px; font-weight:800; margin-bottom:3px; letter-spacing:-0.3px; }
    #ls-card-tier { font-size:11px; font-weight:600; letter-spacing:.04em; margin-bottom:8px; opacity:.9; }
    #ls-card-trans { min-height:20px; line-height:1.3; }
    .ls-card-section-label { font-size:10px; font-weight:600; letter-spacing:.08em; color:#666; text-transform:uppercase; margin-bottom:5px; }
    .ls-card-synonyms { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px; }
    .ls-card-syn-chip { font-size:12px; color:hsl(145 63% 68%); background:${BRAND.greenA(0.15)}; border:1px solid ${BRAND.greenA(0.25)}; border-radius:20px; padding:2px 9px; cursor:pointer; }
    .ls-card-syn-chip:hover { background:${BRAND.greenA(0.3)}; }
    .ls-card-examples { margin-bottom:12px; }
    .ls-card-example { font-size:12px; color:#999; line-height:1.5; padding:4px 0; border-left:2px solid ${BRAND.greenA(0.25)}; padding-left:8px; margin-bottom:4px; }
    .ls-card-example em { color:hsl(145 63% 68%); font-style:normal; font-weight:600; }
    #ls-card-mark-known { width:100%; padding:8px; margin-bottom:8px; border-radius:8px; background:transparent; border:1px solid rgba(52,199,89,0.4); color:#6ee7b7; font-size:12px; font-weight:700; cursor:pointer; transition:background .15s; font-family:inherit; }
    #ls-card-mark-known:hover { background:rgba(52,199,89,0.12); }
    #ls-card-save { width:100%; padding:9px; border:none; border-radius:8px; background:${BRAND.gradient}; color:#fff; font-size:13px; font-weight:700; cursor:pointer; transition:filter .15s, transform .1s; font-family:inherit; }
    #ls-card-save:hover { filter:brightness(0.92); }
    #ls-card-save:disabled { background:#1e1e2e; color:#555; cursor:default; filter:none; }
    #ls-card-close { position:absolute; top:12px; right:14px; background:none; border:none; color:#555; font-size:16px; cursor:pointer; line-height:1; }
    #ls-card-close:hover { color:#fff; }
    .ls-card-login-note { font-size:12px; color:#888; margin-bottom:10px; line-height:1.5; }
    .ls-card-login-input { width:100%; padding:7px 10px; margin-bottom:7px; background:#0d0d18; border:1px solid #2a2a40; border-radius:7px; color:#e8e8f0; font-size:12px; outline:none; box-sizing:border-box; font-family:inherit; }
    .ls-card-login-input:focus { border-color:${BRAND.green}; }
    .ls-card-login-btn { width:100%; padding:8px; border:none; border-radius:7px; background:${BRAND.gradient}; color:#fff; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; }
    .ls-card-login-btn:hover { filter:brightness(0.92); }
    .ls-card-login-err { font-size:11px; color:#f87171; margin-top:5px; min-height:14px; }

    #ls-panel { position:fixed; top:0; right:0; bottom:0; width:360px; background:rgba(7,7,12,0.98); border-left:1px solid ${BRAND.greenA(0.18)}; z-index:2147483639; display:flex; flex-direction:column; font-family:'Inter',-apple-system,sans-serif; backdrop-filter:blur(12px); transition:transform .3s cubic-bezier(0.4,0,0.2,1); }
    #ls-panel.ls-hidden { transform:translateX(360px); }
    #ls-panel-header { padding:14px 16px 12px; border-bottom:1px solid ${BRAND.greenA(0.15)}; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
    #ls-panel-logo { font-size:15px; font-weight:800; letter-spacing:-0.3px; color:#fff; }
    #ls-panel-logo span { color:#34C759; }
    #ls-panel-meta { font-size:10px; color:#555; margin-top:1px; }
    #ls-panel-toggle { background:${BRAND.greenA(0.15)}; border:1px solid ${BRAND.greenA(0.25)}; color:hsl(145 63% 70%); border-radius:6px; cursor:pointer; font-size:11px; font-weight:600; padding:4px 10px; font-family:inherit; }
    #ls-panel-toggle:hover { background:${BRAND.greenA(0.28)}; }
    #ls-panel-list { flex:1; overflow-y:auto; padding:6px 0 80px; }
    #ls-panel-list::-webkit-scrollbar { width:3px; }
    #ls-panel-list::-webkit-scrollbar-thumb { background:${BRAND.greenA(0.3)}; border-radius:2px; }
    .ls-panel-line { padding:10px 16px 8px; cursor:pointer; border-left:3px solid transparent; transition:background .12s, border-color .12s; }
    .ls-panel-line:hover { background:rgba(255,255,255,0.04); }
    .ls-panel-line.ls-current { border-left-color:${BRAND.green}; background:${BRAND.greenA(0.1)}; }
    .ls-panel-line-text { font-size:14px; color:#ccc; line-height:1.55; margin-bottom:3px; }
    .ls-panel-line.ls-current .ls-panel-line-text { color:#fff; }
    .ls-panel-line-tr { font-size:11px; color:#666; line-height:1.4; }

    #ls-toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:${BRAND.gradient}; color:#fff; padding:7px 20px; border-radius:20px; font-size:13px; font-weight:700; pointer-events:none; opacity:0; transition:opacity .2s; z-index:2147483647; font-family:-apple-system,sans-serif; }
    #ls-toast.ls-show { opacity:1; }

    /* ── Line Blast ─────────────────────────────────────────────────────────── */
    .ls-blast-clone { position:fixed; font-weight:800; color:#fbbf24; text-shadow:0 0 18px rgba(251,191,36,0.65); pointer-events:none; z-index:2147483644; will-change:transform; font-family:'Inter',-apple-system,sans-serif; }
    #ls-blast-praise { position:fixed; left:50%; top:38%; transform:translateX(-50%); z-index:2147483644; pointer-events:none; text-align:center; font-family:'Inter',-apple-system,sans-serif; animation:lb-praise-in 1.5s cubic-bezier(0.16,1,0.3,1) forwards; }
    .ls-blast-big { font-weight:900; font-style:italic; color:#fbbf24; text-shadow:0 2px 0 rgba(0,0,0,0.35), 0 0 34px rgba(251,191,36,0.5); transform:skewX(-6deg); }
    .ls-blast-sub { margin-top:2px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.2em; color:#6ee7b7; text-shadow:0 0 16px rgba(52,211,153,0.6); }
    #ls-blast-xp { position:fixed; left:50%; bottom:34%; transform:translateX(-50%); z-index:2147483644; pointer-events:none; font-weight:800; font-variant-numeric:tabular-nums; color:#6ee7b7; text-shadow:0 0 14px rgba(52,211,153,0.7); font-family:'Inter',-apple-system,sans-serif; animation:lb-xp-rise 1.3s ease-out forwards; }
    #ls-blast-glow { position:fixed; inset:0; z-index:2147483643; pointer-events:none; box-shadow:inset 0 0 90px rgba(52,211,153,0.55); animation:lb-glow .9s ease-out forwards; }
    @keyframes lb-praise-in { 0% { opacity:0; transform:translateX(-50%) scale(.4); } 12% { opacity:1; transform:translateX(-50%) scale(1.12); } 20% { transform:translateX(-50%) scale(1); } 78% { opacity:1; transform:translateX(-50%) scale(1); } 100% { opacity:0; transform:translateX(-50%) scale(1.04) translateY(-14px); } }
    @keyframes lb-xp-rise { 0% { opacity:0; transform:translateX(-50%) translateY(10px); } 18% { opacity:1; } 75% { opacity:1; } 100% { opacity:0; transform:translateX(-50%) translateY(-48px); } }
    @keyframes lb-glow { 0% { opacity:0; } 22% { opacity:1; } 100% { opacity:0; } }

    /* ── Level-up (3D chameleon) ────────────────────────────────────────────── */
    #ls-levelup { position:fixed; inset:0; z-index:2147483646; display:flex; align-items:center; justify-content:center; pointer-events:none; opacity:0; transition:opacity .35s ease; font-family:'Inter',-apple-system,sans-serif; }
    #ls-levelup.ls-in { opacity:1; }
    #ls-levelup.ls-out { opacity:0; }
    #ls-levelup-card { background:rgba(10,10,18,0.92); border:1px solid ${BRAND.greenA(0.35)}; border-radius:20px; padding:20px 32px 26px; text-align:center; backdrop-filter:blur(20px); box-shadow:0 24px 64px rgba(0,0,0,0.85); transform:scale(.85); transition:transform .35s cubic-bezier(0.34,1.56,0.64,1); }
    #ls-levelup.ls-in #ls-levelup-card { transform:scale(1); }
    #ls-levelup-3d { width:200px; height:200px; margin:0 auto; }
    #ls-levelup-kicker { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.2em; color:#999; margin-top:4px; }
    #ls-levelup-title { font-size:34px; font-weight:900; margin-top:2px; background:${BRAND.gradient}; -webkit-background-clip:text; background-clip:text; color:transparent; }

    ${CHAM_CSS}
  `;

  function injectStyles(extraCss = '') {
    // Clear any stale style node from a previous (possibly orphaned) injection
    // so a leftover native-hide rule can never strand the viewer.
    document.getElementById('ls-styles')?.remove();
    const s = document.createElement('style'); s.id = 'ls-styles';
    s.textContent = SHARED_CSS + '\n' + extraCss;
    document.head.appendChild(s);
  }

  window.LSCore = {
    keepAlive, getStorage, normalizeToken,
    setLangs, setDebug, get learningLang() { return learningLang; }, get nativeLang() { return nativeLang; },
    translate,
    // The colour feature — one module, one source of truth.
    Deck, get PALETTE() { return Deck.PALETTE; }, GOLD, MAX_GOLD_PER_LINE,
    // Back-compat aliases so adapters read cleanly.
    loadSavedWords: (force) => Deck.refresh(force),
    startWordsRefresh: () => Deck.startAutoRefresh(),
    stopWordsRefresh: () => Deck.stopAutoRefresh(),
    showToast, openCard, closeCard, makeWordSpan, makeWordSpansFor, claimGoldWord,
    SubtitleShield, buildPanelShell, togglePanel, buildControls, attachKeyboardShortcuts,
    injectStyles,
    // Brand identity, the chameleon (2D + 3D), Line Blast, and the XP bridge
    // that ties them together — see extension/BUILD.md for the vendor bundles.
    BRAND, GreenScore, LineBlast, mountChameleonReaction, mountChameleon3DLevelUp, awardXp,
  };
})();
