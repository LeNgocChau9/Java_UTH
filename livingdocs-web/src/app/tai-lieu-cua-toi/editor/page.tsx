"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MarkdownViewer } from "@/components/shared/MarkdownViewer";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import type { DocCollection, DocumentDetail, DocumentStatus } from "@/types/document";
import {
  Save,
  Send,
  ArrowLeft,
  Columns,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Link as LinkIcon,
  Copy,
  Check,
  Sparkles,
  FileText,
  ShieldCheck,
  ChevronDown,
  History,
} from "lucide-react";

const SAMPLE_MARKDOWN = `# Tài liệu Kiến trúc Hệ thống LivingDocs

## 1. Giới thiệu tổng quan
LivingDocs là nền tảng quản lý tài liệu sống (Living Documentation) đồng bộ tự động với kho mã nguồn GitHub, hỗ trợ phiên bản bất biến kèm chuỗi băm SHA-256 bảo vệ dữ liệu chống can thiệp trái phép.

### Các tính năng cốt lõi:
- **Chuỗi băm phiên bản (Hash-chain Integrity)**: Mỗi phiên bản nối tiếp được ký băm SHA-256 kế thừa phiên bản trước (Genesis Hash v1 -> vN).
- **Quy trình kiểm duyệt nghiêm ngặt (State Machine)**: \`DRAFT\` -> \`UNDER_REVIEW_STAFF\` -> \`UNDER_REVIEW_MANAGER\` -> \`APPROVED\` -> \`PUBLISHED\`.
- **Trình soạn thảo Split-View**: Soạn thảo Markdown với Line Numbers và xem trước thời gian thực.

## 2. Mô hình phân lớp Clean Architecture

| Tầng (Layer) | Thành phần | Trách nhiệm chính |
| :--- | :--- | :--- |
| **Domain** | Model & State Machine | Thực thể tài liệu, quy tắc chuyển trạng thái hợp lệ |
| **Application** | Port & Service | Xử lý logic nghiệp vụ, tính toán băm SHA-256 |
| **Infrastructure** | Web & Persistence | REST API Controllers, Spring Data JPA, PostgreSQL |

## 3. Đoạn mã mẫu (Code snippet)
\`\`\`typescript
// Gọi API lưu tài liệu nháp
const saveDraft = async (payload) => {
  const result = await documentService.createDocument({
    ...payload,
    triggerType: "MANUAL_CREATE"
  });
  console.log("Đã lưu nháp với Hash:", result.latestVersion?.hash);
};
\`\`\`

> **Lưu ý**: Sau khi hoàn thiện nội dung bản nháp, hãy nhấn nút **"Gửi để review"** ở góc trên bên phải để chuyển tài liệu vào hàng đợi kiểm duyệt của Staff Reviewer.
`;

