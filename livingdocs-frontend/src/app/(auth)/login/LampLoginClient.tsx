"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axios from "axios";
import gsap from "gsap";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { login, register } from "@/services/authService";
import ThemeSwitch from "@/components/library/ThemeSwitch";
import FileBox from "@/components/library/FileBox";

const LOGIN_HIGHLIGHTS = [
  {
    position: 1,
    title: "Tài liệu luôn mới theo từng dòng mã nguồn",
    dot: "#22A862",
  },
  {
    position: 2,
    title: "Phát hiện lệch pha ngay trước khi gộp nhánh",
    dot: "#F8B02A",
  },
  {
    position: 3,
    title: "Kiểm duyệt hai cấp minh bạch cho đội ngũ",
    dot: "#E28CE6",
  },
  {
    position: 4,
    title: "Bản đồ liên kết rõ ràng giữa code và tài liệu",
    dot: "#D9B37C",
  },
  {
    position: 5,
    title: "Tra cứu tri thức dự án chỉ trong tích tắc",
    dot: "#167F46",
  },
];

export function LampLoginClient({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement>(null);

  // Synced Light / Dark Theme matching Landing Page
  const [pageTheme, setPageTheme] = useState<"light" | "dark">("light");
  const isDark = pageTheme === "dark";

  // Auth tab & form state
  const [activeTab, setActiveTab] = useState<"signin" | "register">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    initialError ?? null
  );
  const [rememberMe, setRememberMe] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Synced interactive FileBox folder highlight
  const [activeIdx, setActiveIdx] = useState(0);
  const currentHighlight = LOGIN_HIGHLIGHTS[activeIdx];

  useEffect(() => {
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % LOGIN_HIGHLIGHTS.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  // Crisp entrance animation matching Landing Page
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".auth-reveal", {
        y: 26,
        opacity: 0,
        duration: 0.65,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform",
      });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (activeTab === "register" && !fullName.trim()) {
      setFormError("Vui lòng nhập họ và tên.");
      return;
    }

    if (!email.trim()) {
      setFormError("Vui lòng nhập email hoặc tài khoản.");
      return;
    }
    if (!password) {
      setFormError("Vui lòng nhập mật khẩu.");
      return;
    }
    if (activeTab === "register" && password.length < 6) {
      setFormError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setPending(true);
    try {
      if (activeTab === "register") {
        await register({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
        });
      } else {
        await login({ email: email.trim(), password });
      }
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      if (axios.isAxiosError(caught)) {
        const msg = caught.response?.data?.message;
        if (typeof msg === "string" && msg.trim()) {
          setFormError(msg);
        } else if (caught.response?.status === 401) {
          setFormError("Email hoặc mật khẩu không chính xác.");
        } else if (caught.response?.status === 409) {
          setFormError(
            "Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác."
          );
        } else {
          setFormError(
            activeTab === "register"
              ? "Đăng ký thất bại. Vui lòng thử lại."
              : "Đăng nhập thất bại. Vui lòng thử lại."
          );
        }
      } else {
        setFormError("Yêu cầu chưa hoàn tất. Vui lòng thử lại.");
      }
    } finally {
      setPending(false);
    }
  }

  function handleGithubAuth() {
    const next =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null;
    const target =
      next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    const query = target ? `?redirect=${encodeURIComponent(target)}` : "";
    window.location.assign(`/api/auth/github${query}`);
  }

  return (
    <div
      ref={pageRef}
      data-ld-theme={pageTheme}
      className="relative flex min-h-screen flex-col overflow-x-hidden font-sans antialiased transition-colors duration-300 selection:bg-[#FDE68A] selection:text-[#211D16]"
      style={{
        backgroundColor: "var(--ld-bg)",
        color: "var(--ld-ink)",
      }}
    >
      {/* Shared Landing Page Theme Variables & Tactile Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          [data-ld-theme="light"] {
            --ld-bg: #FFFCF5;
            --ld-surface: #FFFFFF;
            --ld-surface-hover: #FFF8EB;
            --ld-ink: #211D16;
            --ld-muted: #6D6255;
            --ld-border: #211D16;
            --ld-shadow: #211D16;
            --ld-pill-bg: #F5EFE6;
            --ld-dot: rgba(33, 29, 22, 0.14);
            --ld-input-bg: #FFFCF5;
          }
          [data-ld-theme="dark"] {
            --ld-bg: #0A0A0C;
            --ld-surface: #131316;
            --ld-surface-hover: #1B1B20;
            --ld-ink: #FAFAFA;
            --ld-muted: #A1A1AA;
            --ld-border: rgba(255, 255, 255, 0.2);
            --ld-shadow: #000000;
            --ld-pill-bg: #1C1C22;
            --ld-dot: rgba(255, 255, 255, 0.08);
            --ld-input-bg: #0E0E11;
          }
          @keyframes ld-auth-fade {
            0% { opacity: 0; transform: translateY(6px); filter: blur(3px); }
            100% { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          .ym-btn-primary {
            background-color: var(--ld-ink);
            color: var(--ld-bg);
            border: 2px solid var(--ld-ink);
            box-shadow: 3px 3px 0 #E8523B;
            transition: transform 0.16s cubic-bezier(0.22,1,0.36,1), box-shadow 0.16s ease, opacity 0.16s ease;
          }
          .ym-btn-primary:hover:not(:disabled) {
            transform: translate(-1.5px, -1.5px);
            box-shadow: 5px 5px 0 #E8523B;
          }
          .ym-btn-primary:active:not(:disabled) {
            transform: translate(1px, 1px);
            box-shadow: 1px 1px 0 #E8523B;
          }
          .ym-btn-secondary {
            background-color: var(--ld-surface);
            color: var(--ld-ink);
            border: 2px solid var(--ld-border);
            box-shadow: 3px 3px 0 var(--ld-shadow);
            transition: transform 0.16s cubic-bezier(0.22,1,0.36,1), box-shadow 0.16s ease, background-color 0.2s ease;
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
          .ld-auth-filebox .pfbox {
            --pfbox-bg: transparent !important;
            background: transparent !important;
            overflow: visible !important;
          }
          .ld-auth-filebox .pfbox__grain {
            display: none !important;
          }
          .ld-auth-filebox .pfbox__art {
            transform: scale(1.48) translateY(-2%);
            transform-origin: 50% 56%;
          }
        `,
        }}
      />

      {/* Editorial Dot Grid Background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(var(--ld-dot) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top Navigation Bar matching Landing Page */}
      <header className="relative z-20 mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between px-5 lg:px-10">
        <div className="flex items-center gap-3">
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

          <Link
            href="/"
            className="ym-btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold"
          >
            <ArrowLeft size={14} />
            <span>Trang chủ</span>
          </Link>
        </div>

        <ThemeSwitch theme={pageTheme} onChange={setPageTheme} />
      </header>

      {/* Main Split Editorial Login Layout */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 items-center px-5 py-8 lg:px-10">
        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-10">
          {/* Left 6 Columns: LivingDocs Editorial Intro + Interactive <FileBox /> */}
          <div className="auth-reveal hidden flex-col justify-center lg:col-span-6 lg:flex">
            <h1
              className="text-3xl font-black leading-[1.12] tracking-tight xl:text-[40px]"
              style={{ color: "var(--ld-ink)" }}
            >
              {activeTab === "signin" ? (
                <>
                  <span className="block whitespace-nowrap">
                    Chào mừng sự trở lại
                  </span>
                  <span className="mt-1.5 block whitespace-nowrap">
                    của bạn với LivingDocs
                  </span>
                </>
              ) : (
                <>
                  <span className="block whitespace-nowrap">
                    Khởi tạo không gian
                  </span>
                  <span className="mt-1.5 block whitespace-nowrap">
                    quản trị tài liệu.
                  </span>
                </>
              )}
            </h1>

            {/* Floating Transparent <FileBox /> Synced with Captions */}
            <div className="relative my-2 flex items-center justify-start">
              <div
                className="pointer-events-none absolute left-10 h-52 w-52 rounded-full blur-[72px] transition-colors duration-500"
                style={{
                  background: `radial-gradient(circle, ${currentHighlight.dot}${
                    isDark ? "33" : "2B"
                  } 0%, transparent 72%)`,
                }}
              />
              <div className="ld-auth-filebox relative flex h-[270px] w-full max-w-[350px] items-center justify-center -ml-6">
                <FileBox
                  theme={pageTheme}
                  activePosition={currentHighlight.position}
                  onPull={({ position }) => setActiveIdx(position - 1)}
                />
              </div>
            </div>

            <div
              key={currentHighlight.position}
              className="min-h-[48px]"
              style={{
                animation: "ld-auth-fade 360ms cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <p
                className="text-base font-bold leading-relaxed"
                style={{ color: "var(--ld-ink)" }}
              >
                {currentHighlight.title}
              </p>
            </div>

            {/* Minimal 5-Color Indicator Bars */}
            <div className="mt-3 flex items-center gap-2">
              {LOGIN_HIGHLIGHTS.map((item, idx) => {
                const selected = idx === activeIdx;
                return (
                  <button
                    key={item.position}
                    type="button"
                    aria-label={item.title}
                    onClick={() => setActiveIdx(idx)}
                    className="h-2 cursor-pointer rounded-full transition-all duration-300"
                    style={{
                      width: selected ? "36px" : "10px",
                      backgroundColor: item.dot,
                      opacity: selected ? 1 : 0.35,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Right 6 Columns: Tactile Neo-Brutalist Auth Card */}
          <div className="auth-reveal mx-auto w-full max-w-[490px] lg:col-span-6 lg:ml-auto lg:mr-0">
            <div
              className="rounded-[30px] border-2 p-6 transition-colors duration-300 sm:p-9"
              style={{
                backgroundColor: "var(--ld-surface)",
                borderColor: "var(--ld-border)",
                boxShadow: "7px 7px 0 var(--ld-shadow)",
              }}
            >
              {/* Mobile Title */}
              <div className="mb-6 lg:hidden">
                <h1
                  className="text-2xl font-black tracking-tight"
                  style={{ color: "var(--ld-ink)" }}
                >
                  {activeTab === "signin"
                    ? "Đăng nhập LivingDocs"
                    : "Tạo tài khoản quản lý (Manager)"}
                </h1>
              </div>

              {/* Segmented Tabs: Đăng nhập / Đăng ký */}
              <div
                className="mb-6 grid grid-cols-2 gap-1.5 rounded-full border-2 p-1"
                style={{
                  backgroundColor: "var(--ld-pill-bg)",
                  borderColor: "var(--ld-border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("signin");
                    setFormError(null);
                  }}
                  className="cursor-pointer rounded-full py-2.5 text-xs font-extrabold transition-all duration-200"
                  style={
                    activeTab === "signin"
                      ? {
                          backgroundColor: isDark ? "#FFFFFF" : "#211D16",
                          color: isDark ? "#111113" : "#FFFCF5",
                          boxShadow: "2px 2px 0 #E8523B",
                        }
                      : { color: "var(--ld-muted)" }
                  }
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("register");
                    setFormError(null);
                  }}
                  className="cursor-pointer rounded-full py-2.5 text-xs font-extrabold transition-all duration-200"
                  style={
                    activeTab === "register"
                      ? {
                          backgroundColor: isDark ? "#FFFFFF" : "#211D16",
                          color: isDark ? "#111113" : "#FFFCF5",
                          boxShadow: "2px 2px 0 #E8523B",
                        }
                      : { color: "var(--ld-muted)" }
                  }
                >
                  Đăng ký
                </button>
              </div>

              {/* Error Banner */}
              {formError && (
                <div
                  className="mb-5 flex items-start gap-2.5 rounded-2xl border-2 px-4 py-3 text-xs font-bold"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(239,68,68,0.14)"
                      : "#FEF2F2",
                    borderColor: "#EF4444",
                    color: isDark ? "#FCA5A5" : "#B91C1C",
                  }}
                >
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                {activeTab === "register" && (
                  <div>
                    <label
                      htmlFor="nameField"
                      className="mb-1.5 block text-xs font-extrabold"
                      style={{ color: "var(--ld-ink)" }}
                    >
                      Họ và tên
                    </label>
                    <div className="relative">
                      <User
                        size={16}
                        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
                        style={{ color: "var(--ld-muted)" }}
                      />
                      <input
                        id="nameField"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full rounded-2xl border-2 py-3 pr-4 pl-10 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-[#FDE68A]"
                        style={{
                          backgroundColor: "var(--ld-input-bg)",
                          borderColor: "var(--ld-border)",
                          color: "var(--ld-ink)",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="userField"
                    className="mb-1.5 block text-xs font-extrabold"
                    style={{ color: "var(--ld-ink)" }}
                  >
                    Email{" "}
                    {activeTab === "register"
                      ? "quản lý (Manager)"
                      : "tài khoản"}
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
                      style={{ color: "var(--ld-muted)" }}
                    />
                    <input
                      id="userField"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-2xl border-2 py-3 pr-4 pl-10 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-[#FDE68A]"
                      style={{
                        backgroundColor: "var(--ld-input-bg)",
                        borderColor: "var(--ld-border)",
                        color: "var(--ld-ink)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="passField"
                      className="text-xs font-extrabold"
                      style={{ color: "var(--ld-ink)" }}
                    >
                      Mật khẩu
                    </label>
                    {activeTab === "signin" && (
                      <Link
                        href="/quen-mat-khau"
                        className="text-xs font-bold underline-offset-4 hover:underline"
                        style={{ color: "var(--ld-muted)" }}
                      >
                        Quên mật khẩu?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
                      style={{ color: "var(--ld-muted)" }}
                    />
                    <input
                      id="passField"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-2xl border-2 py-3 pr-11 pl-10 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-[#FDE68A]"
                      style={{
                        backgroundColor: "var(--ld-input-bg)",
                        borderColor: "var(--ld-border)",
                        color: "var(--ld-ink)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={
                        showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                      }
                      className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-full p-1 transition-opacity hover:opacity-80"
                      style={{ color: "var(--ld-muted)" }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 pt-1 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-[#211D16]"
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--ld-muted)" }}
                  >
                    Ghi nhớ phiên đăng nhập
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={pending}
                  className="ym-btn-primary mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3.5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <span>
                      {activeTab === "signin"
                        ? "Đăng nhập"
                        : "Đăng ký tài khoản Manager"}
                    </span>
                  )}
                </button>
              </form>

              {/* GitHub OAuth Button */}
              <button
                type="button"
                onClick={handleGithubAuth}
                className="ym-btn-secondary mt-3.5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full py-3 text-sm font-extrabold"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>Tiếp tục với GitHub</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
