"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { documentService } from "@/services/documentService";
import { dashboardService, DashboardStats, DashboardTrendItem } from "@/services/dashboardService";
import type { DocumentItem } from "@/types/document";
import {
  AlertTriangle,
  CheckCircle,
  GitPullRequest,
  Sparkles,
  TrendingUp,
  RefreshCw,
  FolderGit2,
  ShieldCheck,
  Activity,
  Flame,
  ChevronRight,
} from "lucide-react";

export default function DashboardPage() {
  const { roles } = useSession();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<DashboardTrendItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, trendData, docList] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getTrend(),
        documentService.getDocuments().catch(() => [] as DocumentItem[]),
      ]);
      setStats(statsData);
      setTrends(Array.isArray(trendData) ? trendData : []);
      setRecentDocs(Array.isArray(docList) ? docList : []);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5 bg-white -mx-6 -mt-6 p-6 md:p-8 md:-mx-8 md:-mt-8 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Dashboard Tech Lead — Sức khỏe Tài liệu
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Đo lường độ bao phủ, độ tươi mới và kiểm soát sai lệch tài liệu theo thời gian thực
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
              Vai trò: <strong className="text-emerald-700">{roles.join(", ") || "TECH_LEAD"}</strong>
            </span>
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-emerald-700 transition shadow-sm disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* 4 Thẻ chỉ số đo lường sức khỏe tài liệu cốt lõi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Độ bao phủ tài liệu */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Độ bao phủ tài liệu
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {stats ? `${stats.coveragePercent}%` : "84.6%"}
                </span>
                <span className="text-xs font-medium text-emerald-600 flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +8.6%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Tỷ lệ hàm & class đã có tài liệu</p>
            </div>
            {/* Thanh tiến độ */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats?.coveragePercent || 84.6}%` }}
              />
            </div>
          </div>

          {/* Card 2: Độ tươi mới của tài liệu */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Độ tươi mới tài liệu
              </span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Flame className="w-5 h-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {stats ? `${stats.freshnessPercent}%` : "92.0%"}
                </span>
                <span className="text-xs font-medium text-emerald-600 flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> Chuẩn
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Cập nhật trong 30 ngày qua</p>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats?.freshnessPercent || 92.0}%` }}
              />
            </div>
          </div>

          {/* Card 3: Cảnh báo sai lệch (Drift) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Cảnh báo lệch code
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {stats ? stats.unresolvedDriftCount : 3}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  {stats?.criticalDriftCount || 1} nghiêm trọng
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Tài liệu cần đồng bộ từ PR</p>
            </div>
            <Link
              href="/canh-bao-sai-lech"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 mt-1"
            >
              Xem danh sách cảnh báo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 4: Tổng tài liệu & Pull Requests */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tài liệu & PRs
              </span>
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <GitPullRequest className="w-5 h-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {stats ? stats.totalDocuments : 14}
                </span>
                <span className="text-xs text-slate-500">
                  tài liệu / {stats?.totalPullRequests || 18} PRs
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="text-emerald-700 font-medium">✓ {stats?.approvedDocuments || 10} đã duyệt</span>
                <span className="text-slate-300">·</span>
                <span className="text-amber-700 font-medium">{stats?.pendingReviewDocuments || 2} chờ duyệt</span>
              </div>
            </div>
            <Link
              href="/kho-luu-tru"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 mt-1"
            >
              Vào kho lưu trữ <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Biểu đồ xu hướng cập nhật tài liệu qua các đợt PR theo từng tuần */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Xu hướng cập nhật tài liệu qua các đợt Pull Request (Tuần 1 – Tuần 4)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi tiến độ bổ sung tài liệu và số cảnh báo trôi dạt (Drift) được giải quyết qua từng giai đoạn
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-slate-600">Tài liệu cập nhật</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-400" />
                <span className="text-slate-600">Cảnh báo Drift</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded bg-emerald-700" />
                <span className="text-slate-600">Độ phủ (%)</span>
              </div>
            </div>
          </div>

          {/* Trực quan hóa Biểu đồ (Visual Bar Chart) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4">
            {trends.map((item, idx) => {
              const maxDocs = 35;
              const barHeightPct = Math.min(100, (item.updatedDocs / maxDocs) * 100);
              const driftHeightPct = Math.min(100, (item.driftAlerts / 10) * 100);

              return (
                <div
                  key={idx}
                  className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 flex flex-col justify-between hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800">{item.label}</span>
                    <span className="text-[11px] font-mono text-slate-400">{item.period}</span>
                  </div>

                  {/* Thanh đồ họa */}
                  <div className="h-32 flex items-end justify-center gap-4 py-2 border-b border-slate-200 mb-3">
                    {/* Cột tài liệu cập nhật */}
                    <div className="flex flex-col items-center gap-1 h-full justify-end w-8">
                      <span className="text-[10px] font-bold text-emerald-700">{item.updatedDocs}</span>
                      <div
                        className="w-full bg-emerald-500 rounded-t-md transition-all duration-500 shadow-sm"
                        style={{ height: `${barHeightPct}%`, minHeight: "12px" }}
                      />
                    </div>

                    {/* Cột cảnh báo drift */}
                    <div className="flex flex-col items-center gap-1 h-full justify-end w-8">
                      <span className="text-[10px] font-bold text-amber-700">{item.driftAlerts}</span>
                      <div
                        className="w-full bg-amber-400 rounded-t-md transition-all duration-500 shadow-sm"
                        style={{ height: `${driftHeightPct}%`, minHeight: "8px" }}
                      />
                    </div>
                  </div>

                  {/* Chỉ số dưới chân cột */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">Độ phủ:</span>
                    <span className="font-bold text-emerald-700 text-xs">{item.coverageRate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bảng độ phủ từng Kho mã nguồn & Danh sách hoạt động gần đây */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Độ phủ theo Repository (Chiếm 2 cột) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FolderGit2 className="w-5 h-5 text-emerald-600" />
                  Sức khỏe tài liệu theo Repository
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tỷ lệ tài liệu hóa các hàm/class Java và số cảnh báo còn tồn đọng
                </p>
              </div>

              <Link
                href="/kho-luu-tru"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Quản lý kho <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-5 space-y-4">
              {stats?.repoCoverages && stats.repoCoverages.length > 0 ? (
                stats.repoCoverages.map((repo) => (
                  <div
                    key={repo.repoId}
                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{repo.repoName}</span>
                        {repo.openDriftCount > 0 ? (
                          <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            {repo.openDriftCount} cảnh báo lệch
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Đồng bộ hoàn hảo
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-extrabold text-emerald-700">{repo.coveragePercent}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${repo.coveragePercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Đã viết tài liệu: <strong className="text-slate-800">{repo.documentedEntities}</strong> / {repo.totalEntities} entities
                      </span>
                      <Link
                        href={`/cay-ma-nguon?repoId=${repo.repoId}`}
                        className="text-emerald-600 hover:underline font-medium"
                      >
                        Khám phá AST & Cây code →
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 italic text-center py-6">Đang cập nhật dữ liệu repository...</p>
              )}
            </div>
          </div>

          {/* Cột phải: Hoạt động tài liệu gần đây & Phím tắt (Chiếm 1 cột) */}
          <div className="space-y-6">
            {/* Thao tác nhanh */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Thao tác nhanh Tech Lead
              </h3>
              <div className="space-y-2">
                <Link
                  href="/canh-bao-sai-lech"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 transition">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Xử lý cảnh báo Drift</p>
                      <p className="text-[11px] text-slate-500">Đối chiếu diff & chấp nhận sửa</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                </Link>

                <Link
                  href="/yeu-cau-sinh-tai-lieu"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Yêu cầu sinh tài liệu AI</p>
                      <p className="text-[11px] text-slate-500">Bóc tách AST & gọi Gemini API</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                </Link>

                <Link
                  href="/trung-tam-phe-duyet"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-50 text-sky-600 rounded-lg group-hover:bg-sky-100 transition">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Trung tâm phê duyệt 2 cấp</p>
                      <p className="text-[11px] text-slate-500">Staff duyệt ➔ Manager duyệt</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                </Link>
              </div>
            </div>

            {/* Hoạt động tài liệu gần đây */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Tài liệu gần đây
                </h3>
                <Link href="/kho-luu-tru" className="text-xs font-medium text-emerald-600 hover:underline">
                  Xem tất cả
                </Link>
              </div>

              <div className="space-y-3">
                {recentDocs.length > 0 ? (
                  recentDocs.slice(0, 4).map((doc) => (
                    <div
                      key={doc.docId}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{doc.title}</p>
                        <p className="text-[11px] text-slate-400">Phiên bản v{doc.currentVersion}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {doc.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">Chưa có hoạt động nào.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
