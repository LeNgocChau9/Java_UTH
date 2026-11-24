"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ChevronUp,
  Copy,
  Check,
  Send,
  RefreshCw,
  X,
  Terminal,
} from "lucide-react";
import PresenceCards from "@/components/library/PresenceCards";
import ReaderCard from "@/components/library/ReaderCard";
import ThemeSwitch from "@/components/library/ThemeSwitch";
import FileBox, { type FileBoxColor } from "@/components/library/FileBox";
import FileBoxGallery from "@/components/library/FileBoxGallery";
import DeskComputer from "@/components/library/DeskComputer";
import TechStackBanner from "@/components/library/TechStackBanner";
import CodeDocSyncStage from "@/components/library/CodeDocSyncStage";
import LampDocSpotlight from "@/components/library/LampDocSpotlight";
import { aiChatService, type ChatMessage } from "@/services/aiChatService";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

gsap.registerPlugin(ScrollTrigger);

export default function LivingDocsYouMindLandingPage() {
  const { t } = useLanguage();
  const pageRef = useRef<HTMLDivElement>(null);

  // Dynamic Translations for Hero Phrases
  const heroPhrases = useMemo(
    () => [
      t("hero.phrase0", "sống cùng từng dòng mã nguồn"),
      t("hero.phrase1", "chặn lệch pha ngay trên mọi PR"),
      t("hero.phrase2", "truy xuất tri thức chỉ trong tích tắc"),
      t("hero.phrase3", "bảo chứng lịch sử duyệt minh bạch"),
    ],
    [t]
  );

  // Dynamic Translations for FileBox Folders
  const fileboxFolders = useMemo<{
    position: number;
    color: FileBoxColor;
    dot: string;
    label: string;
    desc: string;
  }[]>(
    () => [
      {
        position: 1,
        color: "green",
        dot: "#22A862",
        label: t("filebox.folder1.label", "Tài liệu API tự đồng bộ"),
        desc: t("filebox.folder1.desc", "Cập nhật tham số, kiểu trả về và hành vi hàm ngay khi mã nguồn thay đổi."),
      },
      {
        position: 2,
        color: "orange",
        dot: "#F8B02A",
        label: t("filebox.folder2.label", "Cảnh báo lệch pha Pull Request"),
        desc: t("filebox.folder2.desc", "Phát hiện ngay các điểm sai khác giữa mã mới và tài liệu hiện có trước khi gộp nhánh."),
      },
      {
        position: 3,
        color: "pink",
        dot: "#E28CE6",
        label: t("filebox.folder3.label", "Hồ sơ kiểm duyệt hai cấp"),
        desc: t("filebox.folder3.desc", "Lưu trọn lịch sử thẩm định, phê duyệt và ủy quyền minh bạch cho toàn bộ đội ngũ."),
      },
      {
        position: 4,
        color: "beige",
        dot: "#D9B37C",
        label: t("filebox.folder4.label", "Đồ thị liên kết mã nguồn"),
        desc: t("filebox.folder4.desc", "Trực quan hóa luồng phụ thuộc giữa các lớp, hàm và phân hệ trong một góc nhìn."),
      },
      {
        position: 5,
        color: "green",
        dot: "#167F46",
        label: t("filebox.folder5.label", "Kho tri thức tra cứu tức thì"),
        desc: t("filebox.folder5.desc", "Hỏi đáp trực tiếp trên toàn bộ tài liệu đã xuất bản với trích dẫn nguồn chính xác."),
      },
    ],
    [t]
  );

  // Global Landing Page Light / Dark Theme (syncs entire page, PresenceCards & ReaderCard)
  const [pageTheme, setPageTheme] = useState<"light" | "dark">("light");
  const isDark = pageTheme === "dark";

  // Kinetic Hero Rotating Phrase
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIdx((p) => (p + 1) % heroPhrases.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [heroPhrases]);

  // Copy CLI Command (with fallback for non-HTTPS contexts)
  const [copiedCmd, setCopiedCmd] = useState(false);
  const handleCopyCommand = () => {
    const cmd = "git clone https://github.com/LeNgocChau9/Java_UTH";
    const markCopied = () => {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    };

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(cmd)
        .then(markCopied)
        .catch(() => {
          const ta = document.createElement("textarea");
          ta.value = cmd;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          markCopied();
        });
    } else if (typeof document !== "undefined") {
      const ta = document.createElement("textarea");
      ta.value = cmd;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      markCopied();
    }
  };

  // Interactive Final CTA Hover Lamp Spotlight State (OFF until hovered)
  const [lampOn, setLampOn] = useState(false);

  // Back-to-top button visibility once user scrolls down
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 180);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Interactive PinUI FileBox pulled folder state + 1.25s auto-rotating banner
  const [pulledFolder, setPulledFolder] = useState<{
    color: FileBoxColor;
    position: number;
  }>({ color: "green", position: 1 });

  const activeFolderInfo =
    fileboxFolders.find((f) => f.position === pulledFolder.position) ??
    fileboxFolders[0];

  // Rotate FileBox banner continuously every 1.25s right from initial load
  useEffect(() => {
    const timer = setInterval(() => {
      setPulledFolder((prev) => {
        const nextIdx = prev.position % fileboxFolders.length;
        const next = fileboxFolders[nextIdx];
        return { color: next.color, position: next.position };
      });
    }, 1250);
    return () => clearInterval(timer);
  }, [fileboxFolders]);

  // Floating ZAZA AI Assistant Drawer
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);
  const [askAiInput, setAskAiInput] = useState("");
  const [askAiLoading, setAskAiLoading] = useState(false);
  const [askAiMessages, setAskAiMessages] = useState<ChatMessage[]>([
    {
      id: "init-zaza",
      role: "assistant",
      content:
        "Xin chào! Tôi là **ZAZA AI** của LivingDocs.\n\nTôi có thể giải đáp nhanh về:\n• Cây cú pháp AST Tree-sitter & Độ phủ tài liệu\n• Cơ chế phát hiện Drift & GitHub Checks Gate\n• Tìm kiếm ngữ nghĩa pgvector 768 chiều",
      timestamp: "Vừa xong",
    },
  ]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAskAiOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isAskAiOpen, askAiMessages]);

  const handleSendAskAi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = askAiInput.trim();
    if (!q || askAiLoading) return;

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: q,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setAskAiMessages((prev) => [...prev, userMsg]);
    setAskAiInput("");
    setAskAiLoading(true);

    try {
      const res = await aiChatService.sendMessage(q, askAiMessages);
      setAskAiMessages((prev) => [
        ...prev,
        {
          id: "b-" + Date.now(),
          role: "assistant",
          content: res.reply,
          provider: res.provider,
          model: res.model,
          citations: res.citations,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch {
      setAskAiMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content:
            "LivingDocs tự động bóc tách AST, kiểm soát drift trên GitHub PR và đồng bộ tài liệu vào PostgreSQL pgvector. Bạn có thể đăng nhập để trải nghiệm đầy đủ!",
          provider: "fallback",
          model: "Offline Helper",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setAskAiLoading(false);
    }
  };

  // ─── GSAP KINETIC TEXT & SCROLL MOTION ENGINE ───
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero staggered kinetic reveal
      const heroKinetic = pageRef.current?.querySelectorAll(".hero-kinetic");
      if (heroKinetic && heroKinetic.length > 0) {
        gsap.from(heroKinetic, {
          y: 34,
          opacity: 0,
          duration: 0.75,
          stagger: 0.09,
          ease: "power3.out",
          clearProps: "transform",
        });
      }

      // Hero right PresenceCards float-in
      const heroStage = pageRef.current?.querySelectorAll(".hero-stage-card");
      if (heroStage && heroStage.length > 0) {
        gsap.from(heroStage, {
          y: 42,
          scale: 0.96,
          opacity: 0,
          duration: 0.9,
          delay: 0.18,
          ease: "power3.out",
          clearProps: "transform",
        });
      }

      // Scroll-triggered section reveals
      gsap.utils.toArray<HTMLElement>(".motion-section").forEach((section) => {
        gsap.from(section, {
          y: 36,
          opacity: 0,
          duration: 0.72,
          ease: "power3.out",
          clearProps: "transform",
          scrollTrigger: {
            trigger: section,
            start: "top 84%",
            once: true,
          },
        });
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={pageRef}
      data-ld-theme={pageTheme}
      className="min-h-screen overflow-x-hidden font-sans antialiased transition-colors duration-300 selection:bg-[#FDE68A] selection:text-[#211D16]"
      style={{
        backgroundColor: "var(--ld-bg)",
        color: "var(--ld-ink)",
      }}
    >
      {/* ─── SCOPED THEME VARIABLES & KINETIC KEYFRAMES ─── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          [data-ld-theme="light"] {
            --ld-bg: #FFFCF5;
            --ld-bg-soft: #F5EFE6;
            --ld-surface: #FFFFFF;
            --ld-surface-hover: #FFF8EB;
            --ld-ink: #211D16;
            --ld-muted: #6D6255;
            --ld-border: #211D16;
            --ld-shadow: #211D16;
            --ld-header-bg: rgba(255, 252, 245, 0.92);
            --ld-pill-bg: #F5EFE6;
            --ld-dot: rgba(33, 29, 22, 0.14);
            --ld-cta-bg: #FEF08A;
          }
          [data-ld-theme="dark"] {
            --ld-bg: #0F0F11;
            --ld-bg-soft: #151519;
            --ld-surface: #1B1B20;
            --ld-surface-hover: #23232A;
            --ld-ink: #F5F5F7;
            --ld-muted: #A1A1AA;
            --ld-border: #32323D;
            --ld-shadow: #000000;
            --ld-header-bg: rgba(15, 15, 17, 0.9);
            --ld-pill-bg: #23232B;
            --ld-dot: rgba(255, 255, 255, 0.08);
            --ld-cta-bg: #1F1B18;
          }
          @keyframes ld-phrase-in {
            0% { opacity: 0; transform: translateY(14px) scale(0.98); filter: blur(4px); }
            100% { opacity: 1; transform: translateY(0px) scale(1); filter: blur(0px); }
          }
          @keyframes ld-float-badge {
            0%, 100% { transform: translateY(0px) rotate(-1deg); }
            50% { transform: translateY(-5px) rotate(1deg); }
          }
          .ym-card {
            background-color: var(--ld-surface);
            border: 2px solid var(--ld-border);
            box-shadow: 3px 3px 0 var(--ld-shadow);
            transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
                        box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1),
                        background-color 200ms ease,
                        border-color 200ms ease;
          }
          .ym-card:hover {
            transform: translate(-2px, -3px);
            box-shadow: 6px 6px 0 var(--ld-shadow);
            background-color: var(--ld-surface-hover);
          }
          .ym-btn-primary {
            background-color: #211D16;
            color: #FFFCF5;
            border: 2px solid #211D16;
            box-shadow: 3px 3px 0 #E8523B;
            transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
                        box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1),
                        background-color 180ms ease;
          }
          [data-ld-theme="dark"] .ym-btn-primary {
            background-color: #FFFFFF;
            color: #111113;
            border-color: #FFFFFF;
          }
          .ym-btn-primary:hover {
            transform: translate(-2px, -2px);
            box-shadow: 5px 5px 0 #E8523B;
            background-color: #2f2920;
          }
          [data-ld-theme="dark"] .ym-btn-primary:hover {
            background-color: #F4F4F5;
          }
          .ym-btn-primary:active {
            transform: translate(1px, 1px);
            box-shadow: 1px 1px 0 #E8523B;
          }
          .ym-btn-secondary {
            background-color: var(--ld-surface);
            color: var(--ld-ink);
            border: 2px solid var(--ld-border);
            box-shadow: 2px 2px 0 var(--ld-shadow);
            transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
                        box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1),
                        background-color 180ms ease;
          }
          .ym-btn-secondary:hover {
            transform: translate(-1.5px, -1.5px);
            box-shadow: 4px 4px 0 var(--ld-shadow);
            background-color: var(--ld-surface-hover);
          }
          .ym-btn-secondary:active {
            transform: translate(1px, 1px);
            box-shadow: 1px 1px 0 var(--ld-shadow);
          }
          @keyframes ld-slow-metrics {
            0% {
              transform: translateX(0%);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          .ld-metrics-track {
            display: flex;
            width: max-content;
            animation: ld-slow-metrics 85s linear infinite;
          }
          .ld-metrics-track:hover {
            animation-play-state: paused;
          }
          .ld-filebox-stage .pfbox {
            --pfbox-bg: transparent !important;
            background: transparent !important;
            overflow: visible !important;
          }
          .ld-filebox-stage .pfbox__grain {
            display: none !important;
          }
          .ld-filebox-stage .pfbox__art {
            transform: scale(1.52) translateY(-2%);
            transform-origin: 50% 56%;
          }
        `,
        }}
      />

      {/* ───────────────────────────────────────────────────────────
          1. EDGE-TO-EDGE FIXED NAVBAR
          Logo góc trái · 4 Biểu tượng (GitHub, Discord, X, Theme Switch) + Nút Đăng nhập lớn bên phải
      ─────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 w-full backdrop-blur-md transition-colors duration-300"
        style={{ backgroundColor: "var(--ld-header-bg)" }}
      >
        <div className="flex h-[72px] w-full items-center justify-between gap-4 px-5 lg:px-10">
          {/* Left Corner: Logo */}
          <Link
            href="/"
            aria-label="LivingDocs Trang chủ"
            className="group flex items-center"
          >
            <div
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border-2 bg-white transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105"
              style={{
                borderColor: "var(--ld-border)",
                boxShadow: "2px 2px 0 var(--ld-shadow)",
              }}
            >
              <Image
                src="/logo.png"
                alt="LivingDocs"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          </Link>

          {/* Right Corner: Social Icons + PinUI Theme Switch + Larger Login CTA */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* GitHub Icon */}
            <a
              href="https://github.com/LeNgocChau9/Java_UTH"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              title="GitHub"
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
                isDark
                  ? "text-[#A1A1AA] hover:bg-white/15 hover:text-white"
                  : "text-[#211D16] hover:bg-[#211D16] hover:text-white"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>

            {/* Discord Icon */}
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noreferrer"
              aria-label="Discord"
              title="Discord"
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
                isDark
                  ? "text-[#A1A1AA] hover:bg-white/15 hover:text-white"
                  : "text-[#211D16] hover:bg-[#211D16] hover:text-white"
              }`}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>

            {/* X Icon */}
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              aria-label="X"
              title="X"
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
                isDark
                  ? "text-[#A1A1AA] hover:bg-white/15 hover:text-white"
                  : "text-[#211D16] hover:bg-[#211D16] hover:text-white"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* PinUI Droplet Flood Theme Switch */}
            <ThemeSwitch theme={pageTheme} onChange={setPageTheme} />

            {/* Language Switcher */}
            <LanguageSwitcher variant="landing" isDark={isDark} />

            {/* Subtle Divider */}
            <span
              className="mx-1 hidden h-6 w-[1.5px] sm:inline-block"
              style={{
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.16)"
                  : "rgba(33,29,22,0.18)",
              }}
            />

            {/* Larger, Balanced Login CTA */}
            <Link
              href="/login"
              className="ym-btn-primary inline-flex items-center rounded-full px-7 py-2.5 text-sm font-extrabold"
            >
              <span>{t("nav.login", "Đăng nhập")}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────
          1.5. TOP TECH STACK MARQUEE BANNER (Directly under Navbar)
      ─────────────────────────────────────────────────────────── */}
      <TechStackBanner isDark={isDark} />

      {/* ───────────────────────────────────────────────────────────
          2. KINETIC EDITORIAL HERO + WIDE RECTANGULAR <PresenceCards />
      ─────────────────────────────────────────────────────────── */}
      <section className="relative z-20 mx-auto flex max-w-[1480px] items-center px-5 pt-8 pb-4 lg:px-10 lg:pt-12 lg:pb-6">
        {/* Subtle Editorial Dot Pattern */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-50"
          style={{
            backgroundImage: "radial-gradient(var(--ld-dot) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Ambient Spotlight Glow behind the Right Rectangular Frame */}
        <div
          className="pointer-events-none absolute top-1/2 right-8 -z-10 h-[420px] w-[620px] -translate-y-1/2 rounded-full blur-[110px] transition-opacity duration-500"
          style={{
            background: isDark
              ? "radial-gradient(circle, rgba(57,211,83,0.16) 0%, rgba(255,255,255,0.06) 45%, transparent 72%)"
              : "radial-gradient(circle, rgba(64,196,99,0.2) 0%, rgba(254,240,138,0.22) 48%, transparent 72%)",
          }}
        />

        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12 xl:gap-14">
          {/* Left 6 Columns: Crisp 2-Line Headline + Ribbon + Single-Row CTA */}
          <div className="lg:col-span-6">
            {/* Concise 2-Line Headline with Dark-Mode Metallic Silver Gradient */}
            <h1
              className={`hero-kinetic text-4xl font-black leading-[1.08] tracking-[-0.03em] sm:text-5xl xl:text-[54px] ${
                isDark
                  ? "bg-gradient-to-b from-white via-[#F4F4F5] to-[#A1A1AA] bg-clip-text text-transparent"
                  : ""
              }`}
              style={isDark ? undefined : { color: "var(--ld-ink)" }}
            >
              {t("hero.title1", "Tài liệu kỹ thuật luôn mới")}
              <span className="mt-2 block">
                {t("hero.title2", "cùng nhịp thay đổi của code.")}
              </span>
            </h1>

            {/* Dynamic Morphing Kinetic Text Ribbon */}
            <div
              className="hero-kinetic mt-5 flex flex-wrap items-center gap-2.5 text-base font-bold sm:text-lg"
              style={{ color: "var(--ld-muted)" }}
            >
              <span>{t("hero.ribbonPrefix", "Hệ thống tự động")}</span>
              <span
                key={phraseIdx}
                className="inline-flex items-center rounded-full border-2 border-[#211D16] bg-[#FEF08A] px-3.5 py-0.5 text-[#211D16] shadow-[2px_2px_0_#211D16]"
                style={{
                  animation: "ld-phrase-in 450ms cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <span>{heroPhrases[phraseIdx % heroPhrases.length]}</span>
              </span>
            </div>

            {/* Single-Row Tactile Action Buttons */}
            <div className="hero-kinetic mt-8 flex flex-wrap items-center gap-3 xl:flex-nowrap">
              <Link
                href="/login"
                className="ym-btn-primary inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full px-7 py-3.5 text-sm font-extrabold"
              >
                <span>{t("hero.getStarted", "Bắt đầu ngay")}</span>
              </Link>

              {/* Copyable Git Clone Command Pill */}
              <button
                type="button"
                onClick={handleCopyCommand}
                className="ym-btn-secondary inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-3 font-mono text-[11.5px] font-bold"
                title={t("hero.copyCommand", "Sao chép lệnh git clone")}
              >
                <Terminal size={13} className="flex-shrink-0 text-[#E8523B]" />
                <span>git clone https://github.com/LeNgocChau9/Java_UTH</span>
                {copiedCmd ? (
                  <Check size={13} className="flex-shrink-0 text-emerald-500" />
                ) : (
                  <Copy
                    size={13}
                    className="flex-shrink-0"
                    style={{ color: "var(--ld-muted)" }}
                  />
                )}
              </button>
            </div>
          </div>

          {/* Right 6 Columns: Wide Rectangular <PresenceCards /> (Landscape 18-Column Heatmap) */}
          <div className="hero-stage-card lg:col-span-6 lg:flex lg:justify-end">
            <div
              className="w-full max-w-[720px] rounded-[28px] border-2 p-3.5 transition-colors duration-300"
              style={{
                backgroundColor: "var(--ld-surface)",
                borderColor: "var(--ld-border)",
                boxShadow: isDark
                  ? "0 28px 70px -20px rgba(0,0,0,0.85), 0 0 40px -10px rgba(57,211,83,0.12)"
                  : "7px 7px 0 var(--ld-shadow)",
              }}
            >
              {/* Clean Window Dots Top Bar */}
              <div className="mb-2.5 flex items-center gap-2 px-2">
                <span className="h-3 w-3 rounded-full border border-[#211D16] bg-[#E8523B]" />
                <span className="h-3 w-3 rounded-full border border-[#211D16] bg-[#F59E0B]" />
                <span className="h-3 w-3 rounded-full border border-[#211D16] bg-[#10B981]" />
              </div>

              <PresenceCards theme={pageTheme} />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          2.5. OPEN EDITORIAL INTERACTIVE FILE BOX
      ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[1380px] px-5 pt-0 pb-2 lg:-mt-4 lg:px-10">
        <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-6">
          {/* Left 5 Columns: Larger Floating <FileBox /> (Drops & syncs immediately on page load) */}
          <div className="relative flex items-center justify-center lg:col-span-5 lg:justify-start">
            {/* Soft Ambient Spotlight beneath the cardboard box */}
            <div
              className="pointer-events-none absolute h-60 w-60 rounded-full blur-[76px] transition-colors duration-500"
              style={{
                background: `radial-gradient(circle, ${activeFolderInfo.dot}${
                  isDark ? "33" : "2B"
                } 0%, transparent 72%)`,
              }}
            />
            <div className="ld-filebox-stage relative flex h-[300px] w-full max-w-[430px] items-center justify-center sm:h-[320px] lg:-ml-4">
              <FileBox
                theme={pageTheme}
                activePosition={pulledFolder.position}
                onPull={({ color, position }) =>
                  setPulledFolder({ color, position })
                }
              />
            </div>
          </div>

          {/* Right 7 Columns: Clean 3s Auto-Rotating Editorial Banner */}
          <div className="lg:col-span-7 lg:-ml-4">
            <div
              key={activeFolderInfo.position}
              style={{
                animation: "ld-phrase-in 420ms cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <h2
                className="text-3xl font-black leading-[1.12] tracking-tight sm:text-4xl lg:text-[44px]"
                style={{ color: "var(--ld-ink)" }}
              >
                {activeFolderInfo.label}
              </h2>

              <p
                className="mt-3.5 max-w-lg text-sm font-medium leading-relaxed sm:text-base"
                style={{ color: "var(--ld-muted)" }}
              >
                {activeFolderInfo.desc}
              </p>
            </div>

            {/* Minimalist 5-Folder Color Selector Bars */}
            <div className="mt-7 flex items-center gap-2">
              {fileboxFolders.map((folder) => {
                const isSelected = folder.position === pulledFolder.position;
                return (
                  <button
                    key={folder.position}
                    type="button"
                    aria-label={folder.label}
                    title={folder.label}
                    onClick={() =>
                      setPulledFolder({
                        color: folder.color,
                        position: folder.position,
                      })
                    }
                    className="h-2.5 cursor-pointer rounded-full transition-all duration-300"
                    style={{
                      width: isSelected ? "42px" : "12px",
                      backgroundColor: folder.dot,
                      opacity: isSelected ? 1 : 0.35,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          3. ALL 12 FEATURE CARDS ON 1 SINGLE PAGE WITH SCROLL MOTION
      ─────────────────────────────────────────────────────────── */}
      <FileBoxGallery />

      {/* ───────────────────────────────────────────────────────────
          5. INTERACTIVE DESK COMPUTER + LIQUID-GLASS READER PLAYGROUND
      ─────────────────────────────────────────────────────────── */}
      <section
        id="reader-studio"
        className="motion-section scroll-mt-16 py-20 transition-colors duration-300"
        style={{ backgroundColor: "var(--ld-bg-soft)" }}
      >
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
          <div className="mb-10">
            <h2
              className="text-3xl font-black leading-[1.12] tracking-tight sm:text-5xl"
              style={{ color: "var(--ld-ink)" }}
            >
              {t("studio.title1", "Viết code trên máy bạn")}
              <span className="mt-1.5 block">
                {t("studio.title2", "tài liệu tự cập nhật bên cạnh.")}
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            {/* Left 7 Columns: Real Interactive Isometric <DeskComputer /> with WebAudio Sound */}
            <div className="lg:col-span-7">
              <div
                className="flex h-full flex-col justify-center overflow-hidden rounded-[32px] border-2 p-3 transition-all duration-300 hover:-translate-y-1"
                style={{
                  backgroundColor: "var(--ld-surface)",
                  borderColor: "var(--ld-border)",
                  boxShadow: "7px 7px 0 var(--ld-shadow)",
                }}
              >
                <div className="w-full overflow-hidden rounded-[24px]">
                  <DeskComputer theme={pageTheme} sound />
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Live Interactive Liquid-Glass <ReaderCard /> */}
            <div className="lg:col-span-5">
              <div
                className="flex h-full flex-col justify-center rounded-[32px] border-2 p-3 transition-all duration-300 hover:-translate-y-1"
                style={{
                  backgroundColor: "var(--ld-surface)",
                  borderColor: "var(--ld-border)",
                  boxShadow: "7px 7px 0 var(--ld-shadow)",
                }}
              >
                <ReaderCard theme={pageTheme} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          6. LIVE CODE MUTATION + LASER SCANNER -> DOC SYNC STAGE
      ─────────────────────────────────────────────────────────── */}
      <section
        id="code-doc-sync"
        className="motion-section scroll-mt-16 mx-auto max-w-[1380px] px-5 py-24 lg:px-10"
      >
        <div className="mb-12 text-center">
          <h2
            className="text-3xl font-black leading-[1.12] tracking-tight sm:text-5xl"
            style={{ color: "var(--ld-ink)" }}
          >
            {t("sync.title1", "Mã nguồn vừa thay đổi")}
            <span className="mt-1.5 block">
              {t("sync.title2", "tài liệu nhận ra và tự đồng bộ.")}
            </span>
          </h2>
        </div>

        <CodeDocSyncStage theme={pageTheme} />
      </section>

      {/* ───────────────────────────────────────────────────────────
          7. INTERACTIVE HOVER LAMP SPOTLIGHT MOTION CTA CARD
      ─────────────────────────────────────────────────────────── */}
      <section className="motion-section mx-auto max-w-[1380px] px-5 pb-20 lg:px-10">
        <div
          onMouseEnter={() => setLampOn(true)}
          onMouseLeave={() => setLampOn(false)}
          className="relative overflow-hidden rounded-[36px] border-2 p-7 transition-all duration-500 sm:p-12 lg:p-14"
          style={{
            backgroundColor: lampOn
              ? isDark
                ? "#161B17"
                : "#FFFDF6"
              : isDark
              ? "#121215"
              : "#F5F2EB",
            borderColor: "var(--ld-border)",
            boxShadow: lampOn
              ? isDark
                ? "0 30px 90px -24px rgba(16,185,129,0.22), 8px 8px 0 var(--ld-shadow)"
                : "0 26px 70px -24px rgba(245,158,11,0.28), 8px 8px 0 var(--ld-shadow)"
              : "8px 8px 0 var(--ld-shadow)",
          }}
        >
          {/* Warm Dynamic Spotlight Halo Controlled by Hover */}
          <div
            className="pointer-events-none absolute -top-20 right-0 h-[440px] w-[660px] rounded-full blur-[110px] transition-opacity duration-500"
            style={{
              opacity: lampOn ? 1 : 0,
              background: isDark
                ? "radial-gradient(circle, rgba(253,230,138,0.24) 0%, rgba(16,185,129,0.14) 50%, transparent 74%)"
                : "radial-gradient(circle, rgba(254,240,138,0.8) 0%, rgba(134,239,172,0.28) 52%, transparent 74%)",
            }}
          />

          <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            {/* Left 6 Columns: Crisp CTA Copy + Login Button */}
            <div className="lg:col-span-6">
              <h2
                className="text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl"
                style={{ color: "var(--ld-ink)" }}
              >
                LivingDocs
                <span className="mt-1.5 block">
                  {t("cta.title", "Giải pháp cho tài liệu luôn mới.")}
                </span>
              </h2>

              <p
                className="mt-4 max-w-lg text-sm font-semibold leading-relaxed sm:text-base"
                style={{ color: "var(--ld-muted)" }}
              >
                {t(
                  "cta.desc",
                  "Tự động phát hiện sai lệch, đồng bộ nội dung và quản trị tri thức dự án trong một không gian thống nhất cho đội ngũ phát triển phần mềm."
                )}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Link
                  href="/login"
                  className="ym-btn-primary inline-flex items-center rounded-full px-8 py-4 text-sm font-extrabold"
                >
                  <span>{t("cta.loginNow", "Đăng nhập ngay")}</span>
                </Link>
              </div>
            </div>

            {/* Right 6 Columns: Top-Right Angled Lamp -> Diagonal Beam -> Red-to-Green Document */}
            <div className="lg:col-span-6">
              <LampDocSpotlight lit={lampOn} isDark={isDark} />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          8. EDITORIAL FOOTER
      ─────────────────────────────────────────────────────────── */}
      <footer
        className="px-5 pt-14 pb-14 text-xs transition-colors duration-300 lg:px-10"
        style={{
          backgroundColor: "var(--ld-surface)",
          color: "var(--ld-muted)",
        }}
      >
        <div className="mx-auto grid max-w-[1380px] grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 space-y-3 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-black"
              style={{ color: "var(--ld-ink)" }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#211D16] bg-white">
                <Image
                  src="/logo.png"
                  alt="LivingDocs"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            </Link>
            <p className="leading-relaxed">
              {t(
                "footer.brandDesc",
                "Nền tảng quản trị, tự động sinh và đồng bộ tài liệu kỹ thuật theo mã nguồn bằng AI."
              )}
            </p>
          </div>

          <div className="space-y-2.5">
            <div
              className="font-extrabold uppercase tracking-wider"
              style={{ color: "var(--ld-ink)" }}
            >
              {t("footer.colModules", "Phân hệ chính")}
            </div>
            <ul className="space-y-2 font-semibold">
              <li>
                <Link href="/tai-lieu-cua-toi/editor" className="hover:text-[#E8523B]">
                  Workspace Studio
                </Link>
              </li>
              <li>
                <Link href="/cay-ma-nguon" className="hover:text-[#E8523B]">
                  Cây mã nguồn AST
                </Link>
              </li>
              <li>
                <Link href="/canh-bao-sai-lech" className="hover:text-[#E8523B]">
                  Cảnh báo Drift
                </Link>
              </li>
              <li>
                <Link href="/co-so-tri-thuc" className="hover:text-[#E8523B]">
                  Cơ sở tri thức thông minh
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div
              className="font-extrabold uppercase tracking-wider"
              style={{ color: "var(--ld-ink)" }}
            >
              {t("footer.colReviews", "Quy trình duyệt")}
            </div>
            <ul className="space-y-2 font-semibold">
              <li>
                <Link href="/hang-doi-xem-xet" className="hover:text-[#E8523B]">
                  Hàng đợi Thẩm định (Staff)
                </Link>
              </li>
              <li>
                <Link href="/trung-tam-phe-duyet" className="hover:text-[#E8523B]">
                  Trung tâm Phê duyệt (Manager)
                </Link>
              </li>
              <li>
                <Link href="/quan-ly-template" className="hover:text-[#E8523B]">
                  Mẫu tài liệu Template
                </Link>
              </li>
              <li>
                <Link href="/dashboard-chat-luong" className="hover:text-[#E8523B]">
                  Báo cáo Chất lượng
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div
              className="font-extrabold uppercase tracking-wider"
              style={{ color: "var(--ld-ink)" }}
            >
              {t("footer.colOpenSource", "Mã nguồn mở")}
            </div>
            <ul className="space-y-2 font-semibold">
              <li>
                <a
                  href="https://github.com/LeNgocChau9/Java_UTH"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#E8523B]"
                >
                  GitHub Repository ↗
                </a>
              </li>
              <li>
                <Link href="/yeu-cau-sinh-tai-lieu" className="hover:text-[#E8523B]">
                  Yêu cầu sinh tài liệu AI
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-[#E8523B]">
                  Đăng nhập hệ thống
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div
              className="font-extrabold uppercase tracking-wider"
              style={{ color: "var(--ld-ink)" }}
            >
              {t("footer.colStandards", "Tiêu chuẩn")}
            </div>
            <ul className="space-y-2 font-semibold">
              <li>MIT License</li>
              <li>SHA-256 Hash-Chain</li>
              <li>IEEE / ISO Spec Ready</li>
            </ul>
          </div>
        </div>
      </footer>

      {/* ───────────────────────────────────────────────────────────
          9. FLOATING BACK-TO-TOP + GEHIHI AI ASSISTANT DRAWER
      ─────────────────────────────────────────────────────────── */}
      <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-2.5">
        {/* Smooth Back-to-Top Chevron Button (appears above Gehihi AI once user scrolls down) */}
        {!isAskAiOpen && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Lên đầu trang"
            title="Lên đầu trang"
            className={`ym-btn-primary flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all duration-300 ${
              showScrollTop
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-2 scale-90 opacity-0"
            }`}
          >
            <ChevronUp size={18} strokeWidth={2.5} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsAskAiOpen((p) => !p)}
          className="ym-btn-primary inline-flex cursor-pointer items-center rounded-full px-5 py-3 text-xs font-extrabold"
        >
          <span>Gehihi AI</span>
        </button>

        {isAskAiOpen && (
          <div
            className="absolute right-0 bottom-14 flex h-[470px] w-[340px] flex-col overflow-hidden rounded-[24px] border-2 sm:w-[390px]"
            style={{
              backgroundColor: "var(--ld-bg)",
              borderColor: "var(--ld-border)",
              boxShadow: "6px 6px 0 var(--ld-shadow)",
            }}
          >
            <div className="flex items-center justify-between border-b-2 border-[#211D16] bg-[#211D16] px-4 py-3 text-[#FFFCF5]">
              <span className="text-xs font-extrabold">Gehihi AI</span>
              <button
                type="button"
                onClick={() => setIsAskAiOpen(false)}
                className="cursor-pointer rounded-full p-1 text-[#FFFCF5]/80 hover:bg-white/10 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
              {askAiMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl border-2 p-3 leading-relaxed ${
                      m.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"
                    }`}
                    style={
                      m.role === "user"
                        ? {
                            backgroundColor: "#E8523B",
                            borderColor: "#E8523B",
                            color: "#FFFFFF",
                          }
                        : {
                            backgroundColor: "var(--ld-surface)",
                            borderColor: "var(--ld-border)",
                            color: "var(--ld-ink)",
                          }
                    }
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-[#211D16]/15 pt-2 text-[10px]">
                        {m.citations.map((c, idx) => (
                          <span
                            key={idx}
                            className="rounded-full border border-[#211D16] bg-[#FEF08A] px-2 py-0.5 font-mono font-bold text-[#211D16]"
                          >
                            [Nguồn: {c}]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {askAiLoading && (
                <div
                  className="flex items-center gap-2 text-xs font-semibold"
                  style={{ color: "var(--ld-muted)" }}
                >
                  <RefreshCw size={12} className="animate-spin text-[#E8523B]" />
                  <span>Gehihi AI đang tra cứu tri thức...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <form
              onSubmit={handleSendAskAi}
              className="flex items-center gap-2 border-t-2 p-3"
              style={{
                backgroundColor: "var(--ld-surface)",
                borderColor: "var(--ld-border)",
              }}
            >
              <input
                type="text"
                value={askAiInput}
                onChange={(e) => setAskAiInput(e.target.value)}
                placeholder="Hỏi về AST, Drift hoặc RAG..."
                className="flex-1 rounded-full border-2 px-3.5 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--ld-bg)",
                  borderColor: "var(--ld-border)",
                  color: "var(--ld-ink)",
                }}
              />
              <button
                type="submit"
                disabled={!askAiInput.trim() || askAiLoading}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-[#211D16] bg-[#E8523B] text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-45"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
