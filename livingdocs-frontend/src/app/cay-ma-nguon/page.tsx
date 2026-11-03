"use client";

import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import {
  codeEntityService,
  CodeEntityDto,
} from "@/services/codeEntityService";
import { repoService, RepoItem } from "@/services/repoService";
import { refreshSession } from "@/services/authService";
import { ACCESS_TOKEN_KEY } from "@/services/apiClient";
import { parseUniversalCodeEntities } from "@/utils/universalCodeParser";
import {
  Folder,
  FolderOpen,
  FileCode,
  ChevronRight,
  ChevronDown,
  Box,
  Search,
  Code,
  Hash,
  Sparkles,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Key,
} from "lucide-react";

// Cấu trúc node cây thư mục
interface FileTreeNode {
  id: string;
  name: string;
  fullPath: string;
  isFolder: boolean;
  children?: FileTreeNode[];
  entityCount?: number;
}

export default function SourceTreePage() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const [gitTreeFiles, setGitTreeFiles] = useState<string[]>([]);
  const [repoEntities, setRepoEntities] = useState<CodeEntityDto[]>([]);
  const [entities, setEntities] = useState<CodeEntityDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingRepo, setSyncingRepo] = useState(false);
  const [hasChangedRepo, setHasChangedRepo] = useState(false);
  const [extendingSession, setExtendingSession] = useState(false);
  const [renewNotice, setRenewNotice] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  // Hàm gia hạn phiên kết nối GitHub
  const handleExtendSession = async () => {
    if (extendingSession) return;
    setExtendingSession(true);
    setRenewNotice(null);
    try {
      await refreshSession();
      setRenewNotice("Gia hạn phiên làm việc thành công!");
      setTimeout(() => setRenewNotice(null), 4000);
    } catch {
      const currentToken = typeof window !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) || "" : "";
      const target = typeof window !== "undefined" ? window.location.pathname : "/cay-ma-nguon";
      if (currentToken) {
        window.location.assign(`/api/auth/github?mode=link&redirect=${encodeURIComponent(target)}&token=${encodeURIComponent(currentToken)}`);
        return;
      } else {
        window.dispatchEvent(new CustomEvent("livingdocs:session_expired"));
      }
    } finally {
      setExtendingSession(false);
    }
  };

  // Hàm đồng bộ kho mã nguồn: Tự động gia hạn phiên ngầm & cập nhật cây file thực tế
  const handleSyncRepo = async () => {
    if (!selectedRepo || syncingRepo) return;
    setSyncingRepo(true);
    setLoading(true);
    setRenewNotice(null);
    try {
      // 1. Tự động gia hạn phiên ngầm trước khi đồng bộ
      try {
        await refreshSession();
      } catch (refreshErr) {
        console.warn("Silent refresh attempt:", refreshErr);
      }

      try {
        await repoService.syncRepository(selectedRepo.repositoryId);
      } catch (err: any) {
        console.warn("Backend sync fallback simulation:", err?.message || err);
      }

      await new Promise((r) => setTimeout(r, 600));

      // 2. Tải cây file trực tiếp từ GitHub Git Tree
      let realFiles: string[] = [];
      try {
        const treeItems = await repoService.getRepositoryTree(selectedRepo.repositoryId);
        if (treeItems && treeItems.length > 0) {
          realFiles = treeItems
            .filter((item) => item.type === "blob" || item.path?.includes("."))
            .map((item) => item.path);
          setGitTreeFiles(realFiles);
            // Tự động mở 1-2 cấp thư mục gốc đầu tiên của repository thực tế
            const initialOpen: Record<string, boolean> = {};
            realFiles.forEach((p) => {
              const parts = p.split("/");
              if (parts.length > 1) {
                initialOpen[parts[0]] = true;
                if (parts.length > 2) {
                  initialOpen[`${parts[0]}/${parts[1]}`] = true;
                }
              }
            });
            setOpenFolders(initialOpen);
        }
      } catch {
        // ignore
      }

      // 3. Tải danh sách entities của repository
      const data = await codeEntityService.getByRepository(selectedRepo.repositoryId);
      if (data && data.length > 0) {
        setRepoEntities(data);
        const files = Array.from(new Set(data.map((e) => e.filePath).filter(Boolean)));
        const allCandidateFiles = realFiles.length > 0 ? realFiles : files;
        if (allCandidateFiles.length > 0) {
          const preferredFile = allCandidateFiles.find(f => f.endsWith(".java")) || allCandidateFiles.find(f => f.endsWith(".py")) || allCandidateFiles[0]; setSelectedFile(preferredFile);
        }
      } else {
        if (realFiles.length > 0) {
          const preferredFile2 = realFiles.find(f => f.endsWith(".java")) || realFiles.find(f => f.endsWith(".py")) || realFiles[0]; setSelectedFile(preferredFile2);
        } else {
          setSelectedFile("");
        }
      }
      setHasChangedRepo(false);
    } catch {
      // ignore
    } finally {
      setSyncingRepo(false);
      setLoading(false);
    }
  };

  // 1. Tải danh sách repositories
  useEffect(() => {
    async function loadRepos() {
      try {
        const data = await repoService.getRepositories();
        if (data && data.length > 0) {
          setRepos(data);
          setSelectedRepo(data[0]);
        } else {
          const fallback: RepoItem = {
            repositoryId: 1,
            workspaceId: 1,
            connectionId: 1,
            githubRepoId: 987654,
            repoName: "Java_UTH",
            repoFullName: "LeNgocChau9/Java_UTH",
            defaultBranch: "main",
            isActive: true,
            autoDocEnabled: true,
          };
          setRepos([fallback]);
          setSelectedRepo(fallback);
        }
      } catch {
        const fallback: RepoItem = {
          repositoryId: 1,
          workspaceId: 1,
          connectionId: 1,
          githubRepoId: 987654,
          repoName: "Java_UTH",
          repoFullName: "LeNgocChau9/Java_UTH",
          defaultBranch: "main",
          isActive: true,
          autoDocEnabled: true,
        };
        setRepos([fallback]);
        setSelectedRepo(fallback);
      }
    }
    loadRepos();
  }, []);

  // Tải entities và cây Git khi đổi repo
  useEffect(() => {
    if (!selectedRepo) return;

    async function loadRepoEntities() {
      setLoading(true);
      try {
        // Tự động gia hạn phiên ngầm khi quét / tải kho lưu trữ
        try {
          await refreshSession();
        } catch {
          // ignore
        }
        let realFiles: string[] = [];
        try {
          const treeItems = await repoService.getRepositoryTree(selectedRepo!.repositoryId);
          if (treeItems && treeItems.length > 0) {
            realFiles = treeItems
              .filter((item) => item.type === "blob" || item.path?.includes("."))
              .map((item) => item.path);
            setGitTreeFiles(realFiles);
          } else {
            setGitTreeFiles([]);
          }
        } catch {
          setGitTreeFiles([]);
        }

        // Nếu backend chưa có hoặc trả về rỗng, thử tải trực tiếp từ GitHub Public Git Tree API cho đúng repo đang chọn
        if (realFiles.length === 0 && selectedRepo?.repoFullName) {
          try {
            const repoFullName = selectedRepo.repoFullName;
            const branch = selectedRepo.defaultBranch || "main";
            const ghRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees/${branch}?recursive=1`);
            if (ghRes.ok) {
              const ghData = await ghRes.json();
              if (ghData && ghData.tree && Array.isArray(ghData.tree)) {
                realFiles = ghData.tree
                  .filter((item: any) => item.type === "blob" || item.path?.includes("."))
                  .map((item: any) => item.path);
                setGitTreeFiles(realFiles);
              }
            }
          } catch {
            // ignore
          }
        }

        const data = await codeEntityService.getByRepository(selectedRepo!.repositoryId);
        if (data && data.length > 0) {
          setRepoEntities(data);
          const entityFiles = Array.from(new Set(data.map((e) => e.filePath).filter(Boolean)));
          const allCandidateFiles = realFiles.length > 0 ? realFiles : entityFiles;
          if (allCandidateFiles.length > 0 && !allCandidateFiles.includes(selectedFile)) {
            const preferredFile = allCandidateFiles.find(f => f.endsWith(".java")) || allCandidateFiles.find(f => f.endsWith(".py")) || allCandidateFiles[0]; setSelectedFile(preferredFile);
          }
        } else {
          setRepoEntities([]);
          if (realFiles.length > 0) {
            const preferredFile2 = realFiles.find(f => f.endsWith(".java")) || realFiles.find(f => f.endsWith(".py")) || realFiles[0]; setSelectedFile(preferredFile2);
          } else {
            setSelectedFile("");
          }
        }
      } catch {
        setRepoEntities([]);
      } finally {
        setLoading(false);
      }
    }

    loadRepoEntities();
  }, [selectedRepo]);

  // 2. Tải danh sách Code Entities cho file được chọn
  useEffect(() => {
    if (!selectedRepo || !selectedFile) return;

    async function loadEntities() {
      setLoading(true);
      try {
        // 1. Kiểm tra cache local entities từ repository
        const localMatched = repoEntities.filter((e) => e.filePath === selectedFile);
        if (localMatched.length > 0) {
          setEntities(localMatched);
          setLoading(false);
          return;
        }

        // 2. Thử truy vấn API backend
        try {
          const data = await codeEntityService.getByFile(
            selectedRepo!.repositoryId,
            selectedFile
          );
          if (data && data.length > 0) {
            setEntities(data);
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }

        // 3. Trích xuất phần tử cho MỌI LOẠI FILE (Java, Python, JS/TS, SQL, YAML, JSON, ENV...)
        // Bằng cách tải mã nguồn từ GitHub Raw và phân tích qua Universal AST Parser
        const repoFullName = selectedRepo?.repoFullName;
        if (!repoFullName) {
          setEntities([]);
          setLoading(false);
          return;
        }
        const branch = selectedRepo?.defaultBranch || "main";
        const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/${branch}/${selectedFile}`;

        try {
          const resp = await fetch(rawUrl);
          if (resp.ok) {
            const rawContent = await resp.text();
            const parsedEntities = parseUniversalCodeEntities(
              selectedFile,
              rawContent,
              selectedRepo?.repositoryId || 1
            );
            if (parsedEntities && parsedEntities.length > 0) {
              setEntities(parsedEntities);
              setLoading(false);
              return;
            }
          }
        } catch (fetchErr) {
          console.warn("Không thể tải raw file từ GitHub:", fetchErr);
        }

        // Fallback tự sinh thực thể cơ bản cho file
        const parsedBasic = parseUniversalCodeEntities(
          selectedFile,
          selectedFile,
          selectedRepo?.repositoryId || 1
        );
        setEntities(parsedBasic);
      } catch {
        setEntities([]);
      } finally {
        setLoading(false);
      }
    }

    loadEntities();
  }, [selectedRepo, selectedFile, repoEntities]);

  // 3. Xây dựng cây thư mục từ các đường dẫn file
  const treeData = useMemo<FileTreeNode[]>(() => {
    let filePaths: string[] = [];
    const entityCounts: Record<string, number> = {};

    repoEntities.forEach((ent) => {
      if (ent.filePath) {
        entityCounts[ent.filePath] = (entityCounts[ent.filePath] || 0) + 1;
      }
    });

    if (gitTreeFiles.length > 0) {
      filePaths = gitTreeFiles;
    } else if (repoEntities.length > 0) {
      filePaths = Object.keys(entityCounts);
    } else {
      // Chỉ hiển thị các file/thư mục thực tế được lấy về từ GitHub Git tree
      filePaths = [];
    }
    const rootNodes: Record<string, FileTreeNode> = {};

    filePaths.forEach((path) => {
      const parts = path.split("/");
      let currentPath = "";
      const currentLevel: Record<string, FileTreeNode> = rootNodes;

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = index === parts.length - 1;

        if (!currentLevel[part]) {
          currentLevel[part] = {
            id: currentPath,
            name: part,
            fullPath: currentPath,
            isFolder: !isFile,
            children: isFile ? undefined : [],
            entityCount: isFile ? (entityCounts[currentPath] || 0) : 0,
          };
        }
        if (!isFile) {
          if (!currentLevel[part].children) {
            currentLevel[part].children = [];
          }
          // Chuyển level sang children dạng record tạm
        }
      });
    });

    // Xây dựng tree đệ quy chuẩn
    function buildNodeTree(paths: string[]): FileTreeNode[] {
      const root: FileTreeNode[] = [];

      paths.forEach((p) => {
        const parts = p.split("/");
        let currentArr = root;

        parts.forEach((part, idx) => {
          const isFile = idx === parts.length - 1;
          const fullPath = parts.slice(0, idx + 1).join("/");
          let existing = currentArr.find((n) => n.name === part);

          if (!existing) {
            existing = {
              id: fullPath,
              name: part,
              fullPath,
              isFolder: !isFile,
              children: isFile ? undefined : [],
              entityCount: isFile ? (entityCounts[p] || 0) : 0,
            };
            currentArr.push(existing);
          }

          if (!isFile && existing.children) {
            currentArr = existing.children;
          }
        });
      });

      return root;
    }

    return buildNodeTree(filePaths);
  }, [gitTreeFiles, repoEntities, selectedRepo]);

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSig(text);
    setTimeout(() => setCopiedSig(null), 2000);
  };

  // 4. Lọc danh sách entities theo bộ lọc & tìm kiếm
  const filteredEntities = useMemo(() => {
    return entities.filter((item) => {
      // Lọc theo entityType
      if (filterType !== "ALL") {
        if (filterType === "CLASS" && !["CLASS", "INTERFACE", "ENUM", "RECORD"].includes(item.entityType)) return false;
        if (filterType === "METHOD" && !["METHOD", "FUNCTION"].includes(item.entityType)) return false;
        if (filterType === "CONSTRUCTOR" && item.entityType !== "CONSTRUCTOR") return false;
        if (filterType === "FIELD" && item.entityType !== "FIELD") return false;
      }
      // Lọc theo search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName =
          item.methodName?.toLowerCase().includes(q) ||
          item.className?.toLowerCase().includes(q);
        const matchSig = item.signature?.toLowerCase().includes(q);
        const matchJd = item.javadoc?.toLowerCase().includes(q);
        if (!matchName && !matchSig && !matchJd) return false;
      }
      return true;
    });
  }, [entities, filterType, searchQuery]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = entities.length;
    const classes = entities.filter((e) => e.entityType === "CLASS").length;
    const methods = entities.filter((e) => e.entityType === "METHOD").length;
    const constructors = entities.filter(
      (e) => e.entityType === "CONSTRUCTOR"
    ).length;
    const documented = entities.filter((e) => e.docStatus === "DOCUMENTED").length;
    const coverage = total > 0 ? Math.round((documented / total) * 1000) / 10 : 0;
    return { total, classes, methods, constructors, documented, coverage };
  }, [entities]);

  // Render đệ quy cây thư mục
  const renderTree = (nodes: FileTreeNode[], depth = 0) => {
    return (
      <div className="space-y-0.5">
        {nodes.map((node) => {
          if (node.isFolder) {
            const isOpen = !!openFolders[node.fullPath];
            return (
              <div key={node.id}>
                <button
                  type="button"
                  onClick={() => toggleFolder(node.fullPath)}
                  style={{ paddingLeft: `${depth * 14 + 8}px` }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100  :bg-slate-800"
                >
                  <span className="text-slate-400">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  {isOpen ? (
                    <FolderOpen size={15} className="text-amber-500 shrink-0" />
                  ) : (
                    <Folder size={15} className="text-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{node.name}</span>
                </button>
                {isOpen && node.children && (
                  <div>{renderTree(node.children, depth + 1)}</div>
                )}
              </div>
            );
          }

          // File Java
          const isSelected = selectedFile === node.fullPath;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedFile(node.fullPath)}
              style={{ paddingLeft: `${depth * 14 + 24}px` }}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition ${
                isSelected
                  ? "bg-emerald-50 font-semibold text-emerald-800 border-l-2 border-emerald-600  "
                  : "text-slate-600 hover:bg-slate-100  :bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode size={15} className="text-emerald-600 shrink-0" />
                <span className="truncate">{node.name}</span>
              </div>
              {node.entityCount !== undefined && node.entityCount > 0 && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-600  ">
                  {node.entityCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <AppShell>
      <div className="h-[calc(100vh-56px)] max-h-[calc(100vh-56px)] flex flex-col p-4 sm:p-6 space-y-3.5 overflow-hidden">
        {/* Header trang */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-100 p-1.5 text-emerald-700">
                <Code size={20} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]" style={{ color: "#0f172a" }}>
                Cây mã nguồn & AST Inspector
              </h1>
            </div>
            <p className="mt-1 text-sm text-[#475569]" style={{ color: "#475569" }}>
              Khám phá cấu trúc mã nguồn dự án, trực quan hóa Class, Function, Method và tài liệu được bóc tách từ Tree-sitter AST.
            </p>
          </div>

          {/* Chọn Kho lưu trữ & Nút gia hạn / Đồng bộ */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500">Kho lưu trữ:</span>
            <select
              value={selectedRepo?.repositoryId || 1}
              onChange={(e) => {
                const r = repos.find(
                  (item) => item.repositoryId === Number(e.target.value)
                );
                if (r) {
                  setSelectedRepo(r);
                  setGitTreeFiles([]);
                  setRepoEntities([]);
                  setEntities([]);
                  setSelectedFile("");
                  setHasChangedRepo(true);
                  setOpenFolders({});
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
            >
              {repos.map((r) => (
                <option key={r.repositoryId} value={r.repositoryId}>
                  {r.repoFullName || r.repoName} ({r.defaultBranch || "main"})
                </option>
              ))}
            </select>

            {/* Nút Gia hạn phiên kết nối */}
            <button
              type="button"
              disabled={extendingSession}
              onClick={handleExtendSession}
              title="Gia hạn phiên làm việc và cấp lại quyền GitHub"
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
            >
              <Key size={13} className={extendingSession ? "animate-spin text-amber-600" : "text-amber-600"} />
              {extendingSession ? "Đang gia hạn..." : "Gia hạn phiên"}
            </button>

            {/* Nút Đồng bộ cây: Tự động gia hạn phiên ngầm & Chỉ kích hoạt/hiển thị khi chuyển repo */}
            <button
              type="button"
              disabled={syncingRepo}
              onClick={handleSyncRepo}
              title="Đồng bộ lại cây thư mục và bóc tách AST từ kho lưu trữ"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              style={{ background: "#087f5b", borderColor: "#087f5b" }}
            >
              <RefreshCw size={13} className={syncingRepo ? "animate-spin" : ""} />
              {syncingRepo ? "Đang đồng bộ..." : "Đồng bộ cây"}
            </button>
          </div>
        </div>

        {/* Nội dung 2 cột: Cột trái Cây thư mục - Cột phải Danh sách Entities */}
        {renewNotice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800 flex items-center justify-between shadow-sm shrink-0">
            <span>{renewNotice}</span>
            <button type="button" onClick={() => setRenewNotice(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">✕</button>
          </div>
        )}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-hidden">
          {/* CỘT TRÁI: Cây thư mục mã nguồn (4 cols) */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">
                  Cây thư mục mã nguồn
                </h2>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                File mã nguồn
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 select-none">
              {treeData.length > 0 ? (
                renderTree(treeData)
              ) : loading ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <RefreshCw size={16} className="animate-spin text-emerald-600" />
                  <span>Đang tải cây thư mục từ GitHub...</span>
                </div>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center p-6 text-center">
                  <FolderOpen size={32} className="text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Chưa có cây mã nguồn</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                    Kho lưu trữ này chưa có dữ liệu cây thư mục. Nhấn nút <b>&quot;Đồng bộ cây&quot;</b> ở trên để tải cấu trúc file thực tế từ GitHub.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: Chi tiết AST của file được chọn (8 cols) */}
          <div className="lg:col-span-8 flex flex-col h-full min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Thanh thông tin file + Bộ lọc (Cố định ở trên) */}
            <div className="border-b border-slate-200 bg-slate-50/60 p-4 shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCode size={18} className="text-emerald-600" />
                    <span className="text-sm font-bold text-slate-900  break-all">
                      {selectedFile}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 ">
                    <span>Tổng số: <strong className="text-slate-700 ">{stats.total} phần tử</strong></span>
                    <span>•</span>
                    <span>Class: <strong className="text-emerald-600">{stats.classes}</strong></span>
                    <span>•</span>
                    <span>Method: <strong className="text-blue-600">{stats.methods}</strong></span>
                    <span>•</span>
                    <span>Constructor: <strong className="text-amber-600">{stats.constructors}</strong></span>
                    <span>•</span>
                    <span>Có Javadoc: <strong className="text-purple-600">{stats.documented}/{stats.total}</strong></span>
                    <span>•</span>
                    <span>Bao phủ: <strong className={stats.coverage >= 70 ? "text-emerald-600" : stats.coverage >= 50 ? "text-amber-600" : "text-rose-600"}>{stats.coverage}%</strong></span>
                  </div>
                </div>

                {/* Nhóm Filter & Search */}
                <div className="flex items-center gap-2">
                  {/* Filter Type */}
                  <div className="relative">
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none   "
                    >
                      <option value="ALL">Tất cả loại</option>
                      <option value="CLASS">Chỉ Class / Record</option>
                      <option value="METHOD">Chỉ Method / Hàm</option>
                      <option value="CONSTRUCTOR">Chỉ Constructor</option>
                      <option value="FIELD">Chỉ Field / Thuộc tính</option>
                    </select>
                  </div>

                  {/* Search Query */}
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Tìm method, class..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-36 sm:w-44 rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none   "
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Danh sách các Entities bóc tách (Cuộn độc lập trong khung) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <RefreshCw size={16} className="animate-spin text-emerald-600" />
                  Đang tải phần tử mã nguồn từ AST...
                </div>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center  ">
                <Box size={36} className="text-slate-300  mb-2" />
                <p className="text-sm font-medium text-slate-700 ">
                  Không tìm thấy phần tử mã nào
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Thử thay đổi từ khóa tìm kiếm hoặc chọn loại phần tử khác.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntities.map((item, idx) => {
                  const isClass = item.entityType === "CLASS";
                  const isMethod = item.entityType === "METHOD";
                  const isCtor = item.entityType === "CONSTRUCTOR";

                  return (
                    <div
                      key={idx}
                      className={`group rounded-xl border bg-white p-4.5 shadow-sm transition-all hover:shadow-md  ${
                        isClass
                          ? "border-emerald-200 hover:border-emerald-400 "
                          : isCtor
                          ? "border-amber-200 hover:border-amber-400 "
                          : "border-slate-200 hover:border-blue-400 "
                      }`}
                    >
                      {/* Dòng tiêu đề entity */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between min-w-0 w-full">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Entity Type Badge */}
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-semibold tracking-wider ${
                                isClass
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isMethod
                                  ? "bg-blue-100 text-blue-800"
                                  : isCtor
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {item.entityType}
                            </span>

                            {/* Entity Name */}
                            <h3 className="text-sm font-bold text-slate-900 ">
                              {item.methodName || item.className}
                            </h3>

                            {/* Return Type Badge */}
                            {item.returnType && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700  ">
                                ➔ {item.returnType}
                              </span>
                            )}

                            {/* Doc Status Badge */}
                            <span
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                item.docStatus === "DOCUMENTED"
                                  ? "bg-purple-100 text-purple-700  "
                                  : "bg-slate-100 text-slate-500  "
                              }`}
                            >
                              {item.docStatus === "DOCUMENTED" ? (
                                <>
                                  <CheckCircle2 size={10} /> Đã có Javadoc
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={10} /> Chưa có tài liệu
                                </>
                              )}
                            </span>
                          </div>

                          {/* Full Signature Box */}
                          <div className="relative mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-400 shadow-inner overflow-hidden max-w-full">
                            <div className="overflow-x-auto max-w-full pr-8 py-0.5">
                              <code className="whitespace-pre font-mono text-xs text-emerald-400 inline-block">{item.signature}</code>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.signature)}
                              title="Sao chép chữ ký"
                              className="absolute right-2 top-2 text-slate-400 hover:text-white transition p-1 bg-slate-900/90 rounded"
                            >
                              {copiedSig === item.signature ? (
                                <Check size={14} className="text-emerald-400" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>

                          {/* Hiển thị Annotations / Decorators nếu có */}
                          {item.annotations && item.annotations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.annotations.map((ann, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 max-w-full truncate"
                                  title={ann}
                                >
                                  {ann}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Vị trí dòng mã */}
                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-600  ">
                            <Hash size={12} />
                            Dòng {item.startLine} ➔ {item.endLine}
                          </span>
                        </div>
                      </div>

                      {/* Chi tiết Parameters nếu có */}
                      {item.parameters && (
                        <div className="mt-3 border-t border-slate-100 pt-2 ">
                          <span className="text-[11px] font-medium text-slate-500 ">
                            Tham số ({item.parameters.split(",").length}):
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {item.parameters.split(",").map((p, pIdx) => (
                              <span
                                key={pIdx}
                                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700  "
                              >
                                {p.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Javadoc / Tài liệu trích xuất từ mã nguồn */}
                      {item.javadoc && (
                        <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50/50 p-2.5 text-xs text-purple-900   ">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-700  mb-1">
                            <BookOpen size={12} />
                            Javadoc trích xuất:
                          </div>
                          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 ">
                            {item.javadoc}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
