import { Languages } from "lucide-react";
import { useT, UI_LANGS } from "@/i18n";
import { UI_LANG_NAMES } from "@/i18n/strings";

/** Compact picker for the language the app itself is shown in. */
export const UiLanguageSwitcher = ({ className = "" }: { className?: string }) => {
  const { lang, setLang, t } = useT();
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <Languages className="w-4 h-4" aria-hidden />
      <span className="sr-only">{t("appLanguage")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="bg-transparent border border-border rounded-md px-1.5 py-1 text-foreground"
        aria-label={t("appLanguage")}
      >
        {UI_LANGS.map((l) => (
          <option key={l} value={l} className="bg-background">{UI_LANG_NAMES[l]}</option>
        ))}
      </select>
    </label>
  );
};
