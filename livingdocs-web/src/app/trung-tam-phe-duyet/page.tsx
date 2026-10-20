"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import type { DocumentItem, DocumentDetail } from "@/types/document";
import {
  CheckCircle,
  XCircle,
  FileText,
  GitBranch,
  Clock,
  Eye,
  MessageSquare,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

function ApprovalCard({
  doc,
  repoName,
  onActionComplete,
}: {
  doc: DocumentItem;
  repoName: string;
  onActionComplete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [managerNote, setManagerNote] = useState("");
  const [loadingAction, setLoadingAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [decisionDone, setDecisionDone] = useState<"approved" | "rejected" | null>(null);
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggle = async () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !docDetail) {
      setLoadingDetail(true);
      try {
        const detail = await documentService.getDocumentById(doc.docId);
        setDocDetail(detail);
      } catch (err) {
        console.error("Không thể tải chi tiết tài liệu:", err);
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    if (decision === "REJECT" && !managerNote.trim()) {
      setErrorMsg("Vui lòng nhập lý do từ chối vào ô ghi chú.");
      return;
    }

    setLoadingAction(decision);
    setErrorMsg(null);
    try {
      await documentService.processManagerReview(doc.docId, {
        decision,
        comment: managerNote.trim() || (decision === "APPROVE" ? "Manager phê duyệt cấp 2 và phát hành tài liệu (PUBLISHED)." : "Manager từ chối."),
      });
      setDecisionDone(decision === "APPROVE" ? "approved" : "rejected");
      onActionComplete();
    } catch (err: unknown) {
      console.error(`Lỗi khi Manager xử lý ${decision}:`, err);
      setErrorMsg("Thao tác thất bại. Vui lòng kiểm tra lại quyền Manager hoặc máy chủ.");
    } finally {
      setLoadingAction(null);
    }
  };

  if (decisionDone) {
    return (
      <div
        className="ld-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderLeft: `3px solid ${decisionDone === "approved" ? "#059669" : "#b91c1c"}`,
          background: decisionDone === "approved" ? "#f0fdf4" : "#fef2f2",
        }}
      >
        {decisionDone === "approved" ? (
          <CheckCircle size={18} style={{ color: "#059669" }} />
        ) : (
          <XCircle size={18} style={{ color: "#b91c1c" }} />
        )}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>{doc.title}</p>
          <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
            {decisionDone === "approved"
              ? "Đã phê duyệt cấp 2 và xuất bản (PUBLISHED) thành công!"
              : "Đã từ chối tài liệu (chuyển sang REJECTED)."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ld-card" style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={handleToggle}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            background: "#eff6ff",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <FileText size={16} style={{ color: "#2563eb" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>{doc.title}</p>
            <span className="ld-badge" style={{ background: "#fef3c7", color: "#92400e", fontSize: 11 }}>
              Chờ Manager duyệt
            </span>
            <span className="ld-badge ld-badge-gray" style={{ fontSize: 11 }}>
              v{doc.currentVersion}
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <GitBranch size={12} /> {repoName || `Repo #${doc.repoId}`}
            </span>
            {doc.targetPath && (
              <span style={{ color: "#475569" }}>
                Đích: <code>{doc.targetPath}</code>
              </span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> {new Date(doc.updatedAt || doc.createdAt).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>

        <ChevronRight
          size={16}
          style={{
            color: "#64748b",
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 150ms",
            flexShrink: 0,
          }}
        />
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: 16, background: "#f8fafc" }}>
          {errorMsg && (
            <div style={{ padding: "8px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={15} />
              {errorMsg}
            </div>
          )}

          {loadingDetail ? (
            <p style={{ fontSize: 13, color: "#64748b" }}>Đang tải nội dung tài liệu...</p>
          ) : (
            <>
              {/* Preview Content Box */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                  Nội dung tài liệu (Trích xuất từ phiên bản mới nhất):
                </p>
                <div
                  style={{
                    maxHeight: 220,
                    overflowY: "auto",
                    padding: 12,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    color: "#334155",
                  }}
                >
                  {docDetail?.latestVersion?.content || doc.latestVersion?.content || "(Chưa có nội dung văn bản)"}
                </div>
              </div>

              {/* Manager Note Input */}
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                Ghi chú & Nhận xét của Manager:
              </label>
              <textarea
                className="ld-input"
                style={{ resize: "vertical", minHeight: 70, marginBottom: 14, width: "100%", fontSize: 13 }}
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                placeholder="Nhập ghi chú phê duyệt hoặc lý do từ chối (bắt buộc nếu từ chối)..."
              />

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ld-btn ld-btn-primary"
                  style={{ gap: 6, background: "#059669", borderColor: "#059669" }}
                  disabled={loadingAction !== null}
                  onClick={() => handleDecision("APPROVE")}
                >
                  <CheckCircle size={15} />
                  {loadingAction === "APPROVE" ? "Đang xử lý..." : "Phê duyệt & Phát hành (PUBLISHED)"}
                </button>

                <button
                  type="button"
                  className="ld-btn ld-btn-danger"
                  disabled={loadingAction !== null}
                  onClick={() => handleDecision("REJECT")}
                  style={{ gap: 6 }}
                >
                  <XCircle size={15} />
                  {loadingAction === "REJECT" ? "Đang từ chối..." : "Từ chối (REJECTED)"}
                </button>

                <a
                  href={`/tai-lieu-cua-toi/editor?docId=${doc.docId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ld-btn ld-btn-ghost"
                  style={{ gap: 5, marginLeft: "auto" }}
                >
                  <Eye size={14} />
                  Xem chi tiết trong Editor
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrungTamPheDuyetPage() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [repositories, setRepositories] = useState<Record<number, RepoItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManagerQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allDocs, allRepos] = await Promise.all([
        documentService.getDocuments(),
        repoService.getRepositories().catch(() => [] as RepoItem[]),
      ]);

      // Lọc các tài liệu ở trạng thái UNDER_REVIEW_MANAGER
      const managerQueue = allDocs.filter((d) => d.status === "UNDER_REVIEW_MANAGER");
      setDocs(managerQueue);

      const repoMap: Record<number, RepoItem> = {};
      allRepos.forEach((r) => {
        repoMap[r.repositoryId] = r;
      });
      setRepositories(repoMap);
    } catch (err) {
      console.error("Lỗi khi tải hàng đợi Manager:", err);
      setError("Không thể kết nối đến máy chủ để tải danh sách tài liệu chờ phê duyệt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagerQueue();
  }, [fetchManagerQueue]);

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Trung tâm phê duyệt tài liệu</h1>
          <p className="ld-page-subtitle">
            Duyệt cấp 2 dành cho Manager: Phê duyệt để phát hành (PUBLISHED) hoặc Từ chối (REJECTED)
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={fetchManagerQueue}
            className="ld-btn ld-btn-ghost"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            title="Làm mới danh sách"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
          <span className="ld-badge ld-badge-yellow" style={{ fontSize: 13, padding: "6px 12px" }}>
            ⏳ {docs.length} tài liệu chờ duyệt
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="ld-card" style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
          Đang tải danh sách tài liệu chờ Manager duyệt...
        </div>
      ) : docs.length === 0 ? (
        <div className="ld-card" style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
          <CheckCircle size={40} style={{ color: "#059669", margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
            Không có tài liệu nào chờ phê duyệt
          </h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Tất cả các tài liệu đã được Staff duyệt sẽ tự động xuất hiện tại đây để Manager ra quyết định.
          </p>
        </div>
      ) : (
        <div>
          {docs.map((doc) => (
            <ApprovalCard
              key={doc.docId}
              doc={doc}
              repoName={repositories[doc.repoId]?.repoFullName || ""}
              onActionComplete={fetchManagerQueue}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

