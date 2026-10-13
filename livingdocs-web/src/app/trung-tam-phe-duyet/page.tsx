"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  CheckCircle,
  XCircle,
  FileText,
  GitBranch,
  User,
  Clock,
  Eye,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

const PENDING = [
  {
    id: 201,
    title: "AuthService API Reference v3.2",
    repo: "livingdocs-backend",
    submittedBy: "dev01@company.com",
    reviewedBy: "staff01@company.com",
    submittedAt: "Hôm nay, 08:00",
    type: "api",
    wordCount: 1240,
    staffNote: "Nội dung rõ ràng, đầy đủ ví dụ. Đề xuất duyệt.",
    aiScore: 87,
  },
  {
    id: 202,
    title: "Notification Service Docs v1.1",
    repo: "notification-svc",
    submittedBy: "dev02@company.com",
    reviewedBy: "staff01@company.com",
    submittedAt: "Hôm nay, 09:30",
    type: "api",
    wordCount: 860,
    staffNote: "Ổn, đã thêm ghi chú về rate limit.",
    aiScore: 72,
  },
  {
    id: 203,
    title: "Database Schema v3 Guide",
    repo: "livingdocs-backend",
    submittedBy: "dev04@company.com",
    reviewedBy: "staff02@company.com",
    submittedAt: "Hôm qua",
    type: "architecture",
    wordCount: 1780,
    staffNote: "",
    aiScore: 79,
  },
];

const TYPE_LABEL: Record<string, string> = {
  api: "API Reference", module: "Module Guide", changelog: "Changelog", architecture: "Architecture", readme: "README",
};

function ApprovalCard({ doc }: { doc: (typeof PENDING)[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [managerNote, setManagerNote] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  const scoreColor =
    doc.aiScore >= 80 ? "#059669" : doc.aiScore >= 60 ? "#b45309" : "#b91c1c";

  if (decision) {
    return (
      <div
        className="ld-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderLeft: `3px solid ${decision === "approved" ? "#059669" : "#b91c1c"}`,
          opacity: 0.7,
        }}
      >
        {decision === "approved" ? (
          <CheckCircle size={16} style={{ color: "#059669" }} />
        ) : (
          <XCircle size={16} style={{ color: "#b91c1c" }} />
        )}
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>{doc.title}</p>
          <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
            {decision === "approved" ? "Đã phê duyệt" : "Đã từ chối"} — bạn vừa quyết định
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            background: "#ecfdf5",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <FileText size={15} style={{ color: "#047857" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>{doc.title}</p>
            <span className="ld-badge ld-badge-gray">{TYPE_LABEL[doc.type]}</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
              <GitBranch size={11} /> {doc.repo}
            </span>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              <User size={10} style={{ display: "inline" }} /> {doc.submittedBy.split("@")[0]}
            </span>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              <Clock size={10} style={{ display: "inline" }} /> {doc.submittedAt}
            </span>
          </div>
        </div>
        {/* AI score */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: scoreColor, margin: 0 }}>{doc.aiScore}</p>
          <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>AI</p>
        </div>
        <ChevronRight
          size={14}
          style={{
            color: "#475569",
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 150ms",
            flexShrink: 0,
          }}
        />
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: 16 }}>
          {/* Staff note */}
          {doc.staffNote && (
            <div
              style={{
                background: "#ecfdf5",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                padding: "10px 12px",
                marginBottom: 14,
                display: "flex",
                gap: 8,
              }}
            >
              <MessageSquare size={13} style={{ color: "#059669", marginTop: 1, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#059669", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Nhận xét Staff ({doc.reviewedBy.split("@")[0]})
                </p>
                <p style={{ fontSize: 13, color: "#0f172a", margin: 0 }}>{doc.staffNote}</p>
              </div>
            </div>
          )}

          {/* Manager note */}
          <label style={{ fontSize: 12, fontWeight: 500, color: "#475569", display: "block", marginBottom: 6 }}>
            Ghi chú của Manager (tuỳ chọn)
          </label>
          <textarea
            className="ld-input"
            style={{ resize: "vertical", minHeight: 64, marginBottom: 12 }}
            value={managerNote}
            onChange={(e) => setManagerNote(e.target.value)}
            placeholder="Lý do phê duyệt hoặc từ chối…"
          />

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="ld-btn ld-btn-primary"
              style={{ gap: 6, background: "#059669", borderColor: "#059669" }}
              onClick={() => setDecision("approved")}
            >
              <CheckCircle size={14} />
              Phê duyệt & Publish
            </button>
            <button
              type="button"
              className="ld-btn ld-btn-danger"
              onClick={() => setDecision("rejected")}
              style={{ gap: 6 }}
            >
              <XCircle size={14} />
              Từ chối
            </button>
            <a href={`/kho-luu-tru/${doc.id}`} className="ld-btn ld-btn-ghost" style={{ gap: 5, marginLeft: "auto" }}>
              <Eye size={13} />
              Đọc toàn bộ
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrungTamPheDuyetPage() {
  const [docs] = useState(PENDING);

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Trung tâm phê duyệt tài liệu</h1>
          <p className="ld-page-subtitle">
            {docs.length} tài liệu đã qua Staff xem xét, chờ Manager phê duyệt
          </p>
        </div>
        <span className="ld-badge ld-badge-yellow" style={{ fontSize: 13, padding: "4px 10px" }}>
          ⏳ {docs.length} chờ duyệt
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {docs.map((d) => (
          <ApprovalCard key={d.id} doc={d} />
        ))}
      </div>
    </AppShell>
  );
}
