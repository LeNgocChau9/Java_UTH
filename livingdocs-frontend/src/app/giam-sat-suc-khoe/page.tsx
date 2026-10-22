"use client";

import { AppShell } from "@/components/AppShell";
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

const SERVICES = [
  { name: "Backend API (Spring Boot)", status: "online", uptime: "99.8%", latency: "12ms", port: 8080 },
  { name: "AI Engine (FastAPI)", status: "online", uptime: "99.2%", latency: "340ms", port: 8000 },
  { name: "PostgreSQL 16", status: "online", uptime: "100%", latency: "3ms", port: 5432 },
  { name: "Redis Cache", status: "online", uptime: "99.9%", latency: "1ms", port: 6379 },
  { name: "GitHub Webhook", status: "offline", uptime: "94.1%", latency: "—", port: null },
  { name: "pgvector Extension", status: "online", uptime: "100%", latency: "—", port: null },
];

const LOGS = [
  { level: "error", time: "10:45:23", msg: "GitHub webhook delivery failed — connection timeout" },
  { level: "warn",  time: "10:32:11", msg: "AI Engine response time > 500ms for request #8821" },
  { level: "info",  time: "10:15:00", msg: "Scheduled cleanup: removed 14 expired draft documents" },
  { level: "info",  time: "09:58:44", msg: "User staff01@company.com reviewed doc #201" },
  { level: "info",  time: "09:30:00", msg: "Database backup completed successfully (2.3 GB)" },
  { level: "info",  time: "08:00:00", msg: "System startup — all services initialized" },
];

const LOG_COLORS: Record<string, { color: string; bg: string }> = {
  error: { color: "#b91c1c", bg: "#fef2f2" },
  warn:  { color: "#b45309", bg: "#fffbeb" },
  info:  { color: "#047857", bg: "#ecfdf5" },
};

export default function GiamSatSucKhoePage() {
  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Giám sát sức khỏe hệ thống</h1>
          <p className="ld-page-subtitle">Real-time status của tất cả services</p>
        </div>
        <button type="button" className="ld-btn ld-btn-secondary" style={{ gap: 6 }}>
          <RefreshCw size={13} />
          Làm mới
        </button>
      </div>

      {/* Overall status */}
      <div
        className="ld-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          border: "1px solid #e2e8f0",
          background: "#f0fdf4",
        }}
      >
        <CheckCircle size={20} style={{ color: "#059669" }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#059669", margin: 0 }}>
            Hầu hết services đang hoạt động bình thường
          </p>
          <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
            5/6 services online · 1 dịch vụ cần kiểm tra
          </p>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Cập nhật lần cuối</p>
          <p style={{ fontSize: 12, color: "#0f172a", margin: 0 }}>Hôm nay, 10:47:00</p>
        </div>
      </div>

      {/* Resource metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "CPU", value: "34%", icon: <Cpu size={16} />, color: "#059669" },
          { label: "RAM", value: "2.1 / 8 GB", icon: <HardDrive size={16} />, color: "#047857" },
          { label: "Disk", value: "12.4 / 50 GB", icon: <Database size={16} />, color: "#b45309" },
          { label: "Network I/O", value: "1.2 MB/s", icon: <Wifi size={16} />, color: "#7e22ce" },
        ].map((m) => (
          <div key={m.label} className="ld-stat">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="ld-stat-label">{m.label}</span>
              <span style={{ color: m.color }}>{m.icon}</span>
            </div>
            <p className="ld-stat-value" style={{ fontSize: 20, color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Services + Logs side by side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
        className="health-grid"
      >
        {/* Services */}
        <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <Server size={14} style={{ color: "#475569" }} /> Services
            </p>
          </div>
          <div>
            {SERVICES.map((svc, i) => (
              <div
                key={svc.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  borderBottom: i < SERVICES.length - 1 ? "1px solid #e2e8f0" : "none",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: svc.status === "online" ? "#059669" : "#b91c1c",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>{svc.name}</p>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                    {svc.port ? `Port ${svc.port} · ` : ""}Uptime {svc.uptime}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>{svc.latency}</p>
                </div>
                {svc.status === "offline" && (
                  <AlertTriangle size={13} style={{ color: "#b91c1c", flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={14} style={{ color: "#475569" }} /> System Logs
            </p>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {LOGS.map((log, i) => {
              const m = LOG_COLORS[log.level];
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 16px",
                    borderBottom: i < LOGS.length - 1 ? "1px solid #e2e8f0" : "none",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ color: "#64748b", flexShrink: 0 }}>{log.time}</span>
                  <span
                    className="ld-badge"
                    style={{ background: m.bg, color: m.color, flexShrink: 0, padding: "1px 5px", fontSize: 10 }}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span style={{ color: "#475569", lineHeight: 1.5 }}>{log.msg}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .health-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppShell>
  );
}
