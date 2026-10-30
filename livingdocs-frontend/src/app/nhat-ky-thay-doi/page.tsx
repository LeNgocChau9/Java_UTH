"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
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
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Edit3,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react";

// Cấu hình hiển thị theo vai trò (Role Configuration)
const ROLE_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; border: string; ring: string; icon: React.ReactNode }
> = {
  DEV: {
    label: "Developer",
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
    ring: "#3b82f6",
    icon: <User size={14} />,
  },
  STAFF: {
    label: "Staff Reviewer",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
    ring: "#f59e0b",
    icon: <Shield size={14} />,
  },
  MANAGER: {
    label: "Manager",
    bg: "#ecfdf5",
    color: "#047857",
    border: "#a7f3d0",
    ring: "#10b981",
    icon: <Award size={14} />,
  },
  AI: {
    label: "AI Engine",
    bg: "#faf5ff",
    color: "#7e22ce",
    border: "#e9d5ff",
    ring: "#a855f7",
    icon: <Bot size={14} />,
  },
};

// Phân loại hành động thay đổi dựa trên nội dung summary
function getActionMeta(summary: string, role: string) {
  const s = summary.toLowerCase();
  if (s.includes("phê duyệt xuất bản") || s.includes("published")) {
    return {
      type: "PUBLISH",
      label: "Xuất bản tài liệu",
      badgeBg: "#ecfdf5",
      badgeColor: "#065f46",
      badgeBorder: "#a7f3d0",
      nodeBg: "#059669",
      icon: <CheckCircle2 size={16} className="text-white" />,
    };
  }
  if (s.includes("phê duyệt") || s.includes("cấp 1") || s.includes("chuyển sang manager")) {
    return {
      type: "STAFF_APPROVE",
      label: "Staff duyệt cấp 1",
      badgeBg: "#f0fdf4",
      badgeColor: "#166534",
      badgeBorder: "#bbf7d0",
      nodeBg: "#10b981",
      icon: <Check size={16} className="text-white" />,
    };
  }
  if (s.includes("từ chối") || s.includes("rejected")) {
    return {
      type: "REJECT",
      label: "Từ chối tài liệu",
      badgeBg: "#fef2f2",
      badgeColor: "#991b1b",
      badgeBorder: "#fecaca",
      nodeBg: "#ef4444",
      icon: <AlertTriangle size={16} className="text-white" />,
    };
  }
  if (s.includes("khởi tạo") || s.includes("tạo mới") || s.includes("genesis")) {
    return {
      type: "CREATE",
      label: "Khởi tạo tài liệu",
      badgeBg: "#eaf6ef",
      badgeColor: "#07543f",
      badgeBorder: "#b8dec5",
      nodeBg: "#087f5b",
      icon: <FileText size={16} className="text-white" />,
    };
  }
  if (s.includes("khôi phục") || s.includes("rollback")) {
    return {
      type: "ROLLBACK",
      label: "Khôi phục phiên bản",
      badgeBg: "#fff7ed",
      badgeColor: "#c2410c",
      badgeBorder: "#fed7aa",
      nodeBg: "#f97316",
      icon: <RotateCcw size={16} className="text-white" />,
    };
  }
  if (s.includes("cập nhật") || s.includes("chỉnh sửa") || s.includes("v2") || s.includes("v3")) {
    return {
      type: "UPDATE",
      label: "Chỉnh sửa nội dung",
      badgeBg: "#eff6ff",
      badgeColor: "#1e40af",
      badgeBorder: "#bfdbfe",
      nodeBg: "#2563eb",
      icon: <Edit3 size={16} className="text-white" />,
    };
  }
  return {
    type: "GENERAL",
    label: role === "AI" ? "AI cập nhật" : "Thay đổi tài liệu",
    badgeBg: "#f8fafc",
    badgeColor: "#334155",
    badgeBorder: "#e2e8f0",
    nodeBg: "#087f5b",
    icon: <Sparkles size={16} className="text-white" />,
  };
}

