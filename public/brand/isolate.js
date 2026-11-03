/* Site Studio helper: open any lab with #only=N to show just its Nth element,
   full width, and report its height to the parent page. No effect without the hash.
   The lab stays invisible until the element is ready (no flash of the lab's own
   page), and changing the hash to another #only=N switches element WITHOUT a
   reload, so HQ can flick through designs instantly. */
(function () {
  if (!/only=\d/.test(location.hash)) return;
  var root = document.documentElement;
  root.style.visibility = "hidden"; // the inline head guard in each lab does this even earlier
  var css = null, cur = null, sizeFn = null, ro = null, capText = null, tries = 0, timer = 0;
  var reveal = function () { root.style.visibility = "visible"; };

  function undo() {
    if (!cur) return;
    document.querySelectorAll(".ls-keep,.ls-solo,.ls-hide").forEach(function (el) { el.classList.remove("ls-keep", "ls-solo", "ls-hide"); });
    cur.style.zoom = ""; cur.style.width = "";
    if (sizeFn) removeEventListener("resize", sizeFn);
    if (ro) ro.disconnect();
    cur = null;
  }
  function post() {
    if (!cur) return;
    try { parent.postMessage({ lsSolo: location.hash, h: Math.ceil(cur.getBoundingClientRect().height) }, "*"); } catch (e) {}
  }
  function applyCap() {
    var c = cur && cur.querySelector(".cap");
    if (c && capText !== null && c.textContent !== capText) c.textContent = capText;
  }

  function go() {
    var m = location.hash.match(/only=(\d+)/);
    if (!m) { reveal(); return; }
    var n = +m[1];
    var sel = document.querySelector(".tile") ? ".tile" : "article";
    var t = document.querySelectorAll(sel)[n];
    if (!t) { if (tries++ < 40) { timer = setTimeout(go, 100); } else reveal(); return; }
    tries = 0;
    if (css) css.disabled = true; // measure with the lab laid out normally
    // Measure while the lab is still laid out normally.
    var kids = [].slice.call(t.children), big = null, bh = -1;
    kids.forEach(function (c) { var h = c.getBoundingClientRect().height; if (h > bh) { bh = h; big = c; } });
    // Prefer the picture part when a lab names it (glass and style labs have tall text panels).
    kids.forEach(function (c) { if (/(^|\s)(stage|st|frame|view)(\s|$)/.test(c.className)) big = c; });
    var w0 = Math.max(200, Math.round(t.getBoundingClientRect().width));
    if (!css) {
      css = document.createElement("style");
      css.textContent = "html,body{margin:0!important;padding:0!important;overflow:hidden!important;min-height:0!important}" +
        "body *:not(.ls-keep):not(.ls-solo):not(.ls-solo *){display:none!important}" +
        ".ls-keep{display:block!important;margin:0!important;padding:0!important;border:0!important;width:100%!important;max-width:none!important;min-height:0!important;position:static!important;transform:none!important}" +
        ".ls-solo{margin:0 auto!important;padding:0!important;border:0!important;max-width:none!important}" +
        ".ls-solo>.ls-hide{display:none!important}";
      document.head.appendChild(css);
    }
    css.disabled = false;
    kids.forEach(function (c) { if (c !== big) c.classList.add("ls-hide"); });
    t.hidden = false;
    t.classList.add("ls-solo");
    t.style.width = w0 + "px";
    // Keep the tile in its own grid (some labs look tiles up by position); hide everything else.
    for (var a = t.parentElement; a && a !== document.body; a = a.parentElement) a.classList.add("ls-keep");
    cur = t;
    // Show the tile exactly as designed, zoomed to the frame width.
    sizeFn = function () { if (cur) cur.style.zoom = Math.min(4, (root.clientWidth || innerWidth) / w0); };
    sizeFn(); addEventListener("resize", sizeFn);
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event("resize"));
    if (window.ResizeObserver) { ro = new ResizeObserver(post); ro.observe(t); }
    post(); setTimeout(post, 600); setTimeout(post, 1800);
    applyCap();
    requestAnimationFrame(reveal);
  }

  // Video player (&live=1): the caption line shows the real status, sent by the
  // parent as {lsCap: "..."} (same origin only, plain text only). The lab may
  // redraw the tile, so the caption is found again and re-applied each time.
  if (/[#&]live=1/.test(location.hash)) {
    addEventListener("message", function (e) {
      if (e.origin === location.origin && e.data && typeof e.data.lsCap === "string") { capText = e.data.lsCap.slice(0, 120); applyCap(); }
    });
    if (window.MutationObserver) new MutationObserver(applyCap).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    try { parent.postMessage({ lsCapReady: true }, location.origin); } catch (err) {}
  }

  // A new #only=N: switch element in place, no reload.
  addEventListener("hashchange", function () { root.style.visibility = "hidden"; clearTimeout(timer); undo(); tries = 0; go(); setTimeout(reveal, 3000); });
  // Never stay invisible: show whatever is there after 3 s.
  setTimeout(reveal, 3000);

  // Live homepage (&live=1): call-to-action buttons inside the design open the
  // real page. The parent (StudioLanding) checks the origin and the path list.
  if (/[#&]live=1/.test(location.hash)) {
    var ROUTES = [
      [/log ?in|sign ?in/i, "/auth"],
      [/pric|plan|upgrade|\bpro\b/i, "/pricing"],
      [/demo/i, "/demo"],
      [/start|try|free|join|sign ?up|get |begin|create|download|install|add to|continue|let'?s go|open (the )?app/i, "/onboarding"],
      [/method/i, "/the-chameleon-method"],
      [/frequen|most common|top 3,?000/i, "/frequent-words"],
      [/blog/i, "/blog"],
      [/privacy/i, "/privacy"],
      [/terms/i, "/terms"]
    ];
    document.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest("a,button,[role=button],.b1,.b2,.btn,.cta,.go,[class*=btn],[class*=cta]");
      if (!el) return;
      var text = (el.textContent || "").trim().slice(0, 60);
      for (var i = 0; i < ROUTES.length; i++) {
        if (ROUTES[i][0].test(text)) {
          e.preventDefault(); e.stopPropagation();
          try { parent.postMessage({ lsGo: ROUTES[i][1] }, location.origin); } catch (err) {}
          return;
        }
      }
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(go, 60); });
  else setTimeout(go, 60);
})();
