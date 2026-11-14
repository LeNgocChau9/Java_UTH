"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  CalendarDays,
  FileStack,
  LayoutTemplate,
  Eye,
  History,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Edit3,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Layers,
  Sparkles,
  X,
  ListOrdered,
  BookOpen,
  Check,
} from "lucide-react";
import {
  loadTemplates,
  updateTemplate,
  publishTemplate,
  rollbackTemplateVersion,
} from "@/services/templateStorage";
import type {
  DocumentTemplate,
  DocumentTemplateSection,
  TemplateVersionItem,
} from "@/types/template";

type ActiveTab = "preview" | "structure" | "history";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Ngày không xác định"
    : date.toLocaleDateString("vi-VN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatDateShort(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Không xác định"
    : date.toLocaleDateString("vi-VN", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
}

export function TemplateDetails({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("preview");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "info" | "warning";
  } | null>(null);

  // State cho Rollback Modal
  const [rollbackTarget, setRollbackTarget] = useState<TemplateVersionItem | null>(null);
  const [isRollbacking, setIsRollbacking] = useState(false);

  // State cho Xem trước phiên bản lịch sử
  const [inspectingVersion, setInspectingVersion] = useState<TemplateVersionItem | null>(null);

  // State cho Tạo / Sửa đề mục
  const [editingSection, setEditingSection] = useState<{
    index: number | null; // null = tạo mới
    section: DocumentTemplateSection;
  } | null>(null);

  // State cho modal Lưu phiên bản mới
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [newVersionNote, setNewVersionNote] = useState("");

  const refreshTemplate = useCallback(() => {
    try {
      const all = loadTemplates();
      const current = all.find((item) => item.id === templateId);
      if (current) {
        setTemplate(current);
      } else {
        setError("Không tìm thấy mẫu tài liệu với mã: " + templateId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải mẫu tài liệu");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    refreshTemplate();
  }, [refreshTemplate]);

  // Tự tắt Toast sau 4.5 giây
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Hành động: Xuất bản vào thư viện dùng chung
  const handlePublish = () => {
    if (!template) return;
    try {
      const res = publishTemplate(template.id);
      setTemplate(res.template);
      setToastMessage({
        text: `Mẫu "${res.template.name}" đã được xuất bản chính thức vào Thư viện dùng chung với phiên bản v${res.template.currentVersion}.0!`,
        type: "success",
      });
    } catch (err) {
      setToastMessage({
        text: err instanceof Error ? err.message : "Không thể xuất bản mẫu",
        type: "warning",
      });
    }
  };

  // Hành động: Xác nhận khôi phục phiên bản
  const handleConfirmRollback = () => {
    if (!template || !rollbackTarget) return;
    setIsRollbacking(true);

    try {
      const result = rollbackTemplateVersion(template.id, rollbackTarget.versionNum);
      setTemplate(result.template);
      setRollbackTarget(null);
      setToastMessage({
        text: result.message,
        type: "success",
      });
      // Tự động chuyển về tab "preview" để xem trước phiên bản vừa khôi phục
      setActiveTab("preview");
    } catch (err) {
      setToastMessage({
        text: err instanceof Error ? err.message : "Lỗi khi khôi phục phiên bản",
        type: "warning",
      });
    } finally {
      setIsRollbacking(false);
    }
  };

  // Hành động: Lưu phiên bản mới
  const handleSaveNewVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    const nextVer = (template.currentVersion || 1) + 1;
    const nowIso = new Date().toISOString();
    const newHistoryItem: TemplateVersionItem = {
      versionId: `v${nextVer}-${template.id}-${Date.now()}`,
      versionNum: nextVer,
      createdAt: nowIso,
      createdBy: "Quản trị viên LivingDocs",
      changeNote: newVersionNote.trim() || `Cập nhật cấu trúc mẫu phiên bản v${nextVer}.0`,
      sectionsCount: template.sections.length,
      sections: JSON.parse(JSON.stringify(template.sections)),
      isCurrent: true,
    };

    const updatedTemplate: DocumentTemplate = {
      ...template,
      currentVersion: nextVer,
      versionHistory: [
        newHistoryItem,
        ...(template.versionHistory || []).map((v) => ({ ...v, isCurrent: false })),
      ],
    };

    updateTemplate(updatedTemplate);
    setTemplate(updatedTemplate);
    setIsNewVersionModalOpen(false);
    setNewVersionNote("");
    setToastMessage({
      text: `Đã lưu phiên bản mới v${nextVer}.0 vào lịch sử mẫu thành công!`,
      type: "success",
    });
  };

  // Hành động: Lưu đề mục (Thêm mới hoặc Cập nhật)
  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || !editingSection) return;

    const { index, section } = editingSection;
    if (!section.title.trim()) {
      alert("Vui lòng nhập tiêu đề đề mục");
      return;
    }

    const updatedSections = [...template.sections];
    if (index === null) {
      // Thêm mới
      updatedSections.push({
        ...section,
        id: `sec-${Date.now()}`,
        required: section.required ?? true,
      });
    } else {
      // Cập nhật
      updatedSections[index] = section;
    }

    const updated: DocumentTemplate = {
      ...template,
      sections: updatedSections,
      status: "DRAFT", // Khi sửa cấu trúc, chuyển về DRAFT để chờ xuất bản
    };

    updateTemplate(updated);
    setTemplate(updated);
    setEditingSection(null);
    setToastMessage({
      text: index === null ? "Đã thêm đề mục mới!" : "Đã cập nhật đề mục thành công!",
      type: "success",
    });
  };

  // Hành động: Xóa đề mục
  const handleDeleteSection = (index: number) => {
    if (!template) return;
    if (!confirm("Bạn có chắc chắn muốn xóa đề mục này khỏi cấu trúc mẫu?")) return;

    const updatedSections = template.sections.filter((_, i) => i !== index);
    const updated: DocumentTemplate = {
      ...template,
      sections: updatedSections,
      status: "DRAFT",
    };
    updateTemplate(updated);
    setTemplate(updated);
    setToastMessage({
      text: "Đã xóa đề mục khỏi cấu trúc mẫu",
      type: "info",
    });
  };

  // Hành động: Di chuyển thứ tự đề mục
  const handleMoveSection = (index: number, direction: "up" | "down") => {
    if (!template) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= template.sections.length) return;

    const updatedSections = [...template.sections];
    const temp = updatedSections[index];
    updatedSections[index] = updatedSections[targetIndex];
    updatedSections[targetIndex] = temp;

    const updated: DocumentTemplate = {
      ...template,
      sections: updatedSections,
      status: "DRAFT",
    };
    updateTemplate(updated);
    setTemplate(updated);
  };

  // Thống kê đề mục
  const stats = useMemo(() => {
    if (!template) return { total: 0, required: 0, optional: 0 };
    const total = template.sections.length;
    const required = template.sections.filter((s) => s.required !== false).length;
    return { total, required, optional: total - required };
  }, [template]);

  if (loading) {
    return (
      <section className="-mx-4 -my-8 min-h-[calc(100dvh-4rem)] bg-[#f7faf8] px-4 py-8 text-[#17231c] sm:-mx-8 sm:-my-10 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <div className="grid min-h-64 place-items-center rounded-xl border border-[#e4eae6] bg-white text-sm text-[#526158] shadow-sm">
            <div className="flex items-center gap-3">
              <span className="size-5 animate-spin rounded-full border-2 border-[#087f5b] border-t-transparent" />
              <span>Đang tải thông tin mẫu tài liệu và lịch sử phiên bản…</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error || !template) {
    return (
      <section className="-mx-4 -my-8 min-h-[calc(100dvh-4rem)] bg-[#f7faf8] px-4 py-8 text-[#17231c] sm:-mx-8 sm:-my-10 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/quan-ly-template"
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-[#526158] hover:bg-white hover:text-[#17231c]"
          >
            <ArrowLeft aria-hidden size={17} />
        Quay lại thư viện
          </Link>
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <span className="grid size-12 place-items-center rounded-full bg-red-50 text-red-600">
              <AlertCircle size={24} />
            </span>
            <h1 className="mt-4 text-lg font-semibold text-[#17231c]">
              {error || "Không tìm thấy mẫu tài liệu"}
            </h1>
            <p className="mt-1 text-sm text-[#526158]">
              Mẫu tài liệu này có thể đã bị xóa hoặc không còn tồn tại trong hệ thống.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="-mx-4 -my-8 min-h-[calc(100dvh-4rem)] bg-[#f7faf8] px-4 py-8 text-[#17231c] sm:-mx-8 sm:-my-10 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Toast thông báo */}
        {toastMessage && (
          <div
            role="status"
            className={`fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-xl transition-all ${
              toastMessage.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : toastMessage.type === "warning"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-blue-300 bg-blue-50 text-blue-900"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="size-5 shrink-0 text-amber-600" />
            )}
            <p className="text-sm font-medium leading-snug">{toastMessage.text}</p>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="ml-auto rounded p-1 text-slate-500 hover:bg-black/5"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Thanh quay lại & Điều hướng */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/quan-ly-template"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e4eae6] bg-white px-3.5 text-sm font-medium text-[#526158] shadow-xs transition-colors hover:bg-[#f2f6f3] hover:text-[#17231c]"
          >
            <ArrowLeft aria-hidden size={16} />
            Quay lại Thư viện mẫu
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNewVersionModalOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#d2ddd6] bg-white px-3.5 text-sm font-semibold text-[#17231c] shadow-xs hover:bg-[#f2f6f3]"
              title="Lưu một bản ghi phiên bản mới vào lịch sử"
            >
              <History size={16} className="text-[#087f5b]" />
              Lưu mốc phiên bản
            </button>

            {template.status === "DRAFT" ? (
              <button
                type="button"
                onClick={handlePublish}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#087f5b] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#07543f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087f5b]"
              >
                <UploadCloud size={17} />
                Xuất bản vào thư viện dùng chung
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 shadow-xs hover:bg-emerald-100"
                title="Cập nhật bản xuất bản mới nhất vào thư viện"
              >
                <CheckCircle2 size={16} className="text-emerald-700" />
                Cập nhật xuất bản (v{template.currentVersion || 1}.0)
              </button>
            )}
          </div>
        </div>

        {/* HEADER CHI TIẾT MẪU TÀI LIỆU */}
        <header className="rounded-xl border border-[#e4eae6] bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-[#b8dec5] bg-[#eaf6ef] text-[#07543f] shadow-xs">
                <LayoutTemplate aria-hidden size={26} strokeWidth={1.8} />
              </span>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#b8dec5] bg-[#eaf6ef] px-3 py-1 text-xs font-semibold text-[#07543f]">
                    {template.type}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                    <Sparkles size={12} />
                    Phiên bản v{template.currentVersion || 1}.0
                  </span>

                  {template.status === "PUBLISHED" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <ShieldCheck size={13} className="text-emerald-600" />
                      Đã xuất bản Thư viện dùng chung
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      <Clock size={13} className="text-amber-600" />
                      Bản nháp (Đang chỉnh sửa)
                    </span>
                  )}
                </div>

                <h1 className="font-display text-2xl font-bold tracking-tight text-[#17231c] sm:text-3xl">
                  {template.name}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526158]">
                  {template.description}
                </p>
              </div>
            </div>
          </div>

          {/* Thanh thống kê nhanh */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#e4eae6] pt-5 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border border-[#e4eae6] bg-[#f7faf8] px-3.5 py-2.5">
              <ListOrdered size={18} className="text-[#087f5b]" />
              <div>
                <p className="text-xs text-[#526158]">Tổng số đề mục</p>
                <p className="text-sm font-semibold text-[#17231c]">{stats.total} đề mục</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-[#e4eae6] bg-[#f7faf8] px-3.5 py-2.5">
              <ShieldCheck size={18} className="text-emerald-600" />
              <div>
                <p className="text-xs text-[#526158]">Đề mục bắt buộc</p>
                <p className="text-sm font-semibold text-[#17231c]">{stats.required} mục</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-[#e4eae6] bg-[#f7faf8] px-3.5 py-2.5">
              <CalendarDays size={18} className="text-[#087f5b]" />
              <div>
                <p className="text-xs text-[#526158]">Thời gian tạo</p>
                <p className="text-sm font-semibold text-[#17231c]">{formatDateShort(template.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-[#e4eae6] bg-[#f7faf8] px-3.5 py-2.5">
              <FileStack size={18} className="text-[#087f5b]" />
              <div>
                <p className="text-xs text-[#526158]">Tài liệu kế thừa</p>
                <p className="text-sm font-semibold text-[#17231c]">{template.documentCount} tài liệu</p>
              </div>
            </div>
          </div>
        </header>

        {/* CÁC TAB ĐIỀU HƯỚNG */}
        <div className="mt-7 flex items-center justify-between border-b border-[#d2ddd6]">
          <nav className="-mb-px flex gap-2 sm:gap-6" aria-label="Tabs quản lý mẫu">
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition-colors ${
                activeTab === "preview"
                  ? "border-[#087f5b] text-[#087f5b]"
                  : "border-transparent text-[#526158] hover:border-gray-300 hover:text-[#17231c]"
              }`}
            >
              <Eye size={17} />
              <span>Xem trước trực quan</span>
              <span className="rounded-full bg-[#eaf6ef] px-2 py-0.5 text-xs text-[#07543f]">
                Live Preview
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("structure")}
              className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition-colors ${
                activeTab === "structure"
                  ? "border-[#087f5b] text-[#087f5b]"
                  : "border-transparent text-[#526158] hover:border-gray-300 hover:text-[#17231c]"
              }`}
            >
              <Layers size={17} />
              <span>Bố trí & Cấu trúc đề mục</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {template.sections.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition-colors ${
                activeTab === "history"
                  ? "border-[#087f5b] text-[#087f5b]"
                  : "border-transparent text-[#526158] hover:border-gray-300 hover:text-[#17231c]"
              }`}
            >
              <History size={17} />
              <span>Lịch sử phiên bản & Khôi phục</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {(template.versionHistory || []).length} bản ghi
              </span>
            </button>
          </nav>
        </div>

        {/* NỘI DUNG TAB 1: XEM TRƯỚC TRỰC QUAN (LIVE VISUAL PREVIEW) */}
        {activeTab === "preview" && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Cột trái: Mục lục điều hướng (Outline / TOC) */}
            <aside className="lg:col-span-4">
              <div className="sticky top-6 rounded-xl border border-[#e4eae6] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#e4eae6] pb-3">
                  <h3 className="flex items-center gap-2 font-semibold text-[#17231c]">
                    <BookOpen size={17} className="text-[#087f5b]" />
                    Mục lục đề mục chuẩn
                  </h3>
                  <span className="rounded bg-[#f7faf8] px-2 py-0.5 text-xs text-[#526158]">
                    Tự động tạo
                  </span>
                </div>

                <p className="mt-2 text-xs text-[#526158]">
                  Sơ đồ các đề mục mà tác giả sẽ hoàn thiện khi khởi tạo tài liệu từ mẫu này.
                </p>

                <nav className="mt-4 space-y-1.5" aria-label="Mục lục xem trước">
                  {template.sections.map((sec, idx) => (
                    <a
                      key={sec.id || `toc-${idx}`}
                      href={`#section-${idx}`}
                      className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-[#eaf6ef]"
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded bg-[#eaf6ef] text-[11px] font-bold text-[#07543f] group-hover:bg-[#087f5b] group-hover:text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#17231c] group-hover:text-[#07543f]">
                          {sec.title}
                        </p>
                        {sec.required !== false && (
                          <span className="text-[10px] text-emerald-700 font-medium">Bắt buộc</span>
                        )}
                      </div>
                    </a>
                  ))}
                </nav>

                <div className="mt-6 rounded-lg border border-dashed border-[#b8dec5] bg-[#eaf6ef]/40 p-3.5 text-xs text-[#07543f]">
                  <p className="font-semibold">💡 Gợi ý kiểm định trước xuất bản:</p>
                  <p className="mt-1 leading-relaxed text-[#526158]">
                    Mẫu này đang ở trạng thái chuẩn hóa. Nếu bố cục đề mục chưa tối ưu, bạn có thể chuyển sang tab
                    <strong className="text-[#17231c]"> &ldquo;Bố trí &amp; Cấu trúc đề mục&rdquo; </strong>
                    để sắp xếp lại trước khi bấm Xuất bản dùng chung.
                  </p>
                </div>
              </div>
            </aside>

            {/* Cột phải: Bản trình bày tài liệu hoàn chỉnh (Document Canvas) */}
            <main className="lg:col-span-8">
              <div className="rounded-xl border border-[#e4eae6] bg-white p-6 shadow-sm sm:p-10">
                {/* Trang trí đầu tài liệu xem trước */}
                <div className="border-b border-[#e4eae6] pb-6">
                  <div className="flex items-center justify-between text-xs text-[#526158]">
                    <span>LivingDocs Document Standard</span>
                    <span>Khung mẫu xem trước</span>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#17231c] sm:text-3xl">
                    {template.name}
                  </h2>
                  <p className="mt-2 text-sm italic text-[#526158]">
                    {template.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-gray-100 px-2.5 py-1 text-gray-700">
                      Chuẩn tài liệu: {template.type}
                    </span>
                    <span className="rounded bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                      Phiên bản áp dụng: v{template.currentVersion || 1}.0
                    </span>
                  </div>
                </div>

                {/* Danh sách các Section được render chi tiết */}
                <div className="mt-8 space-y-8">
                  {template.sections.length === 0 ? (
                    <div className="py-12 text-center text-sm text-[#526158]">
                      Chưa có đề mục nào trong mẫu tài liệu này. Vui lòng chuyển sang tab &ldquo;Bố trí &amp; Cấu trúc đề mục&rdquo; để thêm đề mục.
                    </div>
                  ) : (
                    template.sections.map((sec, idx) => (
                      <article
                        key={sec.id || `render-sec-${idx}`}
                        id={`section-${idx}`}
                        className="scroll-mt-8 rounded-lg border border-gray-100 bg-white p-5 transition-shadow hover:shadow-xs"
                      >
                        {/* Header của từng đề mục */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-7 place-items-center rounded-md bg-[#eaf6ef] text-xs font-bold text-[#07543f]">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <h3 className="text-base font-bold text-[#17231c]">
                              {sec.title}
                            </h3>
                          </div>
                          <div>
                            {sec.required !== false ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                <Check size={12} />
                                Đề mục bắt buộc
                              </span>
                            ) : (
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-600">
                                Tùy chọn
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hướng dẫn biên soạn dành cho tác giả */}
                        {sec.description && (
                          <div className="mt-3 flex items-start gap-2 rounded-md bg-[#f7faf8] p-3 text-xs text-[#526158]">
                            <BookOpen size={14} className="mt-0.5 shrink-0 text-[#087f5b]" />
                            <div>
                              <span className="font-semibold text-[#17231c]">Hướng dẫn biên soạn: </span>
                              <span>{sec.description}</span>
                            </div>
                          </div>
                        )}

                        {/* Nội dung mẫu (Placeholder Content) được render Markdown trực quan */}
                        <div className="mt-4">
                          <div className="mb-2 text-[11px] font-semibold tracking-wider text-[#526158] uppercase">
                            Nội dung khung mẫu (Template Content Preview):
                          </div>
                          {sec.contentPlaceholder ? (
                            <div className="prose prose-sm max-w-none rounded-lg border border-[#e4eae6] bg-[#fafcfb] p-4 text-[#17231c]">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {sec.contentPlaceholder}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4 text-xs italic text-gray-500">
                              (Chưa có nội dung mẫu mặc định cho phần này. Tác giả sẽ nhập nội dung tự do theo hướng dẫn ở trên.)
                            </div>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </main>
          </div>
        )}

        {/* NỘI DUNG TAB 2: BỐ TRÍ & CẤU TRÚC ĐỀ MỤC (SECTION STRUCTURE EDITOR) */}
        {activeTab === "structure" && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e4eae6] bg-white p-5 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-[#17231c]">
                  Danh sách và Thứ tự các Đề mục
                </h2>
                <p className="mt-0.5 text-xs text-[#526158]">
                  Thêm mới, chỉnh sửa nội dung mẫu hoặc thay đổi thứ tự xuất hiện của từng phần.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingSection({
                    index: null,
                    section: {
                      title: "",
                      description: "",
                      contentPlaceholder: "",
                      required: true,
                    },
                  })
                }
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#087f5b] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#07543f]"
              >
                <Plus size={16} />
                Thêm đề mục mới
              </button>
            </div>

            <div className="space-y-3">
              {template.sections.map((sec, idx) => (
                <div
                  key={sec.id || `sec-edit-${idx}`}
                  className="flex flex-col gap-3 rounded-xl border border-[#e4eae6] bg-white p-4 shadow-xs transition-colors hover:border-[#b8dec5] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#b8dec5] bg-[#eaf6ef] text-xs font-bold text-[#07543f]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-[#17231c]">
                          {sec.title}
                        </h3>
                        {sec.required !== false ? (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Bắt buộc
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                            Tùy chọn
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[#526158]">
                        {sec.description || "Chưa có mô tả hướng dẫn."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSection(idx, "up")}
                      className="grid size-8 place-items-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      title="Di chuyển lên"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === template.sections.length - 1}
                      onClick={() => handleMoveSection(idx, "down")}
                      className="grid size-8 place-items-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      title="Di chuyển xuống"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingSection({
                          index: idx,
                          section: { ...sec },
                        })
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-[#087f5b] hover:bg-[#eaf6ef]"
                    >
                      <Edit3 size={14} />
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(idx)}
                      className="grid size-8 place-items-center rounded text-red-500 hover:bg-red-50"
                      title="Xóa đề mục"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NỘI DUNG TAB 3: LỊCH SỬ PHIÊN BẢN & KHÔI PHỤC (VERSION HISTORY & ROLLBACK) */}
        {activeTab === "history" && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-[#e4eae6] bg-white p-5 shadow-xs">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-bold text-[#17231c]">
                    Nhật ký Lịch sử các Phiên bản Mẫu tài liệu
                  </h2>
                  <p className="mt-0.5 text-xs text-[#526158]">
                    Theo dõi toàn bộ các lần thay đổi, thêm bớt đề mục và khôi phục về phiên bản cũ khi phiên bản mới không đạt tiêu chuẩn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewVersionModalOpen(true)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#087f5b] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#07543f]"
                >
                  <Plus size={15} />
                  Ghi nhận mốc phiên bản mới
                </button>
              </div>
            </div>

            {/* Danh sách Timeline các phiên bản */}
            <div className="space-y-4">
              {(template.versionHistory || []).map((ver) => {
                const isCurrent = ver.versionNum === template.currentVersion;
                return (
                  <article
                    key={ver.versionId}
                    className={`rounded-xl border p-5 shadow-xs transition-all ${
                      isCurrent
                        ? "border-emerald-400 bg-emerald-50/20 ring-1 ring-emerald-300"
                        : "border-[#e4eae6] bg-white hover:border-[#b8dec5]"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`grid size-10 shrink-0 place-items-center rounded-xl border text-sm font-bold ${
                            isCurrent
                              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                          }`}
                        >
                          v{ver.versionNum}.0
                        </span>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-[#17231c]">
                              Phiên bản v{ver.versionNum}.0
                            </h3>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                                <CheckCircle2 size={12} />
                                Phiên bản Hiện tại (Đang áp dụng)
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-[#526158]">
                            <strong>Ghi chú thay đổi: </strong>
                            <span className="text-[#17231c]">
                              {ver.changeNote || "Không có ghi chú chi tiết."}
                            </span>
                          </p>

                          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#526158]">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={13} className="text-[#087f5b]" />
                              {formatDate(ver.createdAt)}
                            </span>
                            <span>•</span>
                            <span>Người tạo: <strong>{ver.createdBy || "Ban Quản trị"}</strong></span>
                            <span>•</span>
                            <span>{ver.sectionsCount || ver.sections.length} đề mục cấu trúc</span>
                          </div>
                        </div>
                      </div>

                      {/* Nút Thao tác Khôi phục hoặc Xem trước phiên bản */}
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setInspectingVersion(ver)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e4eae6] bg-white px-3 text-xs font-semibold text-[#17231c] hover:bg-[#f2f6f3]"
                          title="Xem trước cấu trúc của phiên bản này"
                        >
                          <Eye size={14} className="text-[#087f5b]" />
                          Xem chi tiết cấu trúc
                        </button>

                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => setRollbackTarget(ver)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 hover:border-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
                            title={`Khôi phục cấu trúc mẫu về phiên bản v${ver.versionNum}.0`}
                          >
                            <RotateCcw size={14} className="text-amber-700" />
                            Khôi phục phiên bản này
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* MODAL 1: XÁC NHẬN KHÔI PHỤC PHIÊN BẢN (ROLLBACK MODAL) */}
        {rollbackTarget && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-lg rounded-2xl border border-[#e4eae6] bg-white p-6 shadow-2xl sm:p-7 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
                  <RotateCcw size={24} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[#17231c]">
                    Xác nhận Khôi phục Phiên bản Mẫu
                  </h3>
                  <p className="mt-1 text-xs text-[#526158]">
                    Khôi phục về cấu trúc của phiên bản cũ khi phiên bản chỉnh sửa hiện tại không đạt tiêu chuẩn.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                <p className="font-semibold">
                  Bạn đang chuẩn bị khôi phục về:{" "}
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 font-bold">
                    Phiên bản v{rollbackTarget.versionNum}.0
                  </span>
                </p>
                <div className="mt-2 space-y-1 text-amber-800">
                  <p>• Số lượng đề mục phiên bản khôi phục: <strong>{rollbackTarget.sections.length} đề mục</strong>.</p>
                  <p>• Ghi chú phiên bản đó: <em>&ldquo;{rollbackTarget.changeNote || "Không có"}&rdquo;</em>.</p>
                  <p>• Ngày tạo: {formatDate(rollbackTarget.createdAt)}.</p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-[#526158]">
                <strong>Cơ chế an toàn:</strong> Toàn bộ cấu trúc đề mục và nội dung mẫu sẽ được áp dụng lại theo phiên bản này. Đồng thời, hệ thống sẽ tự động tạo một phiên bản mới tiếp theo (v{(template.currentVersion || 1) + 1}.0) trong lịch sử để bạn có thể hoàn tác bất kỳ lúc nào mà không sợ mất dữ liệu.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isRollbacking}
                  onClick={() => setRollbackTarget(null)}
                  className="rounded-lg border border-[#e4eae6] px-4 py-2.5 text-xs font-semibold text-[#526158] hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>

                <button
                  type="button"
                  disabled={isRollbacking}
                  onClick={handleConfirmRollback}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {isRollbacking ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Đang khôi phục…
                    </>
                  ) : (
                    <>
                      <RotateCcw size={14} />
                      Xác nhận khôi phục ngay
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: XEM TRƯỚC PHIÊN BẢN LỊCH SỬ (INSPECT HISTORICAL VERSION) */}
        {inspectingVersion && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          >
            <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-[#e4eae6] bg-white shadow-2xl animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#e4eae6] px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-800">
                    Phiên bản v{inspectingVersion.versionNum}.0
                  </span>
                  <h3 className="font-bold text-[#17231c]">
                    Chi tiết cấu trúc đề mục lịch sử
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingVersion(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="rounded-lg bg-[#f7faf8] p-3 text-xs text-[#526158]">
                  <p><strong>Ghi chú:</strong> {inspectingVersion.changeNote}</p>
                  <p className="mt-1"><strong>Tạo lúc:</strong> {formatDate(inspectingVersion.createdAt)} bởi {inspectingVersion.createdBy || "Quản trị viên"}</p>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-[#526158]">
                  Danh sách {inspectingVersion.sections.length} đề mục trong phiên bản này:
                </h4>

                <div className="space-y-3">
                  {inspectingVersion.sections.map((s, i) => (
                    <div key={`insp-sec-${i}`} className="rounded-lg border border-gray-200 p-4 text-xs">
                      <div className="flex items-center justify-between font-bold text-[#17231c]">
                        <span>{i + 1}. {s.title}</span>
                        {s.required !== false && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Bắt buộc</span>
                        )}
                      </div>
                      <p className="mt-1 text-gray-600">{s.description}</p>
                      {s.contentPlaceholder && (
                        <div className="mt-2 rounded bg-gray-50 p-2.5 font-mono text-[11px] text-gray-700 whitespace-pre-wrap">
                          {s.contentPlaceholder}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e4eae6] px-6 py-4">
                {inspectingVersion.versionNum !== template.currentVersion && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = inspectingVersion;
                      setInspectingVersion(null);
                      setRollbackTarget(target);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    <RotateCcw size={14} />
                    Khôi phục về phiên bản này
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectingVersion(null)}
                  className="rounded-lg border border-[#e4eae6] px-4 py-2 text-xs font-semibold text-[#526158] hover:bg-gray-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: THÊM / CHỈNH SỬA ĐỀ MỤC */}
        {editingSection && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          >
            <form
              onSubmit={handleSaveSection}
              className="w-full max-w-xl rounded-2xl border border-[#e4eae6] bg-white p-6 shadow-2xl sm:p-7 animate-in fade-in"
            >
              <h3 className="text-lg font-bold text-[#17231c]">
                {editingSection.index === null ? "Thêm đề mục mới vào mẫu" : "Chỉnh sửa đề mục"}
              </h3>
              <p className="mt-1 text-xs text-[#526158]">
                Định nghĩa tiêu đề, hướng dẫn biên soạn và nội dung mẫu (Markdown) cho đề mục này.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17231c]">
                    Tiêu đề đề mục <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSection.section.title}
                    onChange={(e) =>
                      setEditingSection({
                        ...editingSection,
                        section: { ...editingSection.section, title: e.target.value },
                      })
                    }
                    placeholder="Ví dụ: 2. Xác thực và Phân quyền JWT"
                    className="mt-1.5 w-full rounded-lg border border-[#d2ddd6] px-3.5 py-2 text-sm text-[#17231c] focus:border-[#087f5b] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17231c]">
                    Hướng dẫn biên soạn dành cho tác giả
                  </label>
                  <textarea
                    rows={2}
                    value={editingSection.section.description}
                    onChange={(e) =>
                      setEditingSection({
                        ...editingSection,
                        section: { ...editingSection.section, description: e.target.value },
                      })
                    }
                    placeholder="Mô tả tóm tắt nội dung mà tác giả cần điền vào mục này..."
                    className="mt-1.5 w-full rounded-lg border border-[#d2ddd6] px-3.5 py-2 text-sm text-[#17231c] focus:border-[#087f5b] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17231c]">
                    Nội dung mẫu / Khung bố cục (Hỗ trợ Markdown)
                  </label>
                  <textarea
                    rows={5}
                    value={editingSection.section.contentPlaceholder || ""}
                    onChange={(e) =>
                      setEditingSection({
                        ...editingSection,
                        section: { ...editingSection.section, contentPlaceholder: e.target.value },
                      })
                    }
                    placeholder="Nhập nội dung mẫu, bảng biểu Markdown, ví dụ minh họa..."
                    className="mt-1.5 w-full rounded-lg border border-[#d2ddd6] p-3 font-mono text-xs text-[#17231c] focus:border-[#087f5b] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="sec-required-chk"
                    checked={editingSection.section.required !== false}
                    onChange={(e) =>
                      setEditingSection({
                        ...editingSection,
                        section: { ...editingSection.section, required: e.target.checked },
                      })
                    }
                    className="size-4 rounded border-gray-300 text-[#087f5b] focus:ring-[#087f5b]"
                  />
                  <label htmlFor="sec-required-chk" className="text-xs font-medium text-[#17231c]">
                    Đề mục bắt buộc (Tài liệu khởi tạo từ mẫu này bắt buộc phải có mục này)
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="rounded-lg border border-[#e4eae6] px-4 py-2.5 text-xs font-semibold text-[#526158] hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#087f5b] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#07543f]"
                >
                  Lưu đề mục
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL 4: LƯU PHIÊN BẢN MỚI */}
        {isNewVersionModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          >
            <form
              onSubmit={handleSaveNewVersion}
              className="w-full max-w-md rounded-2xl border border-[#e4eae6] bg-white p-6 shadow-2xl animate-in fade-in"
            >
              <h3 className="text-lg font-bold text-[#17231c]">
                Lưu mốc Phiên bản Mới (v{(template.currentVersion || 1) + 1}.0)
              </h3>
              <p className="mt-1 text-xs text-[#526158]">
                Ghi nhận cấu trúc đề mục hiện tại thành một mốc phiên bản trong lịch sử để có thể theo dõi và khôi phục khi cần.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-bold text-[#17231c]">
                  Ghi chú thay đổi (Change note)
                </label>
                <textarea
                  rows={3}
                  required
                  value={newVersionNote}
                  onChange={(e) => setNewVersionNote(e.target.value)}
                  placeholder="Ví dụ: Bổ sung đề mục Rate Limiting và định dạng bảng mã lỗi..."
                  className="mt-1.5 w-full rounded-lg border border-[#d2ddd6] p-3 text-sm text-[#17231c] focus:border-[#087f5b] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewVersionModalOpen(false)}
                  className="rounded-lg border border-[#e4eae6] px-4 py-2 text-xs font-semibold text-[#526158] hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#087f5b] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#07543f]"
                >
                  Xác nhận lưu mốc
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
