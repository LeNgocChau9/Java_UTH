"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import type { ChangelogItem, PaginatedResponse } from "@/types/document";
import {
  History,
  Filter,
  Calendar,
  User,
  Shield,
  Award,
  Bot,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  FileText,
  Clock,
} from "lucide-react";

const ROLE_BADGES: Record<
  string,
  { label: string; bg: string; color: string; border: string; icon: React.ReactNode }
> = {
  DEV: {
    label: "Developer",
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
    icon: <User size={13} />,
  },
  STAFF: {
    label: "Staff Reviewer",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
    icon: <Shield size={13} />,
  },
  MANAGER: {
    label: "Manager",
    bg: "#ecfdf5",
    color: "#047857",
    border: "#a7f3d0",
    icon: <Award size={13} />,
  },
  AI: {
    label: "AI Bot",
    bg: "#faf5ff",
    color: "#7e22ce",
    border: "#e9d5ff",
    icon: <Bot size={13} />,
  },
};

export default function SystemChangelogPage() {
  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Load Repositories for filter dropdown
  useEffect(() => {
    repoService
      .getRepositories()
      .then((data) => setRepos(data))
      .catch((err) => console.error("Không thể tải danh sách repositories:", err));
  }, []);

  const fetchChangelogs = useCallback(async () => {
    setLoading(true);
    try {
      const res: PaginatedResponse<ChangelogItem> = await documentService.getSystemChangelogs({
        actorRole: selectedRole !== "ALL" ? selectedRole : undefined,
        repoId: selectedRepoId !== "ALL" ? Number(selectedRepoId) : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        size: pageSize,
      });

      setChangelogs(res.content || []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
    } catch (error) {
      console.error("Lỗi khi tải changelogs:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedRole, selectedRepoId, fromDate, toDate, page, pageSize]);

  useEffect(() => {
    fetchChangelogs();
  }, [fetchChangelogs]);

  const handleResetFilters = () => {
    setSelectedRole("ALL");
    setSelectedRepoId("ALL");
    setFromDate("");
    setToDate("");
    setPage(0);
  };

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#eaf6ef] text-[#07543f] rounded-lg">
                <History size={22} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Nhật ký Thay đổi Toàn hệ thống (Changelog)
              </h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Theo dõi lịch sử khởi tạo, chỉnh sửa, phê duyệt và khôi phục tài liệu của AI, Dev, Staff và Manager
            </p>
          </div>

          <button
            onClick={() => fetchChangelogs()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Filter size={14} />
            Bộ lọc nâng cao
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Vai trò tác giả */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Vai trò tác giả (Actor Role)
              </label>
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  setPage(0);
                }}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#07543f]/20 focus:border-[#07543f]"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="AI">AI Bot</option>
                <option value="DEV">Developer</option>
                <option value="STAFF">Staff Reviewer</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>

            {/* Repository */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Kho lưu trữ (Repository)
              </label>
              <select
                value={selectedRepoId}
                onChange={(e) => {
                  setSelectedRepoId(e.target.value);
                  setPage(0);
                }}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#07543f]/20 focus:border-[#07543f]"
              >
                <option value="ALL">Tất cả repositories</option>
                {repos.map((r) => (
                  <option key={r.repositoryId} value={r.repositoryId}>
                    {r.repoFullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Từ ngày */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Từ ngày (From Date)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(0);
                  }}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#07543f]/20 focus:border-[#07543f]"
                />
              </div>
            </div>

            {/* Đến ngày */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Đến ngày (To Date)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(0);
                  }}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#07543f]/20 focus:border-[#07543f]"
                />
              </div>
            </div>
          </div>

          {(selectedRole !== "ALL" || selectedRepoId !== "ALL" || fromDate || toDate) && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleResetFilters}
                className="text-xs text-red-600 hover:text-red-700 font-medium underline cursor-pointer"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          )}
        </div>

        {/* Content Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 text-xs uppercase font-semibold">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Tác giả & Vai trò</th>
                  <th className="py-3 px-4">Tài liệu & Phiên bản</th>
                  <th className="py-3 px-4">Nội dung thay đổi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#07543f]" />
                      Đang tải danh sách nhật ký...
                    </td>
                  </tr>
                ) : changelogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      Không tìm thấy bản ghi changelog nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  changelogs.map((item) => {
                    const badge = ROLE_BADGES[item.actorRole] || {
                      label: item.actorRole,
                      bg: "#f3f4f6",
                      color: "#374151",
                      border: "#e5e7eb",
                      icon: <User size={13} />,
                    };

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/60 transition">
                        {/* ID */}
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">
                          #{item.id}
                        </td>

                        {/* Thời gian */}
                        <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-gray-400" />
                            {new Date(item.createdAt).toLocaleString("vi-VN", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                        </td>

                        {/* Tác giả & Vai trò */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.color,
                              borderColor: badge.border,
                            }}
                          >
                            {badge.icon}
                            {badge.label}
                            {item.actorId && (
                              <span className="text-[10px] opacity-75">
                                (ID: {item.actorId})
                              </span>
                            )}
                          </span>
                        </td>

                        {/* Tài liệu & Version */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 font-medium text-gray-900">
                              <FileText size={14} className="text-gray-400 shrink-0" />
                              <span>{item.documentTitle || `Tài liệu #${item.documentId}`}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                              <span>Doc ID: {item.documentId}</span>
                              {item.versionId && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono">Ver ID: {item.versionId}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Tóm tắt thay đổi */}
                        <td className="py-3 px-4 text-gray-700">
                          <p className="line-clamp-2">{item.changeSummary}</p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 bg-gray-50/50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <div>
              Hiển thị <span className="font-semibold text-gray-800">{changelogs.length}</span> /{" "}
              <span className="font-semibold text-gray-800">{totalElements}</span> bản ghi (Trang{" "}
              {page + 1}/{Math.max(1, totalPages)})
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="p-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Trang trước"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-medium">Trang {page + 1}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                className="p-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Trang sau"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

