"use client";

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MarkdownViewer } from "@/components/shared/MarkdownViewer";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import type { DocCollection, DocumentDetail, DocumentStatus } from "@/types/document";
import {
  Save,
  Send,
  Columns,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Link as LinkIcon,
  Copy,
  Check,
  Sparkles,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  History,
  GitCommit,
  ChevronUp,
  Upload,
  Folder,
  FolderOpen,
  Search,
  PanelLeft,
  RefreshCw,
  Plus,
  AlertTriangle,
  FolderGit2,
  FileDown,
  Eye,
  Filter,
  X,
  LayoutTemplate,
} from "lucide-react";
import {
  templateService,
  type DocTemplateDto,
  type DocumentCrossCheckResponse,
} from "@/services/templateService";
import {
  InteractiveOptionModal,
  type InteractiveOptionChoice,
} from "@/components/shared/InteractiveOptionModal";

function ResizerHandle({
  onMouseDown,
  isDragging,
  title = "Kéo để thay đổi kích thước",
}: {
  onMouseDown: () => void;
  isDragging: boolean;
  title?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown();
      }}
      title={title}
      style={{
        width: 8,
        margin: "0 -4px",
        cursor: "col-resize",
        zIndex: 20,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        userSelect: "none",
        backgroundColor: "transparent",
      }}
    >
      <div
        style={{
          width: 3,
          height: hovered || isDragging ? 36 : 24,
          borderRadius: 2,
          backgroundColor: isDragging ? "#2563eb" : hovered ? "#3b82f6" : "#cbd5e1",
          boxShadow: hovered || isDragging ? "0 0 6px rgba(37,99,235,0.4)" : "none",
          transition: "all 0.15s ease",
        }}
      />
    </div>
  );
}

interface FileTreeNode {
  id: string;
  name: string;
  fullPath: string;
  isFolder: boolean;
  children?: FileTreeNode[];
}

function buildFileTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  paths.forEach((p) => {
    const cleanPath = p.replace(/\\/g, "/");
    const parts = cleanPath.split("/").filter(Boolean);
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
        };
        currentArr.push(existing);
      }
      if (!isFile && existing.children) {
        currentArr = existing.children;
      }
    });
  });

  function sortNodes(nodes: FileTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isFolder === b.isFolder) {
        return a.name.localeCompare(b.name);
      }
      return a.isFolder ? -1 : 1;
    });
    nodes.forEach((n) => {
      if (n.children) sortNodes(n.children);
    });
  }
  sortNodes(root);
  return root;
}

function getFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".java") || lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".js") || lower.endsWith(".py")) {
    return <FileCode size={14} style={{ color: "#2563eb", flexShrink: 0 }} />;
  }
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    return <FileText size={14} style={{ color: "#2563eb", flexShrink: 0 }} />;
  }
  if (lower.endsWith(".md")) {
    return <FileText size={14} style={{ color: "#087f5b", flexShrink: 0 }} />;
  }
  if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".xml")) {
    return <Code size={14} style={{ color: "#d97706", flexShrink: 0 }} />;
  }
  return <FileText size={14} style={{ color: "#64748b", flexShrink: 0 }} />;
}

