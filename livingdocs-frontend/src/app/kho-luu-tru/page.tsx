"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  repoService,
  RepoItem,
  PullRequestItem,
  CommitItem,
  SyncResult,
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
  X,
} from "lucide-react";

export default function RepoManagementPage() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [activeTab, setActiveTab] = useState<"prs" | "commits">("prs");

  // Pull Requests & Commits data for selected repo
  const [pullRequests, setPullRequests] = useState<PullRequestItem[]>([]);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);

  // Sync state
  const [syncingId, setSyncingId] = useState<number | null>(null);
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
      // Fallback demo sample if backend is empty
      const fallback: RepoItem[] = [
        {
          repositoryId: 1,
          workspaceId: 1,
          connectionId: 1,
          githubRepoId: 987654,
          repoName: "Java_UTH",
          repoFullName: "LeNgocChau9/Java_UTH",
          defaultBranch: "main",
          cloneUrl: "https://github.com/LeNgocChau9/Java_UTH.git",
          isActive: true,
          autoDocEnabled: true,
          lastSyncedAt: new Date(Date.now() - 3600000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setRepos(fallback);
      if (!selectedRepo) setSelectedRepo(fallback[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepositories();
  }, []);

  // Khi chọn repo thì tải PRs & Commits
  useEffect(() => {
    if (!selectedRepo) return;
    const fetchRepoDetails = async () => {
      setDetailsLoading(true);
      try {
        const [prs, cms] = await Promise.all([
          repoService.getRepoPullRequests(selectedRepo.repositoryId).catch(() => []),
          repoService.getRepoCommits(selectedRepo.repositoryId).catch(() => []),
        ]);
        setPullRequests(prs);
        setCommits(cms);
      } catch (err) {
        console.error("Lỗi tải chi tiết PR / Commit:", err);
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
      const result: SyncResult = await repoService.syncRepository(repo.repositoryId);
      setSyncMessage({
        id: repo.repositoryId,
        text: `Đã sync thành công: ${result.syncedPullRequestsCount} PRs, ${result.syncedCommitsCount} Commits!`,
        type: "success",
      });

      // Cập nhật lại repo list & reload chi tiết nếu đang chọn
      await loadRepositories();
      if (selectedRepo?.repositoryId === repo.repositoryId) {
        const [prs, cms] = await Promise.all([
          repoService.getRepoPullRequests(repo.repositoryId),
          repoService.getRepoCommits(repo.repositoryId),
        ]);
        setPullRequests(prs);
        setCommits(cms);
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
      const safeText = isExpired
        ? "Phiên đăng nhập đã hết hạn"
        : rawMsg.includes("{") || rawMsg.toLowerCase().includes("github api")
        ? "Đồng bộ thất bại. Vui lòng thử lại sau!"
        : rawMsg || "Sync thất bại. Vui lòng thử lại!";
      setSyncMessage({
        id: repo.repositoryId,
        text: safeText,
        type: "error",
      });
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
          <p className="ld-page-subtitle">
            Quản lý các kho mã nguồn đã kết nối, theo dõi Pull Requests, lịch sử Commits và đồng bộ tự động
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="ld-btn ld-btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={16} /> Thêm Repository
        </button>
      </div>

      {/* Grid 2 cột: Cột trái Danh sách repo - Cột phải Chi tiết Tab */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
        
        {/* CỘT TRÁI: DANH SÁCH REPOS */}
        <div className="ld-card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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

                {/* Tabs chuyển đổi PRs và Commits */}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
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
                </div>
              </div>

              {/* Nội dung Tab */}
              {detailsLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 13 }}>
                  <RefreshCw className="animate-spin inline mr-2" size={16} /> Đang tải dữ liệu {activeTab === "prs" ? "Pull Requests" : "Commits"}...
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
              ) : (
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
    </AppShell>
  );
}
