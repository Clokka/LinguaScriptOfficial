// LinguaScript — YouTube (Language Reactor clone)
(async () => {

  // Keep MV3 service worker alive — it sleeps after 30s otherwise
  function keepAlive() {
    try {
      const port = chrome.runtime.connect({ name: 'ls-keepalive' });
      port.onDisconnect.addListener(() => setTimeout(keepAlive, 25000));
    } catch {}
  }
  keepAlive();

  function getVideoId() { return new URLSearchParams(location.search).get('v'); }
  function getStorage(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }
  function decodeHtml(t) {
    return t.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
            .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
            .replace(/\s+/g,' ').trim();
  }

  // ── Translation ────────────────────────────────────────────────────────────
  async function translate(text, targetLang, sourceLang = 'auto') {
    const sl = (sourceLang && sourceLang !== 'auto') ? sourceLang : 'fr';
    const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));

    // 1. Google GTX direct — fastest (~200ms), hard 2s timeout
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await Promise.race([fetch(url), timeout(2000)]);
      if (res.ok) {
        const data = await res.json();
        const tr = (data[0] || []).map(c => c?.[0] || '').join('').trim();
        if (tr && tr.toLowerCase() !== text.toLowerCase()) return tr;
      }
    } catch(e) {}

    // 2. Background SW (GTX → MyMemory chain)
    return new Promise(resolve => {
      let tries = 0;
      function attempt() {
        tries++;
        chrome.runtime.sendMessage({ type:'TRANSLATE', text, targetLang, sourceLang }, res => {
          if (chrome.runtime.lastError) {
            if (tries < 3) { setTimeout(attempt, 500); return; }
            resolve(null); return;
          }
          resolve(res?.translation ?? null);
        });
      }
      attempt();
    });
  }

  // ── Colour coding ─────────────────────────────────────────────────────────
  let savedWordMap = new Map();
  async function loadSavedWords() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_WORDS' }, res => {
        if (chrome.runtime.lastError || !res?.ok) { resolve(); return; }
        savedWordMap.clear();
        for (const [word, tier] of Object.entries(res.words || {})) {
          savedWordMap.set(word, tier);
        }
        savedWordMap.forEach((tier, word) => {
          document.querySelectorAll(`.ls-word[data-word="${word}"]`).forEach(el => {
            el.classList.remove('ls-red', 'ls-orange', 'ls-green');
            el.classList.add('ls-' + tier);
          });
        });
        resolve();
      });
    });
  }

  // ── InnerTube subtitle fetch ──────────────────────────────────────────────
  async function getCaptionTracksInnerTube(videoId) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ context:{ client:{ clientName:'WEB', clientVersion:'2.20240101.00.00', hl:'en', gl:'US' } }, videoId }),
      });
      const data = await res.json();
      return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    } catch { return []; }
  }

  // ── ytInitialPlayerResponse fallback (free, no API key needed) ────────────
  function getCaptionTracksFromPage() {
    try {
      const ytData = window.ytInitialPlayerResponse;
      return ytData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    } catch { return []; }
  }

  async function getCaptionTracks(videoId) {
    // 1. Try page-injected data first (instant, always fresh for current video)
    const fromPage = getCaptionTracksFromPage();
    if (fromPage.length) return fromPage;
    // 2. Fallback: InnerTube API
    return getCaptionTracksInnerTube(videoId);
  }

  function parseJson3(json) {
    return (json?.events||[]).filter(e=>e.segs&&e.tStartMs!=null).map(e=>({
      start:e.tStartMs/1000, end:(e.tStartMs+(e.dDurationMs||3000))/1000,
      text:decodeHtml(e.segs.map(s=>s.utf8||'').join('').trim()),
    })).filter(s=>s.text&&s.text!=='\n');
  }

  function parseXml(xml) {
    const re=/<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g, subs=[];
    let m; while((m=re.exec(xml))!==null){
      const text=decodeHtml(m[3].replace(/<[^>]+>/g,''));
      if(text) subs.push({ start:parseFloat(m[1]), end:parseFloat(m[1])+parseFloat(m[2]), text });
    }
    return subs;
  }

  async function downloadTrack(baseUrl, tlang, isBase) {
    for (const fmt of ['json3','srv3']) {
      try {
        const url = baseUrl+(isBase?'':`&tlang=${tlang}`)+`&fmt=${fmt}`;
        const res = await fetch(url); if(!res.ok) continue;
        const subs = fmt==='json3' ? parseJson3(await res.json()) : parseXml(await res.text());
        if(subs.length) return subs;
      } catch {}
    }
    return [];
  }

  async function fetchSubtitles(videoId, learningLang, nativeLang) {
    const tracks = await getCaptionTracks(videoId);
    if(!tracks.length) return { primary:[], secondary:[] };
    const exact=tracks.find(t=>t.languageCode===learningLang);
    const nat  =tracks.find(t=>t.languageCode===nativeLang);
    const base =exact||nat||tracks[0];
    const primary   = await downloadTrack(base.baseUrl, learningLang, base.languageCode===learningLang);
    const secondary = learningLang!==nativeLang
      ? nat ? await downloadTrack(nat.baseUrl, nativeLang, true)
            : await downloadTrack(base.baseUrl, nativeLang, false)
      : [];
    return { primary, secondary };
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if(document.getElementById('ls-styles')) return;
    const s = document.createElement('style'); s.id='ls-styles';
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

      /* ── Subtitle overlay ── */
      #ls-overlay {
        position:fixed; bottom:92px; left:0; right:380px;
        z-index:2147483640; text-align:center; pointer-events:none;
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        transition: right 0.3s ease;
      }
      #ls-overlay.ls-panel-hidden { right:0; }

      #ls-primary {
        display:inline-block; background:rgba(0,0,0,0.82);
        border-radius:6px; padding:10px 28px 14px; margin-bottom:6px;
        font-size:34px; font-weight:800;
        color:#fff; line-height:1.45; pointer-events:auto; cursor:pointer;
        text-shadow:0 2px 8px rgba(0,0,0,0.95); letter-spacing:0.01em;
        max-width:100%;
      }
      #ls-secondary {
        display:block; font-size:20px; font-weight:500;
        color:rgba(255,255,255,0.82);
        background:rgba(0,0,0,0.68); border-radius:4px;
        padding:4px 18px 6px; pointer-events:none; letter-spacing:0.01em;
        text-shadow:0 1px 4px rgba(0,0,0,0.9);
      }

      /* ── Word spans ── */
      .ls-word { cursor:pointer; border-radius:3px; padding:0 3px; transition:color 0.35s ease, background 0.12s; display:inline; }
      .ls-word:hover { background:rgba(255,255,255,0.18); }
      .ls-red    { color:#f87171; }
      .ls-orange { color:#fb923c; }
      .ls-green  { color:#4ade80; }

      /* ── Control bar ── */
      #ls-controls {
        position:fixed; bottom:22px; left:0; right:380px;
        z-index:2147483640; display:flex; align-items:center; justify-content:center; gap:6px;
        pointer-events:none; transition:right 0.3s ease;
      }
      #ls-controls.ls-panel-hidden { right:0; }
      #ls-controls-inner {
        display:flex; align-items:center; gap:6px;
        background:rgba(10,8,20,0.9); border:1px solid rgba(124,58,237,0.28);
        border-radius:12px; padding:7px 12px;
        backdrop-filter:blur(16px); pointer-events:auto;
        box-shadow:0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.1);
      }
      .ls-btn {
        background:rgba(255,255,255,0.08); color:#fff; border:none;
        border-radius:6px; padding:5px 11px; font-size:12px; font-weight:600;
        cursor:pointer; transition:background 0.12s, transform 0.1s; white-space:nowrap;
      }
      .ls-btn:hover { background:rgba(255,255,255,0.2); transform:scale(1.04); }
      .ls-btn:active { transform:scale(0.96); }
      .ls-btn.ls-on { background:#7c3aed; }
      .ls-sep { width:1px; height:18px; background:rgba(255,255,255,0.13); margin:0 2px; }
      .ls-kbd { font-size:10px; color:rgba(255,255,255,0.4); margin-left:3px; }

      /* ── Word card ── */
      #ls-card {
        position:fixed; z-index:2147483647; width:272px;
        background:rgba(10,10,18,0.95); border:1px solid rgba(124,58,237,0.4);
        border-radius:14px; padding:16px 18px 14px;
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        box-shadow:0 16px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(124,58,237,0.18);
        backdrop-filter:blur(20px); pointer-events:auto; color:#fff;
        animation:ls-card-in 0.22s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes ls-card-in {
        from { opacity:0; transform:scale(0.88) translateY(6px); }
        to   { opacity:1; transform:scale(1) translateY(0); }
      }
      #ls-card-word  { font-size:22px; font-weight:800; margin-bottom:3px; letter-spacing:-0.3px; }
      #ls-card-tier  { font-size:11px; font-weight:600; letter-spacing:0.04em; margin-bottom:10px; opacity:0.9; }
      #ls-card-trans { font-size:15px; color:#bbb; margin-bottom:14px; min-height:20px; font-style:italic; line-height:1.4; }
      #ls-card-save  {
        width:100%; padding:9px; border:none; border-radius:8px;
        background:#7c3aed; color:#fff; font-size:13px; font-weight:700; cursor:pointer;
        transition:background 0.15s, transform 0.1s;
      }
      #ls-card-save:hover { background:#6d28d9; }
      #ls-card-save:active { transform:scale(0.97); }
      #ls-card-save:disabled { background:#1e1e2e; color:#444; cursor:default; transform:none; }
      #ls-card-close {
        position:absolute; top:12px; right:14px; background:none; border:none;
        color:#444; font-size:16px; cursor:pointer; line-height:1; transition:color 0.1s;
      }
      #ls-card-close:hover { color:#fff; }

      /* ── Side panel (Language Reactor style) ── */
      #ls-panel {
        position:fixed; top:0; right:0; bottom:0; width:360px;
        background:rgba(7,7,12,0.97); border-left:1px solid rgba(124,58,237,0.18);
        z-index:2147483639; display:flex; flex-direction:column;
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        backdrop-filter:blur(12px); transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);
      }
      #ls-panel.ls-hidden { transform:translateX(360px); }

      #ls-panel-header {
        padding:14px 16px 12px;
        border-bottom:1px solid rgba(124,58,237,0.15);
        display:flex; justify-content:space-between; align-items:center;
        flex-shrink:0;
      }
      #ls-panel-logo {
        font-size:14px; font-weight:800; letter-spacing:-0.3px; color:#fff;
      }
      #ls-panel-logo span { color:#7c3aed; }
      #ls-panel-meta { font-size:10px; color:#444; margin-top:1px; }
      #ls-panel-toggle {
        background:rgba(124,58,237,0.15); border:1px solid rgba(124,58,237,0.25);
        color:#9d7bea; border-radius:6px; cursor:pointer; font-size:11px;
        font-weight:600; padding:4px 10px; transition:background 0.12s;
      }
      #ls-panel-toggle:hover { background:rgba(124,58,237,0.28); }

      #ls-panel-list { flex:1; overflow-y:auto; padding:6px 0 80px; }
      #ls-panel-list::-webkit-scrollbar { width:3px; }
      #ls-panel-list::-webkit-scrollbar-track { background:transparent; }
      #ls-panel-list::-webkit-scrollbar-thumb { background:rgba(124,58,237,0.3); border-radius:2px; }

      .ls-panel-line {
        padding:10px 16px 8px; cursor:pointer;
        border-left:3px solid transparent;
        transition:background 0.12s, border-color 0.12s;
      }
      .ls-panel-line:hover { background:rgba(255,255,255,0.04); }
      .ls-panel-line.ls-current {
        border-left-color:#7c3aed;
        background:rgba(124,58,237,0.1);
      }
      .ls-panel-line-text {
        font-size:14px; line-height:1.55; margin-bottom:3px;
        color:#ccc;
      }
      .ls-panel-line.ls-current .ls-panel-line-text { color:#fff; }
      .ls-panel-line-tr { font-size:11px; color:#555; line-height:1.4; }
      .ls-panel-line.ls-current .ls-panel-line-tr { color:#777; }

      /* ── Toast ── */
      #ls-toast {
        position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
        background:#7c3aed; color:#fff; padding:7px 20px; border-radius:20px;
        font-size:13px; font-weight:700; pointer-events:none; opacity:0;
        transition:opacity 0.2s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
        transform:translateX(-50%) translateY(6px); z-index:2147483647;
      }
      #ls-toast.ls-show { opacity:1; transform:translateX(-50%) translateY(0); }
      #ls-toast.ls-show { opacity:1; }
    `;
    document.head.appendChild(s);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    let t=document.getElementById('ls-toast');
    if(!t){t=document.createElement('div');t.id='ls-toast';document.body.appendChild(t);}
    t.textContent=msg; t.classList.add('ls-show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('ls-show'),2200);
  }

  // ── Word card ─────────────────────────────────────────────────────────────
  let activeCard=null;
  function closeCard(){ activeCard?.remove(); activeCard=null; }

  function openCard({ word, clean, fullLine, lang, nativeLang, anchorEl }) {
    closeCard();
    const tier = savedWordMap.get(clean);
    const tierLabel = tier === 'green' ? '🟢 Known' : tier === 'orange' ? '🟠 Learning' : tier === 'red' ? '🔴 New word' : '⬜ Unseen';
    const tierColor = tier === 'green' ? '#4ade80' : tier === 'orange' ? '#fb923c' : tier === 'red' ? '#f87171' : '#666';
    const alreadySaved = !!tier;

    const card=document.createElement('div'); card.id='ls-card'; activeCard=card;
    card.innerHTML=`
      <button id="ls-card-close">✕</button>
      <div id="ls-card-word">${word}</div>
      <div id="ls-card-tier" style="color:${tierColor}">${tierLabel}</div>
      <div id="ls-card-trans" style="color:#555;font-style:italic">translating…</div>
      <button id="ls-card-save"${alreadySaved ? ' disabled' : ''}>${alreadySaved ? '✓ In your flashcards' : '+ Save to flashcards'}</button>
    `;
    document.body.appendChild(card);
    card.querySelector('#ls-card-close').addEventListener('click', closeCard);

    const rect=anchorEl.getBoundingClientRect();
    let left=rect.left+rect.width/2-130;
    left=Math.max(8, Math.min(left, window.innerWidth-268));
    const top=rect.top-145<8 ? rect.bottom+8 : rect.top-145;
    card.style.left=left+'px'; card.style.top=top+'px';

    setTimeout(()=>document.addEventListener('click',e=>{if(!card.contains(e.target))closeCard();},{once:true}),0);

    let resolvedTr='';
    translate(clean, nativeLang, lang).then(tr=>{
      resolvedTr=tr||'';
      const el=card.querySelector('#ls-card-trans');
      if(el){el.style.cssText='font-size:15px;color:#ccc;margin-bottom:12px;'; el.textContent=tr||'Translation unavailable';}
    });

    card.querySelector('#ls-card-save').addEventListener('click',()=>{
      const btn=card.querySelector('#ls-card-save');
      btn.textContent='Saving…'; btn.disabled=true;
      chrome.runtime.sendMessage({type:'SAVE_WORD',word:clean,context:fullLine,language:lang,translation:resolvedTr},res=>{
        if(chrome.runtime.lastError||!res?.ok){btn.textContent='Not logged in';return;}
        savedWordMap.set(clean,'red');
        document.querySelectorAll(`.ls-word[data-word="${clean}"]`).forEach(el=>{
          el.classList.remove('ls-orange','ls-green'); el.classList.add('ls-red');
        });
        btn.textContent=res.already?'Already saved':'Saved!';
        setTimeout(closeCard,800);
      });
    });
  }

  // ── Word span ─────────────────────────────────────────────────────────────
  function makeWordSpan(word, fullLine, lang, nativeLang) {
    const clean=word.replace(/[.,!?;:"""''«»¿¡\n]/g,'').trim().toLowerCase();
    if(!clean) return document.createTextNode(word+' ');
    const span=document.createElement('span');
    span.className='ls-word'; span.dataset.word=clean; span.textContent=word+' ';
    const col=savedWordMap.get(clean); if(col) span.classList.add('ls-'+col);
    span.addEventListener('click',e=>{e.stopPropagation(); openCard({word,clean,fullLine,lang,nativeLang,anchorEl:span});});
    return span;
  }

  // ── Side panel ────────────────────────────────────────────────────────────
  let panelVisible=true;

  function buildPanel() {
    if(document.getElementById('ls-panel')) return;
    const panel=document.createElement('div'); panel.id='ls-panel';
    panel.innerHTML=`
      <div id="ls-panel-header">
        <div>
          <div id="ls-panel-logo">Lingua<span>Script</span></div>
          <div id="ls-panel-meta">Transcript</div>
        </div>
        <button id="ls-panel-toggle">Hide</button>
      </div>
      <div id="ls-panel-list"></div>
    `;
    document.body.appendChild(panel);
    document.getElementById('ls-panel-toggle').addEventListener('click',()=>togglePanel(false));
  }

  function togglePanel(show) {
    panelVisible = show ?? !panelVisible;
    const panel=document.getElementById('ls-panel');
    const overlay=document.getElementById('ls-overlay');
    const controls=document.getElementById('ls-controls');
    if(panel) panel.classList.toggle('ls-hidden',!panelVisible);
    if(overlay) overlay.classList.toggle('ls-panel-hidden',!panelVisible);
    if(controls) controls.classList.toggle('ls-panel-hidden',!panelVisible);
    const btn=document.getElementById('ls-panel-btn');
    if(btn) btn.classList.toggle('ls-on', panelVisible);
  }

  function makeWordSpansForPanel(text, lang, nativeLang) {
    const frag = document.createDocumentFragment();
    text.split(/\s+/).filter(Boolean).forEach(w=>{
      const clean=w.replace(/[.,!?;:"""''«»¿¡\n]/g,'').trim().toLowerCase();
      const span=document.createElement('span');
      const col=savedWordMap.get(clean);
      span.className = col ? 'ls-word ls-'+col : 'ls-word';
      span.textContent=w+' '; span.dataset.word=clean;
      span.addEventListener('click',e=>{
        e.stopPropagation();
        openCard({word:w, clean, fullLine:text, lang, nativeLang, anchorEl:span});
      });
      frag.appendChild(span);
    });
    return frag;
  }

  async function populatePanel(subs) {
    const list=document.getElementById('ls-panel-list');
    if(!list) return;
    list.innerHTML='';

    // Batch-fetch all translations in parallel (up to 40 at once to avoid rate limits)
    const BATCH=40;
    const translations=new Array(subs.length).fill('');
    for(let i=0; i<subs.length; i+=BATCH){
      const slice=subs.slice(i, i+BATCH);
      const results=await Promise.all(
        slice.map(s=>translate(s.text, currentNativeLang, currentLang).catch(()=>''))
      );
      results.forEach((tr,j)=>{ translations[i+j]=tr||''; });
    }

    // Render all lines at once with translations already loaded
    subs.forEach((sub,i)=>{
      const div=document.createElement('div');
      div.className='ls-panel-line'; div.dataset.idx=i;

      const textEl=document.createElement('div'); textEl.className='ls-panel-line-text';
      textEl.appendChild(makeWordSpansForPanel(sub.text, currentLang, currentNativeLang));

      const trEl=document.createElement('div'); trEl.className='ls-panel-line-tr';
      trEl.textContent=translations[i];

      div.appendChild(textEl); div.appendChild(trEl);
      div.addEventListener('click',()=>seekToSub(i));
      list.appendChild(div);
    });
  }

  function updatePanelCurrent(idx) {
    document.querySelectorAll('.ls-panel-line').forEach((el,i)=>{
      el.classList.toggle('ls-current', i===idx);
    });
    // Scroll into view
    const current=document.querySelector('.ls-panel-line.ls-current');
    if(current) current.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  let lastText=null, lastSecondarySource=null;

  function renderPrimary(text, lang, nativeLang) {
    if(text===lastText) return; lastText=text;
    const el=document.getElementById('ls-primary'); if(!el) return;
    el.innerHTML='';
    el.onclick=()=>{ const sub=primarySubs[currentSubIdx]; if(sub&&videoEl) videoEl.currentTime=sub.start; };
    text.split(/\s+/).filter(Boolean).forEach(w=>el.appendChild(makeWordSpan(w,text,lang,nativeLang)));
  }

  function renderSecondary(text) {
    const el=document.getElementById('ls-secondary'); if(!el) return;
    el.textContent=text||''; el.style.display=text?'block':'none';
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  let autoPause=false, autoPausedAt=-1, overlayVisible=true;

  function buildControls() {
    if(document.getElementById('ls-controls')) return;
    const bar=document.createElement('div'); bar.id='ls-controls';
    const inner=document.createElement('div'); inner.id='ls-controls-inner';
    bar.appendChild(inner);

    const btn=(label,hint,onClick,id)=>{
      const b=document.createElement('button'); b.className='ls-btn';
      if(id) b.id=id;
      b.innerHTML=hint ? `${label}<span class="ls-kbd">${hint}</span>` : label;
      b.addEventListener('click',e=>{e.stopPropagation();onClick();});
      return b;
    };
    const sep=()=>{const d=document.createElement('div');d.className='ls-sep';return d;};

    const apBtn=btn('A|P Off','Q',()=>{
      autoPause=!autoPause; autoPausedAt=-1;
      apBtn.innerHTML=`${autoPause?'A|P On':'A|P Off'}<span class="ls-kbd">Q</span>`;
      apBtn.classList.toggle('ls-on',autoPause);
    });

    const panelBtn=btn('≡ Transcript','',()=>togglePanel(),'ls-panel-btn');
    panelBtn.classList.add('ls-on');

    const speedBtns=[0.5,0.75,1,1.25,1.5].map(sp=>{
      const b=btn(sp+'×','',()=>{
        if(videoEl) videoEl.playbackRate=sp;
        speedBtns.forEach(b2=>b2.classList.remove('ls-on'));
        b.classList.add('ls-on');
      });
      if(sp===1) b.classList.add('ls-on');
      return b;
    });

    const hideBtn=btn('LS','',()=>{
      overlayVisible=!overlayVisible;
      hideBtn.classList.toggle('ls-on',overlayVisible);
      const ov=document.getElementById('ls-overlay');
      if(ov) ov.style.opacity=overlayVisible?'1':'0';
    });
    hideBtn.classList.add('ls-on');

    [btn('⏮','A',()=>seekToSub(currentSubIdx-1)),
     btn('↩','S',()=>seekToSub(currentSubIdx)),
     btn('⏭','D',()=>seekToSub(currentSubIdx+1)),
     sep(), apBtn, sep(), ...speedBtns, sep(), panelBtn, hideBtn
    ].forEach(el=>inner.appendChild(el));

    document.body.appendChild(bar);
  }

  function seekToSub(idx) {
    if(!primarySubs[idx]||!videoEl) return;
    currentSubIdx=idx; videoEl.currentTime=primarySubs[idx].start;
    if(videoEl.paused) videoEl.play();
    autoPausedAt=-1; lastText=null;
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  function attachKeyboardShortcuts() {
    document.addEventListener('keydown', e=>{
      // Don't fire when typing in inputs
      if(['INPUT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable) return;
      if(e.key==='s'||e.key==='S') { e.preventDefault(); seekToSub(currentSubIdx); }
      if(e.key==='a'||e.key==='A') { e.preventDefault(); seekToSub(currentSubIdx-1); }
      if(e.key==='d'||e.key==='D') { e.preventDefault(); seekToSub(currentSubIdx+1); }
      if(e.key==='q'||e.key==='Q') {
        e.preventDefault();
        autoPause=!autoPause; autoPausedAt=-1;
        const btn=document.getElementById('ls-controls')?.querySelector('.ls-btn:nth-child(6)');
        const apBtn=document.querySelector('#ls-controls .ls-btn');
        document.querySelectorAll('#ls-controls .ls-btn').forEach(b=>{
          if(b.textContent.includes('A|P')){
            b.innerHTML=`${autoPause?'A|P On':'A|P Off'}<span class="ls-kbd">Q</span>`;
            b.classList.toggle('ls-on',autoPause);
          }
        });
        showToast(autoPause?'Auto-pause ON':'Auto-pause OFF');
      }
    }, true);
  }

  // ── Main sync loop ────────────────────────────────────────────────────────
  let primarySubs=[], secondarySubs=[];
  let currentSubIdx=0, syncInterval=null, videoEl=null;
  let currentLang='fr', currentNativeLang='en';

  function startSync() {
    if(syncInterval) clearInterval(syncInterval);
    syncInterval=setInterval(()=>{
      if(!videoEl||!overlayVisible) return;
      const t=videoEl.currentTime;
      const idx=primarySubs.findIndex(s=>t>=s.start&&t<s.end);
      const overlay=document.getElementById('ls-overlay'); if(!overlay) return;

      if(idx>=0){
        if(idx!==currentSubIdx) updatePanelCurrent(idx);
        currentSubIdx=idx;
        const pSub=primarySubs[idx];
        const sSub=secondarySubs.find(s=>t>=s.start&&t<s.end);
        renderPrimary(pSub.text, currentLang, currentNativeLang);
        if(!sSub&&currentLang!==currentNativeLang){
          if(lastSecondarySource!==pSub.text){
            lastSecondarySource=pSub.text;
            translate(pSub.text,currentNativeLang,currentLang).then(tr=>{
              if(lastSecondarySource===pSub.text) renderSecondary(tr||'');
            });
          }
        } else { renderSecondary(sSub?.text||''); }
        overlay.style.opacity='1';
        // Auto-pause at end
        if(autoPause&&autoPausedAt!==idx&&t>=pSub.end-0.15){
          autoPausedAt=idx; videoEl.pause();
        }
      } else {
        overlay.style.opacity='0'; lastText=null;
      }
    },80);
  }

  async function mount(videoId) {
    document.getElementById('ls-overlay')?.remove();
    document.getElementById('ls-controls')?.remove();
    document.getElementById('ls-panel')?.remove();
    document.getElementById('ls-toast')?.remove();
    closeCard();
    if(syncInterval){clearInterval(syncInterval);syncInterval=null;}
    lastText=null; lastSecondarySource=null; currentSubIdx=0;

    injectStyles();

    const overlay=document.createElement('div'); overlay.id='ls-overlay';
    overlay.innerHTML=`<div id="ls-primary"></div><div id="ls-secondary" style="display:none"></div>`;
    document.body.appendChild(overlay);

    buildPanel();
    buildControls();
    attachKeyboardShortcuts();

    const {ls_language:lang='fr', ls_native_language:nativeLang='en'} =
      await getStorage({ls_language:'fr', ls_native_language:'en'});
    currentLang=lang; currentNativeLang=nativeLang;

    chrome.runtime.sendMessage({type:'GET_AUTH'},async res=>{
      if(res?.session) await loadSavedWords();
    });

    const {primary,secondary}=await fetchSubtitles(videoId,lang,nativeLang);
    primarySubs=primary; secondarySubs=secondary;

    if(!primary.length){
      const el=document.getElementById('ls-primary');
      if(el){el.style.cssText='opacity:0.5;font-size:13px;font-style:italic;'; el.textContent='No subtitles for this video';}
      return;
    }

    videoEl=document.querySelector('video');
    if(!videoEl){ for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,500));videoEl=document.querySelector('video');if(videoEl)break;} }
    if(!videoEl) return;
    startSync();
    populatePanel(primary); // runs async in background — panel fills in after sync starts
  }

  let activeVideoId=null;
  async function checkAndMount(){
    const id=getVideoId(); if(!id||id===activeVideoId) return;
    activeVideoId=id; await mount(id);
  }

  await checkAndMount();

  let lastHref=location.href;
  new MutationObserver(async()=>{
    if(location.href!==lastHref){ lastHref=location.href; activeVideoId=null; closeCard(); await checkAndMount(); }
  }).observe(document.body,{childList:true,subtree:true});

})();
