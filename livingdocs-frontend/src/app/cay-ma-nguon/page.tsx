"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  codeEntityService,
  CodeEntityDto,
  EntityDocRegenerateResponse,
} from "@/services/codeEntityService";
import { repoService, RepoItem } from "@/services/repoService";
import { refreshSession } from "@/services/authService";
import { ACCESS_TOKEN_KEY } from "@/services/apiClient";
import { parseUniversalCodeEntities } from "@/utils/universalCodeParser";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileSpreadsheet,
  FileJson,
  Database,
  Settings,
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
  FolderGit2,
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
  const [treeSearch, setTreeSearch] = useState<string>("");
  const [wideTree, setWideTree] = useState(false);

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
  const [currentFileSource, setCurrentFileSource] = useState<string>("");
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [regeneratedResults, setRegeneratedResults] = useState<
    Record<string, EntityDocRegenerateResponse>
  >({});
  const [activeRegenResult, setActiveRegenResult] =
    useState<EntityDocRegenerateResponse | null>(null);
  const [activeRegenEntity, setActiveRegenEntity] =
    useState<CodeEntityDto | null>(null);
  const [customInstruction, setCustomInstruction] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"section" | "full">("section");
  const [regenError, setRegenError] = useState<string | null>(null);

  const getEntityKey = (item: CodeEntityDto) =>
    `${item.entityId || "local"}:${item.filePath}:${item.entityType}:${item.className || ""}:${item.methodName || ""}:${item.signature}`;

  // Hàm gọi AI tạo lại tài liệu cục bộ cho thực thể được chọn trên Cây mã nguồn
  const handleRegenerateEntityDoc = async (
    item: CodeEntityDto,
    instructionOverride?: string
  ) => {
    if (!selectedRepo) return;
    const key = getEntityKey(item);
    if (regeneratingKey === key) return;

    setRegeneratingKey(key);
    setRegenError(null);
    setActiveRegenEntity(item);

    try {
      const res = await codeEntityService.regenerateEntityDoc({
        entityId: item.entityId,
        repositoryId: item.repositoryId || selectedRepo.repositoryId,
        filePath: item.filePath || selectedFile,
        entityType: item.entityType,
        className: item.className,
        methodName: item.methodName,
        signature: item.signature,
        returnType: item.returnType,
        parameters: item.parameters,
        startLine: item.startLine,
        endLine: item.endLine,
        javadoc: item.javadoc,
        sourceCode: currentFileSource || item.signature,
        commitHash: item.commitHash || selectedRepo.defaultBranch || "main",
        instruction:
          instructionOverride !== undefined
            ? instructionOverride
            : customInstruction || undefined,
      });

      setRegeneratedResults((prev) => ({ ...prev, [key]: res }));
      setActiveRegenResult(res);
      setPreviewMode("section");

      // Cập nhật trạng thái thực thể sang DOCUMENTED trên giao diện
      setEntities((prev) =>
        prev.map((ent) =>
          getEntityKey(ent) === key
            ? { ...ent, entityId: res.entityId || ent.entityId, docStatus: "DOCUMENTED" }
            : ent
        )
      );
      setRepoEntities((prev) =>
        prev.map((ent) =>
          getEntityKey(ent) === key
            ? { ...ent, entityId: res.entityId || ent.entityId, docStatus: "DOCUMENTED" }
            : ent
        )
      );
    } catch (err: any) {
      setRegenError(
        err?.response?.data?.message ||
          err?.message ||
          "Không thể tạo lại tài liệu cho thực thể này. Vui lòng thử lại."
      );
    } finally {
      setRegeneratingKey(null);
    }
  };

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
          setRepos([]);
          setSelectedRepo(null);
        }
      } catch {
        setRepos([]);
        setSelectedRepo(null);
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
    if (!selectedRepo || !selectedFile) {
      setEntities([]);
      setCurrentFileSource("");
      return;
    }

    let cancelled = false;
    const fetchFileSourceInBackground = () => {
      repoService
        .getFileContent(
          selectedRepo.repositoryId,
          selectedFile,
          selectedRepo.defaultBranch
        )
        .then((fileRes) => {
          if (
            !cancelled &&
            fileRes &&
            typeof fileRes.content === "string" &&
            fileRes.content.trim()
          ) {
            setCurrentFileSource(fileRes.content);
          }
        })
        .catch(() => {});
    };

    async function loadEntities() {
      setLoading(true);
      setCurrentFileSource("");
      try {
        const repoName = selectedRepo!.repoName;
        const isDummy = (e: CodeEntityDto) => {
          if (!e) return true;
          const cName = e.className || "";
          const sig = e.signature || "";
          return (
            cName === "Java_UTH" ||
            cName === repoName ||
            sig === "Java_UTH" ||
            sig === repoName
          );
        };

        // 1. Kiểm tra cache local entities từ repository (chỉ lấy nếu là entity thực sự, không phải dummy)
        const localMatched = repoEntities.filter((e) => e.filePath === selectedFile && !isDummy(e));
        if (localMatched.length > 0) {
          setEntities(localMatched);
          setLoading(false);
          fetchFileSourceInBackground();
          return;
        }

        // 2. Thử truy vấn API backend
        try {
          const dbData = await codeEntityService.getByFile(
            selectedRepo!.repositoryId,
            selectedFile
          );
          const validDb = (dbData || []).filter((e) => !isDummy(e));
          if (validDb.length > 0) {
            setEntities(validDb);
            setLoading(false);
            fetchFileSourceInBackground();
            return;
          }
        } catch {
          // ignore
        }

        // 3. Tải nội dung mã nguồn thực tế của file từ backend API (GitHub Contents API hoặc Workspace file)
        let sourceContent: string | null = null;
        try {
          const fileRes = await repoService.getFileContent(
            selectedRepo!.repositoryId,
            selectedFile,
            selectedRepo?.defaultBranch
          );
          if (fileRes && typeof fileRes.content === "string" && fileRes.content.trim()) {
            sourceContent = fileRes.content;
          }
        } catch (fileErr) {
          console.warn("Không thể tải file-content từ backend API:", fileErr);
        }

        // 4. Nếu backend chưa có, thử tải raw từ GitHub
        if (!sourceContent && selectedRepo?.repoFullName) {
          try {
            const repoFullName = selectedRepo.repoFullName;
            const branch = selectedRepo.defaultBranch || "main";
            const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/${branch}/${selectedFile}`;
            const resp = await fetch(rawUrl);
            if (resp.ok) {
              const text = await resp.text();
              if (text && text.trim()) {
                sourceContent = text;
              }
            }
          } catch {
            // ignore
          }
        }

        // 5. Nếu có mã nguồn thực tế: Bóc tách AST chi tiết và tự động lập chỉ mục CSDL
        if (sourceContent) {
          setCurrentFileSource(sourceContent);
          const parsedEntities = parseUniversalCodeEntities(
            selectedFile,
            sourceContent,
            selectedRepo!.repositoryId
          );

          if (parsedEntities && parsedEntities.length > 0) {
            setEntities(parsedEntities);
            setRepoEntities((prev) => [
              ...prev.filter((e) => e.filePath !== selectedFile),
              ...parsedEntities,
            ]);

            // Gọi FastAPI /v1/code-entities/index ngầm để lưu entities thật vào CSDL
            try {
              codeEntityService
                .indexFile({
                  repositoryId: selectedRepo!.repositoryId,
                  filePath: selectedFile,
                  sourceCode: sourceContent,
                  commitHash: selectedRepo!.defaultBranch || "main",
                })
                .catch(() => {});
            } catch {
              // ignore
            }

            setLoading(false);
            return;
          }
        }

        // 6. Fallback nếu hoàn toàn không lấy được nội dung: Suy đoán class từ tên file
        const fileName = selectedFile.split("/").pop() || "Unknown";
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        setEntities([
          {
            repositoryId: selectedRepo!.repositoryId,
            filePath: selectedFile,
            entityType: "CLASS",
            className: baseName,
            signature: `class ${baseName}`,
            startLine: 1,
            endLine: 1,
            docStatus: "UNDOCUMENTED",
          },
        ]);
      } catch {
        setEntities([]);
      } finally {
        setLoading(false);
      }
    }

    loadEntities();
    return () => {
      cancelled = true;
    };
  }, [selectedRepo, selectedFile]);

  // 3. Xây dựng danh sách toàn bộ các file khả dụng từ Git tree, database và selectedFile
  const allFilePaths = useMemo<string[]>(() => {
    const pathsSet = new Set<string>();
    gitTreeFiles.forEach((f) => f && pathsSet.add(f));
    repoEntities.forEach((ent) => ent.filePath && pathsSet.add(ent.filePath));
    if (selectedFile) pathsSet.add(selectedFile);
    return Array.from(pathsSet);
  }, [gitTreeFiles, repoEntities, selectedFile]);

  // Lọc đường dẫn file theo ô tìm kiếm trong cây
  const filteredTreePaths = useMemo(() => {
    if (!treeSearch.trim()) return allFilePaths;
    const q = treeSearch.toLowerCase();
    return allFilePaths.filter((p) => p.toLowerCase().includes(q));
  }, [allFilePaths, treeSearch]);

  // Xây dựng cấu trúc cây thư mục phân cấp
  const treeData = useMemo<FileTreeNode[]>(() => {
    const entityCounts: Record<string, number> = {};
    repoEntities.forEach((ent) => {
      if (ent.filePath) {
        entityCounts[ent.filePath] = (entityCounts[ent.filePath] || 0) + 1;
      }
    });

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

      // Sắp xếp: Thư mục trước (A-Z), rồi đến File (A-Z)
      function sortNodes(nodes: FileTreeNode[]) {
        nodes.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
        nodes.forEach((n) => {
          if (n.children && n.children.length > 0) {
            sortNodes(n.children);
          }
        });
      }

      sortNodes(root);
      return root;
    }

    return buildNodeTree(filteredTreePaths);
  }, [filteredTreePaths, repoEntities]);

  // Tự động mở toàn bộ thư mục cha của file đang được chọn để file luôn hiển thị
  useEffect(() => {
    if (!selectedFile) return;
    const parts = selectedFile.split("/");
    if (parts.length <= 1) return;
    const toOpen: Record<string, boolean> = {};
    let current = "";
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      toOpen[current] = true;
    }
    setOpenFolders((prev) => ({ ...prev, ...toOpen }));
  }, [selectedFile]);

  // Tự động mở 2-3 cấp đầu khi tải cây thư mục
  useEffect(() => {
    if (treeData.length === 0) return;
    setOpenFolders((prev) => {
      const next: Record<string, boolean> = { ...prev };
      const expandLevel = (nodes: FileTreeNode[], depth: number) => {
        if (depth > 2) return;
        nodes.forEach((n) => {
          if (n.isFolder) {
            next[n.fullPath] = true;
            if (n.children) expandLevel(n.children, depth + 1);
          }
        });
      };
      expandLevel(treeData, 0);
      return next;
    });
  }, [treeData]);

  // Tự động mở tất cả thư mục khi người dùng gõ tìm kiếm trong cây
  useEffect(() => {
    if (!treeSearch.trim()) return;
    const allFolders: Record<string, boolean> = {};
    const expandAll = (nodes: FileTreeNode[]) => {
      nodes.forEach((n) => {
        if (n.isFolder) {
          allFolders[n.fullPath] = true;
          if (n.children) expandAll(n.children);
        }
      });
    };
    expandAll(treeData);
    setOpenFolders((prev) => ({ ...prev, ...allFolders }));
  }, [treeSearch, treeData]);

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const expandAllFolders = () => {
    const all: Record<string, boolean> = {};
    const recurse = (nodes: FileTreeNode[]) => {
      nodes.forEach((n) => {
        if (n.isFolder) {
          all[n.fullPath] = true;
          if (n.children) recurse(n.children);
        }
      });
    };
    recurse(treeData);
    setOpenFolders(all);
  };

  const collapseAllFolders = () => {
    setOpenFolders({});
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSig(text);
    setTimeout(() => setCopiedSig(null), 2000);
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".java")) return <FileCode size={14} className="text-emerald-600 shrink-0" />;
    if (lower.endsWith(".py")) return <FileCode size={14} className="text-blue-500 shrink-0" />;
    if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".js") || lower.endsWith(".jsx"))
      return <FileCode size={14} className="text-amber-500 shrink-0" />;
    if (lower.endsWith(".json")) return <FileJson size={14} className="text-amber-600 shrink-0" />;
    if (lower.endsWith(".sql")) return <Database size={14} className="text-indigo-500 shrink-0" />;
    if (lower.endsWith(".md") || lower.endsWith(".txt")) return <FileText size={14} className="text-slate-500 shrink-0" />;
    if (lower.endsWith(".yml") || lower.endsWith(".yaml") || lower.endsWith(".xml") || lower.endsWith(".properties"))
      return <Settings size={14} className="text-purple-500 shrink-0" />;
    return <FileText size={14} className="text-slate-400 shrink-0" />;
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
      <div className="space-y-0.5 min-w-max">
        {nodes.map((node) => {
          if (node.isFolder) {
            const isOpen = !!openFolders[node.fullPath];
            return (
              <div key={node.id}>
                <button
                  type="button"
                  onClick={() => toggleFolder(node.fullPath)}
                  style={{ paddingLeft: `${depth * 8 + 4}px` }}
                  title={node.name}
                  className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                >
                  <span className="text-slate-400 shrink-0">
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  {isOpen ? (
                    <FolderOpen size={14} className="text-amber-500 shrink-0" />
                  ) : (
                    <Folder size={14} className="text-amber-500 shrink-0" />
                  )}
                  <span className="truncate" title={node.name}>{node.name}</span>
                </button>
                {isOpen && node.children && (
                  <div>{renderTree(node.children, depth + 1)}</div>
                )}
              </div>
            );
          }

          // File
          const isSelected = selectedFile === node.fullPath;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedFile(node.fullPath)}
              style={{ paddingLeft: `${depth * 8 + 16}px` }}
              title={node.name}
              className={`flex w-full items-center rounded px-1.5 py-1 text-left text-xs transition cursor-pointer ${
                isSelected
                  ? "bg-emerald-50 font-semibold text-emerald-800 border-l-2 border-emerald-600 shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {getFileIcon(node.name)}
                <span className="truncate text-xs" title={node.name}>{node.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col p-4 sm:p-6 space-y-3.5 overflow-hidden">
        {/* Header trang */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-100 p-1.5 text-emerald-700">
                <Code size={20} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]" style={{ color: "#0f172a" }}>
                Cây thư mục
              </h1>
            </div>
          </div>

          {/* Chọn Kho lưu trữ & Nút gia hạn / Đồng bộ */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500">Kho lưu trữ:</span>
            <select
              value={selectedRepo?.repositoryId || ""}
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
              {repos.length === 0 && (
                <option value="">-- Chưa có kho lưu trữ --</option>
              )}
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
        {!selectedRepo ? (
          <div className="bg-white rounded-2xl border border-dashed border-amber-300 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
            <FolderGit2 className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Vui lòng chọn hoặc tải lên kho lưu trữ
            </h2>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              Chưa có kho lưu trữ nào được chọn hoặc tài khoản chưa kết nối kho lưu trữ. Vui lòng kết nối GitHub hoặc tải lên kho lưu trữ để xem cây mã nguồn.
            </p>
            <div className="flex items-center justify-center gap-3 mt-5">
              <Link
                href="/cai-dat"
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
              >
                Kết nối kho lưu trữ
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-175px)] min-h-0 overflow-hidden">
          {/* CỘT TRÁI: Cây thư mục mã nguồn (Rộng rãi 380px-420px, có nút mở rộng và cuộn ngang) */}
          <div
            className={`w-full ${
              wideTree
                ? "md:w-[480px] lg:w-[540px]"
                : "md:w-[350px] lg:w-[390px] xl:w-[430px]"
            } min-w-[300px] shrink-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col h-full min-h-0 overflow-hidden transition-all duration-200`}
          >
            <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen size={16} className="text-amber-500 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-800 truncate">
                  Cây thư mục mã nguồn
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setWideTree(!wideTree)}
                  title={wideTree ? "Thu hẹp cột cây" : "Mở rộng cột cây để xem tên file dài"}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                >
                  {wideTree ? "Thu gọn ⇥" : "Mở rộng ⇤"}
                </button>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {allFilePaths.length} file
                </span>
              </div>
            </div>

            {/* Công cụ tìm kiếm file & Mở/Thu gọn */}
            <div className="mb-2.5 flex flex-col gap-2 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm file trong cây..."
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                />
                {treeSearch && (
                  <button
                    type="button"
                    onClick={() => setTreeSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                <span className="truncate">{treeSearch ? `Tìm: "${treeSearch}"` : "Cấu trúc thư mục"}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={expandAllFolders}
                    className="hover:text-emerald-700 font-medium transition cursor-pointer"
                  >
                    Mở hết
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={collapseAllFolders}
                    className="hover:text-emerald-700 font-medium transition cursor-pointer"
                  >
                    Thu gọn
                  </button>
                </div>
              </div>
            </div>

            {/* Danh sách các thư mục & files (Cuộn dọc & ngang) */}
            <div className="flex-1 overflow-y-auto overflow-x-auto pr-1 select-none min-h-0">
              {treeData.length > 0 ? (
                renderTree(treeData)
              ) : loading ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <RefreshCw size={16} className="animate-spin text-emerald-600" />
                  <span>Đang tải cây thư mục từ GitHub...</span>
                </div>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center p-4 text-center">
                  <FolderOpen size={32} className="text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Chưa có cây mã nguồn</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                    Nhấn nút &quot;Đồng bộ cây&quot; để tải cấu trúc file thực tế từ GitHub.
                  </p>
                  <button
                    type="button"
                    onClick={handleSyncRepo}
                    className="mt-3 inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 shadow-sm transition cursor-pointer"
                  >
                    <RefreshCw size={11} /> Đồng bộ ngay
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: Chi tiết AST của file được chọn */}
          <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Thanh thông tin file + Bộ lọc (Cố định ở trên) */}
            <div className="border-b border-slate-200 bg-slate-50/60 p-4 shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCode size={18} className="text-emerald-600" />
                    <span className="text-sm font-bold text-slate-900 break-all">
                      {selectedFile || "Chưa chọn file mã nguồn"}
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
                      placeholder="Tìm kiếm tức thời (Class, Method, Field, SQL)..."
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
            {regenError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 flex items-center justify-between">
                <span>{regenError}</span>
                <button
                  type="button"
                  onClick={() => setRegenError(null)}
                  className="text-rose-600 hover:text-rose-900 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}
            {!selectedFile ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                <FileCode size={36} className="text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  Chưa chọn file mã nguồn
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Vui lòng bấm chọn một file từ cây thư mục bên trái để khám phá cấu trúc mã nguồn, danh sách Class, Method và Javadoc.
                </p>
              </div>
            ) : loading ? (
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
                  const isOutdated =
                    item.docStatus === "OUTDATED" || item.docStatus === "DRIFTED";
                  const isDocumented = item.docStatus === "DOCUMENTED";
                  const entityKey = getEntityKey(item);
                  const isRegenerating = regeneratingKey === entityKey;
                  const regenResult = regeneratedResults[entityKey];

                  return (
                    <div
                      key={idx}
                      className={`group rounded-xl border bg-white p-4.5 shadow-sm transition-all hover:shadow-md  ${
                        isOutdated
                          ? "border-amber-300 hover:border-amber-500"
                          : isClass
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
                                isOutdated
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : isDocumented
                                  ? "bg-purple-100 text-purple-700  "
                                  : "bg-slate-100 text-slate-500  "
                              }`}
                            >
                              {isOutdated ? (
                                <>
                                  <AlertCircle size={10} /> Tài liệu lỗi thời (OUTDATED)
                                </>
                              ) : isDocumented ? (
                                <>
                                  <CheckCircle2 size={10} /> Đã có tài liệu
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

                        {/* Vị trí dòng mã & Nút Tạo lại tài liệu cục bộ */}
                        <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-600  ">
                            <Hash size={12} />
                            Dòng {item.startLine} ➔ {item.endLine}
                          </span>
                          <button
                            type="button"
                            disabled={isRegenerating}
                            onClick={() => handleRegenerateEntityDoc(item)}
                            title="Bóc tách lại cú pháp AST mới nhất và yêu cầu AI tạo lại riêng mục tài liệu cho thực thể này (lưu bản nháp DRAFT)"
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-60 ${
                              isOutdated
                                ? "bg-amber-600 text-white hover:bg-amber-700"
                                : isDocumented
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white"
                            }`}
                          >
                            {isRegenerating ? (
                              <>
                                <RefreshCw size={12} className="animate-spin" />
                                <span>Đang tạo lại...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={12} />
                                <span>Tạo lại tài liệu</span>
                              </>
                            )}
                          </button>
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

                      {/* Kết quả tạo lại tài liệu cục bộ ngay trên thẻ thực thể */}
                      {regenResult && (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-slate-800 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                              <span>
                                Đã cập nhật vào Phiên bản nháp v{regenResult.versionNumber} ({regenResult.status}) — Giữ nguyên các mục đã duyệt khác
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRegenEntity(item);
                                  setActiveRegenResult(regenResult);
                                  setPreviewMode("section");
                                }}
                                className="rounded-md bg-white border border-emerald-300 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                              >
                                Xem chi tiết bản nháp
                              </button>
                              <Link
                                href={
                                  regenResult.documentId
                                    ? `/tai-lieu-cua-toi?docId=${regenResult.documentId}`
                                    : "/tai-lieu-cua-toi"
                                }
                                className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
                              >
                                Mở Tài liệu của tôi ➔
                              </Link>
                            </div>
                          </div>
                          <pre className="whitespace-pre-wrap rounded-lg border border-emerald-200/80 bg-white p-2.5 font-mono text-[11px] text-slate-700 max-h-44 overflow-y-auto">
                            {regenResult.updatedSectionMarkdown}
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
      )}

      {/* Modal Xem trước & Xác nhận Phiên bản nháp (DRAFT) sau khi tạo lại tài liệu thực thể */}
      {activeRegenResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-emerald-50/80 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-lg bg-emerald-600 p-1.5 text-white">
                  <Sparkles size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Đã tạo lại tài liệu cho thực thể:{" "}
                    <code className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900">
                      {activeRegenResult.methodName || activeRegenResult.className}
                    </code>
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Lưu thành công vào{" "}
                    <strong className="text-emerald-700">
                      Phiên bản nháp v{activeRegenResult.versionNumber} ({activeRegenResult.status})
                    </strong>{" "}
                    — Các mục đã phê duyệt khác trong tài liệu tổng thể được giữ nguyên 100%.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRegenResult(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {/* Thông tin phiên bản & Hash Chain */}
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Tài liệu đích:</span>
                  <div className="font-semibold text-slate-800 truncate">
                    {activeRegenResult.documentTitle || activeRegenResult.targetPath || `Document #${activeRegenResult.documentId}`}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Phiên bản mới:</span>
                  <div className="font-semibold text-emerald-700">
                    Phiên bản nháp v{activeRegenResult.versionNumber} ({activeRegenResult.status})
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Chữ ký AST mới nhất:</span>
                  <div className="font-mono text-[11px] text-slate-800 truncate" title={activeRegenResult.signature}>
                    {activeRegenResult.signature}
                  </div>
                </div>
              </div>

              {/* Tuỳ chọn hướng dẫn bổ sung và tạo lại */}
              {activeRegenEntity && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="Nhập hướng dẫn bổ sung cho AI nếu muốn tinh chỉnh thêm mục này..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!!regeneratingKey}
                    onClick={() =>
                      handleRegenerateEntityDoc(activeRegenEntity, customInstruction)
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={12} className={regeneratingKey ? "animate-spin" : ""} />
                    <span>Tạo lại kèm ghi chú</span>
                  </button>
                </div>
              )}

              {/* Chuyển đổi xem Mục vừa cập nhật vs Toàn bộ tài liệu */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("section")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                      previewMode === "section"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Mục thực thể vừa tạo lại
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("full")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                      previewMode === "full"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Toàn bộ tài liệu nháp (v{activeRegenResult.versionNumber})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      previewMode === "section"
                        ? activeRegenResult.updatedSectionMarkdown
                        : activeRegenResult.fullMarkdown
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <Copy size={12} /> Sao chép Markdown
                </button>
              </div>

              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-emerald-300">
                {previewMode === "section"
                  ? activeRegenResult.updatedSectionMarkdown
                  : activeRegenResult.fullMarkdown}
              </pre>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <span className="text-[11px] text-slate-500">
                Mã băm SHA-256: <code className="font-mono">{activeRegenResult.contentHash?.slice(0, 16)}...</code>
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={
                    activeRegenResult.documentId
                      ? `/workspace?docId=${activeRegenResult.documentId}`
                      : "/workspace"
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Mở trong Workspace
                </Link>
                <Link
                  href={
                    activeRegenResult.documentId
                      ? `/tai-lieu-cua-toi?docId=${activeRegenResult.documentId}`
                      : "/tai-lieu-cua-toi"
                  }
                  className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                >
                  Xem trong Tài liệu của tôi ➔
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveRegenResult(null)}
                  className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </AppShell>
  );
}
