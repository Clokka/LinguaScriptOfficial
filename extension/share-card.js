// Draws the "Share my progress" testimonial card on a canvas (no network).
// Used by the pop-up (popup.js) and the share page (share.html) that the
// celebrations on the video page open. Numbers come from background.js
// getProgress (real OpenSubtitles counts), never typed.
//   format "post"  = 1080×1350 (Instagram / WhatsApp / X)
//   format "story" = 1080×1920 (Instagram & WhatsApp stories)
(function () {
  const pct = (n) => `${n >= 10 || n === 0 ? n.toFixed(0) : n.toFixed(1)}%`;

  function loadLogo() {
    return new Promise((done) => {
      const img = new Image();
      img.onload = () => done(img);
      img.onerror = () => done(null);
      // As a data: URL so the canvas never counts as "tainted" and can export.
      fetch('icons/logo.svg').then((r) => r.text())
        .then((svg) => { img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; })
        .catch(() => done(null));
    });
  }

  /**
   * @param {{ kicker: string, from: number, to: number, what: string, known?: number, decks?: number, format?: 'post'|'story' }} o
   * @returns {Promise<Blob>}
   */
  async function draw(o) {
    const story = o.format === 'story';
    const W = 1080, H = story ? 1920 : 1350;
    const top = story ? 260 : 80; // stories keep clear of Instagram's own top bar
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const font = (w, px) => `${w} ${px}px Inter, system-ui, -apple-system, sans-serif`;
    const grd = x.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#0B0B0F'); grd.addColorStop(1, '#101A12');
    x.fillStyle = grd; x.fillRect(0, 0, W, H);

    const logo = await loadLogo();
    if (logo) { const h = 120, w = h * (logo.naturalWidth / logo.naturalHeight || 2); x.drawImage(logo, 80, top, w, h); }
    x.fillStyle = '#F5F5F7'; x.font = font(800, 54); x.fillText('Lingua', 330, top + 80);
    const lw = x.measureText('Lingua').width; x.fillStyle = '#34C759'; x.fillText('Script', 330 + lw, top + 80);

    let y = top + (story ? 360 : 260);
    x.fillStyle = '#A1A1AA'; x.font = font(600, 44); x.fillText(o.kicker, 80, y);
    y += story ? 220 : 180;
    x.font = font(800, 120); x.fillStyle = '#71717A'; x.fillText(pct(o.from), 80, y);
    const fw = x.measureText(pct(o.from)).width;
    x.fillStyle = '#F5F5F7'; x.font = font(700, 90); x.fillText('→', 110 + fw, y - 10);
    y += story ? 300 : 240;
    x.font = font(900, 230); x.fillStyle = '#34C759'; x.fillText(pct(o.to), 80, y);

    y += story ? 140 : 100;
    x.fillStyle = '#F5F5F7'; x.font = font(700, 52);
    let line = '';
    for (const w of o.what.split(' ')) {
      if (x.measureText(line + w).width > W - 160) { x.fillText(line.trim(), 80, y); line = ''; y += 66; }
      line += w + ' ';
    }
    x.fillText(line.trim(), 80, y);

    // Bar with 50 / 75 / 90 marks: orange = in your decks, green = known.
    const by = story ? H - 520 : H - 270, bw = W - 160;
    const bar = (w, colour) => { x.fillStyle = colour; x.beginPath(); x.roundRect(80, by, Math.max(36, w), 36, 18); x.fill(); };
    bar(bw, '#1F1F27');
    bar(bw * (o.decks ?? o.to) / 100, 'rgba(255,138,0,0.45)');
    if (o.known) bar(bw * o.known / 100, '#34C759');
    x.fillStyle = '#A1A1AA'; x.font = font(600, 28); x.textAlign = 'center';
    for (const m of [50, 75, 90]) x.fillText(`${m}%`, 80 + bw * m / 100, by + 80);
    x.textAlign = 'left';

    x.fillStyle = '#F5F5F7'; x.font = font(800, 40); x.fillText('linguascript.co.uk', 80, H - (story ? 300 : 100));
    x.fillStyle = '#71717A'; x.font = font(500, 22);
    x.fillText('Share of all words spoken in films & TV · OpenSubtitles 2018 (CC BY-SA 4.0)', 80, H - (story ? 255 : 55));
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }

  window.LSShareCard = { draw, pct };
})();
