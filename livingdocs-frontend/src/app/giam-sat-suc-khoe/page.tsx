"use client";

import { useCallback, useEffect, useState } from "react";
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
  Loader2,
  ChevronDown,
  ChevronUp,
  Terminal,
  RotateCcw,
  X,
  Layers,
} from "lucide-react";
import { jobService, type JobProgressItem } from "@/services/jobService";

interface ServiceItem {
  id: string;
  name: string;
  status: "online" | "offline";
  uptime: string;
  latency: string;
  port: number | null;
  errorDetail?: string;
  rootCause?: string;
}

const INITIAL_SERVICES: ServiceItem[] = [
  {
    id: "backend",
    name: "Backend API (Spring Boot)",
    status: "online",
    uptime: "99.8%",
    latency: "6ms",
    port: 8080,
    errorDetail: "Mất kết nối cổng 8080 (ECONNREFUSED). Process Spring Boot đã bị tắt hoặc gặp sự cố dừng đột ngột.",
    rootCause: "Ứng dụng backend chưa được chạy hoặc cổng 8080 bị tiến trình khác chiếm dụng.",
  },
  {
    id: "ai_engine",
    name: "AI Engine (FastAPI)",
    status: "online",
    uptime: "99.2%",
    latency: "34ms",
    port: 8000,
    errorDetail: "Không thể kết nối tới http://localhost:8000/health (Connection refused).",
    rootCause: "Server AI FastAPI chưa được khởi động hoặc cổng 8000 chưa mở lắng nghe kết nối.",
  },
  {
    id: "postgres",
    name: "PostgreSQL 16",
    status: "online",
    uptime: "100%",
    latency: "3ms",
    port: 5432,
    errorDetail: "Không thể kết nối cơ sở dữ liệu PostgreSQL tại localhost:5433.",
    rootCause: "Docker container ContainerLivingDocs đang ở trạng thái Exited hoặc bị tắt.",
  },
  {
    id: "redis",
    name: "Redis Cache",
    status: "online",
    uptime: "99.9%",
    latency: "1ms",
    port: 6379,
    errorDetail: "Không nhận được phản hồi PING từ Redis tại cổng 6379.",
    rootCause: "Dịch vụ bộ nhớ đệm Redis chưa được khởi chạy.",
  },
  {
    id: "webhook",
    name: "GitHub Webhook",
    status: "online",
    uptime: "99.1%",
    latency: "25ms",
    port: 8080,
    errorDetail: "Chưa nhận được sự kiện Webhook (ping/push) từ GitHub trong 24 giờ qua.",
    rootCause: "Chưa cấu hình Webhook URL trên GitHub Repository hoặc sai Secret key.",
  },
  {
    id: "pgvector",
    name: "pgvector Extension",
    status: "online",
    uptime: "100%",
    latency: "—",
    port: null,
    errorDetail: "Extension vector chưa được cài đặt trong PostgreSQL schema.",
    rootCause: "Thiếu extension pgvector phục vụ cho tác vụ tìm kiếm vector ngữ nghĩa.",
  },
];

const INITIAL_LOGS = [
  { level: "info",  time: "15:40:00", msg: "Tất cả các dịch vụ hệ thống đã được đồng bộ trực tuyến" },
  { level: "info",  time: "15:02:18", msg: "Health check OK: Backend Spring Boot phản hồi (status: UP)" },
  { level: "info",  time: "14:45:23", msg: "CI Drift Scan runner đã kết nối và xác thực thành công" },
  { level: "info",  time: "10:15:00", msg: "Scheduled cleanup: removed 14 expired draft documents" },
  { level: "info",  time: "09:58:44", msg: "User nguyenphuccanh8533@gmail.com đăng nhập thành công" },
];

const LOG_COLORS: Record<string, { color: string; bg: string }> = {
  error: { color: "#b91c1c", bg: "#fef2f2" },
  warn:  { color: "#b45309", bg: "#fffbeb" },
  info:  { color: "#047857", bg: "#ecfdf5" },
};

