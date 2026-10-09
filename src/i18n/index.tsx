/**
 * Lightweight UI translation. The interface speaks the learner's first
 * language so a nervous beginner is reassured, not overwhelmed by English.
 * Priority: explicit choice (localStorage) > profile native_language >
 * browser language > English. Strings were AI-written; not yet reviewed
 * by native speakers.
 */
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AutoTranslate } from "./AutoTranslate";
import { STRINGS, UI_LANGS, type StringKey, type UiLang } from "./strings";

const KEY = "ls.uiLang";
// Any app language is accepted: hand-written STRINGS cover some, and
// AutoTranslate machine-translates the rest of the interface.
const isUi = (c: string | null | undefined): c is UiLang => !!c && /^[a-z]{2,3}$/.test(c);

export function detectUiLang(): UiLang {
  try {
    const saved = localStorage.getItem(KEY);
    if (isUi(saved)) return saved;
  } catch { /* ignore */ }
  const list = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const l of list) {
    const base = l?.toLowerCase().split("-")[0];
    if (isUi(base)) return base;
  }
  return "en";
}

type Ctx = { lang: UiLang; setLang: (l: string) => void; t: (k: StringKey, vars?: Record<string, string | number>) => string };
const I18nCtx = createContext<Ctx | null>(null);

const apply = (l: UiLang) => {
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>(detectUiLang);

  useEffect(() => { apply(lang); }, [lang]);

  // Signed-in learners: their profile's first language wins unless they
  // picked one explicitly on this device.
  useEffect(() => {
    const sync = async (uid?: string) => {
      if (!uid) return;
      try { if (localStorage.getItem(KEY)) return; } catch { /* ignore */ }
      const { data } = await supabase.from("profiles").select("native_language").eq("user_id", uid).maybeSingle();
      const n = (data as any)?.native_language?.toLowerCase();
      if (isUi(n)) setLangState(n);
    };
    supabase.auth.getSession().then(({ data }) => sync(data.session?.user.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN") sync(s?.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const setLang = useCallback((l: string) => {
    const code = l?.toLowerCase();
    const next: UiLang = isUi(code) ? code : "en";
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    setLangState(next);
  }, []);

  const t = useCallback((k: StringKey, vars?: Record<string, string | number>) => {
    let s: string = STRINGS[lang]?.[k] ?? STRINGS.en[k] ?? k;
    if (vars) for (const [n, v] of Object.entries(vars)) s = s.split(`{${n}}`).join(String(v));
    return s;
  }, [lang]);

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const c = useContext(I18nCtx);
  if (!c) return { lang: "en" as UiLang, setLang: () => {}, t: (k: StringKey) => STRINGS.en[k] ?? k };
  return c;
}

export { UI_LANGS };
