"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import { templateService, type DocTemplateDto } from "@/services/templateService";
import type { DocCollection, DocumentItem, IntegrityCheckResult } from "@/types/document";
import {
  FileText,
  GitBranch,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Trash2,
  Plus,
  Folder,
  FolderPlus,
  Search,
  RefreshCw,
  ShieldCheck,
  Send,
  Layers,
  X,
  History,
  Sparkles,
  Upload,
  Globe,
  FileUp,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; border: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: "Bản nháp",
    bg: "#f1f5f9",
    color: "#475569",
    border: "#e2e8f0",
    icon: <Edit3 size={11} />,
  },
  UNDER_REVIEW_STAFF: {
    label: "Chờ Staff duyệt",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
    icon: <Clock size={11} />,
  },
  UNDER_REVIEW_MANAGER: {
    label: "Chờ Manager duyệt",
    bg: "#fef3c7",
    color: "#92400e",
    border: "#fcd34d",
    icon: <Clock size={11} />,
  },
  APPROVED: {
    label: "Đã phê duyệt",
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
    icon: <CheckCircle2 size={11} />,
  },
  PUBLISHED: {
    label: "Đã xuất bản",
    bg: "#ecfdf5",
    color: "#059669",
    border: "#a7f3d0",
    icon: <CheckCircle2 size={11} />,
  },
  REJECTED: {
    label: "Bị từ chối",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
    icon: <AlertTriangle size={11} />,
  },
};

const STATUS_FILTERS = [
  { key: "ALL", label: "Tất cả trạng thái" },
  { key: "PUBLISHED", label: "Đã xuất bản" },
  { key: "REVIEW", label: "Đang xem xét" },
  { key: "DRAFT", label: "Bản nháp" },
  { key: "APPROVED", label: "Đã phê duyệt" },
  { key: "REJECTED", label: "Bị từ chối" },
];

function getMatchingSnippet(content: string | undefined | null, query: string): string | null {
  if (!content || !query.trim()) return null;
  const q = query.trim().toLowerCase();
  const lowerContent = content.toLowerCase();
  const idx = lowerContent.indexOf(q);
  if (idx === -1) return null;

  const start = Math.max(0, idx - 45);
  const end = Math.min(content.length, idx + q.length + 55);
  let snippet = content.slice(start, end).replace(/\r?\n|\r/g, " ");
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}

