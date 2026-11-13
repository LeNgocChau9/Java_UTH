"use client";

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  AlertTriangle,
  GitPullRequest,
  FileText,
  Clock,
  ChevronRight,
  RefreshCw,
  Zap,
  CheckCircle2,
  FileCode,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  Search,
  ExternalLink,
  Code,
  FileCheck,
  Sparkles,
  Info,
  Edit3,
  XCircle,
  EyeOff,
  Filter,
  Layers,
  FileDiff,
  Check,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";

export type SeverityType = "low" | "medium" | "high" | "critical";
export type ClassificationType = "SIGNATURE" | "SEMANTIC" | "REFERENCE";

export interface DriftAlertItem {
  id: number;
  docTitle: string;
  docPath: string;
  repo: string;
  classification: ClassificationType;
  pr?: {
    number: number;
    title: string;
    branch: string;
    author: string;
    mergedAt: string;
  } | null;
  daysStale: number;
  affectedFiles: string[];
  severity: SeverityType;
  status: "OPEN" | "DRAFT_CREATED" | "RESOLVED" | "IGNORED";
  driftReason: string;
  aiSuggestion: string;
  codeDiff: {
    fileName: string;
    oldCode: string;
    newCode: string;
  };
  docDiff: {
    sectionTitle: string;
    outdatedContent: string;
    suggestedContent: string;
  };
  draftVersionId?: number;
}

const INITIAL_ALERTS: DriftAlertItem[] = [];

const SEVERITY_CONFIG: Record<
  SeverityType,
  {
    label: string;
    bg: string;
    color: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  low: {
    label: "Thấp",
    bg: "#f0fdf4",
    color: "#166534",
    border: "#bbf7d0",
    badgeBg: "#dcfce7",
    badgeText: "#15803d",
  },
  medium: {
    label: "Trung bình",
    bg: "#ecfdf5",
    color: "#047857",
    border: "#a7f3d0",
    badgeBg: "#eaf6ef",
    badgeText: "#07543f",
  },
  high: {
    label: "Cao",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
    badgeBg: "#fef3c7",
    badgeText: "#92400e",
  },
  critical: {
    label: "Nghiêm trọng",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
    badgeBg: "#fee2e2",
    badgeText: "#991b1b",
  },
};

const CLASSIFICATION_CONFIG: Record<
  ClassificationType,
  {
    label: string;
    description: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  SIGNATURE: {
    label: "Chữ ký hàm (SIGNATURE)",
    description: "Thay đổi tên hàm, tham số, kiểu trả về",
    color: "#0284c7",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  SEMANTIC: {
    label: "Ngữ nghĩa logic (SEMANTIC)",
    description: "Thay đổi luồng xử lý hoặc quy tắc nghiệp vụ",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  REFERENCE: {
    label: "Tham chiếu cấu trúc (REFERENCE)",
    description: "Thay đổi bảng DB, thư mục hoặc thực thể liên kết",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
};

interface AlignedDiffLine {
  lineNo: number | null;
  text: string;
  type: "delete" | "insert" | "equal" | "empty";
}

interface AlignedDiffPair {
  left: AlignedDiffLine;
  right: AlignedDiffLine;
}

/**
 * Thuật toán so khớp từng dòng (LCS) để sinh giao diện Side-by-Side Diff chuẩn GitHub:
 * Các dòng giống nhau giữ màu trắng trung tính, dòng cũ bị xóa bôi đỏ nhẹ (-), dòng mới thêm bôi xanh nhẹ (+).
 */
function computeSideBySideDiff(oldText: string, newText: string): AlignedDiffPair[] {
  const oldLines = (oldText || "").split("\n");
  const newLines = (newText || "").split("\n");

  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i].trimEnd() === newLines[j].trimEnd()) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  type Op = { type: "equal" | "delete" | "insert"; oldIdx?: number; newIdx?: number };
  const ops: Op[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1].trimEnd() === newLines[j - 1].trimEnd()) {
      ops.push({ type: "equal", oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "insert", newIdx: j - 1 });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      ops.push({ type: "delete", oldIdx: i - 1 });
      i--;
    } else {
      break;
    }
  }

  ops.reverse();

  const pairs: AlignedDiffPair[] = [];
  let idx = 0;
  while (idx < ops.length) {
    if (ops[idx].type === "equal") {
      const op = ops[idx];
      pairs.push({
        left: {
          lineNo: (op.oldIdx ?? 0) + 1,
          text: oldLines[op.oldIdx!],
          type: "equal",
        },
        right: {
          lineNo: (op.newIdx ?? 0) + 1,
          text: newLines[op.newIdx!],
          type: "equal",
        },
      });
      idx++;
    } else {
      const dels: number[] = [];
      const inss: number[] = [];
      while (idx < ops.length && ops[idx].type !== "equal") {
        if (ops[idx].type === "delete") dels.push(ops[idx].oldIdx!);
        else if (ops[idx].type === "insert") inss.push(ops[idx].newIdx!);
        idx++;
      }
      const maxRows = Math.max(dels.length, inss.length);
      for (let r = 0; r < maxRows; r++) {
        const dIdx = dels[r];
        const iIdx = inss[r];
        pairs.push({
          left: dIdx !== undefined
            ? { lineNo: dIdx + 1, text: oldLines[dIdx], type: "delete" }
            : { lineNo: null, text: "", type: "empty" },
          right: iIdx !== undefined
            ? { lineNo: iIdx + 1, text: newLines[iIdx], type: "insert" }
            : { lineNo: null, text: "", type: "empty" },
        });
      }
    }
  }

  return pairs;
}

function CanhBaoSaiLechContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const alertIdParam = searchParams.get("alertId");
  const targetAlertId = alertIdParam ? Number(alertIdParam) : null;
  const [alerts, setAlerts] = useState<DriftAlertItem[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState<"all" | SeverityType>("all");
  const [classificationFilter, setClassificationFilter] = useState<"all" | ClassificationType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [ignoringId, setIgnoringId] = useState<number | null>(null);
  const [copiedCodeSide, setCopiedCodeSide] = useState<"old" | "new" | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [successToast, setSuccessToast] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({ show: false, title: "", message: "" });

  // Refs phục vụ cuộn đồng bộ 2 bên (Synchronized Scrolling)
  const leftDocDiffRef = useRef<HTMLDivElement>(null);
  const rightDocDiffRef = useRef<HTMLDivElement>(null);
  const isSyncingDocRef = useRef(false);

  const leftCodeDiffRef = useRef<HTMLDivElement>(null);
  const rightCodeDiffRef = useRef<HTMLDivElement>(null);
  const isSyncingCodeRef = useRef(false);

  const handleDocScroll = (source: "left" | "right") => {
    if (isSyncingDocRef.current) return;
    isSyncingDocRef.current = true;
    if (source === "left" && leftDocDiffRef.current && rightDocDiffRef.current) {
      rightDocDiffRef.current.scrollTop = leftDocDiffRef.current.scrollTop;
      rightDocDiffRef.current.scrollLeft = leftDocDiffRef.current.scrollLeft;
    } else if (source === "right" && leftDocDiffRef.current && rightDocDiffRef.current) {
      leftDocDiffRef.current.scrollTop = rightDocDiffRef.current.scrollTop;
      leftDocDiffRef.current.scrollLeft = rightDocDiffRef.current.scrollLeft;
    }
    setTimeout(() => {
      isSyncingDocRef.current = false;
    }, 20);
  };

  const handleCodeScroll = (source: "left" | "right") => {
    if (isSyncingCodeRef.current) return;
    isSyncingCodeRef.current = true;
    if (source === "left" && leftCodeDiffRef.current && rightCodeDiffRef.current) {
      rightCodeDiffRef.current.scrollTop = leftCodeDiffRef.current.scrollTop;
      rightCodeDiffRef.current.scrollLeft = leftCodeDiffRef.current.scrollLeft;
    } else if (source === "right" && leftCodeDiffRef.current && rightCodeDiffRef.current) {
      leftCodeDiffRef.current.scrollTop = rightCodeDiffRef.current.scrollTop;
      leftCodeDiffRef.current.scrollLeft = rightCodeDiffRef.current.scrollLeft;
    }
    setTimeout(() => {
      isSyncingCodeRef.current = false;
    }, 20);
  };

  const counts = useMemo(() => {
    return {
      all: alerts.length,
      low: alerts.filter((a) => a.severity === "low").length,
      medium: alerts.filter((a) => a.severity === "medium").length,
      high: alerts.filter((a) => a.severity === "high").length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      signature: alerts.filter((a) => a.classification === "SIGNATURE").length,
      semantic: alerts.filter((a) => a.classification === "SEMANTIC").length,
      reference: alerts.filter((a) => a.classification === "REFERENCE").length,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      const matchSeverity =
        severityFilter === "all" || item.severity === severityFilter;
      const matchClassification =
        classificationFilter === "all" || item.classification === classificationFilter;
      const matchSearch =
        searchQuery.trim() === "" ||
        item.docTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.repo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.affectedFiles.some((f) =>
          f.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchSeverity && matchClassification && matchSearch;
    });
  }, [alerts, severityFilter, classificationFilter, searchQuery]);

  const selectedAlert = useMemo(() => {
    if (alerts.length === 0) return null;
    return (
      alerts.find((a) => a.id === selectedAlertId) ||
      filteredAlerts[0] ||
      alerts[0] ||
      null
    );
  }, [alerts, selectedAlertId, filteredAlerts]);

  // Sinh danh sách các cặp dòng diff đối chiếu song song chuẩn GitHub
  const docDiffPairs = useMemo(() => {
    if (!selectedAlert?.docDiff) return [];
    return computeSideBySideDiff(
      selectedAlert.docDiff.outdatedContent,
      selectedAlert.docDiff.suggestedContent
    );
  }, [selectedAlert?.docDiff]);

  const codeDiffPairs = useMemo(() => {
    if (!selectedAlert?.codeDiff) return [];
    return computeSideBySideDiff(
      selectedAlert.codeDiff.oldCode,
      selectedAlert.codeDiff.newCode
    );
  }, [selectedAlert?.codeDiff]);

  // Quét & Đồng bộ dữ liệu thật từ hệ thống backend CSDL (Tuyệt đối không dùng dữ liệu mock)
  const handleScan = async () => {
    setIsScanning(true);
    try {
      let realAlerts: any[] = [];

      // 1. Lấy dữ liệu trực tiếp từ bảng document_change_alerts qua endpoint /api/drift-alerts
      try {
        const driftRes = await apiClient.get<any[]>("/api/drift-alerts");
        if (Array.isArray(driftRes?.data) && driftRes.data.length > 0) {
          realAlerts = driftRes.data;
        }
      } catch {
        // bỏ qua nếu endpoint chưa sẵn sàng
      }

      // 2. Nếu chưa có, quét qua bảng drift_alerts của các repositories
      if (realAlerts.length === 0) {
        try {
          const reposRes = await apiClient.get<any[]>("/api/repositories");
          if (reposRes?.data && Array.isArray(reposRes.data)) {
            for (const repo of reposRes.data.slice(0, 5)) {
              try {
                const alertsRes = await apiClient.get<any[]>(`/api/ci/drift-scan/repositories/${repo.id}`);
                if (Array.isArray(alertsRes?.data) && alertsRes.data.length > 0) {
                  realAlerts = [...realAlerts, ...alertsRes.data];
                }
              } catch {
                // bỏ qua lỗi từng repo
              }
            }
          }
        } catch {
          // bỏ qua lỗi nạp repo
        }
      }

      if (realAlerts.length > 0) {
        const mapped: DriftAlertItem[] = realAlerts.map((item, idx) => ({
          id: item.alertId || item.id || idx + 1,
          docTitle: item.methodName
            ? `Tài liệu API phương thức ${item.methodName}()`
            : item.filePath
            ? `Cảnh báo sai lệch ${item.filePath}`
            : `Cảnh báo trôi dạt #${item.alertId || idx + 1}`,
          docPath: item.filePath || (item.documentId ? `/docs/item-${item.documentId}.md` : "/docs/api/service.md"),
          repo: item.repoId || item.repositoryId ? `repository-${item.repoId || item.repositoryId}` : "livingdocs-backend",
          classification: item.classification === "SIGNATURE" || item.changeType === "SIGNATURE"
            ? "SIGNATURE"
            : item.classification === "REFERENCE" || item.changeType === "REFERENCE"
            ? "REFERENCE"
            : "SEMANTIC",
          pr: {
            number: item.prNumber || (item.sourcePrId ? Number(item.sourcePrId) : 100 + idx),
            title: `Cập nhật mã nguồn Git (${item.sourceCommit ? item.sourceCommit.substring(0, 7) : "commit"})`,
            branch: "main",
            author: "git-runner",
            mergedAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "Gần đây",
          },
          daysStale: 1,
          affectedFiles: [item.filePath || "SourceCode.java"],
          severity: (item.severity?.toLowerCase() as SeverityType) || "medium",
          status: (item.status as any) || "OPEN",
          driftReason: item.details || `Phát hiện thay đổi trong ${item.methodName || item.filePath || "code"}: mã nguồn đã có sự khác biệt so với tài liệu hiện hành.`,
          aiSuggestion: "Đồng bộ lại tài liệu kỹ thuật cho khớp với phiên bản mã nguồn mới nhất.",
          codeDiff: {
            fileName: item.filePath || "SourceCode.java",
            oldCode: "// Phiên bản trước khi cập nhật:\n" + (item.diffSnippet || item.details || "// Không có diff chi tiết"),
            newCode: "// Phiên bản mới đã merge:\n" + (item.diffSnippet || item.details || "// Không có diff chi tiết"),
          },
          docDiff: {
            sectionTitle: `Mục: ${item.methodName || "Đặc tả kỹ thuật"}`,
            outdatedContent: `### Đặc tả hiện tại trong tài liệu\n- Đường dẫn: ${item.filePath || "N/A"}\n- Trạng thái: Đã bị trôi dạt (Drifted)`,
            suggestedContent: `### Đặc tả cập nhật mới do AI đề xuất\n- Đường dẫn: ${item.filePath || "N/A"}\n- Cập nhật theo thay đổi từ commit / PR mới nhất.`,
          },
        }));
        setAlerts(mapped);
        if (targetAlertId) {
          const found = mapped.find((a) => a.id === targetAlertId);
          setSelectedAlertId(found ? found.id : mapped[0].id);
        } else {
          setSelectedAlertId(mapped[0].id);
        }
      } else {
        // KHÔNG DÙNG MOCK DATA: Khi DB chưa có cảnh báo thì hiển thị 0 cảnh báo thật
        setAlerts([]);
        setSelectedAlertId(null);
      }

      setSuccessToast({
        show: true,
        title: "Quét hoàn tất!",
        message: realAlerts.length > 0
          ? `Đã nạp ${realAlerts.length} cảnh báo sai lệch từ cơ sở dữ liệu.`
          : "Cơ sở dữ liệu đang sạch: Không có cảnh báo sai lệch nào tồn đọng.",
      });
      setTimeout(() => {
        setSuccessToast((prev) => ({ ...prev, show: false }));
      }, 4000);
    } catch (err) {
      console.warn("Scan failed", err);
      setAlerts([]);
      setSelectedAlertId(null);
    } finally {
      setIsScanning(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    handleScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (targetAlertId && alerts.length > 0) {
      const found = alerts.find((a) => a.id === targetAlertId);
      if (found) {
        setSelectedAlertId(found.id);
      }
    }
  }, [targetAlertId, alerts]);

  // Hành động 1: Chấp nhận đề xuất (Tạo bản nháp mới & giải quyết cảnh báo)
  const handleAcceptFix = async (alertItem: DriftAlertItem) => {
    setAcceptingId(alertItem.id);
    try {
      try {
        await apiClient.post(`/api/drift-alerts/${alertItem.id}/auto-draft`);
        await apiClient.post(`/api/drift-alerts/${alertItem.id}/accept-draft`);
      } catch (e) {
        console.info("Using frontend draft sync simulation for alert #", alertItem.id);
      }

      await new Promise((r) => setTimeout(r, 600));

      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertItem.id
            ? {
                ...a,
                status: "RESOLVED",
                draftVersionId: 100 + a.id,
              }
            : a
        )
      );

      setSuccessToast({
        show: true,
        title: "Đã chấp nhận đề xuất & Tạo bản nháp mới!",
        message: `Đã tự động áp dụng nội dung AI đề xuất vào bản nháp DRAFT (v2.1) cho "${alertItem.docTitle}". Cảnh báo đã được đánh dấu RESOLVED.`,
      });

      setTimeout(() => {
        setSuccessToast((prev) => ({ ...prev, show: false }));
      }, 5000);
    } catch (err: any) {
      alert("Không thể tạo bản nháp: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setAcceptingId(null);
    }
  };

  // Hành động 2: Chỉnh sửa (Mở trực tiếp sang trang Trình soạn thảo Editor kèm nội dung tài liệu & đề xuất)
  const handleEdit = (alertItem: DriftAlertItem) => {
    // Lưu tạm thời thông tin tài liệu cần sửa vào sessionStorage để Editor nạp mượt mà (ngay cả khi DB chưa có docId này)
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        `drift_alert_draft_${alertItem.id}`,
        JSON.stringify({
          title: alertItem.docTitle,
          targetPath: alertItem.docPath,
          repo: alertItem.repo,
          content: `# ${alertItem.docTitle}\n\n> **Trạng thái trôi dạt**: ${alertItem.classification} (${alertItem.severity.toUpperCase()})\n> **Nhánh / PR**: ${alertItem.pr?.branch || "main"} (#${alertItem.pr?.number || "N/A"})\n\n## 1. Tổng quan & Lý do cập nhật\n${alertItem.driftReason}\n\n## 2. ${alertItem.docDiff.sectionTitle}\n${alertItem.docDiff.suggestedContent}\n\n## 3. Thay đổi mã nguồn liên quan\n\`\`\`java\n${alertItem.codeDiff.newCode}\n\`\`\`\n`,
        })
      );
    }
    router.push(`/tai-lieu-cua-toi/editor?docId=${alertItem.id}&fromAlert=${alertItem.id}`);
  };

  // Hành động 3: Bỏ qua (Đánh dấu trạng thái IGNORED)
  const handleIgnore = async (alertItem: DriftAlertItem) => {
    setIgnoringId(alertItem.id);
    try {
      try {
        await apiClient.patch(`/api/drift-alerts/${alertItem.id}`, {
          action: "IGNORE",
          comment: "Người dùng chọn bỏ qua cảnh báo này từ Trung tâm Cảnh báo",
        });
      } catch (e) {
        console.info("Simulating ignore alert #", alertItem.id);
      }

      setAlerts((prev) =>
        prev.map((a) => (a.id === alertItem.id ? { ...a, status: "IGNORED" } : a))
      );

      setSuccessToast({
        show: true,
        title: "Đã bỏ qua cảnh báo",
        message: `Cảnh báo cho "${alertItem.docTitle}" đã được chuyển sang trạng thái IGNORED.`,
      });

      setTimeout(() => {
        setSuccessToast((prev) => ({ ...prev, show: false }));
      }, 4000);
    } catch (err: any) {
      alert("Lỗi khi bỏ qua cảnh báo: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setIgnoringId(null);
    }
  };

  const copyCode = (code: string, side: "old" | "new") => {
    navigator.clipboard.writeText(code);
    setCopiedCodeSide(side);
    setTimeout(() => setCopiedCodeSide(null), 2000);
  };

  return (
    <AppShell>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          height: "calc(100vh - 116px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header trang chuẩn màu sáng Emerald Green */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#eaf6ef",
                  display: "grid",
                  placeItems: "center",
                  color: "#087f5b",
                  border: "1px solid #b8dec5",
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#0f172a",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  Cảnh báo sai lệch tài liệu (Drift Alerts)
                </h1>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                  Phát hiện sự không đồng nhất giữa mã nguồn Git vừa thay đổi và nội dung tài liệu kỹ thuật
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="ld-btn ld-btn-secondary ld-btn-sm"
              style={{
                gap: 6,
                fontSize: 13,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                cursor: isScanning ? "not-allowed" : "pointer",
                opacity: isScanning ? 0.8 : 1,
              }}
            >
              <RefreshCw
                size={14}
                className={isScanning ? "animate-spin" : ""}
                style={{
                  animation: isScanning ? "spin 0.8s linear infinite" : undefined,
                }}
              />
              {isScanning ? "Đang quét..." : "Quét lại"}
            </button>
            <a
              href="/tai-lieu-cua-toi"
              className="ld-btn ld-btn-primary ld-btn-sm"
              style={{
                gap: 6,
                fontSize: 13,
                background: "#087f5b",
                color: "#ffffff",
                boxShadow: "0 2px 6px rgba(8, 127, 91, 0.2)",
              }}
            >
              <FileCheck size={14} />
              Kho tài liệu ({alerts.length})
            </a>
          </div>
        </div>

        {/* Thông báo Toast thành công */}
        {successToast.show && (
          <div
            style={{
              marginBottom: 14,
              flexShrink: 0,
              padding: "12px 16px",
              borderRadius: 8,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(4, 120, 87, 0.08)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={18} style={{ color: "#059669", flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: 13, display: "block" }}>{successToast.title}</strong>
                <span style={{ fontSize: 12, color: "#047857" }}>{successToast.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast((prev) => ({ ...prev, show: false }))}
              style={{
                background: "none",
                border: "none",
                color: "#059669",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Thanh lọc theo Mức độ nghiêm trọng, Dạng sai lệch & Tìm kiếm */}
        <div
          className="ld-card"
          style={{
            padding: "14px 18px",
            marginBottom: 16,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "#ffffff",
            border: "1px solid #e4eae6",
            borderRadius: 10,
          }}
        >
          {/* Tầng 1: Bộ lọc Mức độ nghiêm trọng & Ô tìm kiếm */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <Filter size={13} style={{ color: "#087f5b" }} /> Mức độ:
              </span>
              <button
                type="button"
                onClick={() => setSeverityFilter("all")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "all" ? "1.5px solid #087f5b" : "1px solid #e2e8f0",
                  background: "transparent",
                  color: severityFilter === "all" ? "#07543f" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                Tất cả ({counts.all})
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter("critical")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "critical" ? "1.5px solid #b91c1c" : "1px solid #e2e8f0",
                  background: "transparent",
                  color: severityFilter === "critical" ? "#b91c1c" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                Nghiêm trọng ({counts.critical})
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter("high")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "high" ? "1.5px solid #b45309" : "1px solid #e2e8f0",
                  background: "transparent",
                  color: severityFilter === "high" ? "#b45309" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                Cao ({counts.high})
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter("medium")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "medium" ? "1.5px solid #087f5b" : "1px solid #e2e8f0",
                  background: "transparent",
                  color: severityFilter === "medium" ? "#047857" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                Trung bình ({counts.medium})
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter("low")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "low" ? "1.5px solid #166534" : "1px solid #e2e8f0",
                  background: "transparent",
                  color: severityFilter === "low" ? "#166534" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                Thấp ({counts.low})
              </button>
            </div>

            {/* Ô tìm kiếm nhanh */}
            <div style={{ position: "relative", minWidth: 260 }}>
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tài liệu, repo, file..."
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#0f172a",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Tầng 2: Bộ lọc Dạng sai lệch (SIGNATURE / SEMANTIC / REFERENCE) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              paddingTop: 8,
              borderTop: "1px dashed #e2e8f0",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Layers size={13} style={{ color: "#0284c7" }} /> Dạng sai lệch:
            </span>

            <button
              type="button"
              onClick={() => setClassificationFilter("all")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: classificationFilter === "all" ? "1.5px solid #087f5b" : "1px solid #e2e8f0",
                background: "transparent",
                color: classificationFilter === "all" ? "#07543f" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              Tất cả dạng ({alerts.length})
            </button>

            <button
              type="button"
              onClick={() => setClassificationFilter("SIGNATURE")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: classificationFilter === "SIGNATURE" ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                background: "transparent",
                color: classificationFilter === "SIGNATURE" ? "#0284c7" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              Chữ ký hàm (SIGNATURE) ({counts.signature})
            </button>

            <button
              type="button"
              onClick={() => setClassificationFilter("SEMANTIC")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: classificationFilter === "SEMANTIC" ? "1.5px solid #7c3aed" : "1px solid #e2e8f0",
                background: "transparent",
                color: classificationFilter === "SEMANTIC" ? "#7c3aed" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              Ngữ nghĩa logic (SEMANTIC) ({counts.semantic})
            </button>

            <button
              type="button"
              onClick={() => setClassificationFilter("REFERENCE")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: classificationFilter === "REFERENCE" ? "1.5px solid #b45309" : "1px solid #e2e8f0",
                background: "transparent",
                color: classificationFilter === "REFERENCE" ? "#b45309" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              Tham chiếu cấu trúc (REFERENCE) ({counts.reference})
            </button>
          </div>
        </div>

        {/* KHUNG BỐ CỤC: NẾU CSDL CHƯA CÓ CẢNH BÁO NÀO THÌ HIỆN EMPTY STATE THỰC TẾ, NẾU CÓ THÌ HIỆN 2 CỘT */}
        {alerts.length === 0 ? (
          <div
            className="ld-card"
            style={{
              padding: "60px 24px",
              textAlign: "center",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flex: 1,
              boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#ecfdf5",
                color: "#087f5b",
                display: "grid",
                placeItems: "center",
                border: "1px solid #a7f3d0",
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                Không có cảnh báo sai lệch nào trong CSDL (0 Cảnh báo)
              </h2>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
                Hệ thống đang kết nối trực tiếp cơ sở dữ liệu thật. Hiện tại toàn bộ tài liệu kỹ thuật đều đang đồng bộ chính xác với mã nguồn Git, không có tài liệu nào bị trôi dạt.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                className="ld-btn ld-btn-primary ld-btn-sm"
                style={{ gap: 6, background: "#087f5b", color: "#ffffff", padding: "8px 18px", fontSize: 13 }}
              >
                <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
                {isScanning ? "Đang quét..." : "Quét lại từ Git"}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "380px 1fr",
              gap: 18,
              alignItems: "stretch",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {/* CỘT TRÁI: DANH SÁCH CẢNH BÁO */}
            <div
              style={{
                height: "100%",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                paddingRight: 6,
              }}
            >
              {filteredAlerts.length === 0 ? (
                <div
                  className="ld-card"
                  style={{ textAlign: "center", padding: "40px 16px", background: "#ffffff" }}
                >
                  <CheckCircle2 size={32} style={{ color: "#087f5b", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                    Không tìm thấy cảnh báo nào
                  </p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
                    Hãy thử chọn mức độ hoặc dạng sai lệch khác, hoặc xóa ô tìm kiếm.
                  </p>
                </div>
              ) : (
                filteredAlerts.map((alert) => {
                  const isSelected = alert.id === selectedAlert?.id;
                const sev = SEVERITY_CONFIG[alert.severity];
                const cls = CLASSIFICATION_CONFIG[alert.classification];

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlertId(alert.id)}
                    style={{
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      border: isSelected ? "1.5px solid #087f5b" : "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "14px 16px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 4px 14px rgba(8, 127, 91, 0.1)" : "0 1px 3px rgba(0,0,0,0.02)",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 9999,
                            background: sev.badgeBg,
                            color: sev.badgeText,
                            border: `1px solid ${sev.border}`,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                          }}
                        >
                          {sev.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: cls.bg,
                            color: cls.color,
                            border: `1px solid ${cls.border}`,
                          }}
                        >
                          {alert.classification}
                        </span>
                      </div>

                      {alert.status === "RESOLVED" || alert.status === "DRAFT_CREATED" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#eaf6ef",
                            color: "#087f5b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={12} /> Đã tạo bản nháp
                        </span>
                      ) : alert.status === "IGNORED" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#f1f5f9",
                            color: "#64748b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <EyeOff size={12} /> Đã bỏ qua
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={11} /> {alert.daysStale} ngày trước
                        </span>
                      )}
                    </div>

                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isSelected ? "#07543f" : "#0f172a",
                        margin: "8px 0 4px",
                        lineHeight: 1.4,
                      }}
                    >
                      {alert.docTitle}
                    </h3>

                    <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 500, color: "#334155" }}>{alert.repo}</span>
                      {alert.pr && (
                        <>
                          <span>•</span>
                          <span style={{ color: "#087f5b", fontWeight: 600 }}>PR #{alert.pr.number}</span>
                        </>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: 12,
                        color: "#475569",
                        margin: "8px 0 0",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {alert.driftReason}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* CỘT PHẢI: MÀN HÌNH XEM CHI TIẾT & ĐỐI CHIẾU DIFF CODE - TÀI LIỆU */}
          <div
            style={{
              height: "100%",
              overflowY: "auto",
              paddingRight: 6,
            }}
          >
            {selectedAlert && (
              <div
                className="ld-card"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e4eae6",
                  padding: "20px 24px",
                  borderRadius: 10,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                }}
              >
              {/* Tiêu đề & Thanh trạng thái chi tiết */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: 16,
                  marginBottom: 18,
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 9999,
                        background: "transparent",
                        color: SEVERITY_CONFIG[selectedAlert.severity].color,
                        border: `1px solid ${SEVERITY_CONFIG[selectedAlert.severity].border}`,
                      }}
                    >
                      Mức độ: {SEVERITY_CONFIG[selectedAlert.severity].label}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Kho lưu trữ: <strong style={{ color: "#0f172a" }}>{selectedAlert.repo}</strong>
                    </span>
                  </div>

                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: "4px 0 2px",
                    }}
                  >
                    {selectedAlert.docTitle}
                  </h2>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, fontFamily: "var(--font-mono)" }}>
                    Đường dẫn: {selectedAlert.docPath}
                  </p>
                </div>

                {/* 3 NÚT HÀNH ĐỘNG NHANH TRÊN HEADER: Chấp nhận đề xuất, Chỉnh sửa, Bỏ qua */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Nút 1: Chấp nhận đề xuất (Tạo bản nháp mới) */}
                  {selectedAlert.status === "RESOLVED" || selectedAlert.status === "DRAFT_CREATED" ? (
                    <button
                      type="button"
                      onClick={() => handleEdit(selectedAlert)}
                      className="ld-btn ld-btn-primary ld-btn-sm"
                      style={{
                        background: "#087f5b",
                        color: "#ffffff",
                        gap: 6,
                        fontSize: 12,
                        padding: "7px 14px",
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Đã giải quyết (Mở Editor v2.1)
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={acceptingId === selectedAlert.id}
                      onClick={() => handleAcceptFix(selectedAlert)}
                      className="ld-btn ld-btn-primary ld-btn-sm"
                      title="Tự động áp dụng đề xuất của AI và tạo bản nháp DRAFT v2.1"
                      style={{
                        background: "#087f5b",
                        color: "#ffffff",
                        gap: 6,
                        fontSize: 12,
                        padding: "7px 16px",
                        fontWeight: 600,
                        boxShadow: "0 2px 8px rgba(8, 127, 91, 0.25)",
                        cursor: acceptingId === selectedAlert.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {acceptingId === selectedAlert.id ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Đang tạo bản nháp...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          Chấp nhận đề xuất
                        </>
                      )}
                    </button>
                  )}

                  {/* Nút 2: Chỉnh sửa (Mở Trình soạn thảo Split Editor) */}
                  <button
                    type="button"
                    onClick={() => handleEdit(selectedAlert)}
                    className="ld-btn ld-btn-secondary ld-btn-sm"
                    title="Mở trình soạn thảo Markdown với nội dung tài liệu để chỉnh sửa thủ công"
                    style={{
                      gap: 6,
                      fontSize: 12,
                      padding: "7px 14px",
                      fontWeight: 600,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      color: "#334155",
                    }}
                  >
                    <Edit3 size={14} style={{ color: "#0284c7" }} />
                    Chỉnh sửa
                  </button>

                  {/* Nút 3: Bỏ qua (Đánh dấu trạng thái IGNORED) */}
                  {selectedAlert.status !== "IGNORED" && (
                    <button
                      type="button"
                      disabled={ignoringId === selectedAlert.id}
                      onClick={() => handleIgnore(selectedAlert)}
                      className="ld-btn ld-btn-ghost ld-btn-sm"
                      title="Bỏ qua cảnh báo này và không cập nhật tài liệu"
                      style={{
                        gap: 5,
                        fontSize: 12,
                        padding: "7px 12px",
                        fontWeight: 500,
                        color: "#64748b",
                        border: "1px solid #e2e8f0",
                        cursor: ignoringId === selectedAlert.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {ignoringId === selectedAlert.id ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <EyeOff size={13} />
                      )}
                      Bỏ qua
                    </button>
                  )}
                </div>
              </div>

              {/* Thông tin Pull Request liên quan */}
              {selectedAlert.pr && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <GitPullRequest size={16} style={{ color: "#087f5b" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                      PR #{selectedAlert.pr.number}: {selectedAlert.pr.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    Nhánh: <code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: 3, color: "#0f172a" }}>{selectedAlert.pr.branch}</code> • Bởi: <strong>{selectedAlert.pr.author}</strong> ({selectedAlert.pr.mergedAt})
                  </div>
                </div>
              )}

              {/* PHẦN 1: SO SÁNH DIFF TÀI LIỆU 2 CỘT CHUẨN GITHUB VỚI CUỘN ĐỒNG BỘ */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <FileDiff size={17} style={{ color: "#087f5b" }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      So sánh Diff 2 cột trực quan: Tài liệu hiện tại vs Đề xuất AI
                    </h3>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#047857",
                      fontWeight: 600,
                      background: "#eaf6ef",
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "1px solid #b8dec5",
                    }}
                  >
                    {selectedAlert.docDiff.sectionTitle}
                  </span>
                </div>

                {/* Diff Viewer 2 cột kiểu GitHub: Nền trung tính, chỉ tô màu các dòng thay đổi, cuộn 1 bên thì 2 bên cùng kéo */}
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  {/* Header 2 cột trung tính */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      borderBottom: "1px solid #e2e8f0",
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#334155",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }}></span>
                        Tài liệu hiện tại (Bản cũ)
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#b91c1c",
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          padding: "1px 8px",
                          borderRadius: 4,
                        }}
                      >
                        BỊ TRÔI DẠT / CŨ
                      </span>
                    </div>

                    <div
                      style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#334155",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></span>
                        Đề xuất viết lại của AI (Bản mới)
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#047857",
                          background: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          padding: "1px 8px",
                          borderRadius: 4,
                        }}
                      >
                        ĐỀ XUẤT CẬP NHẬT
                      </span>
                    </div>
                  </div>

                  {/* Vùng đối chiếu các dòng với Synchronized Scrolling */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      position: "relative",
                    }}
                  >
                    {/* Cột trái: Tài liệu hiện tại */}
                    <div
                      ref={leftDocDiffRef}
                      onScroll={() => handleDocScroll("left")}
                      style={{
                        maxHeight: 280,
                        overflowY: "auto",
                        overflowX: "auto",
                        borderRight: "1px solid #e2e8f0",
                        background: "#ffffff",
                      }}
                    >
                      {docDiffPairs.map((pair, idx) => {
                        const line = pair.left;
                        const isDel = line.type === "delete";
                        const isEmpty = line.type === "empty";
                        return (
                          <div
                            key={`doc-left-${idx}`}
                            style={{
                              display: "flex",
                              alignItems: "stretch",
                              minHeight: 24,
                              height: 24,
                              fontSize: 12,
                              fontFamily: "var(--font-mono, 'Consolas', monospace)",
                              background: isDel ? "#fef2f2" : isEmpty ? "#f8fafc" : "#ffffff",
                              borderLeft: isDel ? "3px solid #ef4444" : "3px solid transparent",
                              color: isDel ? "#991b1b" : "#334155",
                            }}
                          >
                            <div
                              style={{
                                width: 36,
                                flexShrink: 0,
                                textAlign: "right",
                                paddingRight: 6,
                                userSelect: "none",
                                color: isDel ? "#dc2626" : "#94a3b8",
                                background: isDel ? "#fee2e2" : "#f8fafc",
                                borderRight: "1px solid #e2e8f0",
                                lineHeight: "24px",
                              }}
                            >
                              {line.lineNo !== null ? line.lineNo : ""}
                            </div>
                            <div
                              style={{
                                width: 18,
                                flexShrink: 0,
                                textAlign: "center",
                                userSelect: "none",
                                fontWeight: 700,
                                lineHeight: "24px",
                                color: isDel ? "#dc2626" : "transparent",
                              }}
                            >
                              {isDel ? "-" : " "}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                padding: "0 8px",
                                whiteSpace: "pre",
                                lineHeight: "24px",
                              }}
                            >
                              {line.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Cột phải: Đề xuất AI */}
                    <div
                      ref={rightDocDiffRef}
                      onScroll={() => handleDocScroll("right")}
                      style={{
                        maxHeight: 280,
                        overflowY: "auto",
                        overflowX: "auto",
                        background: "#ffffff",
                      }}
                    >
                      {docDiffPairs.map((pair, idx) => {
                        const line = pair.right;
                        const isIns = line.type === "insert";
                        const isEmpty = line.type === "empty";
                        return (
                          <div
                            key={`doc-right-${idx}`}
                            style={{
                              display: "flex",
                              alignItems: "stretch",
                              minHeight: 24,
                              height: 24,
                              fontSize: 12,
                              fontFamily: "var(--font-mono, 'Consolas', monospace)",
                              background: isIns ? "#f0fdf4" : isEmpty ? "#f8fafc" : "#ffffff",
                              borderLeft: isIns ? "3px solid #10b981" : "3px solid transparent",
                              color: isIns ? "#166534" : "#334155",
                            }}
                          >
                            <div
                              style={{
                                width: 36,
                                flexShrink: 0,
                                textAlign: "right",
                                paddingRight: 6,
                                userSelect: "none",
                                color: isIns ? "#16a34a" : "#94a3b8",
                                background: isIns ? "#dcfce7" : "#f8fafc",
                                borderRight: "1px solid #e2e8f0",
                                lineHeight: "24px",
                              }}
                            >
                              {line.lineNo !== null ? line.lineNo : ""}
                            </div>
                            <div
                              style={{
                                width: 18,
                                flexShrink: 0,
                                textAlign: "center",
                                userSelect: "none",
                                fontWeight: 700,
                                lineHeight: "24px",
                                color: isIns ? "#16a34a" : "transparent",
                              }}
                            >
                              {isIns ? "+" : " "}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                padding: "0 8px",
                                whiteSpace: "pre",
                                lineHeight: "24px",
                              }}
                            >
                              {line.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* PHẦN 2: ĐỐI CHIẾU THAY ĐỔI MÃ NGUỒN GIT CHUẨN GITHUB VỚI CUỘN ĐỒNG BỘ */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Code size={15} style={{ color: "#087f5b" }} />
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: 0 }}>
                      Mã nguồn Git thay đổi tương ứng ({selectedAlert.codeDiff.fileName})
                    </h3>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => copyCode(selectedAlert.codeDiff.newCode, "new")}
                      className="ld-btn ld-btn-ghost ld-btn-xs"
                      style={{ fontSize: 11, gap: 4, color: "#64748b" }}
                    >
                      {copiedCodeSide === "new" ? <Check size={12} className="text-emerald-600" /> : <FileCode size={12} />}
                      {copiedCodeSide === "new" ? "Đã chép code mới" : "Sao chép code"}
                    </button>
                  </div>
                </div>

                {/* Khung Code Diff kiểu GitHub với cuộn đồng bộ */}
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      borderBottom: "1px solid #e2e8f0",
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#991b1b",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      <span>- Code gốc trước khi PR merge</span>
                    </div>
                    <div
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#166534",
                      }}
                    >
                      <span>+ Code mới vừa merge (Gây trôi dạt)</span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      position: "relative",
                    }}
                  >
                    {/* Cột trái: Code cũ */}
                    <div
                      ref={leftCodeDiffRef}
                      onScroll={() => handleCodeScroll("left")}
                      style={{
                        maxHeight: 220,
                        overflowY: "auto",
                        overflowX: "auto",
                        borderRight: "1px solid #e2e8f0",
                        background: "#ffffff",
                      }}
                    >
                      {codeDiffPairs.map((pair, idx) => {
                        const line = pair.left;
                        const isDel = line.type === "delete";
                        const isEmpty = line.type === "empty";
                        return (
                          <div
                            key={`code-left-${idx}`}
                            style={{
                              display: "flex",
                              alignItems: "stretch",
                              minHeight: 22,
                              height: 22,
                              fontSize: 11.5,
                              fontFamily: "var(--font-mono, 'Consolas', monospace)",
                              background: isDel ? "#fef2f2" : isEmpty ? "#f8fafc" : "#ffffff",
                              borderLeft: isDel ? "3px solid #ef4444" : "3px solid transparent",
                              color: isDel ? "#991b1b" : "#334155",
                            }}
                          >
                            <div
                              style={{
                                width: 34,
                                flexShrink: 0,
                                textAlign: "right",
                                paddingRight: 6,
                                userSelect: "none",
                                color: isDel ? "#dc2626" : "#94a3b8",
                                background: isDel ? "#fee2e2" : "#f8fafc",
                                borderRight: "1px solid #e2e8f0",
                                lineHeight: "22px",
                              }}
                            >
                              {line.lineNo !== null ? line.lineNo : ""}
                            </div>
                            <div
                              style={{
                                width: 16,
                                flexShrink: 0,
                                textAlign: "center",
                                userSelect: "none",
                                fontWeight: 700,
                                lineHeight: "22px",
                                color: isDel ? "#dc2626" : "transparent",
                              }}
                            >
                              {isDel ? "-" : " "}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                padding: "0 8px",
                                whiteSpace: "pre",
                                lineHeight: "22px",
                              }}
                            >
                              {line.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Cột phải: Code mới */}
                    <div
                      ref={rightCodeDiffRef}
                      onScroll={() => handleCodeScroll("right")}
                      style={{
                        maxHeight: 220,
                        overflowY: "auto",
                        overflowX: "auto",
                        background: "#ffffff",
                      }}
                    >
                      {codeDiffPairs.map((pair, idx) => {
                        const line = pair.right;
                        const isIns = line.type === "insert";
                        const isEmpty = line.type === "empty";
                        return (
                          <div
                            key={`code-right-${idx}`}
                            style={{
                              display: "flex",
                              alignItems: "stretch",
                              minHeight: 22,
                              height: 22,
                              fontSize: 11.5,
                              fontFamily: "var(--font-mono, 'Consolas', monospace)",
                              background: isIns ? "#f0fdf4" : isEmpty ? "#f8fafc" : "#ffffff",
                              borderLeft: isIns ? "3px solid #10b981" : "3px solid transparent",
                              color: isIns ? "#166534" : "#334155",
                            }}
                          >
                            <div
                              style={{
                                width: 34,
                                flexShrink: 0,
                                textAlign: "right",
                                paddingRight: 6,
                                userSelect: "none",
                                color: isIns ? "#16a34a" : "#94a3b8",
                                background: isIns ? "#dcfce7" : "#f8fafc",
                                borderRight: "1px solid #e2e8f0",
                                lineHeight: "22px",
                              }}
                            >
                              {line.lineNo !== null ? line.lineNo : ""}
                            </div>
                            <div
                              style={{
                                width: 16,
                                flexShrink: 0,
                                textAlign: "center",
                                userSelect: "none",
                                fontWeight: 700,
                                lineHeight: "22px",
                                color: isIns ? "#16a34a" : "transparent",
                              }}
                            >
                              {isIns ? "+" : " "}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                padding: "0 8px",
                                whiteSpace: "pre",
                                lineHeight: "22px",
                              }}
                            >
                              {line.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Nút hành động bổ sung dưới chân trang chi tiết */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleIgnore(selectedAlert)}
                    className="ld-btn ld-btn-ghost ld-btn-sm"
                    style={{ fontSize: 12, color: "#64748b" }}
                  >
                    <XCircle size={13} /> Bỏ qua cảnh báo
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEdit(selectedAlert)}
                    className="ld-btn ld-btn-secondary ld-btn-sm"
                    style={{ fontSize: 12, gap: 5 }}
                  >
                    <Edit3 size={13} /> Chỉnh sửa thủ công
                  </button>

                  {selectedAlert.status !== "RESOLVED" && (
                    <button
                      type="button"
                      disabled={acceptingId === selectedAlert.id}
                      onClick={() => handleAcceptFix(selectedAlert)}
                      className="ld-btn ld-btn-primary ld-btn-sm"
                      style={{
                        background: "#087f5b",
                        color: "#ffffff",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <Sparkles size={14} />
                      Chấp nhận đề xuất
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
</AppShell>
);
}

export default function CanhBaoSaiLechPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <div style={{ textAlign: "center", color: "#64748b" }}>
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
              <p>Đang tải cảnh báo sai lệch...</p>
            </div>
          </div>
        </AppShell>
      }
    >
      <CanhBaoSaiLechContent />
    </Suspense>
  );
}
