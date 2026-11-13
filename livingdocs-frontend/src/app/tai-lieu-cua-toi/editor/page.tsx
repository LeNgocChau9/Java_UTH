"use client";

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MarkdownViewer } from "@/components/shared/MarkdownViewer";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import type { DocCollection, DocumentDetail, DocumentStatus, GroundingEvidenceItem } from "@/types/document";
import {
  Save,
  Send,
  ArrowLeft,
  Columns,
  Maximize2,
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
  Wand2,
} from "lucide-react";
import {
  templateService,
  type DocTemplateDto,
  type DocumentCrossCheckResponse,
} from "@/services/templateService";

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

const SAMPLE_MARKDOWN = `# Tài liệu Kiến trúc Hệ thống LivingDocs

## 1. Giới thiệu tổng quan
LivingDocs là nền tảng quản lý tài liệu sống (Living Documentation) đồng bộ tự động với kho mã nguồn GitHub, hỗ trợ phiên bản bất biến kèm chuỗi băm SHA-256 bảo vệ dữ liệu chống can thiệp trái phép.

### Các tính năng cốt lõi:
- **Chuỗi băm phiên bản (Hash-chain Integrity)**: Mỗi phiên bản nối tiếp được ký băm SHA-256 kế thừa phiên bản trước (Genesis Hash v1 -> vN).
- **Quy trình kiểm duyệt nghiêm ngặt (State Machine)**: \`DRAFT\` -> \`UNDER_REVIEW_STAFF\` -> \`UNDER_REVIEW_MANAGER\` -> \`APPROVED\` -> \`PUBLISHED\`.
- **Trình soạn thảo Split-View**: Soạn thảo Markdown với Line Numbers và xem trước thời gian thực.

## 2. Mô hình phân lớp Clean Architecture

| Tầng (Layer) | Thành phần | Trách nhiệm chính |
| :--- | :--- | :--- |
| **Domain** | Model & State Machine | Thực thể tài liệu, quy tắc chuyển trạng thái hợp lệ |
| **Application** | Port & Service | Xử lý logic nghiệp vụ, tính toán băm SHA-256 |
| **Infrastructure** | Web & Persistence | REST API Controllers, Spring Data JPA, PostgreSQL |

## 3. Đoạn mã mẫu (Code snippet)
\`\`\`typescript
// Gọi API lưu tài liệu nháp
const saveDraft = async (payload) => {
  const result = await documentService.createDocument({
    ...payload,
    triggerType: "MANUAL_CREATE"
  });
  console.log("Đã lưu nháp với Hash:", result.latestVersion?.hash);
};
\`\`\`

> **Lưu ý**: Sau khi hoàn thiện nội dung bản nháp, hãy nhấn nút **"Gửi để review"** ở góc trên bên phải để chuyển tài liệu vào hàng đợi kiểm duyệt của Staff Reviewer.
`;

