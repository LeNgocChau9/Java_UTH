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
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    shortCode: "VI",
    country: "Vietnam",
    flagTitle: "Vietnam Flag",
  },
  {
    code: "en-US",
    name: "English (US)",
    nativeName: "English (US)",
    shortCode: "EN-US",
    country: "United States",
    flagTitle: "United States Flag",
  },
  {
    code: "en-GB",
    name: "English (UK)",
    nativeName: "English (UK)",
    shortCode: "EN-UK",
    country: "United Kingdom",
    flagTitle: "United Kingdom Flag",
  },
  {
    code: "zh",
    name: "Chinese",
    nativeName: "中文 (简体)",
    shortCode: "ZH",
    country: "China",
    flagTitle: "China Flag",
  },
  {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    shortCode: "JA",
    country: "Japan",
    flagTitle: "Japan Flag",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    shortCode: "HI",
    country: "India",
    flagTitle: "India Flag",
  },
  {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    shortCode: "IT",
    country: "Italy",
    flagTitle: "Italy Flag",
  },
];

// Complete UI dictionary across all 7 supported languages
const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  vi: {
    "lang.select": "Chọn ngôn ngữ",
    "lang.count": "7 Ngôn ngữ",
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

    // Landing Hero
    "hero.title1": "Tài liệu kỹ thuật luôn mới",
    "hero.title2": "cùng nhịp thay đổi của code.",
    "hero.ribbonPrefix": "Hệ thống tự động",
    "hero.phrase0": "sống cùng từng dòng mã nguồn",
    "hero.phrase1": "chặn lệch pha ngay trên mọi PR",
    "hero.phrase2": "truy xuất tri thức chỉ trong tích tắc",
    "hero.phrase3": "bảo chứng lịch sử duyệt minh bạch",
    "hero.getStarted": "Bắt đầu ngay",
    "hero.copyCommand": "Sao chép lệnh git clone",

    // FileBox
    "filebox.folder1.label": "Tài liệu API tự đồng bộ",
    "filebox.folder1.desc": "Cập nhật tham số, kiểu trả về và hành vi hàm ngay khi mã nguồn thay đổi.",
    "filebox.folder2.label": "Cảnh báo lệch pha Pull Request",
    "filebox.folder2.desc": "Phát hiện ngay các điểm sai khác giữa mã mới và tài liệu hiện có trước khi gộp nhánh.",
    "filebox.folder3.label": "Hồ sơ kiểm duyệt hai cấp",
    "filebox.folder3.desc": "Lưu trọn lịch sử thẩm định, phê duyệt và ủy quyền minh bạch cho toàn bộ đội ngũ.",
    "filebox.folder4.label": "Đồ thị liên kết mã nguồn",
    "filebox.folder4.desc": "Trực quan hóa luồng phụ thuộc giữa các lớp, hàm và phân hệ trong một góc nhìn.",
    "filebox.folder5.label": "Kho tri thức tra cứu tức thì",
    "filebox.folder5.desc": "Hỏi đáp trực tiếp trên toàn bộ tài liệu đã xuất bản với trích dẫn nguồn chính xác.",

    // Sections
    "studio.title1": "Viết code trên máy bạn",
    "studio.title2": "tài liệu tự cập nhật bên cạnh.",
    "sync.title1": "Mã nguồn vừa thay đổi",
    "sync.title2": "tài liệu nhận ra và tự đồng bộ.",

    // CTA
    "cta.title": "Giải pháp cho tài liệu luôn mới.",
    "cta.desc": "Tự động phát hiện sai lệch, đồng bộ nội dung và quản trị tri thức dự án trong một không gian thống nhất cho đội ngũ phát triển phần mềm.",
    "cta.loginNow": "Đăng nhập ngay",

    // Footer
    "footer.brandDesc": "Nền tảng quản trị, tự động sinh và đồng bộ tài liệu kỹ thuật theo mã nguồn bằng AI.",
    "footer.colModules": "Phân hệ chính",
    "footer.colReviews": "Quy trình duyệt",
    "footer.colOpenSource": "Mã nguồn mở",
    "footer.colStandards": "Tiêu chuẩn",
    "footer.proudlyCrafted": "Thiết kế & phát triển với niềm tự hào tại Việt Nam 🇻🇳",
    "footer.byEngineers": "Phát triển bởi kỹ sư Việt Nam 🇻🇳",
  },

  "en-US": {
    "lang.select": "Select Language",
    "lang.count": "7 Languages",
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

    // Landing Hero
    "hero.title1": "Living Technical Documentation",
    "hero.title2": "synced with every code commit.",
    "hero.ribbonPrefix": "Automated engine",
    "hero.phrase0": "living alongside every line of code",
    "hero.phrase1": "blocking drift directly on every PR",
    "hero.phrase2": "retrieving knowledge in milliseconds",
    "hero.phrase3": "ensuring transparent review history",
    "hero.getStarted": "Get Started",
    "hero.copyCommand": "Copy git clone command",

    // FileBox
    "filebox.folder1.label": "Self-Syncing API Documentation",
    "filebox.folder1.desc": "Updates parameters, return types, and function behavior as code evolves.",
    "filebox.folder2.label": "Pull Request Drift Alerts",
    "filebox.folder2.desc": "Instantly detects discrepancies between new code and docs before merge.",
    "filebox.folder3.label": "Two-Tier Approval Audit Trail",
    "filebox.folder3.desc": "Records full inspection, approval, and delegation history transparently.",
    "filebox.folder4.label": "Source Code Dependency Graph",
    "filebox.folder4.desc": "Visualizes dependencies across classes, functions, and modules in one view.",
    "filebox.folder5.label": "Instant Knowledge Retrieval",
    "filebox.folder5.desc": "Q&A directly across published documentation with exact source citations.",

    // Sections
    "studio.title1": "Write code on your machine",
    "studio.title2": "docs update right alongside it.",
    "sync.title1": "Code just changed",
    "sync.title2": "docs detect and sync automatically.",

    // CTA
    "cta.title": "The solution for always up-to-date docs.",
    "cta.desc": "Automatically detect drift, sync content, and govern project knowledge in one unified workspace for engineering teams.",
    "cta.loginNow": "Sign In Now",

    // Footer
    "footer.brandDesc": "AI-powered platform to manage, generate, and synchronize technical documentation with source code.",
    "footer.colModules": "Core Modules",
    "footer.colReviews": "Review Process",
    "footer.colOpenSource": "Open Source",
    "footer.colStandards": "Standards",
    "footer.proudlyCrafted": "Proudly designed & developed in Vietnam 🇻🇳",
    "footer.byEngineers": "Engineered by Vietnamese developers 🇻🇳",
  },

  "en-GB": {
    "lang.select": "Select Language",
    "lang.count": "7 Languages",
    "nav.home": "Home",
    "nav.overview": "Overview",
    "nav.documents": "Documents",
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

    // Landing Hero
    "hero.title1": "Living Technical Documentation",
    "hero.title2": "synced with every code commit.",
    "hero.ribbonPrefix": "Automated engine",
    "hero.phrase0": "living alongside every line of code",
    "hero.phrase1": "blocking drift directly on every PR",
    "hero.phrase2": "retrieving knowledge in milliseconds",
    "hero.phrase3": "ensuring transparent review history",
    "hero.getStarted": "Get Started",
    "hero.copyCommand": "Copy git clone command",

    // FileBox
    "filebox.folder1.label": "Self-Syncing API Documentation",
    "filebox.folder1.desc": "Updates parameters, return types, and function behaviour as code evolves.",
    "filebox.folder2.label": "Pull Request Drift Alerts",
    "filebox.folder2.desc": "Instantly detects discrepancies between new code and docs before merge.",
    "filebox.folder3.label": "Two-Tier Approval Audit Trail",
    "filebox.folder3.desc": "Records full inspection, approval, and delegation history transparently.",
    "filebox.folder4.label": "Source Code Dependency Graph",
    "filebox.folder4.desc": "Visualises dependencies across classes, functions, and modules in one view.",
    "filebox.folder5.label": "Instant Knowledge Retrieval",
    "filebox.folder5.desc": "Q&A directly across published documentation with exact source citations.",

    // Sections
    "studio.title1": "Write code on your machine",
    "studio.title2": "docs update right alongside it.",
    "sync.title1": "Code just changed",
    "sync.title2": "docs detect and sync automatically.",

    // CTA
    "cta.title": "The solution for always up-to-date docs.",
    "cta.desc": "Automatically detect drift, sync content, and govern project knowledge in one unified workspace for engineering teams.",
    "cta.loginNow": "Sign In Now",

    // Footer
    "footer.brandDesc": "AI-powered platform to manage, generate, and synchronise technical documentation with source code.",
    "footer.colModules": "Core Modules",
    "footer.colReviews": "Review Process",
    "footer.colOpenSource": "Open Source",
    "footer.colStandards": "Standards",
    "footer.proudlyCrafted": "Proudly designed & engineered in Vietnam 🇻🇳",
    "footer.byEngineers": "Engineered by Vietnamese developers 🇻🇳",
  },

  zh: {
    "lang.select": "选择语言",
    "lang.count": "7 种语言",
    "nav.home": "首页",
    "nav.overview": "概览",
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

    // Landing Hero
    "hero.title1": "技术文档始终保持最新",
    "hero.title2": "随每一次代码变更实时同步。",
    "hero.ribbonPrefix": "自动化引擎",
    "hero.phrase0": "与每一行源代码共同进化",
    "hero.phrase1": "在每个 PR 上杜绝文档漂移",
    "hero.phrase2": "毫秒级检索团队技术知识",
    "hero.phrase3": "保障透明且不可篡改的审批记录",
    "hero.getStarted": "立即体验",
    "hero.copyCommand": "复制 git clone 命令",

    // FileBox
    "filebox.folder1.label": "自动同步的 API 技术文档",
    "filebox.folder1.desc": "随着代码演进，自动更新参数、返回类型和函数行为。",
    "filebox.folder2.label": "Pull Request 漂移预警",
    "filebox.folder2.desc": "在分支合并前，立即检测新代码与现有文档之间的不一致。",
    "filebox.folder3.label": "两级审核合规审计追踪",
    "filebox.folder3.desc": "完整记录审查、审批与授权历史，为整个团队提供透明追溯。",
    "filebox.folder4.label": "源代码依赖关系图谱",
    "filebox.folder4.desc": "在单一视图中直观呈现类、函数和模块之间的依赖流向。",
    "filebox.folder5.label": "即时检索技术知识库",
    "filebox.folder5.desc": "直接在已发布的文档上进行问答，提供精确的来源引用。",

    // Sections
    "studio.title1": "在本地编写代码",
    "studio.title2": "文档在侧边实时自动更新。",
    "sync.title1": "代码刚刚更新",
    "sync.title2": "文档立即识别并自动同步。",

    // CTA
    "cta.title": "让技术文档永不过时的终极方案。",
    "cta.desc": "自动检测漂移，同步内容并在统一工作区中管理项目技术知识，赋能现代软件团队。",
    "cta.loginNow": "立即登录",

    // Footer
    "footer.brandDesc": "基于 AI 的技术文档管理、自动生成与代码实时同步平台。",
    "footer.colModules": "核心模块",
    "footer.colReviews": "审核流程",
    "footer.colOpenSource": "开源项目",
    "footer.colStandards": "合规标准",
    "footer.proudlyCrafted": "由越南团队倾心设计与开发 🇻🇳",
    "footer.byEngineers": "由越南工程师团队打造 🇻🇳",
  },

  ja: {
    "lang.select": "言語を選択",
    "lang.count": "7言語",
    "nav.home": "ホーム",
    "nav.overview": "概要",
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

    // Landing Hero
    "hero.title1": "常に最新の技術ドキュメント",
    "hero.title2": "コード変更にリアルタイム追従。",
    "hero.ribbonPrefix": "自動化エンジン",
    "hero.phrase0": "コードの全行と同期して更新",
    "hero.phrase1": "すべてのPRでドキュメント乖離を防止",
    "hero.phrase2": "ミリ秒単位でナレッジを即時検索",
    "hero.phrase3": "透明で信頼できるレビュー履歴を保証",
    "hero.getStarted": "今すぐ始める",
    "hero.copyCommand": "git clone コマンドをコピー",

    // FileBox
    "filebox.folder1.label": "自己同期型 API ドキュメント",
    "filebox.folder1.desc": "コード変更に伴い引数、戻り値、関数の振る舞いを自動更新。",
    "filebox.folder2.label": "プルリクエスト乖離アラート",
    "filebox.folder2.desc": "マージ前に新コードと既存ドキュメントの差異を即時検出。",
    "filebox.folder3.label": "2段階承認監査証跡",
    "filebox.folder3.desc": "チーム全体で透明な審査、承認、委任の完全な履歴を記録。",
    "filebox.folder4.label": "ソースコード依存関係グラフ",
    "filebox.folder4.desc": "クラス、関数、モジュール間の依存関係をひとつの画面で可視化。",
    "filebox.folder5.label": "即時ナレッジ検索リポジトリ",
    "filebox.folder5.desc": "公開ドキュメント全体で正確なソース引用付きの直接QAが可能。",

    // Sections
    "studio.title1": "手元の環境でコードを書く",
    "studio.title2": "横でドキュメントが自動更新される。",
    "sync.title1": "コードが変更された瞬間",
    "sync.title2": "ドキュメントが検知して自動同期。",

    // CTA
    "cta.title": "常に最新のドキュメントを維持するソリューション。",
    "cta.desc": "開発チームのための統合空間で、乖離の自動検出、コンテンツ同期、ナレッジ管理を実現。",
    "cta.loginNow": "今すぐログイン",

    // Footer
    "footer.brandDesc": "AIを活用したソースコード同期型技術ドキュメント管理・自動生成プラットフォーム。",
    "footer.colModules": "主要モジュール",
    "footer.colReviews": "レビュープロセス",
    "footer.colOpenSource": "オープンソース",
    "footer.colStandards": "標準仕様",
    "footer.proudlyCrafted": "ベトナムで情熱を込めて開発されました 🇻🇳",
    "footer.byEngineers": "ベトナムのエンジニアチームが開発 🇻🇳",
  },

  hi: {
    "lang.select": "भाषा चुनें",
    "lang.count": "7 भाषाएँ",
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

    // Landing Hero
    "hero.title1": "जीवंत तकनीकी दस्तावेज़ीकरण",
    "hero.title2": "कोड में हर बदलाव के साथ हमेशा सिंक।",
    "hero.ribbonPrefix": "स्वचालित प्रणाली",
    "hero.phrase0": "कोड की हर पंक्ति के साथ तालमेल",
    "hero.phrase1": "हर PR पर विचलन को तुरंत रोकें",
    "hero.phrase2": "मिलीसेकंड में ज्ञान प्राप्त करें",
    "hero.phrase3": "पारदर्शी समीक्षा इतिहास सुनिश्चित करें",
    "hero.getStarted": "अभी शुरू करें",
    "hero.copyCommand": "git clone कमांड कॉपी करें",

    // FileBox
    "filebox.folder1.label": "स्व-सिंक एपीआई दस्तावेज़ीकरण",
    "filebox.folder1.desc": "कोड बदलने पर पैरामीटर, रिटर्न प्रकार और फ़ंक्शन व्यवहार को अपडेट करता है।",
    "filebox.folder2.label": "पुल रिक्वेस्ट ड्रिफ्ट अलर्ट",
    "filebox.folder2.desc": "मर्ज करने से पहले नए कोड और दस्तावेज़ों के बीच अंतर का पता लगाता है।",
    "filebox.folder3.label": "दो-स्तरीय अनुमोदन ऑडिट ट्रेल",
    "filebox.folder3.desc": "पूरी टीम के लिए पारदर्शिता से समीक्षा और अनुमोदन का इतिहास दर्ज करता है।",
    "filebox.folder4.label": "स्रोत कोड निर्भरता ग्राफ़",
    "filebox.folder4.desc": "एक दृश्य में वर्गों, फ़ंक्शनों और मॉड्यूल के बीच निर्भरता को विज़ुअलाइज़ करता है।",
    "filebox.folder5.label": "त्वरित ज्ञान पुनर्प्राप्ति",
    "filebox.folder5.desc": "सटीक स्रोत उद्धरणों के साथ प्रकाशित दस्तावेज़ों पर सीधे प्रश्नोत्तर।",

    // Sections
    "studio.title1": "अपनी मशीन पर कोड लिखें",
    "studio.title2": "दस्तावेज़ साथ-साथ स्वचालित रूप से अपडेट होते हैं।",
    "sync.title1": "कोड अभी बदला है",
    "sync.title2": "दस्तावेज़ पहचानते हैं और स्वचालित रूप से सिंक होते हैं।",

    // CTA
    "cta.title": "हमेशा अद्यतन दस्तावेज़ीकरण का समाधान।",
    "cta.desc": "सॉफ़्टवेयर टीमों के लिए एक एकीकृत स्थान में ड्रिफ्ट का पता लगाएं, सामग्री सिंक करें और ज्ञान प्रबंधित करें।",
    "cta.loginNow": "अभी साइन इन करें",

    // Footer
    "footer.brandDesc": "स्रोत कोड के साथ तकनीकी दस्तावेज़ों को प्रबंधित, उत्पन्न और सिंक करने वाला एआई-संचालित प्लेटफ़ॉर्म।",
    "footer.colModules": "मुख्य मॉड्यूल",
    "footer.colReviews": "समीक्षा प्रक्रिया",
    "footer.colOpenSource": "ओपन सोर्स",
    "footer.colStandards": "मानक",
    "footer.proudlyCrafted": "वियतनाम में गर्व के साथ डिज़ाइन और निर्मित 🇻🇳",
    "footer.byEngineers": "वियतनामी इंजीनियरों द्वारा विकसित 🇻🇳",
  },

  it: {
    "lang.select": "Seleziona lingua",
    "lang.count": "7 Lingue",
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

    // Landing Hero
    "hero.title1": "Documentazione tecnica sempre viva",
    "hero.title2": "in sintonia con ogni riga di codice.",
    "hero.ribbonPrefix": "Motore automatizzato",
    "hero.phrase0": "vive con ogni riga di codice",
    "hero.phrase1": "blocca il drift direttamente su ogni PR",
    "hero.phrase2": "recupera la conoscenza in millisecondi",
    "hero.phrase3": "garantisce una cronologia di revisione trasparente",
    "hero.getStarted": "Inizia ora",
    "hero.copyCommand": "Copia comando git clone",

    // FileBox
    "filebox.folder1.label": "Documentazione API auto-sincronizzata",
    "filebox.folder1.desc": "Aggiorna parametri, tipi di ritorno e comportamenti al variare del codice.",
    "filebox.folder2.label": "Avvisi di drift sulle Pull Request",
    "filebox.folder2.desc": "Rileva subito discrepanze tra nuovo codice e documentazione prima del merge.",
    "filebox.folder3.label": "Tracciamento approvazione a due livelli",
    "filebox.folder3.desc": "Registra in modo trasparente l'intera cronologia di revisione e approvazione.",
    "filebox.folder4.label": "Grafo delle dipendenze del codice",
    "filebox.folder4.desc": "Visualizza i flussi di dipendenza tra classi, funzioni e moduli in un'unica vista.",
    "filebox.folder5.label": "Ricerca istantanea della conoscenza",
    "filebox.folder5.desc": "Domande e risposte direttamente sulla documentazione con citazioni precise.",

    // Sections
    "studio.title1": "Scrivi codice sul tuo computer",
    "studio.title2": "la documentazione si aggiorna al tuo fianco.",
    "sync.title1": "Il codice è appena cambiato",
    "sync.title2": "la documentazione lo rileva e si sincronizza.",

    // CTA
    "cta.title": "La soluzione per documenti sempre aggiornati.",
    "cta.desc": "Rileva automaticamente il drift, sincronizza i contenuti e gestisci la conoscenza in uno spazio unificato per i team di sviluppo.",
    "cta.loginNow": "Accedi ora",

    // Footer
    "footer.brandDesc": "Piattaforma basata su AI per gestire, generare e sincronizzare la documentazione con il codice.",
    "footer.colModules": "Moduli principali",
    "footer.colReviews": "Processo di revisione",
    "footer.colOpenSource": "Open Source",
    "footer.colStandards": "Standard",
    "footer.proudlyCrafted": "Orgogliosamente progettato e sviluppato in Vietnam 🇻🇳",
    "footer.byEngineers": "Sviluppato da ingegneri vietnamiti 🇻🇳",
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