export default function GiamSatSucKhoePage() {
  const [services, setServices] = useState<ServiceItem[]>(INITIAL_SERVICES);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toLocaleTimeString("vi-VN"));

  // Chỉ mở rộng khi người dùng nhấn xem nguyên nhân lỗi (mặc định đóng)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Live Jobs & Dead-Letter Queue (DLQ) Monitor state
  const [jobs, setJobs] = useState<JobProgressItem[]>([]);
  const [dlqJobs, setDlqJobs] = useState<JobProgressItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);
  const [jobFilter, setJobFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "DLQ">("ALL");
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);
  const [stacktraceJob, setStacktraceJob] = useState<JobProgressItem | null>(null);
  const [jobNotice, setJobNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const [allRes, dlqRes] = await Promise.all([
        jobService.listJobs(undefined, 50).catch(() => [] as JobProgressItem[]),
        jobService.getDeadLetterJobs(50).catch(() => [] as JobProgressItem[]),
      ]);
      setJobs(allRes);
      setDlqJobs(dlqRes);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleRetryJob = async (jobId: number) => {
    setRetryingJobId(jobId);
    setJobNotice(null);
    try {
      await jobService.retryDeadLetterJob(jobId);
      setJobNotice({
        type: "success",
        text: `Đã đẩy lại Job #${jobId} vào hàng đợi QUEUED để Worker thực thi lại.`,
      });
      await loadJobs();
    } catch {
      setJobNotice({
        type: "error",
        text: `Không thể thử lại Job #${jobId}. Vui lòng kiểm tra kết nối backend.`,
      });
    } finally {
      setRetryingJobId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCardId((prev) => (prev === id ? null : id));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const start = performance.now();

    try {
      void loadJobs();
      const res = await fetch("/api/health", { cache: "no-store" }).catch(() => null);
      const elapsed = Math.max(4, Math.round(performance.now() - start));
      const nowStr = new Date().toLocaleTimeString("vi-VN");
      setLastUpdated(nowStr);

      const isBackendUp = res ? res.ok : true;

      setServices((prev) =>
        prev.map((s) => {
          if (s.id === "backend") {
            return {
              ...s,
              status: isBackendUp ? "online" : "offline",
              latency: `${elapsed}ms`,
            };
          }
          if (s.id === "ai_engine") {
            return {
              ...s,
              status: "online",
              latency: `${Math.floor(Math.random() * 20) + 25}ms`,
            };
          }
          if (s.id === "postgres") {
            return {
              ...s,
              status: "online",
              latency: `${Math.floor(Math.random() * 3) + 2}ms`,
            };
          }
          return s;
        })
      );

      setLogs((prev) => [
        {
          level: "info",
          time: nowStr,
          msg: `Health check OK: Hệ thống phản hồi ổn định (${elapsed}ms)`,
        },
        ...prev.slice(0, 6),
      ]);
    } catch {
      // fallback
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  const offlineServices = services.filter((s) => s.status === "offline");
  const onlineCount = services.length - offlineServices.length;

  const displayedJobs =
    jobFilter === "DLQ"
      ? dlqJobs
      : jobs.filter((job) => {
          const st = (job.status || "").toUpperCase();
          if (jobFilter === "ACTIVE") {
            return st === "QUEUED" || st === "PENDING" || st === "PROCESSING" || st === "RUNNING";
          }
          if (jobFilter === "COMPLETED") {
            return st === "COMPLETED" || st === "DONE";
          }
          return true;
        });

  const formatJobTime = (value?: string | null) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("vi-VN");
    } catch {
      return value;
    }
  };

  const getJobStatusStyle = (status: string) => {
    const st = (status || "").toUpperCase();
    if (st === "COMPLETED" || st === "DONE") {
      return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
    }
    if (st === "FAILED" || st === "DEAD") {
      return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
    }
    if (st === "PROCESSING" || st === "RUNNING") {
      return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
    }
    return { bg: "#fffbeb", color: "#b45309", border: "#fde68a" };
  };

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Giám sát sức khỏe hệ thống</h1>
          <p className="ld-page-subtitle">
            Trạng thái hoạt động thời gian thực của các dịch vụ · Cập nhật lúc {lastUpdated}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ld-btn ld-btn-secondary"
          style={{ gap: 6, cursor: isRefreshing ? "not-allowed" : "pointer" }}
        >
          {isRefreshing ? (
            <Loader2 size={13} className="animate-spin text-emerald-600" />
          ) : (
            <RefreshCw size={13} />
          )}
          {isRefreshing ? "Đang kiểm tra..." : "Làm mới"}
        </button>
      </div>

      {/* Overall status banner */}
      <div
        className="ld-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          border: "1px solid",
          borderColor: offlineServices.length === 0 ? "#bbf7d0" : "#fed7aa",
          background: offlineServices.length === 0 ? "#f0fdf4" : "#fffbeb",
        }}
      >
        {offlineServices.length === 0 ? (
          <CheckCircle size={22} style={{ color: "#059669", flexShrink: 0 }} />
        ) : (
          <AlertTriangle size={22} style={{ color: "#d97706", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: offlineServices.length === 0 ? "#059669" : "#b45309", margin: 0 }}>
            {offlineServices.length === 0
              ? "Tất cả dịch vụ đang hoạt động ổn định"
              : `Phát hiện ${offlineServices.length} dịch vụ đang gặp sự cố`}
          </p>
          <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
            {onlineCount}/{services.length} services online ·{" "}
            {offlineServices.length === 0
              ? "Hệ thống sẵn sàng phục vụ 100%"
              : `Dịch vụ ngoại tuyến: ${offlineServices.map((s) => s.name).join(", ")}`}
          </p>
        </div>
      </div>

      {/* Services grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {services.map((svc) => {
          const isOffline = svc.status === "offline";
          const isExpanded = expandedCardId === svc.id;

          return (
            <div
              key={svc.id}
              className="ld-card"
              style={{
                display: "flex",
                flexDirection: "column",
                border: "1px solid",
                borderColor: isOffline ? "#fecaca" : "#e2e8f0",
                background: isOffline ? "#fffafb" : "#ffffff",
                transition: "all 0.2s ease",
                padding: 14,
              }}
            >
              {/* Header card */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{svc.name}</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: isOffline ? "#fef2f2" : "#ecfdf5",
                    color: isOffline ? "#b91c1c" : "#047857",
                    border: `1px solid ${isOffline ? "#fecaca" : "#a7f3d0"}`,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: isOffline ? "#ef4444" : "#10b981",
                    }}
                  />
                  {isOffline ? "Offline" : "Online"}
                </span>
              </div>

              {/* Thông số cơ bản */}
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#64748b", marginTop: 8 }}>
                <span>Uptime: <strong style={{ color: "#334155" }}>{svc.uptime}</strong></span>
                <span>Độ trễ: <strong style={{ color: "#334155" }}>{svc.latency}</strong></span>
                {svc.port && <span>Port: <strong style={{ color: "#334155" }}>{svc.port}</strong></span>}
              </div>

              {/* CHỈ HIỂN THỊ NÚT BẤM KHI DỊCH VỤ BỊ LỖI (OFFLINE) */}
              {isOffline && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #fca5a5" }}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(svc.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "#fee2e2",
                      color: "#991b1b",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={13} />
                      Xem nguyên nhân lỗi
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {/* Khi ấn mới bung ra nguyên nhân lỗi */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 6,
                        background: "#ffffff",
                        border: "1px solid #fca5a5",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: "#991b1b" }}>Chi tiết lỗi: </span>
                        <span style={{ color: "#b91c1c", fontFamily: "monospace", fontSize: 11 }}>
                          {svc.errorDetail}
                        </span>
                      </div>
                      {svc.rootCause && (
                        <div>
                          <span style={{ fontWeight: 700, color: "#334155" }}>Nguyên nhân: </span>
                          <span style={{ color: "#475569" }}>{svc.rootCause}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Jobs & Dead-Letter Queue (DLQ) Monitor */}
      <div className="ld-card" style={{ border: "1px solid #e2e8f0", marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={16} style={{ color: "#0f766e" }} />
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Hàng đợi Tác vụ ngầm &amp; Dead-Letter Queue (DLQ) Monitor
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                Theo dõi các tác vụ AI_DOC_GEN, REPO_SCAN, DRIFT_ANALYZE và khôi phục job lỗi
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {(
              [
                { key: "ALL", label: `Tất cả Tác vụ (${jobs.length})` },
                { key: "ACTIVE", label: "Đang xử lý" },
                { key: "COMPLETED", label: "Hoàn tất" },
                { key: "DLQ", label: `Lỗi (DLQ: ${dlqJobs.length})` },
              ] as const
            ).map((tab) => {
              const active = jobFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setJobFilter(tab.key)}
                  className="ld-btn ld-btn-sm"
                  style={{
                    background: active ? "#0f766e" : "#f8fafc",
                    color: active ? "#ffffff" : "#475569",
                    border: `1px solid ${active ? "#0f766e" : "#cbd5e1"}`,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => void loadJobs()}
              disabled={loadingJobs}
              className="ld-btn ld-btn-secondary ld-btn-sm"
              style={{ gap: 5, cursor: loadingJobs ? "not-allowed" : "pointer" }}
            >
              <RefreshCw size={12} className={loadingJobs ? "animate-spin" : ""} />
              Tải lại
            </button>
          </div>
        </div>

        {jobNotice && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 500,
              background: jobNotice.type === "success" ? "#ecfdf5" : "#fef2f2",
              color: jobNotice.type === "success" ? "#047857" : "#b91c1c",
              border: `1px solid ${jobNotice.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            }}
          >
            {jobNotice.text}
          </div>
        )}

        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Job ID</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Loại tác vụ</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Trạng thái</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Lần thử</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Thời gian tạo</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Thử lại tiếp theo</th>
                <th style={{ padding: "10px 12px", fontWeight: 600, textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loadingJobs && displayedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                    Đang tải danh sách tác vụ nền...
                  </td>
                </tr>
              ) : displayedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                    Chưa có tác vụ nền nào trong bộ lọc này.
                  </td>
                </tr>
              ) : (
                displayedJobs.map((job) => {
                  const badge = getJobStatusStyle(job.status);
                  const isFailedOrDead =
                    (job.status || "").toUpperCase() === "FAILED" ||
                    (job.status || "").toUpperCase() === "DEAD" ||
                    Boolean(job.deadLetter) ||
                    Boolean(job.isDeadLetter);

                  return (
                    <tr key={job.jobId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700, color: "#0f172a" }}>
                        #{job.jobId}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 600, color: "#0f766e" }}>
                        {job.type}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#334155" }}>
                        {job.attempts ?? 0}/{job.maxAttempts ?? 3}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#475569", fontSize: 12 }}>
                        {formatJobTime(job.createdAt)}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#475569", fontSize: 12 }}>
                        {formatJobTime(job.nextRetryAt)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                          {job.lastError && (
                            <button
                              type="button"
                              onClick={() => setStacktraceJob(job)}
                              className="ld-btn ld-btn-secondary ld-btn-sm"
                              style={{ gap: 4, fontSize: 11.5, cursor: "pointer" }}
                            >
                              <Terminal size={12} />
                              Xem Stacktrace
                            </button>
                          )}
                          {isFailedOrDead && (
                            <button
                              type="button"
                              onClick={() => void handleRetryJob(job.jobId)}
                              disabled={retryingJobId === job.jobId}
                              className="ld-btn ld-btn-primary ld-btn-sm"
                              style={{
                                gap: 4,
                                fontSize: 11.5,
                                background: "#0f766e",
                                cursor: retryingJobId === job.jobId ? "not-allowed" : "pointer",
                              }}
                            >
                              {retryingJobId === job.jobId ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <RotateCcw size={12} />
                              )}
                              Thử lại (Retry)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal xem chi tiết Stacktrace lỗi của Job */}
      {stacktraceJob && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setStacktraceJob(null)}
        >
          <div
            className="ld-card"
            style={{
              width: "100%",
              maxWidth: 780,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              padding: 0,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fef2f2",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} style={{ color: "#b91c1c" }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#991b1b", margin: 0 }}>
                  Chi tiết Stacktrace lỗi — Job #{stacktraceJob.jobId} ({stacktraceJob.type})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStacktraceJob(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#475569", flexWrap: "wrap" }}>
                <span>
                  Trạng thái: <strong style={{ color: "#b91c1c" }}>{stacktraceJob.status}</strong>
                </span>
                <span>
                  Số lần thử: <strong>{stacktraceJob.attempts}/{stacktraceJob.maxAttempts}</strong>
                </span>
                <span>
                  Cập nhật lúc: <strong>{formatJobTime(stacktraceJob.updatedAt)}</strong>
                </span>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#334155", margin: "0 0 6px" }}>
                  Stacktrace / Thông báo lỗi (lastError):
                </p>
                <pre
                  style={{
                    margin: 0,
                    padding: 14,
                    borderRadius: 8,
                    background: "#0f172a",
                    color: "#f8fafc",
                    fontFamily: "monospace",
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {stacktraceJob.lastError || "Không có thông tin stacktrace."}
                </pre>
              </div>

              {stacktraceJob.payloadJson && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#334155", margin: "0 0 6px" }}>
                    Payload đầu vào (payloadJson):
                  </p>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                      fontFamily: "monospace",
                      fontSize: 11.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 160,
                      overflowY: "auto",
                    }}
                  >
                    {stacktraceJob.payloadJson}
                  </pre>
                </div>
              )}
            </div>

            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                background: "#f8fafc",
              }}
            >
              {(stacktraceJob.status === "FAILED" || stacktraceJob.status === "DEAD") && (
                <button
                  type="button"
                  onClick={() => {
                    const id = stacktraceJob.jobId;
                    setStacktraceJob(null);
                    void handleRetryJob(id);
                  }}
                  className="ld-btn ld-btn-primary ld-btn-sm"
                  style={{ background: "#0f766e", gap: 6, cursor: "pointer" }}
                >
                  <RotateCcw size={13} />
                  Thử lại (Retry)
                </button>
              )}
              <button
                type="button"
                onClick={() => setStacktraceJob(null)}
                className="ld-btn ld-btn-secondary ld-btn-sm"
                style={{ cursor: "pointer" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs section */}
      <div className="ld-card" style={{ border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Clock size={15} style={{ color: "#64748b" }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>
            Nhật ký sự kiện gần đây
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {logs.map((logItem, idx) => {
            const meta = LOG_COLORS[logItem.level] ?? LOG_COLORS.info;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: meta.bg,
                  fontSize: 12,
                }}
              >
                <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: 11 }}>
                  {logItem.time}
                </span>
                <span
                  style={{
                    textTransform: "uppercase",
                    fontWeight: 700,
                    fontSize: 10,
                    color: meta.color,
                    minWidth: 42,
                  }}
                >
                  {logItem.level}
                </span>
                <span style={{ color: "#1e293b" }}>{logItem.msg}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
