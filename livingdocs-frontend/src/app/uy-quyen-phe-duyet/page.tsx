"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { reviewService, type ManagerDelegationItem, type WorkspaceManagerItem } from "@/services/reviewService";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isActive(item: ManagerDelegationItem) {
  const today = todayIso();
  const from = item.fromDate?.slice(0, 10) ?? "";
  const to = item.toDate?.slice(0, 10) ?? "";
  if (item.active === false) return false;
  if (from && today < from) return false;
  if (to && today > to) return false;
  return true;
}

export default function DelegationPage() {
  const { user } = useSession();
  const [items, setItems] = useState<ManagerDelegationItem[]>([]);
  const [workspaceManagers, setWorkspaceManagers] = useState<WorkspaceManagerItem[]>([]);
  const [delegateeName, setDelegateeName] = useState("");
  const [delegateeEmail, setDelegateeEmail] = useState("");
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [reason, setReason] = useState("Đi công tác");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await reviewService.getManagerDelegations());
    } catch {
      setError("Không tải được danh sách ủy quyền.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    reviewService
      .getWorkspaceManagers()
      .then((managers) => {
        setWorkspaceManagers(managers);
        if (managers.length > 0) {
          const eligible = user ? managers.filter((m) => m.email !== user.email) : managers;
          const firstOther = eligible[0] || managers[0];
          setDelegateeName(firstOther.fullName);
          setDelegateeEmail(firstOther.email);
        }
      })
      .catch((err) => console.warn("Lỗi tải workspace managers:", err));
  }, [load, user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!delegateeEmail.trim() || !delegateeName.trim()) {
      setError("Vui lòng chọn hoặc nhập thông tin người được ủy quyền.");
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      setError("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const created = await reviewService.createManagerDelegation({
        delegatorName: user?.fullName || user?.email || "Quản lý ủy quyền",
        delegatorEmail: user?.email || "",
        delegateeName: delegateeName.trim(),
        delegateeEmail: delegateeEmail.trim(),
        fromDate,
        toDate,
        reason: reason.trim() || "Nghỉ phép hoặc đi công tác",
        active: true,
      });
      setItems((current) => [created, ...current]);
      setMessage(`Đã ủy quyền cho ${created.delegateeName}. Khi người này duyệt, nhật ký ghi "${created.delegateeName} phê duyệt thay cho ${created.delegatorName} theo ủy quyền".`);
      if (workspaceManagers.length > 0) {
        const eligible = user ? workspaceManagers.filter((m) => m.email !== user.email) : workspaceManagers;
        const nextDefault = eligible.find((m) => m.email === delegateeEmail) || eligible[0] || workspaceManagers[0];
        if (nextDefault) {
          setDelegateeName(nextDefault.fullName);
          setDelegateeEmail(nextDefault.email);
        }
      } else {
        setDelegateeName("");
        setDelegateeEmail("");
      }
    } catch {
      setError("Không tạo được ủy quyền. Cần tài khoản Quản lý hoặc Admin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ủy quyền phê duyệt</h1>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Người được ủy quyền (Manager B)
            </label>
            {workspaceManagers.length > 0 ? (
              <select
                value={delegateeEmail}
                onChange={(e) => {
                  const m = workspaceManagers.find((item) => item.email === e.target.value);
                  if (m) {
                    setDelegateeEmail(m.email);
                    setDelegateeName(m.fullName);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                required
              >
                {workspaceManagers
                  .filter((m) => !user || m.email !== user.email)
                  .map((m) => (
                    <option key={m.userId || m.email} value={m.email}>
                      {m.fullName} ({m.email})
                    </option>
                  ))}
              </select>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  placeholder="Họ tên người nhận ủy quyền"
                  value={delegateeName}
                  onChange={(event) => setDelegateeName(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  type="email"
                  placeholder="Email người nhận ủy quyền"
                  value={delegateeEmail}
                  onChange={(event) => setDelegateeEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <label className="text-xs font-medium text-slate-600">
            Từ ngày
            <input required type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Đến ngày (để trống nếu không giới hạn)
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
            Lý do
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-[#07543f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Đang lưu..." : "Thiết lập ủy quyền"}
            </button>
          </div>
        </form>

        {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Người ủy quyền</th>
                <th className="px-4 py-3">Người duyệt thay</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chưa có ủy quyền.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id ?? `${item.delegateeEmail}-${item.fromDate}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.delegatorName}</div>
                    <div className="text-xs text-slate-400">{item.delegatorEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.delegateeName}</div>
                    <div className="text-xs text-slate-400">{item.delegateeEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.fromDate ? item.fromDate.slice(0, 10) : "—"} → {item.toDate ? item.toDate.slice(0, 10) : "Không giới hạn"}
                  </td>
                  <td className="px-4 py-3">{isActive(item) ? "Đang hiệu lực" : "Ngoài thời gian"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
