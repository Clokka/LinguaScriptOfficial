/**
 * Translates every visible English interface string into the learner's app
 * language, so changing native language switches the whole app at once.
 * Skips anything inside [translate="no"], .notranslate or [data-no-translate]
 * (learning-language words, subtitles in shadow DOM are never reached).
 * Translations are AI-made and cached per language on the device.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "CANVAS", "VIDEO", "IFRAME"]);
const cacheKey = (l: string) => `ls.uiCache.${l}`;

const originals = new WeakMap<Text, string>();
const placeholderOrig = new WeakMap<Element, string>();

const shouldTranslate = (s: string) => {
  const t = s.trim();
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false; // numbers, emoji, non-Latin
  if (/^https?:\/\//.test(t) || /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(t)) return false;
  return true;
};

const skipped = (el: Element | null) =>
  !!el?.closest('[translate="no"], .notranslate, [data-no-translate], [contenteditable="true"]');

export function AutoTranslate({ lang }: { lang: string }) {
  useEffect(() => {
    const restoreAll = () => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = w.nextNode())) {
        const o = originals.get(n as Text);
        if (o != null && (n as Text).nodeValue !== o) (n as Text).nodeValue = o;
      }
      document.querySelectorAll("[placeholder]").forEach((el) => {
        const o = placeholderOrig.get(el);
        if (o != null) el.setAttribute("placeholder", o);
      });
    };

    if (!lang || lang === "en") {
      restoreAll();
      return;
    }

    let cache: Record<string, string> = {};
    try { cache = JSON.parse(localStorage.getItem(cacheKey(lang)) || "{}"); } catch { /* ignore */ }
    const pending = new Set<string>();
    const inFlight = new Set<string>();
    let writing = false;
    let timer: number | undefined;
    let cancelled = false;

    const applyText = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName) || skipped(parent)) return;
      const current = node.nodeValue ?? "";
      let orig = originals.get(node);
      // Node text was changed by React since we translated it → new original.
      if (orig == null || (current !== orig && current !== cache[orig.trim()])) {
        orig = current;
        originals.set(node, orig);
      }
      const key = orig.trim();
      if (!shouldTranslate(key)) return;
      const tr = cache[key];
      if (tr) {
        const next = orig.replace(key, tr);
        if (node.nodeValue !== next) node.nodeValue = next;
      } else if (!inFlight.has(key)) pending.add(key);
    };

    const applyPlaceholder = (el: Element) => {
      if (skipped(el)) return;
      const cur = el.getAttribute("placeholder") || "";
      let orig = placeholderOrig.get(el);
      if (orig == null || (cur !== orig && cur !== cache[orig])) { orig = cur; placeholderOrig.set(el, orig); }
      if (!shouldTranslate(orig)) return;
      if (cache[orig]) { if (cur !== cache[orig]) el.setAttribute("placeholder", cache[orig]); }
      else if (!inFlight.has(orig)) pending.add(orig);
    };

    const scan = (root: Node = document.body) => {
      writing = true;
      try {
        if (root.nodeType === Node.TEXT_NODE) applyText(root as Text);
        else {
          const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let n: Node | null;
          while ((n = w.nextNode())) applyText(n as Text);
          if (root instanceof Element || root === document.body) {
            (root as Element).querySelectorAll?.("[placeholder]").forEach(applyPlaceholder);
          }
        }
      } finally { writing = false; }
      flush();
    };

    const flush = () => {
      if (!pending.size) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const batch = Array.from(pending).slice(0, 120);
        batch.forEach((k) => { pending.delete(k); inFlight.add(k); });
        try {
          const { data, error } = await supabase.functions.invoke("translate-ui", { body: { texts: batch, to: lang } });
          if (cancelled) return;
          const out: string[] = !error && Array.isArray(data?.translations) ? data.translations : [];
          batch.forEach((k, i) => { if (out[i]) cache[k] = out[i]; });
          try { localStorage.setItem(cacheKey(lang), JSON.stringify(cache)); } catch { /* full */ }
        } catch { /* keep English */ }
        batch.forEach((k) => inFlight.delete(k));
        if (!cancelled) scan();
      }, 250);
    };

    scan();
    const obs = new MutationObserver((muts) => {
      if (writing) return;
      for (const m of muts) {
        if (m.type === "characterData") scan(m.target);
        else if (m.type === "attributes" && m.target instanceof Element) { writing = true; applyPlaceholder(m.target); writing = false; flush(); }
        else m.addedNodes.forEach((n) => scan(n));
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder"] });

    return () => { cancelled = true; obs.disconnect(); window.clearTimeout(timer); };
  }, [lang]);

  return null;
}