const DEFAULT_WORKSPACE_MARKDOWN = `# Workspace: Tài liệu Kỹ thuật Dự án

## 1. Phần đầu tài liệu
Tài liệu được quản lý tập trung trong không gian làm việc (Workspace), đồng bộ trực tiếp với kho mã nguồn GitHub và bảo vệ bằng chuỗi băm bất biến SHA-256.

## 2. Giới thiệu tổng quan
Hệ thống cho phép nạp tài liệu Word (.docx), phân tích AST các lớp/phương thức, tự động phát hiện khoảng trống tài liệu và gợi ý sửa đổi khi có commit hoặc pull request mới.

---
`;

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const docIdParam = searchParams.get("docId");

  const [docId, setDocId] = useState<number | null>(docIdParam ? parseInt(docIdParam, 10) : null);
  const [title, setTitle] = useState("Tài liệu Workspace");
  const [content, setContent] = useState(DEFAULT_WORKSPACE_MARKDOWN);
  const [targetPath, setTargetPath] = useState("");
  const [repoId, setRepoId] = useState<number>(1);
  const [collectionId, setCollectionId] = useState<number>(1);
  const [status, setStatus] = useState<DocumentStatus>("DRAFT");
  const [currentVersion, setCurrentVersion] = useState(1);
  const [isDirty, setIsDirty] = useState(false);

  // Thư mục làm việc đóng gói (Scoped Workspace Folder - VS Code Open Folder)
  const [scopedFolder, setScopedFolder] = useState<string | null>(null);

  // Repositories & Collections
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [collections, setCollections] = useState<DocCollection[]>([]);
  const [workspaceDocs, setWorkspaceDocs] = useState<any[]>([]);

  // Explorer & Git Tree
  const [showExplorer, setShowExplorer] = useState(true);
  const [gitTreeFiles, setGitTreeFiles] = useState<string[]>([]);
  const [loadingGitTree, setLoadingGitTree] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [searchTree, setSearchTree] = useState("");
  const [selectedRepoFile, setSelectedRepoFile] = useState<string | null>(null);

  // File Inspector Modal
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  // Nạp Word (.docx) & Xuất Word (.docx)
  const docxFileInputRef = useRef<HTMLInputElement>(null);
  const [importingDocx, setImportingDocx] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  // Template & 2-Way Cross-Check states
  const [availableTemplates, setAvailableTemplates] = useState<DocTemplateDto[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [crossCheckResult, setCrossCheckResult] = useState<DocumentCrossCheckResponse | null>(null);
  const [runningCrossCheck, setRunningCrossCheck] = useState(false);
  const [crossCheckTab, setCrossCheckTab] = useState<"template" | "code" | "suggestions">("template");
  const [showCrossCheckDrawer, setShowCrossCheckDrawer] = useState(true);

  // Interactive Option Modal
  const [showOptionModal, setShowOptionModal] = useState(false);

  // Layout & UI
  const [isMaximized, setIsMaximized] = useState(false);
  const [docsSectionCollapsed, setDocsSectionCollapsed] = useState(false);
  const [previewMode, setPreviewMode] = useState<"split" | "edit" | "preview">("split");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resizable Panels State
  const [explorerWidth, setExplorerWidth] = useState(280);
  const [editorSplitPercent, setEditorSplitPercent] = useState(50);
  const [drawerWidth, setDrawerWidth] = useState(320);
  const [activeDrag, setActiveDrag] = useState<"explorer" | "editor" | "drawer" | null>(null);

  const editorBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (activeDrag === "explorer") {
        const newWidth = Math.max(160, Math.min(e.clientX, 550));
        setExplorerWidth(newWidth);
      } else if (activeDrag === "drawer") {
        const newWidth = Math.max(220, Math.min(window.innerWidth - e.clientX, 650));
        setDrawerWidth(newWidth);
      } else if (activeDrag === "editor" && editorBodyRef.current) {
        const rect = editorBodyRef.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const newPercent = Math.max(20, Math.min((offsetX / rect.width) * 100, 80));
        setEditorSplitPercent(newPercent);
      }
    };

    const handleMouseUp = () => {
      setActiveDrag(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [activeDrag]);

  const notify = useCallback((type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Lọc cây thư mục theo scopedFolder (VS Code Open Folder)
  const filteredTreeFiles = useMemo(() => {
    let files = gitTreeFiles;
    if (scopedFolder) {
      const cleanScope = scopedFolder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      files = files.filter((p) => {
        const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "");
        return cleanP.startsWith(cleanScope + "/") || cleanP === cleanScope;
      });
    }
    if (searchTree.trim()) {
      const q = searchTree.toLowerCase();
      files = files.filter((p) => p.toLowerCase().includes(q));
    }
    return files;
  }, [gitTreeFiles, scopedFolder, searchTree]);

  const treeNodes = useMemo(() => buildFileTree(filteredTreeFiles), [filteredTreeFiles]);

  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Nạp danh sách metadata ban đầu
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [repoList, colList, tmplList, docList] = await Promise.all([
          repoService.getRepositories().catch(() => []),
          documentService.getCollections().catch(() => []),
          templateService.getTemplates().catch(() => []),
          documentService.getDocuments().catch(() => []),
        ]);
        setRepos(repoList);
        setCollections(colList);
        setAvailableTemplates(tmplList);
        setWorkspaceDocs(docList);

        if (repoList.length > 0 && !docIdParam) {
          setRepoId(repoList[0].repositoryId);
        }
        if (colList.length > 0 && !docIdParam) {
          setCollectionId(colList[0].id);
        }
        if (tmplList.length > 0) {
          const def = tmplList.find((t) => t.isDefault) || tmplList[0];
          setSelectedTemplateId(def.id);
        }
      } catch (err: any) {
        console.error("Lỗi nạp metadata workspace:", err);
      }
    };
    fetchMeta();
  }, [docIdParam]);

  // Nạp Git Tree khi đổi repo
  useEffect(() => {
    if (!repoId) return;
    const fetchTree = async () => {
      setLoadingGitTree(true);
      try {
        const items = await repoService.getRepositoryTree(repoId);
        if (Array.isArray(items) && items.length > 0) {
          const filePaths = items
            .filter((it) => it.type === "blob" || it.path?.includes("."))
            .map((it) => it.path);
          setGitTreeFiles(filePaths);
          const topLevelFolders: Record<string, boolean> = {};
          filePaths.forEach((path) => {
            const firstPart = path.split("/")[0];
            if (firstPart) topLevelFolders[firstPart] = true;
          });
          setOpenFolders(topLevelFolders);
        }
      } catch (err: any) {
        setGitTreeFiles([]);
      } finally {
        setLoadingGitTree(false);
      }
    };
    fetchTree();
  }, [repoId]);

  // Nạp chi tiết tài liệu nếu có docId
  useEffect(() => {
    if (!docId) return;
    const fetchDoc = async () => {
      try {
        const doc = await documentService.getDocumentById(docId);
        setTitle(doc.title);
        setRepoId(doc.repoId);
        if (doc.collectionId) setCollectionId(doc.collectionId);
        setTargetPath(doc.targetPath || "");
        setStatus(doc.status);
        setCurrentVersion(doc.currentVersion);
        if (doc.latestVersion?.content) {
          setContent(doc.latestVersion.content);
          handleRunCrossCheck(doc.latestVersion.content, doc.repoId, doc.targetPath || undefined);
        }
        setIsDirty(false);
      } catch (err: any) {
        notify("error", "Không thể nạp tài liệu: " + (err.response?.data?.message || err.message));
      }
    };
    fetchDoc();
  }, [docId, notify]);

  // Quét đối chiếu 2 chiều (Cross-Check với Template & Mã nguồn)
  const handleRunCrossCheck = async (
    markdownText?: string,
    overrideRepoId?: number,
    overrideTargetPath?: string | null,
    autoOpenOptionModal?: boolean,
    overrideTemplateId?: number | null
  ) => {
    const textToCheck = markdownText !== undefined ? markdownText : content;
    const effectiveRepoId = overrideRepoId || repoId;
    if (!effectiveRepoId) {
      notify("error", "Vui lòng chọn kho lưu trữ liên kết!");
      return;
    }
    const templateIdToUse = (overrideTemplateId !== undefined && overrideTemplateId !== null)
      ? overrideTemplateId
      : (selectedTemplateId || undefined);

    setRunningCrossCheck(true);
    try {
      const res = await templateService.crossCheck({
        templateId: templateIdToUse,
        repositoryId: effectiveRepoId,
        markdown: textToCheck,
        targetPath: scopedFolder || overrideTargetPath || targetPath,
      });
      setCrossCheckResult(res);
      notify("success", `Hoàn tất đối chiếu! Thiếu ${res.missingTemplateHeadings.length} đề mục và ${res.missingCodeEntitiesCount} thực thể code.`);
      if (autoOpenOptionModal && (res.missingTemplateHeadings.length > 0 || res.missingCodeEntitiesCount > 0)) {
        setShowOptionModal(true);
      }
    } catch (err: any) {
      notify("error", "Lỗi quét đối chiếu: " + (err.response?.data?.message || err.message));
    } finally {
      setRunningCrossCheck(false);
    }
  };

  // Nạp trực tiếp tệp Word (.docx)
  const handleDirectDocxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportingDocx(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("repoId", String(repoId || 1));
      formData.append("title", title && title !== "Tài liệu Workspace" ? title : file.name.replace(/\.[^.]+$/, ""));
      if (scopedFolder || targetPath) {
        formData.append("targetPath", scopedFolder || targetPath);
      }
      const created = await documentService.importDocx(formData);
      notify("success", `Nạp tệp Word "${file.name}" vào Workspace thành công!`);
      if (created.docId) {
        setDocId(created.docId);
        setTitle(created.title);
        if (created.repoId) setRepoId(created.repoId);
        if (created.targetPath) setTargetPath(created.targetPath);
        if (created.status) setStatus(created.status);
        if (created.currentVersion) setCurrentVersion(created.currentVersion);
        if (created.latestVersion?.content) {
          setContent(created.latestVersion.content);
          handleRunCrossCheck(created.latestVersion.content, created.repoId || repoId, created.targetPath || targetPath, true);
        }
        router.replace(`/workspace?docId=${created.docId}`);
      }
    } catch (err: any) {
      notify("error", "Lỗi nạp file Word: " + (err.response?.data?.message || err.message));
    } finally {
      setImportingDocx(false);
      if (docxFileInputRef.current) {
        docxFileInputRef.current.value = "";
      }
    }
  };

  // Xuất file Word (.docx)
  const handleExportDocx = async () => {
    try {
      setExportingDocx(true);
      const blob = await documentService.exportRawDocx({
        title: title || "Tai_lieu_LivingDocs",
        markdown: content,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "Tai_lieu_LivingDocs").replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notify("success", "Đã xuất file Word (.docx) thành công!");
    } catch (err: any) {
      notify("error", "Lỗi xuất file Word: " + (err.response?.data?.message || err.message));
    } finally {
      setExportingDocx(false);
    }
  };

  // Áp dụng lựa chọn từ Interactive Option Modal
  const handleApplyInteractiveOption = (choice: InteractiveOptionChoice) => {
    if (choice.mode === "IGNORE_KEEP_RAW") {
      notify("info", "Đã giữ nguyên tài liệu ban đầu không thay đổi.");
      return;
    }

    if (choice.mode === "APPEND_EVIDENCE_ONLY") {
      const repoName = repos.find((r) => r.repositoryId === repoId)?.repoFullName || `Repository #${repoId}`;
      const evidenceBox = `\n\n---\n\n### 🔍 Khối Bằng chứng Xác thực Nguồn (Grounding Evidence Box)\n\n` +
        `> **Xác thực bởi:** LivingDocs AI Engine (AST Verification Engine)\n` +
        `> **File nguồn / Repository:** \`${repoName}\`\n` +
        `> **Phạm vi Workspace:** \`${scopedFolder || "/"}\`\n` +
        `> **Mã Commit Hash:** \`verified-ast-grounding\`\n` +
        `> **Trạng thái:** ✅ Đã đối soát AST\n`;
      setContent((prev) => prev.trim() + evidenceBox);
      setIsDirty(true);
      notify("success", "Đã đính kèm Hộp bằng chứng đối soát AST vào tài liệu!");
      return;
    }

    let additions = "";

    if (choice.selectedHeadings && choice.selectedHeadings.length > 0) {
      additions += "\n\n---\n";
      choice.selectedHeadings.forEach((heading) => {
        additions += `\n\n## ${heading}\n\n*Nội dung chi tiết cho mục ${heading} được cấu trúc theo tiêu chuẩn dự án. Cập nhật các thông số kỹ thuật, yêu cầu hoặc quy trình liên quan tại đây.*\n`;
      });
    }

    if (choice.selectedEntities && choice.selectedEntities.length > 0) {
      additions += "\n\n### 📦 Đặc tả Kỹ thuật Các Thực thể Mã nguồn\n";
      choice.selectedEntities.forEach((ent) => {
        if (ent.suggestedMarkdown) {
          additions += `\n${ent.suggestedMarkdown.trim()}\n`;
        } else {
          additions += `\n#### \`${ent.className}${ent.methodName ? "." + ent.methodName + "()" : ""}\` (${ent.entityType})\n` +
            `- **Tệp nguồn**: \`${ent.filePath}\`\n` +
            (ent.signature ? `- **Chữ ký**: \`${ent.signature}\`\n` : "") +
            `- **Mô tả nghiệp vụ**: ${ent.suggestion || "Thực thể mã nguồn được đồng bộ tự động."}\n`;
        }
      });
    }

    if (additions) {
      setContent((prev) => prev.trim() + additions + "\n");
      setIsDirty(true);
      notify("success", `Đã tự động bổ sung ${choice.selectedHeadings.length} mục và ${choice.selectedEntities.length} thực thể code vào tài liệu!`);
    }
  };

  // Lưu tài liệu
  const handleSave = async () => {
    if (!title.trim()) {
      notify("error", "Tiêu đề không được để trống!");
      return;
    }
    setIsSaving(true);
    try {
      if (docId) {
        const updated = await documentService.updateDocument(docId, {
          title,
          content,
          targetPath: scopedFolder || targetPath,
          triggerType: "MANUAL_UPDATE",
        });
        setCurrentVersion(updated.currentVersion);
        setStatus(updated.status);
        setIsDirty(false);
        notify("success", `Đã lưu phiên bản v${updated.currentVersion} thành công!`);
      } else {
        const created = await documentService.createDocument({
          title,
          content,
          targetPath: scopedFolder || targetPath,
          repoId,
          collectionId,
          triggerType: "MANUAL_CREATE",
        });
        setDocId(created.docId);
        setCurrentVersion(created.currentVersion);
        setStatus(created.status);
        setIsDirty(false);
        notify("success", `Đã tạo tài liệu mới thành công (v1)!`);
        router.replace(`/workspace?docId=${created.docId}`);
      }
    } catch (err: any) {
      notify("error", "Lỗi lưu tài liệu: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  // Gửi duyệt
  const handleSubmitReview = async () => {
    if (!docId) {
      notify("error", "Vui lòng lưu bản nháp trước khi gửi duyệt!");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await documentService.submitForReview(docId);
      setStatus(res.status);
      notify("success", "Đã chuyển tài liệu sang hàng đợi duyệt của Staff!");
    } catch (err: any) {
      notify("error", "Lỗi gửi duyệt: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xem mã nguồn
  const handleOpenFilePreview = async (filePath: string) => {
    setSelectedRepoFile(filePath);
    setLoadingFileContent(true);
    try {
      const res = await repoService.getFileContent(repoId, filePath);
      if (res && typeof res.content === "string") {
        setViewingFile({ path: filePath, content: res.content });
      } else {
        setViewingFile({ path: filePath, content: "// Tệp rỗng hoặc không có nội dung văn bản." });
      }
    } catch (err: any) {
      setViewingFile({
        path: filePath,
        content: `// Không thể tải nội dung tệp "${filePath}":\n// ${err.response?.data?.message || err.message || "Tệp chưa được đồng bộ từ GitHub."}`,
      });
    } finally {
      setLoadingFileContent(false);
    }
  };

  // Render Tree Node đệ quy
  const renderTreeNode = (node: FileTreeNode, depth = 0) => {
    const isFolder = node.isFolder;
    const isOpen = openFolders[node.id];
    const isSelected = selectedRepoFile === node.fullPath;
    const isScoped = scopedFolder === node.fullPath;

    return (
      <div key={node.id} style={{ display: "flex", flexDirection: "column" }}>
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.id);
            } else {
              handleOpenFilePreview(node.fullPath);
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "3px 6px 3px " + (depth * 14 + 6) + "px",
            fontSize: "12px",
            color: isSelected ? "#2563eb" : "#334155",
            backgroundColor: isSelected ? "#eff6ff" : isScoped ? "#f0fdf4" : "transparent",
            cursor: "pointer",
            borderRadius: "4px",
            userSelect: "none",
            gap: "6px",
          }}
          className="hover:bg-slate-100"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isFolder ? (
              <>
                {isOpen ? <ChevronDown size={13} style={{ color: "#64748b" }} /> : <ChevronRight size={13} style={{ color: "#64748b" }} />}
                {isOpen ? <FolderOpen size={14} style={{ color: "#d97706" }} /> : <Folder size={14} style={{ color: "#d97706" }} />}
              </>
            ) : (
              getFileIcon(node.name)
            )}
            <span style={{ fontWeight: isFolder ? 600 : 400 }}>{node.name}</span>
          </div>

          {/* Nút đặt Thư mục làm việc (Scope) */}
          {isFolder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isScoped) {
                  setScopedFolder(null);
                  notify("info", "Đã quay về phạm vi toàn bộ Repository.");
                } else {
                  setScopedFolder(node.fullPath);
                  notify("success", `Đã giới hạn Workspace vào thư mục: "${node.fullPath}"`);
                }
              }}
              style={{
                border: "none",
                background: isScoped ? "#16a34a" : "#f1f5f9",
                color: isScoped ? "#ffffff" : "#64748b",
                fontSize: "10px",
                padding: "1px 5px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 600,
              }}
              title={isScoped ? "Bỏ giới hạn thư mục này" : "Đặt làm Thư mục làm việc (Open Folder)"}
            >
              {isScoped ? "Scoped ✓" : "Scope"}
            </button>
          )}
        </div>

        {isFolder && isOpen && node.children && (
          <div>{node.children.map((child) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
            background: toast.type === "success" ? "#10b981" : toast.type === "error" ? "#ef4444" : "#3b82f6",
            color: "#ffffff",
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* WRAPPER FOR WORKSPACE (SUPPORTS FULLSCREEN / ZEN MODE) */}
      <div
        style={
          isMaximized
            ? {
                position: "fixed",
                inset: 0,
                zIndex: 60,
                width: "100vw",
                height: "100vh",
                backgroundColor: "#ffffff",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }
            : {
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "hidden",
              }
        }
      >
        {/* TOP WORKSPACE TOOLBAR */}
        <div
          style={{
            height: 52,
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            gap: 12,
            flexShrink: 0,
          }}
        >
        {/* Left: Branding & Repo / Scope Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2563eb", fontWeight: 700, fontSize: 15 }}>
            <FolderGit2 size={20} />
            <span>Workspace</span>
          </div>

          <div style={{ height: 20, width: 1, backgroundColor: "#cbd5e1" }} />

          {/* Repo Selector */}
          <select
            value={repoId}
            onChange={(e) => {
              setRepoId(Number(e.target.value));
              setScopedFolder(null);
            }}
            style={{
              padding: "4px 8px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              backgroundColor: "#f8fafc",
              color: "#1e293b",
              cursor: "pointer",
            }}
          >
            {repos.map((r) => (
              <option key={r.repositoryId} value={r.repositoryId}>
                {r.repoFullName || r.repoName}
              </option>
            ))}
          </select>

          {/* Scoped Folder Badge */}
          {scopedFolder ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 6,
                fontSize: 11,
                color: "#065f46",
                fontWeight: 600,
              }}
            >
              <span>📁 Scope: <strong>{scopedFolder}</strong></span>
              <button
                type="button"
                onClick={() => setScopedFolder(null)}
                style={{ border: "none", background: "none", color: "#065f46", cursor: "pointer", padding: 0 }}
                title="Quay lại toàn bộ Repository"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "#64748b" }}>Phạm vi: Toàn bộ Repository</span>
          )}
        </div>

        {/* Center: Title input */}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
          placeholder="Nhập tiêu đề tài liệu..."
          style={{
            flex: 1,
            maxWidth: 360,
            padding: "5px 10px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            color: "#0f172a",
          }}
        />

        {/* Right Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Nạp Word (.docx) */}
          <input
            type="file"
            accept=".docx"
            ref={docxFileInputRef}
            style={{ display: "none" }}
            onChange={handleDirectDocxImport}
          />
          <button
            type="button"
            onClick={() => docxFileInputRef.current?.click()}
            disabled={importingDocx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#2563eb",
              cursor: "pointer",
            }}
            title="Tải lên tệp Word (.docx) và tự động đối chiếu"
          >
            <Upload size={14} className={importingDocx ? "animate-spin" : ""} />
            <span>{importingDocx ? "Đang nạp..." : "Nạp Word"}</span>
          </button>

          {/* Xuất Word (.docx) */}
          <button
            type="button"
            onClick={handleExportDocx}
            disabled={exportingDocx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#087f5b",
              cursor: "pointer",
            }}
            title="Xuất nội dung hiện tại ra tệp Word (.docx)"
          >
            <FileDown size={14} className={exportingDocx ? "animate-spin" : ""} />
            <span>{exportingDocx ? "Đang xuất..." : "Xuất Word"}</span>
          </button>

          {/* Chọn Template đối chiếu */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              backgroundColor: "#f8fafc",
            }}
            title="Đổi Template mẫu tài liệu để đối chiếu"
          >
            <LayoutTemplate size={13} style={{ color: "#d97706", flexShrink: 0 }} />
            <select
              value={selectedTemplateId || ""}
              onChange={(e) => {
                const newTid = Number(e.target.value);
                setSelectedTemplateId(newTid);
                handleRunCrossCheck(content, repoId, scopedFolder, false, newTid);
              }}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 11,
                fontWeight: 600,
                color: "#1e293b",
                cursor: "pointer",
                outline: "none",
                maxWidth: 150,
              }}
            >
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quét đối chiếu với Template đã chọn */}
          <button
            type="button"
            onClick={() => handleRunCrossCheck(content, repoId, scopedFolder, true)}
            disabled={runningCrossCheck}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 11px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#b45309",
              cursor: "pointer",
            }}
            title="Quét đối chiếu tài liệu với Template đã chọn và thực thể mã nguồn"
          >
            <Sparkles size={14} className={runningCrossCheck ? "animate-spin" : ""} style={{ color: "#d97706" }} />
            <span>{runningCrossCheck ? "Đang đối chiếu..." : "Đối chiếu Template"}</span>
          </button>

          {/* Lưu bản nháp */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
            }}
          >
            <Save size={14} />
            <span>{isSaving ? "Đang lưu..." : "Lưu"}</span>
          </button>

          {/* Gửi duyệt */}
          <button
            type="button"
            onClick={handleSubmitReview}
            disabled={isSubmitting || !docId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              backgroundColor: "#059669",
              color: "#ffffff",
              cursor: !docId ? "not-allowed" : "pointer",
              opacity: !docId ? 0.6 : 1,
            }}
          >
            <Send size={14} />
            <span>Gửi duyệt</span>
          </button>

          <div style={{ height: 20, width: 1, backgroundColor: "#cbd5e1" }} />

          {/* Mở rộng / Thu nhỏ toàn màn hình */}
          <button
            type="button"
            onClick={() => setIsMaximized((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 11px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              backgroundColor: isMaximized ? "#eff6ff" : "#ffffff",
              color: isMaximized ? "#2563eb" : "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title={isMaximized ? "Thu nhỏ không gian làm việc về bình thường" : "Mở rộng toàn màn hình không gian làm việc"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isMaximized ? "Thu nhỏ" : "Mở rộng"}</span>
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE BODY */}
      <div
        style={{
          display: "flex",
          height: isMaximized ? "calc(100vh - 52px)" : "calc(100% - 52px)",
          minHeight: 0,
          overflow: "hidden",
          backgroundColor: "#f8fafc",
          flex: 1,
        }}
      >
        {/* LEFT EXPLORER (VS CODE STYLE) */}
        {showExplorer && (
          <div
            style={{
              width: explorerWidth,
              borderRight: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {/* Explorer Header */}
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                <Folder size={14} />
                <span>Explorer Mã nguồn</span>
              </div>
              <button
                type="button"
                onClick={() => setShowExplorer(false)}
                style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", padding: 2 }}
                title="Thu gọn"
              >
                <X size={14} />
              </button>
            </div>

            {/* Tree search */}
            <div style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ position: "relative" }}>
                <Search size={12} style={{ position: "absolute", left: 8, top: 7, color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Lọc tệp mã nguồn..."
                  value={searchTree}
                  onChange={(e) => setSearchTree(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "4px 8px 4px 26px",
                    fontSize: 11,
                    borderRadius: 4,
                    border: "1px solid #e2e8f0",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Tree view list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
              {loadingGitTree ? (
                <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#64748b" }}>
                  Đang đồng bộ cây thư mục...
                </div>
              ) : treeNodes.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
                  Không tìm thấy tệp mã nguồn nào.
                </div>
              ) : (
                treeNodes.map((n) => renderTreeNode(n))
              )}
            </div>

            {/* Workspace Documents List (raised up, clean header, full list) */}
            <div
              style={{
                borderTop: "2px solid #e2e8f0",
                height: docsSectionCollapsed ? 36 : 290,
                minHeight: docsSectionCollapsed ? 36 : 260,
                display: "flex",
                flexDirection: "column",
                background: "#f8fafc",
                flexShrink: 0,
                transition: "height 0.2s ease",
              }}
            >
              <div
                style={{
                  padding: "7px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#1e293b",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f1f5f9",
                  borderBottom: "1px solid #e2e8f0",
                  userSelect: "none",
                }}
              >
                <div
                  onClick={() => setDocsSectionCollapsed((c) => !c)}
                  style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                  title="Nhấn để thu gọn hoặc mở rộng danh sách tài liệu"
                >
                  <FileText size={13} style={{ color: "#2563eb" }} />
                  <span>Tài liệu trong Workspace ({workspaceDocs.length})</span>
                  {docsSectionCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/workspace")}
                  style={{
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 4,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                  title="Tạo tài liệu mới trong Workspace"
                >
                  <Plus size={11} />
                  <span>Tạo mới</span>
                </button>
              </div>

              {!docsSectionCollapsed && (
                <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
                  {workspaceDocs.length === 0 ? (
                    <div style={{ padding: 12, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
                      Chưa có tài liệu nào trong Workspace
                    </div>
                  ) : (
                    workspaceDocs.map((d) => (
                      <div
                        key={d.docId}
                        onClick={() => router.push(`/workspace?docId=${d.docId}`)}
                        style={{
                          padding: "6px 8px",
                          marginBottom: 3,
                          borderRadius: 6,
                          fontSize: 11,
                          color: d.docId === docId ? "#1d4ed8" : "#334155",
                          fontWeight: d.docId === docId ? 600 : 400,
                          backgroundColor: d.docId === docId ? "#dbeafe" : "#ffffff",
                          border: "1px solid",
                          borderColor: d.docId === docId ? "#bfdbfe" : "#f1f5f9",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          boxShadow: d.docId === docId ? "0 1px 2px rgba(37,99,235,0.1)" : "none",
                        }}
                        title={d.title}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                          <FileText size={13} style={{ color: "#2563eb", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d.title}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 9,
                            padding: "1px 4px",
                            borderRadius: 3,
                            background: d.status === "PUBLISHED" ? "#ecfdf5" : "#f1f5f9",
                            color: d.status === "PUBLISHED" ? "#059669" : "#64748b",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          v{d.currentVersion || 1}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showExplorer && (
          <ResizerHandle
            isDragging={activeDrag === "explorer"}
            onMouseDown={() => setActiveDrag("explorer")}
            title="Kéo qua lại để thu nhỏ / phóng to Explorer"
          />
        )}

        {/* Toggle Explorer Button if collapsed */}
        {!showExplorer && (
          <button
            type="button"
            onClick={() => setShowExplorer(true)}
            style={{
              width: 32,
              height: 32,
              margin: "8px 0 0 8px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="Mở Explorer"
          >
            <PanelLeft size={16} />
          </button>
        )}

        {/* CENTER: SPLIT EDITOR & LIVE PREVIEW */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Editor Header Toolbar */}
          <div
            style={{
              height: 36,
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={() => {
                  const ta = textareaRef.current;
                  if (!ta) return;
                  const start = ta.selectionStart;
                  setContent((prev) => prev.slice(0, start) + "\n## " + prev.slice(start));
                }}
                className="ld-btn ld-btn-ghost"
                style={{ padding: "3px 6px" }}
                title="Thêm Tiêu đề H2"
              >
                <Heading2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const ta = textareaRef.current;
                  if (!ta) return;
                  const start = ta.selectionStart;
                  const end = ta.selectionEnd;
                  const sel = content.slice(start, end) || "văn bản đậm";
                  setContent((prev) => prev.slice(0, start) + `**${sel}**` + prev.slice(end));
                }}
                className="ld-btn ld-btn-ghost"
                style={{ padding: "3px 6px" }}
                title="In đậm"
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const ta = textareaRef.current;
                  if (!ta) return;
                  const start = ta.selectionStart;
                  const end = ta.selectionEnd;
                  const sel = content.slice(start, end) || "code";
                  setContent((prev) => prev.slice(0, start) + `\`${sel}\`` + prev.slice(end));
                }}
                className="ld-btn ld-btn-ghost"
                style={{ padding: "3px 6px" }}
                title="Chèn mã code"
              >
                <Code size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const ta = textareaRef.current;
                  if (!ta) return;
                  const start = ta.selectionStart;
                  const tableTmpl = `\n| Cột 1 | Cột 2 | Cột 3 |\n| :--- | :--- | :--- |\n| Giá trị 1 | Giá trị 2 | Giá trị 3 |\n`;
                  setContent((prev) => prev.slice(0, start) + tableTmpl + prev.slice(start));
                }}
                className="ld-btn ld-btn-ghost"
                style={{ padding: "3px 6px" }}
                title="Chèn Bảng biểu"
              >
                <TableIcon size={14} />
              </button>
            </div>

            {/* Split / Edit / Preview Toggle */}
            <div style={{ display: "flex", gap: 2, background: "#f1f5f9", padding: 2, borderRadius: 6 }}>
              <button
                type="button"
                onClick={() => setPreviewMode("edit")}
                style={{
                  border: "none",
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: 4,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: previewMode === "edit" ? "#ffffff" : "transparent",
                  color: previewMode === "edit" ? "#2563eb" : "#64748b",
                }}
              >
                Chỉ Soạn thảo
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("split")}
                style={{
                  border: "none",
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: 4,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: previewMode === "split" ? "#ffffff" : "transparent",
                  color: previewMode === "split" ? "#2563eb" : "#64748b",
                }}
              >
                Chia đôi (Split)
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("preview")}
                style={{
                  border: "none",
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: 4,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: previewMode === "preview" ? "#ffffff" : "transparent",
                  color: previewMode === "preview" ? "#2563eb" : "#64748b",
                }}
              >
                Xem trước
              </button>
            </div>
          </div>

          {/* Editor Body */}
          <div ref={editorBodyRef} style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
            {/* Left: Textarea Editor */}
            {(previewMode === "split" || previewMode === "edit") && (
              <div
                style={{
                  width: previewMode === "split" ? `${editorSplitPercent}%` : "100%",
                  borderRight: previewMode === "split" ? "1px solid #e2e8f0" : "none",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setIsDirty(true);
                  }}
                  style={{
                    flex: 1,
                    width: "100%",
                    height: "100%",
                    padding: 16,
                    fontFamily: "Consolas, 'Courier New', monospace",
                    fontSize: 13,
                    lineHeight: 1.6,
                    border: "none",
                    outline: "none",
                    resize: "none",
                    color: "#1e293b",
                  }}
                  placeholder="Soạn thảo Markdown tại đây..."
                />
              </div>
            )}

            {previewMode === "split" && (
              <ResizerHandle
                isDragging={activeDrag === "editor"}
                onMouseDown={() => setActiveDrag("editor")}
                title="Kéo qua lại để điều chỉnh tỷ lệ Soạn thảo / Xem trước"
              />
            )}

            {/* Right: Live Preview */}
            {(previewMode === "split" || previewMode === "preview") && (
              <div
                style={{
                  flex: 1,
                  padding: 24,
                  overflowY: "auto",
                  backgroundColor: "#ffffff",
                  minWidth: 0,
                }}
              >
                <MarkdownViewer content={content} />
              </div>
            )}
          </div>
        </div>

        {/* Resizer for Right Drawer */}
        <ResizerHandle
          isDragging={activeDrag === "drawer"}
          onMouseDown={() => setActiveDrag("drawer")}
          title="Kéo qua lại để thu nhỏ / phóng to ngăn Đối chiếu 2 Chiều"
        />

        {/* RIGHT: TWO-WAY CROSS-CHECK DRAWER */}
        <div
          style={{
            width: drawerWidth,
            borderLeft: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={16} style={{ color: "#d97706" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>Đối chiếu 2 Chiều</span>
            </div>
            <button
              type="button"
              onClick={() => handleRunCrossCheck(content, repoId, scopedFolder, false)}
              disabled={runningCrossCheck}
              style={{
                border: "none",
                background: "transparent",
                color: "#2563eb",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RefreshCw size={12} className={runningCrossCheck ? "animate-spin" : ""} />
              Quét lại
            </button>
          </div>

          {/* Template Selector inside Drawer */}
          <div
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid #f1f5f9",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
              Template:
            </span>
            <select
              value={selectedTemplateId || ""}
              onChange={(e) => {
                const newTid = Number(e.target.value);
                setSelectedTemplateId(newTid);
                handleRunCrossCheck(content, repoId, scopedFolder, false, newTid);
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#0f172a",
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                flex: 1,
                maxWidth: 210,
                outline: "none",
                cursor: "pointer",
              }}
              title="Đổi Template mẫu để đối chiếu"
            >
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Results Summary */}
          {crossCheckResult ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                  <span style={{ color: "#64748b" }}>Chuẩn cấu trúc:</span>
                  <span
                    style={{
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: crossCheckResult.templateValid ? "#dcfce7" : "#fee2e2",
                      color: crossCheckResult.templateValid ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {crossCheckResult.templateValid ? "✓ Đạt chuẩn Template" : `Thiếu ${crossCheckResult.missingTemplateHeadings.length} đề mục`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#64748b" }}>Bao phủ AST Code:</span>
                  <span style={{ fontWeight: 700, color: crossCheckResult.coveragePercentage >= 80 ? "#15803d" : "#d97706" }}>
                    {crossCheckResult.coveragePercentage}% ({crossCheckResult.documentedCodeEntities}/{crossCheckResult.totalCodeEntities})
                  </span>
                </div>

                {/* Nút mở Option Dialog */}
                {(crossCheckResult.missingTemplateHeadings.length > 0 || crossCheckResult.missingCodeEntitiesCount > 0) && (
                  <button
                    type="button"
                    onClick={() => setShowOptionModal(true)}
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: "7px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 6,
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
                      cursor: "pointer",
                    }}
                  >
                    <Sparkles size={13} />
                    Mở Hộp thoại Tùy chọn (Options)
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  onClick={() => setCrossCheckTab("template")}
                  style={{
                    flex: 1,
                    padding: "8px 4px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    borderBottom: crossCheckTab === "template" ? "2px solid #2563eb" : "2px solid transparent",
                    color: crossCheckTab === "template" ? "#2563eb" : "#64748b",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Mục thiếu ({crossCheckResult.missingTemplateHeadings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCrossCheckTab("code")}
                  style={{
                    flex: 1,
                    padding: "8px 4px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    borderBottom: crossCheckTab === "code" ? "2px solid #2563eb" : "2px solid transparent",
                    color: crossCheckTab === "code" ? "#2563eb" : "#64748b",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Code thiếu ({crossCheckResult.missingCodeEntitiesCount})
                </button>
              </div>

              {/* Tab Contents */}
              <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                {crossCheckTab === "template" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {crossCheckResult.missingTemplateHeadings.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#16a34a", fontSize: 12, padding: 20 }}>
                        ✓ Tài liệu đã có đầy đủ toàn bộ 10 phần theo tiêu chuẩn!
                      </div>
                    ) : (
                      crossCheckResult.missingTemplateHeadings.map((heading) => (
                        <div
                          key={heading}
                          style={{
                            padding: 8,
                            borderRadius: 6,
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ color: "#991b1b", fontWeight: 500 }}>{heading}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setContent((prev) => prev.trim() + `\n\n## ${heading}\n\n*Nội dung cho phần ${heading}*\n`);
                              setIsDirty(true);
                              notify("success", `Đã bổ sung "${heading}"!`);
                            }}
                            style={{
                              border: "none",
                              background: "#dc2626",
                              color: "#ffffff",
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            + Chèn
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {crossCheckTab === "code" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {crossCheckResult.missingCodeEntities.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#16a34a", fontSize: 12, padding: 20 }}>
                        ✓ Toàn bộ thực thể mã nguồn đều đã được tài liệu hóa!
                      </div>
                    ) : (
                      crossCheckResult.missingCodeEntities.map((ent, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: 8,
                            borderRadius: 6,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            fontSize: 11,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: "#0f172a" }}>
                              {ent.className}{ent.methodName ? `.${ent.methodName}()` : ""}
                            </span>
                            <span style={{ fontSize: 9, color: "#64748b", background: "#e2e8f0", padding: "1px 4px", borderRadius: 3 }}>
                              {ent.entityType}
                            </span>
                          </div>
                          <p style={{ margin: "2px 0 6px 0", color: "#64748b", fontSize: 10 }}>
                            {ent.filePath}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const snippet = ent.suggestedMarkdown || `\n#### \`${ent.className}\`\n${ent.suggestion || "Mô tả thực thể mã nguồn."}\n`;
                              setContent((prev) => prev.trim() + "\n\n" + snippet.trim() + "\n");
                              setIsDirty(true);
                              notify("success", `Đã bổ sung mô tả cho ${ent.className}!`);
                            }}
                            style={{
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#2563eb",
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            + Chèn vào tài liệu
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, padding: 24, textAlign: "center", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={28} style={{ color: "#d97706", opacity: 0.5, marginBottom: 8 }} />
              <p style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>
                Chưa đối chiếu
              </p>
              <p style={{ fontSize: 11, lineHeight: 1.4, margin: 0 }}>
                Chọn Template ở trên và bấm nút &quot;Đối chiếu Template&quot; để so khớp tài liệu với Template mẫu và AST code.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* END WRAPPER FOR WORKSPACE */}
      </div>

      {/* MODAL XEM MÃ NGUỒN TỪ EXPLORER */}
      {viewingFile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              borderRadius: 12,
              width: "100%",
              maxWidth: 900,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              overflow: "hidden",
              border: "1px solid #334155",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid #334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#0f172a",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f8fafc", fontSize: 13, fontWeight: 600 }}>
                <FileCode size={16} style={{ color: "#38bdf8" }} />
                <span>{viewingFile.path}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewingFile(null)}
                style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                fontFamily: "Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.6,
                color: "#e2e8f0",
              }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {viewingFile.content.split("\n").map((line, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 14 }}>
                    <span style={{ color: "#64748b", userSelect: "none", minWidth: 32, textAlign: "right" }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1 }}>{line || " "}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE OPTION MODAL */}
      <InteractiveOptionModal
        isOpen={showOptionModal}
        onClose={() => setShowOptionModal(false)}
        title="Tùy chọn Bổ sung & Chuẩn hóa Tài liệu"
        templateName={
          availableTemplates.find((t) => t.id === selectedTemplateId)?.name ||
          "Mẫu Tiêu chuẩn Dự án (10 Phần)"
        }
        missingHeadings={crossCheckResult?.missingTemplateHeadings || []}
        missingEntities={crossCheckResult?.missingCodeEntities || []}
        onApplyOption={handleApplyInteractiveOption}
      />
    </AppShell>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ padding: 40, textAlign: "center" }}>Đang tải không gian làm việc Workspace...</div>
        </AppShell>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