// Định dạng thời gian tương đối
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "vừa xong";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} ngày trước`;
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} tháng trước`;
}

// Nhóm danh sách theo ngày
function groupChangelogsByDate(items: ChangelogItem[]) {
  const groups: { [key: string]: ChangelogItem[] } = {};
  items.forEach((item) => {
    const d = new Date(item.createdAt);
    const key = d.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });
  return groups;
}

export default function ChangelogTimelinePage() {
  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Bộ lọc
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Phân trang
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Tải danh sách repositories cho dropdown
  useEffect(() => {
    repoService
      .getRepositories()
      .then((data) => setRepos(data || []))
      .catch((err) => console.error("Không thể tải danh sách repositories:", err));
  }, []);

  // Gọi API lấy Changelog
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

  // Lọc nhanh bằng từ khóa tìm kiếm trên client
  const filteredChangelogs = useMemo(() => {
    if (!searchKeyword.trim()) return changelogs;
    const q = searchKeyword.toLowerCase();
    return changelogs.filter((item) => {
      const title = (item.documentTitle || "").toLowerCase();
      const summary = (item.changeSummary || "").toLowerCase();
      const docId = String(item.documentId);
      return title.includes(q) || summary.includes(q) || docId.includes(q);
    });
  }, [changelogs, searchKeyword]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    let devCount = 0;
    let staffCount = 0;
    let managerCount = 0;
    let aiCount = 0;

    changelogs.forEach((item) => {
      const role = (item.actorRole || "").toUpperCase();
      if (role === "DEV") devCount++;
      else if (role === "STAFF") staffCount++;
      else if (role === "MANAGER") managerCount++;
      else if (role === "AI") aiCount++;
    });

    return { devCount, staffCount, managerCount, aiCount, total: totalElements };
  }, [changelogs, totalElements]);

  // Reset bộ lọc
  const handleResetFilters = () => {
    setSelectedRole("ALL");
    setSelectedRepoId("ALL");
    setFromDate("");
    setToDate("");
    setSearchKeyword("");
    setPage(0);
  };

  const isFiltered =
    selectedRole !== "ALL" || selectedRepoId !== "ALL" || Boolean(fromDate) || Boolean(toDate) || Boolean(searchKeyword);

  const groupedTimeline = useMemo(() => {
    return groupChangelogsByDate(filteredChangelogs);
  }, [filteredChangelogs]);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f7faf8] pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
          {/* Header Banner - Emerald Accent */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e4eae6] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#07543f] via-[#087f5b] to-[#10b981]" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#eaf6ef] text-[#07543f] border border-[#b8dec5] mb-3">
                  <History size={13} className="text-[#087f5b]" />
                  <span>DÒNG THỜI GIAN NHẬT KÝ THAY ĐỔI</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17231c] tracking-tight">
                  Nhật Ký Thay Đổi Tài Liệu (Changelog)
                </h1>
                <p className="text-sm text-[#526158] mt-2 max-w-2xl leading-relaxed">
                  Dòng thời gian trực quan ghi nhận chi tiết quá trình khởi tạo, cập nhật, quy trình duyệt 2 cấp (Staff → Manager) và khôi phục tài liệu của toàn bộ nhóm LivingDocs.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start md:self-center">
                <button
                  onClick={() => fetchChangelogs()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#07543f] bg-[#eaf6ef] hover:bg-[#d8efe1] border border-[#b8dec5] rounded-xl transition duration-150 active:scale-95 shadow-xs"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin text-[#087f5b]" : "text-[#087f5b]"} />
                  <span>Làm mới dòng thời gian</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-[#f0f4f1]">
              <div className="bg-[#fcfdfc] p-3.5 rounded-xl border border-[#e4eae6]">
                <div className="text-xs font-medium text-[#738078] flex items-center gap-1.5">
                  <Layers size={13} className="text-[#087f5b]" />
                  Tổng số thay đổi
                </div>
                <div className="text-xl font-bold text-[#17231c] mt-1">{stats.total}</div>
              </div>

              <div className="bg-[#fcfdfc] p-3.5 rounded-xl border border-[#e4eae6]">
                <div className="text-xs font-medium text-[#738078] flex items-center gap-1.5">
                  <User size={13} className="text-blue-600" />
                  Developer (Tạo & Sửa)
                </div>
                <div className="text-xl font-bold text-blue-700 mt-1">{stats.devCount}</div>
              </div>

              <div className="bg-[#fcfdfc] p-3.5 rounded-xl border border-[#e4eae6]">
                <div className="text-xs font-medium text-[#738078] flex items-center gap-1.5">
                  <Shield size={13} className="text-amber-600" />
                  Staff (Duyệt cấp 1)
                </div>
                <div className="text-xl font-bold text-amber-700 mt-1">{stats.staffCount}</div>
              </div>

              <div className="bg-[#fcfdfc] p-3.5 rounded-xl border border-[#e4eae6]">
                <div className="text-xs font-medium text-[#738078] flex items-center gap-1.5">
                  <Award size={13} className="text-emerald-600" />
                  Manager (Duyệt cấp 2)
                </div>
                <div className="text-xl font-bold text-emerald-700 mt-1">{stats.managerCount}</div>
              </div>
            </div>
          </div>

          {/* Filter Card - Modern White with Emerald Focus */}
          <div className="bg-white rounded-2xl p-5 border border-[#e4eae6] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f4f1]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#07543f] uppercase tracking-wider">
                <Filter size={15} className="text-[#087f5b]" />
                <span>BỘ LỌC DÒNG THỜI GIAN</span>
              </div>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline cursor-pointer transition"
                >
                  Xóa tất cả bộ lọc
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Dropdown Vai trò tác giả */}
              <div>
                <label className="block text-xs font-semibold text-[#17231c] mb-1.5">
                  Vai trò tác giả (Actor Role)
                </label>
                <div className="relative">
                  <select
                    value={selectedRole}
                    onChange={(e) => {
                      setSelectedRole(e.target.value);
                      setPage(0);
                    }}
                    className="w-full text-sm border border-[#e4eae6] rounded-xl px-3.5 py-2.5 bg-white text-[#17231c] focus:outline-none focus:ring-2 focus:ring-[#087f5b]/20 focus:border-[#087f5b] transition shadow-2xs"
                  >
                    <option value="ALL">Tất cả vai trò</option>
                    <option value="DEV">Developer (Lập trình viên)</option>
                    <option value="STAFF">Staff Reviewer (Kiểm duyệt viên)</option>
                    <option value="MANAGER">Manager (Quản lý phê duyệt)</option>
                    <option value="AI">AI Engine (Sinh tự động)</option>
                  </select>
                </div>
              </div>

              {/* Dropdown Kho lưu trữ */}
              <div>
                <label className="block text-xs font-semibold text-[#17231c] mb-1.5">
                  Kho lưu trữ (Repository)
                </label>
                <div className="relative">
                  <select
                    value={selectedRepoId}
                    onChange={(e) => {
                      setSelectedRepoId(e.target.value);
                      setPage(0);
                    }}
                    className="w-full text-sm border border-[#e4eae6] rounded-xl px-3.5 py-2.5 bg-white text-[#17231c] focus:outline-none focus:ring-2 focus:ring-[#087f5b]/20 focus:border-[#087f5b] transition shadow-2xs"
                  >
                    <option value="ALL">Tất cả kho lưu trữ</option>
                    {repos.map((r) => (
                      <option key={r.repositoryId} value={r.repositoryId}>
                        {r.repoFullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Từ ngày */}
              <div>
                <label className="block text-xs font-semibold text-[#17231c] mb-1.5">
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
                    className="w-full text-sm border border-[#e4eae6] rounded-xl px-3.5 py-2.5 bg-white text-[#17231c] focus:outline-none focus:ring-2 focus:ring-[#087f5b]/20 focus:border-[#087f5b] transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Đến ngày */}
              <div>
                <label className="block text-xs font-semibold text-[#17231c] mb-1.5">
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
                    className="w-full text-sm border border-[#e4eae6] rounded-xl px-3.5 py-2.5 bg-white text-[#17231c] focus:outline-none focus:ring-2 focus:ring-[#087f5b]/20 focus:border-[#087f5b] transition shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Keyword Search Input */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#738078]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tiêu đề tài liệu, tóm tắt thay đổi hoặc mã Doc ID..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full text-sm border border-[#e4eae6] rounded-xl pl-10 pr-4 py-2.5 bg-white text-[#17231c] focus:outline-none focus:ring-2 focus:ring-[#087f5b]/20 focus:border-[#087f5b] transition shadow-2xs"
                />
              </div>

              <div className="text-xs text-[#526158] whitespace-nowrap">
                Hiển thị <span className="font-bold text-[#07543f]">{filteredChangelogs.length}</span> sự kiện
              </div>
            </div>
          </div>

          {/* Dòng thời gian (Timeline View) */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e4eae6] shadow-sm">
            {loading ? (
              <div className="py-20 text-center">
                <RefreshCw size={28} className="animate-spin text-[#087f5b] mx-auto mb-3" />
                <p className="text-sm font-medium text-[#526158]">Đang tải dữ liệu dòng thời gian changelog...</p>
              </div>
            ) : filteredChangelogs.length === 0 ? (
              <div className="py-16 text-center max-w-md mx-auto">
                <div className="w-14 h-14 bg-[#eaf6ef] text-[#087f5b] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#b8dec5]">
                  <History size={26} />
                </div>
                <h3 className="text-base font-bold text-[#17231c]">Không tìm thấy thay đổi nào</h3>
                <p className="text-sm text-[#738078] mt-1.5 leading-relaxed">
                  Không có bản ghi changelog nào khớp với bộ lọc vai trò, repo hoặc khoảng thời gian bạn đã chọn.
                </p>
                {isFiltered && (
                  <button
                    onClick={handleResetFilters}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-[#07543f] bg-[#eaf6ef] hover:bg-[#d8efe1] border border-[#b8dec5] rounded-xl transition cursor-pointer"
                  >
                    Đặt lại tất cả bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-10">
                {Object.entries(groupedTimeline).map(([dateLabel, items]) => (
                  <div key={dateLabel} className="space-y-6">
                    {/* Ngày trong dòng thời gian */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#eaf6ef] border border-[#b8dec5] text-xs font-bold text-[#07543f] uppercase tracking-wider">
                        <Calendar size={13} className="text-[#087f5b]" />
                        <span>{dateLabel}</span>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-[#b8dec5] to-transparent" />
                    </div>

                    {/* Danh sách các nút Timeline trong ngày */}
                    <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-[#087f5b] before:via-[#10b981] before:to-[#b8dec5]">
                      {items.map((item) => {
                        const role = ROLE_CONFIG[item.actorRole] || {
                          label: item.actorRole,
                          bg: "#f3f4f6",
                          color: "#374151",
                          border: "#e5e7eb",
                          ring: "#9ca3af",
                          icon: <User size={14} />,
                        };
                        const meta = getActionMeta(item.changeSummary, item.actorRole);
                        const repoName =
                          repos.find((r) => r.repositoryId === item.repoId)?.repoFullName ||
                          (item.repoId ? `Repo #${item.repoId}` : "Java_UTH/livingdocs-core");

                        return (
                          <div key={item.id} className="relative group">
                            {/* Nút Timeline (Node Indicator) */}
                            <div
                              className="absolute -left-6 sm:-left-8 top-4 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm border-2 border-white transition group-hover:scale-110"
                              style={{ backgroundColor: meta.nodeBg }}
                            >
                              {meta.icon}
                            </div>

                            {/* Card nội dung thay đổi */}
                            <div className="bg-white rounded-xl border border-[#e4eae6] hover:border-[#10b981] hover:shadow-md transition-all duration-200 p-4 sm:p-5">
                              {/* Header Card */}
                              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-[#f0f4f1]">
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Badge Vai trò */}
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                                    style={{
                                      backgroundColor: role.bg,
                                      color: role.color,
                                      borderColor: role.border,
                                    }}
                                  >
                                    {role.icon}
                                    {role.label}
                                    {item.actorId && <span className="opacity-70 text-[10px]">#{item.actorId}</span>}
                                  </span>

                                  {/* Badge Hành động */}
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border"
                                    style={{
                                      backgroundColor: meta.badgeBg,
                                      color: meta.badgeColor,
                                      borderColor: meta.badgeBorder,
                                    }}
                                  >
                                    {meta.label}
                                  </span>
                                </div>

                                {/* Thời gian */}
                                <div className="flex items-center gap-1.5 text-xs text-[#738078]">
                                  <Clock size={12} className="text-[#087f5b]" />
                                  <span title={new Date(item.createdAt).toLocaleString("vi-VN")}>
                                    {new Date(item.createdAt).toLocaleTimeString("vi-VN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </span>
                                  <span className="text-[#cbd5e1]">•</span>
                                  <span className="font-medium text-[#07543f]">{getRelativeTime(item.createdAt)}</span>
                                </div>
                              </div>

                              {/* Thông tin tài liệu */}
                              <div className="mt-3.5 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-[#087f5b] shrink-0" />
                                    <Link
                                      href={`/tai-lieu-cua-toi/editor?docId=${item.documentId}`}
                                      className="font-bold text-[#17231c] hover:text-[#087f5b] hover:underline transition text-sm sm:text-base"
                                    >
                                      {item.documentTitle || `Tài liệu #${item.documentId}`}
                                    </Link>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#f2f6f3] text-[#526158] border border-[#e4eae6]">
                                      Doc ID: #{item.documentId}
                                    </span>
                                    {item.versionId && (
                                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#eaf6ef] text-[#07543f] border border-[#b8dec5]">
                                        Phiên bản: v{item.versionId}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Tên Repository */}
                                <div className="flex items-center gap-1.5 text-xs text-[#738078]">
                                  <GitBranch size={13} className="text-[#087f5b]" />
                                  <span>{repoName}</span>
                                </div>

                                {/* Khối mô tả tóm tắt thay đổi (Change Summary Box) */}
                                <div className="mt-3 p-3.5 bg-[#eaf6ef]/40 rounded-xl border-l-3 border-[#087f5b] border-t border-r border-b border-[#e4eae6]/60">
                                  <p className="text-xs sm:text-sm text-[#17231c] leading-relaxed">
                                    {item.changeSummary}
                                  </p>
                                </div>
                              </div>

                              {/* Footer Card - Link xem chi tiết */}
                              <div className="mt-3.5 pt-3 border-t border-[#f0f4f1] flex items-center justify-between text-xs">
                                <span className="text-[11px] text-[#738078] font-mono">Log ID: #{item.id}</span>
                                <Link
                                  href={`/tai-lieu-cua-toi/lich-su?docId=${item.documentId}`}
                                  className="inline-flex items-center gap-1 text-[#087f5b] hover:text-[#066548] font-semibold hover:underline"
                                >
                                  <span>Lịch sử phiên bản & đối chiếu</span>
                                  <ArrowRight size={13} />
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Phân trang (Pagination) */}
            {totalPages > 1 && (
              <div className="mt-10 pt-5 border-t border-[#e4eae6] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#526158]">
                <div>
                  Hiển thị <span className="font-bold text-[#17231c]">{filteredChangelogs.length}</span> /{" "}
                  <span className="font-bold text-[#17231c]">{totalElements}</span> bản ghi (Trang {page + 1}/
                  {totalPages})
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#e4eae6] rounded-lg bg-white hover:bg-[#f7faf8] disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
                  >
                    <ChevronLeft size={14} />
                    <span>Trang trước</span>
                  </button>
                  <span className="px-2 font-semibold text-[#07543f]">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#e4eae6] rounded-lg bg-white hover:bg-[#f7faf8] disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
                  >
                    <span>Trang sau</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

