"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Filter, History, RefreshCw, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getAuditLogs, type AuditLogItem } from "@/services/auditService";

const ACTIONS = [
  { value: "", label: "Mọi hành động" },
  { value: "LOGIN_SUCCESS", label: "Đăng nhập" },
  { value: "GITHUB_LINKED", label: "Liên kết GitHub" },
  { value: "AI_DOCUMENT_GENERATED", label: "Sinh tài liệu AI" },
  { value: "DOCUMENT_STAFF_REVIEWED", label: "Nhân viên duyệt" },
  { value: "DOCUMENT_PUBLISHED", label: "Quản lý xuất bản" },
  { value: "DOCUMENT_APPROVED", label: "Phê duyệt thay (ủy quyền)" },
  { value: "DOCUMENT_ROLLBACK", label: "Hoàn tác rollback" },
  { value: "DOCUMENT_REJECTED", label: "Từ chối" },
];

const ACTION_LABEL: Record<string, string> = Object.fromEntries(
  ACTIONS.filter((item) => item.value).map((item) => [item.value, item.label])
);

function startOfDay(date: string) {
  return date ? `${date}T00:00:00Z` : "";
}

function endOfDay(date: string) {
  return date ? `${date}T23:59:59Z` : "";
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [action, setAction] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const data = await getAuditLogs({
        action,
        from: startOfDay(fromDate),
        to: endOfDay(toDate),
      });
      setLogs(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setForbidden(true);
        setLogs([]);
      } else {
        setError("Không tải được nhật ký kiểm toán.");
      }
    } finally {
      setLoading(false);
    }
  }, [action, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#eaf6ef] text-[#07543f] rounded-lg">
                <History size={22} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Nhật ký kiểm toán hệ thống</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Quản trị viên và Trưởng nhóm kỹ thuật xem đăng nhập, liên kết GitHub, sinh tài liệu AI, duyệt, xuất bản và rollback.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Filter size={14} />
            Bộ lọc
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-gray-600">
              Hành động
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                {ACTIONS.map((item) => (
                  <option key={item.value || "all"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Từ ngày
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Đến ngày
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>
          </div>
        </div>

        {forbidden && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            Trang này chỉ mở cho Quản trị viên và Trưởng nhóm kỹ thuật.
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs uppercase text-gray-600">
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Đối tượng</th>
                <th className="py-3 px-4">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Đang tải nhật ký...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Không có bản ghi phù hợp.
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item.logId} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} />
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {ACTION_LABEL[item.action] ?? item.action}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{item.actorId ? `#${item.actorId}` : "—"}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {item.resourceType}
                      {item.resourceId ? ` #${item.resourceId}` : ""}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      <p className="line-clamp-2">{item.detail}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