const TEMPLATES: { name: string; content: string }[] = [
  {
    name: "API Reference Guide",
    content: `# [Tên API Service] - Tài liệu Đặc tả REST API\n\n## 1. Mục đích\nMô tả chi tiết các endpoint, tham số request và response cho service.\n\n## 2. Thông tin cơ bản\n- **Base URL**: \`/api/v1/...\`\n- **Xác thực**: Bearer JWT Token\n- **Định dạng dữ liệu**: \`application/json\`\n\n## 3. Danh sách Endpoint\n### GET /api/...\n**Mô tả**: Lấy danh sách tài nguyên.\n\n**Response 200 OK**:\n\`\`\`json\n{\n  "success": true,\n  "data": []\n}\n\`\`\`\n`,
  },
  {
    name: "Kiến trúc Module / Thiết kế Kỹ thuật",
    content: `# Tài liệu Thiết kế Kỹ thuật (Technical Design Doc)\n\n## 1. Bối cảnh & Vấn đề cần giải quyết\nNêu tóm tắt bài toán kỹ thuật hiện tại.\n\n## 2. Giải pháp đề xuất\nPhân tích kiến trúc tổng thể, mô hình dữ liệu và các tương tác.\n\n## 3. Rủi ro & Giải pháp dự phòng\n- Rủi ro 1: ...\n- Phương án xử lý: ...\n`,
  },
  {
    name: "Changelog & Hướng dẫn Triển khai",
    content: `# Release Notes & Deployment Guide\n\n## Phiên bản [vX.Y.Z] - Ngày phát hành: [DD/MM/YYYY]\n\n### Tính năng mới (New Features)\n- [x] Tính năng 1\n- [x] Tính năng 2\n\n### Hướng dẫn nâng cấp CSDL\n\`\`\`sql\n-- Migration script\n\`\`\`\n`,
  },
];

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("docId");

  const [docId, setDocId] = useState<number | null>(docIdParam ? parseInt(docIdParam, 10) : null);
  const [title, setTitle] = useState("Tài liệu mới không tiêu đề");
  const [content, setContent] = useState(SAMPLE_MARKDOWN);
  const [targetPath, setTargetPath] = useState("docs/guidelines.md");
  const [repoId, setRepoId] = useState<number>(1);
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [status, setStatus] = useState<DocumentStatus>("DRAFT");
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [latestHash, setLatestHash] = useState<string>("");

  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [collections, setCollections] = useState<DocCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "editor" | "preview">("split");
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [showConfirmReview, setShowConfirmReview] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [groundingLinks, setGroundingLinks] = useState<GroundingEvidenceItem[]>([]);
  const [loadingGrounding, setLoadingGrounding] = useState(false);
  const [groundingExpanded, setGroundingExpanded] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const docxFileInputRef = useRef<HTMLInputElement>(null);
  const [importingDocx, setImportingDocx] = useState(false);

  // Workspace 3-column Layout States
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [gitTreeFiles, setGitTreeFiles] = useState<string[]>([]);
  const [treeSearch, setTreeSearch] = useState<string>("");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [loadingTree, setLoadingTree] = useState(false);
  const [selectedRepoFile, setSelectedRepoFile] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  // Template & 2-Way Cross-Check states
  const [availableTemplates, setAvailableTemplates] = useState<DocTemplateDto[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [crossCheckResult, setCrossCheckResult] = useState<DocumentCrossCheckResponse | null>(null);
  const [runningCrossCheck, setRunningCrossCheck] = useState(false);
  const [crossCheckTab, setCrossCheckTab] = useState<"template" | "code" | "suggestions">("template");

  // Xem nội dung file mã nguồn được chọn từ Explorer (VS Code File Inspector)
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

  // Xử lý nạp file Word trực tiếp trong Workspace Editor
  const handleDirectDocxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportingDocx(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("repoId", String(repoId || 1));
      formData.append("title", title && title !== "Tài liệu mới không tiêu đề" ? title : file.name.replace(/\.[^.]+$/, ""));
      if (targetPath) {
        formData.append("targetPath", targetPath);
      }
      const created = await documentService.importDocx(formData);
      notify("success", `Nạp tệp "${file.name}" vào Workspace thành công!`);
      if (created.docId) {
        setDocId(created.docId);
        setTitle(created.title);
        if (created.repoId) setRepoId(created.repoId);
        if (created.targetPath) setTargetPath(created.targetPath);
        if (created.status) setStatus(created.status);
        if (created.currentVersion) setCurrentVersion(created.currentVersion);
        if (created.latestVersion?.content) {
          setContent(created.latestVersion.content);
          handleRunCrossCheck(created.latestVersion.content, created.repoId || repoId, created.targetPath || targetPath);
        }
        router.replace(`/tai-lieu-cua-toi/editor?docId=${created.docId}`);
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

  // Hiển thị thông báo Toast
  const notify = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const filteredPaths = useMemo(() => {
    if (!treeSearch.trim()) return gitTreeFiles;
    const q = treeSearch.toLowerCase().trim();
    return gitTreeFiles.filter((p) => p.toLowerCase().includes(q));
  }, [gitTreeFiles, treeSearch]);

  const treeNodes = useMemo(() => {
    return buildFileTree(filteredPaths);
  }, [filteredPaths]);

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
    recurse(treeNodes);
    setOpenFolders(all);
  };

  const collapseAllFolders = () => {
    setOpenFolders({});
  };

  const fetchRepoTree = useCallback(async (repositoryId: number) => {
    setLoadingTree(true);
    try {
      const items = await repoService.getRepositoryTree(repositoryId);
      if (items && items.length > 0) {
        const filePaths = items
          .filter((it) => it.type === "blob" || it.path?.includes("."))
          .map((it) => it.path);
        setGitTreeFiles(filePaths);
        const initialOpen: Record<string, boolean> = {};
        filePaths.forEach((p) => {
          const parts = p.split("/");
          if (parts.length > 1) {
            initialOpen[parts[0]] = true;
            if (parts.length > 2) initialOpen[`${parts[0]}/${parts[1]}`] = true;
          }
        });
        setOpenFolders(initialOpen);
      } else {
        const fallback = [
          "src/main/java/com/example/controller/DocumentController.java",
          "src/main/java/com/example/service/DocumentService.java",
          "src/main/java/com/example/entity/DocumentEntity.java",
          "src/main/java/com/example/repository/DocumentRepository.java",
          "docs/architecture.md",
          "docs/api-specification.md",
          "README.md",
        ];
        setGitTreeFiles(fallback);
        setOpenFolders({ src: true, "src/main": true, docs: true });
      }
    } catch {
      const fallback = [
        "src/main/java/com/example/controller/DocumentController.java",
        "src/main/java/com/example/service/DocumentService.java",
        "src/main/java/com/example/entity/DocumentEntity.java",
        "docs/architecture.md",
        "README.md",
      ];
      setGitTreeFiles(fallback);
      setOpenFolders({ src: true, docs: true });
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    if (repoId) {
      fetchRepoTree(repoId);
    }
  }, [repoId, fetchRepoTree]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const list = await templateService.getTemplates();
        if (list && list.length > 0) {
          setAvailableTemplates(list);
          const def = list.find((t) => t.isDefault) || list[0];
          setSelectedTemplateId(def.id);
        }
      } catch {
        // ignore
      }
    };
    fetchTemplates();
  }, []);

  const handleRunCrossCheck = async (markdownText?: string, overrideRepoId?: number, overrideTargetPath?: string | null) => {
    const textToCheck = markdownText !== undefined ? markdownText : content;
    const effectiveRepoId = overrideRepoId || repoId;
    if (!effectiveRepoId) {
      notify("error", "Vui lòng chọn repository liên kết!");
      return;
    }
    setRunningCrossCheck(true);
    try {
      const res = await templateService.crossCheck({
        templateId: selectedTemplateId || undefined,
        repositoryId: effectiveRepoId,
        markdown: textToCheck,
        targetPath: overrideTargetPath || targetPath,
      });
      setCrossCheckResult(res);
      notify("success", `Hoàn tất đối chiếu! Thiếu ${res.missingTemplateHeadings.length} đề mục và ${res.missingCodeEntitiesCount} thực thể code.`);
    } catch (err: any) {
      notify("error", "Lỗi quét đối chiếu: " + (err.response?.data?.message || err.message));
    } finally {
      setRunningCrossCheck(false);
    }
  };

  const handleApplySnippet = (snippet: string, titleStr: string) => {
    setContent((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n\n${snippet.trim()}\n` : snippet.trim();
    });
    setIsDirty(true);
    notify("success", `Đã bổ sung "${titleStr}" vào tài liệu!`);
  };

  const handleApplyAllSuggestions = () => {
    if (!crossCheckResult || !crossCheckResult.suggestions || crossCheckResult.suggestions.length === 0) {
      notify("info", "Không có gợi ý nào cần áp dụng.");
      return;
    }
    let additions = "";
    crossCheckResult.suggestions.forEach((s) => {
      if (s.suggestedMarkdown) {
        additions += `\n\n${s.suggestedMarkdown.trim()}`;
      }
    });
    setContent((prev) => prev.trim() + additions + "\n");
    setIsDirty(true);
    notify("success", `Đã áp dụng tất cả ${crossCheckResult.suggestions.length} gợi ý vào tài liệu!`);
  };

  // Nạp danh sách repositories và collections
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [repoList, colList] = await Promise.all([
          repoService.getRepositories().catch(() => []),
          documentService.getCollections().catch(() => []),
        ]);
        setRepos(repoList);
        setCollections(colList);

        if (repoList.length > 0 && !docIdParam) {
          setRepoId(repoList[0].repositoryId);
        }
        if (colList.length > 0 && !docIdParam) {
          setCollectionId(colList[0].id);
        }
      } catch (err) {
        console.error("Lỗi khi tải metadata:", err);
      }
    };

    fetchMetadata();
  }, [docIdParam]);

  // Nạp chi tiết tài liệu nếu đang sửa (docId)
  useEffect(() => {
    if (!docIdParam) return;
    const loadDoc = async () => {
      setLoading(true);
      try {
        const doc: DocumentDetail = await documentService.getDocumentById(parseInt(docIdParam, 10));
        setDocId(doc.docId);
        setTitle(doc.title);
        setTargetPath(doc.targetPath || "docs/document.md");
        setRepoId(doc.repoId);
        setCollectionId(doc.collectionId || null);
        setStatus(doc.status);
        setCurrentVersion(doc.currentVersion);
        if (doc.latestVersion) {
          setContent(doc.latestVersion.content || "");
          setLatestHash(doc.latestVersion.hash || "");
          handleRunCrossCheck(doc.latestVersion.content || "", doc.repoId, doc.targetPath || undefined);
        }
        setIsDirty(false);
      } catch (err: any) {
        const savedDraft = typeof window !== "undefined" ? sessionStorage.getItem(`drift_alert_draft_${docIdParam}`) : null;
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            setDocId(null); // Đặt về null để khi bấm Lưu nháp sẽ gọi API Tạo mới (POST /api/documents) thay vì Cập nhật
            setTitle(parsed.title || "Tài liệu khắc phục sai lệch");
            setTargetPath(parsed.targetPath || "docs/document.md");
            setContent(parsed.content || "");
            setIsDirty(true);
            notify("info", `Đã nạp nội dung đề xuất AI cho "${parsed.title}". Bấm "Lưu bản nháp" để tạo tài liệu vào hệ thống.`);
          } catch {
            notify("error", "Không thể nạp tài liệu: " + (err.response?.data?.message || err.message));
          }
        } else {
          notify("error", "Không thể nạp tài liệu: " + (err.response?.data?.message || err.message));
        }
      } finally {
        setLoading(false);
      }

      // Nạp danh sách bằng chứng xác thực Grounding (doc_code_links)
      if (docIdParam) {
        setLoadingGrounding(true);
        try {
          const links = await documentService.getDocumentCodeLinks(parseInt(docIdParam, 10));
          setGroundingLinks(links || []);
        } catch (e) {
          console.warn("Chưa thể lấy grounding links:", e);
        } finally {
          setLoadingGrounding(false);
        }
      }
    };

    loadDoc();
  }, [docIdParam]);

  // Phím tắt bàn phím Ctrl+S / Cmd+S để lưu nháp
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveDraft();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Chèn cú pháp markdown vào vị trí con trỏ trong Textarea
  const insertMarkdown = (prefix: string, suffix: string = "", defaultText: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    setIsDirty(true);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  // Xử lý nút "Lưu nháp"
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      notify("error", "Vui lòng nhập tiêu đề tài liệu!");
      return;
    }
    if (!content.trim()) {
      notify("error", "Nội dung tài liệu không được để trống!");
      return;
    }

    setSaving(true);
    try {
      if (docId) {
        // Cập nhật tài liệu đã có -> tạo phiên bản tiếp theo v(N+1)
        const updated = await documentService.updateDocument(docId, {
          title: title.trim(),
          targetPath: targetPath.trim(),
          collectionId,
          content,
          actorRole: "DEV",
          triggerType: "MANUAL_UPDATE",
        });
        setCurrentVersion(updated.currentVersion);
        setStatus(updated.status);
        if (updated.latestVersion) {
          setLatestHash(updated.latestVersion.hash);
        }
        setIsDirty(false);
        notify("success", `Đã lưu bản nháp thành công! (Phiên bản v${updated.currentVersion})`);
      } else {
        // Tạo tài liệu mới -> tạo Genesis v1
        const created = await documentService.createDocument({
          repoId,
          collectionId,
          title: title.trim(),
          targetPath: targetPath.trim(),
          content,
          actorRole: "DEV",
          triggerType: "MANUAL_CREATE",
        });
        setDocId(created.docId);
        setCurrentVersion(created.currentVersion);
        setStatus(created.status);
        if (created.latestVersion) {
          setLatestHash(created.latestVersion.hash);
        }
        setIsDirty(false);
        notify("success", `Đã tạo mới và lưu bản nháp thành công! (Phiên bản v1)`);
        // Thay đổi URL mà không reload trang
        router.replace(`/tai-lieu-cua-toi/editor?docId=${created.docId}`);
      }
    } catch (err: any) {
      notify("error", "Lưu nháp thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Xử lý nút "Gửi để review"
  const handleSubmitForReview = async () => {
    setShowConfirmReview(false);
    setSubmittingReview(true);

    try {
      let activeDocId = docId;

      // Nếu là tài liệu mới hoặc có thay đổi chưa lưu, tự động lưu trước khi gửi review
      if (!activeDocId || isDirty) {
        if (!title.trim() || !content.trim()) {
          notify("error", "Vui lòng điền tiêu đề và nội dung hợp lệ trước khi gửi review!");
          setSubmittingReview(false);
          return;
        }

        if (activeDocId) {
          await documentService.updateDocument(activeDocId, {
            title: title.trim(),
            targetPath: targetPath.trim(),
            collectionId,
            content,
            actorRole: "DEV",
            triggerType: "SUBMIT_FOR_REVIEW",
          });
        } else {
          const created = await documentService.createDocument({
            repoId,
            collectionId,
            title: title.trim(),
            targetPath: targetPath.trim(),
            content,
            actorRole: "DEV",
            triggerType: "SUBMIT_FOR_REVIEW",
          });
          activeDocId = created.docId;
          setDocId(created.docId);
          router.replace(`/tai-lieu-cua-toi/editor?docId=${created.docId}`);
        }
      }

      // Gọi API chuyển trạng thái sang UNDER_REVIEW_STAFF
      if (activeDocId) {
        const reviewed = await documentService.submitForReview(activeDocId);
        setStatus(reviewed.status);
        setCurrentVersion(reviewed.currentVersion);
        setIsDirty(false);
        notify("success", "Đã gửi tài liệu để review thành công! Trạng thái: Chờ duyệt (Staff Reviewer).");
      }
    } catch (err: any) {
      notify("error", "Gửi review thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingReview(false);
    }
  };

  // Sao chép nội dung Markdown
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Thống kê độ dài văn bản
  const stats = {
    words: content.trim() ? content.trim().split(/\s+/).length : 0,
    chars: content.length,
    lines: content.split("\n").length,
  };

  const renderTreeNode = (node: FileTreeNode, depth = 0) => {
    if (node.isFolder) {
      const isOpen = !!openFolders[node.fullPath];
      return (
        <div key={node.id}>
          <button
            type="button"
            onClick={() => toggleFolder(node.fullPath)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              width: "100%",
              padding: "4px 8px",
              paddingLeft: `${depth * 10 + 6}px`,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
              textAlign: "left",
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {isOpen ? <ChevronDown size={13} style={{ color: "#64748b" }} /> : <ChevronRight size={13} style={{ color: "#64748b" }} />}
            {isOpen ? <FolderOpen size={14} style={{ color: "#0284c7" }} /> : <Folder size={14} style={{ color: "#0284c7" }} />}
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {node.name}
            </span>
          </button>
          {isOpen && node.children && (
            <div>{node.children.map((child) => renderTreeNode(child, depth + 1))}</div>
          )}
        </div>
      );
    }
    const isSelected = selectedRepoFile === node.fullPath;
    const isNodeLoading = loadingFileContent && isSelected;
    return (
      <button
        key={node.id}
        type="button"
        onClick={() => handleOpenFilePreview(node.fullPath)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "4px 8px",
          paddingLeft: `${depth * 10 + 16}px`,
          border: "none",
          background: isSelected ? "#e0f2fe" : "transparent",
          color: isSelected ? "#0369a1" : "#475569",
          cursor: "pointer",
          fontSize: 12,
          textAlign: "left",
          borderRadius: 4,
          fontFamily: "var(--font-mono)",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "#f8fafc";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
        }}
        title={`Xem nội dung mã nguồn: ${node.fullPath}`}
      >
        {isNodeLoading ? <RefreshCw size={13} className="animate-spin" style={{ color: "#0284c7" }} /> : getFileIcon(node.name)}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {node.name}
        </span>
      </button>
    );
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          <div style={{ textAlign: "center", color: "var(--color-text-secondary)" }}>
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
            <p>Đang tải tài liệu vào trình soạn thảo...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            background: toast.type === "success" ? "#065f46" : toast.type === "error" ? "#991b1b" : "#1e293b",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 500,
            animation: "fadeIn 200ms ease",
          }}
        >
          {toast.type === "success" && <CheckCircle2 size={16} />}
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.type === "info" && <Clock size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Điều hướng & Metadata Chính */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
          background: "#ffffff",
          padding: "16px 20px",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Nút Quay lại & Tiêu đề */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 280 }}>
            <Link
              href="/tai-lieu-cua-toi"
              className="ld-btn ld-btn-ghost ld-btn-sm"
              title="Quay lại danh sách tài liệu"
            >
              <ArrowLeft size={16} />
              <span>Danh sách</span>
            </Link>
            <div style={{ width: 1, height: 24, background: "var(--color-border)" }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Nhập tiêu đề tài liệu tại đây..."
                style={{
                  width: "100%",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  border: "none",
                  outline: "none",
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "transparent",
                  transition: "background 150ms",
                }}
                onFocus={(e) => (e.target.style.background = "var(--color-muted)")}
                onBlur={(e) => (e.target.style.background = "transparent")}
              />
            </div>
          </div>

          {/* Các nút Hành động: Lưu nháp & Gửi để review */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Trạng thái chưa lưu */}
            {isDirty && (
              <span
                style={{
                  fontSize: 12,
                  color: "#d97706",
                  background: "#fffbeb",
                  padding: "4px 8px",
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={12} />
                Chưa lưu
              </span>
            )}

            {/* Trạng thái & Phiên bản */}
            <span
              className="ld-badge"
              style={{
                background:
                  status === "DRAFT"
                    ? "#f1f5f9"
                    : status === "UNDER_REVIEW_STAFF" || status === "UNDER_REVIEW_MANAGER"
                    ? "#fffbeb"
                    : "#ecfdf5",
                color:
                  status === "DRAFT"
                    ? "#475569"
                    : status === "UNDER_REVIEW_STAFF" || status === "UNDER_REVIEW_MANAGER"
                    ? "#b45309"
                    : "#059669",
              }}
            >
              {status === "DRAFT"
                ? "Bản nháp"
                : status === "UNDER_REVIEW_STAFF"
                ? "Chờ Staff duyệt"
                : status === "UNDER_REVIEW_MANAGER"
                ? "Chờ Manager duyệt"
                : status === "APPROVED"
                ? "Đã duyệt"
                : status === "PUBLISHED"
                ? "Đã xuất bản"
                : status}
              {" · v" + currentVersion}
            </span>

            {/* NÚT XEM LỊCH SỬ & SO SÁNH DIFF */}
            {docId && (
              <Link
                href={`/tai-lieu-cua-toi/lich-su?docId=${docId}`}
                className="ld-btn ld-btn-ghost"
                style={{ color: "var(--color-accent)", fontWeight: 500 }}
                title="Xem lịch sử các phiên bản và so sánh Diff song song"
              >
                <History size={15} />
                <span>Lịch sử & Diff</span>
              </Link>
            )}

            {/* NÚT NẠP TỪ FILE WORD (.DOCX) VÀO WORKSPACE */}
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
              disabled={importingDocx || saving}
              className="ld-btn ld-btn-ghost"
              style={{ color: "#2563eb", fontWeight: 500 }}
              title="Tải file Word (.docx) từ máy tính để chuyển đổi sang Markdown và nạp vào Workspace"
            >
              <Upload size={14} />
              <span>{importingDocx ? "Đang nạp file..." : "Nạp Word (.docx)"}</span>
            </button>

            {/* NÚT LƯU NHÁP */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || submittingReview}
              className="ld-btn ld-btn-secondary"
              title="Lưu bản nháp (Ctrl+S)"
            >
              <Save size={15} style={{ color: "#087f5b" }} />
              <span>{saving ? "Đang lưu..." : "Lưu nháp"}</span>
            </button>

            {/* NÚT BẬT/TẮT CỘT EXPLORER */}
            <button
              type="button"
              onClick={() => setLeftSidebarOpen((v) => !v)}
              className={`ld-btn ${leftSidebarOpen ? "ld-btn-secondary" : "ld-btn-ghost"}`}
              style={{ fontSize: 12, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
              title={leftSidebarOpen ? "Thu gọn Repo Explorer" : "Mở Repo Explorer"}
            >
              <PanelLeft size={14} style={{ color: leftSidebarOpen ? "#087f5b" : "#64748b" }} />
              <span>Explorer</span>
            </button>

            {/* NÚT BẬT/TẮT PANEL ĐỐI CHIẾU TEMPLATE & AI */}
            <button
              type="button"
              onClick={() => setRightSidebarOpen((v) => !v)}
              className={`ld-btn ${rightSidebarOpen ? "ld-btn-secondary" : "ld-btn-ghost"}`}
              style={{ fontSize: 12, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}
              title={rightSidebarOpen ? "Thu gọn Panel Đối chiếu Template & AI" : "Mở Panel Đối chiếu Template & AI"}
            >
              <Sparkles size={14} style={{ color: rightSidebarOpen ? "#087f5b" : "#64748b" }} />
              <span>Đối chiếu Template & AI</span>
              {crossCheckResult && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: crossCheckResult.templateValid && crossCheckResult.missingCodeEntitiesCount === 0 ? "#10b981" : "#ef4444",
                  }}
                />
              )}
            </button>

            {/* NÚT GỬI ĐỂ REVIEW */}
            <button
              type="button"
              onClick={() => setShowConfirmReview(true)}
              disabled={saving || submittingReview || status === "UNDER_REVIEW_STAFF"}
              className="ld-btn ld-btn-primary"
              style={{
                boxShadow: "0 2px 6px rgba(8, 127, 91, 0.25)",
              }}
              title="Gửi tài liệu này tới kiểm duyệt viên để phê duyệt"
            >
              <Send size={15} />
              <span>
                {submittingReview
                  ? "Đang gửi..."
                  : status === "UNDER_REVIEW_STAFF"
                  ? "Đang chờ duyệt"
                  : "Gửi để review"}
              </span>
            </button>
          </div>
        </div>

        {/* Dòng Cấu hình Repository, Collection và File Path */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            paddingTop: 12,
            borderTop: "1px dashed var(--color-border)",
            fontSize: 13,
          }}
        >
          {/* Bộ sưu tập (Collection) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Bộ sưu tập (Collection)
            </label>
            <select
              value={collectionId || ""}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                setCollectionId(val);
                setIsDirty(true);
              }}
              className="ld-select"
              style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
            >
              <option value="">-- Chưa gán bộ sưu tập --</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  📁 {col.name} {col.documentCount !== undefined ? `(${col.documentCount})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Kho mã nguồn (Repository) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Kho lưu trữ (Repository)
            </label>
            <select
              value={repoId}
              onChange={(e) => {
                setRepoId(parseInt(e.target.value, 10));
                setIsDirty(true);
              }}
              className="ld-select"
              style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
            >
              {repos.length === 0 ? (
                <option value={1}>livingdocs-backend</option>
              ) : (
                repos.map((repo) => (
                  <option key={repo.repositoryId} value={repo.repositoryId}>
                    📦 {repo.repoFullName || repo.repoName}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Đường dẫn file trong Repo */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Đường dẫn tệp đích (Target File Path)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => {
                  setTargetPath(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="docs/architecture.md"
                className="ld-input"
                style={{ padding: "6px 10px", fontSize: 13 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3-COLUMN VS CODE WORKSPACE CONTAINER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            leftSidebarOpen && rightSidebarOpen
              ? "270px minmax(0, 1fr) 350px"
              : leftSidebarOpen && !rightSidebarOpen
              ? "270px minmax(0, 1fr)"
              : !leftSidebarOpen && rightSidebarOpen
              ? "minmax(0, 1fr) 350px"
              : "minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* CỘT TRÁI: REPO FILE EXPLORER (CÂY THƯ MỤC REPO NHƯ VS CODE) */}
        {leftSidebarOpen && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh - 180px)",
              minHeight: 650,
              overflow: "hidden",
            }}
          >
            {/* Header Explorer */}
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--color-border)",
                background: "var(--color-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Folder size={14} style={{ color: "#087f5b" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
                  Explorer
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => fetchRepoTree(repoId)}
                  className="ld-btn ld-btn-ghost ld-btn-sm"
                  style={{ padding: 2 }}
                  title="Đồng bộ lại cây thư mục"
                >
                  <RefreshCw size={12} className={loadingTree ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Repo Sub-Header */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--color-border)", background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📦 {repos.find((r) => r.repositoryId === repoId)?.repoFullName || "Repository"}
              </div>
              {/* Search file box */}
              <div style={{ position: "relative", marginTop: 6 }}>
                <Search size={12} style={{ position: "absolute", left: 8, top: 7, color: "#94a3b8" }} />
                <input
                  type="text"
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  placeholder="Lọc tệp mã nguồn..."
                  style={{
                    width: "100%",
                    fontSize: 11,
                    padding: "4px 8px 4px 24px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Tree Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
              {loadingTree ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#64748b" }}>
                  Đang tải cấu trúc tệp...
                </div>
              ) : treeNodes.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
                  Không tìm thấy tệp phù hợp
                </div>
              ) : (
                treeNodes.map((n) => renderTreeNode(n, 0))
              )}
            </div>

            {/* Tree Footer Actions */}
            <div
              style={{
                padding: "8px 12px",
                borderTop: "1px solid var(--color-border)",
                background: "var(--color-muted)",
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "#64748b",
              }}
            >
              <button
                type="button"
                onClick={expandAllFolders}
                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0 }}
              >
                Mở tất cả
              </button>
              <button
                type="button"
                onClick={collapseAllFolders}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 0 }}
              >
                Thu gọn
              </button>
            </div>
          </div>
        )}

        {/* CỘT GIỮA: TRÌNH SOẠN THẢO VÀ XEM TRƯỚC MARKDOWN */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>

      {/* KHỐI BẰNG CHỨNG XÁC THỰC (GROUNDING EVIDENCE BOX) */}
      <div
        className="ld-card"
        style={{
          marginBottom: 16,
          padding: "14px 18px",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          background: "var(--color-bg-surface, #ffffff)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setGroundingExpanded(!groundingExpanded)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "#e6fcf5",
                color: "#087f5b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={16} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
                  Khối Bằng chứng Xác thực (Grounding Evidence Box)
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "#e6fcf5",
                    color: "#087f5b",
                    fontWeight: 600,
                  }}
                >
                  {groundingLinks.length > 0 ? `${groundingLinks.length} liên kết AST` : "Tự động trích xuất AST"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)" }}>
                Hiển thị tệp nguồn, các hàm tham chiếu, commit hash và khoảng dòng code được AI tham chiếu.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {groundingExpanded ? "Thu gọn" : "Mở rộng"}
            </span>
            <button type="button" className="ld-btn ld-btn-ghost ld-btn-sm" style={{ padding: 4 }}>
              {groundingExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {groundingExpanded && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--color-border)" }}>
            {loadingGrounding ? (
              <div style={{ padding: "12px 0", fontSize: 12, color: "var(--color-text-secondary)", textAlign: "center" }}>
                Đang tải dữ liệu bằng chứng mã nguồn AST...
              </div>
            ) : groundingLinks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {groundingLinks.map((link, idx) => (
                  <div
                    key={link.linkId || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                      padding: "8px 12px",
                      background: "var(--color-muted, #f8fafc)",
                      borderRadius: 6,
                      fontSize: 12,
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          color: "var(--color-accent, #1971c2)",
                        }}
                      >
                        <FileCode size={13} />
                        {link.filePath}
                      </span>

                      {link.className && (
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#e7f5ff",
                            color: "#1971c2",
                            fontWeight: 500,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          class {link.className}
                        </span>
                      )}

                      {link.methodName && (
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#fff4e6",
                            color: "#d9480f",
                            fontWeight: 500,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          fn {link.methodName}()
                        </span>
                      )}

                      {(link.startLine !== null && link.startLine !== undefined) && (
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#f1f3f5",
                            color: "var(--color-text-secondary)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          L{link.startLine}{link.endLine ? ` - L${link.endLine}` : ""}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {link.commitHash && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--color-text-secondary)",
                          }}
                          title={`Commit SHA: ${link.commitHash}`}
                        >
                          <GitCommit size={12} />
                          {link.commitHash.substring(0, 8)}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#e6fcf5",
                          color: "#087f5b",
                          fontWeight: 500,
                        }}
                      >
                        ✓ AST Grounded
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--color-muted, #f8fafc)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertCircle size={14} style={{ color: "#f59f00" }} />
                  <span>
                    Chưa có liên kết AST lưu trong cơ sở dữ liệu. Bằng chứng xác thực sẽ tự động được liên kết khi sinh tài liệu từ AI Engine.
                  </span>
                </div>
                <Link
                  href="/yeu-cau-sinh-tai-lieu"
                  className="ld-btn ld-btn-ghost ld-btn-sm"
                  style={{ color: "var(--color-accent)", fontSize: 11 }}
                >
                  <Sparkles size={12} />
                  <span>Sinh bằng AI</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thanh Công cụ Định dạng Markdown & Điều khiển Chế độ xem */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          background: "#ffffff",
          padding: "8px 14px",
          borderRadius: "8px 8px 0 0",
          border: "1px solid var(--color-border)",
          borderBottom: "none",
        }}
      >
        {/* Nhóm nút format */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => insertMarkdown("# ", "", "Tiêu đề lớn")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Heading 1"
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("## ", "", "Tiêu đề cấp 2")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Heading 2"
          >
            <Heading2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("### ", "", "Tiêu đề cấp 3")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Heading 3"
          >
            <Heading3 size={15} />
          </button>

          <div style={{ width: 1, height: 18, background: "var(--color-border)", margin: "0 4px" }} />

          <button
            type="button"
            onClick={() => insertMarkdown("**", "**", "chữ đậm")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="In đậm (Bold)"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("*", "*", "chữ nghiêng")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="In nghiêng (Italic)"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("~~", "~~", "chữ gạch ngang")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Gạch ngang"
          >
            <Strikethrough size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("`", "`", "code_inline")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Code một dòng"
          >
            <Code size={14} />
          </button>

          <div style={{ width: 1, height: 18, background: "var(--color-border)", margin: "0 4px" }} />

          <button
            type="button"
            onClick={() => insertMarkdown("```typescript\n// Mã nguồn\n", "\n```\n")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Khối mã (Code block)"
          >
            <FileCode size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("- ", "", "Mục danh sách")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Danh sách dấu chấm"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("1. ", "", "Mục thứ nhất")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Danh sách đánh số"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("- [ ] ", "", "Nhiệm vụ cần làm")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Danh sách kiểm tra (Task list)"
          >
            <CheckSquare size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("> ", "", "Trích dẫn quan trọng")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Khối trích dẫn (Blockquote)"
          >
            <Quote size={14} />
          </button>
          <button
            type="button"
            onClick={() =>
              insertMarkdown(
                "\n| Cột 1 | Cột 2 | Cột 3 |\n| :--- | :--- | :--- |\n| Giá trị A | Giá trị B | Giá trị C |\n"
              )
            }
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Chèn bảng (Table)"
          >
            <TableIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("[", "](https://example.com)", "Tên liên kết")}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Chèn link"
          >
            <LinkIcon size={14} />
          </button>

          <div style={{ width: 1, height: 18, background: "var(--color-border)", margin: "0 4px" }} />

          {/* Chèn Mẫu Template có sẵn */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              className="ld-btn ld-btn-ghost ld-btn-sm"
              style={{ color: "#087f5b" }}
            >
              <Sparkles size={13} />
              <span>Chèn mẫu</span>
              <ChevronDown size={11} />
            </button>
            {showTemplateDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 50,
                  marginTop: 4,
                  background: "#ffffff",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                  minWidth: 220,
                  overflow: "hidden",
                }}
              >
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setContent(tpl.content);
                      setIsDirty(true);
                      setShowTemplateDropdown(false);
                      notify("info", `Đã tải mẫu: ${tpl.name}`);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      textAlign: "left",
                      fontSize: 12,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      borderBottom: i < TEMPLATES.length - 1 ? "1px solid #f1f5f9" : "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chuyển đổi Chế độ xem: Chia đôi (Split) / Chỉ Soạn thảo / Chỉ Xem trước */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`ld-btn ld-btn-sm ${viewMode === "split" ? "ld-btn-primary" : "ld-btn-ghost"}`}
            title="Chế độ chia đôi (Split View: Edit bên trái, Preview bên phải)"
          >
            <Columns size={14} />
            <span>Chia đôi</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("editor")}
            className={`ld-btn ld-btn-sm ${viewMode === "editor" ? "ld-btn-primary" : "ld-btn-ghost"}`}
            title="Chỉ hiển thị khung soạn thảo"
          >
            <FileText size={14} />
            <span>Soạn thảo</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`ld-btn ld-btn-sm ${viewMode === "preview" ? "ld-btn-primary" : "ld-btn-ghost"}`}
            title="Chỉ hiển thị khung xem trước"
          >
            <Maximize2 size={14} />
            <span>Xem trước</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            title="Sao chép toàn bộ Markdown"
          >
            {copied ? <Check size={14} style={{ color: "#087f5b" }} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* KHUNG SOẠN THẢO VÀ XEM TRƯỚC (SPLIT-VIEW) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            viewMode === "split"
              ? "1fr 1fr"
              : viewMode === "editor"
              ? "1fr"
              : "1fr",
          border: "1px solid var(--color-border)",
          borderRadius: "0 0 8px 8px",
          background: "#ffffff",
          minHeight: "65vh",
          overflow: "hidden",
        }}
      >
        {/* PANE BÊN TRÁI: KHUNG SOẠN THẢO MARKDOWN */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderRight: viewMode === "split" ? "1px solid var(--color-border)" : "none",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                background: "var(--color-muted)",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>TRÌNH SOẠN THẢO MARKDOWN (CHỈNH SỬA)</span>
              <span>Hỗ trợ Markdown & GFM</span>
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setIsDirty(true);
              }}
              onKeyDown={(e) => {
                // Nhấn Tab để chèn 2 dấu cách thay vì nhảy focus
                if (e.key === "Tab") {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  const newContent = content.substring(0, start) + "  " + content.substring(end);
                  setContent(newContent);
                  setIsDirty(true);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
                    }
                  }, 0);
                }
              }}
              placeholder="Bắt đầu nhập nội dung Markdown tại đây..."
              style={{
                flex: 1,
                width: "100%",
                minHeight: 520,
                padding: "16px 20px",
                fontFamily: "var(--font-mono)",
                fontSize: 13.5,
                lineHeight: 1.7,
                color: "var(--color-text-primary)",
                background: "#fafbfc",
                border: "none",
                outline: "none",
                resize: "none",
              }}
            />

            {/* Thanh Trạng thái dòng & từ ở đáy khung soạn thảo */}
            <div
              style={{
                padding: "6px 16px",
                fontSize: 11,
                color: "var(--color-text-secondary)",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", gap: 14 }}>
                <span>{stats.lines} dòng</span>
                <span>{stats.words} từ</span>
                <span>{stats.chars} ký tự</span>
              </div>
              {latestHash && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#087f5b",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  title={`SHA-256 Hash: ${latestHash}`}
                >
                  <ShieldCheck size={13} />
                  <span>Hash: {latestHash.substring(0, 12)}...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANE BÊN PHẢI: KHUNG XEM TRƯỚC (PREVIEW) */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
              height: "100%",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                background: "var(--color-muted)",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>XEM TRƯỚC TRỰC TIẾP (PREVIEW)</span>
              <span style={{ color: "#087f5b", fontWeight: 500 }}>Live Render</span>
            </div>

            <div
              style={{
                flex: 1,
                padding: "24px 32px",
                overflowY: "auto",
                maxHeight: "75vh",
              }}
            >
              {content.trim() ? (
                <MarkdownViewer content={content} />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--color-text-disabled)",
                    textAlign: "center",
                    padding: "40px 0",
                  }}
                >
                  <FileText size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 14, fontWeight: 500 }}>Chưa có nội dung để hiển thị</p>
                  <p style={{ fontSize: 12 }}>Hãy nhập văn bản Markdown ở khung bên trái để xem kết quả trực tiếp.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
        </div>

        {/* CỘT PHẢI: PANEL ĐỐI CHIẾU TEMPLATE & AI ASSISTANT */}
        {rightSidebarOpen && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh - 180px)",
              minHeight: 650,
              overflow: "hidden",
            }}
          >
            {/* Header Right Panel */}
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--color-border)",
                background: "var(--color-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} style={{ color: "#087f5b" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
                  Đối chiếu Template & AI
                </span>
              </div>
            </div>

            {/* Template Selector & Run Button */}
            <div style={{ padding: 12, borderBottom: "1px solid var(--color-border)", background: "#fafafa" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
                Mẫu chuẩn (Doc Template)
              </label>
              <select
                value={selectedTemplateId || ""}
                onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : null)}
                className="ld-select"
                style={{ width: "100%", padding: "5px 8px", fontSize: 12, marginBottom: 8 }}
              >
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    📄 {t.name} {t.isDefault ? "(Mặc định)" : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleRunCrossCheck()}
                disabled={runningCrossCheck}
                className="ld-btn ld-btn-primary ld-btn-sm"
                style={{ width: "100%", justifyContent: "center", gap: 6, fontSize: 12, padding: "6px 12px" }}
              >
                <Wand2 size={13} className={runningCrossCheck ? "animate-spin" : ""} />
                <span>{runningCrossCheck ? "Đang đối chiếu..." : "Quét đối chiếu 2 chiều"}</span>
              </button>
            </div>

            {/* Results or Placeholder */}
            {!crossCheckResult ? (
              <div style={{ flex: 1, padding: 24, textAlign: "center", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={32} style={{ color: "#087f5b", opacity: 0.5, marginBottom: 10 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: "0 0 6px" }}>
                  Chưa quét đối chiếu
                </p>
                <p style={{ fontSize: 11, lineHeight: 1.5, margin: 0 }}>
                  Bấm &quot;Quét đối chiếu 2 chiều&quot; để kiểm tra cấu trúc tài liệu Word so với Template chuẩn và thực thể mã nguồn (Controller, Service, Entity).
                </p>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Summary Badges */}
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#475569" }}>Cấu trúc Template:</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: crossCheckResult.templateValid ? "#dcfce7" : "#fee2e2",
                        color: crossCheckResult.templateValid ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {crossCheckResult.templateValid ? "✓ Hợp lệ" : `Thiếu ${crossCheckResult.missingTemplateHeadings.length} mục`}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#475569" }}>Bao phủ Code AST:</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: crossCheckResult.coveragePercentage >= 80 ? "#15803d" : "#d97706" }}>
                      {crossCheckResult.coveragePercentage}% ({crossCheckResult.documentedCodeEntities}/{crossCheckResult.totalCodeEntities} thực thể)
                    </span>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
                  <button
                    type="button"
                    onClick={() => setCrossCheckTab("template")}
                    style={{
                      flex: 1,
                      padding: "8px 4px",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "none",
                      borderBottom: crossCheckTab === "template" ? "2px solid #087f5b" : "2px solid transparent",
                      color: crossCheckTab === "template" ? "#087f5b" : "#64748b",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Template ({crossCheckResult.missingTemplateHeadings.length})
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
                      borderBottom: crossCheckTab === "code" ? "2px solid #087f5b" : "2px solid transparent",
                      color: crossCheckTab === "code" ? "#087f5b" : "#64748b",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Code ({crossCheckResult.missingCodeEntitiesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrossCheckTab("suggestions")}
                    style={{
                      flex: 1,
                      padding: "8px 4px",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "none",
                      borderBottom: crossCheckTab === "suggestions" ? "2px solid #087f5b" : "2px solid transparent",
                      color: crossCheckTab === "suggestions" ? "#087f5b" : "#64748b",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Gợi ý AI ({crossCheckResult.suggestions.length})
                  </button>
                </div>

                {/* Tab Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                  {crossCheckTab === "template" && (
                    <div>
                      {crossCheckResult.missingTemplateHeadings.length === 0 ? (
                        <div style={{ padding: 16, textAlign: "center", color: "#15803d", fontSize: 12 }}>
                          <CheckCircle2 size={20} style={{ margin: "0 auto 6px" }} />
                          <p style={{ margin: 0, fontWeight: 600 }}>Tài liệu đầy đủ các đề mục bắt buộc theo Template!</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {crossCheckResult.missingTemplateHeadings.map((h, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 6,
                                border: "1px solid #fee2e2",
                                background: "#fff5f5",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <AlertTriangle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#991b1b" }}>{h}</span>
                              </div>
                              <p style={{ fontSize: 11, color: "#7f1d1d", margin: 0 }}>
                                Thiếu phần này so với mẫu &quot;{crossCheckResult.templateName}&quot;.
                              </p>
                              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => handleApplySnippet(`\n${h}\n\nNội dung chi tiết cho ${h}...\n`, h)}
                                  className="ld-btn ld-btn-ghost ld-btn-sm"
                                  style={{ fontSize: 11, color: "#087f5b", padding: "2px 6px" }}
                                >
                                  <Plus size={11} />
                                  <span>Bổ sung mục này</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {crossCheckTab === "code" && (
                    <div>
                      {crossCheckResult.missingCodeEntities.length === 0 ? (
                        <div style={{ padding: 16, textAlign: "center", color: "#15803d", fontSize: 12 }}>
                          <CheckCircle2 size={20} style={{ margin: "0 auto 6px" }} />
                          <p style={{ margin: 0, fontWeight: 600 }}>Tất cả Controller, Service, Entity trong repository đã được mô tả!</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {crossCheckResult.missingCodeEntities.map((ent, idx) => (
                            <div
                              key={ent.entityId || idx}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 6,
                                border: "1px solid #fed7aa",
                                background: "#fffaf0",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    background: ent.entityType === "Controller" ? "#dbeafe" : ent.entityType === "Service" ? "#dcfce7" : "#f3e8ff",
                                    color: ent.entityType === "Controller" ? "#1d4ed8" : ent.entityType === "Service" ? "#15803d" : "#7e22ce",
                                  }}
                                >
                                  {ent.entityType}
                                </span>
                                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#64748b" }}>
                                  {ent.filePath ? ent.filePath.split("/").pop() : ""}
                                </span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", fontFamily: "var(--font-mono)" }}>
                                {ent.className}
                              </span>
                              <p style={{ fontSize: 11, color: "#7c2d12", margin: 0 }}>
                                {ent.suggestion}
                              </p>
                              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => handleApplySnippet(ent.suggestedMarkdown, ent.className)}
                                  className="ld-btn ld-btn-ghost ld-btn-sm"
                                  style={{ fontSize: 11, color: "#087f5b", padding: "2px 6px" }}
                                >
                                  <Plus size={11} />
                                  <span>Thêm đặc tả</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {crossCheckTab === "suggestions" && (
                    <div>
                      {crossCheckResult.suggestions.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <button
                            type="button"
                            onClick={handleApplyAllSuggestions}
                            className="ld-btn ld-btn-primary ld-btn-sm"
                            style={{ width: "100%", justifyContent: "center", fontSize: 11, padding: "5px 10px" }}
                          >
                            <Sparkles size={12} />
                            <span>Áp dụng tất cả ({crossCheckResult.suggestions.length} gợi ý)</span>
                          </button>
                        </div>
                      )}
                      {crossCheckResult.suggestions.length === 0 ? (
                        <div style={{ padding: 16, textAlign: "center", color: "#64748b", fontSize: 12 }}>
                          Không có gợi ý nào cần xử lý.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {crossCheckResult.suggestions.map((sug, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: "#f8fafc",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                                {sug.title}
                              </span>
                              <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>
                                {sug.description}
                              </p>
                              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                                <button
                                  type="button"
                                  onClick={() => handleApplySnippet(sug.suggestedMarkdown, sug.title)}
                                  className="ld-btn ld-btn-ghost ld-btn-sm"
                                  style={{ fontSize: 11, color: "#087f5b", padding: "2px 6px" }}
                                >
                                  <Plus size={11} />
                                  <span>Chèn vào tài liệu</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL XÁC NHẬN "GỬI ĐỂ REVIEW" */}
      {showConfirmReview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
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
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              animation: "fadeIn 150ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: "#eaf6ef",
                  color: "#087f5b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                  Xác nhận gửi để review?
                </h3>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                  Chuyển trạng thái sang Hàng đợi Kiểm duyệt Staff
                </p>
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
                background: "var(--color-muted)",
                padding: "12px 16px",
                borderRadius: 6,
                marginBottom: 20,
              }}
            >
              <p style={{ margin: "0 0 8px 0" }}>
                Khi bạn gửi review, hệ thống sẽ:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Tự động lưu nội dung mới nhất vào phiên bản tiếp theo.</li>
                <li>Chuyển trạng thái từ <strong>DRAFT</strong> sang <strong>UNDER_REVIEW_STAFF</strong>.</li>
                <li>Thông báo tới các kiểm duyệt viên (Staff Reviewers) để xem xét nội dung.</li>
              </ul>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowConfirmReview(false)}
                className="ld-btn ld-btn-secondary"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmitForReview}
                className="ld-btn ld-btn-primary"
              >
                <Send size={14} />
                <span>Xác nhận gửi review</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRÌNH XEM TỆP MÃ NGUỒN (VS CODE FILE INSPECTOR) */}
      {viewingFile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
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
              maxWidth: 820,
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              padding: 0,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              borderRadius: 10,
              overflow: "hidden",
              animation: "fadeIn 150ms ease",
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                background: "#0f172a",
                color: "#ffffff",
                borderBottom: "1px solid #1e293b",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <FileCode size={16} style={{ color: "#38bdf8", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={viewingFile.path}
                >
                  {viewingFile.path}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingFile(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
                title="Đóng cửa sổ"
              >
                ✕
              </button>
            </div>

            {/* Action Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 16px",
                background: "#1e293b",
                borderBottom: "1px solid #334155",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                {viewingFile.content.split("\n").length} dòng mã nguồn
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(viewingFile.content);
                    notify("success", "Đã sao chép mã nguồn vào Clipboard!");
                  }}
                  className="ld-btn ld-btn-ghost ld-btn-sm"
                  style={{ color: "#e2e8f0", fontSize: 11, padding: "4px 8px" }}
                >
                  <Copy size={12} />
                  <span>Sao chép mã</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const snippet = `\n\n> 📄 **Tham chiếu mã nguồn**: [\`${viewingFile.path}\`](${viewingFile.path})\n`;
                    setContent((prev) => prev.trim() + snippet);
                    setIsDirty(true);
                    notify("success", `Đã chèn tham chiếu ${viewingFile.path} vào tài liệu!`);
                    setViewingFile(null);
                  }}
                  className="ld-btn ld-btn-primary ld-btn-sm"
                  style={{ fontSize: 11, padding: "4px 10px" }}
                >
                  <Plus size={12} />
                  <span>Chèn tham chiếu vào tài liệu</span>
                </button>
                {viewingFile.path.toLowerCase().endsWith(".md") && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPath(viewingFile.path);
                      setIsDirty(true);
                      notify("success", `Đã đặt tệp đích thành ${viewingFile.path}`);
                      setViewingFile(null);
                    }}
                    className="ld-btn ld-btn-secondary ld-btn-sm"
                    style={{ fontSize: 11, padding: "4px 8px" }}
                  >
                    <span>Đặt làm tệp đích</span>
                  </button>
                )}
              </div>
            </div>

            {/* Code Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                background: "#090d16",
                color: "#e2e8f0",
                padding: "12px 16px",
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                lineHeight: 1.6,
                maxHeight: "62vh",
              }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {viewingFile.content.split("\n").map((line, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 14 }}>
                    <span
                      style={{
                        color: "#475569",
                        userSelect: "none",
                        minWidth: 32,
                        textAlign: "right",
                        fontSize: 11,
                      }}
                    >
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
    </AppShell>
  );
}

export default function DocumentEditorPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ padding: 40, textAlign: "center" }}>Đang tải trình soạn thảo...</div>
        </AppShell>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
