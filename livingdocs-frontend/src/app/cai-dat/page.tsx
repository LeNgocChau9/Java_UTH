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
} from "lucide-react";
import { apiClient } from "@/services/apiClient";

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

export default function CaiDatPage() {
  const [activeTab, setActiveTab] = useState<"cloud" | "local" | "pr_blocking">("cloud");

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
    ]).finally(() => setLoading(false));
  }, []);

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

  return (
    <AppShell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Settings size={22} className="text-emerald-700" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>Cài đặt</h1>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Tùy chỉnh Key AI, cấu hình AI Local và chính sách kiểm soát hợp nhất Pull Request.
          </p>
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
            Chặn Hợp nhất PR (Checks API)
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
          ) : (
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
          )}
        </div>
      </div>
    </AppShell>
  );
}
