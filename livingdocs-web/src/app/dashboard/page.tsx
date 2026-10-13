"use client";

import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  GitPullRequest,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// ─── Mock data ───────────────────────────────────────────
const STATS = [
  {
    label: "Tổng tài liệu",
    value: "148",
    delta: "+12 tuần này",
    trend: "up" as const,
    icon: <FileText size={16} />,
  },
  {
    label: "Chờ xem xét",
    value: "23",
    delta: "+5 hôm nay",
    trend: "up" as const,
    icon: <Clock size={16} />,
  },
  {
    label: "Cảnh báo sai lệch",
    value: "7",
    delta: "-3 so với tuần trước",
    trend: "down" as const,
    icon: <AlertTriangle size={16} />,
  },
  {
    label: "Đã phê duyệt",
    value: "94",
    delta: "+18 tháng này",
    trend: "up" as const,
    icon: <CheckCircle size={16} />,
  },
];

const RECENT_ACTIVITY = [
  {
    id: 1,
    type: "pr",
    title: "PR #142 — Refactor AuthService",
    desc: "AI phát hiện 3 tài liệu bị ảnh hưởng",
    time: "2 phút trước",
    status: "warning",
    statusLabel: "Cần cập nhật",
    repo: "livingdocs-backend",
  },
  {
    id: 2,
    type: "approved",
    title: "API Gateway Documentation v2.1",
    desc: "Manager Nguyễn Văn A đã phê duyệt",
    time: "18 phút trước",
    status: "success",
    statusLabel: "Đã duyệt",
    repo: "api-gateway",
  },
  {
    id: 3,
    type: "ai",
    title: "AI sinh tài liệu mới — WebhookHandler",
    desc: "Bản nháp đã sẵn sàng để Staff xem xét",
    time: "1 giờ trước",
    status: "info",
    statusLabel: "Nháp",
    repo: "livingdocs-backend",
  },
  {
    id: 4,
    type: "alert",
    title: "Sai lệch: README.md / payment-service",
    desc: "Code thay đổi nhưng tài liệu chưa cập nhật 14 ngày",
    time: "3 giờ trước",
    status: "danger",
    statusLabel: "Quá hạn",
    repo: "payment-service",
  },
  {
    id: 5,
    type: "approved",
    title: "Module Docs — Notification Service",
    desc: "Đã publish lên kho lưu trữ",
    time: "Hôm qua",
    status: "success",
    statusLabel: "Đã publish",
    repo: "notification-svc",
  },
];

const QUICK_ACTIONS = [
  { label: "Yêu cầu sinh tài liệu", href: "/yeu-cau-sinh-tai-lieu", icon: <Sparkles size={14} />, roles: ["DEVELOPER"] },
  { label: "Xem hàng đợi xem xét", href: "/hang-doi-xem-xet", icon: <Clock size={14} />, roles: ["STAFF"] },
  { label: "Phê duyệt tài liệu", href: "/trung-tam-phe-duyet", icon: <CheckCircle size={14} />, roles: ["MANAGER"] },
  { label: "Kéo PR mới nhất", href: "/canh-bao-sai-lech", icon: <GitPullRequest size={14} />, roles: ["DEVELOPER", "TECH_LEAD"] },
];

// ─── Sub-components ────────────────────────────────────────

function StatCard({
  label,
  value,
  delta,
  trend,
  icon,
}: (typeof STATS)[0]) {
  return (
    <div className="ld-stat">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="ld-stat-label">{label}</span>
        <span className="grid size-9 place-items-center rounded-lg bg-[#eaf6ef] text-[#087f5b]">{icon}</span>
      </div>
      <p className="ld-stat-value">{value}</p>
      <p className={`ld-stat-delta ${trend}`} style={{ display: "flex", alignItems: "center", gap: 4, margin: "8px 0 0" }}>
        {trend === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {delta}
      </p>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  warning: "#b45309",
  success: "#059669",
  info: "#047857",
  danger: "#b91c1c",
};

const STATUS_BG: Record<string, string> = {
  warning: "#fffbeb",
  success: "#ecfdf5",
  info: "#ecfdf5",
  danger: "#fef2f2",
};

function ActivityRow({ item }: { item: (typeof RECENT_ACTIVITY)[0] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: STATUS_COLORS[item.status],
          marginTop: 6,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>
            {item.title}
          </p>
          <span
            className="ld-badge"
            style={{
              background: STATUS_BG[item.status],
              color: STATUS_COLORS[item.status],
            }}
          >
            {item.statusLabel}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
          {item.desc}
        </p>
        <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>
          {item.repo} · {item.time}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { ready, user, roles, signedIn } = useSession();
  const name = user?.fullName || user?.email?.split("@")[0] || "bạn";

  const visibleActions = QUICK_ACTIONS.filter((a) =>
    a.roles.some((r) => roles.includes(r as never))
  );

  return (
    <AppShell>
      {/* Page header */}
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">
            {ready ? `Xin chào, ${name}` : "Đang tải…"}
          </h1>
          <p className="ld-page-subtitle">
            {ready && signedIn
              ? `Vai trò: ${roles.join(", ")} · Hôm nay ${new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}`
              : "Chưa đăng nhập"}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Main content: Activity + Quick actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 16,
          alignItems: "start",
        }}
        className="dashboard-grid"
      >
        {/* Activity feed */}
        <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
              Hoạt động gần đây
            </p>
            <span className="ld-badge ld-badge-blue">{RECENT_ACTIVITY.length} sự kiện</span>
          </div>
          <div style={{ padding: "4px 16px 4px" }}>
            {RECENT_ACTIVITY.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Quick actions */}
          {visibleActions.length > 0 && (
            <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                  Thao tác nhanh
                </p>
              </div>
              <div style={{ padding: 8 }}>
                {visibleActions.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="ld-btn ld-btn-ghost w-full"
                    style={{ justifyContent: "flex-start", gap: 8, fontSize: 13 }}
                  >
                    {a.icon}
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* System health */}
          <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                Trạng thái hệ thống
              </p>
            </div>
            <div style={{ padding: "8px 16px 12px" }}>
              {[
                { name: "Backend API", ok: true },
                { name: "AI Engine", ok: true },
                { name: "PostgreSQL", ok: true },
                { name: "GitHub Webhook", ok: false },
              ].map((svc) => (
                <div
                  key={svc.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <span style={{ fontSize: 13, color: "#475569" }}>{svc.name}</span>
                  <span
                    className="ld-badge"
                    style={
                      svc.ok
                        ? { background: "#ecfdf5", color: "#059669" }
                        : { background: "#fef2f2", color: "#b91c1c" }
                    }
                  >
                    {svc.ok ? "● Online" : "● Offline"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Coverage */}
          <div className="ld-card">
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 12, marginTop: 0 }}>
              Độ phủ tài liệu
            </p>
            {[
              { label: "livingdocs-backend", pct: 78 },
              { label: "api-gateway", pct: 92 },
              { label: "payment-service", pct: 45 },
            ].map((p) => (
              <div key={p.label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#475569" }}>{p.label}</span>
                  <span style={{ fontSize: 12, color: "#0f172a" }}>{p.pct}%</span>
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "#e2e8f0",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${p.pct}%`,
                      background: p.pct >= 70 ? "#059669" : p.pct >= 50 ? "#b45309" : "#b91c1c",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive grid */}
      <style>{`
        @media (max-width: 900px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppShell>
  );
}