const TEMPLATES: { name: string; content: string }[] = [
  {
    name: "API Reference Guide",
    content: `# [Tên API Service] - Tài liệu Đặc tả REST API\n\n## 1. Mục đích\nMô tả chi tiết các endpoint, tham số request và response cho service.\n\n## 2. Thông tin cơ bản\n- **Base URL**: \`/api/v1/...\`\n- **Xác thực**: Bearer JWT Token\n- **Định dạng dữ liệu**: \`application/json\`\n\n## 3. Danh sách Endpoint\n### GET /api/...\n**Mô tả**: Lấy danh sách tài nguyên.\n\n**Response 200 OK**:\n\`\`\`json\n{\n  "success": true,\n  "data": []\n}\n\`\`\`\n`,
  },
  {
    name: "Kiến trúc Module / Thiết kế Kỹ thuật",
    content: `# Tài liệu Thiết kế Kỹ thuật (Technical Design Doc)\n\n## 1. Bối cảnh & Vấn đề cần giải quyết\nNêu tóm tắt bài toán kỹ thuật hiện tại.\n\n## 2. Giải pháp đề xuất\nPhân tích kiến trúc tổng thể, mô hình dữ liệu và các tương tác.\n\n## 3. Rủi ro & Giải pháp dự phòng\n- Rủi ro 1: ...\n- Phương án xử lý: ...\n`,
  },
  {
    name: "Changelog & Hướng dẫn Triển khai",
    content: `# Release Notes & Deployment Guide\n\n## Phiên bản [vX.Y.Z] - Ngày phát hành: [DD/MM/YYYY]\n\n### Tính năng mới (New Features)\n- [x] Tính năng 1\n- [x] Tính năng 2\n\n### Hướng dẫn nâng cấp CSDL\n\`\`\`sql\n-- Migration script\n\`\`\`\n`,
  },
];

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("docId");

  const [docId, setDocId] = useState<number | null>(docIdParam ? parseInt(docIdParam, 10) : null);
  const [title, setTitle] = useState("Tài liệu mới không tiêu đề");
  const [content, setContent] = useState(SAMPLE_MARKDOWN);
  const [targetPath, setTargetPath] = useState("docs/guidelines.md");
  const [repoId, setRepoId] = useState<number>(1);
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [status, setStatus] = useState<DocumentStatus>("DRAFT");
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [latestHash, setLatestHash] = useState<string>("");

  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [collections, setCollections] = useState<DocCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "editor" | "preview">("split");
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [showConfirmReview, setShowConfirmReview] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hiển thị thông báo Toast
  const notify = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Nạp danh sách repositories và collections
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [repoList, colList] = await Promise.all([
          repoService.getRepositories().catch(() => []),
          documentService.getCollections().catch(() => []),
        ]);
        setRepos(repoList);
        setCollections(colList);

        if (repoList.length > 0 && !docIdParam) {
          setRepoId(repoList[0].repositoryId);
        }
        if (colList.length > 0 && !docIdParam) {
          setCollectionId(colList[0].id);
        }
      } catch (err) {
        console.error("Lỗi khi tải metadata:", err);
      }
    };

    fetchMetadata();
  }, [docIdParam]);

  // Nạp chi tiết tài liệu nếu đang sửa (docId)
  useEffect(() => {
    if (!docIdParam) return;
    const loadDoc = async () => {
      setLoading(true);
      try {
        const doc: DocumentDetail = await documentService.getDocumentById(parseInt(docIdParam, 10));
        setDocId(doc.docId);
        setTitle(doc.title);
        setTargetPath(doc.targetPath || "docs/document.md");
        setRepoId(doc.repoId);
        setCollectionId(doc.collectionId || null);
        setStatus(doc.status);
        setCurrentVersion(doc.currentVersion);
        if (doc.latestVersion) {
          setContent(doc.latestVersion.content || "");
          setLatestHash(doc.latestVersion.hash || "");
        }
        setIsDirty(false);
      } catch (err: any) {
        notify("error", "Không thể nạp tài liệu: " + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };

    loadDoc();
  }, [docIdParam]);

  // Phím tắt bàn phím Ctrl+S / Cmd+S để lưu nháp
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveDraft();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Chèn cú pháp markdown vào vị trí con trỏ trong Textarea
  const insertMarkdown = (prefix: string, suffix: string = "", defaultText: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    setIsDirty(true);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  // Xử lý nút "Lưu nháp"
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      notify("error", "Vui lòng nhập tiêu đề tài liệu!");
      return;
    }
    if (!content.trim()) {
      notify("error", "Nội dung tài liệu không được để trống!");
      return;
    }

    setSaving(true);
    try {
      if (docId) {
        // Cập nhật tài liệu đã có -> tạo phiên bản tiếp theo v(N+1)
        const updated = await documentService.updateDocument(docId, {
          title: title.trim(),
          targetPath: targetPath.trim(),
          collectionId,
          content,
          actorRole: "DEV",
          triggerType: "MANUAL_UPDATE",
        });
        setCurrentVersion(updated.currentVersion);
        setStatus(updated.status);
        if (updated.latestVersion) {
          setLatestHash(updated.latestVersion.hash);
        }
        setIsDirty(false);
        notify("success", `Đã lưu bản nháp thành công! (Phiên bản v${updated.currentVersion})`);
      } else {
        // Tạo tài liệu mới -> tạo Genesis v1
        const created = await documentService.createDocument({
          repoId,
          collectionId,
          title: title.trim(),
          targetPath: targetPath.trim(),
          content,
          actorRole: "DEV",
          triggerType: "MANUAL_CREATE",
        });
        setDocId(created.docId);
        setCurrentVersion(created.currentVersion);
        setStatus(created.status);
        if (created.latestVersion) {
          setLatestHash(created.latestVersion.hash);
        }
        setIsDirty(false);
        notify("success", `Đã tạo mới và lưu bản nháp thành công! (Phiên bản v1)`);
        // Thay đổi URL mà không reload trang
        router.replace(`/tai-lieu-cua-toi/editor?docId=${created.docId}`);
      }
    } catch (err: any) {
      notify("error", "Lưu nháp thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Xử lý nút "Gửi để review"
  const handleSubmitForReview = async () => {
    setShowConfirmReview(false);
    setSubmittingReview(true);

    try {
      let activeDocId = docId;

      // Nếu là tài liệu mới hoặc có thay đổi chưa lưu, tự động lưu trước khi gửi review
      if (!activeDocId || isDirty) {
        if (!title.trim() || !content.trim()) {
          notify("error", "Vui lòng điền tiêu đề và nội dung hợp lệ trước khi gửi review!");
          setSubmittingReview(false);
          return;
        }

        if (activeDocId) {
          await documentService.updateDocument(activeDocId, {
            title: title.trim(),
            targetPath: targetPath.trim(),
            collectionId,
            content,
            actorRole: "DEV",
            triggerType: "SUBMIT_FOR_REVIEW",
          });
        } else {
          const created = await documentService.createDocument({
            repoId,
            collectionId,
            title: title.trim(),
            targetPath: targetPath.trim(),
            content,
            actorRole: "DEV",
            triggerType: "SUBMIT_FOR_REVIEW",
          });
          activeDocId = created.docId;
          setDocId(created.docId);
          router.replace(`/tai-lieu-cua-toi/editor?docId=${created.docId}`);
        }
      }

      // Gọi API chuyển trạng thái sang UNDER_REVIEW_STAFF
      if (activeDocId) {
        const reviewed = await documentService.submitForReview(activeDocId);
        setStatus(reviewed.status);
        setCurrentVersion(reviewed.currentVersion);
        setIsDirty(false);
        notify("success", "Đã gửi tài liệu để review thành công! Trạng thái: Chờ duyệt (Staff Reviewer).");
      }
    } catch (err: any) {
      notify("error", "Gửi review thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingReview(false);
    }
  };

  // Sao chép nội dung Markdown
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Thống kê độ dài văn bản
  const stats = {
    words: content.trim() ? content.trim().split(/\s+/).length : 0,
    chars: content.length,
    lines: content.split("\n").length,
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          <div style={{ textAlign: "center", color: "var(--color-text-secondary)" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #b8dec5",
                borderTopColor: "#087f5b",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p>Đang tải tài liệu vào trình soạn thảo...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            background: toast.type === "success" ? "#065f46" : toast.type === "error" ? "#991b1b" : "#1e293b",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 500,
            animation: "fadeIn 200ms ease",
          }}
        >
          {toast.type === "success" && <CheckCircle2 size={16} />}
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.type === "info" && <Clock size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Điều hướng & Metadata Chính */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
          background: "#ffffff",
          padding: "16px 20px",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Nút Quay lại & Tiêu đề */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 280 }}>
            <Link
              href="/tai-lieu-cua-toi"
              className="ld-btn ld-btn-ghost ld-btn-sm"
              title="Quay lại danh sách tài liệu"
            >
              <ArrowLeft size={16} />
              <span>Danh sách</span>
            </Link>
            <div style={{ width: 1, height: 24, background: "var(--color-border)" }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Nhập tiêu đề tài liệu tại đây..."
                style={{
                  width: "100%",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  border: "none",
                  outline: "none",
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "transparent",
                  transition: "background 150ms",
                }}
                onFocus={(e) => (e.target.style.background = "var(--color-muted)")}
                onBlur={(e) => (e.target.style.background = "transparent")}
              />
            </div>
          </div>

          {/* Các nút Hành động: Lưu nháp & Gửi để review */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Trạng thái chưa lưu */}
            {isDirty && (
              <span
                style={{
                  fontSize: 12,
                  color: "#d97706",
                  background: "#fffbeb",
                  padding: "4px 8px",
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={12} />
                Chưa lưu
              </span>
            )}

            {/* Trạng thái & Phiên bản */}
            <span
              className="ld-badge"
              style={{
                background:
                  status === "DRAFT"
                    ? "#f1f5f9"
                    : status === "UNDER_REVIEW_STAFF" || status === "UNDER_REVIEW_MANAGER"
                    ? "#fffbeb"
                    : "#ecfdf5",
                color:
                  status === "DRAFT"
                    ? "#475569"
                    : status === "UNDER_REVIEW_STAFF" || status === "UNDER_REVIEW_MANAGER"
                    ? "#b45309"
                    : "#059669",
              }}
            >
              {status === "DRAFT"
                ? "Bản nháp"
                : status === "UNDER_REVIEW_STAFF"
                ? "Chờ Staff duyệt"
                : status === "UNDER_REVIEW_MANAGER"
                ? "Chờ Manager duyệt"
                : status === "APPROVED"
                ? "Đã duyệt"
                : status === "PUBLISHED"
                ? "Đã xuất bản"
                : status}
              {" · v" + currentVersion}
            </span>

            {/* NÚT XEM LỊCH SỬ & SO SÁNH DIFF */}
            {docId && (
              <Link
                href={`/tai-lieu-cua-toi/lich-su?docId=${docId}`}
                className="ld-btn ld-btn-ghost"
                style={{ color: "var(--color-accent)", fontWeight: 500 }}
                title="Xem lịch sử các phiên bản và so sánh Diff song song"
              >
                <History size={15} />
                <span>Lịch sử & Diff</span>
              </Link>
            )}

            {/* NÚT LƯU NHÁP */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || submittingReview}
              className="ld-btn ld-btn-secondary"
              title="Lưu bản nháp (Ctrl+S)"
            >
              <Save size={15} style={{ color: "#087f5b" }} />
              <span>{saving ? "Đang lưu..." : "Lưu nháp"}</span>
            </button>

            {/* NÚT GỬI ĐỂ REVIEW */}
            <button
              type="button"
              onClick={() => setShowConfirmReview(true)}
              disabled={saving || submittingReview || status === "UNDER_REVIEW_STAFF"}
              className="ld-btn ld-btn-primary"
              style={{
                boxShadow: "0 2px 6px rgba(8, 127, 91, 0.25)",
              }}
              title="Gửi tài liệu này tới kiểm duyệt viên để phê duyệt"
            >
              <Send size={15} />
              <span>
                {submittingReview
                  ? "Đang gửi..."
                  : status === "UNDER_REVIEW_STAFF"
                  ? "Đang chờ duyệt"
                  : "Gửi để review"}
              </span>
            </button>
          </div>
        </div>

        {/* Dòng Cấu hình Repository, Collection và File Path */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            paddingTop: 12,
            borderTop: "1px dashed var(--color-border)",
            fontSize: 13,
          }}
        >
          {/* Bộ sưu tập (Collection) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Bộ sưu tập (Collection)
            </label>
            <select
              value={collectionId || ""}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                setCollectionId(val);
                setIsDirty(true);
              }}
              className="ld-select"
              style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
            >
              <option value="">-- Chưa gán bộ sưu tập --</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  📁 {col.name} {col.documentCount !== undefined ? `(${col.documentCount})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Kho mã nguồn (Repository) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Kho lưu trữ (Repository)
            </label>
            <select
              value={repoId}
              onChange={(e) => {
                setRepoId(parseInt(e.target.value, 10));
                setIsDirty(true);
              }}
              className="ld-select"
              style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
            >
              {repos.length === 0 ? (
                <option value={1}>livingdocs-backend</option>
              ) : (
                repos.map((repo) => (
                  <option key={repo.repositoryId} value={repo.repositoryId}>
                    📦 {repo.repoFullName || repo.repoName}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Đường dẫn file trong Repo */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Đường dẫn tệp đích (Target File Path)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => {
                  setTargetPath(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="docs/architecture.md"
                className="ld-input"
                style={{ padding: "6px 10px", fontSize: 13 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Thanh Công cụ Định dạng Markdown & Điều khiển Chế độ xem */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          background: "#ffffff",
          padding: "8px 14px",
          borderRadius: "8px 8px 0 0",
          border: "1px solid var(--color-border)",
          borderBottom: "none",
        }}
      >
        {/* Nhóm nút format */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => insertMarkdown("# ", "", "Tiêu đề lớn")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Heading 1"
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("## ", "", "Tiêu đề cấp 2")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Heading 2"
          >
            <Heading2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("### ", "", "Tiêu đề cấp 3")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Heading 3"
          >
            <Heading3 size={15} />
          </button>

          <div style={{ width: 1, height: 18, background: "var(--color-border)", margin: "0 4px" }} />

          <button
            type="button"
            onClick={() => insertMarkdown("**", "**", "chữ đậm")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="In đậm (Bold)"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("*", "*", "chữ nghiêng")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="In nghiêng (Italic)"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("~~", "~~", "chữ gạch ngang")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Gạch ngang"
          >
            <Strikethrough size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("`", "`", "code_inline")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Code một dòng"
          >
            <Code size={14} />
          </button>

          <div style={{ width: 1, height: 18, background: "var(--color-border)", margin: "0 4px" }} />

          <button
            type="button"
            onClick={() => insertMarkdown("```typescript\n// Mã nguồn\n", "\n```\n")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Khối mã (Code block)"
          >
            <FileCode size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("- ", "", "Mục danh sách")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Danh sách dấu chấm"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("1. ", "", "Mục thứ nhất")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Danh sách đánh số"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("- [ ] ", "", "Nhiệm vụ cần làm")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Danh sách kiểm tra (Task list)"
          >
            <CheckSquare size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("> ", "", "Trích dẫn quan trọng")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Khối trích dẫn (Blockquote)"
          >
            <Quote size={14} />
          </button>
          <button
            type="button"
            onClick={() =>
              insertMarkdown(
                "\n| Cột 1 | Cột 2 | Cột 3 |\n| :--- | :--- | :--- |\n| Giá trị A | Giá trị B | Giá trị C |\n"
              )
            }
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Chèn bảng (Table)"
          >
            <TableIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("[", "](https://example.com)", "Tên liên kết")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Chèn link"
          >
            <LinkIcon size={14} />
          </button>

          <div style={{ width: 1, height: 18, background: "var(--color-border)", margin: "0 4px" }} />

          {/* Chèn Mẫu Template có sẵn */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              className="ld-btn ld-btn-ghost ld-btn-sm"
              style={{ color: "#087f5b" }}
            >
              <Sparkles size={13} />
              <span>Chèn mẫu</span>
              <ChevronDown size={11} />
            </button>
            {showTemplateDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 50,
                  marginTop: 4,
                  background: "#ffffff",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                  minWidth: 220,
                  overflow: "hidden",
                }}
              >
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setContent(tpl.content);
                      setIsDirty(true);
                      setShowTemplateDropdown(false);
                      notify("info", `Đã tải mẫu: ${tpl.name}`);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      textAlign: "left",
                      fontSize: 12,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      borderBottom: i < TEMPLATES.length - 1 ? "1px solid #f1f5f9" : "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chuyển đổi Chế độ xem: Chia đôi (Split) / Chỉ Soạn thảo / Chỉ Xem trước */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`ld-btn ld-btn-sm ${viewMode === "split" ? "ld-btn-primary" : "ld-btn-ghost"}`}
            title="Chế độ chia đôi (Split View: Edit bên trái, Preview bên phải)"
          >
            <Columns size={14} />
            <span>Chia đôi</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("editor")}
            className={`ld-btn ld-btn-sm ${viewMode === "editor" ? "ld-btn-primary" : "ld-btn-ghost"}`}
            title="Chỉ hiển thị khung soạn thảo"
          >
            <FileText size={14} />
            <span>Soạn thảo</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`ld-btn ld-btn-sm ${viewMode === "preview" ? "ld-btn-primary" : "ld-btn-ghost"}`}
            title="Chỉ hiển thị khung xem trước"
          >
            <Maximize2 size={14} />
            <span>Xem trước</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Sao chép toàn bộ Markdown"
          >
            {copied ? <Check size={14} style={{ color: "#087f5b" }} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* KHUNG SOẠN THẢO VÀ XEM TRƯỚC (SPLIT-VIEW) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            viewMode === "split"
              ? "1fr 1fr"
              : viewMode === "editor"
              ? "1fr"
              : "1fr",
          border: "1px solid var(--color-border)",
          borderRadius: "0 0 8px 8px",
          background: "#ffffff",
          minHeight: "65vh",
          overflow: "hidden",
        }}
      >
        {/* PANE BÊN TRÁI: KHUNG SOẠN THẢO MARKDOWN */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderRight: viewMode === "split" ? "1px solid var(--color-border)" : "none",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                background: "var(--color-muted)",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>TRÌNH SOẠN THẢO MARKDOWN (CHỈNH SỬA)</span>
              <span>Hỗ trợ Markdown & GFM</span>
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setIsDirty(true);
              }}
              onKeyDown={(e) => {
                // Nhấn Tab để chèn 2 dấu cách thay vì nhảy focus
                if (e.key === "Tab") {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  const newContent = content.substring(0, start) + "  " + content.substring(end);
                  setContent(newContent);
                  setIsDirty(true);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
                    }
                  }, 0);
                }
              }}
              placeholder="Bắt đầu nhập nội dung Markdown tại đây..."
              style={{
                flex: 1,
                width: "100%",
                minHeight: 520,
                padding: "16px 20px",
                fontFamily: "var(--font-mono)",
                fontSize: 13.5,
                lineHeight: 1.7,
                color: "var(--color-text-primary)",
                background: "#fafbfc",
                border: "none",
                outline: "none",
                resize: "none",
              }}
            />

            {/* Thanh Trạng thái dòng & từ ở đáy khung soạn thảo */}
            <div
              style={{
                padding: "6px 16px",
                fontSize: 11,
                color: "var(--color-text-secondary)",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", gap: 14 }}>
                <span>{stats.lines} dòng</span>
                <span>{stats.words} từ</span>
                <span>{stats.chars} ký tự</span>
              </div>
              {latestHash && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#087f5b",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  title={`SHA-256 Hash: ${latestHash}`}
                >
                  <ShieldCheck size={13} />
                  <span>Hash: {latestHash.substring(0, 12)}...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANE BÊN PHẢI: KHUNG XEM TRƯỚC (PREVIEW) */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
              height: "100%",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                background: "var(--color-muted)",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>XEM TRƯỚC TRỰC TIẾP (PREVIEW)</span>
              <span style={{ color: "#087f5b", fontWeight: 500 }}>Live Render</span>
            </div>

            <div
              style={{
                flex: 1,
                padding: "24px 32px",
                overflowY: "auto",
                maxHeight: "75vh",
              }}
            >
              {content.trim() ? (
                <MarkdownViewer content={content} />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--color-text-disabled)",
                    textAlign: "center",
                    padding: "40px 0",
                  }}
                >
                  <FileText size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 14, fontWeight: 500 }}>Chưa có nội dung để hiển thị</p>
                  <p style={{ fontSize: 12 }}>Hãy nhập văn bản Markdown ở khung bên trái để xem kết quả trực tiếp.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL XÁC NHẬN "GỬI ĐỂ REVIEW" */}
      {showConfirmReview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="ld-card"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              animation: "fadeIn 150ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: "#eaf6ef",
                  color: "#087f5b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                  Xác nhận gửi để review?
                </h3>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                  Chuyển trạng thái sang Hàng đợi Kiểm duyệt Staff
                </p>
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
                background: "var(--color-muted)",
                padding: "12px 16px",
                borderRadius: 6,
                marginBottom: 20,
              }}
            >
              <p style={{ margin: "0 0 8px 0" }}>
                Khi bạn gửi review, hệ thống sẽ:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Tự động lưu nội dung mới nhất vào phiên bản tiếp theo.</li>
                <li>Chuyển trạng thái từ <strong>DRAFT</strong> sang <strong>UNDER_REVIEW_STAFF</strong>.</li>
                <li>Thông báo tới các kiểm duyệt viên (Staff Reviewers) để xem xét nội dung.</li>
              </ul>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowConfirmReview(false)}
                className="ld-btn ld-btn-secondary"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmitForReview}
                className="ld-btn ld-btn-primary"
              >
                <Send size={14} />
                <span>Xác nhận gửi review</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function DocumentEditorPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ padding: 40, textAlign: "center" }}>Đang tải trình soạn thảo...</div>
        </AppShell>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
