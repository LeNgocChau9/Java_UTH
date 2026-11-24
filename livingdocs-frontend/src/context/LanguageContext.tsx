"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

export type LanguageCode = "vi" | "en-US" | "en-GB" | "zh" | "ja" | "hi" | "it";

export interface LanguageMeta {
  code: LanguageCode;
  name: string;
  nativeName: string;
  shortCode: string;
  country: string;
  flagTitle: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  {
    code: "vi",
    name: "Tiếng Việt",
    nativeName: "Tiếng Việt",
    shortCode: "VI",
    country: "Việt Nam",
    flagTitle: "Cờ Việt Nam",
  },
  {
    code: "en-US",
    name: "Tiếng Mỹ (US)",
    nativeName: "English (US)",
    shortCode: "EN-US",
    country: "Hoa Kỳ",
    flagTitle: "Cờ Hoa Kỳ",
  },
  {
    code: "en-GB",
    name: "Tiếng Anh (UK)",
    nativeName: "English (UK)",
    shortCode: "EN-UK",
    country: "Vương quốc Anh",
    flagTitle: "Cờ Vương quốc Anh",
  },
  {
    code: "zh",
    name: "Tiếng Trung",
    nativeName: "中文 (简体)",
    shortCode: "ZH",
    country: "Trung Quốc",
    flagTitle: "Cờ Trung Quốc",
  },
  {
    code: "ja",
    name: "Tiếng Nhật",
    nativeName: "日本語",
    shortCode: "JA",
    country: "Nhật Bản",
    flagTitle: "Cờ Nhật Bản",
  },
  {
    code: "hi",
    name: "Tiếng Ấn Độ",
    nativeName: "हिन्दी",
    shortCode: "HI",
    country: "Ấn Độ",
    flagTitle: "Cờ Ấn Độ",
  },
  {
    code: "it",
    name: "Tiếng Ý",
    nativeName: "Italiano",
    shortCode: "IT",
    country: "Ý",
    flagTitle: "Cờ Ý",
  },
];

