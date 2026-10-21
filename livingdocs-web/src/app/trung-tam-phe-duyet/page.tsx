"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/AppShell";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import type {
  DocumentItem,
  DocumentDetail,
  DocumentAuditLogItem,
} from "@/types/document";
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  GitBranch,
  Clock,
  MessageSquare,
  Search,
  RefreshCw,
  AlertCircle,
  History,
  Check,
  ExternalLink,
  UserCheck,
  Info,
} from "lucide-react";

export default function TrungTamPheDuyetManagerPage() {
  // Danh sách tài liệu UNDER_REVIEW_MANAGER
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [repositories, setRepositories] = useState<Record<number, RepoItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  // Tài liệu đang được chọn để xem chi tiết và duyệt
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDocDetail, setSelectedDocDetail] = useState<DocumentDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<DocumentAuditLogItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Ghi chú của Manager
  const [managerComment, setManagerComment] = useState<string>("");

  // Thao tác phê duyệt / trả lại / từ chối
  const [processingAction, setProcessingAction] = useState<
    "PUBLISH" | "RETURN_STAFF" | "REJECT" | null
  >(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Tab xem trước (Nội dung tài liệu vs Audit Trail)
  const [activeTab, setActiveTab] = useState<"content" | "audit">("content");

  // 1. Tải danh sách tài liệu UNDER_REVIEW_MANAGER từ API thật
  const fetchManagerQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allDocs, allRepos] = await Promise.all([
        documentService.getDocuments(),
        repoService.getRepositories().catch(() => [] as RepoItem[]),
      ]);

      // Lọc các tài liệu đang ở trạng thái UNDER_REVIEW_MANAGER
      const managerQueue = allDocs.filter(
        (d) => d.status === "UNDER_REVIEW_MANAGER"
      );
      setDocuments(managerQueue);

      const repoMap: Record<number, RepoItem> = {};
      allRepos.forEach((r) => {
        repoMap[r.repositoryId] = r;
      });
      setRepositories(repoMap);

      // Nếu tài liệu đang chọn đã bị xóa hoặc đã chuyển trạng thái, tự động chọn tài liệu đầu tiên
      if (
        selectedDocId &&
        !managerQueue.some((d) => d.docId === selectedDocId)
      ) {
        if (managerQueue.length > 0) {
          handleSelectDoc(managerQueue[0].docId);
        } else {
          setSelectedDocId(null);
          setSelectedDocDetail(null);
          setAuditLogs([]);
        }
      } else if (!selectedDocId && managerQueue.length > 0) {
        handleSelectDoc(managerQueue[0].docId);
      }
    } catch (err) {
      console.error("Lỗi khi tải hàng đợi Manager:", err);
      setError(
        "Không thể kết nối máy chủ để tải danh sách tài liệu chờ Manager phê duyệt."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDocId]);

  useEffect(() => {
    fetchManagerQueue();
  }, [fetchManagerQueue]);

  // 2. Tải chi tiết tài liệu và lịch sử Audit Trail khi chọn tài liệu
  const handleSelectDoc = async (docId: number) => {
    setSelectedDocId(docId);
    setLoadingDetail(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    setManagerComment("");
    try {
      const [detail, logs] = await Promise.all([
        documentService.getDocumentById(docId),
        documentService.getDocumentAuditTrail(docId).catch(() => [] as DocumentAuditLogItem[]),
      ]);
      setSelectedDocDetail(detail);
      setAuditLogs(logs);
    } catch (err) {
      console.error("Lỗi khi tải chi tiết tài liệu:", err);
      setActionErrorMsg("Không thể tải chi tiết tài liệu và nhật ký Audit trail.");
    } finally {
      setLoadingDetail(false);
    }
  };

  // 3. Xử lý quyết định của Manager: PUBLISH, RETURN_STAFF, hoặc REJECT
  const handleManagerDecision = async (
    decision: "PUBLISH" | "RETURN_STAFF" | "REJECT"
  ) => {
    if (!selectedDocId) return;

    if (
      (decision === "RETURN_STAFF" || decision === "REJECT") &&
      !managerComment.trim()
    ) {
      setActionErrorMsg(
        decision === "RETURN_STAFF"
          ? "Vui lòng nhập lý do yêu cầu xem xét lại để gửi lại cho Staff."
          : "Vui lòng nhập lý do từ chối tài liệu."
      );
      return;
    }

    setProcessingAction(decision);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    const defaultComment =
      decision === "PUBLISH"
        ? "Tài liệu đạt chuẩn chất lượng, Manager phê duyệt xuất bản (PUBLISHED) và đẩy lên GitHub."
        : decision === "RETURN_STAFF"
        ? "Yêu cầu Staff rà soát và hiệu chỉnh lại."
        : "Từ chối tài liệu.";

    try {
      await documentService.processManagerReview(selectedDocId, {
        decision,
        comment: managerComment.trim() || defaultComment,
      });

      const successText =
        decision === "PUBLISH"
          ? "🎉 Đã phê duyệt và xuất bản tài liệu thành công (PUBLISHED). Đã kích hoạt đẩy commit lên GitHub!"
          : decision === "RETURN_STAFF"
          ? "↩️ Đã trả tài liệu về hàng đợi Staff xem xét lại (UNDER_REVIEW_STAFF)."
          : "🚫 Đã từ chối tài liệu (REJECTED).";

      setActionSuccessMsg(successText);
      setManagerComment("");

      // Làm mới danh sách hàng đợi sau 1.2s
      setTimeout(() => {
        fetchManagerQueue();
      }, 1200);
    } catch (err: unknown) {
      console.error("Lỗi xử lý quyết định Manager:", err);
      setActionErrorMsg(
        "Thao tác thất bại. Vui lòng kiểm tra quyền Manager hoặc kết nối mạng."
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // Trích xuất nhận xét mới nhất của Staff từ Audit Trail hoặc TriggerType
  const staffReviewInfo = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return null;
    const staffLog = auditLogs.find(
      (l) =>
        l.action === "DOCUMENT_STAFF_REVIEWED" ||
        l.action === "DOCUMENT_APPROVED" ||
        (l.detail && l.detail.includes("Staff"))
    );
    return staffLog || null;
  }, [auditLogs]);

  // Lọc tài liệu theo thanh tìm kiếm
  const filteredDocs = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.targetPath && d.targetPath.toLowerCase().includes(q))
    );
  }, [documents, search]);

  const selectedRepo = selectedDocDetail
    ? repositories[selectedDocDetail.repoId]
    : null;

  return (
    <AppShell>
      {/* Header */}
      <div className="ld-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="ld-page-title" style={{ color: "#0f766e" }}>
              Trung tâm phê duyệt của Manager
            </h1>
            <span
              className="ld-badge"
              style={{
                background: "#f0fdfa",
                color: "#0f766e",
                border: "1px solid #ccfbf1",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              Duyệt cấp 2 & Xuất bản
            </span>
          </div>
          <p className="ld-page-subtitle">
            Rà soát tài liệu do Staff chuyển lên, đối chiếu nhận xét & nhật ký Audit trail, quyết định xuất bản lên GitHub hoặc trả lại Staff.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={fetchManagerQueue}
            className="ld-btn ld-btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              borderColor: "#e2e8f0",
            }}
            title="Làm mới hàng đợi"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
          <span
            className="ld-badge"
            style={{
              background: "#ccfbf1",
              color: "#0f766e",
              fontSize: 13,
              padding: "6px 14px",
              fontWeight: 600,
            }}
          >
            ⏳ {documents.length} tài liệu chờ Manager duyệt
          </span>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid #fecaca",
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Main Layout 2 Cột: Bên trái là danh sách hàng đợi, bên phải là chi tiết đối chiếu & ra quyết định */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* CỘT TRÁI: Danh sách tài liệu UNDER_REVIEW_MANAGER */}
        <div
          className="ld-card"
          style={{
            padding: 0,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          {/* Header & Thanh tìm kiếm */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #e2e8f0",
              background: "#fafafa",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#475569",
                  margin: 0,
                }}
              >
                Hàng đợi chờ duyệt ({filteredDocs.length})
              </h2>
            </div>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ld-input"
                style={{
                  paddingLeft: 32,
                  fontSize: 13,
                  background: "#ffffff",
                  height: 34,
                }}
              />
            </div>
          </div>

          {/* List Items */}
          <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
            {loading ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Đang tải danh sách hàng đợi...
              </div>
            ) : filteredDocs.length === 0 ? (
              <div
                style={{
                  padding: 36,
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                <CheckCircle
                  size={36}
                  style={{ color: "#0f766e", margin: "0 auto 10px" }}
                />
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    margin: 0,
                  }}
                >
                  Không có tài liệu chờ duyệt
                </p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Tất cả tài liệu đã được giải quyết hoặc chưa có Staff chuyển lên.
                </p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = doc.docId === selectedDocId;
                const repo = repositories[doc.repoId];
                return (
                  <div
                    key={doc.docId}
                    onClick={() => handleSelectDoc(doc.docId)}
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      background: isSelected ? "#f0fdfa" : "#ffffff",
                      borderLeft: isSelected
                        ? "4px solid #0f766e"
                        : "4px solid transparent",
                      transition: "all 150ms ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected ? 700 : 600,
                          color: isSelected ? "#0f766e" : "#0f172a",
                          margin: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        {doc.title}
                      </h3>
                      <span
                        className="ld-badge"
                        style={{
                          background: "#e2e8f0",
                          color: "#334155",
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        v{doc.currentVersion}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        marginTop: 6,
                        fontSize: 11,
                        color: "#64748b",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <GitBranch size={11} /> {repo?.repoFullName || `Repo #${doc.repoId}`}
                      </span>
                      {doc.targetPath && (
                        <span
                          style={{
                            color: "#475569",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Đích: <code>{doc.targetPath}</code>
                        </span>
                      )}
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#94a3b8",
                        }}
                      >
                        <Clock size={11} />{" "}
                        {new Date(doc.updatedAt || doc.createdAt).toLocaleString(
                          "vi-VN"
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT PHẢI: Chi tiết tài liệu, Nhận xét của Staff, Audit trail & Nút phê duyệt */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedDocDetail ? (
            <>
              {/* Thông báo thao tác thành công / thất bại */}
              {actionSuccessMsg && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#f0fdf4",
                    color: "#166534",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <CheckCircle size={18} style={{ color: "#16a34a" }} />
                  {actionSuccessMsg}
                </div>
              )}

              {actionErrorMsg && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    borderRadius: 8,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "1px solid #fecaca",
                  }}
                >
                  <AlertCircle size={18} />
                  {actionErrorMsg}
                </div>
              )}

              {/* CARD 1: Thông tin tổng quan tài liệu & Nhận xét của Staff */}
              <div
                className="ld-card"
                style={{
                  border: "1px solid #e2e8f0",
                  padding: "18px 20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <h2
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#0f172a",
                          margin: 0,
                        }}
                      >
                        {selectedDocDetail.title}
                      </h2>
                      <span
                        className="ld-badge"
                        style={{
                          background: "#ccfbf1",
                          color: "#0f766e",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Chờ Manager duyệt
                      </span>
                      <span
                        className="ld-badge"
                        style={{
                          background: "#f1f5f9",
                          color: "#334155",
                          fontSize: 11,
                        }}
                      >
                        Phiên bản v{selectedDocDetail.currentVersion}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        flexWrap: "wrap",
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <GitBranch size={13} />
                        <strong>Repo:</strong>{" "}
                        {selectedRepo?.repoFullName ||
                          `Repo #${selectedDocDetail.repoId}`}
                      </span>
                      {selectedDocDetail.targetPath && (
                        <span>
                          <strong>Đường dẫn đích:</strong>{" "}
                          <code>{selectedDocDetail.targetPath}</code>
                        </span>
                      )}
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={13} />
                        <strong>Cập nhật:</strong>{" "}
                        {new Date(
                          selectedDocDetail.updatedAt ||
                            selectedDocDetail.createdAt
                        ).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </div>

                  <a
                    href={`/tai-lieu-cua-toi/editor?docId=${selectedDocDetail.docId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ld-btn ld-btn-ghost"
                    style={{
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ExternalLink size={13} />
                    Mở trong Editor
                  </a>
                </div>

                {/* Hộp hiển thị nhận xét của Staff (Review comment) */}
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 14px",
                    background: "#f0fdfa",
                    border: "1px solid #ccfbf1",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <UserCheck
                    size={20}
                    style={{ color: "#0f766e", flexShrink: 0, marginTop: 2 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0f766e",
                          margin: 0,
                        }}
                      >
                        Nhận xét từ Staff (Duyệt cấp 1):
                      </p>
                      {staffReviewInfo && (
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          {new Date(staffReviewInfo.createdAt).toLocaleString(
                            "vi-VN"
                          )}
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#134e4a",
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {staffReviewInfo?.detail ||
                        "Staff đã hoàn thành đối chiếu mã nguồn và xác nhận tài liệu đạt chuẩn, gửi lên Manager phê duyệt xuất bản."}
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD 2: Xem nội dung tài liệu Markdown & Nhật ký Audit Trail */}
              <div
                className="ld-card"
                style={{
                  border: "1px solid #e2e8f0",
                  padding: 0,
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                {/* Thanh chuyển đổi Tab */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 16px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("content")}
                      style={{
                        padding: "12px 16px",
                        border: "none",
                        background: "transparent",
                        fontSize: 13,
                        fontWeight: activeTab === "content" ? 700 : 500,
                        color: activeTab === "content" ? "#0f766e" : "#64748b",
                        borderBottom:
                          activeTab === "content"
                            ? "2px solid #0f766e"
                            : "2px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <FileText size={15} />
                      Nội dung tài liệu (Markdown)
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("audit")}
                      style={{
                        padding: "12px 16px",
                        border: "none",
                        background: "transparent",
                        fontSize: 13,
                        fontWeight: activeTab === "audit" ? 700 : 500,
                        color: activeTab === "audit" ? "#0f766e" : "#64748b",
                        borderBottom:
                          activeTab === "audit"
                            ? "2px solid #0f766e"
                            : "2px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <History size={15} />
                      Nhật ký lịch sử thay đổi (Audit trail) ({auditLogs.length})
                    </button>
                  </div>

                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    SHA-256 Hash Chain:{" "}
                    <code>
                      {selectedDocDetail.latestVersion?.hash?.substring(0, 12) ||
                        "genesis"}
                      ...
                    </code>
                  </span>
                </div>

                {/* Nội dung Tab */}
                {activeTab === "content" ? (
                  <div
                    style={{
                      padding: 24,
                      maxHeight: "520px",
                      overflowY: "auto",
                      background: "#ffffff",
                    }}
                  >
                    {loadingDetail ? (
                      <p style={{ color: "#64748b", fontSize: 13 }}>
                        Đang tải nội dung văn bản...
                      </p>
                    ) : (
                      <div className="prose prose-teal max-w-none text-slate-800 text-sm leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {selectedDocDetail.latestVersion?.content ||
                            "(Tài liệu chưa có nội dung văn bản)"}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Tab Nhật ký lịch sử thay đổi (Audit trail) */
                  <div
                    style={{
                      padding: 20,
                      maxHeight: "520px",
                      overflowY: "auto",
                      background: "#ffffff",
                    }}
                  >
                    {auditLogs.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: 32,
                          color: "#64748b",
                          fontSize: 13,
                        }}
                      >
                        <Info
                          size={24}
                          style={{ margin: "0 auto 8px", color: "#94a3b8" }}
                        />
                        Chưa có sự kiện Audit trail ghi nhận riêng cho tài liệu này.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {auditLogs.map((logItem, index) => {
                          const isApproval =
                            logItem.action === "DOCUMENT_APPROVED" ||
                            logItem.action === "DOCUMENT_PUBLISHED";
                          const isReturn =
                            logItem.action === "DOCUMENT_RETURNED_STAFF";
                          const isReject =
                            logItem.action === "DOCUMENT_REJECTED";

                          const badgeBg = isApproval
                            ? "#f0fdf4"
                            : isReturn
                            ? "#fffbeb"
                            : isReject
                            ? "#fef2f2"
                            : "#f8fafc";
                          const badgeColor = isApproval
                            ? "#166534"
                            : isReturn
                            ? "#b45309"
                            : isReject
                            ? "#b91c1c"
                            : "#475569";

                          return (
                            <div
                              key={logItem.logId || index}
                              style={{
                                padding: "12px 14px",
                                border: "1px solid #e2e8f0",
                                borderRadius: 8,
                                background: "#fafafa",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 6,
                                  background: badgeBg,
                                  color: badgeColor,
                                  display: "grid",
                                  placeItems: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {isApproval ? (
                                  <Check size={16} />
                                ) : isReturn ? (
                                  <RotateCcw size={16} />
                                ) : isReject ? (
                                  <XCircle size={16} />
                                ) : (
                                  <Clock size={16} />
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    marginBottom: 4,
                                  }}
                                >
                                  <span
                                    className="ld-badge"
                                    style={{
                                      background: badgeBg,
                                      color: badgeColor,
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {logItem.action}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#64748b",
                                    }}
                                  >
                                    {new Date(logItem.createdAt).toLocaleString(
                                      "vi-VN"
                                    )}
                                  </span>
                                </div>
                                <p
                                  style={{
                                    fontSize: 13,
                                    color: "#334155",
                                    margin: 0,
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {logItem.detail || "(Không có nội dung chi tiết)"}
                                </p>
                                {logItem.actorId && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#94a3b8",
                                      marginTop: 4,
                                      display: "inline-block",
                                    }}
                                  >
                                    Người thực hiện: User #{logItem.actorId}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CARD 3: Khu vực Manager ra quyết định phê duyệt */}
              <div
                className="ld-card"
                style={{
                  border: "1px solid #ccfbf1",
                  background: "#f0fdfa",
                  padding: "18px 20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#0f766e",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <MessageSquare size={16} />
                  Quyết định của Manager & Nhận xét
                </h3>

                <textarea
                  className="ld-input"
                  style={{
                    width: "100%",
                    minHeight: 75,
                    resize: "vertical",
                    fontSize: 13,
                    background: "#ffffff",
                    borderColor: "#99f6e4",
                    marginBottom: 14,
                  }}
                  value={managerComment}
                  onChange={(e) => setManagerComment(e.target.value)}
                  placeholder="Nhập nhận xét phê duyệt xuất bản, hoặc lý do yêu cầu Staff xem xét lại / từ chối..."
                />

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Nút 1: Phê duyệt xuất bản (Approve & Publish) */}
                  <button
                    type="button"
                    className="ld-btn"
                    disabled={processingAction !== null}
                    onClick={() => handleManagerDecision("PUBLISH")}
                    style={{
                      background: "#0f766e",
                      color: "#ffffff",
                      borderColor: "#0f766e",
                      padding: "8px 18px",
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <CheckCircle size={16} />
                    {processingAction === "PUBLISH"
                      ? "Đang xuất bản & Đẩy commit..."
                      : "Phê duyệt xuất bản (Approve & Publish)"}
                  </button>

                  {/* Nút 2: Từ chối / Trả lại Staff */}
                  <button
                    type="button"
                    className="ld-btn"
                    disabled={processingAction !== null}
                    onClick={() => handleManagerDecision("RETURN_STAFF")}
                    style={{
                      background: "#ffffff",
                      color: "#b45309",
                      borderColor: "#fde68a",
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RotateCcw size={15} />
                    {processingAction === "RETURN_STAFF"
                      ? "Đang trả lại Staff..."
                      : "Từ chối / Trả lại Staff"}
                  </button>

                  {/* Nút 3: Từ chối hẳn (REJECT) */}
                  <button
                    type="button"
                    className="ld-btn ld-btn-ghost"
                    disabled={processingAction !== null}
                    onClick={() => handleManagerDecision("REJECT")}
                    style={{
                      color: "#b91c1c",
                      borderColor: "#fecaca",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginLeft: "auto",
                    }}
                  >
                    <XCircle size={15} />
                    {processingAction === "REJECT"
                      ? "Đang từ chối..."
                      : "Từ chối hẳn (REJECTED)"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              className="ld-card"
              style={{
                padding: 48,
                textAlign: "center",
                color: "#64748b",
                border: "1px dashed #cbd5e1",
              }}
            >
              <FileText
                size={40}
                style={{ color: "#94a3b8", margin: "0 auto 12px" }}
              />
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#0f172a",
                  marginBottom: 4,
                }}
              >
                Chọn một tài liệu từ hàng đợi bên trái
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                Bạn có thể xem trước nội dung Markdown, kiểm tra nhận xét của Staff và đối chiếu lịch sử thay đổi (Audit trail) trước khi ra quyết định xuất bản.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
