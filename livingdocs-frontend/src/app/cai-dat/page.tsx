"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Settings, Save, CheckCircle2, AlertCircle, RefreshCw, Key, Cpu, Server, Compass, Cloud } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"cloud" | "local">("cloud");

  const [cloudProvider, setCloudProvider] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [localAiUrl, setLocalAiUrl] = useState<string>("http://127.0.0.1:11434");
  const [localModel, setLocalModel] = useState<string>("qwen2.5-coder:7b");
  const [availableModels, setAvailableModels] = useState<string[]>(["qwen2.5-coder:7b"]);
  const [routingMode, setRoutingMode] = useState<string>("auto");

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [scanningModels, setScanningModels] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Nạp cấu hình hiện tại từ Backend Database
  useEffect(() => {
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
      })
      .finally(() => setLoading(false));
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

      // Giữ animation quay tối thiểu 800ms để hiệu ứng luôn hiển thị rõ ràng
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
      await apiClient.post("/api/v1/settings/ai", {
        cloudProvider,
        apiKey: apiKey.trim(),
        localAiUrl: localAiUrl.trim() || "http://127.0.0.1:11434",
        localModel: localModel.trim() || "qwen2.5-coder:7b",
        routingMode,
      });
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
            Tùy chỉnh Key AI, nhà cung cấp Cloud và cấu hình AI Local trên máy tính.
          </p>
        </div>

        {/* Bộ chuyển đổi 2 tiện ích riêng biệt: Cloud AI & Local AI */}
        <div
          style={{
            display: "inline-flex",
            gap: 6,
            padding: 4,
            background: "#f1f5f9",
            borderRadius: 8,
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("cloud")}
            style={{
              padding: "8px 22px",
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
              padding: "8px 22px",
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
          ) : (
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
          )}
        </div>
      </div>
    </AppShell>
  );
}
