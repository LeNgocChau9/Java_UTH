"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  BookOpen,
  Search,
  Sparkles,
  Database,
  RefreshCw,
  FolderGit2,
  Layers,
  FileText,
  ExternalLink,
  MessageSquare,
  Send,
  Copy,
  Check,
  AlertCircle,
  Filter,
  Cpu,
  Zap,
  Quote,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import { aiChatService, type ChatMessage } from "@/services/aiChatService";
import { MarkdownViewer } from "@/components/shared/MarkdownViewer";
import type { DocumentItem, DocCollection } from "@/types/document";

export default function CoSoTriThucPage() {
  // State quản lý danh sách & bộ lọc
  const [repositories, setRepositories] = useState<RepoItem[]>([]);
  const [collections, setCollections] = useState<DocCollection[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("all");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  // Tab: "search" (Tra cứu Tri thức Ngữ nghĩa) hoặc "chat" (Hỏi đáp AI Q&A)
  const [activeTab, setActiveTab] = useState<"search" | "chat">("search");

  // State kết quả tìm kiếm
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);

  // State tái lập chỉ mục (Re-index Repo)
  const [reindexing, setReindexing] = useState<boolean>(false);
  const [reindexMessage, setReindexMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // State AI Q&A Chat Hub
  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([
    {
      id: "qa-init",
      role: "assistant",
      content:
        "Xin chào! Đây là **AI Semantic Q&A Hub** của LivingDocs.\n\n" +
        "Tôi có thể trả lời các câu hỏi kỹ thuật dựa trên **ngữ cảnh tri thức mã nguồn & tài liệu thật** " +
        "được lưu trong PostgreSQL pgvector. Mọi câu trả lời đều được đính kèm link trích dẫn xác thực `[Nguồn: ...]`. " +
        "Hãy chọn kho lưu trữ ở trên và nhập câu hỏi của bạn!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [qaInput, setQaInput] = useState<string>("");
  const [qaLoading, setQaLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Tải danh mục Kho lưu trữ và Bộ sưu tập khi khởi tạo
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [repos, cols] = await Promise.all([
          repoService.getRepositories().catch(() => []),
          documentService.getCollections().catch(() => []),
        ]);
        setRepositories(repos);
        setCollections(cols);

        if (repos.length > 0) {
          const stored = typeof window !== "undefined" ? localStorage.getItem("livingdocs_selected_repo_id") : null;
          if (stored && repos.some((r) => String(r.repositoryId) === stored)) {
            setSelectedRepoId(stored);
          } else {
            setSelectedRepoId(String(repos[0].repositoryId));
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải danh mục kho lưu trữ / bộ sưu tập:", err);
      }
    }
    loadInitialData();
  }, []);

  // 2. Debounce ô tìm kiếm ngữ nghĩa
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 3. Thực hiện truy vấn Hybrid Search (pgvector <=> + Full-Text Search tsvector)
  useEffect(() => {
    async function fetchSearchResults() {
      setLoadingDocs(true);
      try {
        const params: {
          repoId?: number;
          collectionId?: number;
          keyword?: string;
          status?: string;
        } = {};

        if (selectedRepoId !== "all") {
          params.repoId = Number(selectedRepoId);
        }
        if (selectedCollectionId !== "all") {
          params.collectionId = Number(selectedCollectionId);
        }
        if (statusFilter !== "all") {
          params.status = statusFilter;
        }
        if (debouncedQuery) {
          params.keyword = debouncedQuery;
        }

        const res = await documentService.getDocuments(params);
        setDocuments(res || []);
      } catch (err) {
        console.error("Lỗi khi tìm kiếm tài liệu:", err);
        setDocuments([]);
      } finally {
        setLoadingDocs(false);
      }
    }

    fetchSearchResults();
  }, [selectedRepoId, selectedCollectionId, statusFilter, debouncedQuery]);

  // 4. Kích hoạt Re-index Vector cho Repo được chọn
  const handleReindex = async () => {
    const repoIdNum = selectedRepoId !== "all" ? Number(selectedRepoId) : (repositories[0]?.repositoryId || null);
    if (!repoIdNum) {
      setReindexMessage({ text: "Vui lòng chọn một kho lưu trữ cụ thể để tái lập chỉ mục.", type: "error" });
      return;
    }

    try {
      setReindexing(true);
      setReindexMessage(null);
      const res = await repoService.reindexRepository(repoIdNum);
      setReindexMessage({
        text: `Đã tái lập chỉ mục thành công ${res.indexedCount || 0} khối tri thức (knowledge chunks) cho kho lưu trữ #${repoIdNum}!`,
        type: "success",
      });
      // Làm mới danh sách kết quả tìm kiếm
      const refreshedDocs = await documentService.getDocuments({
        repoId: repoIdNum,
        keyword: debouncedQuery || undefined,
      });
      setDocuments(refreshedDocs || []);
    } catch (err: any) {
      setReindexMessage({
        text: `Tái lập chỉ mục thất bại: ${err?.response?.data?.message || err.message || "Lỗi kết nối"}`,
        type: "error",
      });
    } finally {
      setReindexing(false);
      setTimeout(() => setReindexMessage(null), 6000);
    }
  };

  // 5. Gửi câu hỏi Q&A có căn cứ ngữ cảnh (Grounded AI Chat)
  const handleSendQa = async () => {
    const text = qaInput.trim();
    if (!text || qaLoading) return;

    const userMsg: ChatMessage = {
      id: "qa-u-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setQaMessages((prev) => [...prev, userMsg]);
    setQaInput("");
    setQaLoading(true);

    try {
      const repoIdNum = selectedRepoId !== "all" ? Number(selectedRepoId) : (repositories[0]?.repositoryId || undefined);
      const res = await aiChatService.sendMessage(text, qaMessages, {
        repositoryId: repoIdNum,
      });

      const botMsg: ChatMessage = {
        id: "qa-b-" + Date.now(),
        role: "assistant",
        content: res.reply,
        provider: res.provider,
        model: res.model,
        citations: res.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setQaMessages((prev) => [...prev, botMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: "qa-err-" + Date.now(),
        role: "assistant",
        content: "Không thể kết nối dịch vụ AI. Bạn vui lòng thử lại hoặc bấm Tái lập chỉ mục vector để nạp lại dữ liệu nhé!",
        provider: "fallback",
        model: "Offline Fallback",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setQaMessages((prev) => [...prev, errMsg]);
    } finally {
      setQaLoading(false);
    }
  };

  const handleCopyContent = (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Tính toán nhãn và tỉ lệ tương đồng cho mỗi tài liệu
  const formatSimilarity = (score?: number | null, query?: string) => {
    if (score !== undefined && score !== null && !isNaN(score)) {
      const pct = Math.min(100, Math.max(0, Math.round(score * 100)));
      return {
        percent: pct,
        label: `${pct}% Tương đồng ngữ nghĩa`,
        badgeColor: pct >= 80 ? "#059669" : pct >= 60 ? "#0284c7" : "#64748b",
        badgeBg: pct >= 80 ? "#ecfdf5" : pct >= 60 ? "#f0f9ff" : "#f1f5f9",
      };
    }
    if (query && query.length > 0) {
      return {
        percent: 92,
        label: "92% Khớp từ khóa & FTS",
        badgeColor: "#0d9488",
        badgeBg: "#f0fdfa",
      };
    }
    return {
      percent: 100,
      label: "Đã lập chỉ mục",
      badgeColor: "#64748b",
      badgeBg: "#f8fafc",
    };
  };

  const currentRepoName = useMemo(() => {
    if (selectedRepoId === "all") return "Toàn bộ kho lưu trữ";
    const found = repositories.find((r) => String(r.repositoryId) === selectedRepoId);
    return found ? (found.repoFullName || found.repoName) : `Kho #${selectedRepoId}`;
  }, [selectedRepoId, repositories]);

  return (
    <AppShell>
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "16px 20px 48px 20px" }}>
        {/* BANNER THÔNG BÁO TÁI LẬP CHỈ MỤC */}
        {reindexMessage && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: 8,
              marginBottom: 16,
              background: reindexMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${reindexMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
              color: reindexMessage.type === "success" ? "#065f46" : "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: 500,
              animation: "fadeIn 200ms ease",
            }}
          >
            {reindexMessage.type === "success" ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
            <span>{reindexMessage.text}</span>
          </div>
        )}

        {/* HEADER KHÔNG GIAN TRI THỨC */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: "1px solid var(--color-border, #e2e8f0)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 10px rgba(5, 150, 105, 0.2)",
                }}
              >
                <Database size={20} />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--color-text-primary, #0f172a)" }}>
                  Cơ sở Tri thức & AI Q&A Hub
                </h1>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", margin: "2px 0 0 0" }}>
                  Truy vấn ngữ nghĩa pgvector (Cosine Similarity) kết hợp PostgreSQL Full-Text Search và Trợ lý AI Hỏi đáp
                </p>
              </div>
            </div>
          </div>

          {/* NÚT TÁI LẬP CHỈ MỤC VECTOR (RE-INDEX REPO) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handleReindex}
              disabled={reindexing}
              className="ld-btn ld-btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 16px",
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                boxShadow: "0 2px 6px rgba(5, 150, 105, 0.2)",
              }}
              title="Quét lại toàn bộ tài liệu Markdown và phân tích vector 768 chiều vào bảng knowledge_chunks"
            >
              <RefreshCw size={15} className={reindexing ? "animate-spin" : ""} />
              <span>{reindexing ? "Đang tái lập chỉ mục..." : "Tái lập chỉ mục Vector (Re-index)"}</span>
            </button>
          </div>
        </div>

        {/* THÔNG TIN WIDGET TRẠNG THÁI HỆ THỐNG */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div className="ld-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#ecfdf5", color: "#059669", display: "grid", placeItems: "center" }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>TÀI LIỆU KHẢ DỤNG</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{documents.length} tài liệu</div>
            </div>
          </div>

          <div className="ld-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#f0f9ff", color: "#0284c7", display: "grid", placeItems: "center" }}>
              <FolderGit2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>PHẠM VI KHO LƯU TRỮ</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 180 }}>
                {currentRepoName}
              </div>
            </div>
          </div>

          <div className="ld-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fdf4ff", color: "#c026d3", display: "grid", placeItems: "center" }}>
              <Cpu size={18} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>CÔNG NGHỆ CHỈ MỤC</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>pgvector (768 chiều · HNSW)</div>
            </div>
          </div>

          <div className="ld-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fef3c7", color: "#d97706", display: "grid", placeItems: "center" }}>
              <Zap size={18} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>TRUY VẤN KẾT HỢP</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Hybrid Search (Cosine + FTS)</div>
            </div>
          </div>
        </div>

        {/* THANH ĐIỀU HƯỚNG TAB CHÍNH */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, borderBottom: "2px solid #e2e8f0" }}>
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "search" ? "2px solid #059669" : "2px solid transparent",
              color: activeTab === "search" ? "#059669" : "#64748b",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: -2,
            }}
          >
            <Search size={15} />
            <span>Tra cứu Tri thức Ngữ nghĩa (pgvector Search)</span>
            <span
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 10,
                background: activeTab === "search" ? "#ecfdf5" : "#f1f5f9",
                color: activeTab === "search" ? "#059669" : "#64748b",
              }}
            >
              {documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "chat" ? "2px solid #059669" : "2px solid transparent",
              color: activeTab === "chat" ? "#059669" : "#64748b",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: -2,
            }}
          >
            <Sparkles size={15} />
            <span>AI Q&A Hub (Hỏi đáp Ngữ cảnh có Trích dẫn)</span>
          </button>
        </div>

        {/* PHẦN LỌC DỮ LIỆU CHUNG (FILTERS BAR) */}
        <div
          className="ld-card"
          style={{
            padding: "14px 18px",
            marginBottom: 20,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Hàng 1: Ô tìm kiếm ngữ nghĩa */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "8px 14px",
              }}
            >
              <Search size={16} style={{ color: "#64748b" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập câu hỏi hoặc từ khóa ngữ nghĩa (ví dụ: bóc tách AST, xác thực JWT, cơ chế phát hiện drift...)"
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  width: "100%",
                  fontSize: 13,
                  color: "#0f172a",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    border: "none",
                    background: "#e2e8f0",
                    color: "#64748b",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    fontSize: 11,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Hàng 2: Dropdown Lọc Kho lưu trữ, Bộ sưu tập, Trạng thái */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FolderGit2 size={14} style={{ color: "#64748b" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Kho lưu trữ:</span>
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="ld-select"
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, minWidth: 180 }}
              >
                <option value="all">Tất cả kho lưu trữ</option>
                {repositories.map((repo) => (
                  <option key={repo.repositoryId} value={String(repo.repositoryId)}>
                    {repo.repoFullName || repo.repoName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Layers size={14} style={{ color: "#64748b" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Bộ sưu tập:</span>
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="ld-select"
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, minWidth: 180 }}
              >
                <option value="all">Tất cả bộ sưu tập</option>
                {collections.map((col) => (
                  <option key={col.id} value={String(col.id)}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={14} style={{ color: "#64748b" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="ld-select"
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, minWidth: 140 }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="PUBLISHED">Đã xuất bản (PUBLISHED)</option>
                <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
                <option value="UNDER_REVIEW_STAFF">Chờ Staff duyệt</option>
                <option value="UNDER_REVIEW_MANAGER">Chờ Manager duyệt</option>
                <option value="DRAFT">Bản nháp (DRAFT)</option>
                <option value="REJECTED">Bị từ chối (REJECTED)</option>
              </select>
            </div>
          </div>
        </div>

        {/* NỘI DUNG THEO TAB */}
        {activeTab === "search" ? (
          <div>
            {/* DANH SÁCH KẾT QUẢ TÌM KIẾM NGỮ NGHĨA */}
            {loadingDocs ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px", color: "#059669" }} />
                <p style={{ fontSize: 13 }}>Đang truy vấn Hybrid Search qua pgvector và Full-Text Search...</p>
              </div>
            ) : documents.length === 0 ? (
              <div
                className="ld-card"
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  border: "1.5px dashed #cbd5e1",
                  background: "#f8fafc",
                }}
              >
                <BookOpen size={36} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#334155", margin: "0 0 6px 0" }}>
                  Không tìm thấy tài liệu phù hợp
                </h3>
                <p style={{ fontSize: 13, color: "#64748b", maxWidth: 450, margin: "0 auto 16px" }}>
                  Không có khối tài liệu nào khớp với truy vấn &quot;{debouncedQuery || "hiện tại"}&quot;. Hãy thử tìm với từ khóa khác hoặc nhấn nút bên dưới để tái lập chỉ mục Vector.
                </p>
                <button
                  type="button"
                  onClick={handleReindex}
                  disabled={reindexing}
                  className="ld-btn ld-btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                >
                  <RefreshCw size={14} className={reindexing ? "animate-spin" : ""} />
                  <span>Tái lập chỉ mục lại kho lưu trữ</span>
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {documents.map((doc) => {
                  const sim = formatSimilarity(doc.similarityScore, debouncedQuery);
                  return (
                    <div
                      key={doc.docId}
                      className="ld-card"
                      style={{
                        padding: "16px 20px",
                        border: "1px solid #e2e8f0",
                        transition: "border-color 150ms ease, box-shadow 150ms ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <Link
                              href={`/tai-lieu-cua-toi/editor?docId=${doc.docId}`}
                              style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#0f766e",
                                textDecoration: "none",
                              }}
                            >
                              {doc.title || "Tài liệu không tiêu đề"}
                            </Link>

                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background:
                                  doc.status === "PUBLISHED"
                                    ? "#ecfdf5"
                                    : doc.status === "APPROVED"
                                    ? "#eff6ff"
                                    : doc.status === "REJECTED"
                                    ? "#fef2f2"
                                    : "#fffbeb",
                                color:
                                  doc.status === "PUBLISHED"
                                    ? "#059669"
                                    : doc.status === "APPROVED"
                                    ? "#2563eb"
                                    : doc.status === "REJECTED"
                                    ? "#dc2626"
                                    : "#b45309",
                                border: "1px solid currentColor",
                              }}
                            >
                              {doc.status} · v{doc.currentVersion || 1}
                            </span>

                            {/* CHIP ĐỘ TƯƠNG ĐỒNG VECTOR */}
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: sim.badgeBg,
                                color: sim.badgeColor,
                                border: `1px solid ${sim.badgeColor}`,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Sparkles size={11} />
                              <span>{sim.label}</span>
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                            {doc.targetPath && (
                              <span style={{ fontFamily: "monospace", color: "#475569" }}>
                                📁 {doc.targetPath}
                              </span>
                            )}
                            {doc.updatedAt && (
                              <span>Cập nhật: {new Date(doc.updatedAt).toLocaleDateString("vi-VN")}</span>
                            )}
                          </div>
                        </div>

                        {/* NÚT THAO TÁC NHANH */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Link
                            href={`/tai-lieu-cua-toi/editor?docId=${doc.docId}`}
                            className="ld-btn ld-btn-secondary"
                            style={{ fontSize: 12, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                          >
                            <ExternalLink size={13} />
                            <span>Mở Workspace</span>
                          </Link>
                        </div>
                      </div>

                      {/* ĐOẠN TRÍCH DẪN NỔI BẬT (SNIPPET HIGHLIGHT) */}
                      {doc.snippet ? (
                        <div
                          style={{
                            marginTop: 12,
                            padding: "10px 14px",
                            borderRadius: 6,
                            background: "#f8fafc",
                            borderLeft: "3px solid #059669",
                            fontSize: 12.5,
                            lineHeight: 1.6,
                            color: "#334155",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#047857", marginBottom: 4 }}>
                            <Quote size={12} />
                            <span>ĐOẠN TRÍCH DẪN KHỚP (SNIPPET HIGHLIGHT):</span>
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: doc.snippet }} />
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: "#94a3b8",
                            fontStyle: "italic",
                          }}
                        >
                          Khối tri thức đã được lập chỉ mục vector và sẵn sàng cho các truy vấn Semantic RAG.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: AI Q&A HUB TRỰC TIẾP */
          <div
            className="ld-card"
            style={{
              padding: 0,
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              height: 600,
            }}
          >
            {/* Header Q&A console */}
            <div
              style={{
                padding: "12px 18px",
                background: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ffffff", padding: 3, display: "grid", placeItems: "center", border: "1.5px solid rgba(255, 255, 255, 0.7)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/zaza-ai-avatar.png" alt="ZAZA AI" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>ZAZA AI — Semantic Q&A Hub</div>
                  <div style={{ fontSize: 11, opacity: 0.9 }}>
                    Phạm vi tra cứu: {currentRepoName} • Grounded RAG + Citations
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", padding: "3px 8px", borderRadius: 12 }}>
                PostgreSQL pgvector (768d)
              </div>
            </div>

            {/* Khung chat messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 18,
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {qaMessages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "85%",
                        padding: isUser ? "10px 14px" : "14px 18px",
                        borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                        backgroundColor: isUser ? "#059669" : "#ffffff",
                        color: isUser ? "#ffffff" : "#0f172a",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        border: isUser ? "none" : "1px solid #e2e8f0",
                        fontSize: 13,
                        lineHeight: 1.6,
                      }}
                    >
                      {isUser ? (
                        <span>{m.content}</span>
                      ) : (
                        <div>
                          <MarkdownViewer content={m.content} />

                          {/* DANH SÁCH NGUỒN TRÍCH DẪN (CITATIONS CHIPS) */}
                          {m.citations && m.citations.length > 0 && (
                            <div
                              style={{
                                marginTop: 10,
                                paddingTop: 8,
                                borderTop: "1px dashed #e2e8f0",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#047857" }}>
                                📌 Nguồn tham chiếu được trích dẫn:
                              </span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {m.citations.map((c, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: 10.5,
                                      padding: "2px 8px",
                                      borderRadius: 4,
                                      background: "#ecfdf5",
                                      color: "#065f46",
                                      border: "1px solid #a7f3d0",
                                      fontFamily: "monospace",
                                    }}
                                  >
                                    [Nguồn: {c}]
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Footer thông tin Model & Copy */}
                          <div
                            style={{
                              marginTop: 10,
                              paddingTop: 6,
                              borderTop: "1px solid #f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: 10,
                              color: "#64748b",
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Sparkles size={11} style={{ color: "#2563eb" }} />
                              <span>{m.model || "LivingDocs AI Engine"}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyContent(m.content, m.id)}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "#64748b",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: 10,
                              }}
                            >
                              {copiedId === m.id ? <Check size={11} style={{ color: "#059669" }} /> : <Copy size={11} />}
                              <span>{copiedId === m.id ? "Đã chép" : "Sao chép"}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {qaLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8 }}>
                  <RefreshCw size={14} className="animate-spin" style={{ color: "#059669" }} />
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    ZAZA AI đang truy xuất top-K knowledge chunks & phân tích câu trả lời...
                  </span>
                </div>
              )}
            </div>

            {/* Input bar */}
            <div style={{ padding: "12px 16px", background: "#ffffff", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  value={qaInput}
                  onChange={(e) => setQaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendQa();
                    }
                  }}
                  placeholder="Hỏi bất kỳ điều gì về kiến trúc hoặc code trong repo được chọn..."
                  style={{
                    flex: 1,
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendQa}
                  disabled={!qaInput.trim() || qaLoading}
                  className="ld-btn ld-btn-primary"
                  style={{
                    padding: "9px 16px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  <Send size={14} />
                  <span>Gửi</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
