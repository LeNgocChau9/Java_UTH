"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  GitBranch,
  Sparkles,
  Loader2,
  CheckCircle,
  Info,
} from "lucide-react";

const REPOS = [
  "livingdocs-backend",
  "livingdocs-web",
  "api-gateway",
  "payment-service",
  "notification-svc",
  "devops",
];

const DOC_TYPES = [
  { value: "api", label: "API Reference — mô tả endpoint, params, response" },
  { value: "module", label: "Module Guide — hướng dẫn sử dụng module" },
  { value: "readme", label: "README — tổng quan dự án" },
  { value: "architecture", label: "Architecture — thiết kế hệ thống" },
  { value: "changelog", label: "Changelog — ghi nhận thay đổi" },
];

type Step = "idle" | "generating" | "done" | "error";

export default function YeuCauSinhPage() {
  const [repo, setRepo] = useState(REPOS[0]);
  const [branch, setBranch] = useState("main");
  const [docType, setDocType] = useState("api");
  const [scope, setScope] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<Step>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("generating");
    // Simulate AI generation delay
    await new Promise((r) => setTimeout(r, 2200));
    setStep("done");
  }

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Yêu cầu sinh tài liệu</h1>
          <p className="ld-page-subtitle">
            AI sẽ đọc mã nguồn và tạo tài liệu kỹ thuật phù hợp
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: 20,
          alignItems: "start",
        }}
        className="gen-grid"
      >
        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                Thông tin yêu cầu
              </p>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Repo + Branch */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#475569", display: "block", marginBottom: 6 }}>
                    Repository *
                  </label>
                  <select
                    className="ld-select"
                    style={{ width: "100%" }}
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                  >
                    {REPOS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#475569", display: "block", marginBottom: 6 }}>
                    Branch *
                  </label>
                  <div style={{ position: "relative" }}>
                    <GitBranch
                      size={13}
                      style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}
                    />
                    <input
                      className="ld-input"
                      style={{ paddingLeft: 30 }}
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Doc type */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#475569", display: "block", marginBottom: 6 }}>
                  Loại tài liệu *
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {DOC_TYPES.map((dt) => (
                    <label
                      key={dt.value}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: `1px solid ${docType === dt.value ? "#059669" : "#e2e8f0"}`,
                        background: docType === dt.value ? "#ecfdf5" : "transparent",
                        cursor: "pointer",
                        transition: "all 120ms",
                      }}
                    >
                      <input
                        type="radio"
                        name="docType"
                        value={dt.value}
                        checked={docType === dt.value}
                        onChange={() => setDocType(dt.value)}
                        style={{ marginTop: 2, accentColor: "#059669" }}
                      />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: docType === dt.value ? 500 : 400, color: docType === dt.value ? "#047857" : "#0f172a", margin: 0 }}>
                          {dt.label.split(" — ")[0]}
                        </p>
                        <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
                          {dt.label.split(" — ")[1]}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#475569", display: "block", marginBottom: 6 }}>
                  Phạm vi (class, file, package…)
                </label>
                <input
                  className="ld-input"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="vd: com.example.auth.AuthService, src/hooks/"
                />
              </div>

              {/* Note */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#475569", display: "block", marginBottom: 6 }}>
                  Ghi chú thêm cho AI (tuỳ chọn)
                </label>
                <textarea
                  className="ld-input"
                  style={{ resize: "vertical", minHeight: 80 }}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tập trung vào các method public, bỏ qua helper internal…"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="ld-btn ld-btn-primary ld-btn-lg"
                disabled={step === "generating"}
                style={{ alignSelf: "flex-start" }}
              >
                {step === "generating" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Đang sinh tài liệu…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Gửi yêu cầu sinh tài liệu
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Right: status + info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Result */}
          {step === "done" && (
            <div
              className="ld-card"
              style={{
                border: "1px solid #059669",
                background: "#f0fdf4",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} style={{ color: "#059669" }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "#059669", margin: 0 }}>
                  Đã tạo bản nháp!
                </p>
              </div>
              <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
                AI đã sinh tài liệu cho{" "}
                <strong style={{ color: "#0f172a" }}>{repo}</strong>. Bản nháp
                đang chờ Staff xem xét.
              </p>
              <Link href="/tai-lieu-cua-toi" className="ld-btn ld-btn-secondary ld-btn-sm">
                Xem tài liệu của tôi →
              </Link>
            </div>
          )}

          {/* How it works */}
          <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                Quy trình hoạt động
              </p>
            </div>
            <div style={{ padding: "12px 16px" }}>
              {[
                { n: 1, text: "AI đọc mã nguồn từ GitHub branch bạn chỉ định" },
                { n: 2, text: "Sinh bản nháp tài liệu theo loại đã chọn" },
                { n: 3, text: "Staff xem xét và chỉnh sửa" },
                { n: 4, text: "Manager phê duyệt → publish lên kho" },
              ].map((s) => (
                <div
                  key={s.n}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: s.n < 4 ? 12 : 0,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#ecfdf5",
                      color: "#047857",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </div>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                    {s.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div
            className="ld-card"
            style={{
              display: "flex",
              gap: 8,
              background: "#ecfdf5",
              border: "1px solid #e2e8f0",
            }}
          >
            <Info size={14} style={{ color: "#047857", marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.5 }}>
              AI chỉ đọc code của bạn, không lưu trữ bí mật hay credentials.
              Token GitHub được mã hóa trong hệ thống.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 840px) {
          .gen-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </AppShell>
  );
}
