"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, PenLine } from "lucide-react";

export interface ReaderCardProps {
  theme?: "dark" | "light";
  className?: string;
}

interface LiveDocSample {
  file: string;
  section: string;
  title: string;
  body: string;
  bullets: { key: string; value: string }[];
}

const LIVE_DOCS: LiveDocSample[] = [
  {
    file: "ProductService.md",
    section: "TÀI LIỆU API · TỰ ĐỘNG ĐỒNG BỘ",
    title: "Truy vấn danh sách sản phẩm",
    body: "Khi hàm danh mục bổ sung tham số phân trang mới, LivingDocs tự động cập nhật đúng đoạn tài liệu liên quan mà không làm xáo trộn các phần đã duyệt trước đó.",
    bullets: [
      { key: "category", value: "Mã danh mục cần lọc hiển thị" },
      { key: "pageSize", value: "Số bản ghi trả về trên mỗi trang mới thêm" },
      { key: "sortBy", value: "Tiêu chí sắp xếp danh sách mặc định" },
    ],
  },
  {
    file: "DriftCheck.md",
    section: "KIỂM TRA ĐỒNG BỘ · PULL REQUEST",
    title: "Phát hiện tài liệu bị lệch pha",
    body: "Ngay khi mã nguồn thay đổi tên hàm hoặc giá trị trả về, hệ thống lập tức đối chiếu với bản tài liệu hiện tại và gắn cảnh báo rõ ràng trước khi gộp nhánh.",
    bullets: [
      { key: "Phạm vi", value: "Chỉ khoanh vùng đúng hàm vừa chỉnh sửa" },
      { key: "Cảnh báo", value: "Phân loại mức độ lệch theo 4 cấp rõ ràng" },
      { key: "Cập nhật", value: "Tự phác thảo bản mới để đội ngũ duyệt nhanh" },
    ],
  },
  {
    file: "ReviewFlow.md",
    section: "PHÊ DUYỆT · LỊCH SỬ PHIÊN BẢN",
    title: "Kiểm duyệt và xuất bản tài liệu",
    body: "Mọi bản nháp tài liệu mới đều đi qua quy trình rà soát minh bạch, lưu trọn dấu vết chỉnh sửa và đồng bộ ngược về kho dự án chỉ trong một nhịp.",
    bullets: [
      { key: "Bản nháp", value: "Tạo tự động ngay sau mỗi thay đổi mã nguồn" },
      { key: "Thẩm định", value: "Đối chiếu trực tiếp từng dòng code và tài liệu" },
      { key: "Xuất bản", value: "Lưu phiên bản mới kèm lịch sử kiểm chứng" },
    ],
  },
];