function highlightMatch(text: string | null | undefined, query: string): React.ReactNode {
  if (!text) return "";
  if (!query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <mark
        key={i}
        style={{
          background: "#fef08a",
          color: "#854d0e",
          padding: "1px 3px",
          borderRadius: 3,
          fontWeight: 600,
        }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function DocumentListPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCollectionId = searchParams.get("collectionId");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [collections, setCollections] = useState<DocCollection[]>([]);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [templates, setTemplates] = useState<DocTemplateDto[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(
    initialCollectionId ? parseInt(initialCollectionId, 10) : null
  );

  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Modal tạo Bộ sưu tập
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");
  const [creatingCol, setCreatingCol] = useState(false);

  // Modal xác nhận xóa tài liệu
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  // Modal xác nhận xóa Bộ sưu tập
  const [collectionToDelete, setCollectionToDelete] = useState<DocCollection | null>(null);
  const [deletingCol, setDeletingCol] = useState(false);

  // Modal kiểm tra tính toàn vẹn Hash Chain
  const [integrityDoc, setIntegrityDoc] = useState<{
    doc: DocumentItem;
    result: IntegrityCheckResult;
  } | null>(null);
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);

  // Modal 1: Upload tài liệu từ máy tính (Word .docx, Markdown .md)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRepoId, setUploadRepoId] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTargetPath, setUploadTargetPath] = useState("");
  const [uploading, setUploading] = useState(false);

  // Modal 2: Kết nối MCP riêng (Google Docs, Confluence, Jira)
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [mcpPlatform, setMcpPlatform] = useState<"GOOGLE_DOCS" | "CONFLUENCE" | "JIRA">("GOOGLE_DOCS");
  const [mcpRepoId, setMcpRepoId] = useState<string>("");
  const [mcpTitle, setMcpTitle] = useState("");
  const [mcpTargetPath, setMcpTargetPath] = useState("");
  const [mcpUrlOrId, setMcpUrlOrId] = useState("");
  const [mcpConnecting, setMcpConnecting] = useState(false);

  // Hiển thị thông báo
  const notify = useCallback((type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Nạp dữ liệu từ backend
  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [docs, cols, rps, tmpls] = await Promise.all([
        documentService.getDocuments(),
        documentService.getCollections().catch(() => []),
        repoService.getRepositories().catch(() => []),
        templateService.getTemplates().catch(() => []),
      ]);
      const sortedDocs = [...docs].sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      setDocuments(sortedDocs);
      setCollections(cols);
      setRepos(rps);
      setTemplates(tmpls || []);
    } catch (err: any) {
      console.error("Lỗi nạp dữ liệu:", err);
      notify("error", "Không thể nạp dữ liệu tài liệu: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map repoId thành repoName
  const repoMap = useMemo(() => {
    const map = new Map<number, string>();
    repos.forEach((r) => map.set(r.repositoryId, r.repoFullName || r.repoName));
    return map;
  }, [repos]);

  // Map collectionId thành collectionName
  const collectionMap = useMemo(() => {
    const map = new Map<number, string>();
    collections.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [collections]);

  // Map templateId thành DocTemplateDto
  const templateMap = useMemo(() => {
    const map = new Map<number, DocTemplateDto>();
    templates.forEach((t) => map.set(t.id, t));
    return map;
  }, [templates]);

  // Đếm số lượng tài liệu theo từng trạng thái phê duyệt
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: documents.length,
      PUBLISHED: 0,
      REVIEW: 0,
      DRAFT: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    documents.forEach((d) => {
      if (d.status === "PUBLISHED") counts.PUBLISHED++;
      else if (d.status === "UNDER_REVIEW_STAFF" || d.status === "UNDER_REVIEW_MANAGER") counts.REVIEW++;
      else if (d.status === "DRAFT") counts.DRAFT++;
      else if (d.status === "APPROVED") counts.APPROVED++;
      else if (d.status === "REJECTED") counts.REJECTED++;
    });
    return counts;
  }, [documents]);

  // Kiểm tra có bất kỳ bộ lọc hoặc từ khóa nào đang hoạt động
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedStatus !== "ALL" ||
    selectedTemplateId !== "ALL" ||
    selectedRepoId !== "ALL" ||
    selectedCollectionId !== null;

  // Đặt lại toàn bộ bộ lọc về mặc định
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedStatus("ALL");
    setSelectedTemplateId("ALL");
    setSelectedRepoId("ALL");
    setSelectedCollectionId(null);
  };

  // Lọc tài liệu theo Collection, Status, Template, Repo và Tìm kiếm toàn văn tức thì
  const filteredDocs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return documents
      .filter((doc) => {
        // 1. Lọc theo collection
      if (selectedCollectionId !== null) {
        if (doc.collectionId !== selectedCollectionId) return false;
      }

        // 2. Lọc theo trạng thái phê duyệt
      if (selectedStatus === "DRAFT" && doc.status !== "DRAFT") return false;
      if (
        selectedStatus === "REVIEW" &&
        doc.status !== "UNDER_REVIEW_STAFF" &&
        doc.status !== "UNDER_REVIEW_MANAGER"
      ) {
        return false;
      }
      if (selectedStatus === "APPROVED" && doc.status !== "APPROVED") return false;
      if (selectedStatus === "PUBLISHED" && doc.status !== "PUBLISHED") return false;
        if (selectedStatus === "REJECTED" && doc.status !== "REJECTED") return false;

        // 3. Lọc theo loại mẫu tài liệu (template)
        if (selectedTemplateId !== "ALL") {
          if (selectedTemplateId === "NONE") {
            if (doc.templateId !== null && doc.templateId !== undefined) return false;
          } else {
            const tmplIdNum = parseInt(selectedTemplateId, 10);
            if (doc.templateId !== tmplIdNum) return false;
          }
        }

        // 4. Lọc theo repo
      if (selectedRepoId !== "ALL" && doc.repoId !== parseInt(selectedRepoId, 10)) {
        return false;
      }

        // 5. Tìm kiếm toàn văn tức thì (Full-Text Search):
        // Khớp trong tiêu đề, file path, nội dung tóm tắt/markdown, nguồn hoặc tên repo
        if (q) {
          const titleMatch = doc.title ? doc.title.toLowerCase().includes(q) : false;
        const pathMatch = doc.targetPath ? doc.targetPath.toLowerCase().includes(q) : false;
          const contentMatch = doc.latestVersion?.content
            ? doc.latestVersion.content.toLowerCase().includes(q)
            : false;
          const sourceMatch = doc.sourceType ? doc.sourceType.toLowerCase().includes(q) : false;
          const repoName = repoMap.get(doc.repoId)?.toLowerCase() || "";
          const repoMatch = repoName.includes(q);

          if (!titleMatch && !pathMatch && !contentMatch && !sourceMatch && !repoMatch) {
            return false;
          }
      }

      return true;
      })
      .sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [
    documents,
    selectedCollectionId,
    selectedStatus,
    selectedTemplateId,
    selectedRepoId,
    searchQuery,
    repoMap,
  ]);

  // Xử lý tạo Bộ sưu tập mới
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) {
      notify("error", "Vui lòng nhập tên bộ sưu tập!");
      return;
    }

    setCreatingCol(true);
    try {
      const created = await documentService.createCollection({
        name: newColName.trim(),
        description: newColDesc.trim() || undefined,
      });
      setCollections((prev) => [...prev, created]);
      setSelectedCollectionId(created.id);
      setNewColName("");
      setNewColDesc("");
      setShowCreateCollectionModal(false);
      notify("success", `Đã tạo bộ sưu tập: ${created.name}`);
    } catch (err: any) {
      notify("error", "Tạo bộ sưu tập thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setCreatingCol(false);
    }
  };

  // Xử lý Upload tài liệu từ máy tính (.docx, .md)
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadRepoId) {
      notify("error", "Vui lòng chọn Repository liên kết");
      return;
    }
    if (!uploadFile) {
      notify("error", "Vui lòng chọn tệp tin từ máy tính");
      return;
    }
    if (!uploadTitle.trim()) {
      notify("error", "Vui lòng nhập tiêu đề tài liệu");
      return;
    }

    try {
      setUploading(true);
      const isDocx = uploadFile.name.toLowerCase().endsWith(".docx");
      if (isDocx) {
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("repoId", uploadRepoId);
        formData.append("title", uploadTitle.trim());
        if (uploadTargetPath.trim()) {
          formData.append("targetPath", uploadTargetPath.trim());
        }
        const created = await documentService.importDocx(formData);
        notify("success", `Nạp thành công file Word: "${created.title}"! Đang mở không gian làm việc...`);
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadTitle("");
        setUploadTargetPath("");
        router.push(`/tai-lieu-cua-toi/editor?docId=${created.docId}`);
        return;
      } else {
        const textContent = await uploadFile.text();
        const created = await documentService.importExternalDoc({
          repoId: Number(uploadRepoId),
          title: uploadTitle.trim(),
          targetPath: uploadTargetPath.trim() || `docs/${uploadFile.name}`,
          sourceType: "MARKDOWN",
          sourceUrlOrId: uploadFile.name,
          content: textContent,
        });
        notify("success", `Nạp thành công file Markdown: "${created.title}"! Đang mở không gian làm việc...`);
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadTitle("");
        setUploadTargetPath("");
        router.push(`/tai-lieu-cua-toi/editor?docId=${created.docId}`);
        return;
      }
    } catch (err: any) {
      notify("error", "Upload thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  // Xử lý nạp tài liệu từ MCP (Google Docs, Confluence, Jira)
  const handleMcpDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcpRepoId) {
      notify("error", "Vui lòng chọn Repository liên kết");
      return;
    }
    if (!mcpTitle.trim()) {
      notify("error", "Vui lòng nhập tiêu đề tài liệu");
      return;
    }
    if (!mcpUrlOrId.trim()) {
      notify("error", "Vui lòng nhập URL hoặc ID của nền tảng MCP");
      return;
    }

    try {
      setMcpConnecting(true);
      const created = await documentService.importExternalDoc({
        repoId: Number(mcpRepoId),
        title: mcpTitle.trim(),
        targetPath: mcpTargetPath.trim() || undefined,
        sourceType: mcpPlatform,
        sourceUrlOrId: mcpUrlOrId.trim(),
      });
      notify("success", `Kết nối MCP thành công: "${created.title}"! Đang mở không gian làm việc...`);

      setShowMcpModal(false);
      setMcpTitle("");
      setMcpTargetPath("");
      setMcpUrlOrId("");
      router.push(`/tai-lieu-cua-toi/editor?docId=${created.docId}`);
      return;
    } catch (err: any) {
      notify("error", "Kết nối MCP thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setMcpConnecting(false);
    }
  };

  // Xử lý Gửi review nhanh từ danh sách
  const handleQuickSubmitReview = async (doc: DocumentItem) => {
    try {
      const updated = await documentService.submitForReview(doc.docId);
      setDocuments((prev) => prev.map((d) => (d.docId === doc.docId ? updated : d)));
      notify("success", `Tài liệu "${doc.title}" đã được gửi để review (Chờ Staff duyệt)!`);
    } catch (err: any) {
      notify("error", "Gửi review thất bại: " + (err.response?.data?.message || err.message));
    }
  };

  // Xử lý Xóa tài liệu
  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    setDeletingDoc(true);
    try {
      await documentService.deleteDocument(docToDelete.docId);
      setDocuments((prev) => prev.filter((d) => d.docId !== docToDelete.docId));
      notify("success", `Đã xóa tài liệu: ${docToDelete.title}`);
      setDocToDelete(null);
    } catch (err: any) {
      notify("error", "Xóa tài liệu thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setDeletingDoc(false);
    }
  };

  // Xử lý Xóa bộ sưu tập
  const handleDeleteCollection = async () => {
    if (!collectionToDelete) return;
    setDeletingCol(true);
    try {
      await documentService.deleteCollection(collectionToDelete.id);
      setCollections((prev) => prev.filter((c) => c.id !== collectionToDelete.id));
      if (selectedCollectionId === collectionToDelete.id) {
        setSelectedCollectionId(null);
      }
      setDocuments((prev) =>
        prev.map((d) => (d.collectionId === collectionToDelete.id ? { ...d, collectionId: null } : d))
      );
      notify("success", `Đã xóa bộ sưu tập: ${collectionToDelete.name}`);
      setCollectionToDelete(null);
    } catch (err: any) {
      notify("error", "Xóa bộ sưu tập thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setDeletingCol(false);
    }
  };

  // Kiểm tra chuỗi băm Anti-Tamper
  const handleVerifyIntegrity = async (doc: DocumentItem) => {
    setVerifyingDocId(doc.docId);
    try {
      const result = await documentService.verifyIntegrity(doc.docId);
      setIntegrityDoc({ doc, result });
    } catch (err: any) {
      notify("error", "Không thể kiểm tra băm: " + (err.response?.data?.message || err.message));
    } finally {
      setVerifyingDocId(null);
    }
  };

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
          {toast.type === "error" && <AlertTriangle size={16} />}
          {toast.type === "info" && <Clock size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Tiêu đề Trang & Nút Làm mới duy nhất ở trên */}
      <div className="ld-page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 className="ld-page-title" style={{ margin: 0 }}>Cơ sở Tri thức &amp; Quản lý Tài liệu</h1>
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 12,
                background: "var(--color-accent-subtle)",
                color: "var(--color-accent-dark)",
                border: "1px solid #b8dec5",
              }}
            >
              Knowledge Base
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
            Tra cứu, tìm kiếm toàn văn tức thì theo tiêu đề, nội dung và đường dẫn file nguồn; kết hợp bộ lọc đa tiêu chí theo trạng thái phê duyệt và loại mẫu tài liệu.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="ld-btn ld-btn-secondary"
            title="Tải lại danh sách"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Thanh công cụ hành động phía dưới Document Workspace */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="ld-btn ld-btn-primary"
          style={{ background: "#0284c7", borderColor: "#0284c7" }}
          title="Upload tài liệu (.docx, .md) từ máy tính"
        >
          <Upload size={15} />
          <span>Upload tài liệu</span>
        </button>

        <button
          type="button"
          onClick={() => setShowMcpModal(true)}
          className="ld-btn"
          style={{
            borderColor: "#6366f1",
            color: "#4338ca",
            background: "#eef2ff",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
          title="Kết nối đọc tài liệu từ Google Docs, Confluence hoặc Jira qua MCP"
        >
          <Globe size={15} style={{ color: "#6366f1" }} />
          <span>Kết nối MCP</span>
        </button>

        <Link href="/tai-lieu-cua-toi/editor" className="ld-btn ld-btn-primary">
          <Plus size={15} />
          <span>Soạn thủ công</span>
        </Link>
      </div>

      {/* DANH SÁCH BỘ SƯU TẬP (COLLECTIONS BAR) */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Folder size={16} style={{ color: "var(--color-accent)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
              BỘ SƯU TẬP (DOC COLLECTIONS)
            </span>
            <span
              style={{
                fontSize: 11,
                background: "var(--color-muted)",
                color: "var(--color-text-secondary)",
                padding: "2px 8px",
                borderRadius: 12,
              }}
            >
              {collections.length} bộ sưu tập
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateCollectionModal(true)}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            style={{ color: "var(--color-accent)", fontWeight: 500 }}
          >
            <FolderPlus size={14} />
            <span>+ Tạo bộ sưu tập mới</span>
          </button>
        </div>

        {/* Thanh Cuộn Ngang Các Thẻ Bộ Sưu Tập */}
        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            paddingBottom: 6,
          }}
        >
          {/* Nút "Tất cả tài liệu" */}
          <div
            onClick={() => setSelectedCollectionId(null)}
            className="ld-card"
            style={{
              padding: "10px 14px",
              minWidth: 150,
              cursor: "pointer",
              border:
                selectedCollectionId === null
                  ? "2px solid var(--color-accent)"
                  : "1px solid var(--color-border)",
              background: selectedCollectionId === null ? "var(--color-accent-subtle)" : "#ffffff",
              transition: "all 150ms ease",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Layers
                size={14}
                style={{ color: selectedCollectionId === null ? "var(--color-accent)" : "#64748b" }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: selectedCollectionId === null ? 600 : 500,
                  color: selectedCollectionId === null ? "var(--color-accent-dark)" : "#0f172a",
                }}
              >
                Tất cả tài liệu
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>
              {documents.length} tài liệu trong hệ thống
            </p>
          </div>

          {/* Các Collection cụ thể */}
          {collections.map((col) => {
            const isSelected = selectedCollectionId === col.id;
            const count = documents.filter((d) => d.collectionId === col.id).length;
            return (
              <div
                key={col.id}
                onClick={() => setSelectedCollectionId(col.id)}
                className="ld-card"
                style={{
                  padding: "10px 14px",
                  minWidth: 200,
                  maxWidth: 280,
                  cursor: "pointer",
                  border: isSelected ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
                  background: isSelected ? "var(--color-accent-subtle)" : "#ffffff",
                  transition: "all 150ms ease",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <Folder
                      size={14}
                      style={{ color: isSelected ? "var(--color-accent)" : "#0284c7", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? "var(--color-accent-dark)" : "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={col.name}
                    >
                      {col.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollectionToDelete(col);
                    }}
                    title="Xóa bộ sưu tập"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: "2px 4px",
                      borderRadius: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      flexShrink: 0,
                      transition: "all 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#ef4444";
                      (e.currentTarget as HTMLElement).style.background = "#fee2e2";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    margin: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={col.description || ""}
                >
                  {count} tài liệu · {col.description || "Chưa có mô tả"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* BỘ LỌC VÀ THANH TÌM KIẾM TÀI LIỆU */}
      <div
        className="ld-card"
        style={{
          padding: "16px 20px",
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Hàng 1: Ô Tìm kiếm Toàn văn tức thì */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
          <Search
              size={16}
            style={{
              position: "absolute",
                left: 14,
              top: "50%",
              transform: "translateY(-50%)",
                color: searchQuery ? "var(--color-accent)" : "var(--color-text-disabled)",
                transition: "color 150ms ease",
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tức thì theo từ khóa trong tiêu đề, nội dung tóm tắt hoặc đường dẫn file nguồn..."
            className="ld-input"
              style={{
                width: "100%",
                paddingLeft: 38,
                paddingRight: searchQuery ? 38 : 14,
                fontSize: 13,
                height: 40,
                borderRadius: 8,
              }}
          />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                }}
                title="Xóa từ khóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
        </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="ld-btn ld-btn-ghost ld-btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: "#ef4444",
                whiteSpace: "nowrap",
                fontWeight: 500,
                padding: "8px 12px",
                height: 40,
                border: "1px solid #fecaca",
                borderRadius: 8,
                background: "#fef2f2",
              }}
              title="Đặt lại toàn bộ từ khóa và tiêu chí lọc"
            >
              <RotateCcw size={14} />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        {/* Hàng 2: Bộ lọc đa tiêu chí (Trạng thái, Loại mẫu tài liệu, Repository) */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Lọc Trạng thái phê duyệt (Pills / Tabs kèm số lượng thực tế) */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginRight: 2 }}>
              Trạng thái:
            </span>
            {STATUS_FILTERS.map((f) => {
              const isSelected = selectedStatus === f.key;
              const count = statusCounts[f.key as keyof typeof statusCounts] ?? 0;
              return (
            <button
              key={f.key}
              type="button"
              onClick={() => setSelectedStatus(f.key)}
              style={{
                    padding: "5px 10px",
                fontSize: 12,
                borderRadius: 6,
                    border: isSelected ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                    background: isSelected ? "var(--color-accent-subtle)" : "#ffffff",
                    color: isSelected ? "var(--color-accent-dark)" : "var(--color-text-secondary)",
                    fontWeight: isSelected ? 600 : 400,
                cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                transition: "all 120ms ease",
              }}
            >
                  <span>{f.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "1px 5px",
                      borderRadius: 10,
                      background: isSelected ? "var(--color-accent)" : "#f1f5f9",
                      color: isSelected ? "#ffffff" : "#64748b",
                    }}
                  >
                    {count}
                  </span>
            </button>
              );
            })}
          </div>

          {/* Cụm Dropdown: Loại mẫu tài liệu (Template) & Kho lưu trữ (Repo) */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Lọc Loại mẫu tài liệu */}
            <div style={{ minWidth: 210 }}>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="ld-select"
                style={{ padding: "6px 10px", fontSize: 12, width: "100%", height: 34 }}
                title="Lọc theo loại mẫu tài liệu"
              >
                <option value="ALL">Tất cả mẫu tài liệu (Templates)</option>
                <option value="NONE">Tự do (Không dùng template)</option>
                {templates.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    Mẫu: {t.name} ({t.type})
                  </option>
                ))}
              </select>
        </div>

        {/* Lọc Repo */}
            <div style={{ minWidth: 170 }}>
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="ld-select"
                style={{ padding: "6px 10px", fontSize: 12, width: "100%", height: 34 }}
                title="Lọc theo kho lưu trữ GitHub"
          >
            <option value="ALL">Tất cả Repository</option>
            {repos.map((r) => (
              <option key={r.repositoryId} value={r.repositoryId}>
                {r.repoFullName || r.repoName}
              </option>
            ))}
          </select>
            </div>
          </div>
        </div>

        {/* Hàng 3: Thống kê kết quả tìm kiếm thời gian thực */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 8,
            borderTop: "1px dashed var(--color-border)",
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          <div>
            <span>Tìm thấy </span>
            <strong style={{ color: "var(--color-accent-dark)" }}>{filteredDocs.length}</strong>
            <span> / {documents.length} tài liệu</span>
            {searchQuery.trim() && (
              <span style={{ marginLeft: 8, color: "var(--color-text-primary)" }}>
                khớp từ khóa <em>&ldquo;{searchQuery.trim()}&rdquo;</em>
              </span>
            )}
            {selectedTemplateId !== "ALL" && (
              <span style={{ marginLeft: 8, color: "#6d28d9" }}>
                · Mẫu: {selectedTemplateId === "NONE" ? "Tự do" : templateMap.get(parseInt(selectedTemplateId, 10))?.name || selectedTemplateId}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#059669",
                background: "#ecfdf5",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid #a7f3d0",
              }}
            >
              <Sparkles size={11} />
              <span>Tìm kiếm tức thì &lt; 1ms</span>
            </span>
          </div>
        </div>
      </div>

      {/* DANH SÁCH BẢNG TÀI LIỆU */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div className="ld-card" style={{ textAlign: "center", padding: "60px 0" }}>
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
            <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Đang tải danh sách tài liệu...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div
            className="ld-card"
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--color-text-secondary)",
            }}
          >
            <FileText size={48} style={{ color: "var(--color-text-disabled)", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>
              Không tìm thấy tài liệu phù hợp
            </h3>
            <p style={{ fontSize: 13, maxWidth: 420, margin: "0 auto 18px" }}>
              {selectedCollectionId !== null
                ? "Bộ sưu tập này hiện chưa có tài liệu nào. Bạn có thể bấm nút dưới để soạn tài liệu mới."
                : "Không có tài liệu nào khớp với điều kiện tìm kiếm và bộ lọc hiện tại."}
            </p>
            <Link
              href={
                selectedCollectionId !== null
                  ? `/tai-lieu-cua-toi/editor?collectionId=${selectedCollectionId}`
                  : "/tai-lieu-cua-toi/editor"
              }
              className="ld-btn ld-btn-primary"
            >
              <Plus size={15} />
              <span>Soạn tài liệu mới</span>
            </Link>
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const statusMeta = STATUS_CONFIG[doc.status] || STATUS_CONFIG.DRAFT;
            const repoName = repoMap.get(doc.repoId) || `Repo #${doc.repoId}`;
            const colName = doc.collectionId ? collectionMap.get(doc.collectionId) : null;

            return (
              <div
                key={doc.docId}
                className="ld-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "16px 20px",
                  transition: "border-color 150ms, box-shadow 150ms",
                }}
              >
                {/* Thông tin chính của Tài liệu */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <Link
                      href={`/tai-lieu-cua-toi/editor?docId=${doc.docId}`}
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        transition: "color 150ms",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-primary)")}
                    >
                      {highlightMatch(doc.title, searchQuery)}
                    </Link>

                    {/* Huy hiệu Trạng thái */}
                    <span
                      className="ld-badge"
                      style={{
                        background: statusMeta.bg,
                        color: statusMeta.color,
                        border: `1px solid ${statusMeta.border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {statusMeta.icon}
                      {statusMeta.label}
                    </span>

                    {/* Huy hiệu Loại mẫu tài liệu (Template) */}
                    {doc.templateId && templateMap.get(doc.templateId) && (
                      <span
                        className="ld-badge"
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          background: "#f5f3ff",
                          color: "#6d28d9",
                          border: "1px solid #ddd6fe",
                          padding: "2px 8px",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title={`Mẫu tài liệu: ${templateMap.get(doc.templateId)?.name}`}
                      >
                        <Layers size={11} />
                        <span>{templateMap.get(doc.templateId)?.name}</span>
                      </span>
                    )}

                    {/* Huy hiệu Phiên bản */}
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        background: "#f1f5f9",
                        color: "#334155",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      v{doc.currentVersion}
                    </span>

                    {/* Huy hiệu AI Agent tự động cập nhật */}
                    {(doc.latestVersion?.actorRole === "AI_AGENT" ||
                      doc.latestVersion?.actorRole === "AI" ||
                      doc.latestVersion?.triggerType === "AUTO_DRIFT_AI_REWRITE") && (
                      <span
                        className="ld-badge"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: "#f5f3ff",
                          color: "#7c3aed",
                          border: "1px solid #ddd6fe",
                          padding: "2px 8px",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        Agent tự cập nhật
                      </span>
                    )}

                    {/* Huy hiệu Nguồn tài liệu (Word, GDocs, Confluence, Jira) */}
                    {doc.sourceType && doc.sourceType !== "MANUAL" && (
                      <span
                        className="ld-badge"
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          background:
                            doc.sourceType === "DOCX" ? "#eff6ff" :
                            doc.sourceType === "GOOGLE_DOCS" ? "#ecfdf5" :
                            doc.sourceType === "CONFLUENCE" ? "#f0f9ff" :
                            doc.sourceType === "JIRA" ? "#fff7ed" : "#f8fafc",
                          color:
                            doc.sourceType === "DOCX" ? "#1e40af" :
                            doc.sourceType === "GOOGLE_DOCS" ? "#047857" :
                            doc.sourceType === "CONFLUENCE" ? "#0369a1" :
                            doc.sourceType === "JIRA" ? "#c2410c" : "#475569",
                          border:
                            doc.sourceType === "DOCX" ? "1px solid #bfdbfe" :
                            doc.sourceType === "GOOGLE_DOCS" ? "1px solid #a7f3d0" :
                            doc.sourceType === "CONFLUENCE" ? "1px solid #bae6fd" :
                            doc.sourceType === "JIRA" ? "1px solid #fed7aa" : "1px solid #e2e8f0",
                          padding: "2px 8px",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {doc.sourceType === "DOCX" && "Word (.docx)"}
                        {doc.sourceType === "GOOGLE_DOCS" && "Google Docs"}
                        {doc.sourceType === "CONFLUENCE" && "Confluence"}
                        {doc.sourceType === "JIRA" && "Jira"}
                        {doc.sourceType === "MARKDOWN" && "Markdown"}
                      </span>
                    )}

                    {/* Huy hiệu Collection */}
                    {colName && (
                      <span
                        style={{
                          fontSize: 11,
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          border: "1px solid #bfdbfe",
                          padding: "2px 8px",
                          borderRadius: 9999,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Folder size={11} />
                        {colName}
                      </span>
                    )}
                  </div>

                  {/* Chi tiết phụ: File path, Repo, Ngày tạo & cập nhật */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <GitBranch size={13} style={{ color: "#64748b" }} />
                      {repoName}
                    </span>

                    {doc.targetPath && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "#475569",
                          background: "#f8fafc",
                          padding: "1px 6px",
                          borderRadius: 4,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {highlightMatch(doc.targetPath, searchQuery)}
                      </span>
                    )}

                    <span style={{ color: "var(--color-text-disabled)" }}>
                      Cập nhật: {new Date(doc.updatedAt).toLocaleString("vi-VN")}
                    </span>

                    {/* Hash SHA-256 preview */}
                    {doc.latestVersion?.hash && (
                      <button
                        type="button"
                        onClick={() => handleVerifyIntegrity(doc)}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "#087f5b",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                        }}
                        title="Kiểm tra toàn vẹn chuỗi băm SHA-256"
                      >
                        <ShieldCheck size={13} />
                        <span>
                          {verifyingDocId === doc.docId
                            ? "Đang xác minh..."
                            : `Hash: ${doc.latestVersion.hash.substring(0, 8)}...`}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Trích đoạn nội dung khớp từ khóa tìm kiếm toàn văn */}
                  {searchQuery.trim() && (() => {
                    const snippet = getMatchingSnippet(doc.latestVersion?.content, searchQuery);
                    if (!snippet) return null;
                    return (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "6px 12px",
                          background: "#fefce8",
                          border: "1px solid #fef08a",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#854d0e",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Search size={12} style={{ color: "#ca8a04", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, flexShrink: 0 }}>Khớp nội dung:</span>
                        <span style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {highlightMatch(snippet, searchQuery)}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Các nút Hành động Nhanh */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {/* Nút Gửi review nhanh nếu đang DRAFT */}
                  {doc.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => handleQuickSubmitReview(doc)}
                      className="ld-btn ld-btn-ghost ld-btn-sm"
                      style={{ color: "#087f5b", fontWeight: 500 }}
                      title="Gửi tài liệu này để review ngay"
                    >
                      <Send size={13} />
                      <span>Gửi review</span>
                    </button>
                  )}

                  {/* Nút Xem Lịch sử & So sánh Diff */}
                  <Link
                    href={`/tai-lieu-cua-toi/lich-su?docId=${doc.docId}`}
                    className="ld-btn ld-btn-ghost ld-btn-sm"
                    style={{ color: "var(--color-accent)", fontWeight: 500 }}
                    title="Xem toàn bộ lịch sử các phiên bản và màn hình so sánh Diff song song"
                  >
                    <History size={13} />
                    <span>Lịch sử & Diff</span>
                  </Link>

                  {/* Nút Soạn thảo (Mở Split-View Editor) */}
                  <Link
                    href={`/tai-lieu-cua-toi/editor?docId=${doc.docId}`}
                    className="ld-btn ld-btn-secondary ld-btn-sm"
                    title="Mở trình soạn thảo Markdown Split-View"
                  >
                    <Edit3 size={13} />
                    <span>Soạn thảo</span>
                  </Link>

                  {/* Nút Xóa */}
                  <button
                    type="button"
                    onClick={() => setDocToDelete(doc)}
                    className="ld-btn ld-btn-ghost ld-btn-sm"
                    style={{ color: "#ef4444" }}
                    title="Xóa tài liệu"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: UPLOAD TÀI LIỆU (WORD .DOCX, MARKDOWN .MD) */}
      {showUploadModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(3px)",
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
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                borderBottom: "1px solid var(--color-border)",
                paddingBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: "#e0f2fe",
                    color: "#0284c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Upload size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                    Upload tài liệu
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                    Hỗ trợ file Microsoft Word (.docx) và Markdown (.md)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="ld-btn ld-btn-ghost ld-btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadDocument}>
              {/* Chọn Repository */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Repository liên kết <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  required
                  value={uploadRepoId}
                  onChange={(e) => setUploadRepoId(e.target.value)}
                  className="ld-select"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                >
                  <option value="">-- Chọn repository liên kết --</option>
                  {repos.map((r) => (
                    <option key={r.repositoryId} value={r.repositoryId}>
                      {r.repoFullName || r.repoName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Khu vực chọn file */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Chọn tệp tin (.docx, .md) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div
                  style={{
                    border: "2px dashed #93c5fd",
                    background: "#f0f9ff",
                    borderRadius: 8,
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => document.getElementById("file-upload-input")?.click()}
                >
                  <input
                    id="file-upload-input"
                    type="file"
                    accept=".docx,.md"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 100 * 1024 * 1024) {
                          notify("error", "Dung lượng tệp tin vượt quá giới hạn 100 MB!");
                          return;
                        }
                        setUploadFile(file);
                        const baseName = file.name.replace(/\.[^/.]+$/, "");
                        if (!uploadTitle) {
                          setUploadTitle(baseName);
                        }
                        if (!uploadTargetPath) {
                          setUploadTargetPath(`docs/${baseName}.md`);
                        }
                      }
                    }}
                  />
                  <FileUp size={32} style={{ color: "#0284c7", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", margin: 0 }}>
                    {uploadFile ? uploadFile.name : "Nhấn để chọn tệp .docx hoặc .md từ máy tính"}
                  </p>
                  <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {uploadFile
                      ? `Dung lượng: ${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB (Dung lượng tối đa: 100 MB)`
                      : "Hỗ trợ định dạng Microsoft Word (.docx) và Markdown (.md). Dung lượng tối đa: 100 MB."}
                  </p>
                </div>
              </div>

              {/* Tiêu đề */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Tiêu đề tài liệu <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ví dụ: Tài liệu Kiến trúc Hệ thống"
                  className="ld-input"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                />
              </div>

              {/* Đường dẫn đích */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Đường dẫn lưu file trong Repo (targetPath)
                </label>
                <input
                  type="text"
                  value={uploadTargetPath}
                  onChange={(e) => setUploadTargetPath(e.target.value)}
                  placeholder="Ví dụ: docs/architecture.md"
                  className="ld-input"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, fontFamily: "var(--font-mono)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="ld-btn ld-btn-secondary"
                  disabled={uploading}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="ld-btn ld-btn-primary"
                  style={{ background: "#0284c7", borderColor: "#0284c7" }}
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Đang tải lên...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Upload tài liệu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: KẾT NỐI MCP (GOOGLE DOCS, CONFLUENCE, JIRA) */}
      {showMcpModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(3px)",
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
              maxWidth: 620,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                borderBottom: "1px solid var(--color-border)",
                paddingBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: "#f5f3ff",
                    color: "#6366f1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Globe size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                    Kết nối MCP (Model Context Protocol)
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                    Đồng bộ tài liệu kỹ thuật từ Google Docs, Confluence hoặc Jira
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMcpModal(false)}
                className="ld-btn ld-btn-ghost ld-btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            {/* Platform selector */}
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: 4,
                background: "var(--color-muted)",
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              {[
                { key: "GOOGLE_DOCS", label: "Google Docs", icon: <Globe size={14} /> },
                { key: "CONFLUENCE", label: "Confluence", icon: <ExternalLink size={14} /> },
                { key: "JIRA", label: "Jira", icon: <CheckCircle2 size={14} /> },
              ].map((tab) => {
                const active = mcpPlatform === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setMcpPlatform(tab.key as any);
                      if (tab.key === "GOOGLE_DOCS") setMcpTitle("Google Docs Tài liệu");
                      else if (tab.key === "CONFLUENCE") setMcpTitle("Confluence Wiki");
                      else if (tab.key === "JIRA") setMcpTitle("Jira Đặc tả Yêu cầu");
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: active ? 600 : 500,
                      borderRadius: 6,
                      border: "none",
                      background: active ? "#ffffff" : "transparent",
                      color: active ? "#4f46e5" : "var(--color-text-secondary)",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleMcpDocument}>
              {/* Repository */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Repository liên kết <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  required
                  value={mcpRepoId}
                  onChange={(e) => setMcpRepoId(e.target.value)}
                  className="ld-select"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                >
                  <option value="">-- Chọn repository liên kết --</option>
                  {repos.map((r) => (
                    <option key={r.repositoryId} value={r.repositoryId}>
                      {r.repoFullName || r.repoName}
                    </option>
                  ))}
                </select>
              </div>

              {/* URL hoặc ID theo nền tảng */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {mcpPlatform === "GOOGLE_DOCS" && "Google Doc URL hoặc Document ID"}
                  {mcpPlatform === "CONFLUENCE" && "Confluence Page URL hoặc Page ID"}
                  {mcpPlatform === "JIRA" && "Mã Jira Issue Key / Epic Key"}
                  <span style={{ color: "#ef4444" }}> *</span>
                </label>
                <input
                  type="text"
                  required
                  value={mcpUrlOrId}
                  onChange={(e) => setMcpUrlOrId(e.target.value)}
                  placeholder={
                    mcpPlatform === "GOOGLE_DOCS"
                      ? "https://docs.google.com/document/d/.../edit hoặc Doc ID"
                      : mcpPlatform === "CONFLUENCE"
                      ? "https://your-domain.atlassian.net/wiki/spaces/.../pages/12345"
                      : "Ví dụ: PROJ-101, LD-W6-20"
                  }
                  className="ld-input"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                />
              </div>

              {/* Tiêu đề */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Tiêu đề tài liệu <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mcpTitle}
                  onChange={(e) => setMcpTitle(e.target.value)}
                  placeholder="Tiêu đề tài liệu sau khi đồng bộ"
                  className="ld-input"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                />
              </div>

              {/* Đường dẫn đích */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Đường dẫn lưu file trong Repo (targetPath)
                </label>
                <input
                  type="text"
                  value={mcpTargetPath}
                  onChange={(e) => setMcpTargetPath(e.target.value)}
                  placeholder={`docs/${mcpPlatform.toLowerCase()}-doc.md`}
                  className="ld-input"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, fontFamily: "var(--font-mono)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowMcpModal(false)}
                  className="ld-btn ld-btn-secondary"
                  disabled={mcpConnecting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={mcpConnecting}
                  className="ld-btn ld-btn-primary"
                  style={{ background: "#4f46e5", borderColor: "#4f46e5" }}
                >
                  {mcpConnecting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Đang kết nối MCP...</span>
                    </>
                  ) : (
                    <>
                      <Globe size={14} />
                      <span>Đồng bộ từ MCP</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TẠO BỘ SƯU TẬP MỚI */}
      {showCreateCollectionModal && (
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
              maxWidth: 450,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FolderPlus size={20} style={{ color: "var(--color-accent)" }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                  Tạo bộ sưu tập mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateCollectionModal(false)}
                className="ld-btn ld-btn-ghost ld-btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCollection}>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  Tên bộ sưu tập <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="Ví dụ: Tài liệu Hướng dẫn Triển khai"
                  className="ld-input"
                  required
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  Mô tả bộ sưu tập
                </label>
                <textarea
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  placeholder="Mô tả nội dung hoặc mục đích của bộ sưu tập tài liệu này..."
                  className="ld-input"
                  style={{ minHeight: 75, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateCollectionModal(false)}
                  className="ld-btn ld-btn-secondary"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={creatingCol}
                  className="ld-btn ld-btn-primary"
                >
                  <Plus size={14} />
                  <span>{creatingCol ? "Đang tạo..." : "Tạo bộ sưu tập"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA TÀI LIỆU */}
      {docToDelete && (
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
              maxWidth: 420,
              width: "100%",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: "#fef2f2",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={18} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                Xóa tài liệu này?
              </h3>
            </div>

            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
              Bạn có chắc chắn muốn xóa tài liệu <strong>&ldquo;{docToDelete.title}&rdquo;</strong>? Hành động này sẽ
              xóa toàn bộ lịch sử các phiên bản liên quan.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="ld-btn ld-btn-secondary"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={deletingDoc}
                className="ld-btn ld-btn-danger"
              >
                {deletingDoc ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA BỘ SƯU TẬP */}
      {collectionToDelete && (
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
          onClick={() => setCollectionToDelete(null)}
        >
          <div
            className="ld-card"
            style={{
              maxWidth: 440,
              width: "100%",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: "#fef2f2",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={18} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                Xóa bộ sưu tập này?
              </h3>
            </div>

            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
              Bạn có chắc chắn muốn xóa bộ sưu tập <strong>&ldquo;{collectionToDelete.name}&rdquo;</strong>?
              Các tài liệu bên trong sẽ <strong>không bị xóa</strong> mà chỉ được chuyển về danh sách &ldquo;Tất cả tài liệu&rdquo;.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setCollectionToDelete(null)}
                className="ld-btn ld-btn-secondary"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteCollection}
                disabled={deletingCol}
                className="ld-btn ld-btn-danger"
              >
                {deletingCol ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KẾT QUẢ XÁC MINH CHUỖI BĂM SHA-256 */}
      {integrityDoc && (
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
              maxWidth: 500,
              width: "100%",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: integrityDoc.result.valid ? "#ecfdf5" : "#fef2f2",
                  color: integrityDoc.result.valid ? "#059669" : "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                  Xác minh toàn vẹn chuỗi băm SHA-256
                </h3>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                  {integrityDoc.doc.title}
                </p>
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                padding: "12px 16px",
                borderRadius: 6,
                background: integrityDoc.result.valid ? "#f0fdf4" : "#fef2f2",
                border: integrityDoc.result.valid ? "1px solid #bbf7d0" : "1px solid #fecaca",
                color: integrityDoc.result.valid ? "#166534" : "#991b1b",
                marginBottom: 16,
              }}
            >
              <p style={{ fontWeight: 600, margin: "0 0 4px 0" }}>
                {integrityDoc.result.valid
                  ? "✓ Toàn bộ chuỗi băm hoàn toàn hợp lệ"
                  : "✗ Phát hiện bất thường trong chuỗi băm"}
              </p>
              <p style={{ margin: 0 }}>{integrityDoc.result.message}</p>
              <p style={{ fontSize: 12, marginTop: 6, color: "var(--color-text-secondary)" }}>
                Tổng số phiên bản đã kiểm tra: {integrityDoc.result.totalVersions}
              </p>
            </div>

            {integrityDoc.result.issues && integrityDoc.result.issues.length > 0 && (
              <div
                style={{
                  maxHeight: 120,
                  overflowY: "auto",
                  background: "#fff1f2",
                  padding: 10,
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#9f1239",
                  marginBottom: 16,
                }}
              >
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {integrityDoc.result.issues.map((iss: string, idx: number) => (
                    <li key={idx}>{iss}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setIntegrityDoc(null)}
                className="ld-btn ld-btn-primary"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}

export default function DocumentListPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ padding: 40, textAlign: "center" }}>Đang tải danh sách tài liệu...</div>
        </AppShell>
      }
    >
      <DocumentListPageContent />
    </Suspense>
  );
}