// Dictionary of core UI translations across the 7 languages
const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  vi: {
    "app.madeInVietnam": "Tự hào sản phẩm Make in Vietnam",
    "app.madeInVietnamTooltip": "Nền tảng LivingDocs được thiết kế và phát triển bởi lập trình viên Việt Nam 🇻🇳",
    "app.madeInVietnamShort": "Make in Vietnam",
    "lang.select": "Chọn ngôn ngữ",
    "lang.current": "Ngôn ngữ hiển thị",
    "nav.home": "Trang chủ",
    "nav.overview": "Tổng quan",
    "nav.documents": "Quản lý tài liệu",
    "nav.repositories": "Kho lưu trữ",
    "nav.reviews": "Phê duyệt tài liệu",
    "nav.templates": "Mẫu tài liệu",
    "nav.settings": "Cài đặt",
    "nav.login": "Đăng nhập",
    "nav.logout": "Đăng xuất",
    "common.search": "Tìm kiếm...",
    "common.save": "Lưu thay đổi",
    "common.cancel": "Hủy bỏ",
    "common.exportWord": "Xuất Word (.docx)",
    "footer.proudlyCrafted": "Thiết kế & phát triển với niềm tự hào tại Việt Nam 🇻🇳",
  },
  "en-US": {
    "app.madeInVietnam": "Proudly Made in Vietnam",
    "app.madeInVietnamTooltip": "LivingDocs is designed and engineered by Vietnamese developers 🇻🇳",
    "app.madeInVietnamShort": "Made in Vietnam",
    "lang.select": "Select Language",
    "lang.current": "Display Language",
    "nav.home": "Home",
    "nav.overview": "Overview",
    "nav.documents": "Documents",
    "nav.repositories": "Repositories",
    "nav.reviews": "Approval Center",
    "nav.templates": "Templates",
    "nav.settings": "Settings",
    "nav.login": "Sign In",
    "nav.logout": "Sign Out",
    "common.search": "Search...",
    "common.save": "Save Changes",
    "common.cancel": "Cancel",
    "common.exportWord": "Export Word (.docx)",
    "footer.proudlyCrafted": "Proudly designed & developed in Vietnam 🇻🇳",
  },
  "en-GB": {
    "app.madeInVietnam": "Proudly Made in Vietnam",
    "app.madeInVietnamTooltip": "LivingDocs is designed and engineered by Vietnamese developers 🇻🇳",
    "app.madeInVietnamShort": "Made in Vietnam",
    "lang.select": "Choose Language",
    "lang.current": "Display Language",
    "nav.home": "Home",
    "nav.overview": "Overview",
    "nav.documents": "Document Management",
    "nav.repositories": "Repositories",
    "nav.reviews": "Approval Centre",
    "nav.templates": "Templates",
    "nav.settings": "Settings",
    "nav.login": "Sign In",
    "nav.logout": "Sign Out",
    "common.search": "Search...",
    "common.save": "Save Changes",
    "common.cancel": "Cancel",
    "common.exportWord": "Export Word (.docx)",
    "footer.proudlyCrafted": "Proudly designed & engineered in Vietnam 🇻🇳",
  },
  zh: {
    "app.madeInVietnam": "越南制造 · 匠心打造",
    "app.madeInVietnamTooltip": "LivingDocs 平台由越南开发者精心设计与开发 🇻🇳",
    "app.madeInVietnamShort": "越南制造",
    "lang.select": "选择语言",
    "lang.current": "当前语言",
    "nav.home": "首页",
    "nav.overview": "系统概览",
    "nav.documents": "文档管理",
    "nav.repositories": "代码仓库",
    "nav.reviews": "文档审核",
    "nav.templates": "文档模板",
    "nav.settings": "系统设置",
    "nav.login": "登录系统",
    "nav.logout": "退出登录",
    "common.search": "搜索...",
    "common.save": "保存修改",
    "common.cancel": "取消",
    "common.exportWord": "导出 Word (.docx)",
    "footer.proudlyCrafted": "由越南团队倾心设计与开发 🇻🇳",
  },
  ja: {
    "app.madeInVietnam": "ベトナム製 · 誇り高き開発",
    "app.madeInVietnamTooltip": "LivingDocs プラットフォームはベトナムの開発者によって設計・開発されました 🇻🇳",
    "app.madeInVietnamShort": "ベトナム製",
    "lang.select": "言語を選択",
    "lang.current": "表示言語",
    "nav.home": "ホーム",
    "nav.overview": "概要ダッシュボード",
    "nav.documents": "ドキュメント管理",
    "nav.repositories": "リポジトリ",
    "nav.reviews": "承認センター",
    "nav.templates": "テンプレート",
    "nav.settings": "設定",
    "nav.login": "ログイン",
    "nav.logout": "ログアウト",
    "common.search": "検索...",
    "common.save": "変更を保存",
    "common.cancel": "キャンセル",
    "common.exportWord": "Word出力 (.docx)",
    "footer.proudlyCrafted": "ベトナムで情熱を込めて開発されました 🇻🇳",
  },
  hi: {
    "app.madeInVietnam": "वियतनाम में निर्मित (Make in Vietnam)",
    "app.madeInVietnamTooltip": "LivingDocs प्लेटफॉर्म वियतनामी डेवलपर्स द्वारा गर्व से बनाया गया है 🇻🇳",
    "app.madeInVietnamShort": "वियतनाम निर्मित",
    "lang.select": "भाषा चुनें",
    "lang.current": "प्रदर्शित भाषा",
    "nav.home": "मुख्य पृष्ठ",
    "nav.overview": "अवलोकन",
    "nav.documents": "दस्तावेज़ प्रबंधन",
    "nav.repositories": "रिपॉजिटरी",
    "nav.reviews": "अनुमोदन केंद्र",
    "nav.templates": "टेम्पलेट्स",
    "nav.settings": "सेटिंग्स",
    "nav.login": "साइन इन",
    "nav.logout": "साइन आउट",
    "common.search": "खोजें...",
    "common.save": "परिवर्तन सहेजें",
    "common.cancel": "रद्द करें",
    "common.exportWord": "Word निर्यात (.docx)",
    "footer.proudlyCrafted": "वियतनाम में गर्व के साथ डिज़ाइन और निर्मित 🇻🇳",
  },
  it: {
    "app.madeInVietnam": "Fatto con orgoglio in Vietnam",
    "app.madeInVietnamTooltip": "LivingDocs è progettato e sviluppato da programmatori vietnamiti 🇻🇳",
    "app.madeInVietnamShort": "Made in Vietnam",
    "lang.select": "Seleziona lingua",
    "lang.current": "Lingua attuale",
    "nav.home": "Home",
    "nav.overview": "Panoramica",
    "nav.documents": "Documenti",
    "nav.repositories": "Repository",
    "nav.reviews": "Centro Approvazioni",
    "nav.templates": "Modelli",
    "nav.settings": "Impostazioni",
    "nav.login": "Accedi",
    "nav.logout": "Disconnetti",
    "common.search": "Cerca...",
    "common.save": "Salva modifiche",
    "common.cancel": "Annulla",
    "common.exportWord": "Esporta Word (.docx)",
    "footer.proudlyCrafted": "Orgogliosamente progettato e sviluppato in Vietnam 🇻🇳",
  },
};

const STORAGE_KEY = "livingdocs_locale";

interface LanguageContextType {
  language: LanguageCode;
  languageMeta: LanguageMeta;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  supportedLanguages: LanguageMeta[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("vi");

  // Load persisted language preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
        setLanguageState(saved);
        if (typeof document !== "undefined") {
          document.documentElement.lang = saved;
        }
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, []);

  const setLanguage = (code: LanguageCode) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
      if (typeof document !== "undefined") {
        document.documentElement.lang = code;
      }
    } catch {
      // Ignore
    }
  };

  const languageMeta = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const t = useMemo(() => {
    return (key: string, fallback?: string): string => {
      const currentDict = TRANSLATIONS[language];
      if (currentDict && currentDict[key]) {
        return currentDict[key];
      }
      // Fallback to Vietnamese dictionary
      if (TRANSLATIONS.vi && TRANSLATIONS.vi[key]) {
        return TRANSLATIONS.vi[key];
      }
      return fallback || key;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      languageMeta,
      setLanguage,
      t,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, languageMeta, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if outside provider
    const defaultMeta = SUPPORTED_LANGUAGES[0];
    return {
      language: "vi",
      languageMeta: defaultMeta,
      setLanguage: () => {},
      t: (key: string, fallback?: string) => TRANSLATIONS.vi[key] || fallback || key,
      supportedLanguages: SUPPORTED_LANGUAGES,
    };
  }
  return context;
}