export default function ReaderCard({
  theme = "dark",
  className = "",
}: ReaderCardProps) {
  const isDark = theme === "dark";
  const [docIndex, setDocIndex] = useState(0);
  const [visibleWords, setVisibleWords] = useState(0);
  const [visibleBullets, setVisibleBullets] = useState(0);

  const currentDoc = LIVE_DOCS[docIndex];
  const words = useMemo(() => currentDoc.body.split(" "), [currentDoc.body]);
  const isTypingWords = visibleWords < words.length;
  const isDone =
    visibleWords >= words.length &&
    visibleBullets >= currentDoc.bullets.length;

  useEffect(() => {
    setVisibleWords(0);
    setVisibleBullets(0);
  }, [docIndex]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (visibleWords < words.length) {
      timer = setTimeout(() => {
        setVisibleWords((w) => w + 1);
      }, 78);
    } else if (visibleBullets < currentDoc.bullets.length) {
      timer = setTimeout(() => {
        setVisibleBullets((b) => b + 1);
      }, 260);
    } else {
      timer = setTimeout(() => {
        setDocIndex((i) => (i + 1) % LIVE_DOCS.length);
      }, 2400);
    }

    return () => clearTimeout(timer);
  }, [visibleWords, visibleBullets, words.length, currentDoc.bullets.length]);

  return (
    <div
      className={`relative flex h-full min-h-[470px] w-full flex-col justify-center overflow-hidden rounded-[24px] p-4 font-sans transition-colors duration-500 sm:p-6 ${className}`}
      style={{
        backgroundColor: isDark ? "#0d0d0f" : "#eceae6",
        color: isDark ? "#f4f4f5" : "#18181b",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes ld-orb-1 {
            0%, 100% { transform: translate(0px, 0px) scale(1); }
            50% { transform: translate(24px, -16px) scale(1.08); }
          }
          @keyframes ld-orb-2 {
            0%, 100% { transform: translate(0px, 0px) scale(1); }
            50% { transform: translate(-20px, 18px) scale(0.94); }
          }
          @keyframes ld-word-pop {
            0% {
              opacity: 0;
              transform: translateY(7px) scale(0.96);
              filter: blur(3px);
            }
            100% {
              opacity: 1;
              transform: translateY(0px) scale(1);
              filter: blur(0px);
            }
          }
          @keyframes ld-row-slide {
            0% {
              opacity: 0;
              transform: translateX(-10px) translateY(4px);
            }
            100% {
              opacity: 1;
              transform: translateX(0px) translateY(0px);
            }
          }
          @keyframes ld-caret-blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        `,
        }}
      />

      {/* Warm Yellow Ambient Drifting Orbs */}
      <div
        className="pointer-events-none absolute -top-14 -left-14 h-60 w-60 rounded-full blur-[68px]"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(253,230,138,0.28) 0%, transparent 72%)"
            : "radial-gradient(circle, rgba(253,230,138,0.75) 0%, transparent 72%)",
          animation: "ld-orb-1 14s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none absolute -right-12 -bottom-16 h-64 w-64 rounded-full blur-[72px]"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(250,204,21,0.22) 0%, transparent 72%)"
            : "radial-gradient(circle, rgba(254,240,138,0.8) 0%, transparent 72%)",
          animation: "ld-orb-2 17s ease-in-out infinite",
        }}
      />

      {/* Live Streaming Liquid-Glass Document Sheet */}
      <div
        className="relative z-10 flex h-full min-h-[420px] w-full flex-col justify-between overflow-hidden rounded-[26px] border p-5 transition-colors duration-300 sm:p-6"
        style={{
          backgroundColor: isDark
            ? "rgba(22, 22, 26, 0.88)"
            : "rgba(255, 253, 245, 0.94)",
          borderColor: isDark
            ? "rgba(253,230,138,0.22)"
            : "rgba(33,29,22,0.14)",
          backdropFilter: "blur(18px)",
          boxShadow: isDark
            ? "0 24px 60px -24px rgba(0,0,0,0.8)"
            : "0 20px 50px -24px rgba(180,130,20,0.22)",
        }}
      >
        {/* Top File Header */}
        <div>
          <div
            className="mb-4 flex items-center justify-between border-b pb-3"
            style={{
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(33,29,22,0.08)",
            }}
          >
            <div className="flex items-center gap-2 font-mono text-xs font-bold">
              <FileText
                size={14}
                style={{ color: isDark ? "#FDE68A" : "#B45309" }}
              />
              <span style={{ color: isDark ? "#ffffff" : "#211D16" }}>
                {currentDoc.file}
              </span>
            </div>

            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-bold"
              style={{
                backgroundColor: isDark
                  ? "rgba(253,230,138,0.16)"
                  : "#FDE68A",
                borderColor: isDark
                  ? "rgba(253,230,138,0.35)"
                  : "#211D16",
                color: isDark ? "#FDE68A" : "#211D16",
              }}
            >
              {isDone ? (
                <>
                  <CheckCircle2 size={11} />
                  <span>Đã đồng bộ</span>
                </>
              ) : (
                <>
                  <PenLine size={11} className="animate-pulse" />
                  <span>Đang viết...</span>
                </>
              )}
            </div>
          </div>

          {/* Document Section Tag & Crisp Vietnamese Heading */}
          <div
            key={`head-${docIndex}`}
            style={{
              animation: "ld-word-pop 340ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <div
              className="font-mono text-[10px] font-bold tracking-[0.14em]"
              style={{ color: isDark ? "#FDE68A" : "#A16207" }}
            >
              {currentDoc.section}
            </div>
            <h3
              className="mt-1.5 text-xl font-bold leading-snug tracking-tight sm:text-[22px]"
              style={{ color: isDark ? "#ffffff" : "#18181b" }}
            >
              {currentDoc.title}
            </h3>
          </div>

          {/* Kinetic Word-by-Word Popping Vietnamese Paragraph */}
          <p
            className="mt-3 min-h-[88px] text-[14.5px] leading-relaxed"
            style={{ color: isDark ? "#d4d4d8" : "#3f3f46" }}
          >
            {words.slice(0, visibleWords).map((word, idx) => (
              <span
                key={`${docIndex}-w-${idx}`}
                className="mr-[0.3em] inline-block"
                style={{
                  animation:
                    "ld-word-pop 280ms cubic-bezier(0.22,1,0.36,1) both",
                }}
              >
                {word}
              </span>
            ))}
            {isTypingWords && (
              <span
                aria-hidden="true"
                className="inline-block h-[15px] w-[2.5px] translate-y-[2px] rounded-full bg-[#EAB308]"
                style={{ animation: "ld-caret-blink 0.8s steps(1) infinite" }}
              />
            )}
          </p>

          {/* Animated Parameter / Detail Rows Sliding In Live */}
          <div className="mt-4 space-y-2">
            {currentDoc.bullets.slice(0, visibleBullets).map((item, idx) => (
              <div
                key={`${docIndex}-b-${idx}`}
                className="flex items-start gap-2.5 rounded-xl border px-3 py-2 text-xs"
                style={{
                  backgroundColor: isDark
                    ? "rgba(253,230,138,0.05)"
                    : "rgba(254,240,138,0.28)",
                  borderColor: isDark
                    ? "rgba(253,230,138,0.14)"
                    : "rgba(33,29,22,0.1)",
                  animation:
                    "ld-row-slide 340ms cubic-bezier(0.22,1,0.36,1) both",
                }}
              >
                <span
                  className="mt-0.5 flex-shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-bold"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(253,230,138,0.18)"
                      : "#FDE68A",
                    borderColor: isDark
                      ? "rgba(253,230,138,0.3)"
                      : "rgba(33,29,22,0.25)",
                    color: isDark ? "#FDE68A" : "#211D16",
                  }}
                >
                  {item.key}
                </span>
                <span
                  className="leading-relaxed font-medium"
                  style={{ color: isDark ? "#e4e4e7" : "#27272a" }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Minimal Doc Switcher Dots */}
        <div
          className="mt-5 flex items-center justify-between border-t pt-3"
          style={{
            borderColor: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(33,29,22,0.08)",
          }}
        >
          <div className="flex items-center gap-1.5">
            {LIVE_DOCS.map((doc, idx) => {
              const active = idx === docIndex;
              return (
                <button
                  key={doc.file}
                  type="button"
                  onClick={() => setDocIndex(idx)}
                  aria-label={`Xem ${doc.file}`}
                  className="h-2 cursor-pointer rounded-full transition-all duration-300"
                  style={{
                    width: active ? "28px" : "8px",
                    backgroundColor: active
                      ? isDark
                        ? "#FDE68A"
                        : "#EAB308"
                      : isDark
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(24,24,27,0.18)",
                  }}
                />
              );
            })}
          </div>

          <span
            className="font-mono text-[10.5px] font-semibold"
            style={{ color: isDark ? "#a1a1aa" : "#71717a" }}
          >
            {visibleWords}/{words.length} từ
          </span>
        </div>
      </div>
    </div>
  );
}
