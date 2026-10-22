"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileStack, FileText, LayoutTemplate } from "lucide-react";
import { loadTemplates } from "@/services/templateStorage";
import type { DocumentTemplate } from "@/types/template";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Ngày không xác định"
    : date.toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" });
}

export function TemplateDetails({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setTemplate(loadTemplates().find((item) => item.id === templateId) ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải chi tiết template.");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  return (
    <section className="-mx-4 -my-8 min-h-[calc(100dvh-4rem)] bg-[#f7faf8] px-4 py-8 text-[#17231c] sm:-mx-8 sm:-my-10 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
      <Link
        href="/quan-ly-template"
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-[#526158] hover:bg-white hover:text-[#17231c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087f5b]"
      >
        <ArrowLeft aria-hidden size={17} />
        Quay lại thư viện
      </Link>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : loading ? (
        <div className="grid min-h-52 place-items-center rounded-lg border border-[#e4eae6] bg-white text-sm text-[#526158]">
          Đang tải chi tiết template…
        </div>
      ) : !template ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-[#e4eae6] bg-white px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-[#b8dec5] bg-[#eaf6ef] text-[#07543f]">
            <FileText aria-hidden size={22} />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-[#17231c]">Không tìm thấy Template</h1>
          <p className="mt-1 text-sm text-[#526158]">
            Template có thể đã bị xóa hoặc không còn trong thư viện hiện tại.
          </p>
        </div>
      ) : (
        <>
          <header className="rounded-lg border border-[#e4eae6] bg-white p-6 shadow-[0_1px_2px_rgb(21_48_32_/_4%)] sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-[#b8dec5] bg-[#eaf6ef] text-[#07543f]">
                <LayoutTemplate aria-hidden size={22} strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#b8dec5] bg-[#eaf6ef] px-2.5 py-1 text-xs font-medium text-[#07543f]">
                    {template.type}
                  </span>
                  <span className="text-xs text-[#526158]">Template</span>
                </div>
                <h1 className="font-display text-3xl tracking-tight text-[#17231c] sm:text-4xl">
                  {template.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526158]">
                  {template.description}
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-3 border-t border-[#e4eae6] pt-5 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-[#e4eae6] bg-[#f7faf8] px-4 py-3">
                <CalendarDays aria-hidden size={17} className="text-[#087f5b]" />
                <div>
                  <p className="text-xs text-[#526158]">Ngày tạo</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#17231c]">{formatDate(template.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[#e4eae6] bg-[#f7faf8] px-4 py-3">
                <FileStack aria-hidden size={17} className="text-[#087f5b]" />
                <div>
                  <p className="text-xs text-[#526158]">Tài liệu đang sử dụng</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#17231c]">{template.documentCount} tài liệu</p>
                </div>
              </div>
            </div>
          </header>

          <div className="mt-7">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-[#17231c]">Cấu trúc mẫu</h2>
              <p className="mt-1 text-sm text-[#526158]">
                {template.sections.length
                  ? `${template.sections.length} phần nội dung trong template này.`
                  : "Chưa có phần nội dung nào được thêm vào template."}
              </p>
            </div>
            {template.sections.length ? (
              <ol className="grid gap-3 md:grid-cols-2">
                {template.sections.map((section, index) => (
                  <li key={`${section.title}-${index}`} className="flex items-start gap-4 rounded-lg border border-[#e4eae6] bg-white p-5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#b8dec5] bg-[#eaf6ef] text-sm font-semibold text-[#07543f]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[#17231c]">{section.title}</h3>
                      <p className="mt-1 text-sm leading-5 text-[#526158]">{section.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="grid min-h-32 place-items-center rounded-lg border border-[#e4eae6] bg-white text-sm text-[#526158]">
                Chưa có cấu trúc nội dung.
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </section>
  );
}
