"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  Cpu,
  Server,
  Compass,
  Cloud,
  ShieldAlert,
  GitPullRequest,
  Bell,
  Webhook,
  Send,
  Mail,
  GitBranch,
  FileWarning,
  ClipboardCheck,
  Copy,
  Check,
  Plus,
  Trash2,
  Terminal,
  X,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import {
  externalIntegrationService,
  type ExternalIntegrationConfig,
  type TestExternalIntegrationResponse,
} from "@/services/externalIntegrationService";
import {
  ciTokenService,
  type CiTokenItem,
  type CreatedCiTokenItem,
} from "@/services/ciTokenService";
import { repoService, type RepoItem } from "@/services/repoService";
import { useSession } from "@/hooks/useSession";

const CLOUD_PROVIDERS = [
  { id: "gemini", name: "Google Gemini" },
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "groq", name: "Groq" },
  { id: "mistral", name: "Mistral AI" },
  { id: "together", name: "Meta Llama" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "cohere", name: "Cohere" },
  { id: "perplexity", name: "Perplexity" },
];

const ROUTING_MODES = [
  { id: "auto", name: "Tự động" },
  { id: "local_only", name: "Ưu tiên AI Local" },
  { id: "cloud_only", name: "Chỉ dùng Cloud API" },
];

const WEBHOOK_PROVIDERS_META: Record<
  string,
  { label: string; badge: string; placeholderUrl: string; description: string }
> = {
  SLACK: {
    label: "Slack Incoming Webhook",
    badge: "Slack",
    placeholderUrl: "https://hooks.slack.com/services/<WORKSPACE>/<CHANNEL>/<TOKEN>",
    description: "Gửi thẻ Block Kit & Attachments kèm dải màu trạng thái vào kênh Slack của nhóm.",
  },
  DISCORD: {
    label: "Discord Webhook",
    badge: "Discord",
    placeholderUrl: "https://discord.com/api/webhooks/123456789012345678/xxxxxxxxxxxxxxxxxxxxxxxx",
    description: "Gửi Embeds định dạng đẹp với mã màu thập phân trực tiếp vào kênh Discord.",
  },
  CUSTOM_WEBHOOK: {
    label: "Custom Webhook",
    badge: "JSON / HMAC",
    placeholderUrl: "https://hooks.your-domain.com/livingdocs/events",
    description: "Đẩy payload JSON chuẩn { event, timestamp, data } kèm chữ ký HMAC-SHA256 (tùy chọn).",
  },
};

const WEBHOOK_EVENT_OPTIONS = [
  { key: "DRIFT_HIGH_CRITICAL", label: "Cảnh báo sai lệch mức HIGH / CRITICAL" },
  { key: "REVIEW_SUBMITTED", label: "Developer gửi tài liệu cho Staff duyệt" },
  { key: "DOCUMENT_PUBLISHED", label: "Manager phê duyệt xuất bản (PUBLISHED)" },
];

