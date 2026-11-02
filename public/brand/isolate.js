/* Site Studio helper: open any lab with #only=N to show just its Nth element,
   full width, and report its height to the parent page. No effect without the hash. */
(function () {
  var m = location.hash.match(/only=(\d+)/);
  if (!m) return;
  var n = +m[1];
  var tries = 0;
  function go() {
    var sel = document.querySelector(".tile") ? ".tile" : "article";
    var t = document.querySelectorAll(sel)[n];
    if (!t) { if (tries++ < 40) setTimeout(go, 150); return; }
    // Measure while the lab is still laid out normally.
    var kids = [].slice.call(t.children), big = null, bh = -1;
    kids.forEach(function (c) { var h = c.getBoundingClientRect().height; if (h > bh) { bh = h; big = c; } });
    // Prefer the picture part when a lab names it (glass and style labs have tall text panels).
    kids.forEach(function (c) { if (/(^|\s)(stage|st|frame|view)(\s|$)/.test(c.className)) big = c; });
    var w0 = Math.max(200, Math.round(t.getBoundingClientRect().width));
    var css = document.createElement("style");
    css.textContent = "html,body{margin:0!important;padding:0!important;overflow:hidden!important;min-height:0!important}" +
      "body *:not(.ls-keep):not(.ls-solo):not(.ls-solo *){display:none!important}" +
      ".ls-keep{display:block!important;margin:0!important;padding:0!important;border:0!important;width:100%!important;max-width:none!important;min-height:0!important;position:static!important;transform:none!important}" +
      ".ls-solo{margin:0 auto!important;padding:0!important;border:0!important;max-width:none!important}" +
      ".ls-solo>.ls-hide{display:none!important}";
    document.head.appendChild(css);
    kids.forEach(function (c) { if (c !== big) c.classList.add("ls-hide"); });
    t.hidden = false;
    t.classList.add("ls-solo");
    t.style.width = w0 + "px";
    // Keep the tile in its own grid (some labs look tiles up by position); hide everything else.
    for (var a = t.parentElement; a && a !== document.body; a = a.parentElement) a.classList.add("ls-keep");
    // Show the tile exactly as designed, zoomed to the frame width.
    function size() { t.style.zoom = Math.min(4, (document.documentElement.clientWidth || innerWidth) / w0); }
    size(); addEventListener("resize", size);
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event("resize"));
    function post() { try { parent.postMessage({ lsSolo: location.hash, h: Math.ceil(t.getBoundingClientRect().height) }, "*"); } catch (e) {} }
    if (window.ResizeObserver) new ResizeObserver(post).observe(t);
    post(); setTimeout(post, 600); setTimeout(post, 1800);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(go, 120); });
  else setTimeout(go, 120);
})();
