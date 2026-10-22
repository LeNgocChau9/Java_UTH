"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { documentService } from "@/services/documentService";
import { repoService, RepoItem } from "@/services/repoService";
import type { DocumentItem } from "@/types/document";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  GitPullRequest,
  Sparkles,
  TrendingUp,
  RefreshCw,
  FolderGit2,
} from "lucide-react";

const QUICK_ACTIONS = [
  { label: "Yêu cầu sinh tài liệu", href: "/yeu-cau-sinh-tai-lieu", icon: <Sparkles size={14} />, roles: ["DEVELOPER"] },
  { label: "Xem hàng đợi xem xét", href: "/hang-doi-xem-xet", icon: <Clock size={14} />, roles: ["STAFF"] },
  { label: "Phê duyệt tài liệu", href: "/trung-tam-phe-duyet", icon: <CheckCircle size={14} />, roles: ["MANAGER"] },
  { label: "Kho lưu trữ GitHub", href: "/kho-luu-tru", icon: <FolderGit2 size={14} />, roles: ["DEVELOPER", "TECH_LEAD"] },
];

// ─── Sub-components ────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  icon: React.ReactNode;
}

function StatCard({
  label,
  value,
  delta,
  trend,
  icon,
}: StatCardProps) {
  return (
    <div className="ld-stat">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="ld-stat-label">{label}</span>
        <span className="grid size-9 place-items-center rounded-lg bg-[#eaf6ef] text-[#087f5b]">{icon}</span>
      </div>
      <p className="ld-stat-value">{value}</p>
      <p className={`ld-stat-delta ${trend}`} style={{ display: "flex", alignItems: "center", gap: 4, margin: "8px 0 0" }}>
        {trend === "up" ? <TrendingUp size={11} /> : <TrendingUp size={11} />}
        {delta}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { ready, user, roles, signedIn } = useSession();
  const name = user?.fullName || user?.email?.split("@")[0] || "bạn";

  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [docList, repoList] = await Promise.all([
          documentService.getDocuments().catch(() => [] as DocumentItem[]),
          repoService.getRepositories().catch(() => [] as RepoItem[]),
        ]);
        setDocs(docList || []);
        setRepos(repoList || []);
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Tính toán số liệu thống kê thực tế từ CSDL
  const totalDocs = docs.length;
  const underReviewDocs = docs.filter(
    (d) => d.status === "UNDER_REVIEW_STAFF" || d.status === "UNDER_REVIEW_MANAGER"
  ).length;
  const approvedDocs = docs.filter(
    (d) => d.status === "APPROVED" || d.status === "PUBLISHED"
  ).length;
  const draftDocs = docs.filter((d) => d.status === "DRAFT").length;

  const realStats = [
    {
      label: "Tổng tài liệu",
      value: String(totalDocs),
      delta: `${docs.length} tài liệu trong CSDL`,
      trend: "up" as const,
      icon: <FileText size={16} />,
    },
    {
      label: "Chờ xem xét",
      value: String(underReviewDocs),
      delta: underReviewDocs > 0 ? "Cần xử lý" : "Hàng đợi trống",
      trend: "up" as const,
      icon: <Clock size={16} />,
    },
    {
      label: "Bản nháp (Draft)",
      value: String(draftDocs),
      delta: `${draftDocs} bản nháp`,
      trend: "up" as const,
      icon: <Sparkles size={16} />,
    },
    {
      label: "Đã phê duyệt",
      value: String(approvedDocs),
      delta: `${approvedDocs} đã duyệt/publish`,
      trend: "up" as const,
      icon: <CheckCircle size={16} />,
    },
  ];

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
        {realStats.map((s) => (
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
              Hoạt động tài liệu gần đây
            </p>
            <span className="ld-badge ld-badge-blue">{docs.length} tài liệu</span>
          </div>
          <div style={{ padding: "8px 16px" }}>
            {docs.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "#64748b" }}>
                <FileText size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                <p style={{ fontSize: 13, margin: 0 }}>Chưa có tài liệu nào trong cơ sở dữ liệu.</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>
                  Hãy vào mục <strong>&quot;Yêu cầu sinh tài liệu&quot;</strong> để tạo tài liệu đầu tiên!
                </p>
              </div>
            ) : (
              docs.slice(0, 5).map((doc) => (
                <div
                  key={doc.docId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                      {doc.title}
                    </p>
                    <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>
                      Repo ID: {doc.repoId} · Phiên bản v{doc.currentVersion}
                    </p>
                  </div>
                  <span
                    className="ld-badge"
                    style={{
                      background: doc.status === "APPROVED" || doc.status === "PUBLISHED" ? "#ecfdf5" : "#fffbeb",
                      color: doc.status === "APPROVED" || doc.status === "PUBLISHED" ? "#047857" : "#b45309",
                    }}
                  >
                    {doc.status}
                  </span>
                </div>
              ))
            )}
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
