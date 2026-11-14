"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Copy,
  FileStack,
  FileText,
  LayoutTemplate,
  Plus,
  Trash2,
  X,
  Eye,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { loadTemplates, saveTemplates } from "@/services/templateStorage";
import type { DocumentTemplate } from "@/types/template";

type DialogState =
  | { kind: "create" }
  | { kind: "delete"; template: DocumentTemplate }
  | null;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Ngày không xác định"
    : date.toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });
}

function TemplateCard({
  template,
  onCopy,
  onDelete,
  onPreview,
}: {
  template: DocumentTemplate;
  onCopy: (template: DocumentTemplate) => void;
  onDelete: (template: DocumentTemplate) => void;
  onPreview: (template: DocumentTemplate) => void;
}) {
  const versionText = `v${template.currentVersion || 1}.0`;
  const isPublished = template.status === "PUBLISHED";

  return (
    <article className="group flex min-h-[290px] flex-col rounded-xl border border-[#e4eae6] bg-white p-5 shadow-[0_1px_2px_rgb(21_48_32_/_4%)] transition-colors hover:border-[#b8dec5] sm:p-6">
      <Link
        href={`/quan-ly-template/${encodeURIComponent(template.id)}`}
        aria-label={`Xem chi tiết template ${template.name}`}
        className="flex flex-1 flex-col rounded-md outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087f5b]"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#b8dec5] bg-[#eaf6ef] text-[#07543f]">
            <FileText aria-hidden size={20} strokeWidth={1.7} />
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
              <Sparkles size={11} />
              {versionText}
            </span>
            {isPublished ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                <CheckCircle2 size={11} />
                Đã xuất bản
              </span>
            ) : (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Bản nháp
              </span>
            )}
            <span className="rounded-full border border-[#b8dec5] bg-[#eaf6ef] px-2.5 py-0.5 text-[11px] font-medium text-[#07543f]">
              {template.type}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-semibold tracking-tight text-[#17231c] transition-colors group-hover:text-[#07543f]">
            {template.name}
          </h2>
          <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-[#526158]">
            {template.description}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#e4eae6] pt-3 text-xs text-[#526158]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden size={14} />
            {formatDate(template.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileStack aria-hidden size={14} />
            {template.documentCount} tài liệu sử dụng
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#087f5b] font-medium">
            <BookOpen aria-hidden size={14} />
            {template.sections.length} đề mục
          </span>
        </div>

        <span className="mt-auto inline-flex min-h-10 items-center gap-2 pt-3 text-sm font-semibold text-[#087f5b]">
          Xem chi tiết &amp; phiên bản
          <ArrowRight aria-hidden size={15} />
        </span>
      </Link>
      <div className="mt-2 flex justify-end gap-1 border-t border-[#e4eae6] pt-2">
        <button
          type="button"
          onClick={() => onPreview(template)}
          aria-label={`Xem trước mẫu ${template.name}`}
          title="Xem trước trực quan cấu trúc đề mục"
          className="grid min-h-10 min-w-10 place-items-center rounded-md text-[#087f5b] transition-colors hover:bg-[#eaf6ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087f5b]"
        >
          <Eye aria-hidden size={16} />
        </button>
        <button
          type="button"
          onClick={() => onCopy(template)}
          aria-label={`Sao chép template ${template.name}`}
          title="Sao chép template"
          className="grid min-h-10 min-w-10 place-items-center rounded-md text-[#526158] transition-colors hover:bg-[#f2f6f3] hover:text-[#17231c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087f5b]"
        >
          <Copy aria-hidden size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(template)}
          aria-label={`Xóa template ${template.name}`}
          title="Xóa template"
          className="grid min-h-10 min-w-10 place-items-center rounded-md text-[#526158] transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087f5b]"
        >
          <Trash2 aria-hidden size={16} />
        </button>
      </div>
    </article>
  );
}

export function TemplateLibrary() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<DocumentTemplate | null>(null);

  useEffect(() => {
    try {
      setTemplates(loadTemplates());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách template.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) {
      return;
    }

    if (dialog && !element.open) {
      element.showModal();
    } else if (!dialog && element.open) {
      element.close();
    }
  }, [dialog]);

  function persist(nextTemplates: DocumentTemplate[]): string | null {
    try {
      saveTemplates(nextTemplates);
      setTemplates(nextTemplates);
      setError(null);
      return null;
    } catch (saveError) {
      const message = saveError instanceof Error
        ? saveError.message
        : "Không thể lưu thay đổi template.";
      setError(message);
      return message;
    }
  }

  function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!name || !type || !description) {
      setDialogError("Vui lòng nhập đầy đủ tên, loại và mô tả template.");
      return;
    }

    const newTemplateId = crypto.randomUUID();
    const template: DocumentTemplate = {
      id: newTemplateId,
      name,
      type,
      description,
      status: "DRAFT",
      currentVersion: 1,
      createdAt: new Date().toISOString(),
      documentCount: 0,
      sections: [
        {
          id: `sec-${Date.now()}-1`,
          title: "1. Tổng quan",
          description: "Mục đích và phạm vi của tài liệu.",
          required: true,
          contentPlaceholder: "Trình bày tổng quan mục đích tài liệu tại đây...",
        },
      ],
      versionHistory: [
        {
          versionId: `v1-${newTemplateId}`,
          versionNum: 1,
          createdAt: new Date().toISOString(),
          createdBy: "Người khởi tạo",
          changeNote: "Khởi tạo bản nháp mẫu tài liệu ban đầu",
          sectionsCount: 1,
          sections: [
            {
              id: `sec-${Date.now()}-1`,
              title: "1. Tổng quan",
              description: "Mục đích và phạm vi của tài liệu.",
              required: true,
              contentPlaceholder: "Trình bày tổng quan mục đích tài liệu tại đây...",
            },
          ],
          isCurrent: true,
        },
      ],
    };

    const saveError = persist([template, ...templates]);
    if (saveError) {
      setDialogError(saveError);
      return;
    }

    setDialog(null);
    setNotice(`Đã tạo template ${template.name}.`);
    router.push(`/quan-ly-template/${encodeURIComponent(template.id)}`);
  }

  function copyTemplate(template: DocumentTemplate) {
    const copyId = crypto.randomUUID();
    const copy: DocumentTemplate = {
      ...template,
      id: copyId,
      name: `${template.name} (Bản sao)`,
      status: "DRAFT",
      currentVersion: 1,
      createdAt: new Date().toISOString(),
      documentCount: 0,
      sections: JSON.parse(JSON.stringify(template.sections)),
      versionHistory: [
        {
          versionId: `v1-${copyId}`,
          versionNum: 1,
          createdAt: new Date().toISOString(),
          createdBy: "Người sao chép",
          changeNote: `Sao chép từ mẫu "${template.name}"`,
          sectionsCount: template.sections.length,
          sections: JSON.parse(JSON.stringify(template.sections)),
          isCurrent: true,
        },
      ],
    };

    const saveError = persist([copy, ...templates]);
    if (saveError) {
      return;
    }
    setNotice(`Đã nhân bản ${template.name}.`);
  }

  function deleteTemplate() {
    if (!dialog || dialog.kind !== "delete") {
      return;
    }

    const { template } = dialog;
    const saveError = persist(templates.filter((item) => item.id !== template.id));
    if (saveError) {
      setDialogError(saveError);
      return;
    }

    setDialog(null);
    setNotice(`Đã xóa template ${template.name}.`);
  }

  function openDialog(nextDialog: DialogState) {
    setDialogError(null);
    setDialog(nextDialog);
  }

  const buttonClass =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#087f5b] bg-[#087f5b] px-4 text-sm font-semibold text-white transition-colors hover:border-[#066548] hover:bg-[#066548] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f5b]";

  return (
    <section className="-mx-4 -my-8 min-h-[calc(100dvh-4rem)] bg-[#f7faf8] px-4 py-8 text-[#17231c] sm:-mx-8 sm:-my-10 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#07543f]">
              <LayoutTemplate aria-hidden size={15} />
              Thư viện nội dung
            </div>
            <h1 className="font-display text-3xl tracking-tight text-[#17231c] sm:text-4xl">
              Quản lý Mẫu tài liệu (Template Management)
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526158]">
              Xem trước trực quan cách bố trí các đề mục, theo dõi lịch sử phiên bản và xuất bản mẫu vào thư viện dùng chung.
            </p>
          </div>
          <button type="button" onClick={() => openDialog({ kind: "create" })} className={buttonClass}>
            <Plus aria-hidden size={18} />
            Tạo Mẫu tài liệu mới
          </button>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e4eae6] bg-white px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-[#17231c]">
            <BookOpen aria-hidden size={16} className="text-[#087f5b]" />
            {loading ? "Đang tải mẫu…" : `${templates.length} mẫu tài liệu sẵn dùng`}
          </span>
          <span className="text-xs text-[#526158]">
            Hệ thống hỗ trợ xem trước trực quan và khôi phục lịch sử phiên bản mẫu an toàn.
          </span>
        </div>

        {error ? (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">{notice}</p>

        {loading ? (
          <div className="grid min-h-52 place-items-center rounded-lg border border-[#e4eae6] bg-white text-sm text-[#526158]">
            Đang tải thư viện template…
          </div>
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onCopy={copyTemplate}
                onDelete={(selected) => openDialog({ kind: "delete", template: selected })}
                onPreview={(selected) => setPreviewingTemplate(selected)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-[#e4eae6] bg-white px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-full border border-[#b8dec5] bg-[#eaf6ef] text-[#07543f]">
              <FileText aria-hidden size={22} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-[#17231c]">Chưa có template nào</h2>
            <p className="mt-1 max-w-sm text-sm text-[#526158]">
              Tạo template đầu tiên để bắt đầu xây dựng thư viện tài liệu dùng chung.
            </p>
            <button type="button" onClick={() => openDialog({ kind: "create" })} className={`${buttonClass} mt-5`}>
              <Plus aria-hidden size={17} />
              Tạo Template
            </button>
          </div>
        )}

        {/* MODAL XEM TRƯỚC NHANH TỪ THƯ VIỆN */}
        {previewingTemplate && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          >
            <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-[#e4eae6] bg-white shadow-2xl animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#e4eae6] px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#eaf6ef] px-2.5 py-0.5 text-xs font-semibold text-[#07543f]">
                    {previewingTemplate.type}
                  </span>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
                    v{previewingTemplate.currentVersion || 1}.0
                  </span>
                  <h3 className="font-bold text-[#17231c]">
                    Xem trước nhanh: {previewingTemplate.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewingTemplate(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <p className="text-sm text-[#526158]">{previewingTemplate.description}</p>

                <div className="rounded-xl border border-[#e4eae6] bg-[#f7faf8] p-4 text-xs">
                  <h4 className="font-bold text-[#17231c] uppercase tracking-wider mb-2">
                    Bố trí các đề mục chuẩn ({previewingTemplate.sections.length} đề mục):
                  </h4>
                  <div className="space-y-2.5">
                    {previewingTemplate.sections.map((sec, i) => (
                      <div key={`quick-sec-${i}`} className="rounded-lg border border-[#e4eae6] bg-white p-3">
                        <div className="flex items-center justify-between font-bold text-[#17231c]">
                          <span>{i + 1}. {sec.title}</span>
                          {sec.required !== false ? (
                            <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-medium">Bắt buộc</span>
                          ) : (
                            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Tùy chọn</span>
                          )}
                        </div>
                        {sec.description && (
                          <p className="mt-1 text-xs text-[#526158]">{sec.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e4eae6] px-6 py-4">
                <button
                  type="button"
                  onClick={() => setPreviewingTemplate(null)}
                  className="rounded-lg border border-[#e4eae6] px-4 py-2 text-xs font-semibold text-[#526158] hover:bg-gray-50"
                >
                  Đóng
                </button>
                <Link
                  href={`/quan-ly-template/${encodeURIComponent(previewingTemplate.id)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#087f5b] px-4 py-2 text-xs font-bold text-white hover:bg-[#07543f]"
                >
                  <Eye size={14} />
                  Mở Trình Xem Trước &amp; Quản Lý Phiên Bản
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG THÊM / XÓA TEMPLATE */}
        <dialog
          ref={dialogRef}
          aria-labelledby="template-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            setDialog(null);
          }}
          className="m-auto w-full max-w-lg rounded-xl border border-[#e4eae6] bg-white p-0 text-[#17231c] shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-xs"
        >
          {dialog?.kind === "create" ? (
            <form onSubmit={createTemplate}>
              <div className="border-b border-[#e4eae6] p-6">
                <div className="flex items-center justify-between">
                  <h2 id="template-dialog-title" className="text-lg font-semibold">Tạo Template mới</h2>
                  <button type="button" onClick={() => setDialog(null)} className="rounded-md p-1 text-[#526158] hover:bg-[#f2f6f3]">
                    <X aria-hidden size={18} />
                  </button>
                </div>
              </div>
              <div className="space-y-4 p-6">
                {dialogError ? (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {dialogError}
                  </p>
                ) : null}
                <label className="block text-sm font-medium text-[#17231c]">
                  Tên template
                  <input name="name" required maxLength={100} className="mt-1.5 min-h-11 w-full rounded-md border border-[#e4eae6] bg-white px-3 py-2 text-[#17231c] placeholder:text-[#738078] focus:border-[#087f5b] focus:outline-none focus:ring-2 focus:ring-[#087f5b]/20" placeholder="Ví dụ: Thiết kế hệ thống" />
                </label>
                <label className="block text-sm font-medium text-[#17231c]">
                  Loại template
                  <input name="type" required maxLength={50} className="mt-1.5 min-h-11 w-full rounded-md border border-[#e4eae6] bg-white px-3 py-2 text-[#17231c] placeholder:text-[#738078] focus:border-[#087f5b] focus:outline-none focus:ring-2 focus:ring-[#087f5b]/20" placeholder="Ví dụ: Kỹ thuật" />
                </label>
                <label className="block text-sm font-medium text-[#17231c]">
                  Mô tả
                  <textarea name="description" required maxLength={300} rows={3} className="mt-1.5 min-h-24 w-full resize-y rounded-md border border-[#e4eae6] bg-white px-3 py-2 text-[#17231c] placeholder:text-[#738078] focus:border-[#087f5b] focus:outline-none focus:ring-2 focus:ring-[#087f5b]/20" placeholder="Template này dùng để tạo loại tài liệu nào?" />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#e4eae6] px-6 py-4">
                <button type="button" onClick={() => setDialog(null)} className="min-h-11 rounded-md border border-[#e4eae6] px-4 text-sm font-medium text-[#17231c] hover:bg-[#f2f6f3]">
                  Hủy
                </button>
                <button type="submit" className={buttonClass}>
                  <Plus aria-hidden size={16} />
                  Tạo Template
                </button>
              </div>
            </form>
          ) : dialog?.kind === "delete" ? (
            <div className="p-6">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700">
                  <Trash2 aria-hidden size={19} />
                </span>
                <div>
                  <h2 id="template-dialog-title" className="text-lg font-semibold">Xóa Template?</h2>
                  <p className="mt-2 text-sm leading-6 text-[#526158]">
                    Bạn có chắc muốn xóa <strong className="font-semibold text-[#17231c]">{dialog.template.name}</strong>? Thao tác này không thể hoàn tác.
                  </p>
                </div>
              </div>
              {dialogError ? (
                <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {dialogError}
                </p>
              ) : null}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setDialog(null)} className="min-h-11 rounded-md border border-[#e4eae6] px-4 text-sm font-medium text-[#17231c] hover:bg-[#f2f6f3]">
                  Hủy
                </button>
                <button type="button" onClick={deleteTemplate} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50">
                  <Trash2 aria-hidden size={16} />
                  Xóa Template
                </button>
              </div>
            </div>
          ) : null}
        </dialog>
      </div>
    </section>
  );
}
