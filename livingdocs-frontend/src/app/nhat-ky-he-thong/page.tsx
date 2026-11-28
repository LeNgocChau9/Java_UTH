"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Database, Filter, History, RefreshCw, Save, ShieldAlert, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getAuditLogs,
  getRetentionConfig,
  triggerManualCleanup,
  updateRetentionConfig,
  type AuditLogItem,
  type AuditRetentionConfig,
} from "@/services/auditService";

const ACTIONS = [
  { value: "", label: "Mọi hành động" },
  { value: "LOGIN_SUCCESS", label: "Đăng nhập" },
  { value: "ROLE_CHANGED", label: "Đổi vai trò" },
  { value: "USER_UPDATED", label: "Khóa, mở hoặc đặt lại mật khẩu" },
  { value: "USER_CREATED", label: "Tạo tài khoản" },
  { value: "USER_APPROVED", label: "Phê duyệt tài khoản" },
  { value: "USER_REJECTED", label: "Từ chối tài khoản" },
  { value: "USER_ENTERPRISE_CHANGED", label: "Phân doanh nghiệp người dùng" },
  { value: "ENTERPRISE_CREATED", label: "Tạo doanh nghiệp" },
  { value: "ENTERPRISE_UPDATED", label: "Cập nhật doanh nghiệp" },
  { value: "ENTERPRISE_DELETED", label: "Xóa doanh nghiệp" },
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

  // Retention Management state
  const [retentionConfig, setRetentionConfig] = useState<AuditRetentionConfig | null>(null);
  const [retentionDaysInput, setRetentionDaysInput] = useState<number>(90);
  const [autoCleanupInput, setAutoCleanupInput] = useState<boolean>(true);
  const [loadingRetention, setLoadingRetention] = useState<boolean>(false);
  const [savingRetention, setSavingRetention] = useState<boolean>(false);
  const [cleaningUp, setCleaningUp] = useState<boolean>(false);
  const [retentionNotice, setRetentionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadRetention = useCallback(async () => {
    setLoadingRetention(true);
    try {
      const cfg = await getRetentionConfig();
      setRetentionConfig(cfg);
      setRetentionDaysInput(cfg.retentionDays ?? 90);
      setAutoCleanupInput(cfg.autoCleanupEnabled ?? true);
    } catch {
      // Nếu 403 hoặc lỗi tải sẽ được xử lý qua bảng chính
    } finally {
      setLoadingRetention(false);
    }
  }, []);

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
    void loadRetention();
  }, [load, loadRetention]);

  const handleSaveRetention = async (e: React.FormEvent) => {
    e.preventDefault();
    const clampedDays = Math.min(365, Math.max(30, Number(retentionDaysInput) || 90));
    setRetentionDaysInput(clampedDays);
    setSavingRetention(true);
    setRetentionNotice(null);
    try {
      const updated = await updateRetentionConfig({
        retentionDays: clampedDays,
        autoCleanupEnabled: autoCleanupInput,
      });
      setRetentionConfig(updated);
      setRetentionDaysInput(updated.retentionDays);
      setAutoCleanupInput(updated.autoCleanupEnabled);
      setRetentionNotice({
        type: "success",
        text: `Đã lưu chính sách lưu trữ: giữ nhật ký ${updated.retentionDays} ngày (${updated.autoCleanupEnabled ? "Bật tự động dọn dẹp" : "Tắt tự động dọn dẹp"}).`,
      });
      await load();
    } catch {
      setRetentionNotice({
        type: "error",
        text: "Không thể cập nhật chính sách lưu trữ. Vui lòng kiểm tra quyền ADMIN/TECH_LEAD.",
      });
    } finally {
      setSavingRetention(false);
    }
  };

  const handleManualCleanup = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Bạn có chắc chắn muốn dọn dẹp các nhật ký đã hết hạn ngay bây giờ?")
    ) {
      return;
    }
    setCleaningUp(true);
    setRetentionNotice(null);
    try {
      const result = await triggerManualCleanup();
      setRetentionNotice({
        type: "success",
        text: result.message || `Dọn dẹp xong ${result.auditLogsDeleted} audit logs và ${result.changelogsDeleted} changelogs.`,
      });
      await Promise.all([loadRetention(), load()]);
    } catch {
      setRetentionNotice({
        type: "error",
        text: "Không thể thực hiện dọn dẹp nhật ký ngay lúc này.",
      });
    } finally {
      setCleaningUp(false);
    }
  };

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

        {!forbidden && (
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <Database size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Quản trị Chính sách Lưu trữ &amp; Dọn dẹp Nhật ký (Audit Retention)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Cấu hình thời hạn lưu trữ từ 30 – 365 ngày và kích hoạt dọn dẹp các bản ghi quá hạn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleManualCleanup()}
                disabled={cleaningUp || loadingRetention}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
              >
                <Trash2 size={14} />
                {cleaningUp ? "Đang dọn dẹp..." : "Dọn dẹp nhật ký ngay"}
              </button>
            </div>

            {retentionNotice && (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                  retentionNotice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {retentionNotice.type === "success" ? (
                  <CheckCircle2 size={15} className="shrink-0" />
                ) : (
                  <AlertCircle size={15} className="shrink-0" />
                )}
                <span>{retentionNotice.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div>
                <span className="text-gray-500 block">Thời hạn hiện tại</span>
                <strong className="text-sm text-gray-900">
                  {retentionConfig ? `${retentionConfig.retentionDays} ngày` : "—"}
                </strong>
              </div>
              <div>
                <span className="text-gray-500 block">Tự động dọn dẹp</span>
                <strong className={`text-sm ${retentionConfig?.autoCleanupEnabled ? "text-emerald-700" : "text-gray-700"}`}>
                  {retentionConfig
                    ? retentionConfig.autoCleanupEnabled
                      ? "Đang bật"
                      : "Đang tắt"
                    : "—"}
                </strong>
              </div>
              <div>
                <span className="text-gray-500 block">Lần dọn dẹp gần nhất</span>
                <strong className="text-gray-900">
                  {retentionConfig?.lastCleanupAt
                    ? new Date(retentionConfig.lastCleanupAt).toLocaleString("vi-VN")
                    : "Chưa từng chạy"}
                </strong>
              </div>
              <div>
                <span className="text-gray-500 block">Kết quả gần nhất</span>
                <strong className="text-gray-900">
                  {retentionConfig?.lastCleanupStatus
                    ? `${retentionConfig.lastCleanupStatus} (${retentionConfig.lastAuditLogsDeleted ?? 0} audit / ${retentionConfig.lastChangelogsDeleted ?? 0} changelog)`
                    : "—"}
                </strong>
              </div>
            </div>

            <form onSubmit={handleSaveRetention} className="flex flex-col sm:flex-row sm:items-end gap-4 pt-1">
              <label className="block text-xs font-medium text-gray-700">
                Số ngày lưu trữ (30 - 365 ngày)
                <input
                  type="number"
                  min={30}
                  max={365}
                  value={retentionDaysInput}
                  onChange={(e) => setRetentionDaysInput(Number(e.target.value))}
                  className="mt-1 w-44 text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCleanupInput}
                  onChange={(e) => setAutoCleanupInput(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Tự động dọn dẹp định kỳ hàng ngày
              </label>

              <button
                type="submit"
                disabled={savingRetention || loadingRetention}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#07543f] rounded-lg hover:bg-[#054332] disabled:opacity-60 cursor-pointer"
              >
                <Save size={14} />
                {savingRetention ? "Đang lưu..." : "Lưu chính sách"}
              </button>
            </form>
          </div>
        )}

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
