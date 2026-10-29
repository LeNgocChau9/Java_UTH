"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  AlertTriangle,
  GitPullRequest,
  FileCode,
  FileText,
  Clock,
  ChevronRight,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldAlert,
  Check,
  X,
} from "lucide-react";
import { driftAlertService, DriftAlertDto } from "@/services/driftAlertService";

const SEVERITY_CONFIG: Record<
  string,
  { label: string; badgeBg: string; badgeText: string; borderColor: string; iconColor: string }
> = {
  CRITICAL: {
    label: "Nghiêm trọng",
    badgeBg: "bg-red-50 text-red-700 border-red-200",
    badgeText: "text-red-700",
    borderColor: "border-l-red-500",
    iconColor: "text-red-600",
  },
  HIGH: {
    label: "Cao",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    badgeText: "text-amber-700",
    borderColor: "border-l-amber-500",
    iconColor: "text-amber-600",
  },
  MEDIUM: {
    label: "Trung bình",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeText: "text-emerald-700",
    borderColor: "border-l-emerald-500",
    iconColor: "text-emerald-600",
  },
  LOW: {
    label: "Thấp",
    badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
    badgeText: "text-sky-700",
    borderColor: "border-l-sky-500",
    iconColor: "text-sky-600",
  },
};

export default function CanhBaoSaiLechPage() {
  const [alerts, setAlerts] = useState<DriftAlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("OPEN");
  const [activeModalAlert, setActiveModalAlert] = useState<DriftAlertDto | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await driftAlertService.getAlerts({
        status: selectedStatus === "ALL" ? undefined : selectedStatus,
        severity: selectedSeverity === "ALL" ? undefined : selectedSeverity,
      });
      setAlerts(data);
    } catch (err) {
      console.error("Lỗi khi lấy danh sách cảnh báo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [selectedStatus, selectedSeverity]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAcceptFix = async (alert: DriftAlertDto) => {
    setActionLoadingId(alert.alertId);
    try {
      const res = await driftAlertService.acceptFix(alert.alertId);
      if (res.success) {
        showToast(res.message || "Đã chấp nhận sửa và tạo bản nháp tài liệu mới thành công!");
        setAlerts((prev) =>
          prev.map((a) => (a.alertId === alert.alertId ? { ...a, status: "RESOLVED" } : a))
        );
        if (activeModalAlert?.alertId === alert.alertId) {
          setActiveModalAlert({ ...activeModalAlert, status: "RESOLVED" });
        }
      } else {
        showToast("Không thể áp dụng sửa đổi. Vui lòng thử lại.", "error");
      }
    } catch (e) {
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDismiss = async (alertId: number) => {
    setActionLoadingId(alertId);
    try {
      const success = await driftAlertService.updateStatus(alertId, "DISMISSED");
      if (success) {
        showToast("Đã bỏ qua cảnh báo.");
        setAlerts((prev) =>
          prev.map((a) => (a.alertId === alertId ? { ...a, status: "DISMISSED" } : a))
        );
        if (activeModalAlert?.alertId === alertId) {
          setActiveModalAlert(null);
        }
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Tính toán số liệu thống kê
  const totalCount = alerts.length;
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;
  const highCount = alerts.filter((a) => a.severity === "HIGH").length;
  const openCount = alerts.filter((a) => a.status === "OPEN").length;
  const resolvedCount = alerts.filter((a) => a.status === "RESOLVED").length;

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6">
        {/* Toast thông báo */}
        {notification && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-red-50 border-red-300 text-red-800"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Tiêu đề trang */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5 bg-white -mx-6 -mt-6 p-6 md:p-8 md:-mx-8 md:-mt-8 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Cảnh báo sai lệch tài liệu (Drift Alerts)
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Tự động phát hiện khi mã nguồn Java trên GitHub thay đổi nhưng tài liệu kỹ thuật chưa cập nhật
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-emerald-700 transition shadow-sm disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
              Quét lại
            </button>
          </div>
        </div>

        {/* Thẻ chỉ số tổng quan (Stat Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đang mở (Open)</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{openCount}</p>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nghiêm trọng (Critical)</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{criticalCount}</p>
            </div>
            <div className="p-2.5 bg-red-50 rounded-lg text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mức cao (High)</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{highCount}</p>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã giải quyết</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{resolvedCount}</p>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Bộ lọc Mức độ & Trạng thái */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Lọc Severity */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-1">Mức độ:</span>
            {[
              { key: "ALL", label: "Tất cả" },
              { key: "CRITICAL", label: "Nghiêm trọng" },
              { key: "HIGH", label: "Cao" },
              { key: "MEDIUM", label: "Trung bình" },
              { key: "LOW", label: "Thấp" },
            ].map((sev) => {
              const active = selectedSeverity === sev.key;
              return (
                <button
                  key={sev.key}
                  onClick={() => setSelectedSeverity(sev.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                    active
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {sev.label}
                </button>
              );
            })}
          </div>

          {/* Lọc Trạng thái */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-1">Trạng thái:</span>
            {[
              { key: "OPEN", label: "Chưa xử lý" },
              { key: "RESOLVED", label: "Đã giải quyết" },
              { key: "DISMISSED", label: "Đã bỏ qua" },
              { key: "ALL", label: "Tất cả" },
            ].map((st) => {
              const active = selectedStatus === st.key;
              return (
                <button
                  key={st.key}
                  onClick={() => setSelectedStatus(st.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                    active
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Danh sách cảnh báo */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Đang tải danh sách cảnh báo sai lệch...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Không có cảnh báo sai lệch nào!</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Toàn bộ tài liệu kỹ thuật đang hoàn toàn đồng bộ với mã nguồn Java trên GitHub.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.MEDIUM;
              const isResolved = alert.status === "RESOLVED";
              const isDismissed = alert.status === "DISMISSED";

              return (
                <div
                  key={alert.alertId}
                  className={`bg-white rounded-xl border border-slate-200 shadow-sm transition hover:shadow-md ${sev.borderColor} border-l-4 overflow-hidden`}
                >
                  <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Thông tin chính */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sev.badgeBg}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {sev.label}
                        </span>

                        <span className="text-xs font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {alert.changeType || "MODIFIED"}
                        </span>

                        {alert.prNumber && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <GitPullRequest className="w-3.5 h-3.5" />
                            PR #{alert.prNumber}
                          </span>
                        )}

                        {isResolved && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full">
                            <Check className="w-3.5 h-3.5" />
                            Đã giải quyết
                          </span>
                        )}

                        {isDismissed && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            <X className="w-3.5 h-3.5" />
                            Đã bỏ qua
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-slate-900 hover:text-emerald-700 transition">
                          {alert.documentTitle}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-slate-400" />
                          {alert.filePath}
                          {alert.methodName && (
                            <span className="text-slate-800 font-semibold">➔ {alert.methodName}</span>
                          )}
                        </p>
                      </div>

                      {/* Đề xuất AI tóm tắt */}
                      {alert.aiSuggestion && (
                        <div className="flex items-start gap-2 bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 text-xs text-slate-700">
                          <Zap className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <p className="line-clamp-2 leading-relaxed">{alert.aiSuggestion}</p>
                        </div>
                      )}
                    </div>

                    {/* Nút hành động */}
                    <div className="flex items-center gap-2 lg:flex-col lg:items-end justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <button
                        onClick={() => setActiveModalAlert(alert)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition shadow-sm"
                      >
                        Đối chiếu Diff
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {!isResolved && (
                        <button
                          onClick={() => handleAcceptFix(alert)}
                          disabled={actionLoadingId === alert.alertId}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition disabled:opacity-60"
                        >
                          {actionLoadingId === alert.alertId ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Chấp nhận sửa
                        </button>
                      )}

                      {!isResolved && !isDismissed && (
                        <button
                          onClick={() => handleDismiss(alert.alertId)}
                          disabled={actionLoadingId === alert.alertId}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition"
                        >
                          Bỏ qua
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL XEM CHI TIẾT ĐỐI CHIẾU DIFF VÀ TÀI LIỆU (SIDE-BY-SIDE) */}
        {/* ============================================================ */}
        {activeModalAlert && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Đối chiếu sai lệch: {activeModalAlert.documentTitle}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      File: {activeModalAlert.filePath}
                      {activeModalAlert.prNumber && ` (Pull Request #${activeModalAlert.prNumber})`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveModalAlert(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - 2 Cột so sánh */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Đề xuất AI Banner */}
                {activeModalAlert.aiSuggestion && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                    <Zap className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Phân tích ngữ nghĩa từ Google Gemini AI
                      </h4>
                      <p className="text-sm text-slate-800 mt-1 leading-relaxed">
                        {activeModalAlert.aiSuggestion}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bảng so sánh Song Song (Side-by-Side Diff) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Cột 1: Git Diff Code vừa sửa trên GitHub */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileCode className="w-4 h-4 text-emerald-600" />
                        Code vừa thay đổi (Git Diff)
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {activeModalAlert.methodName || "Toàn bộ file"}
                      </span>
                    </div>

                    <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 max-h-80 leading-relaxed shadow-inner">
                      {activeModalAlert.diffSnippet ? (
                        activeModalAlert.diffSnippet.split("\n").map((line, idx) => {
                          const isAdd = line.startsWith("+");
                          const isDel = line.startsWith("-");
                          const isHunk = line.startsWith("@@");

                          let colorClass = "text-slate-300";
                          let bgClass = "";
                          if (isAdd) {
                            colorClass = "text-emerald-400";
                            bgClass = "bg-emerald-950/40 -mx-4 px-4";
                          } else if (isDel) {
                            colorClass = "text-rose-400";
                            bgClass = "bg-rose-950/40 -mx-4 px-4";
                          } else if (isHunk) {
                            colorClass = "text-sky-400 font-semibold";
                          }

                          return (
                            <div key={idx} className={`${colorClass} ${bgClass} py-0.5`}>
                              {line || " "}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-slate-500 italic">{"// Không có đoạn mã đối chiếu"}</span>
                      )}
                    </div>
                  </div>

                  {/* Cột 2: Đoạn tài liệu hiện tại bị lệch */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        Tài liệu hiện tại trong kho
                      </span>
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                        Chưa đồng bộ
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 max-h-80 overflow-y-auto leading-relaxed shadow-sm">
                      {activeModalAlert.currentDocContent ? (
                        <div className="prose prose-sm max-w-none text-slate-700">
                          {activeModalAlert.currentDocContent}
                        </div>
                      ) : (
                        <div className="text-slate-400 italic py-6 text-center">
                          Chưa có nội dung mô tả chi tiết cho thực thể này.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => setActiveModalAlert(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
                >
                  Đóng
                </button>

                <div className="flex items-center gap-3">
                  {activeModalAlert.documentId && (
                    <Link
                      href={`/kho-luu-tru/${activeModalAlert.documentId}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Xem tài liệu gốc
                    </Link>
                  )}

                  {activeModalAlert.status !== "RESOLVED" && (
                    <button
                      onClick={() => handleAcceptFix(activeModalAlert)}
                      disabled={actionLoadingId === activeModalAlert.alertId}
                      className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-60"
                    >
                      {actionLoadingId === activeModalAlert.alertId ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Chấp nhận sửa & Tạo bản nháp
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
