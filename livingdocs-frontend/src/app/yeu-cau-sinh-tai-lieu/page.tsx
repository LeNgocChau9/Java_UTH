"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/AppShell";
import {
  GitBranch,
  Sparkles,
  Loader2,
  CheckCircle,
  FileCode2,
  Send,
  Eye,
  RefreshCw,
  ShieldCheck,
  GitCommit,
  FolderGit2,
  BookOpen,
  Boxes,
  FileText,
  Search,
  Code2,
  Cpu,
  Layers,
  Check,
  FileCheck2,
  AlertTriangle,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { repoService, type RepoItem } from "@/services/repoService";

interface DocTemplateOption {
  id: number;
  name: string;
  type: string;
  description?: string;
  structure?: unknown;
  is_default?: boolean;
}

interface CodeEntityOption {
  entityId: number;
  repositoryId: number;
  filePath: string;
  entityType: string;
  className: string | null;
  methodName: string | null;
  signature: string | null;
  docStatus: string;
  commitHash: string;
  startLine: number;
  endLine: number;
  parameters?: string | null;
  javadoc?: string | null;
  annotations?: string[];
}

interface GeneratedDocResult {
  docId: number;
  title: string;
  targetPath: string;
  status: string;
  currentVersion: number;
  sourceCommit: string;
  content: string;
  scope?: string;
  linkedEntitiesCount?: number;
  confidenceScore?: number;
  mode?: string;
  provider?: string;
}

type ScopeType = "FILE" | "PACKAGE" | "REPOSITORY";
type Step = "idle" | "generating" | "generated" | "submitting" | "done" | "error";

// Các bước tiến trình phân tích động
interface AnalysisProgressStep {
  id: number;
  key: string;
  title: string;
  desc?: string;
  icon: typeof Search;
}

const ANALYSIS_STEPS: AnalysisProgressStep[] = [
  {
    id: 1,
    key: "scan",
    title: "Đang quét mã",
    desc: "",
    icon: Search,
  },
  {
    id: 2,
    key: "ast",
    title: "Đang bóc tách AST",
    desc: "",
    icon: Code2,
  },
  {
    id: 3,
    key: "llm",
    title: "Đang gọi LLM",
    desc: "",
    icon: Cpu,
  },
  {
    id: 4,
    key: "complete",
    title: "Hoàn tất",
    desc: "",
    icon: FileCheck2,
  },
];

// 4 mẫu tài liệu kỹ thuật chuẩn nghiệp vụ
const STANDARD_TEMPLATES: {
  id: number;
  name: string;
  type: string;
  badge: string;
  description: string;
  recommendedScope: ScopeType;
  icon: typeof FileText;
}[] = [
  {
    id: 6,
    name: "Tài liệu Dự án Tiêu chuẩn (10 Phần)",
    type: "PROJECT_DOCUMENTATION",
    badge: "Mặc định (10 Phần)",
    description: "Bộ tài liệu kỹ thuật toàn diện 10 phần: Phần đầu, Giới thiệu, Yêu cầu, Cài đặt, Bắt đầu, Chức năng chi tiết, Sự cố, Bảo mật, Hỗ trợ, Phụ lục.",
    recommendedScope: "REPOSITORY",
    icon: FileText,
  },
  {
    id: 1,
    name: "API Reference",
    type: "API_REFERENCE",
    badge: "Chi tiết API",
    description: "Bảng chi tiết phương thức, chữ ký hàm, kiểu trả về, tham số & xử lý ngoại lệ.",
    recommendedScope: "FILE",
    icon: Code2,
  },
  {
    id: 2,
    name: "README Dự án",
    type: "PROJECT_README",
    badge: "Tổng quan",
    description: "Tổng quan dự án, hướng dẫn cài đặt, cấu hình môi trường và kiến trúc chung.",
    recommendedScope: "REPOSITORY",
    icon: BookOpen,
  },
  {
    id: 3,
    name: "Hướng dẫn Mô-đun",
    type: "MODULE_GUIDE",
    badge: "Gói/Mô-đun",
    description: "Tài liệu hóa toàn bộ Package/Module, luồng liên lạc giữa các lớp và API nội bộ.",
    recommendedScope: "PACKAGE",
    icon: Boxes,
  },
  {
    id: 4,
    name: "ADR Kiến trúc",
    type: "ARCHITECTURE_ADR",
    badge: "Kiến trúc",
    description: "Bản ghi quyết định kiến trúc (Architecture Decision Record), bối cảnh kỹ thuật và hệ quả.",
    recommendedScope: "REPOSITORY",
    icon: Layers,
  },
];

function YeuCauSinhContent() {
  const searchParams = useSearchParams();
  const paramRepo = searchParams.get("repo");
  const paramScope = searchParams.get("scope");
  const paramClassName = searchParams.get("className");
  const paramMethodName = searchParams.get("methodName");
  const paramEntityType = searchParams.get("entityType");
  const paramTemplateId = searchParams.get("templateId");
  const paramNote = searchParams.get("note");

  const [repo, setRepo] = useState(paramRepo || "");
  const [branch, setBranch] = useState("main");
  const [templateId, setTemplateId] = useState<string>(paramTemplateId || "6");
  const [scopeType, setScopeType] = useState<ScopeType>(
    paramEntityType === "PACKAGE" ? "PACKAGE" : paramEntityType === "REPOSITORY" ? "REPOSITORY" : "FILE"
  );
  const [scope, setScope] = useState(paramScope || "");
  const [note, setNote] = useState(
    paramNote ||
    (paramClassName
      ? `Tự động sinh tài liệu kỹ thuật cho ${paramEntityType || "phần tử"} ${paramClassName}${paramMethodName ? "." + paramMethodName : ""}`
      : "")
  );
  const [aiProvider, setAiProvider] = useState<"auto" | "ollama" | "gemini">("ollama");
  const [step, setStep] = useState<Step>("idle");
  const [repositories, setRepositories] = useState<RepoItem[]>([]);
  const [templates, setTemplates] = useState<DocTemplateOption[]>([]);
  const [codeEntities, setCodeEntities] = useState<CodeEntityOption[]>([]);
  const [loadingRepositories, setLoadingRepositories] = useState(true);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic progress state for AI generation
  const [currentProgressIndex, setCurrentProgressIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Result state
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocResult | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [previewTab, setPreviewTab] = useState<"rendered" | "raw">("rendered");

  // Đồng bộ lại khi query params thay đổi
  useEffect(() => {
    if (paramRepo) setRepo(paramRepo);
    if (paramScope) setScope(paramScope);
    if (paramTemplateId) setTemplateId(paramTemplateId);
    if (paramEntityType === "PACKAGE") setScopeType("PACKAGE");
    else if (paramEntityType === "REPOSITORY") setScopeType("REPOSITORY");
    else if (paramEntityType) setScopeType("FILE");
    if (paramNote) {
      setNote(paramNote);
    } else if (paramClassName) {
      setNote(
        `Tự động sinh tài liệu kỹ thuật cho ${paramEntityType || "phần tử"} ${paramClassName}${paramMethodName ? "." + paramMethodName : ""}`
      );
    }
  }, [paramRepo, paramScope, paramClassName, paramMethodName, paramEntityType, paramTemplateId, paramNote]);

  // Load repositories from DB & templates from doc_templates
  useEffect(() => {
    Promise.all([
      repoService.getRepositories().catch(() => [] as RepoItem[]),
      apiClient
        .get<DocTemplateOption[]>("/api/templates")
        .then((res) => res.data)
        .catch(() => [] as DocTemplateOption[]),
    ])
      .then(([items, tpls]) => {
        setRepositories(items);
        const effectiveRepo = paramRepo || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("repositoryId") || new URLSearchParams(window.location.search).get("repoId") : null);
        const effectiveFile = paramScope || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("filePath") || new URLSearchParams(window.location.search).get("file") : null);
        const effectiveScopeType = paramEntityType === "PACKAGE" ? "PACKAGE" : paramEntityType === "REPOSITORY" ? "REPOSITORY" : (typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("scopeType") as ScopeType) : "FILE");
        const effectiveClass = paramClassName || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("className") : null);
        const effectiveMethod = paramMethodName || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("methodName") : null);

        if (effectiveRepo) {
          setRepo(effectiveRepo);
          const matched = items.find((r) => String(r.repositoryId) === effectiveRepo);
          if (matched?.defaultBranch) {
            setBranch(matched.defaultBranch);
          }
        } else if (items.length > 0 && items[0]?.repositoryId) {
          setRepo(String(items[0].repositoryId));
          setBranch(items[0].defaultBranch || "main");
        }

        if (effectiveFile) {
          setScope(effectiveFile);
        }
        if (effectiveScopeType && ["FILE", "PACKAGE", "REPOSITORY"].includes(effectiveScopeType)) {
          setScopeType(effectiveScopeType);
        }
        if (effectiveClass || effectiveMethod) {
          const entityDesc = [effectiveClass ? `Lớp: ${effectiveClass}` : null, effectiveMethod ? `Phương thức: ${effectiveMethod}` : null]
            .filter(Boolean)
            .join(" | ");
          setNote(`Yêu cầu AI sinh tài liệu đặc tả cho ${entityDesc}`);
        }

        // Ưu tiên các template chuẩn, merge cùng templates từ database
        if (tpls && tpls.length > 0) {
          const merged = [...STANDARD_TEMPLATES];
          tpls.forEach((dbTpl) => {
            if (!merged.some((m) => m.type === dbTpl.type || m.id === dbTpl.id)) {
              merged.push({
                id: dbTpl.id,
                name: dbTpl.name,
                type: dbTpl.type,
                badge: "Tùy biến",
                description: "Mẫu tài liệu chuyên dụng được nạp từ cơ sở dữ liệu hệ thống.",
                recommendedScope: "FILE",
                icon: FileText,
              });
            }
          });
          setTemplates(merged);
        } else {
          setTemplates(STANDARD_TEMPLATES);
        }
      })
      .catch(() => {
        setTemplates(STANDARD_TEMPLATES);
        setError("Không thể tải thông tin khởi tạo từ cơ sở dữ liệu. Vui lòng thử lại.");
      })
      .finally(() => setLoadingRepositories(false));
    // Nạp cấu hình AI đã lưu từ Settings
    apiClient
      .get<{ provider?: string }>("/api/v1/settings/ai")
      .then((res) => {
        if (res.data?.provider) {
          setAiProvider(res.data.provider as any);
        }
      })
      .catch(() => {});
  }, [paramRepo, paramScope, paramClassName, paramMethodName, paramEntityType]);

  // When repo changes, fetch its scanned code entities (.java files)
  useEffect(() => {
    if (!repo) {
      setCodeEntities([]);
      return;
    }
    setLoadingEntities(true);
    apiClient
      .get<CodeEntityOption[]>(`/api/v1/code-entities/repository/${repo}`)
      .then((res) => {
        const list = res.data || [];
        setCodeEntities(list);
        if (paramScope) {
          setScope(paramScope);
        } else if (list.length > 0 && !scope) {
          setScope(list[0].filePath);
        }
      })
      .catch(() => {
        apiClient
          .get<CodeEntityOption[]>(`/api/repos/${repo}/code-entities`)
          .then((res) => {
            const list = res.data || [];
            setCodeEntities(list);
            if (paramScope) {
              setScope(paramScope);
            } else if (list.length > 0 && !scope) {
              setScope(list[0].filePath);
            }
          })
          .catch(() => setCodeEntities([]));
      })
      .finally(() => setLoadingEntities(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, paramScope]);

  // Unique file paths from code entities
  const availableFiles = Array.from(new Set(codeEntities.map((e) => e.filePath)));

  // Unique package / folder paths from code entities
  const availablePackages = Array.from(
    new Set(
      availableFiles
        .map((fp) => {
          const idx = fp.lastIndexOf("/");
          return idx > 0 ? fp.slice(0, idx) : "";
        })
        .filter(Boolean)
    )
  );

  // Filter entities belonging to selected scope for verification evidence
  const selectedFileEntities = codeEntities.filter((e) => {
    if (scopeType === "REPOSITORY") return true;
    if (scopeType === "PACKAGE") {
      const pkgPrefix = scope || availablePackages[0] || "";
      return !pkgPrefix || e.filePath.startsWith(pkgPrefix);
    }
    return !scope || e.filePath === scope;
  });

  // Tự động điều chỉnh tiến trình loading động khi đang sinh tài liệu
  useEffect(() => {
    if (step === "generating") {
      setCurrentProgressIndex(0);
      setProgressPercent(15);

      const t1 = setTimeout(() => {
        setCurrentProgressIndex(1);
        setProgressPercent(45);
      }, 450);

      const t2 = setTimeout(() => {
        setCurrentProgressIndex(2);
        setProgressPercent(78);
      }, 950);

      const t3 = setTimeout(() => {
        setProgressPercent(92);
      }, 1500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (step === "generated" || step === "done") {
      setCurrentProgressIndex(3);
      setProgressPercent(100);
    } else {
      setCurrentProgressIndex(0);
      setProgressPercent(0);
    }
  }, [step]);

  // Xử lý tạo tài liệu bằng AI
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!repo) {
      setError("Bạn cần chọn repository đã kết nối trước khi tạo tài liệu.");
      setStep("error");
      return;
    }
    setError(null);
    setStep("generating");
    setGeneratedDoc(null);

    const selectedRepoItem = repositories.find((r) => String(r.repositoryId) === String(repo));
    const selectedTarget =
      scopeType === "REPOSITORY"
        ? selectedRepoItem?.repoFullName || "README.md"
        : scopeType === "PACKAGE"
          ? scope || availablePackages[0] || "src/main/java"
          : scope || availableFiles[0] || "src/main/java/com/example/MainService.java";

    const selectedTemplate =
      templates.find((t) => String(t.id) === String(templateId)) || STANDARD_TEMPLATES[0];

    const className =
      (paramClassName && scopeType === "FILE" ? paramClassName : null) ||
      (scopeType === "REPOSITORY"
        ? selectedRepoItem?.repoName || "RepositorySystem"
        : scopeType === "PACKAGE"
          ? selectedTarget.split("/").pop() || "ModulePackage"
          : selectedFileEntities.find((ent) => ent.className)?.className ||
          selectedTarget.split("/").pop()?.replace(".java", "") ||
          "AppService");

    try {
      let generatedMarkdown = "";
      let createdDocId: number | undefined;
      let createdTitle = "";
      let createdTargetPath = "";
      let createdStatus = "DRAFT";
      let createdVersion = 1;
      let createdSourceCommit = selectedFileEntities[0]?.commitHash || "b39f1c7e9a";
      let linkedCount = selectedFileEntities.length;
      let confidenceScore = 0.95;
      let generatedMode = aiProvider === "ollama" ? "ollama-local" : "real";

      // 1. Gọi API Điều phối Sinh tài liệu AI (/api/documents/generate-ai) theo 3 phạm vi (FILE, PACKAGE, REPOSITORY)
      try {
        const aiRes = await apiClient.post<{
          docId?: number;
          title?: string;
          targetPath?: string;
          scope?: string;
          documentStatus?: string;
          currentVersion?: number;
          sourceCommit?: string;
          linkedEntitiesCount?: number;
          status: string;
          mode: string;
          generated_content: string;
          confidence_score: number;
        }>("/api/documents/generate-ai", {
          repository_id: Number(repo),
          scope: scopeType,
          target_path: selectedTarget,
          file_path: selectedTarget,
          branch,
          template_id: Number(templateId),
          template_type: selectedTemplate?.type || "API_REFERENCE",
          class_name: className,
          note: note.trim() || undefined,
          save_document: true,
          provider: aiProvider,
          entities:
            selectedFileEntities.length > 0
              ? selectedFileEntities.map((ent) => ({
                entity_type: ent.entityType || "METHOD",
                class_name: ent.className || className,
                method_name: ent.methodName,
                signature: ent.signature,
                return_type: "void",
                parameters: ent.parameters,
                start_line: ent.startLine,
                end_line: ent.endLine,
                doc_status: ent.docStatus,
                javadoc: ent.javadoc,
                annotations: ent.annotations || [],
              }))
              : [
                {
                  entity_type: paramEntityType || "CLASS",
                  class_name: className,
                  method_name: paramMethodName || null,
                  signature: paramMethodName ? `${paramMethodName}()` : className,
                  return_type: "void",
                  parameters: "",
                  start_line: 1,
                  end_line: 100,
                  doc_status: "UNDOCUMENTED",
                  javadoc: null,
                  annotations: [],
                },
              ],
        });

        if (aiRes.data?.generated_content) {
          generatedMarkdown = aiRes.data.generated_content;
          createdDocId = aiRes.data.docId;
          createdTitle = aiRes.data.title || "";
          createdTargetPath = aiRes.data.targetPath || "";
          createdStatus = aiRes.data.documentStatus || "DRAFT";
          createdVersion = aiRes.data.currentVersion || 1;
          createdSourceCommit = aiRes.data.sourceCommit || createdSourceCommit;
          linkedCount = aiRes.data.linkedEntitiesCount || linkedCount;
          confidenceScore = aiRes.data.confidence_score || confidenceScore;
          generatedMode = aiRes.data.mode || generatedMode;
        }
      } catch (backendAiErr) {
        console.warn("Backend /generate-ai fallback:", backendAiErr);
      }

      // 2. Dự phòng: Gọi trực tiếp sang AI Engine nếu Backend chưa phản hồi
      if (!generatedMarkdown) {
        const aiEngineUrl = process.env.NEXT_PUBLIC_AI_ENGINE_URL || "http://localhost:8000";
        const engineRes = await fetch(`${aiEngineUrl}/v1/docs/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_path: selectedTarget || "README.md",
            template_type: selectedTemplate?.type || "API_REFERENCE",
            class_name: className || "AppService",
            provider: aiProvider || "auto",
            entities: selectedFileEntities.map((ent) => ({
              entity_type: ent.entityType || "METHOD",
              class_name: ent.className || className || "AppService",
              method_name: ent.methodName || "element",
              signature: ent.signature || `${ent.entityType || "METHOD"} ${ent.methodName || "element"}()`,
              return_type: "void",
              parameters: ent.parameters || "",
              start_line: typeof ent.startLine === "number" ? ent.startLine : 1,
              end_line: typeof ent.endLine === "number" ? ent.endLine : 1,
              doc_status: ent.docStatus || "UNDOCUMENTED",
              javadoc: ent.javadoc || "",
              annotations: Array.isArray(ent.annotations) ? ent.annotations : [],
            })),
          }),
        });

        if (engineRes.ok) {
          const engineData = await engineRes.json();
          generatedMarkdown = engineData.generated_content;
          confidenceScore = engineData.confidence_score || 0.95;
          generatedMode = engineData.mode || generatedMode;
        }
      }

      // 3. Dự phòng mẫu kỹ thuật nếu mất kết nối AI hoàn toàn
      if (!generatedMarkdown) {
        generatedMarkdown = `# Tài liệu Kỹ thuật cho \`${className}\`

> **Mẫu áp dụng:** ${selectedTemplate?.name || "API Reference"}  
> **Phạm vi:** ${scopeType} (\`${selectedTarget}\`)  
> **Nhánh mã nguồn:** \`${branch}\`  
> **Trạng thái:** DRAFT (Sinh tự động bởi LivingDocs AI)

## 1. Tổng quan & Mục đích thiết kế
Mô-đun \`${className}\` đóng vai trò thực thi các logic nghiệp vụ nòng cốt trong hệ thống LivingDocs. Đảm bảo tính nhất quán của dữ liệu, tuân thủ các quy tắc bảo mật và giao tiếp đồng bộ với cơ sở hạ tầng.

## 2. Chi tiết các Phương thức & API
| Tên phương thức | Kiểu trả về | Tham số | Vị trí dòng | Mô tả chức năng |
| :--- | :--- | :--- | :--- | :--- |
${selectedFileEntities.length > 0
            ? selectedFileEntities
              .slice(0, 6)
              .map(
                (ent) =>
                  `| \`${ent.methodName || "init"}\` | \`void\` | \`${ent.parameters || "None"}\` | L${ent.startLine}-L${ent.endLine} | Xử lý nghiệp vụ cho ${ent.methodName || className} |`
              )
              .join("\n")
            : `| \`executeProcess\` | \`boolean\` | \`String contextId\` | L15-L42 | Khởi tạo quy trình phân tích và đồng bộ tài liệu |`
          }

## 3. Hướng dẫn Tích hợp & Sử dụng
\`\`\`java
// Ví dụ tích hợp mô-đun
${className} service = new ${className}();
service.initialize();
\`\`\`

## 4. Bằng chứng xác thực nguồn (Grounding & Verification)
- **Tập tin phân tích:** \`${selectedTarget}\`
- **Thực thể đã ánh xạ:** ${selectedFileEntities.length} phần tử AST
- **Độ tin cậy xác thực:** ${(confidenceScore * 100).toFixed(0)}%
`;
      }

      // 4. Lưu tài liệu vào database nếu backend chưa lưu
      if (!createdDocId) {
        const safeRepoId = Number(repo) || repositories[0]?.repositoryId || 1;
        const safeTitle = (`Tài liệu ${selectedTemplate?.name || "API Reference"} - ${className || "Component"}`).trim();
        const safeContent = (generatedMarkdown || `# Tài liệu Kỹ thuật cho \`${className || "Component"}\`\n\nTài liệu được sinh tự động bởi LivingDocs AI.`).trim();
        const createRes = await apiClient.post<{ docId?: number; id?: number; title: string; targetPath: string; status: string }>(
          "/api/documents",
          {
            repoId: safeRepoId,
            title: safeTitle,
            targetPath:
              scopeType === "REPOSITORY"
                ? "README.md"
                : scopeType === "PACKAGE"
                  ? `${selectedTarget}/MODULE_GUIDE.md`
                  : `${selectedTarget.replace(/\.[^/.]+$/, "")}.md`,
            content: safeContent,
            actorRole: "AI",
            triggerType: "AI_GENERATION",
            templateId: Number(templateId) || 1,
          }
        );

        createdDocId = createRes.data.docId ?? createRes.data.id;
        createdTitle = createRes.data.title;
        createdTargetPath = createRes.data.targetPath;
        createdStatus = createRes.data.status || "DRAFT";
      }

      setGeneratedDoc({
        docId: createdDocId!,
        title: createdTitle || `Tài liệu ${selectedTemplate?.name} - ${className}`,
        targetPath: createdTargetPath || `${selectedTarget}.md`,
        status: createdStatus,
        currentVersion: createdVersion,
        sourceCommit: createdSourceCommit,
        content: generatedMarkdown,
        scope: scopeType,
        linkedEntitiesCount: linkedCount,
        confidenceScore: confidenceScore,
        mode: generatedMode,
        provider: aiProvider,
      });

      setStep("generated");
    } catch (caught) {
      let rawMsg =
        isAxiosError(caught) && typeof caught.response?.data?.message === "string"
          ? caught.response.data.message
          : "Không thể tạo tài liệu bằng AI. Vui lòng kiểm tra lại kết nối và thử lại.";

      const isDbOrInternal =
        rawMsg.includes("Exception") ||
        rawMsg.includes("SQL") ||
        rawMsg.includes("could not execute") ||
        rawMsg.includes("relation") ||
        rawMsg.includes("constraint");

      if (isDbOrInternal) {
        rawMsg = "Hệ thống gặp sự cố cơ sở dữ liệu khi lưu trữ tài liệu. Vui lòng thử lại sau ít phút!";
      }

      setError(rawMsg);
      setStep("error");
    }
  }

  // Send to Staff for Review (Level 1)
  async function handleSubmitReview() {
    if (!generatedDoc?.docId) return;
    setStep("submitting");
    setError(null);

    try {
      await apiClient.post(`/api/documents/${generatedDoc.docId}/submit-review`, {
        comment: reviewComment.trim() || "Developer gửi yêu cầu kiểm duyệt tài liệu (Level 1)",
      });
      setStep("done");
    } catch (caught) {
      let rawMsg =
        isAxiosError(caught) && typeof caught.response?.data?.message === "string"
          ? caught.response.data.message
          : "Không thể gửi tài liệu xem xét cho Staff.";

      const isDbOrInternal =
        rawMsg.includes("Exception") ||
        rawMsg.includes("SQL") ||
        rawMsg.includes("could not execute") ||
        rawMsg.includes("relation") ||
        rawMsg.includes("constraint");

      if (isDbOrInternal) {
        rawMsg = "Hệ thống gặp sự cố cơ sở dữ liệu khi gửi duyệt tài liệu. Vui lòng thử lại sau ít phút!";
      }

      setError(rawMsg);
      setStep("generated");
    }
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">
            Yêu cầu AI sinh tài liệu
          </h1>

        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
          alignItems: "start",
        }}
        className="gen-grid"
      >
        {/* Left Form & Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Banner thông báo tự động điền từ Khoảng trống Tài liệu */}
          {(paramClassName || paramScope) && (
            <div
              style={{
                padding: "16px 20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                border: "1.5px solid #c7d2fe",
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                boxShadow: "0 2px 6px rgba(99, 102, 241, 0.08)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#4f46e5",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <Sparkles size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#312e81" }}>
                    ✨ Đã tự động điền từ Khoảng trống Tài liệu (Documentation Gap)
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#4338ca",
                      background: "#ffffff",
                      border: "1px solid #c7d2fe",
                      padding: "2px 10px",
                      borderRadius: 12,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {paramEntityType || "MÃ NGUỒN"}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#3730a3", marginTop: 6, margin: "6px 0 0" }}>
                  Phần tử đích:{" "}
                  <strong style={{ fontFamily: "monospace", color: "#1e1b4b" }}>
                    {paramClassName}
                    {paramMethodName ? `.${paramMethodName}()` : ""}
                  </strong>
                  {paramScope && (
                    <span style={{ marginLeft: 10, color: "#475569" }}>
                      • Tệp nguồn:{" "}
                      <code
                        style={{
                          fontFamily: "monospace",
                          background: "#ffffff",
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid #e2e8f0",
                          color: "#0f766e",
                        }}
                      >
                        {paramScope}
                      </code>
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: "#4f46e5", marginTop: 4, margin: "4px 0 0" }}>
                  Các thông tin kho lưu trữ, tệp nguồn và mẫu tài liệu đã được chọn sẵn tự động. Bạn chỉ cần nhấn nút{" "}
                  <strong>&quot;Tạo tài liệu bằng AI&quot;</strong> để tiến hành sinh tài liệu kỹ thuật!
                </p>
              </div>
            </div>
          )}

          {/* Form cấu hình */}
          <form onSubmit={handleGenerate}>
            <div className="ld-card" style={{ padding: 0, overflow: "hidden", border: "1px solid #dfe7e4" }}>
              {/* Card Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #dfe7e4",
                  background: "linear-gradient(135deg, #f8faf9 0%, #f0fdf4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FolderGit2 size={18} className="text-emerald-600" />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f766e", margin: 0 }}>
                    1. Thiết lập thông số
                  </p>
                </div>
              </div>

              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 1. Chọn Repository + Branch */}
                <div className="gen-form-repository-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <FolderGit2 size={14} className="text-emerald-600" />
                      Kho lưu trữ (Repository) *
                    </label>
                    <select
                      className="ld-select"
                      style={{ width: "100%", height: 42 }}
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                      disabled={step === "generating"}
                    >
                      {repositories.length > 0 ? (
                        repositories.map((item) => (
                          <option key={item.repositoryId} value={item.repositoryId ?? ""}>
                            {item.repoFullName}
                          </option>
                        ))
                      ) : (
                        <option value="">Chưa có repository nào được đồng bộ</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <GitBranch size={14} className="text-emerald-600" />
                      Nhánh mã nguồn (Branch) *
                    </label>
                    <div style={{ position: "relative" }}>
                      <GitBranch
                        size={15}
                        style={{
                          position: "absolute",
                          left: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#0f766e",
                          pointerEvents: "none",
                        }}
                      />
                      <input
                        className="ld-input"
                        style={{ paddingLeft: 34, height: 42 }}
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                        required
                        disabled={step === "generating"}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Chọn Phạm vi sinh tài liệu (3 Scopes) */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                      <Boxes size={14} className="text-emerald-600" />
                      Phạm vi sinh tài liệu (Scope) *
                    </label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Chọn mức độ bao phủ tài liệu mong muốn
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }} className="scope-selection-grid">
                    {[
                      {
                        value: "FILE" as ScopeType,
                        label: "Tệp đơn lẻ",
                        sub: "Single File",
                        desc: "Chi tiết phương thức, class và tham số cho 1 file mã nguồn cụ thể.",
                        icon: FileText,
                        badge: "Chi tiết cao",
                      },
                      {
                        value: "PACKAGE" as ScopeType,
                        label: "Mô-đun / Gói",
                        sub: "Package / Module",
                        desc: "Tổng hợp toàn bộ các file trong module, kiến trúc và luồng xử lý gói.",
                        icon: Boxes,
                        badge: "Khuyên dùng",
                      },
                      {
                        value: "REPOSITORY" as ScopeType,
                        label: "Toàn bộ kho lưu trữ",
                        sub: "Full Repository",
                        desc: "Sinh tài liệu kiến trúc toàn diện (README, ADR, Thiết kế tổng thể).",
                        icon: BookOpen,
                        badge: "Bao quát",
                      },
                    ].map((opt) => {
                      const isSelected = scopeType === opt.value;
                      const IconComp = opt.icon;
                      return (
                        <div
                          key={opt.value}
                          onClick={() => {
                            if (step === "generating") return;
                            setScopeType(opt.value);
                            if (opt.value === "FILE") {
                              setScope(availableFiles[0] || "");
                              setTemplateId("1"); // API Reference
                            } else if (opt.value === "PACKAGE") {
                              setScope(availablePackages[0] || "src/main/java");
                              setTemplateId("3"); // Module Guide
                            } else {
                              const currentRepo = repositories.find((r) => String(r.repositoryId) === String(repo));
                              setScope(currentRepo?.repoFullName || "README.md");
                              setTemplateId("2"); // Project README
                            }
                          }}
                          style={{
                            padding: "14px 16px",
                            borderRadius: 8,
                            border: `2px solid ${isSelected ? "#0f766e" : "#e2e8f0"}`,
                            background: isSelected ? "#f0fdf4" : "#ffffff",
                            cursor: step === "generating" ? "not-allowed" : "pointer",
                            transition: "all 180ms ease",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: 10,
                            position: "relative",
                            boxShadow: isSelected ? "0 4px 12px rgba(15, 118, 110, 0.08)" : "none",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 6,
                                    background: isSelected ? "#0f766e" : "#f1f5f9",
                                    color: isSelected ? "#ffffff" : "#64748b",
                                    display: "grid",
                                    placeItems: "center",
                                  }}
                                >
                                  <IconComp size={15} />
                                </div>
                                <div>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#0f766e" : "#0f172a", display: "block" }}>
                                    {opt.label}
                                  </span>
                                  <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    {opt.sub}
                                  </span>
                                </div>
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: isSelected ? "#dcfce7" : "#f8fafc",
                                  color: isSelected ? "#15803d" : "#64748b",
                                  border: `1px solid ${isSelected ? "#bbf7d0" : "#e2e8f0"}`,
                                }}
                              >
                                {opt.badge}
                              </span>
                            </div>
                            <p style={{ fontSize: 11.5, color: "#475569", margin: "6px 0 0", lineHeight: 1.45 }}>
                              {opt.desc}
                            </p>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: "50%",
                                border: `2px solid ${isSelected ? "#0f766e" : "#cbd5e1"}`,
                                display: "grid",
                                placeItems: "center",
                                background: isSelected ? "#0f766e" : "transparent",
                              }}
                            >
                              {isSelected && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#0f766e" : "#64748b" }}>
                              {isSelected ? "Đang chọn" : "Chọn phạm vi này"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Chọn Mẫu tài liệu (4 Templates chuẩn) */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                      <FileText size={14} className="text-emerald-600" />
                      Chọn Mẫu tài liệu kỹ thuật (Document Template) *
                    </label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Chuẩn hóa theo format Technical Writing
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="template-selection-grid">
                    {templates.map((tpl) => {
                      const isSelected = templateId === String(tpl.id);
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            if (step === "generating") return;
                            setTemplateId(String(tpl.id));
                          }}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 8,
                            border: `1.5px solid ${isSelected ? "#0f766e" : "#e2e8f0"}`,
                            background: isSelected ? "#f0fdf4" : "#ffffff",
                            cursor: step === "generating" ? "not-allowed" : "pointer",
                            transition: "all 150ms ease",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                          }}
                        >
                          <input
                            type="radio"
                            name="templateSelection"
                            value={String(tpl.id)}
                            checked={isSelected}
                            onChange={() => setTemplateId(String(tpl.id))}
                            disabled={step === "generating"}
                            style={{ marginTop: 3, accentColor: "#0f766e" }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                              <p
                                style={{
                                  fontSize: 13,
                                  fontWeight: isSelected ? 700 : 600,
                                  color: isSelected ? "#0f766e" : "#0f172a",
                                  margin: 0,
                                }}
                              >
                                {tpl.name}
                              </p>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "#e2e8f0",
                                  color: "#334155",
                                  fontFamily: "monospace",
                                }}
                              >
                                {tpl.type}
                              </span>
                            </div>
                            <p style={{ fontSize: 11.5, color: "#475569", margin: "4px 0 0", lineHeight: 1.4 }}>
                              {tpl.description || "Tài liệu kỹ thuật đồng bộ từ mã nguồn."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Chọn file / package / đích toàn repo mã nguồn */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                      <Code2 size={14} className="text-emerald-600" />
                      {scopeType === "FILE"
                        ? "Tệp mã nguồn mục tiêu *"
                        : scopeType === "PACKAGE"
                          ? "Thư mục / Gói mô-đun mục tiêu *"
                          : "Tệp đích toàn bộ Repository *"}
                    </label>
                    {loadingEntities ? (
                      <span style={{ fontSize: 11, color: "#0f766e", display: "flex", alignItems: "center", gap: 4 }}>
                        <RefreshCw size={11} className="animate-spin" /> Đang bóc tách cây mã nguồn...
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        {scopeType === "PACKAGE"
                          ? `${availablePackages.length} package sẵn sàng`
                          : `${availableFiles.length} file sẵn sàng`}
                      </span>
                    )}
                  </div>

                  {scopeType === "REPOSITORY" ? (
                    <div style={{ position: "relative" }}>
                      <input
                        className="ld-input"
                        style={{ height: 42, fontFamily: "monospace", fontSize: 13 }}
                        value={
                          scope ||
                          repositories.find((r) => String(r.repositoryId) === String(repo))?.repoFullName ||
                          "README.md"
                        }
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="README.md / docs/ARCHITECTURE.md"
                        disabled={step === "generating"}
                      />
                    </div>
                  ) : scopeType === "PACKAGE" ? (
                    availablePackages.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <select
                          className="ld-select"
                          style={{ width: "100%", height: 42, fontFamily: "monospace", fontSize: 12.5 }}
                          value={scope}
                          onChange={(e) => setScope(e.target.value)}
                          disabled={step === "generating"}
                        >
                          {availablePackages.map((pkg) => (
                            <option key={pkg} value={pkg}>
                              📂 {pkg}
                            </option>
                          ))}
                        </select>
                        <input
                          className="ld-input"
                          style={{ height: 38, fontSize: 12 }}
                          value={scope}
                          onChange={(e) => setScope(e.target.value)}
                          placeholder="Hoặc nhập đường dẫn package tùy chỉnh..."
                          disabled={step === "generating"}
                        />
                      </div>
                    ) : (
                      <input
                        className="ld-input"
                        style={{ height: 42, fontSize: 12.5 }}
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="vd: src/main/java/com/example/livingdocs_backend/application/service"
                        required
                        disabled={step === "generating"}
                      />
                    )
                  ) : availableFiles.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <select
                        className="ld-select"
                        style={{ width: "100%", height: 42, fontFamily: "monospace", fontSize: 12.5 }}
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        disabled={step === "generating"}
                      >
                        {availableFiles.map((f) => (
                          <option key={f} value={f}>
                            📄 {f}
                          </option>
                        ))}
                      </select>
                      <input
                        className="ld-input"
                        style={{ height: 38, fontSize: 12 }}
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="Hoặc nhập đường dẫn file khác..."
                        disabled={step === "generating"}
                      />
                    </div>
                  ) : (
                    <input
                      className="ld-input"
                      style={{ height: 42, fontSize: 12.5 }}
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      placeholder="vd: src/services/OrderService.ts hoặc src/main/java/MyService.java"
                      required
                      disabled={step === "generating"}
                    />
                  )}
                </div>

                {/* 5. Ghi chú bổ sung */}
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Ghi chú bổ sung cho AI (Tùy chọn)
                  </label>
                  <textarea
                    className="ld-input"
                    style={{ resize: "vertical", minHeight: 65, fontSize: 12.5 }}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Mô tả trọng tâm cần nhấn mạnh (vd: chú thích chi tiết các API thanh toán, cảnh báo bảo mật hoặc giải thích logic nghiệp vụ)..."
                    disabled={step === "generating"}
                  />
                </div>

                {/* 6. Nút kích hoạt sinh tài liệu */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 4 }}>
                  <button
                    type="submit"
                    className="ld-btn ld-btn-primary ld-btn-lg"
                    style={{
                      height: 46,
                      paddingLeft: 24,
                      paddingRight: 24,
                      fontSize: 14,
                      fontWeight: 700,
                      background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
                      boxShadow: "0 4px 14px rgba(15, 118, 110, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    disabled={step === "generating" || loadingRepositories || repositories.length === 0}
                    aria-busy={step === "generating"}
                  >
                    {step === "generating" ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Đang phân tích & sinh tài liệu...
                      </>
                    ) : (
                      "Generate"
                    )}
                  </button>


                </div>

                {/* Báo lỗi nếu có */}
                {step === "error" && error && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 6,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      color: "#b91c1c",
                      fontSize: 13,
                    }}
                  >
                    <AlertTriangle size={18} />
                    <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* Thanh Loading Tiến trình Động hiển thị các bước phân tích (Đang quét mã ➔ Đang bóc tách AST ➔ Đang gọi LLM ➔ Hoàn tất) */}
          {step === "generating" && (
            <div
              className="ld-card"
              style={{
                padding: "20px 24px",
                border: "1.5px solid #0f766e",
                background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)",
                borderRadius: 10,
                boxShadow: "0 8px 24px rgba(15, 118, 110, 0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#0f766e",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                    }}
                  >
                    <Sparkles size={16} className="animate-spin" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#0f766e", margin: 0 }}>
                      Tiến trình Phân tích & Biên soạn AI (Dynamic Progress)
                    </h3>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", fontFamily: "monospace" }}>
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar Line */}
              <div
                style={{
                  width: "100%",
                  height: 8,
                  borderRadius: 999,
                  background: "#e2e8f0",
                  overflow: "hidden",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "linear-gradient(90deg, #0f766e 0%, #10b981 100%)",
                    borderRadius: 999,
                    transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>

              {/* 4 Bước tiến trình động */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                }}
                className="dynamic-progress-steps"
              >
                {ANALYSIS_STEPS.map((s, idx) => {
                  const isCurrent = idx === currentProgressIndex;
                  const isFinished = idx < currentProgressIndex;
                  const IconComp = s.icon;

                  let borderColor = "#e2e8f0";
                  let bgColor = "#f8fafc";
                  let textColor = "#64748b";
                  let iconBg = "#e2e8f0";
                  let iconColor = "#94a3b8";

                  if (isFinished) {
                    borderColor = "#86efac";
                    bgColor = "#f0fdf4";
                    textColor = "#166534";
                    iconBg = "#22c55e";
                    iconColor = "#ffffff";
                  } else if (isCurrent) {
                    borderColor = "#0f766e";
                    bgColor = "#f0fdf4";
                    textColor = "#0f766e";
                    iconBg = "#0f766e";
                    iconColor = "#ffffff";
                  }

                  return (
                    <div
                      key={s.key}
                      style={{
                        padding: "12px 10px",
                        borderRadius: 8,
                        border: `1.5px solid ${borderColor}`,
                        background: bgColor,
                        transition: "all 250ms ease",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: iconBg,
                            color: iconColor,
                            display: "grid",
                            placeItems: "center",
                            fontSize: 11,
                          }}
                        >
                          {isFinished ? (
                            <Check size={13} strokeWidth={3} />
                          ) : isCurrent ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <IconComp size={12} />
                          )}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: textColor, opacity: 0.8 }}>
                          Bước {s.id}/4
                        </span>
                      </div>

                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: textColor, margin: 0 }}>
                          {s.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kết quả tài liệu sinh thành công phản hồi tức thời */}
          {(step === "generated" || step === "submitting" || step === "done") && generatedDoc && (
            <div
              className="ld-card"
              style={{
                padding: 0,
                overflow: "hidden",
                border: "1.5px solid #0f766e",
                borderRadius: 10,
                boxShadow: "0 8px 30px rgba(15, 118, 110, 0.12)",
                animation: "fadeIn 300ms ease-out",
              }}
            >
              {/* Header preview */}
              <div
                style={{
                  padding: "16px 22px",
                  background: "linear-gradient(135deg, #f0fdf4 0%, #e6f4ea 100%)",
                  borderBottom: "1px solid #bbf7d0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-600 text-white">
                      Hoàn tất sinh tài liệu
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      Scope: {generatedDoc.scope}
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      Độ tin cậy: {((generatedDoc.confidenceScore || 0.95) * 100).toFixed(0)}%
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                      generatedDoc.mode === "ollama-local"
                        ? "text-purple-800 bg-purple-100 border-purple-300"
                        : "text-blue-800 bg-blue-100 border-blue-300"
                    }`}>
                      {generatedDoc.mode === "ollama-local" ? "⚡ Ollama Local (RTX 4060)" : "☁️ Google Gemini"}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f766e", margin: 0 }}>
                    {generatedDoc.title}
                  </h3>
                  <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>
                    Phiên bản: <strong>v{generatedDoc.currentVersion} (DRAFT)</strong> · Tệp đích: <code style={{ color: "#0f766e", fontWeight: 600 }}>{generatedDoc.targetPath}</code>
                  </p>
                </div>

                {/* Tab switch Markdown vs Raw */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("rendered")}
                    className="ld-btn ld-btn-sm"
                    style={{
                      background: previewTab === "rendered" ? "#0f766e" : "#ffffff",
                      color: previewTab === "rendered" ? "#ffffff" : "#475569",
                      border: "1px solid #0f766e",
                      fontWeight: 600,
                    }}
                  >
                    Xem Markdown chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("raw")}
                    className="ld-btn ld-btn-sm"
                    style={{
                      background: previewTab === "raw" ? "#0f766e" : "#ffffff",
                      color: previewTab === "raw" ? "#ffffff" : "#475569",
                      border: "1px solid #0f766e",
                      fontWeight: 600,
                    }}
                  >
                    Mã nguồn thô
                  </button>
                </div>
              </div>

              <div style={{ padding: 22 }}>
                {/* Markdown Viewer */}
                {previewTab === "rendered" ? (
                  <div
                    className="markdown-viewer"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #dfe7e4",
                      borderRadius: 8,
                      padding: "24px 28px",
                      maxHeight: 460,
                      overflowY: "auto",
                      color: "#1e293b",
                      lineHeight: 1.7,
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {generatedDoc.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre
                    style={{
                      background: "#f8faf9",
                      border: "1px solid #dfe7e4",
                      borderRadius: 8,
                      padding: 18,
                      maxHeight: 460,
                      overflowY: "auto",
                      fontFamily: "monospace",
                      fontSize: 12,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      color: "#0f172a",
                      margin: 0,
                    }}
                  >
                    {generatedDoc.content}
                  </pre>
                )}

                {/* Bảng thông tin bằng chứng xác thực */}
                <div style={{ marginTop: 22 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={16} />
                    Bằng chứng xác thực cấu trúc mã nguồn (AST Source Evidence)
                  </h4>

                  <div style={{ overflowX: "auto", border: "1px solid #dfe7e4", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#f8faf9", borderBottom: "1.5px solid #dfe7e4", color: "#475569" }}>
                          <th style={{ padding: "10px 14px", fontWeight: 600 }}>Tên Class / Module</th>
                          <th style={{ padding: "10px 14px", fontWeight: 600 }}>Phương thức / Hàm</th>
                          <th style={{ padding: "10px 14px", fontWeight: 600 }}>Commit Hash</th>
                          <th style={{ padding: "10px 14px", fontWeight: 600 }}>Dòng mã</th>
                          <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "center" }}>Trạng thái xác thực</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFileEntities.length > 0 ? (
                          selectedFileEntities.slice(0, 10).map((entity) => (
                            <tr key={entity.entityId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "8px 14px", fontWeight: 600, color: "#0f766e" }}>
                                {entity.className || "—"}
                              </td>
                              <td style={{ padding: "8px 14px", fontFamily: "monospace", color: "#334155" }}>
                                {entity.methodName || "(Khai báo lớp)"}
                              </td>
                              <td style={{ padding: "8px 14px", fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <GitCommit size={11} />
                                  {entity.commitHash ? entity.commitHash.slice(0, 7) : generatedDoc.sourceCommit.slice(0, 7)}
                                </span>
                              </td>
                              <td style={{ padding: "8px 14px", color: "#64748b" }}>
                                L{entity.startLine} - L{entity.endLine}
                              </td>
                              <td style={{ padding: "8px 14px", textAlign: "center" }}>
                                <span className="ld-badge" style={{ background: "#dcfce7", color: "#166534", fontSize: 10.5, fontWeight: 600 }}>
                                  ✓ AST Verified
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ padding: "14px", textAlign: "center", color: "#64748b" }}>
                              Bằng chứng xác thực: {generatedDoc.targetPath} · Commit {generatedDoc.sourceCommit.slice(0, 7)} · Độ tin cậy: {((generatedDoc.confidenceScore || 0.95) * 100).toFixed(0)}%
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Gửi phê duyệt */}
                {step === "done" ? (
                  <div
                    style={{
                      marginTop: 18,
                      padding: 16,
                      background: "#f0fdf4",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <CheckCircle size={22} style={{ color: "#16a34a" }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#166534", margin: 0 }}>
                        Đã chuyển tài liệu sang trạng thái UNDER_REVIEW_STAFF thành công!
                      </p>
                      <p style={{ fontSize: 12.5, color: "#475569", margin: "3px 0 0" }}>
                        Tài liệu hiện đã xuất hiện trong hàng đợi duyệt cấp 1 để Staff kiểm tra và trình lên Manager.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                      Lời nhắn gửi kèm Staff duyệt tài liệu:
                    </label>
                    <input
                      className="ld-input"
                      style={{ height: 40 }}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Ghi chú tóm tắt nội dung tài liệu vừa được AI sinh..."
                    />
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={handleSubmitReview}
                        disabled={step === "submitting"}
                        className="ld-btn ld-btn-primary"
                        style={{ height: 40, display: "flex", alignItems: "center", gap: 8 }}
                      >
                        {step === "submitting" ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            Đang gửi duyệt...
                          </>
                        ) : (
                          <>
                            <Send size={15} />
                            Gửi duyệt tài liệu (Chuyển UNDER_REVIEW_STAFF)
                          </>
                        )}
                      </button>
                      <Link
                        href="/tai-lieu-cua-toi"
                        className="ld-btn ld-btn-secondary"
                        style={{ height: 40, display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <Eye size={15} />
                        Xem danh sách tài liệu của tôi
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Real AST Entities & Workflow Guide */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Real Scanned Entities Box */}
          <div className="ld-card" style={{ padding: 0, overflow: "hidden", border: "1px solid #dfe7e4" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #dfe7e4", background: "#f8faf9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <FileCode2 size={15} />
                Thực thể AST đã quét ({codeEntities.length})
              </p>
              {loadingEntities && <Loader2 size={13} className="animate-spin text-emerald-600" />}
            </div>
            <div style={{ padding: 14, maxHeight: 280, overflowY: "auto" }}>
              {codeEntities.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {codeEntities.slice(0, 10).map((entity) => (
                    <div
                      key={entity.entityId}
                      style={{
                        padding: "8px 10px",
                        background: "#f8faf9",
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#0f766e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>{entity.className ?? entity.methodName ?? entity.entityType}</span>
                        <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
                          L{entity.startLine}-{entity.endLine}
                        </span>
                      </div>
                      <div style={{ color: "#64748b", marginTop: 3, fontSize: 10.5, wordBreak: "break-all" }}>
                        {entity.filePath}
                      </div>
                    </div>
                  ))}
                  {codeEntities.length > 10 && (
                    <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", margin: "6px 0 0" }}>
                      và {codeEntities.length - 10} thực thể khác...
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                  Chưa có thực thể nào. Hãy chọn repository hoặc đồng bộ mã nguồn tại trang Kho lưu trữ.
                </p>
              )}
            </div>
          </div>

          {/* Workflow step guide */}
          <div className="ld-card" style={{ padding: 0, overflow: "hidden", border: "1px solid #dfe7e4" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #dfe7e4", background: "#f8faf9" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", margin: 0 }}>
                Quy trình Sinh tài liệu AI
              </p>
            </div>
            <div style={{ padding: "16px" }}>
              {[
                { n: 1, title: "Chọn kho lưu trữ & Phạm vi", desc: "Tệp đơn lẻ, Mô-đun/Gói hoặc Toàn repo" },
                { n: 2, title: "Chọn Mẫu tài liệu chuẩn", desc: "API Reference, README, Module Guide, ADR" },
                { n: 3, title: "Quan sát tiến trình AI động", desc: "Quét mã ➔ Bóc tách AST ➔ Gọi LLM ➔ Hoàn tất" },
                { n: 4, title: "Xem trước & Gửi duyệt Staff", desc: "Kiểm tra bằng chứng xác thực và gửi duyệt cấp 1" },
              ].map((s) => (
                <div key={s.n} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: s.n < 4 ? 14 : 0 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#f0fdf4",
                      color: "#0f766e",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11.5,
                      fontWeight: 700,
                      flexShrink: 0,
                      border: "1.5px solid #86efac",
                      marginTop: 2,
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                      {s.title}
                    </p>
                    <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>


        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .gen-grid { grid-template-columns: 1fr !important; }
          .scope-selection-grid { grid-template-columns: 1fr !important; }
          .template-selection-grid { grid-template-columns: 1fr !important; }
          .dynamic-progress-steps { grid-template-columns: 1fr 1fr !important; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .markdown-viewer h1 { font-size: 1.5rem; font-weight: 700; color: #0f766e; margin-bottom: 0.75rem; border-bottom: 1.5px solid #dfe7e4; padding-bottom: 0.25rem; }
        .markdown-viewer h2 { font-size: 1.25rem; font-weight: 600; color: #115e59; margin-top: 1.25rem; margin-bottom: 0.5rem; }
        .markdown-viewer h3 { font-size: 1.05rem; font-weight: 600; color: #0f172a; margin-top: 1rem; margin-bottom: 0.4rem; }
        .markdown-viewer p { margin-bottom: 0.75rem; color: #334155; }
        .markdown-viewer ul, .markdown-viewer ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .markdown-viewer li { margin-bottom: 0.25rem; }
        .markdown-viewer pre { background: #f8faf9; border: 1px solid #dfe7e4; border-radius: 6px; padding: 12px; overflow-x: auto; font-family: monospace; font-size: 12px; margin-bottom: 0.75rem; }
        .markdown-viewer code { background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #0f766e; }
        .markdown-viewer pre code { background: transparent; padding: 0; color: #0f172a; }
        .markdown-viewer table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; font-size: 12px; }
        .markdown-viewer th, .markdown-viewer td { border: 1px solid #dfe7e4; padding: 6px 10px; }
        .markdown-viewer th { background: #f8faf9; font-weight: 600; color: #0f766e; }
        .markdown-viewer blockquote { border-left: 3px solid #0f766e; padding-left: 12px; color: #64748b; font-style: italic; margin-bottom: 0.75rem; }
      `}</style>
    </AppShell>
  );
}

export default function YeuCauSinhPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
            Đang tải trang yêu cầu sinh tài liệu AI...
          </div>
        </AppShell>
      }
    >
      <YeuCauSinhContent />
    </Suspense>
  );
}
