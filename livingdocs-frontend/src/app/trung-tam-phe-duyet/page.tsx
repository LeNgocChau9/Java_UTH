"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { documentService } from "@/services/documentService";
import { reviewService, type ReviewQueueItem, type ApprovalPolicyItem, type ManagerDelegationItem } from "@/services/reviewService";
import { repoService, type RepoItem } from "@/services/repoService";
import type {
  DocumentDetail,
  DocumentAuditLogItem,
  GroundingEvidenceItem,
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
  Sliders,
  Users,
  Calendar,
  Plus,
} from "lucide-react";

export default function TrungTamPheDuyetManagerPage() {
  const { user } = useSession();
  // Tài liệu Staff đã duyệt, đang chờ Manager (UNDER_REVIEW_MANAGER)
  const [documents, setDocuments] = useState<ReviewQueueItem[]>([]);
  const [codeLinks, setCodeLinks] = useState<GroundingEvidenceItem[]>([]);
  const [commitToGithub, setCommitToGithub] = useState(false);
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

  // Tab điều hướng chính: queue (Hàng đợi) | policies (Chính sách 1 cấp/2 cấp) | delegations (Ủy quyền)
  const [mainTab, setMainTab] = useState<"queue" | "policies" | "delegations">("queue");

  // Quản lý chính sách phê duyệt 1-tier vs 2-tier (LD-W6-09)
  const [policies, setPolicies] = useState<ApprovalPolicyItem[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState<boolean>(false);
  const [policySuccessMsg, setPolicySuccessMsg] = useState<string | null>(null);
  const [policyErrorMsg, setPolicyErrorMsg] = useState<string | null>(null);
  const [showAddPolicyRow, setShowAddPolicyRow] = useState<boolean>(false);
  const [newDocType, setNewDocType] = useState<string>("");
  const [newDocTypeTiers, setNewDocTypeTiers] = useState<1 | 2>(1);
  const [newDocTypeDesc, setNewDocTypeDesc] = useState<string>("");

  // Quản lý ủy quyền Manager Delegation (LD-W6-10)
  const [delegations, setDelegations] = useState<ManagerDelegationItem[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState<boolean>(false);
  const [showDelegationModal, setShowDelegationModal] = useState<boolean>(false);
  const [delegationSuccessMsg, setDelegationSuccessMsg] = useState<string | null>(null);
  const [delegationErrorMsg, setDelegationErrorMsg] = useState<string | null>(null);
  const [submittingDelegation, setSubmittingDelegation] = useState<boolean>(false);
  const [newDelegatorName, setNewDelegatorName] = useState<string>("Quản lý A");
  const [newDelegatorEmail, setNewDelegatorEmail] = useState<string>("managerA@livingdocs.internal");
  const [newDelegateeName, setNewDelegateeName] = useState<string>("Quản lý B");
  const [newDelegateeEmail, setNewDelegateeEmail] = useState<string>("managerB@livingdocs.internal");
  const [newFromDate, setNewFromDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [newToDate, setNewToDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().substring(0, 10);
  });
  const [newReason, setNewReason] = useState<string>("Nghỉ phép thường niên / Công tác");

  // 1. Tải danh sách tài liệu UNDER_REVIEW_MANAGER từ API thật
  const fetchManagerQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [managerQueue, allRepos] = await Promise.all([
        reviewService.getManagerQueue(),
        repoService.getRepositories().catch(() => [] as RepoItem[]),
      ]);
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

  // Tải danh sách Chính sách phê duyệt
  const fetchPolicies = useCallback(async () => {
    setLoadingPolicies(true);
    setPolicyErrorMsg(null);
    try {
      const data = await reviewService.getApprovalPolicies();
      setPolicies(data);
    } catch (err) {
      console.error("Lỗi tải chính sách phê duyệt:", err);
      setPolicyErrorMsg("Không thể tải danh sách chính sách phê duyệt.");
    } finally {
      setLoadingPolicies(false);
    }
  }, []);

  // Tải danh sách Ủy quyền phê duyệt Manager
  const fetchDelegations = useCallback(async () => {
    setLoadingDelegations(true);
    setDelegationErrorMsg(null);
    try {
      const data = await reviewService.getManagerDelegations();
      setDelegations(data);
    } catch (err) {
      console.error("Lỗi tải danh sách ủy quyền:", err);
      setDelegationErrorMsg("Không thể tải danh sách ủy quyền phê duyệt.");
    } finally {
      setLoadingDelegations(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
    fetchDelegations();
  }, [fetchPolicies, fetchDelegations]);

  // Lưu cấu hình chính sách phê duyệt
  const handleSavePolicies = async () => {
    setLoadingPolicies(true);
    setPolicySuccessMsg(null);
    setPolicyErrorMsg(null);
    try {
      const updated = await reviewService.updateApprovalPolicies(policies);
      setPolicies(updated);
      setPolicySuccessMsg("Đã lưu cấu hình chính sách phê duyệt thành công!");
      setTimeout(() => setPolicySuccessMsg(null), 4000);
    } catch (err) {
      console.error("Lỗi lưu chính sách phê duyệt:", err);
      setPolicyErrorMsg("Không thể lưu cấu hình chính sách phê duyệt.");
    } finally {
      setLoadingPolicies(false);
    }
  };

  const handleToggleTier = (docType: string) => {
    setPolicies((prev) =>
      prev.map((p) =>
        p.docType.toLowerCase() === docType.toLowerCase()
          ? { ...p, tiers: p.tiers === 1 ? 2 : 1 }
          : p
      )
    );
  };

  // Tạo ủy quyền Manager mới
  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDelegation(true);
    setDelegationErrorMsg(null);
    setDelegationSuccessMsg(null);
    try {
      const created = await reviewService.createManagerDelegation({
        delegatorName: newDelegatorName.trim() || "Quản lý A",
        delegatorEmail: newDelegatorEmail.trim() || "managerA@livingdocs.internal",
        delegateeName: newDelegateeName.trim() || "Quản lý B",
        delegateeEmail: newDelegateeEmail.trim() || "managerB@livingdocs.internal",
        fromDate: newFromDate,
        toDate: newToDate,
        reason: newReason.trim() || "Ủy quyền phê duyệt",
        active: true,
      });
      setDelegations((prev) => [...prev, created]);
      setDelegationSuccessMsg(`Đã tạo ủy quyền thành công: ${created.delegatorName} ủy quyền cho ${created.delegateeName}!`);
      setShowDelegationModal(false);
      setTimeout(() => setDelegationSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Lỗi tạo ủy quyền:", err);
      setDelegationErrorMsg("Không thể tạo bản ghi ủy quyền phê duyệt.");
    } finally {
      setSubmittingDelegation(false);
    }
  };

  // Danh sách ủy quyền đang có hiệu lực tại thời điểm hiện tại
  const activeDelegations = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    return delegations.filter((d) => {
      if (d.active === false) return false;
      const from = d.fromDate ? d.fromDate.substring(0, 10) : "";
      const to = d.toDate ? d.toDate.substring(0, 10) : "";
      if (from && today < from) return false;
      if (to && today > to) return false;
      return true;
    });
  }, [delegations]);

  // 2. Tải chi tiết tài liệu và lịch sử Audit Trail khi chọn tài liệu
  const handleSelectDoc = async (docId: number) => {
    setSelectedDocId(docId);
    setLoadingDetail(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    setManagerComment("");
    setCodeLinks([]);
    try {
      const [detail, logs, links] = await Promise.all([
        documentService.getDocumentById(docId),
        documentService.getDocumentAuditTrail(docId).catch(() => [] as DocumentAuditLogItem[]),
        documentService.getDocumentCodeLinks(docId).catch(() => [] as GroundingEvidenceItem[]),
      ]);
      setSelectedDocDetail(detail);
      setAuditLogs(logs);
      setCodeLinks(links);
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
      const actorEmail = user?.email?.trim().toLowerCase();
      const activeDel = activeDelegations.find((item) =>
        actorEmail && item.delegateeEmail?.trim().toLowerCase() === actorEmail
      ) ?? null;
      const result = await reviewService.processManagerAction(selectedDocId, {
        decision,
        comment: managerComment.trim() || defaultComment,
        commitToGithub: decision === "PUBLISH" && commitToGithub,
        delegationId: activeDel?.id,
        delegatedFromEmail: activeDel?.delegatorEmail,
        delegatedFromName: activeDel?.delegatorName,
      });

      const delegationNotice = activeDel ? ` (Ủy quyền: ${activeDel.delegateeName} phê duyệt thay cho ${activeDel.delegatorName})` : "";
      const successText = (
        decision === "PUBLISH"
          ? result.commitSha
            ? `Đã phê duyệt (PUBLISHED) và đẩy file .md lên GitHub. Commit: ${result.commitSha}`
            : "Đã phê duyệt xuất bản (PUBLISHED). Không đẩy file lên GitHub."
          : decision === "RETURN_STAFF"
          ? "Đã yêu cầu sửa đổi và trả tài liệu về Staff (UNDER_REVIEW_STAFF)."
          : "Đã từ chối tài liệu (REJECTED). Tài liệu không được xuất bản."
      ) + delegationNotice;

      setActionSuccessMsg(successText);
      setManagerComment("");

      // Làm mới danh sách hàng đợi sau 1.2s
      setTimeout(() => {
        fetchManagerQueue();
      }, 1200);
    } catch (err: unknown) {
      console.error("Lỗi xử lý quyết định Manager:", err);
      const apiMessage =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
          "string"
          ? (err as { response: { data: { message: string } } }).response.data.message
          : null;
      setActionErrorMsg(
        apiMessage || "Thao tác thất bại. Chỉ Manager mới xuất bản được, hoặc GitHub token không hợp lệ."
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

  const selectedQueue = useMemo(
    () => documents.find((d) => d.docId === selectedDocId) ?? null,
    [documents, selectedDocId]
  );

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

      {/* Navigation Tabs (LD-W6-09 & LD-W6-10) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid #e2e8f0",
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setMainTab("queue")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: mainTab === "queue" ? "2px solid #0f766e" : "2px solid transparent",
            color: mainTab === "queue" ? "#0f766e" : "#64748b",
            fontWeight: mainTab === "queue" ? 600 : 500,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <FileText size={16} />
          <span>Hàng đợi phê duyệt</span>
          <span
            className="ld-badge"
            style={{
              background: mainTab === "queue" ? "#ccfbf1" : "#f1f5f9",
              color: mainTab === "queue" ? "#0f766e" : "#64748b",
              fontSize: 11,
              padding: "2px 8px",
            }}
          >
            {documents.length}
          </span>
        </button>

        <button
          onClick={() => setMainTab("policies")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: mainTab === "policies" ? "2px solid #0f766e" : "2px solid transparent",
            color: mainTab === "policies" ? "#0f766e" : "#64748b",
            fontWeight: mainTab === "policies" ? 600 : 500,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <Sliders size={16} />
          <span>Chính sách phê duyệt (1 cấp / 2 cấp)</span>
          <span
            className="ld-badge"
            style={{
              background: "#e0f2fe",
              color: "#0284c7",
              fontSize: 11,
              padding: "2px 8px",
            }}
          >
            {policies.length} quy tắc
          </span>
        </button>

        <button
          onClick={() => setMainTab("delegations")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            border: "none",
            background: "none",
            borderBottom: mainTab === "delegations" ? "2px solid #0f766e" : "2px solid transparent",
            color: mainTab === "delegations" ? "#0f766e" : "#64748b",
            fontWeight: mainTab === "delegations" ? 600 : 500,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <Users size={16} />
          <span>Ủy quyền Manager</span>
          {activeDelegations.length > 0 && (
            <span
              className="ld-badge"
              style={{
                background: "#dcfce7",
                color: "#166534",
                fontSize: 11,
                padding: "2px 8px",
              }}
            >
              {activeDelegations.length} hiệu lực
            </span>
          )}
        </button>
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

      {/* TAB 1: HÀNG ĐỢI PHÊ DUYỆT */}
      {mainTab === "queue" && (
        <>
          {activeDelegations.length > 0 && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: "10px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#166534" }}>
                <UserCheck size={18} />
                <span>
                  <strong>Ủy quyền đang kích hoạt:</strong>{" "}
                  {activeDelegations
                    .map((d) => `${d.delegateeName} phê duyệt thay cho ${d.delegatorName} (${d.fromDate} ➔ ${d.toDate})`)
                    .join("; ")}
                </span>
              </div>
              <span className="ld-badge" style={{ background: "#dcfce7", color: "#166534", fontSize: 11 }}>
                Có hiệu lực
              </span>
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
                      {(selectedQueue?.staffReviewer || staffReviewInfo) && (
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          {selectedQueue?.staffReviewer
                            ? selectedQueue.staffReviewer
                            : ""}
                          {selectedQueue?.staffReviewedAt
                            ? ` · ${new Date(selectedQueue.staffReviewedAt).toLocaleString("vi-VN")}`
                            : staffReviewInfo
                            ? new Date(staffReviewInfo.createdAt).toLocaleString("vi-VN")
                            : ""}
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
                      {selectedQueue?.staffComment ||
                        staffReviewInfo?.detail ||
                        "Staff chưa để lại nhận xét."}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
                    Bằng chứng AST ({codeLinks.length})
                  </p>
                  {codeLinks.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                      Tài liệu chưa gắn thực thể mã nguồn trong doc_code_links.
                    </p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#334155" }}>
                      {codeLinks.map((link) => (
                        <li key={link.linkId ?? `${link.filePath}-${link.methodName}`} style={{ marginBottom: 4 }}>
                          <code>{link.filePath}</code>
                          {link.className ? ` · ${link.className}` : ""}
                          {link.methodName ? `.${link.methodName}` : ""}
                          {link.startLine ? ` (dòng ${link.startLine}${link.endLine ? `–${link.endLine}` : ""})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
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
                  placeholder="Nhập nhận xét phê duyệt xuất bản, hoặc lý do yêu cầu sửa / từ chối..."
                />

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#134e4a",
                    marginBottom: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={commitToGithub}
                    onChange={(e) => setCommitToGithub(e.target.checked)}
                  />
                  <GitBranch size={14} />
                  Cam kết file Markdown vào{" "}
                  <code>
                    {selectedDocDetail?.targetPath || selectedQueue?.targetPath || "docs/"}
                  </code>
                  , nhánh {selectedQueue?.defaultBranch || selectedRepo?.defaultBranch || "mặc định"}.
                  Thông điệp commit ghi người phê duyệt và mã phiên bản.
                </label>

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
                      ? "Đang phê duyệt..."
                      : commitToGithub
                        ? "Phê duyệt và cam kết GitHub"
                        : "Phê duyệt & Xuất bản"}
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
                      ? "Đang gửi yêu cầu sửa..."
                      : "Yêu cầu sửa đổi"}
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
      </>
      )}

      {/* TAB 2: CHÍNH SÁCH PHÊ DUYỆT 1 CẤP / 2 CẤP (LD-W6-09) */}
      {mainTab === "policies" && (
        <div className="ld-card" style={{ padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                Cấu hình chính sách phê duyệt theo loại tài liệu (doc_type)
              </h2>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, maxWidth: 850 }}>
                Thiết lập quy trình kiểm duyệt tài liệu linh hoạt theo loại tài liệu (doc_type):
                <br />• <strong>1 Cấp (Staff duyệt)</strong>: Staff sau khi rà soát và đối chiếu mã nguồn sẽ phê duyệt xuất bản trực tiếp lên hệ thống (PUBLISHED).
                <br />• <strong>2 Cấp (Staff ➔ Manager)</strong>: Sau khi Staff duyệt, tài liệu sẽ chuyển sang hàng đợi của Manager (UNDER_REVIEW_MANAGER) để quản lý ký duyệt lần cuối.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowAddPolicyRow(!showAddPolicyRow)}
                className="ld-btn ld-btn-ghost"
                style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, borderColor: "#cbd5e1" }}
              >
                <Plus size={14} />
                Thêm loại tài liệu
              </button>
              <button
                onClick={handleSavePolicies}
                className="ld-btn ld-btn-primary"
                disabled={loadingPolicies}
                style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
              >
                {loadingPolicies ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                Lưu chính sách
              </button>
            </div>
          </div>

          {policySuccessMsg && (
            <div
              style={{
                padding: "10px 14px",
                background: "#f0fdf4",
                color: "#166534",
                borderRadius: 6,
                marginBottom: 16,
                border: "1px solid #bbf7d0",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle size={16} />
              {policySuccessMsg}
            </div>
          )}

          {policyErrorMsg && (
            <div
              style={{
                padding: "10px 14px",
                background: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 6,
                marginBottom: 16,
                border: "1px solid #fecaca",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              {policyErrorMsg}
            </div>
          )}

          {showAddPolicyRow && (
            <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1", marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 12 }}>Thêm mới quy tắc loại tài liệu</h4>
              <div style={{ display: "grid", gridTemplateColumns: "180px 180px 1fr auto", gap: 12, alignItems: "center" }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
                    Loại tài liệu (doc_type)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: RUNBOOK, SECURITY..."
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value.toUpperCase())}
                    className="ld-input"
                    style={{ fontSize: 13, padding: "6px 10px", width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
                    Số cấp phê duyệt
                  </label>
                  <select
                    value={newDocTypeTiers}
                    onChange={(e) => setNewDocTypeTiers(Number(e.target.value) as 1 | 2)}
                    className="ld-input"
                    style={{ fontSize: 13, padding: "6px 10px", width: "100%" }}
                  >
                    <option value={1}>1 Cấp (Staff duyệt)</option>
                    <option value={2}>2 Cấp (Staff + Manager)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
                    Mô tả quy tắc
                  </label>
                  <input
                    type="text"
                    placeholder="Mục đích hoặc ghi chú..."
                    value={newDocTypeDesc}
                    onChange={(e) => setNewDocTypeDesc(e.target.value)}
                    className="ld-input"
                    style={{ fontSize: 13, padding: "6px 10px", width: "100%" }}
                  />
                </div>
                <div style={{ paddingTop: 18 }}>
                  <button
                    onClick={() => {
                      if (!newDocType.trim()) return;
                      setPolicies([
                        ...policies,
                        {
                          docType: newDocType.trim().toUpperCase(),
                          tiers: newDocTypeTiers,
                          description: newDocTypeDesc.trim(),
                          updatedAt: new Date().toISOString(),
                          updatedBy: "Manager",
                        },
                      ]);
                      setNewDocType("");
                      setNewDocTypeDesc("");
                      setShowAddPolicyRow(false);
                    }}
                    className="ld-btn ld-btn-primary"
                    style={{ fontSize: 13, padding: "6px 14px" }}
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Loại tài liệu (doc_type)</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Quy trình phê duyệt</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Mô tả chính sách</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Cập nhật lần cuối</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569", textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span className="ld-badge" style={{ background: "#f1f5f9", color: "#334155", fontWeight: 700, fontFamily: "monospace" }}>
                        {p.docType}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {p.tiers === 1 ? (
                        <span className="ld-badge" style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontWeight: 600 }}>
                          ⚡ 1 Cấp (Staff duyệt xuất bản trực tiếp)
                        </span>
                      ) : (
                        <span className="ld-badge" style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontWeight: 600 }}>
                          🛡️ 2 Cấp (Staff duyệt ➔ Manager ký xuất bản)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#475569" }}>
                      <input
                        type="text"
                        value={p.description || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPolicies(policies.map((item, i) => (i === idx ? { ...item, description: val } : item)));
                        }}
                        className="ld-input"
                        style={{ width: "100%", fontSize: 13, padding: "4px 8px" }}
                      />
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748b", fontSize: 12 }}>
                      {p.updatedBy || "SYSTEM"}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <button
                        onClick={() => handleToggleTier(p.docType)}
                        className="ld-btn ld-btn-ghost"
                        style={{ fontSize: 12, padding: "4px 10px", borderColor: "#cbd5e1" }}
                        title="Chuyển đổi giữa 1 cấp và 2 cấp"
                      >
                        Đổi sang {p.tiers === 1 ? "2 Cấp" : "1 Cấp"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ỦY QUYỀN PHÊ DUYỆT MANAGER (LD-W6-10) */}
      {mainTab === "delegations" && (
        <div className="ld-card" style={{ padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                Ủy quyền phê duyệt Manager (Manager Delegation)
              </h2>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, maxWidth: 850 }}>
                Cho phép Quản lý A ủy quyền quyền phê duyệt cho Quản lý B trong khoảng thời gian xác định (nghỉ phép, công tác).
                Mọi thao tác phê duyệt sẽ được hệ thống đối chiếu và ghi nhận minh bạch vào Audit Trail:
                <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, marginLeft: 6, color: "#0f766e", fontWeight: 600 }}>
                  Quản lý B phê duyệt thay cho Quản lý A theo ủy quyền
                </code>.
              </p>
            </div>
            <button
              onClick={() => setShowDelegationModal(true)}
              className="ld-btn ld-btn-primary"
              style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              Tạo ủy quyền mới
            </button>
          </div>

          {delegationSuccessMsg && (
            <div
              style={{
                padding: "10px 14px",
                background: "#f0fdf4",
                color: "#166534",
                borderRadius: 6,
                marginBottom: 16,
                border: "1px solid #bbf7d0",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle size={16} />
              {delegationSuccessMsg}
            </div>
          )}

          {delegationErrorMsg && (
            <div
              style={{
                padding: "10px 14px",
                background: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 6,
                marginBottom: 16,
                border: "1px solid #fecaca",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              {delegationErrorMsg}
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Quản lý ủy quyền (Manager A)</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Quản lý nhận ủy quyền (Manager B)</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Khoảng thời gian (From ➔ To)</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Lý do ủy quyền</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {delegations.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>
                      Chưa có bản ghi ủy quyền nào. Nhấn &quot;Tạo ủy quyền mới&quot; để thiết lập.
                    </td>
                  </tr>
                ) : (
                  delegations.map((d, idx) => {
                    const today = new Date().toISOString().substring(0, 10);
                    const from = d.fromDate ? d.fromDate.substring(0, 10) : "";
                    const to = d.toDate ? d.toDate.substring(0, 10) : "";
                    const isCurrentlyActive = d.active !== false && (!from || today >= from) && (!to || today <= to);
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>{d.delegatorName}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{d.delegatorEmail}</div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#0f766e" }}>{d.delegateeName}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{d.delegateeEmail}</div>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#334155" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Calendar size={14} style={{ color: "#64748b" }} />
                            <span>
                              {d.fromDate || "Bắt đầu"} ➔ {d.toDate || "Vô thời hạn"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#475569" }}>
                          {d.reason || "Không ghi chú"}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {isCurrentlyActive ? (
                            <span className="ld-badge" style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", fontWeight: 600 }}>
                              ● Đang hiệu lực
                            </span>
                          ) : (
                            <span className="ld-badge" style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" }}>
                              Hết hạn / Tạm dừng
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL TẠO ỦY QUYỀN MỚI (LD-W6-10) */}
      {showDelegationModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: 520,
              maxWidth: "90vw",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Tạo ủy quyền phê duyệt Manager
              </h3>
              <button
                onClick={() => setShowDelegationModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDelegation}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                    Quản lý ủy quyền (Manager A)
                  </label>
                  <input
                    type="text"
                    value={newDelegatorName}
                    onChange={(e) => setNewDelegatorName(e.target.value)}
                    className="ld-input"
                    style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                    Email Manager A
                  </label>
                  <input
                    type="email"
                    value={newDelegatorEmail}
                    onChange={(e) => setNewDelegatorEmail(e.target.value)}
                    className="ld-input"
                    style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                    Quản lý nhận ủy quyền (Manager B)
                  </label>
                  <input
                    type="text"
                    value={newDelegateeName}
                    onChange={(e) => setNewDelegateeName(e.target.value)}
                    className="ld-input"
                    style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                    Email Manager B
                  </label>
                  <input
                    type="email"
                    value={newDelegateeEmail}
                    onChange={(e) => setNewDelegateeEmail(e.target.value)}
                    className="ld-input"
                    style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                    Từ ngày (From Date)
                  </label>
                  <input
                    type="date"
                    value={newFromDate}
                    onChange={(e) => setNewFromDate(e.target.value)}
                    className="ld-input"
                    style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                    Đến ngày (To Date)
                  </label>
                  <input
                    type="date"
                    value={newToDate}
                    onChange={(e) => setNewToDate(e.target.value)}
                    className="ld-input"
                    style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                  Lý do ủy quyền
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="ld-input"
                  style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                  placeholder="VD: Đi công tác nước ngoài, nghỉ phép..."
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowDelegationModal(false)}
                  className="ld-btn ld-btn-ghost"
                  style={{ fontSize: 13 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingDelegation}
                  className="ld-btn ld-btn-primary"
                  style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                >
                  {submittingDelegation ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  Xác nhận tạo ủy quyền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