export default function CaiDatPage() {
  const { roles } = useSession();
  const canManageIntegrations =
    roles.includes("ADMIN") || roles.includes("TECH_LEAD") || roles.includes("MANAGER");
  const canManageCiTokens =
    roles.includes("ADMIN") || roles.includes("TECH_LEAD") || roles.includes("DEVELOPER");

  const [activeTab, setActiveTab] = useState<
    "cloud" | "local" | "pr_blocking" | "notifications" | "integrations" | "ci_tokens"
  >("cloud");

  // State cấu hình AI
  const [cloudProvider, setCloudProvider] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [localAiUrl, setLocalAiUrl] = useState<string>("http://127.0.0.1:11434");
  const [localModel, setLocalModel] = useState<string>("qwen2.5-coder:7b");
  const [availableModels, setAvailableModels] = useState<string[]>(["qwen2.5-coder:7b"]);
  const [routingMode, setRoutingMode] = useState<string>("auto");

  // State cấu hình Chặn Hợp nhất Pull Request (Task tuần 6 - Issue #208)
  const [prBlockingEnabled, setPrBlockingEnabled] = useState<boolean>(true);
  const [prBlockingMode, setPrBlockingMode] = useState<"STRICT" | "WARN_ONLY">("STRICT");
  const [prMinSeverity, setPrMinSeverity] = useState<"CRITICAL" | "HIGH">("CRITICAL");
  const [prCheckName, setPrCheckName] = useState<string>("LivingDocs / Doc Drift Guard");
  const [prAutoUnlock, setPrAutoUnlock] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [scanningModels, setScanningModels] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // State Tùy chọn thông báo người dùng (GET/PUT /api/me/notification-preferences)
  const [notifEmail, setNotifEmail] = useState<boolean>(true);
  const [notifReview, setNotifReview] = useState<boolean>(true);
  const [notifDriftAlert, setNotifDriftAlert] = useState<boolean>(true);
  const [notifGithubToken, setNotifGithubToken] = useState<boolean>(true);
  const [notifSaving, setNotifSaving] = useState<boolean>(false);
  const [notifSavedMsg, setNotifSavedMsg] = useState<string | null>(null);
  const [notifErrorMsg, setNotifErrorMsg] = useState<string | null>(null);

  // State Tích hợp ngoài (Slack, Discord, Custom Webhook)
  const [integrations, setIntegrations] = useState<ExternalIntegrationConfig[]>([]);
  const [integrationSavingProvider, setIntegrationSavingProvider] = useState<string | null>(null);
  const [integrationTestingProvider, setIntegrationTestingProvider] = useState<string | null>(null);
  const [integrationFeedback, setIntegrationFeedback] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({});

  // State CI/CD Tokens & GitHub Actions Generator
  const [ciTokens, setCiTokens] = useState<CiTokenItem[]>([]);
  const [ciRepos, setCiRepos] = useState<RepoItem[]>([]);
  const [ciLoading, setCiLoading] = useState<boolean>(false);
  const [ciError, setCiError] = useState<string | null>(null);
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState<boolean>(false);
  const [newTokenName, setNewTokenName] = useState<string>("");
  const [newTokenRepoId, setNewTokenRepoId] = useState<string>("");
  const [newTokenExpiryDays, setNewTokenExpiryDays] = useState<string>("90");
  const [newTokenDesc, setNewTokenDesc] = useState<string>("");
  const [creatingToken, setCreatingToken] = useState<boolean>(false);
  const [createTokenError, setCreateTokenError] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<CreatedCiTokenItem | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [revokingTokenId, setRevokingTokenId] = useState<number | null>(null);
  const [yamlRepoId, setYamlRepoId] = useState<string>("");
  const [yamlBackendUrl, setYamlBackendUrl] = useState<string>("http://localhost:8080");
  const [copiedYaml, setCopiedYaml] = useState<boolean>(false);

  // Đọc ?tab= từ URL khi mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (
      tabParam === "notifications" ||
      tabParam === "integrations" ||
      tabParam === "cloud" ||
      tabParam === "local" ||
      tabParam === "pr_blocking" ||
      tabParam === "ci_tokens"
    ) {
      setActiveTab(tabParam);
    }
  }, []);

  // Nạp cấu hình hiện tại từ Backend Database
  useEffect(() => {
    Promise.all([
      apiClient
        .get<{
          cloudProvider?: string;
          apiKey?: string;
          localAiUrl?: string;
          localModel?: string;
          routingMode?: string;
        }>("/api/v1/settings/ai")
        .then((res) => {
          if (res.data) {
            if (res.data.cloudProvider) setCloudProvider(res.data.cloudProvider);
            if (res.data.apiKey) setApiKey(res.data.apiKey);
            if (res.data.localAiUrl) setLocalAiUrl(res.data.localAiUrl);
            if (res.data.localModel) setLocalModel(res.data.localModel);
            if (res.data.routingMode) setRoutingMode(res.data.routingMode);
          }
        })
        .catch((err) => {
          console.warn("Không thể tải cấu hình AI, sử dụng mặc định:", err);
        }),
      apiClient
        .get<{
          enabled?: boolean;
          blockingMode?: "STRICT" | "WARN_ONLY";
          minSeverity?: "CRITICAL" | "HIGH";
          checkName?: string;
          autoUnlockOnApproval?: boolean;
        }>("/api/v1/settings/pr-blocking")
        .then((res) => {
          if (res.data) {
            if (typeof res.data.enabled === "boolean") setPrBlockingEnabled(res.data.enabled);
            if (res.data.blockingMode) setPrBlockingMode(res.data.blockingMode);
            if (res.data.minSeverity) setPrMinSeverity(res.data.minSeverity);
            if (res.data.checkName) setPrCheckName(res.data.checkName);
            if (typeof res.data.autoUnlockOnApproval === "boolean") setPrAutoUnlock(res.data.autoUnlockOnApproval);
          }
        })
        .catch((err) => {
          console.warn("Không thể tải cấu hình PR blocking, dùng mặc định:", err);
        }),
      externalIntegrationService
        .getNotificationPreferences()
        .then((prefs) => {
          if (prefs) {
            setNotifEmail(prefs.emailEnabled ?? true);
            setNotifReview(prefs.reviewEnabled ?? true);
            setNotifDriftAlert(prefs.driftAlertEnabled ?? prefs.documentEnabled ?? true);
            setNotifGithubToken(prefs.githubTokenIssueEnabled ?? prefs.githubEnabled ?? true);
          }
        })
        .catch((err) => {
          console.warn("Không thể tải tùy chọn thông báo:", err);
        }),
      externalIntegrationService
        .listIntegrations()
        .then((items) => {
          if (Array.isArray(items) && items.length > 0) {
            setIntegrations(items);
          }
        })
        .catch((err) => {
          console.warn("Không thể tải danh sách tích hợp ngoài:", err);
        }),
    ]).finally(() => setLoading(false));
  }, []);

  const loadCiTokensData = async () => {
    setCiLoading(true);
    setCiError(null);
    try {
      const [tokens, reposList] = await Promise.all([
        ciTokenService.getAllTokens(),
        repoService.getRepositories().catch(() => [] as RepoItem[]),
      ]);
      setCiTokens(tokens);
      setCiRepos(reposList);
      if (reposList.length > 0 && !yamlRepoId) {
        setYamlRepoId(String(reposList[0].repositoryId));
      }
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (anyErr?.response?.status === 403) {
        setCiError("Chỉ ADMIN, TECH_LEAD hoặc DEVELOPER mới có quyền quản lý CI/CD Tokens.");
      } else {
        setCiError(anyErr?.response?.data?.message || "Không thể tải danh sách CI/CD Tokens.");
      }
    } finally {
      setCiLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "ci_tokens") {
      loadCiTokensData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleCreateCiToken(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenName.trim()) {
      setCreateTokenError("Vui lòng nhập tên CI Token.");
      return;
    }
    setCreatingToken(true);
    setCreateTokenError(null);
    try {
      const created = await ciTokenService.createToken({
        tokenName: newTokenName.trim(),
        repositoryId: newTokenRepoId ? Number(newTokenRepoId) : null,
        expiresInDays: newTokenExpiryDays ? Number(newTokenExpiryDays) : null,
        description: newTokenDesc.trim() || undefined,
      });
      setIsCreateTokenOpen(false);
      setNewTokenName("");
      setNewTokenRepoId("");
      setNewTokenExpiryDays("90");
      setNewTokenDesc("");
      setRevealedToken(created);
      setCopiedToken(false);
      await loadCiTokensData();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setCreateTokenError(anyErr?.response?.data?.message || "Không thể tạo CI Token mới.");
    } finally {
      setCreatingToken(false);
    }
  }

  async function handleRevokeCiToken(tokenId: number) {
    setRevokingTokenId(tokenId);
    setCiError(null);
    try {
      await ciTokenService.revokeToken(tokenId);
      await loadCiTokensData();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setCiError(anyErr?.response?.data?.message || "Không thể thu hồi CI Token.");
    } finally {
      setRevokingTokenId(null);
    }
  }

  function copyToClipboard(text: string, onDone: () => void) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(onDone).catch(() => {});
    }
  }

  function formatCiDate(value?: string | null, fallback = "—") {
    if (!value) return fallback;
    try {
      return new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  }

  const selectedYamlRepo = ciRepos.find((r) => String(r.repositoryId) === yamlRepoId);
  const resolvedYamlRepoId = selectedYamlRepo ? selectedYamlRepo.repositoryId : 1;
  const resolvedYamlRepoName = selectedYamlRepo ? selectedYamlRepo.repoFullName : "your-org/your-repo";
  const resolvedYamlBranch = selectedYamlRepo?.defaultBranch || "main";
  const cleanBackendUrl = (yamlBackendUrl || "http://localhost:8080").replace(/\/+$/, "");

  const githubActionsYaml = `name: LivingDocs Drift Check (${resolvedYamlRepoName})

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: ["${resolvedYamlBranch}"]
  push:
    branches: ["${resolvedYamlBranch}"]

jobs:
  livingdocs-drift-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout source code
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Collect changed source files
        id: changed
        run: |
          FILES=$(git diff --name-only HEAD~1 HEAD | tr '\\n' ',' | sed 's/,$//')
          echo "files=$FILES" >> $GITHUB_OUTPUT

      - name: Report Drift Scan to LivingDocs
        env:
          LIVINGDOCS_CI_TOKEN: \${{ secrets.LIVINGDOCS_CI_TOKEN }}
          LIVINGDOCS_API_URL: ${cleanBackendUrl}
        run: |
          FIRST_FILE=$(echo "\${{ steps.changed.outputs.files }}" | cut -d',' -f1)
          if [ -z "$FIRST_FILE" ]; then FIRST_FILE="README.md"; fi
          curl -fsSL -X POST "$LIVINGDOCS_API_URL/api/ci/drift-scan" \\
            -H "Content-Type: application/json" \\
            -H "X-CI-Token: $LIVINGDOCS_CI_TOKEN" \\
            -d "{
              \\"repoId\\": ${resolvedYamlRepoId},
              \\"prNumber\\": \${{ github.event.pull_request.number || 0 }},
              \\"commitHash\\": \\"\${{ github.sha }}\\",
              \\"branch\\": \\"\${{ github.head_ref || github.ref_name }}\\",
              \\"alerts\\": [
                {
                  \\"filePath\\": \\"$FIRST_FILE\\",
                  \\"severity\\": \\"MEDIUM\\",
                  \\"changeType\\": \\"CI_DIFF_DETECTED\\",
                  \\"diffSnippet\\": \\"Changed files: \${{ steps.changed.outputs.files }}\\"
                }
              ]
            }"
`;

  // Quét danh sách model AI Local trong máy qua API Backend
  async function handleScanModels() {
    setScanningModels(true);
    setScanMessage(null);
    const startTime = Date.now();
    try {
      const res = await apiClient.get<{
        status: string;
        connected: boolean;
        models: string[];
        count: number;
        message?: string;
      }>(`/api/v1/settings/ai/scan-local-models?url=${encodeURIComponent(localAiUrl || "http://127.0.0.1:11434")}`);

      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
      }

      if (res.data.connected && res.data.models && res.data.models.length > 0) {
        setAvailableModels(res.data.models);
        if (!res.data.models.includes(localModel)) {
          setLocalModel(res.data.models[0]);
        }
        setScanMessage({
          type: "success",
          text: `Đã tìm thấy ${res.data.models.length} model trong máy tính.`,
        });
      } else if (res.data.connected) {
        setScanMessage({
          type: "error",
          text: "AI Local đang chạy nhưng máy chưa tải model nào. Hãy tải model bằng lệnh: ollama pull qwen2.5-coder:7b",
        });
      } else {
        setScanMessage({
          type: "error",
          text: res.data.message || "Không thể kết nối đến AI Local. Hãy mở ứng dụng Ollama trên máy tính.",
        });
      }
    } catch {
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
      }
      setScanMessage({
        type: "error",
        text: "Không thể kết nối quét model. Hãy chắc chắn ứng dụng AI Local đã được bật.",
      });
    } finally {
      setScanningModels(false);
    }
  }

  // Lưu cài đặt vào Backend Database
  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    setSaveError(null);

    try {
      if (activeTab === "pr_blocking") {
        await apiClient.post("/api/v1/settings/pr-blocking", {
          enabled: prBlockingEnabled,
          blockingMode: prBlockingMode,
          minSeverity: prMinSeverity,
          checkName: prCheckName.trim() || "LivingDocs / Doc Drift Guard",
          autoUnlockOnApproval: prAutoUnlock,
        });
      } else {
        await apiClient.post("/api/v1/settings/ai", {
          cloudProvider,
          apiKey: apiKey.trim(),
          localAiUrl: localAiUrl.trim() || "http://127.0.0.1:11434",
          localModel: localModel.trim() || "qwen2.5-coder:7b",
          routingMode,
        });
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: unknown) {
      console.error("Lỗi lưu cấu hình:", err);
      const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (anyErr?.response?.status === 401) {
        setSaveError("Backend chưa nạp API mới (401 Unauthorized). Vui lòng nhấn Restart backend Java trên VS Code!");
      } else {
        setSaveError(anyErr?.response?.data?.message || "Không thể lưu cài đặt vào hệ thống. Vui lòng kiểm tra lại kết nối Backend.");
      }
    } finally {
      setSaving(false);
    }
  }

  // Lưu tùy chọn nhận thông báo cá nhân (PUT /api/me/notification-preferences)
  async function handleSaveNotificationPreferences() {
    setNotifSaving(true);
    setNotifSavedMsg(null);
    setNotifErrorMsg(null);
    try {
      const updated = await externalIntegrationService.updateNotificationPreferences({
        emailEnabled: notifEmail,
        reviewEnabled: notifReview,
        driftAlertEnabled: notifDriftAlert,
        githubTokenIssueEnabled: notifGithubToken,
      });
      setNotifEmail(updated.emailEnabled);
      setNotifReview(updated.reviewEnabled);
      setNotifDriftAlert(updated.driftAlertEnabled ?? updated.documentEnabled ?? true);
      setNotifGithubToken(updated.githubTokenIssueEnabled ?? updated.githubEnabled ?? true);
      setNotifSavedMsg("Đã lưu tùy chọn thông báo cá nhân thành công!");
      setTimeout(() => setNotifSavedMsg(null), 4000);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setNotifErrorMsg(anyErr?.response?.data?.message || "Không thể lưu tùy chọn thông báo.");
    } finally {
      setNotifSaving(false);
    }
  }

  function updateIntegrationField(
    provider: string,
    patch: Partial<ExternalIntegrationConfig>
  ) {
    setIntegrations((prev) =>
      prev.map((item) => (item.provider === provider ? { ...item, ...patch } : item))
    );
  }

  function toggleIntegrationEvent(provider: string, eventKey: string) {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.provider !== provider) return item;
        const current = item.events || [];
        const next = current.includes(eventKey)
          ? current.filter((e) => e !== eventKey)
          : [...current, eventKey];
        return { ...item, events: next };
      })
    );
  }

  async function handleSaveIntegration(item: ExternalIntegrationConfig) {
    setIntegrationSavingProvider(item.provider);
    setIntegrationFeedback((prev) => {
      const copy = { ...prev };
      delete copy[item.provider];
      return copy;
    });
    try {
      const saved = await externalIntegrationService.updateIntegration(item.provider, {
        enabled: item.enabled,
        webhookUrl: item.webhookUrl?.trim() || "",
        channelName: item.channelName?.trim() || "",
        secret: item.secret?.trim() || undefined,
        events: item.events,
      });
      setIntegrations((prev) =>
        prev.map((it) => (it.provider === item.provider ? saved : it))
      );
      setIntegrationFeedback((prev) => ({
        ...prev,
        [item.provider]: {
          type: "success",
          text: `Đã lưu cấu hình ${WEBHOOK_PROVIDERS_META[item.provider]?.label || item.provider}.`,
        },
      }));
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
      const msg =
        anyErr?.response?.status === 403
          ? "Bạn cần quyền ADMIN, TECH_LEAD hoặc MANAGER để lưu cấu hình tích hợp ngoài."
          : anyErr?.response?.data?.message || "Lưu cấu hình thất bại.";
      setIntegrationFeedback((prev) => ({
        ...prev,
        [item.provider]: { type: "error", text: msg },
      }));
    } finally {
      setIntegrationSavingProvider(null);
    }
  }

  async function handleTestIntegration(item: ExternalIntegrationConfig) {
    setIntegrationTestingProvider(item.provider);
    setIntegrationFeedback((prev) => {
      const copy = { ...prev };
      delete copy[item.provider];
      return copy;
    });
    try {
      const res: TestExternalIntegrationResponse = await externalIntegrationService.testConnection({
        provider: item.provider,
        webhookUrl: item.webhookUrl?.trim() || "",
        secret: item.secret?.trim() || undefined,
      });
      setIntegrationFeedback((prev) => ({
        ...prev,
        [item.provider]: {
          type: res.success ? "success" : "error",
          text: res.message || (res.success ? `Kết nối thành công (HTTP ${res.statusCode})` : `Lỗi HTTP ${res.statusCode}`),
        },
      }));
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
      const msg =
        anyErr?.response?.status === 403
          ? "Bạn cần quyền ADMIN, TECH_LEAD hoặc MANAGER để kiểm tra kết nối."
          : anyErr?.response?.data?.message || "Không thể gửi yêu cầu kiểm tra kết nối.";
      setIntegrationFeedback((prev) => ({
        ...prev,
        [item.provider]: { type: "error", text: msg },
      }));
    } finally {
      setIntegrationTestingProvider(null);
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: activeTab === "ci_tokens" ? 980 : 760, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Settings size={22} className="text-emerald-700" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>Cài đặt</h1>
          </div>
        </div>

        {/* Bộ chuyển đổi 3 tiện ích: Cloud AI, Local AI và Chặn PR */}
        <div
          style={{
            display: "inline-flex",
            gap: 6,
            padding: 4,
            background: "#f1f5f9",
            borderRadius: 8,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("cloud")}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              background: activeTab === "cloud" ? "#ffffff" : "transparent",
              color: activeTab === "cloud" ? "#0f766e" : "#64748b",
              fontWeight: activeTab === "cloud" ? 700 : 500,
              fontSize: 13.5,
              boxShadow: activeTab === "cloud" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
            }}
          >
            <Cloud size={16} />
            Cloud AI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("local")}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              background: activeTab === "local" ? "#ffffff" : "transparent",
              color: activeTab === "local" ? "#0f766e" : "#64748b",
              fontWeight: activeTab === "local" ? 700 : 500,
              fontSize: 13.5,
              boxShadow: activeTab === "local" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
            }}
          >
            <Server size={16} />
            Local AI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pr_blocking")}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              background: activeTab === "pr_blocking" ? "#ffffff" : "transparent",
              color: activeTab === "pr_blocking" ? "#0f766e" : "#64748b",
              fontWeight: activeTab === "pr_blocking" ? 700 : 500,
              fontSize: 13.5,
              boxShadow: activeTab === "pr_blocking" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
            }}
          >
            <GitPullRequest size={16} />
            Chặn Hợp nhất PR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              background: activeTab === "notifications" ? "#ffffff" : "transparent",
              color: activeTab === "notifications" ? "#0f766e" : "#64748b",
              fontWeight: activeTab === "notifications" ? 700 : 500,
              fontSize: 13.5,
              boxShadow: activeTab === "notifications" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
            }}
          >
            <Bell size={16} />
            Tùy chọn thông báo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("integrations")}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              background: activeTab === "integrations" ? "#ffffff" : "transparent",
              color: activeTab === "integrations" ? "#0f766e" : "#64748b",
              fontWeight: activeTab === "integrations" ? 700 : 500,
              fontSize: 13.5,
              boxShadow: activeTab === "integrations" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
            }}
          >
            <Webhook size={16} />
            Tích hợp ngoài
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ci_tokens")}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              background: activeTab === "ci_tokens" ? "#ffffff" : "transparent",
              color: activeTab === "ci_tokens" ? "#0f766e" : "#64748b",
              fontWeight: activeTab === "ci_tokens" ? 700 : 500,
              fontSize: 13.5,
              boxShadow: activeTab === "ci_tokens" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
            }}
          >
            <Key size={16} />
            CI/CD Tokens & GitHub Actions
          </button>
        </div>

        {/* Card Container */}
        <div
          className="ld-card"
          style={{
            background: "#ffffff",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13 }}>Đang tải cấu hình...</p>
            </div>
          ) : activeTab === "cloud" ? (
            /* TIỆN ÍCH 1: CLOUD AI */
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Cloud size={18} className="text-emerald-600" />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Cấu hình Cloud AI
                </h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Chọn Nhà cung cấp */}
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Nhà cung cấp AI
                  </label>
                  <select
                    className="ld-select"
                    style={{ width: "100%", height: 40, fontSize: 13 }}
                    value={cloudProvider}
                    onChange={(e) => setCloudProvider(e.target.value)}
                  >
                    {CLOUD_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nhập Key AI */}
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Key AI
                  </label>
                  <input
                    type="password"
                    className="ld-input"
                    style={{ width: "100%", height: 40, fontSize: 13 }}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Nhập API Key tương ứng..."
                  />
                </div>
              </div>

              {/* Nút Lưu cài đặt & Báo trạng thái */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  className="ld-btn ld-btn-primary"
                  style={{
                    height: 42,
                    padding: "0 24px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    background: "#0f766e",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.75 : 1,
                  }}
                >
                  {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? "Đang lưu..." : "Lưu cài đặt"}
                </button>

                {savedSuccess && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#15803d", fontSize: 13, fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Đã lưu cài đặt thành công!</span>
                  </div>
                )}

                {saveError && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                    <AlertCircle size={16} />
                    <span>{saveError}</span>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "local" ? (
            /* TIỆN ÍCH 2: LOCAL AI */
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Server size={18} className="text-emerald-600" />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Cấu hình Local AI
                </h2>
              </div>

              {/* Địa chỉ AI Local & Quét model */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Địa chỉ AI Local
                </label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="text"
                    className="ld-input"
                    style={{ flex: 1, height: 40, fontSize: 13 }}
                    value={localAiUrl}
                    onChange={(e) => setLocalAiUrl(e.target.value)}
                    placeholder="http://127.0.0.1:11434"
                  />
                  <button
                    type="button"
                    onClick={handleScanModels}
                    disabled={scanningModels}
                    className="ld-btn"
                    style={{
                      height: 40,
                      padding: "0 18px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#0f766e",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: scanningModels ? "not-allowed" : "pointer",
                      opacity: scanningModels ? 0.8 : 1,
                      transition: "all 150ms ease",
                    }}
                  >
                    <RefreshCw
                      size={14}
                      className={scanningModels ? "animate-spin" : ""}
                      style={scanningModels ? { animation: "spin 0.8s linear infinite" } : undefined}
                    />
                    {scanningModels ? "Đang quét..." : "Quét model"}
                  </button>
                </div>

                {/* Thông báo quét model */}
                {scanMessage && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: scanMessage.type === "success" ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {scanMessage.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{scanMessage.text}</span>
                  </div>
                )}
              </div>

              {/* Chọn Model trong máy */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Cpu size={14} className="text-emerald-600" />
                  Model AI Local trong máy
                </label>
                <select
                  className="ld-select"
                  style={{ width: "100%", height: 40, fontSize: 13 }}
                  value={localModel}
                  onChange={(e) => setLocalModel(e.target.value)}
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kiểu Router điều phối */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Compass size={14} className="text-emerald-600" />
                  Kiểu Router điều phối
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ROUTING_MODES.map((mode) => {
                    const isSelected = routingMode === mode.id;
                    return (
                      <label
                        key={mode.id}
                        onClick={() => setRoutingMode(mode.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          borderRadius: 7,
                          border: `1.5px solid ${isSelected ? "#0f766e" : "#e2e8f0"}`,
                          background: isSelected ? "#f0fdf4" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 150ms ease",
                        }}
                      >
                        <input
                          type="radio"
                          name="routingMode"
                          checked={isSelected}
                          onChange={() => setRoutingMode(mode.id)}
                          style={{ accentColor: "#0f766e" }}
                        />
                        <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? "#0f766e" : "#334155" }}>
                          {mode.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Nút Lưu cài đặt & Báo trạng thái */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  className="ld-btn ld-btn-primary"
                  style={{
                    height: 42,
                    padding: "0 24px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    background: "#0f766e",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.75 : 1,
                  }}
                >
                  {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? "Đang lưu..." : "Lưu cài đặt"}
                </button>

                {savedSuccess && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#15803d", fontSize: 13, fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Đã lưu cài đặt thành công!</span>
                  </div>
                )}

                {saveError && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                    <AlertCircle size={16} />
                    <span>{saveError}</span>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "pr_blocking" ? (
            /* TIỆN ÍCH 3: CƠ CHẾ CHẶN HỢP NHẤT PULL REQUEST (CHECKS API) */
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={18} className="text-amber-600" />
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Cơ chế Chặn Hợp nhất Pull Request khi tài liệu bị sai lệch nghiêm trọng
                  </h2>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                    Tích hợp với GitHub Checks API để tự động gửi trạng thái kiểm tra thất bại (Đỏ) khi có trôi dạt và chuyển xanh (Success) khi tài liệu được phê duyệt.
                  </p>
                </div>
              </div>

              {/* Bật/Tắt cơ chế chặn */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: prBlockingEnabled ? "#f0fdf4" : "#f8fafc",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                    Kích hoạt kiểm tra tính toàn vẹn tài liệu trên GitHub Pull Requests
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Tự động gửi Check Run (Đỏ/Xanh) đến tab Checks và thanh trạng thái commit trên GitHub.
                  </div>
                </div>
                <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={prBlockingEnabled}
                    onChange={(e) => setPrBlockingEnabled(e.target.checked)}
                    style={{ width: 20, height: 20, accentColor: "#0f766e" }}
                  />
                </label>
              </div>

              {/* Chế độ Chặn: STRICT vs WARN_ONLY */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 8 }}>
                  Chế độ Kiểm soát Hợp nhất (Merge Gate Policy)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div
                    onClick={() => setPrBlockingMode("STRICT")}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 8,
                      border: `1.5px solid ${prBlockingMode === "STRICT" ? "#dc2626" : "#e2e8f0"}`,
                      background: prBlockingMode === "STRICT" ? "#fef2f2" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <input
                        type="radio"
                        name="blockingMode"
                        checked={prBlockingMode === "STRICT"}
                        onChange={() => setPrBlockingMode("STRICT")}
                        style={{ accentColor: "#dc2626" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: prBlockingMode === "STRICT" ? "#b91c1c" : "#1e293b" }}>
                        Chặn cứng (Strict Block)
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: "#64748b", margin: 0, paddingLeft: 22 }}>
                      Gửi trạng thái <strong>Failure</strong> làm đỏ bước kiểm tra trên GitHub, ngăn cản hoàn toàn việc bấm nút Merge khi tài liệu chưa cập nhật.
                    </p>
                  </div>

                  <div
                    onClick={() => setPrBlockingMode("WARN_ONLY")}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 8,
                      border: `1.5px solid ${prBlockingMode === "WARN_ONLY" ? "#d97706" : "#e2e8f0"}`,
                      background: prBlockingMode === "WARN_ONLY" ? "#fffbeb" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <input
                        type="radio"
                        name="blockingMode"
                        checked={prBlockingMode === "WARN_ONLY"}
                        onChange={() => setPrBlockingMode("WARN_ONLY")}
                        style={{ accentColor: "#d97706" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: prBlockingMode === "WARN_ONLY" ? "#b45309" : "#1e293b" }}>
                        Cảnh báo nhắc nhở (Warn Only)
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: "#64748b", margin: 0, paddingLeft: 22 }}>
                      Gửi trạng thái <strong>Neutral</strong> kèm cảnh báo nhắc nhở nhà phát triển cập nhật tài liệu, không khóa nút Merge của GitHub.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ngưỡng sai lệch kích hoạt chặn */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Mức độ sai lệch tài liệu tối thiểu kích hoạt chặn
                </label>
                <select
                  className="ld-select"
                  style={{ width: "100%", height: 40, fontSize: 13 }}
                  value={prMinSeverity}
                  onChange={(e) => setPrMinSeverity(e.target.value as "CRITICAL" | "HIGH")}
                >
                  <option value="CRITICAL">Chỉ áp dụng khi sai lệch Cực kỳ nghiêm trọng (CRITICAL Severity)</option>
                  <option value="HIGH">Áp dụng cho cả sai lệch Cao & Nghiêm trọng (HIGH & CRITICAL Severity)</option>
                </select>
              </div>

              {/* Tên bước kiểm tra (Context Check Name) */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Tên Check Run hiển thị trên GitHub PR
                </label>
                <input
                  type="text"
                  className="ld-input"
                  style={{ width: "100%", height: 40, fontSize: 13 }}
                  value={prCheckName}
                  onChange={(e) => setPrCheckName(e.target.value)}
                  placeholder="LivingDocs / Doc Drift Guard"
                />
              </div>

              {/* Tự động chuyển xanh khi tài liệu được duyệt */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={prAutoUnlock}
                  onChange={(e) => setPrAutoUnlock(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "#0f766e" }}
                />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                    Tự động chuyển Check Run sang màu xanh (Success) khi tài liệu được phê duyệt
                  </span>
                  <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0 0" }}>
                    Khi Manager/Staff phê duyệt bản nháp tài liệu kỹ thuật tương ứng, hệ thống sẽ tự động gửi trạng thái hợp lệ lên GitHub để mở khóa nút Merge ngay lập tức.
                  </p>
                </div>
              </label>

              {/* Nút Lưu cài đặt & Báo trạng thái */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  className="ld-btn ld-btn-primary"
                  style={{
                    height: 42,
                    padding: "0 24px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    background: "#0f766e",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.75 : 1,
                  }}
                >
                  {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? "Đang lưu..." : "Lưu cài đặt"}
                </button>

                {savedSuccess && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#15803d", fontSize: 13, fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Đã lưu cài đặt thành công!</span>
                  </div>
                )}

                {saveError && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                    <AlertCircle size={16} />
                    <span>{saveError}</span>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "notifications" ? (
            /* TIỆN ÍCH 4: TÙY CHỌN THÔNG BÁO CÁ NHÂN (GET/PUT /api/me/notification-preferences) */
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={18} className="text-emerald-600" />
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Tùy chọn thông báo cá nhân
                  </h2>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                    Bật hoặc tắt từng kênh nhận thông báo từ hệ thống LivingDocs cho tài khoản của bạn.
                  </p>
                </div>
              </div>

              {[
                {
                  key: "emailEnabled",
                  title: "Nhận thông báo qua Email",
                  desc: "Gửi tóm tắt thay đổi tài liệu và cảnh báo quan trọng tới địa chỉ email đăng nhập.",
                  checked: notifEmail,
                  onChange: setNotifEmail,
                  icon: <Mail size={16} className="text-emerald-600" />,
                },
                {
                  key: "reviewEnabled",
                  title: "Thông báo Phê duyệt & Review tài liệu",
                  desc: "Thông báo khi Developer gửi duyệt hoặc khi Staff/Manager có quyết định phê duyệt mới.",
                  checked: notifReview,
                  onChange: setNotifReview,
                  icon: <ClipboardCheck size={16} className="text-amber-600" />,
                },
                {
                  key: "driftAlertEnabled",
                  title: "Cảnh báo Sai lệch Tài liệu & Mã nguồn (Drift / Document)",
                  desc: "Nhận cảnh báo khi phân tích AST/AI phát hiện tài liệu bị lệch so với mã nguồn mới.",
                  checked: notifDriftAlert,
                  onChange: setNotifDriftAlert,
                  icon: <FileWarning size={16} className="text-rose-600" />,
                },
                {
                  key: "githubTokenIssueEnabled",
                  title: "Sự cố kết nối & GitHub Token",
                  desc: "Cảnh báo ngay khi GitHub Access Token hết hạn, bị thu hồi hoặc mất quyền đồng bộ.",
                  checked: notifGithubToken,
                  onChange: setNotifGithubToken,
                  icon: <GitBranch size={16} className="text-indigo-600" />,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "14px 16px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: item.checked ? "#f8fafc" : "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ marginTop: 2 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.checked}
                    aria-label={item.title}
                    onClick={() => item.onChange(!item.checked)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 999,
                      border: "none",
                      background: item.checked ? "#0f766e" : "#cbd5e1",
                      position: "relative",
                      cursor: "pointer",
                      flexShrink: 0,
                      transition: "background 150ms ease",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: item.checked ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#ffffff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        transition: "left 150ms ease",
                      }}
                    />
                  </button>
                </div>
              ))}

              <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleSaveNotificationPreferences}
                  disabled={notifSaving}
                  className="ld-btn ld-btn-primary"
                  style={{
                    height: 42,
                    padding: "0 24px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    background: "#0f766e",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: notifSaving ? "not-allowed" : "pointer",
                    opacity: notifSaving ? 0.75 : 1,
                  }}
                >
                  {notifSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  {notifSaving ? "Đang lưu..." : "Lưu tùy chọn thông báo"}
                </button>

                {notifSavedMsg && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#15803d", fontSize: 13, fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>{notifSavedMsg}</span>
                  </div>
                )}

                {notifErrorMsg && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                    <AlertCircle size={16} />
                    <span>{notifErrorMsg}</span>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "integrations" ? (
            /* TIỆN ÍCH 5: TÍCH HỢP NGOÀI (SLACK, DISCORD, CUSTOM WEBHOOK) */
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Webhook size={18} className="text-indigo-600" />
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Tích hợp Webhook Ngoài (Slack / Discord / Custom)
                  </h2>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                    Tự động bắn thông báo định dạng giàu khi có Drift HIGH/CRITICAL, khi gửi Staff duyệt hoặc khi Manager PUBLISHED.
                  </p>
                </div>
              </div>

              {!canManageIntegrations && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    fontSize: 12.5,
                  }}
                >
                  Chế độ chỉ xem: Chỉ <strong>ADMIN</strong>, <strong>TECH_LEAD</strong> hoặc <strong>MANAGER</strong> mới có quyền lưu và kiểm tra kết nối Webhook.
                </div>
              )}

              {integrations.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  Chưa có dữ liệu tích hợp ngoài từ máy chủ.
                </div>
              ) : (
                integrations
                  .filter((it) => ["SLACK", "DISCORD", "CUSTOM_WEBHOOK"].includes(it.provider))
                  .map((item) => {
                    const meta = WEBHOOK_PROVIDERS_META[item.provider] || {
                      label: item.provider,
                      badge: item.provider,
                      placeholderUrl: "https://...",
                      description: "",
                    };
                    const fb = integrationFeedback[item.provider];
                    const isSavingItem = integrationSavingProvider === item.provider;
                    const isTestingItem = integrationTestingProvider === item.provider;

                    return (
                      <div
                        key={item.provider}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          padding: 18,
                          background: item.enabled ? "#f8fafc" : "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{meta.label}</span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: item.enabled ? "#dcfce7" : "#f1f5f9",
                                  color: item.enabled ? "#166534" : "#64748b",
                                }}
                              >
                                {item.enabled ? "Đang bật" : "Đang tắt"}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>{meta.description}</p>
                          </div>

                          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={(e) =>
                                updateIntegrationField(item.provider, { enabled: e.target.checked })
                              }
                              style={{ width: 18, height: 18, accentColor: "#0f766e" }}
                            />
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>Kích hoạt</span>
                          </label>
                        </div>

                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                            Webhook URL
                          </label>
                          <input
                            type="url"
                            className="ld-input"
                            style={{ width: "100%", height: 38, fontSize: 13 }}
                            value={item.webhookUrl || ""}
                            onChange={(e) =>
                              updateIntegrationField(item.provider, { webhookUrl: e.target.value })
                            }
                            placeholder={meta.placeholderUrl}
                          />
                        </div>

                        {item.provider === "CUSTOM_WEBHOOK" && (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                              HMAC Secret (tùy chọn — ký header X-LivingDocs-Signature)
                            </label>
                            <input
                              type="password"
                              className="ld-input"
                              style={{ width: "100%", height: 38, fontSize: 13 }}
                              value={item.secret || ""}
                              onChange={(e) =>
                                updateIntegrationField(item.provider, { secret: e.target.value })
                              }
                              placeholder="Nhập chuỗi bí mật HMAC..."
                            />
                          </div>
                        )}

                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                            Sự kiện đăng ký nhận thông báo
                          </label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                            {WEBHOOK_EVENT_OPTIONS.map((ev) => {
                              const checked = (item.events || []).includes(ev.key);
                              return (
                                <label
                                  key={ev.key}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 12,
                                    color: "#334155",
                                    cursor: "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleIntegrationEvent(item.provider, ev.key)}
                                    style={{ accentColor: "#0f766e" }}
                                  />
                                  <span>{ev.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => handleSaveIntegration(item)}
                            disabled={isSavingItem}
                            className="ld-btn ld-btn-primary"
                            style={{
                              height: 36,
                              padding: "0 16px",
                              fontSize: 12.5,
                              fontWeight: 600,
                              background: "#0f766e",
                              color: "#ffffff",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {isSavingItem ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {isSavingItem ? "Đang lưu..." : "Lưu cấu hình"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTestIntegration(item)}
                            disabled={isTestingItem}
                            className="ld-btn ld-btn-secondary"
                            style={{
                              height: 36,
                              padding: "0 16px",
                              fontSize: 12.5,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {isTestingItem ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                            {isTestingItem ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
                          </button>

                          {fb && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: fb.type === "success" ? "#15803d" : "#dc2626",
                              }}
                            >
                              {fb.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                              <span>{fb.text}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          ) : (
            /* TIỆN ÍCH 6: CI/CD TOKENS & GITHUB ACTIONS GENERATOR */
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Key size={18} className="text-emerald-600" />
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      CI/CD Tokens (lvd_ci_) & GitHub Actions Generator
                    </h2>
                    <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                      Cấp phát token bảo mật để GitHub Actions runner gửi báo cáo quét Drift về hệ thống LivingDocs.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={loadCiTokensData}
                    disabled={ciLoading}
                    className="ld-btn ld-btn-secondary"
                    style={{ height: 36, padding: "0 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={14} className={ciLoading ? "animate-spin" : ""} />
                    Làm mới
                  </button>
                  {canManageCiTokens && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreateTokenError(null);
                        setIsCreateTokenOpen(true);
                      }}
                      className="ld-btn ld-btn-primary"
                      style={{
                        height: 36,
                        padding: "0 16px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: "#0f766e",
                        color: "#ffffff",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Plus size={14} /> Tạo CI Token mới
                    </button>
                  )}
                </div>
              </div>

              {!canManageCiTokens && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    fontSize: 12.5,
                  }}
                >
                  Chỉ tài khoản <strong>ADMIN</strong>, <strong>TECH_LEAD</strong> hoặc <strong>DEVELOPER</strong> mới có quyền tạo và thu hồi CI/CD Tokens.
                </div>
              )}

              {ciError && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontSize: 12.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{ciError}</span>
                </div>
              )}

              {/* Bảng danh sách CI Tokens */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflowX: "auto" }}>
                {ciLoading ? (
                  <div style={{ padding: 28, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    <RefreshCw size={18} className="animate-spin inline mr-2" /> Đang tải danh sách CI/CD Tokens...
                  </div>
                ) : ciTokens.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    <Key size={28} style={{ margin: "0 auto 8px", opacity: 0.35 }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>Chưa có CI/CD Token nào được tạo.</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
                      Bấm <strong>&quot;Tạo CI Token mới&quot;</strong> để sinh chuỗi <code>lvd_ci_...</code> cho pipeline của bạn.
                    </p>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                        <th style={{ padding: "10px 12px", fontWeight: 600 }}>Tên Token</th>
                        <th style={{ padding: "10px 12px", fontWeight: 600 }}>Tiền tố</th>
                        <th style={{ padding: "10px 12px", fontWeight: 600 }}>Repository</th>
                        <th style={{ padding: "10px 12px", fontWeight: 600 }}>Ngày tạo</th>
                        <th style={{ padding: "10px 12px", fontWeight: 600 }}>Hết hạn</th>
                        <th style={{ padding: "10px 12px", fontWeight: 600 }}>Dùng gần nhất</th>
                        <th style={{ padding: "10px 12px", fontWeight: 600 }}>Trạng thái</th>
                        <th style={{ padding: "10px 12px", fontWeight: 600, textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ciTokens.map((tk) => {
                        const isRevoked = Boolean(tk.revoked ?? tk.isRevoked);
                        const isExpired = Boolean(tk.expiresAt && new Date(tk.expiresAt).getTime() < Date.now());
                        const statusLabel = isRevoked ? "Đã thu hồi" : isExpired ? "Hết hạn" : "Hoạt động";
                        const statusBg = isRevoked || isExpired ? "#fef2f2" : "#ecfdf5";
                        const statusColor = isRevoked || isExpired ? "#b91c1c" : "#047857";

                        return (
                          <tr key={tk.tokenId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{tk.tokenName}</div>
                              {tk.description && (
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{tk.description}</div>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <code
                                style={{
                                  background: "#f1f5f9",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontFamily: "monospace",
                                  color: "#0f172a",
                                }}
                              >
                                {tk.tokenPrefix}...
                              </code>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#334155" }}>
                              {tk.repositoryName || (tk.repositoryId ? `Repo #${tk.repositoryId}` : "Tất cả Repositories")}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#475569", whiteSpace: "nowrap" }}>
                              {formatCiDate(tk.createdAt)}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#475569", whiteSpace: "nowrap" }}>
                              {tk.expiresAt ? formatCiDate(tk.expiresAt) : "Không thời hạn"}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#475569", whiteSpace: "nowrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Clock size={12} />
                                {formatCiDate(tk.lastUsedAt, "Chưa sử dụng")}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: statusBg,
                                  color: statusColor,
                                }}
                              >
                                {statusLabel}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              {!isRevoked && canManageCiTokens ? (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeCiToken(tk.tokenId)}
                                  disabled={revokingTokenId === tk.tokenId}
                                  className="ld-btn ld-btn-sm"
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 11.5,
                                    color: "#b91c1c",
                                    border: "1px solid #fecaca",
                                    background: "#fff",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Trash2 size={12} />
                                  {revokingTokenId === tk.tokenId ? "Đang thu hồi..." : "Thu hồi"}
                                </button>
                              ) : (
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Trình sinh GitHub Actions YAML Snippet */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 18,
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Terminal size={17} className="text-emerald-700" />
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                        GitHub Actions YAML Snippet Generator (.github/workflows/livingdocs.yml)
                      </h3>
                      <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                        Chọn kho lưu trữ và dán trực tiếp workflow dưới đây vào repository của bạn.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(githubActionsYaml, () => {
                        setCopiedYaml(true);
                        setTimeout(() => setCopiedYaml(false), 2500);
                      })
                    }
                    className="ld-btn ld-btn-primary ld-btn-sm"
                    style={{
                      background: "#0f766e",
                      color: "#ffffff",
                      padding: "6px 14px",
                      fontSize: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {copiedYaml ? <Check size={14} /> : <Copy size={14} />}
                    {copiedYaml ? "Đã sao chép YAML!" : "Sao chép YAML"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                      Chọn Repository áp dụng
                    </label>
                    <select
                      className="ld-select"
                      style={{ width: "100%", height: 38, fontSize: 13 }}
                      value={yamlRepoId}
                      onChange={(e) => setYamlRepoId(e.target.value)}
                    >
                      {ciRepos.length === 0 ? (
                        <option value="">Mặc định (repoId: 1)</option>
                      ) : (
                        ciRepos.map((repo) => (
                          <option key={repo.repositoryId} value={String(repo.repositoryId)}>
                            {repo.repoFullName} (ID: {repo.repositoryId})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                      LivingDocs Backend URL
                    </label>
                    <input
                      type="url"
                      className="ld-input"
                      style={{ width: "100%", height: 38, fontSize: 13 }}
                      value={yamlBackendUrl}
                      onChange={(e) => setYamlBackendUrl(e.target.value)}
                      placeholder="https://api.livingdocs.your-domain.com"
                    />
                  </div>
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: 14,
                    borderRadius: 8,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: 12,
                    lineHeight: 1.55,
                    overflowX: "auto",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {githubActionsYaml}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL TẠO CI TOKEN MỚI */}
      {isCreateTokenOpen && (
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
          <div className="ld-card" style={{ width: "100%", maxWidth: 480, padding: 24, position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsCreateTokenOpen(false)}
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

            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
              Tạo CI/CD Token mới
            </h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
              Token dùng tiền tố <code>lvd_ci_</code> và chỉ được hiển thị một lần duy nhất sau khi tạo.
            </p>

            {createTokenError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                {createTokenError}
              </div>
            )}

            <form onSubmit={handleCreateCiToken} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Tên Token <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  className="ld-input"
                  placeholder="Ví dụ: GitHub Action Main Pipeline"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Kho lưu trữ liên kết
                </label>
                <select
                  className="ld-select"
                  value={newTokenRepoId}
                  onChange={(e) => setNewTokenRepoId(e.target.value)}
                >
                  <option value="">Tất cả Repositories trong Workspace</option>
                  {ciRepos.map((r) => (
                    <option key={r.repositoryId} value={String(r.repositoryId)}>
                      {r.repoFullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Thời hạn hiệu lực
                </label>
                <select
                  className="ld-select"
                  value={newTokenExpiryDays}
                  onChange={(e) => setNewTokenExpiryDays(e.target.value)}
                >
                  <option value="30">30 ngày</option>
                  <option value="90">90 ngày (Khuyến nghị)</option>
                  <option value="365">365 ngày</option>
                  <option value="">Không thời hạn</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Mô tả mục đích sử dụng
                </label>
                <input
                  className="ld-input"
                  placeholder="Ví dụ: Quét drift tự động khi mở PR trên nhánh main"
                  value={newTokenDesc}
                  onChange={(e) => setNewTokenDesc(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateTokenOpen(false)}
                  className="ld-btn ld-btn-secondary"
                  disabled={creatingToken}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="ld-btn ld-btn-primary"
                  disabled={creatingToken}
                  style={{ background: "#0f766e", color: "#ffffff", gap: 6 }}
                >
                  {creatingToken && <RefreshCw size={13} className="animate-spin" />}
                  {creatingToken ? "Đang tạo..." : "Tạo Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG HIỂN THỊ TOKEN 1 LẦN DUY NHẤT */}
      {revealedToken && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div className="ld-card" style={{ width: "100%", maxWidth: 560, padding: 24, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <ShieldCheck size={22} className="text-emerald-700" />
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                CI Token đã được tạo thành công
              </h3>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 12.5,
                marginBottom: 14,
              }}
            >
              <strong>Lưu ý bảo mật:</strong> Chuỗi token thô dưới đây chỉ hiển thị <strong>MỘT LẦN DUY NHẤT</strong>. Sau khi đóng hộp thoại này, bạn sẽ không thể xem lại giá trị đầy đủ.
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Chuỗi CI Token ({revealedToken.tokenName})
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={revealedToken.token}
                  className="ld-input"
                  style={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: 12.5,
                    background: "#f8fafc",
                    color: "#0f172a",
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(revealedToken.token, () => {
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2500);
                    })
                  }
                  className="ld-btn ld-btn-primary"
                  style={{
                    background: "#0f766e",
                    color: "#ffffff",
                    height: 38,
                    padding: "0 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                  {copiedToken ? "Đã sao chép!" : "Sao chép"}
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 12,
                color: "#334155",
                lineHeight: 1.6,
                marginBottom: 18,
              }}
            >
              <strong>Hướng dẫn cấu hình GitHub Secrets:</strong>
              <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
                <li>Mở Repository trên GitHub → chọn tab <strong>Settings</strong>.</li>
                <li>Chọn <strong>Secrets and variables</strong> → <strong>Actions</strong> → <strong>New repository secret</strong>.</li>
                <li>Đặt Name là <code>LIVINGDOCS_CI_TOKEN</code> và dán chuỗi token vừa sao chép vào ô Secret.</li>
              </ol>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setRevealedToken(null)}
                className="ld-btn ld-btn-primary"
                style={{ background: "#0f766e", color: "#ffffff", padding: "8px 20px" }}
              >
                Tôi đã lưu token, đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
