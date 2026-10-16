"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
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
  { key: "DRAFT", label: "Bản nháp" },
  { key: "REVIEW", label: "Đang chờ duyệt" },
  { key: "APPROVED", label: "Đã phê duyệt" },
  { key: "PUBLISHED", label: "Đã xuất bản" },
];

function DocumentListPageContent() {
  const searchParams = useSearchParams();
  const initialCollectionId = searchParams.get("collectionId");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [collections, setCollections] = useState<DocCollection[]>([]);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(
    initialCollectionId ? parseInt(initialCollectionId, 10) : null
  );

  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
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

  // Modal xác nhận xóa
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  // Modal kiểm tra tính toàn vẹn Hash Chain
  const [integrityDoc, setIntegrityDoc] = useState<{
    doc: DocumentItem;
    result: IntegrityCheckResult;
  } | null>(null);
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);

  // Hiển thị thông báo
  const notify = useCallback((type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Nạp dữ liệu từ backend
  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [docs, cols, rps] = await Promise.all([
        documentService.getDocuments(),
        documentService.getCollections(),
        repoService.getRepositories().catch(() => []),
      ]);
      setDocuments(docs);
      setCollections(cols);
      setRepos(rps);
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

  // Lọc tài liệu theo Collection, Status, Search, Repo
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Lọc theo collection
      if (selectedCollectionId !== null) {
        if (doc.collectionId !== selectedCollectionId) return false;
      }

      // Lọc theo trạng thái
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

      // Lọc theo repo
      if (selectedRepoId !== "ALL" && doc.repoId !== parseInt(selectedRepoId, 10)) {
        return false;
      }

      // Lọc theo từ khóa tìm kiếm (tiêu đề, targetPath)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = doc.title.toLowerCase().includes(q);
        const pathMatch = doc.targetPath ? doc.targetPath.toLowerCase().includes(q) : false;
        if (!titleMatch && !pathMatch) return false;
      }

      return true;
    });
  }, [documents, selectedCollectionId, selectedStatus, selectedRepoId, searchQuery]);

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

      {/* Tiêu đề Trang & Nút CTA Soạn tài liệu mới */}
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Danh sách tài liệu & Bộ sưu tập</h1>
          <p className="ld-page-subtitle">
            Quản lý tài liệu theo từng Collection, hỗ trợ soạn thảo Markdown Split-View và chuỗi băm phiên bản
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
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
          <Link href="/tai-lieu-cua-toi/editor" className="ld-btn ld-btn-primary">
            <Plus size={15} />
            <span>Soạn tài liệu mới</span>
          </Link>
        </div>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Folder
                    size={14}
                    style={{ color: isSelected ? "var(--color-accent)" : "#0284c7" }}
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
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          marginBottom: 16,
        }}
      >
        {/* Tìm kiếm */}
        <div style={{ position: "relative", minWidth: 260, flex: 1 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-disabled)",
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc file path (ví dụ: docs/arch.md)..."
            className="ld-input"
            style={{ paddingLeft: 34, fontSize: 13 }}
          />
        </div>

        {/* Lọc Trạng thái (Tabs) */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setSelectedStatus(f.key)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                borderRadius: 6,
                border: selectedStatus === f.key ? "1px solid var(--color-accent)" : "1px solid transparent",
                background: selectedStatus === f.key ? "var(--color-accent-subtle)" : "transparent",
                color: selectedStatus === f.key ? "var(--color-accent-dark)" : "var(--color-text-secondary)",
                fontWeight: selectedStatus === f.key ? 600 : 400,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lọc Repo */}
        <div style={{ minWidth: 180 }}>
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="ld-select"
            style={{ padding: "6px 10px", fontSize: 13, width: "100%" }}
          >
            <option value="ALL">Tất cả Repository</option>
            {repos.map((r) => (
              <option key={r.repositoryId} value={r.repositoryId}>
                📦 {r.repoFullName || r.repoName}
              </option>
            ))}
          </select>
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
                      {doc.title}
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
                        {doc.targetPath}
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
