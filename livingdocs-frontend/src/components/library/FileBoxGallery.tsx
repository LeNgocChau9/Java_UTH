"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLanguage } from "@/context/LanguageContext";
import "./file-box-gallery.css";
import {
  ArrowUpRight,
  ChevronRight,
  Database,
  GitPullRequest,
  Lock,
  Sparkles,
  FileCode,
  FileText,
  Calendar,
  Cpu,
  CheckCircle2,
  GitBranch,
  AlertCircle,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

type VisualType =
  | "ast"
  | "drift"
  | "rag"
  | "approval"
  | "workspace"
  | "hash"
  | "regen"
  | "template"
  | "graph"
  | "gaps"
  | "delegation"
  | "failover";

interface FeatureCardItem {
  id: string;
  titleKey: string;
  defaultTitle: string;
  href: string;
  visualType: VisualType;
}

const ALL_CARDS: FeatureCardItem[] = [
  // ─── TRANG 1 (6 thẻ) ───
  {
    id: "ast-extractor",
    titleKey: "card.ast",
    defaultTitle: "Bóc tách cây cú pháp AST",
    href: "/cay-ma-nguon",
    visualType: "ast",
  },
  {
    id: "drift-gate",
    titleKey: "card.drift",
    defaultTitle: "Phát hiện lệch tài liệu Drift",
    href: "/canh-bao-sai-lech",
    visualType: "drift",
  },
  {
    id: "pgvector-rag",
    titleKey: "card.rag",
    defaultTitle: "Hỏi đáp tri thức ZAZA AI",
    href: "/co-so-tri-thuc",
    visualType: "rag",
  },
  {
    id: "two-tier-review",
    titleKey: "card.approval",
    defaultTitle: "Quy trình kiểm duyệt hai cấp",
    href: "/hang-doi-xem-xet",
    visualType: "approval",
  },
  {
    id: "workspace-studio",
    titleKey: "card.workspace",
    defaultTitle: "Trình soạn thảo Workspace Studio",
    href: "/tai-lieu-cua-toi/editor",
    visualType: "workspace",
  },
  {
    id: "hash-chain",
    titleKey: "card.hash",
    defaultTitle: "Bảo chứng chuỗi băm SHA-256",
    href: "/dashboard-chat-luong",
    visualType: "hash",
  },

  // ─── TRANG 2 (6 thẻ mới, hoàn toàn không dùng màu đen) ───
  {
    id: "localized-regen",
    titleKey: "card.regen",
    defaultTitle: "Tái sinh tài liệu cục bộ",
    href: "/cay-ma-nguon",
    visualType: "regen",
  },
  {
    id: "template-library",
    titleKey: "card.template",
    defaultTitle: "Kho mẫu tài liệu chuẩn",
    href: "/quan-ly-template",
    visualType: "template",
  },
  {
    id: "dependency-graph",
    titleKey: "card.graph",
    defaultTitle: "Đồ thị liên kết mã nguồn",
    href: "/do-thi-lien-ket",
    visualType: "graph",
  },
  {
    id: "coverage-gaps",
    titleKey: "card.gaps",
    defaultTitle: "Phân tích khoảng trống tài liệu",
    href: "/khoang-trong-tai-lieu",
    visualType: "gaps",
  },
  {
    id: "approval-delegation",
    titleKey: "card.delegation",
    defaultTitle: "Ủy quyền phê duyệt linh hoạt",
    href: "/uy-quyen-phe-duyet",
    visualType: "delegation",
  },
  {
    id: "ai-failover",
    titleKey: "card.failover",
    defaultTitle: "Định tuyến AI Cloud và Ollama",
    href: "/cai-dat",
    visualType: "failover",
  },
];

/* ─── 12 Mini Animated Visual Previews (ZERO black backgrounds, rich built-in motion) ─── */
function CardAnimatedVisual({ type }: { type: VisualType }) {
  switch (type) {
    case "ast":
      return (
        <div className="relative flex h-36 w-full flex-col justify-between overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#FFF1F2] p-3 font-mono text-[11px] text-[#211D16]">
          {/* Sweeping AST scan beam */}
          <div
            className="pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-[#FB7185]/22 to-transparent"
            style={{ animation: "fb-scan-y 3.2s ease-in-out infinite" }}
          />
          <div className="relative z-10 flex items-center text-[10px]">
            <span className="flex items-center gap-1.5 font-bold text-[#9F1239]">
              <span className="h-2 w-2 rounded-full bg-[#E11D48] animate-pulse" />
              AuthServiceImpl.java
            </span>
          </div>
          <div className="relative z-10 space-y-1.5">
            <div
              className="flex items-center gap-2 rounded-lg border border-[#FDA4AF] bg-white px-2.5 py-1 shadow-xs transition-transform duration-300 group-hover:translate-x-1.5"
              style={{ animation: "fb-nudge-x 3.2s ease-in-out infinite" }}
            >
              <span className="font-extrabold text-[#E11D48]">CLASS</span>
              <span className="font-bold">AuthServiceImpl</span>
            </div>
            <div
              className="ml-4 flex items-center gap-2 rounded-lg border-l-[3px] border-[#E11D48] bg-[#FFE4E6] px-2.5 py-1 transition-transform duration-300 group-hover:translate-x-2.5"
              style={{
                animation: "fb-nudge-x 3.2s ease-in-out infinite 0.45s",
              }}
            >
              <span className="font-extrabold text-[#B45309]">METHOD</span>
              <span className="font-semibold">login(LoginReq): JwtRes</span>
            </div>
          </div>
        </div>
      );

    case "drift":
      return (
        <div className="relative flex h-36 w-full flex-col justify-between overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#FFF8EB] p-3 font-mono text-[11px] text-[#211D16]">
          <div className="flex items-center">
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[#211D16] bg-[#FDE68A] px-2 py-0.5 text-[10px] font-bold"
              style={{ animation: "fb-soft-float 3.4s ease-in-out infinite" }}
            >
              <GitPullRequest size={11} /> PR #254
            </span>
          </div>
          <div className="space-y-1.5 text-[10.5px]">
            <div className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-red-600 line-through opacity-80">
              - login(email, password)
            </div>
            <div
              className="relative overflow-hidden rounded-lg border border-[#059669] bg-[#D1FAE5] px-2.5 py-1 font-bold text-[#065F46] transition-transform duration-300 group-hover:translate-x-1.5"
              style={{ animation: "fb-nudge-x 2.8s ease-in-out infinite" }}
            >
              <div
                className="pointer-events-none absolute inset-y-0 w-14 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                style={{ animation: "fb-shimmer 2.8s ease-in-out infinite" }}
              />
              <span className="relative z-10">
                + login(email, password, mfaCode)
              </span>
            </div>
          </div>
        </div>
      );

    case "rag":
      return (
        <div className="relative flex h-36 w-full flex-col justify-between overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#EFF6FF] p-3 font-mono text-[11px] text-[#211D16]">
          <div className="flex items-center text-[10px] font-bold">
            <span className="flex items-center gap-1 text-[#1D4ED8]">
              <Database size={12} className="animate-pulse" /> pgvector 768d
            </span>
          </div>
          <div className="space-y-1.5">
            {[94, 86, 79].map((score, i) => (
              <div key={score} className="flex items-center gap-2 text-[10px]">
                <span className="w-12 font-bold text-[#1E3A8A]">
                  chunk_{i + 1}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-[#93C5FD] bg-white">
                  <div
                    className="h-full origin-left rounded-full bg-[#3B82F6] transition-colors duration-500 group-hover:bg-[#E8523B]"
                    style={{
                      width: `${score}%`,
                      animation: `fb-bar-wave 2.6s ease-in-out infinite ${i * 0.35}s`,
                    }}
                  />
                </div>
                <span className="w-8 text-right font-bold">{score}%</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "approval":
      return (
        <div className="relative flex h-36 w-full flex-col justify-center gap-2.5 overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#ECFDF5] p-3 text-[11px] text-[#211D16]">
          <div className="flex items-center justify-between gap-1 font-mono text-[10px] font-bold">
            <span
              className="rounded-full border-2 border-[#059669]/40 bg-white px-2.5 py-1 text-[#065F46]"
              style={{ animation: "fb-step-hop 2.7s ease-in-out infinite 0s" }}
            >
              DRAFT
            </span>
            <ChevronRight
              size={13}
              className="text-[#059669]"
              style={{ animation: "fb-arrow-glide 1.8s ease-in-out infinite" }}
            />
            <span
              className="rounded-full border-2 border-[#D97706] bg-[#FEF08A] px-2.5 py-1 text-[#78350F]"
              style={{ animation: "fb-step-hop 2.7s ease-in-out infinite 0.55s" }}
            >
              STAFF ✓
            </span>
            <ChevronRight
              size={13}
              className="text-[#059669]"
              style={{
                animation: "fb-arrow-glide 1.8s ease-in-out infinite 0.3s",
              }}
            />
            <span
              className="rounded-full border-2 border-[#059669] bg-[#34D399] px-2.5 py-1 text-[#064E3B]"
              style={{ animation: "fb-step-hop 2.7s ease-in-out infinite 1.1s" }}
            >
              PUBLISHED
            </span>
          </div>
          <div className="rounded-lg border border-[#A7F3D0] bg-white px-2.5 py-1.5 font-mono text-[10px] text-[#065F46]">
            Audit Trail · <strong className="text-[#047857]">2-Tier Active</strong>
          </div>
        </div>
      );

    case "workspace":
      return (
        <div className="relative grid h-36 w-full grid-cols-12 gap-1.5 overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#F5F3FF] p-2.5 font-mono text-[10px] text-[#211D16]">
          <div className="col-span-4 space-y-1 rounded-lg border border-[#C4B5FD] bg-white p-1.5">
            <div className="font-bold text-[#6D28D9]">src/auth</div>
            <div className="truncate text-[9.5px] text-[#6B7280]">Login.java</div>
            <div
              className="truncate rounded bg-[#EDE9FE] px-1 font-bold text-[#5B21B6]"
              style={{ animation: "fb-nudge-x 3s ease-in-out infinite" }}
            >
              Spec.md
            </div>
          </div>
          <div className="col-span-8 flex flex-col justify-between rounded-lg border border-[#C4B5FD] bg-white p-2">
            <div>
              <div className="font-bold text-[#4C1D95]"># Auth API Spec</div>
              <div
                className="mt-1.5 h-1.5 origin-left rounded-full bg-[#DDD6FE]"
                style={{
                  width: "85%",
                  animation: "fb-typing-line 2.8s ease-in-out infinite",
                }}
              />
              <div
                className="mt-1 h-1.5 origin-left rounded-full bg-[#EDE9FE]"
                style={{
                  width: "68%",
                  animation: "fb-typing-line 2.8s ease-in-out infinite 0.55s",
                }}
              />
            </div>
            <div className="flex justify-end">
              <span
                className="rounded-full bg-[#7C3AED] px-2.5 py-0.5 text-[9px] font-bold text-white transition-transform duration-300 group-hover:scale-105"
                style={{ animation: "fb-soft-float 2.6s ease-in-out infinite" }}
              >
                Push GitHub ↗
              </span>
            </div>
          </div>
        </div>
      );

    case "hash":
      return (
        <div className="relative flex h-36 w-full flex-col justify-between overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#EEF2FF] p-3 font-mono text-[10px] text-[#1E1B4B]">
          <div className="flex items-center">
            <span className="flex items-center gap-1 font-bold text-[#4338CA]">
              <Lock size={11} className="animate-pulse" /> SHA-256 Ledger
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {["v1 · 9a2f", "v2 · 4c8e", "v3 · 7f8a"].map((blk, idx) => (
              <div
                key={blk}
                className="flex-1 rounded-lg border border-[#A5B4FC] bg-white p-1.5 text-center shadow-xs"
                style={{
                  animation: `fb-step-hop 2.6s ease-in-out infinite ${idx * 0.45}s`,
                }}
              >
                <div className="font-bold text-[#312E81]">{blk}</div>
                <div className="text-[8.5px] font-bold text-[#059669]">
                  ✓ verified
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "regen":
      return (
        <div className="relative flex h-36 w-full flex-col justify-between overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#FFF7ED] p-3 font-mono text-[10.5px] text-[#431407]">
          <div className="flex items-center text-[10px]">
            <span className="flex items-center gap-1 font-bold text-[#C2410C]">
              <Sparkles size={11} className="animate-pulse" /> Localized AI
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-lg border border-[#FED7AA] bg-white/75 px-2.5 py-1 text-[#9A3412]/70">
              <span>register()</span>
              <span className="text-[9px]">Giữ nguyên</span>
            </div>
            <div
              className="relative flex items-center justify-between overflow-hidden rounded-lg border-2 border-[#EA580C] bg-[#FFEDD5] px-2.5 py-1 font-bold text-[#9A3412]"
              style={{ animation: "fb-glow-pulse 2.4s ease-in-out infinite" }}
            >
              <div
                className="pointer-events-none absolute inset-y-0 w-14 bg-gradient-to-r from-transparent via-white/65 to-transparent"
                style={{ animation: "fb-shimmer 2.4s ease-in-out infinite" }}
              />
              <span className="relative z-10 flex items-center gap-1">
                <FileCode size={11} /> login()
              </span>
              <span className="relative z-10 rounded bg-[#EA580C] px-1.5 py-0.5 text-[8.5px] text-white">
                AI Rewrite
              </span>
            </div>
          </div>
        </div>
      );

    case "template":
      return (
        <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#ECFEFF] p-3 font-mono text-[10px] text-[#164E63]">
          <div className="relative flex h-24 w-full max-w-[230px] items-center justify-center">
            <div
              className="absolute left-2 w-32 rounded-xl border border-[#67E8F9] bg-white p-2 shadow-xs"
              style={{ animation: "fb-fan-left 3.4s ease-in-out infinite" }}
            >
              <div className="font-bold text-[#0E7490]">ADR Spec</div>
              <div className="mt-1 h-1.5 w-3/4 rounded bg-[#CFFAFE]" />
            </div>
            <div
              className="absolute right-2 w-32 rounded-xl border border-[#67E8F9] bg-white p-2 shadow-xs"
              style={{ animation: "fb-fan-right 3.4s ease-in-out infinite" }}
            >
              <div className="font-bold text-[#0E7490]">OpenAPI</div>
              <div className="mt-1 h-1.5 w-2/3 rounded bg-[#CFFAFE]" />
            </div>
            <div
              className="relative z-10 w-36 rounded-xl border-2 border-[#0891B2] bg-white p-2.5 shadow-sm"
              style={{ animation: "fb-soft-float 3.4s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-1 font-extrabold text-[#0E7490]">
                <FileText size={11} /> API Reference
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded bg-[#A5F3FC]" />
              <div className="mt-1 h-1.5 w-3/4 rounded bg-[#CFFAFE]" />
            </div>
          </div>
        </div>
      );

    case "graph":
      return (
        <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#F0FDFA] p-3 font-mono text-[10px] text-[#134E4A]">
          <svg
            className="h-full w-full"
            viewBox="0 0 260 96"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M66 48 L112 28 M66 48 L112 68 M168 28 L206 48 M168 68 L206 48"
              stroke="#14B8A6"
              strokeWidth="2.2"
              strokeDasharray="5 4"
              style={{ animation: "fb-dash-flow 2s linear infinite" }}
            />
            <g style={{ animation: "fb-step-hop 3s ease-in-out infinite 0s" }}>
              <rect
                x="10"
                y="34"
                width="58"
                height="28"
                rx="8"
                fill="#FFFFFF"
                stroke="#0F766E"
                strokeWidth="2"
              />
              <text x="39" y="52" textAnchor="middle" fill="#134E4A" fontSize="9" fontWeight="700">
                API
              </text>
            </g>
            <g style={{ animation: "fb-step-hop 3s ease-in-out infinite 0.5s" }}>
              <rect
                x="110"
                y="14"
                width="60"
                height="26"
                rx="8"
                fill="#CCFBF1"
                stroke="#0F766E"
                strokeWidth="2"
              />
              <text x="140" y="30" textAnchor="middle" fill="#134E4A" fontSize="9" fontWeight="700">
                Service
              </text>
            </g>
            <g style={{ animation: "fb-step-hop 3s ease-in-out infinite 0.9s" }}>
              <rect
                x="110"
                y="56"
                width="60"
                height="26"
                rx="8"
                fill="#FFFFFF"
                stroke="#0F766E"
                strokeWidth="2"
              />
              <text x="140" y="72" textAnchor="middle" fill="#134E4A" fontSize="9" fontWeight="700">
                AST Node
              </text>
            </g>
            <g style={{ animation: "fb-step-hop 3s ease-in-out infinite 1.3s" }}>
              <rect
                x="204"
                y="34"
                width="48"
                height="28"
                rx="8"
                fill="#14B8A6"
              />
              <text x="228" y="52" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="700">
                Doc
              </text>
            </g>
          </svg>
        </div>
      );

    case "gaps":
      return (
        <div className="relative flex h-36 w-full items-center gap-3 overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#FDF2F8] p-3 font-mono text-[10px] text-[#831843]">
          <div
            className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-full border-4 border-[#DB2777] bg-white shadow-xs"
            style={{ animation: "fb-soft-float 3s ease-in-out infinite" }}
          >
            <span className="text-base font-black text-[#BE185D]">92%</span>
            <span className="text-[8px] font-bold text-[#9D174D]">Coverage</span>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between rounded-lg border border-[#FBCFE8] bg-white px-2 py-1">
              <span className="flex items-center gap-1 font-bold">
                <CheckCircle2 size={11} className="text-emerald-600" />
                UserRepo
              </span>
              <span className="font-bold text-emerald-600">OK</span>
            </div>
            <div
              className="flex items-center justify-between rounded-lg border border-[#F472B6] bg-[#FCE7F3] px-2 py-1"
              style={{ animation: "fb-nudge-x 2.4s ease-in-out infinite" }}
            >
              <span className="flex items-center gap-1 font-bold text-[#BE185D]">
                <AlertCircle size={11} />
                TokenUtil
              </span>
              <span className="rounded bg-[#DB2777] px-1.5 py-0.5 text-[8.5px] font-bold text-white">
                + Sinh
              </span>
            </div>
          </div>
        </div>
      );

    case "delegation":
      return (
        <div className="relative flex h-36 w-full flex-col justify-between overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#F0FDF4] p-3 font-mono text-[10.5px] text-[#14532D]">
          <div className="flex items-center text-[10px]">
            <span className="flex items-center gap-1 font-bold text-[#15803D]">
              <Calendar size={11} /> 18/11 → 25/11
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex-1 rounded-xl border border-[#86EFAC] bg-white p-2 text-center font-bold"
              style={{ animation: "fb-alt-a 2.8s ease-in-out infinite" }}
            >
              Manager A
            </div>
            <span
              className="font-black text-[#16A34A]"
              style={{ animation: "fb-arrow-glide 1.6s ease-in-out infinite" }}
            >
              →
            </span>
            <div
              className="flex-1 rounded-xl border-2 border-[#16A34A] bg-[#DCFCE7] p-2 text-center font-extrabold text-[#166534]"
              style={{ animation: "fb-alt-b 2.8s ease-in-out infinite" }}
            >
              Staff B ✓
            </div>
          </div>
        </div>
      );

    case "failover":
      return (
        <div className="relative flex h-36 w-full flex-col justify-between overflow-hidden rounded-xl border-2 border-[#211D16] bg-[#FEFCE8] p-3 font-mono text-[10.5px] text-[#713F12]">
          <div className="flex items-center text-[10px]">
            <span className="flex items-center gap-1 font-bold text-[#A16207]">
              <Cpu size={11} className="animate-pulse" /> Auto Failover
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 rounded-xl border border-[#FDE047] bg-white p-2 text-center shadow-xs"
              style={{ animation: "fb-alt-a 3s ease-in-out infinite" }}
            >
              <div className="font-extrabold text-[#854D0E]">Gemini 3.8</div>
              <div className="text-[8.5px] text-[#A16207]">Cloud Primary</div>
            </div>
            <GitBranch
              size={14}
              className="flex-shrink-0 text-[#CA8A04]"
              style={{ animation: "fb-soft-float 2.4s ease-in-out infinite" }}
            />
            <div
              className="flex-1 rounded-xl border-2 border-[#CA8A04] bg-[#FEF9C3] p-2 text-center shadow-xs"
              style={{ animation: "fb-alt-b 3s ease-in-out infinite" }}
            >
              <div className="font-extrabold text-[#713F12]">Ollama GPU</div>
              <div className="text-[8.5px] text-[#A16207]">Local Backup</div>
            </div>
          </div>
        </div>
      );
  }
}

export default function FileBoxGallery() {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Progressive scroll-reveal: each card enters smoothly right as the visitor scrolls to it
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cards = Array.from(
      grid.querySelectorAll<HTMLElement>(".fb-card-item")
    );
    if (!cards.length) return;

    gsap.set(cards, { opacity: 0, y: 44, scale: 0.94 });

    const triggers = ScrollTrigger.batch(cards, {
      start: "top 90%",
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.65,
          stagger: 0.09,
          ease: "back.out(1.25)",
          clearProps: "transform",
        });
      },
    });

    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 350);

    return () => {
      window.clearTimeout(refreshTimer);
      triggers.forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      id="showcase"
      ref={sectionRef}
      className="scroll-mt-16 mx-auto max-w-[1380px] px-5 pt-10 pb-20 lg:px-10"
    >
      {/* Clean Header Row */}
      <div className="mb-10">
        <h2
          className="text-3xl font-black tracking-tight sm:text-5xl"
          style={{ color: "var(--ld-ink)" }}
        >
          {t("gallery.title", "Khám Phá LivingDocs")}
        </h2>
      </div>

      {/* All 12 Cards on 1 Single Page — Scroll-Triggered Row-by-Row Motion */}
      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {ALL_CARDS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="fb-card-item ym-card group flex flex-col gap-4 rounded-[22px] p-5"
          >
            {/* Animated Colorful Non-Black Mini Visual */}
            <CardAnimatedVisual type={item.visualType} />

            {/* Clean Single-Focus Title + Hover Arrow */}
            <div className="flex items-center justify-between gap-2">
              <h3
                className="text-[17px] font-black leading-snug tracking-tight transition-colors group-hover:text-[#E8523B]"
                style={{ color: "var(--ld-ink)" }}
              >
                {t(item.titleKey, item.defaultTitle)}
              </h3>
              <ArrowUpRight
                size={16}
                className="flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                style={{ color: "var(--ld-muted)" }}
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
