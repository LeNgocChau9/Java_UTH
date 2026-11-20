"use client";

/**
 * Task tuần 7: Gắn 4 action API CodeDiffController & PrMergeBlockingController vào Pull Requests
 * - Nút Diff: Kéo Git Diff chi tiết từ GitHub API
 * - Nút AST: Phân tích AST các hàm thay đổi & phát hiện trôi dạt tài liệu
 * - Nút Review Bot: Xem trước bình luận inline suggestion patch & Đăng review lên GitHub
 * - Nút Gate: Đánh giá chặn Merge Gate theo chất lượng tài liệu
 */

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { refreshSession } from "@/services/authService";
import {
  repoService,
  RepoItem,
  PullRequestItem,
  CommitItem,
  SyncResult,
  WebhookDeliveryItem,
} from "@/services/repoService";
import {
  GitBranch,
  RefreshCw,
  Plus,
  GitPullRequest,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Search,
  Clock,
  ShieldCheck,
  FolderGit2,
  Calendar,
  Webhook,
  X,
  Zap,
  FileDiff,
  ShieldAlert,
  Code,
} from "lucide-react";
import { codeDiffService } from "@/services/codeDiffService";

export default function RepoManagementPage() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [activeTab, setActiveTab] = useState<"prs" | "commits" | "webhooks">("prs");

  // Pull Requests, Commits & Webhook Deliveries data for selected repo
  const [pullRequests, setPullRequests] = useState<PullRequestItem[]>([]);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);

  // Sync state
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [globalNotice, setGlobalNotice] = useState<{
    text: string;
    type: "success" | "error";
    actionLabel?: string;
    action?: () => void;
  } | null>(null);

  const [syncMessage, setSyncMessage] = useState<{
    id: number;
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Modal thêm repo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRepoFullName, setNewRepoFullName] = useState("");
  const [newDefaultBranch, setNewDefaultBranch] = useState("main");
  const [newGithubToken, setNewGithubToken] = useState("");
  const [addingRepo, setAddingRepo] = useState(false);
  const [addError, setAddError] = useState("");

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");

  // State & Handlers cho API CodeDiffController & PrMergeBlockingController
  const [prModalState, setPrModalState] = useState<{
    isOpen: boolean;
    type: "diff" | "ast" | "preview" | "blocking" | null;
    loading: boolean;
    title: string;
    data: any;
    repoId?: number;
    prNumber?: number;
  }>({
    isOpen: false,
    type: null,
    loading: false,
    title: "",
    data: null,
  });
  const [isPostingReview, setIsPostingReview] = useState(false);

  const handleOpenPrDiff = async (repoId: number, prNumber: number) => {
    setPrModalState({
      isOpen: true,
      type: "diff",
      loading: true,
      title: `Git Diff - Pull Request #${prNumber}`,
      data: null,
      repoId,
      prNumber,
    });
    try {
      const res = await codeDiffService.pullDiff(repoId, prNumber);
      setPrModalState((prev) => ({ ...prev, loading: false, data: res }));
    } catch (err: any) {
      setPrModalState((prev) => ({
        ...prev,
        loading: false,
        data: { error: err.response?.data?.message || err.message || "Không thể tải Git Diff từ GitHub" },
      }));
    }
  };

  const handleOpenPrAst = async (repoId: number, prNumber: number) => {
    setPrModalState({
      isOpen: true,
      type: "ast",
      loading: true,
      title: `Phân tích AST & Bắt sai lệch - PR #${prNumber}`,
      data: null,
      repoId,
      prNumber,
    });
    try {
      const res = await codeDiffService.pullAndAnalyze(repoId, prNumber);
      setPrModalState((prev) => ({ ...prev, loading: false, data: res }));
    } catch (err: any) {
      setPrModalState((prev) => ({
        ...prev,
        loading: false,
        data: { error: err.response?.data?.message || err.message || "Không thể phân tích AST PR" },
      }));
    }
  };

  const handleOpenPrPreviewComment = async (repoId: number, prNumber: number) => {
    setPrModalState({
      isOpen: true,
      type: "preview",
      loading: true,
      title: `Xem trước GitHub Inline Review Bot (suggestion patch) - PR #${prNumber}`,
      data: null,
      repoId,
      prNumber,
    });
    try {
      const res = await codeDiffService.previewComment(repoId, prNumber);
      setPrModalState((prev) => ({ ...prev, loading: false, data: res }));
    } catch (err: any) {
      setPrModalState((prev) => ({
        ...prev,
        loading: false,
        data: { error: err.response?.data?.message || err.message || "Không thể tải trước review comment" },
      }));
    }
  };

  const handleOpenPrBlocking = async (repoId: number, prNumber: number) => {
    setPrModalState({
      isOpen: true,
      type: "blocking",
      loading: true,
      title: `Kiểm tra Chặn Merge Gate (PrMergeBlocking) - PR #${prNumber}`,
      data: null,
      repoId,
      prNumber,
    });
    try {
      const res = await codeDiffService.evaluatePrBlocking(repoId, prNumber);
      setPrModalState((prev) => ({ ...prev, loading: false, data: res }));
    } catch (err: any) {
      setPrModalState((prev) => ({
        ...prev,
        loading: false,
        data: { error: err.response?.data?.message || err.message || "Không thể đánh giá chặn merge" },
      }));
    }
  };

  const handlePostReviewComment = async (repoId: number, prNumber: number) => {
    setIsPostingReview(true);
    try {
      const res = await codeDiffService.postDriftComment(repoId, prNumber);
      alert(`Đã gửi GitHub Pull Request Review thành công!\nReview ID: ${res?.reviewId || "N/A"}\nURL: ${res?.reviewUrl || "Đã gửi lên GitHub"}`);
    } catch (err: any) {
      alert("Lỗi khi đăng bình luận: " + (err.response?.data?.message || err.message));
    } finally {
      setIsPostingReview(false);
    }
  };

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const data = await repoService.getRepositories();
      setRepos(data);
      if (data.length > 0 && !selectedRepo) {
        setSelectedRepo(data[0]);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách repositories:", err);
      setRepos([]);
    } finally {
      setLoading(false);
    }
  };

  // Kiểm tra tính toàn vẹn của Token GitHub
  const [verifyingTokens, setVerifyingTokens] = useState<boolean>(false);
  const [tokenAlert, setTokenAlert] = useState<{
    revokedOrExpired: boolean;
    status: string;
    message: string;
    renewUrl: string;
  } | null>(null);

  // Hàm quét kiểm tra tính toàn vẹn của Token
  const checkTokenIntegrity = async () => {
    try {
      setVerifyingTokens(true);
      const connections = await repoService.getConnections();
      const problematicConn = connections.find(
        (c) => c.status?.toUpperCase() === "REVOKED" || c.status?.toUpperCase() === "EXPIRED" || !c.valid
      );

      if (problematicConn) {
        const isExpired = problematicConn.status?.toUpperCase() === "EXPIRED";
        setTokenAlert({
          revokedOrExpired: true,
          status: problematicConn.status,
          message: isExpired
            ? `CẢNH BÁO: Mã khóa truy cập GitHub (Token) của tài khoản @${problematicConn.githubUsername} đã hết hạn. Các tiến trình đồng bộ và phát hiện sai lệch tài liệu có thể bị gián đoạn!`
            : `CẢNH BÁO BẢO MẬT: Mã khóa truy cập GitHub (Token) của tài khoản @${problematicConn.githubUsername} đã bị thu hồi (Revoked) trên GitHub hoặc không còn quyền hợp lệ!`,
          renewUrl: problematicConn.renewUrl || "/api/auth/github?mode=link",
        });
      } else {
        setTokenAlert(null);
      }
    } catch (err) {
      console.warn("Không thể kiểm tra trạng thái token GitHub:", err);
    } finally {
      setVerifyingTokens(false);
    }
  };

  const handleManualVerifyTokens = async () => {
    try {
      setVerifyingTokens(true);
      const results = await repoService.verifyAllConnections();
      await loadRepositories();
      const problematic = results.find((c) => !c.valid);
      if (problematic) {
        setTokenAlert({
          revokedOrExpired: true,
          status: problematic.status,
          message: problematic.warningMessage || `Cảnh báo: Token GitHub đã bị ${problematic.status.toLowerCase()}!`,
          renewUrl: problematic.renewUrl || "/api/auth/github?mode=link",
        });
        setGlobalNotice({
          text: `Đã phát hiện token GitHub của @${problematic.githubUsername} bị ${problematic.status}. Vui lòng cấp lại quyền!`,
          type: "error",
        });
      } else {
        setTokenAlert(null);
        setGlobalNotice({
          text: "Toàn bộ Token GitHub kết nối đều hợp lệ và bảo mật tuyệt đối!",
          type: "success",
        });
      }
    } catch (err: any) {
      console.error("Lỗi khi quét kiểm tra token:", err);
      setGlobalNotice({
        text: "Kiểm tra token thất bại: " + (err.response?.data?.message || err.message),
        type: "error",
      });
    } finally {
      setVerifyingTokens(false);
    }
  };

  const handleRenewToken = () => {
    const currentToken = typeof window !== "undefined" ? localStorage.getItem("livingdocs_access_token") || "" : "";
    const redirectUrl = typeof window !== "undefined" ? window.location.pathname : "/kho-luu-tru";
    if (currentToken) {
      window.location.assign(`/api/auth/github?mode=link&redirect=${encodeURIComponent(redirectUrl)}&token=${encodeURIComponent(currentToken)}`);
    } else {
      window.location.assign(`/api/auth/github?mode=link&redirect=${encodeURIComponent(redirectUrl)}`);
    }
  };

  useEffect(() => {
    loadRepositories();
    checkTokenIntegrity();
    // Tự động kiểm tra định kỳ mỗi 60 giây trên giao diện
    const interval = setInterval(checkTokenIntegrity, 60000);
    return () => clearInterval(interval);
  }, []);

  // Khi chọn repo thì tải PRs, Commits & Webhook Delivery Logs
  useEffect(() => {
    if (!selectedRepo) return;
    const fetchRepoDetails = async () => {
      setDetailsLoading(true);
      try {
        const [prs, cms, deliveries] = await Promise.all([
          repoService.getRepoPullRequests(selectedRepo.repositoryId).catch(() => []),
          repoService.getRepoCommits(selectedRepo.repositoryId).catch(() => []),
          repoService.getWebhookDeliveries(selectedRepo.repositoryId).catch(() => []),
        ]);
        setPullRequests(prs);
        setCommits(cms);
        setWebhookDeliveries(deliveries);
      } catch (err) {
        console.error("Lỗi tải chi tiết PR / Commit / Webhook:", err);
      } finally {
        setDetailsLoading(false);
      }
    };
    fetchRepoDetails();
  }, [selectedRepo]);

  // Xử lý Sync lại
  const handleSync = async (repo: RepoItem) => {
    try {
      setSyncingId(repo.repositoryId);
      setSyncMessage(null);
      // Tự động gia hạn phiên ngầm trước khi quét/đồng bộ
      try {
        await refreshSession();
      } catch (refErr) {
        console.warn("Silent session refresh before sync:", refErr);
      }
      const result: SyncResult = await repoService.syncRepository(repo.repositoryId);
      setSyncMessage({
        id: repo.repositoryId,
        text: `Đã sync thành công: ${result.syncedPullRequestsCount} PRs, ${result.syncedCommitsCount} Commits!`,
        type: "success",
      });

      // Cập nhật lại repo list & reload chi tiết nếu đang chọn
      await loadRepositories();
      if (selectedRepo?.repositoryId === repo.repositoryId) {
        const [prs, cms, deliveries] = await Promise.all([
          repoService.getRepoPullRequests(repo.repositoryId),
          repoService.getRepoCommits(repo.repositoryId),
          repoService.getWebhookDeliveries(repo.repositoryId).catch(() => []),
        ]);
        setPullRequests(prs);
        setCommits(cms);
        setWebhookDeliveries(deliveries);
      }
    } catch (err: any) {
      console.error("Lỗi khi sync repository:", err);
      const rawMsg = String(err.response?.data?.message || "");
      const errCode = err.response?.data?.errorCode;
      const isExpired =
        err.response?.status === 401 ||
        errCode === "GITHUB_TOKEN_EXPIRED" ||
        rawMsg.toLowerCase().includes("bad credentials") ||
        rawMsg.toLowerCase().includes("http 401") ||
        rawMsg.toLowerCase().includes("expired") ||
        rawMsg.toLowerCase().includes("revoked");

      if (isExpired) {
        setSyncMessage({
          id: repo.repositoryId,
          text: "Phiên kết nối GitHub đã hết hạn. Vui lòng bấm 'Gia hạn phiên' để tiếp tục đồng bộ!",
          type: "error",
        });
        // Bắn event để hiển thị modal gia hạn phiên
        window.dispatchEvent(new CustomEvent("livingdocs:session_expired"));
      } else {
        const isDbOrInternalError =
          rawMsg.includes("Exception") ||
          rawMsg.includes("SQL") ||
          rawMsg.includes("constraint") ||
          rawMsg.includes("could not execute") ||
          rawMsg.includes("violates") ||
          rawMsg.includes("duplicate key") ||
          rawMsg.includes("{") ||
          rawMsg.toLowerCase().includes("github api");

        const safeText = isDbOrInternalError
          ? "Đồng bộ gặp xung đột dữ liệu hoặc lỗi hệ thống. Vui lòng làm mới trang và thử lại!"
          : rawMsg || "Sync thất bại. Vui lòng thử lại!";

        setSyncMessage({
          id: repo.repositoryId,
          text: safeText,
          type: "error",
        });
      }
    } finally {
      setSyncingId(null);
    }
  };

  // Xử lý Thêm Repository mới
  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoFullName.trim()) {
      setAddError("Vui lòng nhập tên đầy đủ repo (owner/repo)");
      return;
    }
    try {
      setAddingRepo(true);
      setAddError("");
      const created = await repoService.addRepository({
        repoFullName: newRepoFullName.trim(),
        defaultBranch: newDefaultBranch.trim() || "main",
        githubToken: newGithubToken.trim() || undefined,
      });

      setIsModalOpen(false);
      setNewRepoFullName("");
      setNewDefaultBranch("main");
      setNewGithubToken("");

      await loadRepositories();
      setSelectedRepo(created);
    } catch (err: any) {
      console.error("Lỗi khi thêm repo:", err);
      setAddError(err.response?.data?.message || "Không thể thêm repo. Hãy kiểm tra định dạng owner/repo");
    } finally {
      setAddingRepo(false);
    }
  };

  const filteredRepos = repos.filter((r) =>
    r.repoFullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "Chưa đồng bộ";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AppShell>
      <div className="ld-page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="ld-page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FolderGit2 className="text-[#047857]" size={26} />
            Quản lý Kho lưu trữ GitHub
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={handleManualVerifyTokens}
            disabled={verifyingTokens}
            className="ld-btn ld-btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <ShieldCheck size={16} className={verifyingTokens ? "animate-pulse" : ""} />
            {verifyingTokens ? "Đang kiểm tra..." : "Kiểm tra toàn vẹn Token"}
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="ld-btn ld-btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={16} /> Thêm Repository
          </button>
        </div>
      </div>

      {/* THANH CẢNH BÁO MÀU ĐỎ: PHÁT HIỆN TOKEN GITHUB BỊ THU HỒI HOẶC HẾT HẠN */}
      {tokenAlert && (
        <div
          style={{
            marginBottom: 20,
            padding: "16px 20px",
            borderRadius: 12,
            background: "#450a0a",
            border: "1.5px solid #ef4444",
            color: "#fecaca",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            boxShadow: "0 4px 14px rgba(239, 68, 68, 0.25)",
            animation: "pulse 2s infinite ease-in-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertCircle size={24} style={{ color: "#f87171" }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                <span>CẢNH BÁO TOÀN VẸN TOKEN GITHUB</span>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "#7f1d1d",
                    color: "#fca5a5",
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                >
                  {tokenAlert.status}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>
                {tokenAlert.message}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleRenewToken}
              className="ld-btn"
              style={{
                background: "#dc2626",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 13,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #ef4444",
                boxShadow: "0 2px 8px rgba(220, 38, 38, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} /> Cấp lại quyền & Kết nối lại
            </button>
            <button
              type="button"
              onClick={() => setTokenAlert(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fca5a5",
                cursor: "pointer",
                padding: 4,
              }}
              title="Đóng cảnh báo"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Banner thông báo trạng thái toàn trang (khi gia hạn thành công hoặc gặp sự cố) */}
      {globalNotice && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: globalNotice.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: globalNotice.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${globalNotice.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{globalNotice.type === "success" ? "✓" : "⚠"}</span>
            <span>{globalNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalNotice(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Grid 2 cột: Cột trái Danh sách repo - Cột phải Chi tiết Tab */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
        
        {/* CỘT TRÁI: DANH SÁCH REPOS */}
        <div className="ld-card" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 14,
              marginBottom: 14,
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: 0 }}>
              Repositories đã kết nối ({filteredRepos.length})
            </h2>
            <div style={{ position: "relative", width: 180 }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#64748b",
                  pointerEvents: "none",
                }}
              />
              <input
                className="ld-input"
                style={{ paddingLeft: 28, fontSize: 12, height: 32 }}
                placeholder="Tìm repo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 13 }}>
              <RefreshCw className="animate-spin inline mr-2" size={16} /> Đang tải danh sách kho lưu trữ...
            </div>
          ) : filteredRepos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b" }}>
              <FolderGit2 size={36} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
              <p style={{ fontSize: 13, fontWeight: 500 }}>Chưa có Repository nào được kết nối</p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="ld-btn ld-btn-secondary ld-btn-sm"
                style={{ marginTop: 8 }}
              >
                + Kết nối Repo đầu tiên
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 580,
                overflowY: "auto",
                paddingRight: 6,
              }}
            >
              {filteredRepos.map((repo) => {
                const isSelected = selectedRepo?.repositoryId === repo.repositoryId;
                const isSyncing = syncingId === repo.repositoryId;

                return (
                  <div
                    key={repo.repositoryId}
                    onClick={() => setSelectedRepo(repo)}
                    style={{
                      border: isSelected ? "1.5px solid #047857" : "1px solid #e2e8f0",
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      borderRadius: 8,
                      padding: "14px 16px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 2px 6px rgba(4, 120, 87, 0.08)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                            {repo.repoFullName}
                          </span>
                          {repo.cloneUrl && (
                            <a
                              href={repo.cloneUrl.replace(/\.git$/, "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: "#64748b" }}
                              title="Mở trên GitHub"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>

                        {/* Badges: Trạng thái & Nhánh */}
                        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {repo.isActive ? (
                            <span
                              className="ld-badge"
                              style={{ background: "#ecfdf5", color: "#047857", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <CheckCircle2 size={11} /> Active
                            </span>
                          ) : (
                            <span
                              className="ld-badge"
                              style={{ background: "#fef2f2", color: "#b91c1c", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <XCircle size={11} /> Inactive
                            </span>
                          )}

                          <span
                            className="ld-badge"
                            style={{ background: "#f1f5f9", color: "#334155", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <GitBranch size={11} /> {repo.defaultBranch || "main"}
                          </span>

                          {/* Huy hiệu cảnh báo Token của Repo */}
                          {repo.tokenStatus && repo.tokenStatus !== "CONNECTED" && (
                            <span
                              className="ld-badge"
                              style={{
                                background: "#fef2f2",
                                color: "#b91c1c",
                                border: "1px solid #fecaca",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontWeight: 700,
                              }}
                              title={repo.tokenWarningMessage || `Token ${repo.tokenStatus}`}
                            >
                              <AlertCircle size={11} /> Token {repo.tokenStatus}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Nút Sync lại */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSync(repo);
                        }}
                        disabled={isSyncing}
                        className="ld-btn ld-btn-secondary ld-btn-sm"
                        style={{
                          fontSize: 12,
                          gap: 5,
                          whiteSpace: "nowrap",
                          padding: "5px 10px",
                        }}
                      >
                        <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                        {isSyncing ? "Đang sync..." : "Sync lại"}
                      </button>
                    </div>

                    {/* Lần sync cuối */}
                    <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} />
                      <span>Lần sync cuối: <strong>{formatDateTime(repo.lastSyncedAt)}</strong></span>
                    </div>

                    {/* Thông báo sync của repo này */}
                    {syncMessage && syncMessage.id === repo.repositoryId && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          background: syncMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
                          color: syncMessage.type === "success" ? "#065f46" : "#991b1b",
                          border: `1px solid ${syncMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
                        }}
                      >
                        {syncMessage.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: CHI TIẾT TỪNG REPO (TABS: PULL REQUESTS & COMMITS) */}
        <div className="ld-card" style={{ padding: 18 }}>
          {selectedRepo ? (
            <div>
              {/* Header chi tiết repo */}
              <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                      Chi tiết kho lưu trữ
                    </span>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "2px 0 0" }}>
                      {selectedRepo.repoFullName}
                    </h2>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {selectedRepo.tokenStatus && selectedRepo.tokenStatus !== "CONNECTED" && (
                      <button
                        type="button"
                        onClick={handleRenewToken}
                        className="ld-btn ld-btn-sm"
                        style={{
                          background: "#dc2626",
                          color: "#ffffff",
                          fontSize: 12,
                          gap: 5,
                          border: "1px solid #ef4444",
                        }}
                      >
                        <AlertCircle size={12} /> Cấp lại quyền Token
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSync(selectedRepo)}
                      disabled={syncingId === selectedRepo.repositoryId}
                      className="ld-btn ld-btn-primary ld-btn-sm"
                      style={{ gap: 5, fontSize: 12 }}
                    >
                      <RefreshCw size={12} className={syncingId === selectedRepo.repositoryId ? "animate-spin" : ""} />
                      {syncingId === selectedRepo.repositoryId ? "Đang đồng bộ..." : "Đồng bộ ngay"}
                    </button>
                  </div>
                </div>

                {/* Tabs chuyển đổi PRs, Commits và Webhook Delivery Logs */}
                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("prs")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      cursor: "pointer",
                      background: activeTab === "prs" ? "#047857" : "#f1f5f9",
                      color: activeTab === "prs" ? "#ffffff" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <GitPullRequest size={14} /> Pull Requests ({pullRequests.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("commits")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      cursor: "pointer",
                      background: activeTab === "commits" ? "#047857" : "#f1f5f9",
                      color: activeTab === "commits" ? "#ffffff" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <GitCommit size={14} /> Commits ({commits.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("webhooks")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      cursor: "pointer",
                      background: activeTab === "webhooks" ? "#047857" : "#f1f5f9",
                      color: activeTab === "webhooks" ? "#ffffff" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Webhook size={14} /> Webhook Delivery Logs ({webhookDeliveries.length})
                  </button>
                </div>
              </div>

              {/* Nội dung Tab */}
              {detailsLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 13 }}>
                  <RefreshCw className="animate-spin inline mr-2" size={16} /> Đang tải dữ liệu{" "}
                  {activeTab === "prs"
                    ? "Pull Requests"
                    : activeTab === "commits"
                    ? "Commits"
                    : "Webhook Delivery Logs"}...
                </div>
              ) : activeTab === "prs" ? (
                /* TAB 1: PULL REQUESTS */
                pullRequests.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b", fontSize: 13 }}>
                    <GitPullRequest size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                    <p>Chưa có Pull Request nào được đồng bộ từ GitHub về.</p>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>Bấm <strong>&quot;Sync lại&quot;</strong> để quét dữ liệu mới nhất.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflowY: "auto" }}>
                    {pullRequests.map((pr) => {
                      const isOpen = pr.state?.toUpperCase() === "OPEN";
                      return (
                        <div
                          key={pr.prId || pr.prNumber}
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            padding: "10px 14px",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                              <GitPullRequest
                                size={16}
                                style={{
                                  color: isOpen ? "#059669" : "#6b7280",
                                  marginTop: 2,
                                  flexShrink: 0,
                                }}
                              />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                                  #{pr.prNumber} {pr.title}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                  bởi <strong>{pr.authorUsername || "unknown"}</strong> • nhánh{" "}
                                  <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>
                                    {pr.headBranch}
                                  </code>{" "}
                                  vào{" "}
                                  <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>
                                    {pr.baseBranch}
                                  </code>
                                </div>

                                {selectedRepo && (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      marginTop: 8,
                                      paddingTop: 8,
                                      borderTop: "1px dashed #e2e8f0",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPrDiff(selectedRepo.repositoryId, pr.prNumber)}
                                      className="ld-btn ld-btn-secondary ld-btn-xs"
                                      style={{ fontSize: 11, padding: "3px 8px", background: "#f8fafc", border: "1px solid #cbd5e1" }}
                                      title="Kéo mã nguồn và unified diff của PR từ GitHub"
                                    >
                                      <FileDiff size={12} style={{ color: "#0284c7" }} />
                                      Kéo Git Diff
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPrAst(selectedRepo.repositoryId, pr.prNumber)}
                                      className="ld-btn ld-btn-secondary ld-btn-xs"
                                      style={{ fontSize: 11, padding: "3px 8px", background: "#f8fafc", border: "1px solid #cbd5e1" }}
                                      title="Phân tích AST & Bắt các thay đổi tài liệu trôi dạt"
                                    >
                                      <Zap size={12} style={{ color: "#f59e0b" }} />
                                      Phân tích AST
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPrPreviewComment(selectedRepo.repositoryId, pr.prNumber)}
                                      className="ld-btn ld-btn-secondary ld-btn-xs"
                                      style={{ fontSize: 11, padding: "3px 8px", background: "#f8fafc", border: "1px solid #cbd5e1" }}
                                      title="Xem trước GitHub Review Comment kèm khối ```suggestion"
                                    >
                                      <Code size={12} style={{ color: "#7c3aed" }} />
                                      Xem trước Review Bot
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPrBlocking(selectedRepo.repositoryId, pr.prNumber)}
                                      className="ld-btn ld-btn-secondary ld-btn-xs"
                                      style={{ fontSize: 11, padding: "3px 8px", background: "#f8fafc", border: "1px solid #cbd5e1" }}
                                      title="Kiểm tra xem PR có bị chặn merge theo chính sách tài liệu không"
                                    >
                                      <ShieldAlert size={12} style={{ color: "#dc2626" }} />
                                      Chặn PR Gate
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <span
                              className="ld-badge"
                              style={{
                                background: isOpen ? "#ecfdf5" : "#f1f5f9",
                                color: isOpen ? "#047857" : "#475569",
                                fontSize: 11,
                                textTransform: "uppercase",
                              }}
                            >
                              {pr.state}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : activeTab === "commits" ? (
                /* TAB 2: COMMITS */
                commits.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b", fontSize: 13 }}>
                    <GitCommit size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                    <p>Chưa có commit nào được lưu trong kho dữ liệu.</p>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>Bấm <strong>&quot;Sync lại&quot;</strong> để kéo các commit mới nhất.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
                    {commits.map((c) => (
                      <div
                        key={c.commitId || c.commitHash}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          padding: "10px 14px",
                          background: "#ffffff",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <GitCommit size={15} style={{ color: "#047857", marginTop: 2, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>
                                {c.commitMessage}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                                <strong>{c.authorName}</strong> • {formatDateTime(c.committedAt)}
                              </div>
                            </div>
                          </div>

                          <code
                            style={{
                              fontSize: 11,
                              fontFamily: "monospace",
                              background: "#f1f5f9",
                              padding: "2px 6px",
                              borderRadius: 4,
                              color: "#334155",
                              flexShrink: 0,
                            }}
                          >
                            {c.commitHash ? c.commitHash.substring(0, 7) : "hash"}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* TAB 3: WEBHOOK DELIVERY LOGS */
                webhookDeliveries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b", fontSize: 13 }}>
                    <Webhook size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                    <p>Chưa có lịch sử giao nhận GitHub Webhook nào cho kho lưu trữ này.</p>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>
                      Các sự kiện push / pull_request gửi tới <code>/api/webhooks/github</code> sẽ được ghi nhận tại đây.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflowY: "auto" }}>
                    {webhookDeliveries.map((d) => {
                      const isOk = d.status?.toUpperCase() === "SUCCESS";
                      return (
                        <div
                          key={d.id}
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            padding: "10px 14px",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                              <Webhook
                                size={15}
                                style={{
                                  color: isOk ? "#047857" : "#dc2626",
                                  marginTop: 2,
                                  flexShrink: 0,
                                }}
                              />
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                                    {d.eventType}
                                  </span>
                                  {d.deliveryId && (
                                    <code
                                      style={{
                                        fontSize: 11,
                                        background: "#f1f5f9",
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        color: "#475569",
                                      }}
                                    >
                                      {d.deliveryId}
                                    </code>
                                  )}
                                  {typeof d.latencyMs === "number" && (
                                    <span style={{ fontSize: 11, color: "#64748b" }}>
                                      • {d.latencyMs}ms
                                    </span>
                                  )}
                                </div>
                                {d.payloadSummary && (
                                  <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>
                                    {d.payloadSummary}
                                  </div>
                                )}
                                {d.errorMessage && (
                                  <div style={{ fontSize: 11.5, color: "#b91c1c", marginTop: 4 }}>
                                    Lỗi: {d.errorMessage}
                                  </div>
                                )}
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                                  {formatDateTime(d.deliveredAt)}
                                </div>
                              </div>
                            </div>

                            <span
                              className="ld-badge"
                              style={{
                                background: isOk ? "#ecfdf5" : "#fef2f2",
                                color: isOk ? "#047857" : "#b91c1c",
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {d.status} ({d.httpStatus})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b", fontSize: 13 }}>
              Vui lòng chọn một repository ở cột bên trái để xem chi tiết Pull Requests và Commits.
            </div>
          )}
        </div>
      </div>

      {/* MODAL THÊM REPOSITORY */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
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
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
              Thêm Repository vào Workspace
            </h3>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>
              Hệ thống sẽ kết nối với GitHub API để tự động bóc tách PR, Commits và hỗ trợ đồng bộ tài liệu liên tục.
            </p>

            {addError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddRepo} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Tên Repository (Owner/Repo) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  className="ld-input"
                  placeholder="ví dụ: LeNgocChau9/Java_UTH"
                  value={newRepoFullName}
                  onChange={(e) => setNewRepoFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Nhánh mặc định (Default Branch)
                </label>
                <input
                  className="ld-input"
                  placeholder="main hoặc master"
                  value={newDefaultBranch}
                  onChange={(e) => setNewDefaultBranch(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  GitHub Personal Access Token (Tuỳ chọn cho Private Repo)
                </label>
                <input
                  type="password"
                  className="ld-input"
                  placeholder="ghp_... (nếu để trống sẽ dùng token OAuth mặc định)"
                  value={newGithubToken}
                  onChange={(e) => setNewGithubToken(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="ld-btn ld-btn-secondary"
                  disabled={addingRepo}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="ld-btn ld-btn-primary"
                  disabled={addingRepo}
                  style={{ gap: 6 }}
                >
                  {addingRepo && <RefreshCw size={13} className="animate-spin" />}
                  {addingRepo ? "Đang thêm..." : "Thêm Repository"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal hiển thị chi tiết API CodeDiff / Bot Review / PR Merge Blocking */}
      {prModalState.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setPrModalState((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 850,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GitPullRequest size={18} style={{ color: "#087f5b" }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  {prModalState.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPrModalState((prev) => ({ ...prev, isOpen: false }))}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 4,
                  color: "#64748b",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {prModalState.loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px", color: "#087f5b" }} />
                  <p style={{ fontSize: 14 }}>Đang kết nối GitHub & Phân tích hệ thống...</p>
                </div>
              ) : prModalState.data?.error ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Đã xảy ra lỗi:</div>
                  <div>{prModalState.data.error}</div>
                </div>
              ) : (
                <div>
                  {/* 1. Kéo Git Diff */}
                  {prModalState.type === "diff" && (
                    <div>
                      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                        <span className="ld-badge" style={{ background: "#ecfdf5", color: "#047857" }}>
                          PR #{prModalState.data?.prNumber || prModalState.prNumber}
                        </span>
                        <span className="ld-badge" style={{ background: "#f1f5f9", color: "#334155" }}>
                          Nhánh: {prModalState.data?.baseBranch || "base"} ← {prModalState.data?.headBranch || "head"}
                        </span>
                        <span className="ld-badge" style={{ background: "#f0f9ff", color: "#0284c7" }}>
                          Files thay đổi: {prModalState.data?.changedFilesCount ?? (prModalState.data?.files?.length || 0)}
                        </span>
                      </div>

                      <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13, color: "#334155" }}>
                        Unified Git Diff Snippet:
                      </div>
                      <pre
                        style={{
                          background: "#0f172a",
                          color: "#f8fafc",
                          padding: 14,
                          borderRadius: 8,
                          fontSize: 12,
                          lineHeight: 1.5,
                          overflowX: "auto",
                          maxHeight: 380,
                        }}
                      >
                        {prModalState.data?.diffSnippet ||
                          prModalState.data?.diffContent ||
                          (prModalState.data?.files && JSON.stringify(prModalState.data.files, null, 2)) ||
                          "// Không có nội dung diff"}
                      </pre>
                    </div>
                  )}

                  {/* 2. Phân tích AST & Bắt sai lệch */}
                  {prModalState.type === "ast" && (
                    <div>
                      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                        <span className="ld-badge" style={{ background: "#ecfdf5", color: "#047857" }}>
                          Số tài liệu trôi dạt: {prModalState.data?.affectedDocsCount ?? (prModalState.data?.driftAlerts?.length || 0)}
                        </span>
                        <span className="ld-badge" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                          Trạng thái AST: {prModalState.data?.status || "Đã phân tích"}
                        </span>
                      </div>

                      <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13, color: "#334155" }}>
                        Kết quả phân tích trôi dạt AST:
                      </div>
                      <pre
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          color: "#0f172a",
                          padding: 14,
                          borderRadius: 8,
                          fontSize: 12,
                          lineHeight: 1.5,
                          overflowX: "auto",
                          maxHeight: 380,
                        }}
                      >
                        {JSON.stringify(prModalState.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* 3. Xem trước Review Bot */}
                  {prModalState.type === "preview" && (
                    <div>
                      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "#64748b" }}>
                          Nội dung bình luận review inline GitHub (kèm khối ```suggestion vá tài liệu trực tiếp):
                        </span>
                        <button
                          type="button"
                          disabled={isPostingReview}
                          onClick={() => handlePostReviewComment(prModalState.repoId!, prModalState.prNumber!)}
                          className="ld-btn ld-btn-primary ld-btn-sm"
                          style={{ background: "#087f5b", color: "#fff", gap: 6, fontSize: 12, fontWeight: 600 }}
                        >
                          {isPostingReview ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" />
                              Đang đăng lên GitHub...
                            </>
                          ) : (
                            <>
                              <ExternalLink size={13} />
                              Đăng Inline Review lên GitHub (/pulls/{prModalState.prNumber}/reviews)
                            </>
                          )}
                        </button>
                      </div>

                      <div
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          background: "#ffffff",
                          padding: 16,
                          maxHeight: 400,
                          overflowY: "auto",
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            fontSize: 12,
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            color: "#1e293b",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          }}
                        >
                          {prModalState.data?.previewComment ||
                            prModalState.data?.commentBody ||
                            prModalState.data?.body ||
                            JSON.stringify(prModalState.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* 4. Đánh giá Chặn PR Merge Gate */}
                  {prModalState.type === "blocking" && (
                    <div>
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 8,
                          marginBottom: 16,
                          background: prModalState.data?.canMerge || prModalState.data?.decision === "ALLOWED" ? "#ecfdf5" : "#fef2f2",
                          border: `1px solid ${prModalState.data?.canMerge || prModalState.data?.decision === "ALLOWED" ? "#a7f3d0" : "#fecaca"}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        {prModalState.data?.canMerge || prModalState.data?.decision === "ALLOWED" ? (
                          <CheckCircle2 size={24} style={{ color: "#047857" }} />
                        ) : (
                          <ShieldAlert size={24} style={{ color: "#dc2626" }} />
                        )}
                        <div>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: prModalState.data?.canMerge || prModalState.data?.decision === "ALLOWED" ? "#065f46" : "#991b1b",
                            }}
                          >
                            Kết luận Gate: {prModalState.data?.canMerge || prModalState.data?.decision === "ALLOWED" ? "CHO PHÉP MERGE (ALLOWED)" : "CHẶN MERGE (BLOCKED)"}
                          </div>
                          <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                            {prModalState.data?.reason || prModalState.data?.message || "Đã kiểm tra chất lượng tài liệu so với mã nguồn."}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13, color: "#334155" }}>
                        Chi tiết đánh giá chính sách tài liệu:
                      </div>
                      <pre
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          color: "#0f172a",
                          padding: 14,
                          borderRadius: 8,
                          fontSize: 12,
                          lineHeight: 1.5,
                          overflowX: "auto",
                          maxHeight: 280,
                        }}
                      >
                        {JSON.stringify(prModalState.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setPrModalState((prev) => ({ ...prev, isOpen: false }))}
                className="ld-btn ld-btn-secondary ld-btn-sm"
                style={{ fontSize: 12, padding: "6px 14px" }}
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
