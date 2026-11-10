"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { documentService } from "@/services/documentService";
import { repoService, RepoItem } from "@/services/repoService";
import { dashboardService, DashboardStats } from "@/services/dashboardService";
import { apiClient } from "@/services/apiClient";
import type { DocumentItem } from "@/types/document";
import {
  FolderGit2,
  FileText,
  AlertTriangle,
  Sparkles,
  GitFork,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldCheck,
  GitPullRequest,
  Code,
  ChevronRight,
  Edit3,
} from "lucide-react";

interface DriftAlertSummary {
  id: number;
  filePath?: string;
  methodName?: string;
  severity?: string;
  status?: string;
  driftType?: string;
  repositoryId?: number;
  reason?: string;
}

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "Chưa cập nhật";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "Vừa xong";
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} ngày trước`;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return isoString;
  }
}

export default function DashboardPage() {
  const { roles } = useSession();

  const [loading, setLoading] = useState(true);
  const [repositories, setRepositories] = useState<RepoItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlertSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tải toàn bộ dữ liệu thực tế từ cơ sở dữ liệu
  const loadRealData = useCallback(async () => {
    setLoading(true);
    try {
      const [reposRes, docsRes, driftRes, statsRes] = await Promise.all([
        repoService.getRepositories().catch(() => [] as RepoItem[]),
        documentService.getDocuments().catch(() => [] as DocumentItem[]),
        apiClient.get<DriftAlertSummary[]>("/api/drift-alerts").then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => [] as DriftAlertSummary[]),
        dashboardService.getStats().catch(() => null),
      ]);

      setRepositories(Array.isArray(reposRes) ? reposRes : []);
      setDocuments(Array.isArray(docsRes) ? docsRes : []);
      setDriftAlerts(Array.isArray(driftRes) ? driftRes : []);
      setStats(statsRes);

      setToastMessage("Đã đồng bộ dữ liệu mới nhất từ CSDL");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Lỗi nạp dữ liệu dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRealData();
  }, [loadRealData]);

  // Phân tích trạng thái tài liệu
  const publishedDocs = documents.filter((d) => d.status === "PUBLISHED" || d.status === "APPROVED");
  const pendingDocs = documents.filter((d) => d.status === "UNDER_REVIEW_STAFF" || d.status === "UNDER_REVIEW_MANAGER");
  const draftDocs = documents.filter((d) => d.status === "DRAFT");

  // Phân tích cảnh báo sai lệch
  const openAlerts = driftAlerts.filter((a) => !a.status || a.status.toUpperCase() === "OPEN");
  const criticalAlerts = openAlerts.filter((a) => a.severity?.toUpperCase() === "CRITICAL");

  // Tổng số hàm & class (AST)
  const totalEntities = stats?.totalClassesAndFunctions ?? 0;
  const documentedEntities = stats?.documentedEntities ?? 0;

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50/60 p-6 md:p-8 space-y-6">
        {/* Toast thông báo */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header tinh giản: chỉ có tiêu đề và nút Làm mới */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Tổng quan
          </h1>

          <button
            onClick={loadRealData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-emerald-700 transition shadow-xs disabled:opacity-60"
            title="Tải lại số liệu thực tế từ cơ sở dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            Làm mới
          </button>
        </div>

        {/* 2. 4 THẺ CHỈ SỐ CỐT LÕI (DỮ LIỆU THẬT) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Kho lưu trữ */}
          <Link
            href="/kho-luu-tru"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Kho lưu trữ
              </span>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {repositories.length}
                </span>
                <span className="text-xs font-medium text-slate-500">kho kết nối</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {repositories.filter((r) => r.isActive).length} kho đang kích hoạt đồng bộ Git
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
              <span>Xem danh sách kho</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* Card 2: Tài liệu kỹ thuật */}
          <Link
            href="/tai-lieu-cua-toi"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tài liệu kỹ thuật
              </span>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {documents.length}
                </span>
                <span className="text-xs font-medium text-slate-500">tài liệu</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <span className="text-emerald-700 font-medium">{publishedDocs.length} đã xuất bản</span>
                <span>•</span>
                <span>{pendingDocs.length} chờ duyệt</span>
                <span>•</span>
                <span>{draftDocs.length} nháp</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
              <span>Mở kho tài liệu</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* Card 3: Class */}
          <Link
            href="/cay-ma-nguon"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Class
              </span>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {totalEntities > 0 ? totalEntities : "—"}
                </span>
                <span className="text-xs font-medium text-slate-500">thực thể code</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {documentedEntities > 0
                  ? `Đã liên kết tài liệu: ${documentedEntities} hàm/class`
                  : "Bóc tách cú pháp tự động từ mã nguồn"}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
              <span>Khám phá cây mã nguồn</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* Card 4: Cảnh báo */}
          <Link
            href="/canh-bao-sai-lech"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-md transition group flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Cảnh báo
              </span>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {openAlerts.length}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  openAlerts.length > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {openAlerts.length > 0 ? `${criticalAlerts.length} nghiêm trọng` : "Đồng bộ 100%"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {openAlerts.length > 0
                  ? "Có thay đổi mã nguồn Git cần cập nhật tài liệu"
                  : "Mọi tài liệu đều khớp với commit mới nhất"}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
              <span>{openAlerts.length > 0 ? "Xử lý cảnh báo ngay" : "Xem trung tâm cảnh báo"}</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>
        </div>

        {/* 3. KHU VỰC DỮ LIỆU CHÍNH: TÀI LIỆU KỸ THUẬT & KHO LƯU TRỮ */}
        <div className="space-y-6">
          {/* Khối 1: Danh sách tài liệu kỹ thuật gần đây */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  Tài liệu kỹ thuật gần đây
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các tài liệu đang hoạt động hoặc vừa được cập nhật trong cơ sở dữ liệu
                </p>
              </div>

              <Link
                href="/tai-lieu-cua-toi"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Xem tất cả ({documents.length}) <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {documents.length > 0 ? (
                documents.slice(0, 8).map((doc) => (
                  <div
                    key={doc.docId}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/tai-lieu-cua-toi/editor?id=${doc.docId}`}
                          className="font-bold text-sm text-slate-900 hover:text-emerald-700 transition truncate"
                        >
                          {doc.title}
                        </Link>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          v{doc.currentVersion}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        {doc.targetPath && (
                          <span className="font-mono text-slate-500">{doc.targetPath}</span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3 h-3" /> {formatRelativeTime(doc.updatedAt || doc.createdAt)}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          doc.status === "PUBLISHED" || doc.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : doc.status === "DRAFT"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {doc.status}
                      </span>

                      <Link
                        href={`/tai-lieu-cua-toi/editor?id=${doc.docId}`}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        title="Mở trình soạn thảo Markdown"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 px-4">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Chưa có tài liệu nào trong CSDL</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Hãy dùng tính năng AI để bóc tách mã nguồn và tự động tạo tài liệu kỹ thuật đầu tiên.
                  </p>
                  <Link
                    href="/yeu-cau-sinh-tai-lieu"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Tạo tài liệu mới bằng AI
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Khối 2: Kho lưu trữ GitHub đang kết nối */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FolderGit2 className="w-5 h-5 text-blue-600" />
                  Kho lưu trữ GitHub đã kết nối
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mã nguồn Git được đồng bộ để phục vụ trích xuất AST và giám sát thay đổi
                </p>
              </div>

              <Link
                href="/kho-luu-tru"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Quản lý kho <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {repositories.length > 0 ? (
                repositories.map((repo) => (
                  <div
                    key={repo.repositoryId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {repo.repoFullName || repo.repoName}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {repo.defaultBranch || "main"}
                        </span>
                        {repo.isActive ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Tạm dừng
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>Đồng bộ gần nhất: <strong>{formatRelativeTime(repo.lastSyncedAt || repo.updatedAt)}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/cay-ma-nguon?repoId=${repo.repositoryId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                      >
                        <GitFork className="w-3.5 h-3.5 text-slate-500" />
                        Cây mã nguồn
                      </Link>
                      <Link
                        href="/kho-luu-tru"
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                      >
                        <GitPullRequest className="w-3.5 h-3.5 text-slate-500" />
                        PR & Commits
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 px-4">
                  <FolderGit2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Chưa có repository nào được kết nối</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Kết nối repository GitHub để bắt đầu đồng bộ mã nguồn và theo dõi tài liệu.
                  </p>
                  <Link
                    href="/kho-luu-tru"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition"
                  >
                    Kết nối GitHub Repository
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
