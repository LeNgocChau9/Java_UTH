"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MarkdownViewer } from "@/components/shared/MarkdownViewer";
import { documentService } from "@/services/documentService";
import type {
  DocumentDetail,
  DocumentItem,
  DocumentVersionItem,
  IntegrityCheckResult,
} from "@/types/document";
import {
  computeDocumentDiff,
  type DiffResult,
} from "@/lib/diffUtils";
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Eye,
  Columns,
  List,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Bot,
  User,
  Shield,
  Award,
  ArrowRightLeft,
  Hash,
  Sparkles,
  RefreshCw,
  Edit3,
  X,
} from "lucide-react";

// Cấu hình nhãn và màu sắc cho các vai trò tác nhân
const ACTOR_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; bg: string; color: string; border: string }
> = {
  AI: {
    label: "AI Bot",
    icon: <Bot size={12} />,
    bg: "#faf5ff",
    color: "#7e22ce",
    border: "#e9d5ff",
  },
  DEV: {
    label: "Developer",
    icon: <User size={12} />,
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
  },
  STAFF: {
    label: "Staff Reviewer",
    icon: <Shield size={12} />,
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
  },
  MANAGER: {
    label: "Manager",
    icon: <Award size={12} />,
    bg: "#ecfdf5",
    color: "#047857",
    border: "#a7f3d0",
  },
};

// Cấu hình nhãn loại kích hoạt (Trigger Type)
const TRIGGER_LABELS: Record<string, string> = {
  MANUAL_CREATE: "Khởi tạo tài liệu",
  MANUAL_UPDATE: "Chỉnh sửa thủ công",
  ROLLBACK: "Khôi phục phiên bản",
  AI_SYNC: "Đồng bộ từ Git",
  AI_GENERATE: "Tự động sinh bởi AI",
};

function VersionHistoryDiffContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("docId");

  // Dữ liệu chính
  const [docId, setDocId] = useState<number | null>(
    docIdParam ? parseInt(docIdParam, 10) : null
  );
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lựa chọn so sánh Diff
  const [versionAId, setVersionAId] = useState<number | null>(null);
  const [versionBId, setVersionBId] = useState<number | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<"side-by-side" | "inline">("side-by-side");
  const [syncScroll, setSyncScroll] = useState(true);
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [timelineOrder, setTimelineOrder] = useState<"desc" | "asc">("desc");

  // Điều hướng diff chunk
  const [activeChunkIdx, setActiveChunkIdx] = useState<number>(0);

  // Copy hash & preview
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<DocumentVersionItem | null>(null);

  // Modal rollback & integrity check
  const [rollbackTarget, setRollbackTarget] = useState<DocumentVersionItem | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const [rollbackRole, setRollbackRole] = useState("DEV");
  const [submittingRollback, setSubmittingRollback] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);

  // Toast thông báo
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Refs phục vụ đồng bộ cuộn và cuộn đến chunk
  const leftGutterRef = useRef<HTMLDivElement>(null);
  const rightGutterRef = useRef<HTMLDivElement>(null);
  const chunkRowsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const showToast = useCallback((type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Tải danh sách tất cả tài liệu để tiện chuyển đổi
  useEffect(() => {
    async function loadDocs() {
      try {
        const docs = await documentService.getDocuments();
        setAllDocs(docs);
        if (!docId && docs.length > 0) {
          setDocId(docs[0].docId);
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách tài liệu:", err);
      }
    }
    loadDocs();
  }, [docId]);

  // Tải chi tiết tài liệu và toàn bộ lịch sử phiên bản
  const loadDocumentData = useCallback(
    async (id: number, silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const [detail, vers] = await Promise.all([
          documentService.getDocumentById(id),
          documentService.getDocumentVersions(id),
        ]);

        setDocDetail(detail);

        // Đảm bảo sắp xếp mặc định từ mới nhất (vN) đến cũ nhất (v1)
        const sorted = [...vers].sort((a, b) => b.versionNum - a.versionNum);
        setVersions(sorted);

        // Thiết lập cặp so sánh mặc định:
        // Bản B = Phiên bản mới nhất (vN)
        // Bản A = Phiên bản liền trước (vN-1) hoặc chính nó nếu chỉ có 1 bản
        if (sorted.length > 0) {
          const latest = sorted[0];
          const previous = sorted.length > 1 ? sorted[1] : sorted[0];

          setVersionBId((prev) => (prev !== null && sorted.some((v) => v.versionNum === prev) ? prev : latest.versionNum));
          setVersionAId((prev) => (prev !== null && sorted.some((v) => v.versionNum === prev) ? prev : previous.versionNum));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Không thể tải dữ liệu tài liệu";
        showToast("error", msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (docId) {
      loadDocumentData(docId);
    }
  }, [docId, loadDocumentData]);

  // Lấy chi tiết phiên bản A và phiên bản B hiện được chọn
  const versionA = useMemo(
    () => versions.find((v) => v.versionNum === versionAId) || null,
    [versions, versionAId]
  );

  const versionB = useMemo(
    () => versions.find((v) => v.versionNum === versionBId) || null,
    [versions, versionBId]
  );

  // Tính toán kết quả diff
  const diffResult: DiffResult = useMemo(() => {
    const textA = versionA ? versionA.content : "";
    const textB = versionB ? versionB.content : "";
    return computeDocumentDiff(textA, textB);
  }, [versionA, versionB]);

  // Danh sách hiển thị theo thứ tự sắp xếp timeline
  const displayTimelineVersions = useMemo(() => {
    if (timelineOrder === "asc") {
      return [...versions].sort((a, b) => a.versionNum - b.versionNum);
    }
    return [...versions].sort((a, b) => b.versionNum - a.versionNum);
  }, [versions, timelineOrder]);

  // Hoán đổi phiên bản A và B
  const handleSwapVersions = () => {
    const temp = versionAId;
    setVersionAId(versionBId);
    setVersionBId(temp);
    setActiveChunkIdx(0);
  };

  // So sánh phiên bản hiện tại với phiên bản liền trước
  const handleCompareWithPrevious = (targetVer: DocumentVersionItem) => {
    const currentNum = targetVer.versionNum;
    const prevNum = currentNum > 1 ? currentNum - 1 : 1;
    setVersionAId(prevNum);
    setVersionBId(currentNum);
    setActiveChunkIdx(0);
  };

  // Sao chép mã băm vào clipboard
  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
    showToast("info", "Đã sao chép mã băm SHA-256 vào clipboard");
  };

  // Xác minh toàn vẹn chuỗi băm
  const handleVerifyIntegrity = async () => {
    if (!docId) return;
    setVerifyingIntegrity(true);
    try {
      const res = await documentService.verifyIntegrity(docId);
      setIntegrityResult(res);
      if (res.valid) {
        showToast("success", "Chuỗi băm toàn vẹn: Không phát hiện thay đổi trái phép!");
      } else {
        showToast("error", "Cảnh báo toàn vẹn: Phát hiện sai lệch chuỗi băm!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi kiểm tra toàn vẹn";
      showToast("error", msg);
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  // Thực hiện rollback về phiên bản chỉ định
  const handleConfirmRollback = async () => {
    if (!docId || !rollbackTarget) return;
    setSubmittingRollback(true);
    try {
      const res = await documentService.rollbackToVersion(docId, {
        targetVersion: rollbackTarget.versionNum,
        reason: rollbackReason.trim() || undefined,
        actorRole: rollbackRole,
      });

      showToast(
        "success",
        `Đã khôi phục về v${res.targetVersion}! Tạo phiên bản mới v${res.newVersion} bảo toàn chuỗi băm.`
      );

      setRollbackTarget(null);
      setRollbackReason("");
      // Tải lại dữ liệu
      await loadDocumentData(docId, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi thực hiện khôi phục phiên bản";
      showToast("error", msg);
    } finally {
      setSubmittingRollback(false);
    }
  };

  // Đồng bộ cuộn giữa 2 cột side-by-side
  const handleLeftScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || !rightGutterRef.current) return;
    rightGutterRef.current.scrollTop = e.currentTarget.scrollTop;
    rightGutterRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };

  const handleRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || !leftGutterRef.current) return;
    leftGutterRef.current.scrollTop = e.currentTarget.scrollTop;
    leftGutterRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };

  // Di chuyển đến diff chunk tiếp theo hoặc trước đó
  const handleJumpChunk = (direction: "next" | "prev") => {
    const total = diffResult.summary.totalChunks;
    if (total === 0) return;

    let nextIdx = activeChunkIdx;
    if (direction === "next") {
      nextIdx = (activeChunkIdx + 1) % total;
    } else {
      nextIdx = (activeChunkIdx - 1 + total) % total;
    }

    setActiveChunkIdx(nextIdx);

    // Tìm dòng tương ứng với chunk để cuộn tới
    const chunkNum = nextIdx + 1;
    const targetEl = chunkRowsRef.current.get(chunkNum);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* THANH ĐIỀU HƯỚNG VÀ THÔNG TIN TỔNG QUAN */}
        <div
          className="ld-card"
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          {/* Breadcrumb & Tiêu đề */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/tai-lieu-cua-toi"
              className="ld-btn ld-btn-ghost ld-btn-sm"
              style={{ padding: "6px 10px", color: "var(--color-text-secondary)" }}
              title="Quay lại danh sách tài liệu"
            >
              <ArrowLeft size={16} />
              <span>Danh sách</span>
            </Link>

            <span style={{ color: "var(--color-border)", fontSize: 18 }}>/</span>

            {/* Chọn tài liệu nhanh qua Select */}
            <div style={{ minWidth: 260 }}>
              <select
                value={docId || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setDocId(val);
                  router.push(`/tai-lieu-cua-toi/lich-su?docId=${val}`);
                }}
                className="ld-select"
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  padding: "6px 12px",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              >
                {allDocs.map((d) => (
                  <option key={d.docId} value={d.docId}>
                    📄 {d.title} (v{d.currentVersion})
                  </option>
                ))}
              </select>
            </div>

            {/* Metadata Tags */}
            {docDetail && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    background: "#f1f5f9",
                    color: "#334155",
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  Phiên bản hiện tại: v{docDetail.currentVersion}
                </span>

                {docDetail.targetPath && (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "#475569",
                      background: "#f8fafc",
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {docDetail.targetPath}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Các nút hành động chính */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Kiểm tra toàn vẹn chuỗi băm */}
            <button
              type="button"
              onClick={handleVerifyIntegrity}
              disabled={verifyingIntegrity}
              className="ld-btn ld-btn-secondary ld-btn-sm"
              style={{
                borderColor: integrityResult?.valid ? "#a7f3d0" : undefined,
                color: integrityResult?.valid ? "#047857" : undefined,
              }}
              title="Xác minh tính toàn vẹn chuỗi băm SHA-256 từ Genesis v1 đến vN"
            >
              <ShieldCheck size={14} />
              <span>{verifyingIntegrity ? "Đang xác minh..." : "Kiểm tra toàn vẹn Hash"}</span>
            </button>

            {/* Mở Split-View Editor */}
            {docId && (
              <Link
                href={`/tai-lieu-cua-toi/editor?docId=${docId}`}
                className="ld-btn ld-btn-primary ld-btn-sm"
                title="Mở trình soạn thảo Markdown Split-View để chỉnh sửa"
              >
                <Edit3 size={14} />
                <span>Soạn thảo văn bản</span>
              </Link>
            )}

            {/* Làm mới */}
            <button
              type="button"
              onClick={() => docId && loadDocumentData(docId, true)}
              disabled={refreshing}
              className="ld-btn ld-btn-ghost ld-btn-sm"
              title="Làm mới lịch sử phiên bản"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* TOAST THÔNG BÁO */}
        {toast && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: "var(--radius-base)",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background:
                toast.type === "success"
                  ? "#ecfdf5"
                  : toast.type === "error"
                  ? "#fef2f2"
                  : "#eff6ff",
              color:
                toast.type === "success"
                  ? "#065f46"
                  : toast.type === "error"
                  ? "#991b1b"
                  : "#1e40af",
              border: `1px solid ${
                toast.type === "success"
                  ? "#a7f3d0"
                  : toast.type === "error"
                  ? "#fecaca"
                  : "#bfdbfe"
              }`,
            }}
          >
            {toast.type === "success" && <CheckCircle2 size={16} />}
            {toast.type === "error" && <AlertTriangle size={16} />}
            {toast.type === "info" && <Sparkles size={16} />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* BẢNG KẾT QUẢ KIỂM TRA TOÀN VẸN (NẾU ĐÃ CHẠY) */}
        {integrityResult && (
          <div
            className="ld-card"
            style={{
              padding: "14px 18px",
              background: integrityResult.valid ? "#f0fdf4" : "#fef2f2",
              borderColor: integrityResult.valid ? "#bbf7d0" : "#fecaca",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {integrityResult.valid ? (
                <ShieldCheck size={22} style={{ color: "#16a34a", flexShrink: 0 }} />
              ) : (
                <ShieldAlert size={22} style={{ color: "#dc2626", flexShrink: 0 }} />
              )}
              <div>
                <h4
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: integrityResult.valid ? "#166534" : "#991b1b",
                    margin: 0,
                  }}
                >
                  {integrityResult.valid
                    ? "✓ Chuỗi băm SHA-256 hoàn toàn hợp lệ (Anti-Tamper Passed)"
                    : "✕ Cảnh báo: Phát hiện sai lệch chuỗi băm (Anti-Tamper Failed)"}
                </h4>
                <p
                  style={{
                    fontSize: 12,
                    color: integrityResult.valid ? "#15803d" : "#b91c1c",
                    margin: "2px 0 0",
                  }}
                >
                  {integrityResult.message} ({integrityResult.totalVersions} phiên bản được kiểm định)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIntegrityResult(null)}
              className="ld-btn ld-btn-ghost ld-btn-sm"
              style={{ color: "#64748b" }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* BỐ CỤC CHÍNH: 2 CỘT (TIMELINE BÊN TRÁI & KHUNG SO SÁNH DIFF BÊN PHẢI) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* CỘT TRÁI: TIMELINE LỊCH SỬ PHIÊN BẢN */}
          <div
            className="ld-card"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              maxHeight: "calc(100vh - 210px)",
              overflowY: "auto",
              position: "sticky",
              top: 16,
            }}
          >
            {/* Header Timeline */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 10,
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={16} style={{ color: "var(--color-accent)" }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Lịch sử phiên bản</h3>
                <span
                  style={{
                    fontSize: 11,
                    background: "var(--color-accent-subtle)",
                    color: "var(--color-accent-dark)",
                    padding: "2px 6px",
                    borderRadius: 9999,
                    fontWeight: 600,
                  }}
                >
                  {versions.length}
                </span>
              </div>

              {/* Đảo thứ tự */}
              <button
                type="button"
                onClick={() => setTimelineOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                className="ld-btn ld-btn-ghost ld-btn-sm"
                style={{ fontSize: 11, padding: "4px 8px" }}
                title="Đảo thứ tự hiển thị phiên bản"
              >
                {timelineOrder === "desc" ? "Mới nhất trước ↓" : "Cũ nhất trước ↑"}
              </button>
            </div>

            {/* Hướng dẫn chọn bản A và B */}
            <div
              style={{
                padding: "8px 12px",
                background: "#f8fafc",
                borderRadius: 6,
                fontSize: 12,
                color: "#64748b",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Đang so sánh:</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>
                  <span style={{ color: "#dc2626" }}>v{versionAId ?? "?"} (Gốc A)</span> ➔{" "}
                  <span style={{ color: "#16a34a" }}>v{versionBId ?? "?"} (Mới B)</span>
                </span>
              </div>
            </div>

            {/* Danh sách các nút Timeline */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    border: "2px solid #b8dec5",
                    borderTopColor: "#087f5b",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 8px",
                  }}
                />
                <span style={{ fontSize: 12 }}>Đang tải lịch sử phiên bản...</span>
              </div>
            ) : versions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#94a3b8" }}>
                <FileText size={32} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12 }}>Tài liệu này chưa có bản ghi phiên bản nào.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
                {displayTimelineVersions.map((ver) => {
                  const isLatest = docDetail?.currentVersion === ver.versionNum;
                  const isA = versionAId === ver.versionNum;
                  const isB = versionBId === ver.versionNum;
                  const actorMeta = ACTOR_CONFIG[ver.actorRole] || ACTOR_CONFIG.DEV;
                  const triggerText = TRIGGER_LABELS[ver.triggerType] || ver.triggerType;

                  return (
                    <div
                      key={ver.versionId}
                      style={{
                        position: "relative",
                        padding: "12px 14px",
                        borderRadius: 8,
                        background:
                          isA && isB
                            ? "#fefce8"
                            : isA
                            ? "#fef2f2"
                            : isB
                            ? "#f0fdf4"
                            : "var(--color-surface)",
                        border:
                          isA && isB
                            ? "1.5px solid #facc15"
                            : isA
                            ? "1.5px solid #f87171"
                            : isB
                            ? "1.5px solid #4ade80"
                            : "1px solid var(--color-border)",
                        boxShadow: isA || isB ? "0 2px 6px rgba(0,0,0,0.04)" : "none",
                        transition: "all 150ms ease",
                      }}
                    >
                      {/* Dòng 1: Version tag, Actor role, Latest badge */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              color: "#0f172a",
                            }}
                          >
                            v{ver.versionNum}
                          </span>

                          {isLatest && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                background: "#dcfce7",
                                color: "#15803d",
                                border: "1px solid #bbf7d0",
                                padding: "1px 6px",
                                borderRadius: 9999,
                              }}
                            >
                              Mới nhất
                            </span>
                          )}

                          {/* Huy hiệu vai trò tác nhân */}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              background: actorMeta.bg,
                              color: actorMeta.color,
                              border: `1px solid ${actorMeta.border}`,
                              padding: "1px 6px",
                              borderRadius: 4,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            {actorMeta.icon}
                            {actorMeta.label}
                          </span>
                        </div>

                        {/* Thời gian tạo */}
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {new Date(ver.createdAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Dòng 2: Loại kích hoạt & Chi tiết chuỗi băm */}
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                        <span style={{ fontWeight: 500 }}>{triggerText}</span>
                      </div>

                      {/* Dòng 3: Hash SHA-256 (Anti-tamper Hash Chain) */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          background: "#f8fafc",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: "#475569",
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                          <Hash size={11} style={{ color: "#94a3b8", flexShrink: 0 }} />
                          <span
                            title={`Mã băm hoàn chỉnh: ${ver.hash}\nPrev Hash: ${ver.prevHash}`}
                            style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}
                          >
                            {ver.hash ? `${ver.hash.substring(0, 12)}...` : "Genesis"}
                          </span>
                        </div>

                        {ver.hash && (
                          <button
                            type="button"
                            onClick={() => handleCopyHash(ver.hash)}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: 2,
                              color: copiedHash === ver.hash ? "#16a34a" : "#64748b",
                            }}
                            title="Sao chép toàn bộ mã băm SHA-256"
                          >
                            {copiedHash === ver.hash ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>

                      {/* Dòng 4: Các nút chọn Bản A, Bản B và Hành động */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Nhóm chọn A / B */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setVersionAId(ver.versionNum);
                              setActiveChunkIdx(0);
                            }}
                            style={{
                              padding: "3px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 4,
                              cursor: "pointer",
                              border: isA ? "1px solid #dc2626" : "1px solid #e2e8f0",
                              background: isA ? "#dc2626" : "#ffffff",
                              color: isA ? "#ffffff" : "#64748b",
                              transition: "all 120ms ease",
                            }}
                            title="Đặt làm Bản gốc A (bên trái)"
                          >
                            {isA ? "✓ Bản A" : "Đặt A"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setVersionBId(ver.versionNum);
                              setActiveChunkIdx(0);
                            }}
                            style={{
                              padding: "3px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 4,
                              cursor: "pointer",
                              border: isB ? "1px solid #16a34a" : "1px solid #e2e8f0",
                              background: isB ? "#16a34a" : "#ffffff",
                              color: isB ? "#ffffff" : "#64748b",
                              transition: "all 120ms ease",
                            }}
                            title="Đặt làm Bản so sánh B (bên phải)"
                          >
                            {isB ? "✓ Bản B" : "Đặt B"}
                          </button>
                        </div>

                        {/* Nhóm hành động phụ: Xem & Rollback */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {/* So sánh với bản trước */}
                          {ver.versionNum > 1 && (
                            <button
                              type="button"
                              onClick={() => handleCompareWithPrevious(ver)}
                              className="ld-btn ld-btn-ghost ld-btn-sm"
                              style={{ padding: "3px 6px", fontSize: 11 }}
                              title={`So sánh nhanh v${ver.versionNum - 1} ➔ v${ver.versionNum}`}
                            >
                              <ArrowRightLeft size={11} />
                              <span>v{ver.versionNum - 1}</span>
                            </button>
                          )}

                          {/* Xem trước nội dung */}
                          <button
                            type="button"
                            onClick={() => setPreviewVersion(ver)}
                            className="ld-btn ld-btn-ghost ld-btn-sm"
                            style={{ padding: "3px 6px", fontSize: 11 }}
                            title="Xem trước nội dung văn bản này"
                          >
                            <Eye size={12} />
                          </button>

                          {/* Khôi phục (Rollback) */}
                          <button
                            type="button"
                            onClick={() => {
                              setRollbackTarget(ver);
                              setRollbackReason(`Khôi phục về nội dung của phiên bản v${ver.versionNum}`);
                            }}
                            className="ld-btn ld-btn-ghost ld-btn-sm"
                            style={{ padding: "3px 6px", fontSize: 11, color: "#087f5b" }}
                            title={`Khôi phục tài liệu về phiên bản v${ver.versionNum}`}
                          >
                            <RotateCcw size={11} />
                            <span>Khôi phục</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CỘT PHẢI: MÀN HÌNH SO SÁNH DIFF SONG SONG (SIDE-BY-SIDE & INLINE) */}
          <div
            className="ld-card"
            style={{
              padding: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* THANH ĐIỀU KHIỂN DIFF (DIFF TOOLBAR) */}
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--color-border)",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {/* Cụm chọn Version A & Version B */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {/* Chọn Bản A */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#dc2626",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    Bản A (Gốc)
                  </span>
                  <select
                    value={versionAId ?? ""}
                    onChange={(e) => {
                      setVersionAId(parseInt(e.target.value, 10));
                      setActiveChunkIdx(0);
                    }}
                    className="ld-select"
                    style={{ padding: "4px 8px", fontSize: 12, minWidth: 120 }}
                  >
                    {versions.map((v) => (
                      <option key={`opt-a-${v.versionNum}`} value={v.versionNum}>
                        v{v.versionNum} ({v.actorRole})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nút Hoán đổi ⇄ */}
                <button
                  type="button"
                  onClick={handleSwapVersions}
                  className="ld-btn ld-btn-ghost ld-btn-sm"
                  style={{ padding: "4px 8px" }}
                  title="Hoán đổi Bản A và Bản B"
                >
                  <ArrowRightLeft size={14} />
                </button>

                {/* Chọn Bản B */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#16a34a",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    Bản B (Mới)
                  </span>
                  <select
                    value={versionBId ?? ""}
                    onChange={(e) => {
                      setVersionBId(parseInt(e.target.value, 10));
                      setActiveChunkIdx(0);
                    }}
                    className="ld-select"
                    style={{ padding: "4px 8px", fontSize: 12, minWidth: 120 }}
                  >
                    {versions.map((v) => (
                      <option key={`opt-b-${v.versionNum}`} value={v.versionNum}>
                        v{v.versionNum} ({v.actorRole})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chế độ hiển thị: Song song (Side-by-side) vs Hợp nhất (Inline) */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    display: "inline-flex",
                    background: "#e2e8f0",
                    padding: 2,
                    borderRadius: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDiffViewMode("side-by-side")}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: diffViewMode === "side-by-side" ? "#ffffff" : "transparent",
                      color: diffViewMode === "side-by-side" ? "#0f172a" : "#64748b",
                      boxShadow: diffViewMode === "side-by-side" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    <Columns size={13} />
                    <span>Song song</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiffViewMode("inline")}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: diffViewMode === "inline" ? "#ffffff" : "transparent",
                      color: diffViewMode === "inline" ? "#0f172a" : "#64748b",
                      boxShadow: diffViewMode === "inline" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    <List size={13} />
                    <span>Hợp nhất</span>
                  </button>
                </div>

                {/* Tùy chọn Đồng bộ cuộn */}
                {diffViewMode === "side-by-side" && (
                  <button
                    type="button"
                    onClick={() => setSyncScroll((prev) => !prev)}
                    className="ld-btn ld-btn-ghost ld-btn-sm"
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      color: syncScroll ? "var(--color-accent)" : "#64748b",
                      fontWeight: syncScroll ? 600 : 400,
                    }}
                    title="Bật/tắt đồng bộ cuộn giữa 2 cột song song"
                  >
                    {syncScroll ? "✓ Đồng bộ cuộn" : "Cuộn độc lập"}
                  </button>
                )}

                {/* Tùy chọn Khoảng trắng */}
                <button
                  type="button"
                  onClick={() => setShowWhitespace((prev) => !prev)}
                  className="ld-btn ld-btn-ghost ld-btn-sm"
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    color: showWhitespace ? "var(--color-accent)" : "#64748b",
                    fontWeight: showWhitespace ? 600 : 400,
                  }}
                  title="Bật/tắt hiển thị ký hiệu khoảng trắng"
                >
                  {showWhitespace ? "✓ Hiện khoảng trắng" : "Khoảng trắng"}
                </button>
              </div>
            </div>

            {/* DÒNG THỐNG KÊ DIFF VÀ ĐIỀU HƯỚNG CHUNK */}
            <div
              style={{
                padding: "8px 18px",
                borderBottom: "1px solid var(--color-border)",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {/* Thống kê thay đổi */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#16a34a",
                    fontWeight: 600,
                  }}
                >
                  +{diffResult.summary.addedCount} dòng thêm
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#dc2626",
                    fontWeight: 600,
                  }}
                >
                  -{diffResult.summary.removedCount} dòng xóa
                </span>
                {diffResult.summary.modifiedCount > 0 && (
                  <span style={{ color: "#d97706", fontWeight: 600 }}>
                    ~{diffResult.summary.modifiedCount} dòng sửa đổi
                  </span>
                )}
                <span style={{ color: "#94a3b8" }}>•</span>
                <span style={{ color: "#64748b" }}>
                  {diffResult.summary.totalChunks} khối thay đổi (chunks)
                </span>
              </div>

              {/* Điều hướng nhảy giữa các khối chênh lệch */}
              {diffResult.summary.totalChunks > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleJumpChunk("prev")}
                    className="ld-btn ld-btn-ghost ld-btn-sm"
                    style={{ padding: "2px 8px", fontSize: 11 }}
                    title="Nhảy đến khối thay đổi trước"
                  >
                    <ChevronLeft size={13} />
                    <span>Khối trước</span>
                  </button>

                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#475569",
                      padding: "2px 8px",
                      background: "#f1f5f9",
                      borderRadius: 4,
                    }}
                  >
                    {activeChunkIdx + 1} / {diffResult.summary.totalChunks}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleJumpChunk("next")}
                    className="ld-btn ld-btn-ghost ld-btn-sm"
                    style={{ padding: "2px 8px", fontSize: 11 }}
                    title="Nhảy đến khối thay đổi tiếp theo"
                  >
                    <span>Khối tiếp theo</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* VÙNG HIỂN THỊ DIFF */}
            {diffResult.summary.isIdentical ? (
              /* Trường hợp 2 phiên bản giống hệt nhau */
              <div
                style={{
                  padding: "80px 20px",
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                <CheckCircle2
                  size={48}
                  style={{ color: "#16a34a", margin: "0 auto 12px", opacity: 0.9 }}
                />
                <h4 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
                  Hai phiên bản hoàn toàn giống nhau!
                </h4>
                <p style={{ fontSize: 13, maxWidth: 460, margin: "0 auto", color: "#64748b" }}>
                  Không có sự khác biệt nào giữa phiên bản <strong>v{versionAId}</strong> và{" "}
                  <strong>v{versionBId}</strong>. Bạn có thể chọn phiên bản khác ở thanh trên để so sánh.
                </p>
              </div>
            ) : diffViewMode === "side-by-side" ? (
              /* CHẾ ĐỘ DIFF SONG SONG (SIDE-BY-SIDE) */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  minHeight: 520,
                  maxHeight: "calc(100vh - 290px)",
                  overflow: "hidden",
                }}
              >
                {/* CỘT BÊN TRÁI: PHIÊN BẢN A (BẢN GỐC) */}
                <div
                  ref={leftGutterRef}
                  onScroll={handleLeftScroll}
                  style={{
                    overflowY: "auto",
                    overflowX: "auto",
                    borderRight: "1px solid var(--color-border)",
                    background: "#ffffff",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    lineHeight: "20px",
                  }}
                >
                  {/* Header Cột A */}
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                      padding: "6px 12px",
                      background: "#fef2f2",
                      borderBottom: "1px solid #fecaca",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#991b1b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      v{versionAId} • {versionA?.actorRole} • {versionA ? new Date(versionA.createdAt).toLocaleDateString("vi-VN") : ""}
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.8 }}>Bản gốc (Trước)</span>
                  </div>

                  {/* Các dòng Diff A */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {diffResult.sideBySideRows.map((row) => {
                      const isChunkStart = row.chunkIndex !== undefined && row.chunkIndex === activeChunkIdx + 1;
                      const cell = row.left;

                      let rowBg = "transparent";
                      let textColor = "#334155";
                      let marker = " ";

                      if (cell.type === "removed") {
                        rowBg = "#fef2f2";
                        textColor = "#991b1b";
                        marker = "-";
                      } else if (cell.type === "empty") {
                        rowBg = "#f8fafc";
                        textColor = "#94a3b8";
                      }

                      return (
                        <div
                          key={`left-${row.id}`}
                          ref={(el) => {
                            if (el && row.chunkIndex) {
                              chunkRowsRef.current.set(row.chunkIndex, el);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "stretch",
                            background: rowBg,
                            borderLeft: cell.type === "removed" ? "3px solid #ef4444" : "3px solid transparent",
                            minHeight: 22,
                            outline: isChunkStart ? "1.5px dashed #f87171" : "none",
                          }}
                        >
                          {/* Số dòng */}
                          <div
                            style={{
                              width: 44,
                              padding: "1px 8px",
                              textAlign: "right",
                              color: cell.type === "removed" ? "#dc2626" : "#94a3b8",
                              background: cell.type === "removed" ? "#fee2e2" : "#f8fafc",
                              borderRight: "1px solid var(--color-border)",
                              userSelect: "none",
                              flexShrink: 0,
                            }}
                          >
                            {cell.lineNum ?? ""}
                          </div>

                          {/* Ký hiệu marker +/- */}
                          <div
                            style={{
                              width: 18,
                              textAlign: "center",
                              color: cell.type === "removed" ? "#dc2626" : "transparent",
                              userSelect: "none",
                              flexShrink: 0,
                              fontWeight: 700,
                            }}
                          >
                            {marker}
                          </div>

                          {/* Nội dung dòng */}
                          <div
                            style={{
                              flex: 1,
                              padding: "1px 8px",
                              color: textColor,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                            }}
                          >
                            {cell.type === "empty" ? (
                              <span style={{ color: "#cbd5e1" }}>&nbsp;</span>
                            ) : cell.wordTokens ? (
                              cell.wordTokens.map((token, tIdx) => (
                                <span
                                  key={`t-l-${tIdx}`}
                                  style={{
                                    background: token.type === "removed" ? "#fecaca" : "transparent",
                                    borderRadius: token.type === "removed" ? 2 : 0,
                                    padding: token.type === "removed" ? "0 2px" : 0,
                                    fontWeight: token.type === "removed" ? 600 : 400,
                                  }}
                                >
                                  {token.text}
                                </span>
                              ))
                            ) : (
                              cell.content || " "
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CỘT BÊN PHẢI: PHIÊN BẢN B (BẢN MỚI) */}
                <div
                  ref={rightGutterRef}
                  onScroll={handleRightScroll}
                  style={{
                    overflowY: "auto",
                    overflowX: "auto",
                    background: "#ffffff",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    lineHeight: "20px",
                  }}
                >
                  {/* Header Cột B */}
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                      padding: "6px 12px",
                      background: "#f0fdf4",
                      borderBottom: "1px solid #bbf7d0",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#166534",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      v{versionBId} • {versionB?.actorRole} • {versionB ? new Date(versionB.createdAt).toLocaleDateString("vi-VN") : ""}
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.8 }}>Bản so sánh (Sau)</span>
                  </div>

                  {/* Các dòng Diff B */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {diffResult.sideBySideRows.map((row) => {
                      const isChunkStart = row.chunkIndex !== undefined && row.chunkIndex === activeChunkIdx + 1;
                      const cell = row.right;

                      let rowBg = "transparent";
                      let textColor = "#334155";
                      let marker = " ";

                      if (cell.type === "added") {
                        rowBg = "#f0fdf4";
                        textColor = "#166534";
                        marker = "+";
                      } else if (cell.type === "empty") {
                        rowBg = "#f8fafc";
                        textColor = "#94a3b8";
                      }

                      return (
                        <div
                          key={`right-${row.id}`}
                          style={{
                            display: "flex",
                            alignItems: "stretch",
                            background: rowBg,
                            borderLeft: cell.type === "added" ? "3px solid #22c55e" : "3px solid transparent",
                            minHeight: 22,
                            outline: isChunkStart ? "1.5px dashed #4ade80" : "none",
                          }}
                        >
                          {/* Số dòng */}
                          <div
                            style={{
                              width: 44,
                              padding: "1px 8px",
                              textAlign: "right",
                              color: cell.type === "added" ? "#16a34a" : "#94a3b8",
                              background: cell.type === "added" ? "#dcfce7" : "#f8fafc",
                              borderRight: "1px solid var(--color-border)",
                              userSelect: "none",
                              flexShrink: 0,
                            }}
                          >
                            {cell.lineNum ?? ""}
                          </div>

                          {/* Ký hiệu marker +/- */}
                          <div
                            style={{
                              width: 18,
                              textAlign: "center",
                              color: cell.type === "added" ? "#16a34a" : "transparent",
                              userSelect: "none",
                              flexShrink: 0,
                              fontWeight: 700,
                            }}
                          >
                            {marker}
                          </div>

                          {/* Nội dung dòng */}
                          <div
                            style={{
                              flex: 1,
                              padding: "1px 8px",
                              color: textColor,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                            }}
                          >
                            {cell.type === "empty" ? (
                              <span style={{ color: "#cbd5e1" }}>&nbsp;</span>
                            ) : cell.wordTokens ? (
                              cell.wordTokens.map((token, tIdx) => (
                                <span
                                  key={`t-r-${tIdx}`}
                                  style={{
                                    background: token.type === "added" ? "#bbf7d0" : "transparent",
                                    borderRadius: token.type === "added" ? 2 : 0,
                                    padding: token.type === "added" ? "0 2px" : 0,
                                    fontWeight: token.type === "added" ? 600 : 400,
                                  }}
                                >
                                  {token.text}
                                </span>
                              ))
                            ) : (
                              cell.content || " "
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* CHẾ ĐỘ DIFF HỢP NHẤT (INLINE) */
              <div
                style={{
                  overflowY: "auto",
                  maxHeight: "calc(100vh - 290px)",
                  background: "#ffffff",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: "20px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {diffResult.inlineRows.map((row) => {
                    const isChunkStart = row.chunkIndex !== undefined && row.chunkIndex === activeChunkIdx + 1;

                    let rowBg = "transparent";
                    let textColor = "#334155";
                    let marker = " ";
                    let borderLeft = "3px solid transparent";

                    if (row.type === "removed") {
                      rowBg = "#fef2f2";
                      textColor = "#991b1b";
                      marker = "-";
                      borderLeft = "3px solid #ef4444";
                    } else if (row.type === "added") {
                      rowBg = "#f0fdf4";
                      textColor = "#166534";
                      marker = "+";
                      borderLeft = "3px solid #22c55e";
                    }

                    return (
                      <div
                        key={row.id}
                        ref={(el) => {
                          if (el && row.chunkIndex) {
                            chunkRowsRef.current.set(row.chunkIndex, el);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "stretch",
                          background: rowBg,
                          borderLeft,
                          minHeight: 22,
                          outline: isChunkStart
                            ? row.type === "removed"
                              ? "1.5px dashed #f87171"
                              : "1.5px dashed #4ade80"
                            : "none",
                        }}
                      >
                        {/* Số dòng cũ */}
                        <div
                          style={{
                            width: 44,
                            padding: "1px 8px",
                            textAlign: "right",
                            color: row.type === "removed" ? "#dc2626" : "#94a3b8",
                            background: row.type === "removed" ? "#fee2e2" : "#f8fafc",
                            borderRight: "1px solid var(--color-border)",
                            userSelect: "none",
                            flexShrink: 0,
                          }}
                        >
                          {row.oldLineNum ?? ""}
                        </div>

                        {/* Số dòng mới */}
                        <div
                          style={{
                            width: 44,
                            padding: "1px 8px",
                            textAlign: "right",
                            color: row.type === "added" ? "#16a34a" : "#94a3b8",
                            background: row.type === "added" ? "#dcfce7" : "#f8fafc",
                            borderRight: "1px solid var(--color-border)",
                            userSelect: "none",
                            flexShrink: 0,
                          }}
                        >
                          {row.newLineNum ?? ""}
                        </div>

                        {/* Ký hiệu marker +/- */}
                        <div
                          style={{
                            width: 20,
                            textAlign: "center",
                            color:
                              row.type === "removed"
                                ? "#dc2626"
                                : row.type === "added"
                                ? "#16a34a"
                                : "transparent",
                            userSelect: "none",
                            flexShrink: 0,
                            fontWeight: 700,
                          }}
                        >
                          {marker}
                        </div>

                        {/* Nội dung dòng */}
                        <div
                          style={{
                            flex: 1,
                            padding: "1px 8px",
                            color: textColor,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                          }}
                        >
                          {row.wordTokens ? (
                            row.wordTokens.map((token, tIdx) => (
                              <span
                                key={`inl-t-${tIdx}`}
                                style={{
                                  background:
                                    token.type === "removed"
                                      ? "#fecaca"
                                      : token.type === "added"
                                      ? "#bbf7d0"
                                      : "transparent",
                                  borderRadius: token.type !== "unchanged" ? 2 : 0,
                                  padding: token.type !== "unchanged" ? "0 2px" : 0,
                                  fontWeight: token.type !== "unchanged" ? 600 : 400,
                                }}
                              >
                                {token.text}
                              </span>
                            ))
                          ) : (
                            row.content || " "
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL KHÔI PHỤC PHIÊN BẢN (ROLLBACK CONFIRMATION) */}
        {rollbackTarget && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(3px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 20,
            }}
          >
            <div
              className="ld-card"
              style={{
                width: "100%",
                maxWidth: 520,
                padding: 24,
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#ecfdf5",
                    color: "#087f5b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                    Khôi phục về Phiên bản v{rollbackTarget.versionNum}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
                    Bảo toàn toàn vẹn lịch sử bằng chuỗi băm bất biến (Immutable Hash Chain)
                  </p>
                </div>
              </div>

              {/* Giải thích cơ chế bảo toàn chuỗi băm */}
              <div
                style={{
                  padding: 12,
                  background: "#f0fdf4",
                  borderRadius: 6,
                  border: "1px solid #bbf7d0",
                  fontSize: 12,
                  color: "#166534",
                  lineHeight: 1.6,
                  marginBottom: 16,
                }}
              >
                <strong>💡 Cơ chế hoạt động:</strong> Hệ thống LivingDocs không xóa hay ghi đè các phiên bản đã tạo. Khi thực hiện khôi phục, hệ thống sẽ tự động tạo một phiên bản mới{" "}
                <strong>v{(docDetail?.currentVersion || 0) + 1}</strong> kế thừa chuỗi băm SHA-256 từ phiên bản hiện tại, mang toàn bộ nội dung của phiên bản mục tiêu{" "}
                <strong>v{rollbackTarget.versionNum}</strong>.
              </div>

              {/* Form nhập lý do */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Lý do khôi phục (Tùy chọn ghi vào Audit Log)
                  </label>
                  <input
                    type="text"
                    value={rollbackReason}
                    onChange={(e) => setRollbackReason(e.target.value)}
                    placeholder="Ví dụ: Hoàn tác các đoạn mã lỗi, phục hồi tài liệu chuẩn..."
                    className="ld-input"
                    style={{ width: "100%", fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Vai trò thực hiện
                  </label>
                  <select
                    value={rollbackRole}
                    onChange={(e) => setRollbackRole(e.target.value)}
                    className="ld-select"
                    style={{ width: "100%", fontSize: 13 }}
                  >
                    <option value="DEV">Lập trình viên (Developer)</option>
                    <option value="STAFF">Chuyên viên kiểm duyệt (Staff Reviewer)</option>
                    <option value="MANAGER">Quản trị viên (Manager)</option>
                  </select>
                </div>
              </div>

              {/* Nút hành động modal */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRollbackTarget(null)}
                  disabled={submittingRollback}
                  className="ld-btn ld-btn-ghost ld-btn-sm"
                >
                  Hủy bỏ
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRollback}
                  disabled={submittingRollback}
                  className="ld-btn ld-btn-primary ld-btn-sm"
                >
                  <RotateCcw size={14} className={submittingRollback ? "animate-spin" : ""} />
                  <span>{submittingRollback ? "Đang khôi phục..." : "Xác nhận Khôi phục"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL XEM TRƯỚC TOÀN BỘ NỘI DUNG PHIÊN BẢN (PREVIEW DRAWER) */}
        {previewVersion && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(3px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 24,
            }}
          >
            <div
              className="ld-card"
              style={{
                width: "100%",
                maxWidth: 840,
                maxHeight: "85vh",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Header Drawer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 12,
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    Nội dung phiên bản v{previewVersion.versionNum}
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                    Tạo lúc {new Date(previewVersion.createdAt).toLocaleString("vi-VN")} bởi{" "}
                    <strong>{previewVersion.actorRole}</strong>
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setVersionAId(previewVersion.versionNum);
                      showToast("info", `Đã đặt v${previewVersion.versionNum} làm Bản gốc A`);
                    }}
                    className="ld-btn ld-btn-secondary ld-btn-sm"
                  >
                    Đặt làm Bản A
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVersionBId(previewVersion.versionNum);
                      showToast("info", `Đã đặt v${previewVersion.versionNum} làm Bản so sánh B`);
                    }}
                    className="ld-btn ld-btn-secondary ld-btn-sm"
                  >
                    Đặt làm Bản B
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewVersion(null)}
                    className="ld-btn ld-btn-ghost ld-btn-sm"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Khung hiển thị nội dung Markdown */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 16,
                  background: "#f8fafc",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                }}
              >
                <MarkdownViewer content={previewVersion.content || "*(Nội dung trống)*"} />
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setPreviewVersion(null)}
                  className="ld-btn ld-btn-primary ld-btn-sm"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function VersionHistoryDiffPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
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
            <p style={{ fontSize: 13 }}>Đang khởi tạo màn hình so sánh Diff...</p>
          </div>
        </AppShell>
      }
    >
      <VersionHistoryDiffContent />
    </Suspense>
  );
}
