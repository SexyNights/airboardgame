import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./en.json";
import fr from "./fr.json";
import ja from "./ja.json";

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use(LanguageDetector)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ja: { translation: ja },
    },
    debug: false,
    fallbackLng: "en",

    keySeparator: false, // we do not use keys in form messages.welcome

    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    // There is no language switcher, so always follow the browser language
    // (?lng=xx still works for testing) and do not remember a previous choice:
    // a cached "en" from before ja existed would otherwise stick.
    detection: {
      order: ["querystring", "navigator", "htmlTag"],
      caches: [],
    },
  });

// Keep <html lang> and the page title in sync with the UI language
// (lang helps CJK font selection).
const syncHtmlLang = (lng) => {
  if (lng && typeof document !== "undefined") {
    document.documentElement.lang = lng;
    document.title = i18n.t("Air Board Game");
  }
};
i18n.on("languageChanged", syncHtmlLang);
i18n.on("initialized", () => syncHtmlLang(i18n.resolvedLanguage));
syncHtmlLang(i18n.resolvedLanguage || i18n.language);

export default i18n;
