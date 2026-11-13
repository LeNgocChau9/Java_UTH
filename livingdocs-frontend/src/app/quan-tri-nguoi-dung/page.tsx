"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Search, Users, UserCheck, UserX, Lock, Unlock, ShieldCheck, Loader2, ChevronDown, UserPlus, X, KeyRound, CheckCircle2, Clock } from "lucide-react";
import { changeRole, changeStatus, createUser, listUsers, listPasswordResetRequests, approvePasswordReset, directResetPassword, type PasswordResetRequestItem } from "@/services/adminService";
import type { AdminUser } from "@/types/auth";

const BUSINESS_ROLES = [
  { value: "DEVELOPER", label: "Lập trình viên" },
  { value: "STAFF", label: "Nhân viên đánh giá cấp một" },
  { value: "MANAGER", label: "Quản lý phê duyệt cuối cùng" },
];
const SYSTEM_ROLES = [
  { value: "TECH_LEAD", label: "Tech Lead" },
  { value: "ADMIN", label: "Quản trị viên" },
];
const ROLE_OPTIONS = [...BUSINESS_ROLES, ...SYSTEM_ROLES];
const ROLE_BADGE: Record<string, string> = {
  DEVELOPER: "border-blue-200 bg-blue-50 text-blue-700",
  STAFF: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MANAGER: "border-amber-200 bg-amber-50 text-amber-700",
  TECH_LEAD: "border-purple-200 bg-purple-50 text-purple-700",
  ADMIN: "border-rose-200 bg-rose-50 text-rose-700",
};
function roleOf(u: AdminUser): string { return (u.roles?.[0] ?? "ROLE_DEVELOPER").replace(/^ROLE_/, "").toUpperCase(); }
function roleLabel(role: string): string { return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role; }
function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length ? p.slice(0, 2).map((x) => x[0]?.toUpperCase() ?? "").join("") : "LD";
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<number | null>(null);

  // Danh sách yêu cầu cấp lại mật khẩu từ người dùng
  const [resetRequests, setResetRequests] = useState<PasswordResetRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Modal tạo người dùng
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "DEVELOPER",
    avatarUrl: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal cấp lại mật khẩu
  const [resetTargetUser, setResetTargetUser] = useState<AdminUser | null>(null);
  const [resetTargetReq, setResetTargetReq] = useState<PasswordResetRequestItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [uList, rList] = await Promise.all([
        listUsers(),
        listPasswordResetRequests().catch(() => [] as PasswordResetRequestItem[]),
      ]);
      setUsers(uList);
      setResetRequests(rList);
    }
    catch { setError("Không tải được danh sách người dùng. Vui lòng thử lại."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => (!q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) && (roleFilter === "ALL" || roleOf(u) === roleFilter));
  }, [users, query, roleFilter]);

  const total = users.length;
  const activeCount = users.filter((u) => u.status === "ACTIVE").length;
  const lockedCount = total - activeCount;
  const pendingResetCount = resetRequests.filter((r) => r.status === "PENDING").length;

  async function onRoleChange(user: AdminUser, role: string) {
    setBusyId(user.userId); setError(null);
    try {
      const up = await changeRole(user.userId, role);
      setUsers((p) => p.map((u) => (u.userId === up.userId ? up : u)));
      setSuccessMsg(role === "STAFF"
        ? `Đã gán ${user.fullName} vào nhóm Nhân viên. Tài khoản này thấy hàng đợi xem xét ngay sau khi tải lại trang.`
        : `Đã đổi vai trò của ${user.fullName} thành ${roleLabel(role)}.`);
    }
    catch { setError("Đổi vai trò thất bại. Vui lòng thử lại."); }
    finally { setBusyId(null); }
  }
  async function onToggleLock(user: AdminUser) {
    const nextActive = user.status !== "ACTIVE";
    setBusyId(user.userId); setError(null);
    try { const up = await changeStatus(user.userId, nextActive); setUsers((p) => p.map((u) => (u.userId === up.userId ? up : u))); }
    catch { setError("Cập nhật trạng thái thất bại. Vui lòng thử lại."); }
    finally { setBusyId(null); }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await createUser(createForm);
      setShowCreateModal(false);
      setCreateForm({ fullName: "", email: "", password: "", role: "DEVELOPER", avatarUrl: "" });
      setSuccessMsg("Tạo tài khoản người dùng mới thành công!");
      await load();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || "Không thể tạo tài khoản. Vui lòng thử lại.");
    } finally {
      setCreating(false);
    }
  }

  async function handleApproveReset() {
    if (!newPasswordInput.trim()) return;
    setResetting(true);
    try {
      if (resetTargetReq) {
        await approvePasswordReset(resetTargetReq.requestId, newPasswordInput.trim());
        setResetSuccessNotice(`Đã cấp lại mật khẩu thành công cho ${resetTargetReq.email}: ${newPasswordInput.trim()}`);
      } else if (resetTargetUser) {
        await directResetPassword(resetTargetUser.userId, newPasswordInput.trim());
        setResetSuccessNotice(`Đã đặt lại mật khẩu thành công cho ${resetTargetUser.email}: ${newPasswordInput.trim()}`);
      }
      setResetTargetReq(null);
      setResetTargetUser(null);
      setNewPasswordInput("");
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || "Cấp lại mật khẩu thất bại.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản trị người dùng</h1>
            <p className="mt-1 text-sm text-slate-500">
              Phân người dùng vào Lập trình viên, Nhân viên đánh giá cấp một hoặc Quản lý phê duyệt cuối cùng. Khóa tài khoản, đặt lại mật khẩu và mọi lần đổi quyền đều được ghi nhật ký kiểm toán.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <UserPlus size={16} /> Thêm người dùng
          </button>
        </div>

        {/* Notices */}
        {successMsg && (
          <div className="mt-4 flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)}><X size={16} /></button>
          </div>
        )}
        {resetSuccessNotice && (
          <div className="mt-4 flex items-center justify-between rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-600" />
              <span>{resetSuccessNotice}</span>
            </div>
            <button onClick={() => setResetSuccessNotice(null)}><X size={16} /></button>
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center justify-between rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X size={16} /></button>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-blue-50 text-blue-600">
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Tổng người dùng</p>
                <p className="text-xl font-bold text-slate-900">{total}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-emerald-50 text-emerald-600">
                <UserCheck size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Đang hoạt động</p>
                <p className="text-xl font-bold text-emerald-600">{activeCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-rose-50 text-rose-600">
                <UserX size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Đang bị khóa</p>
                <p className="text-xl font-bold text-rose-600">{lockedCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-amber-100 text-amber-700">
                <KeyRound size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-amber-800">Yêu cầu cấp lại mật khẩu</p>
                <p className="text-xl font-bold text-amber-900">{pendingResetCount} chờ duyệt</p>
              </div>
            </div>
          </div>
        </div>

        {/* Danh sách yêu cầu cấp lại mật khẩu đang chờ Admin duyệt */}
        {pendingResetCount > 0 && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50/40 p-4">
            <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-3">
              <Clock size={16} /> Danh sách người dùng yêu cầu Admin cấp lại mật khẩu ({pendingResetCount})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-amber-200 text-amber-900">
                    <th className="pb-2">Họ tên</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Thời gian gửi</th>
                    <th className="pb-2 text-right">Thao tác Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {resetRequests
                    .filter((r) => r.status === "PENDING")
                    .map((req) => (
                      <tr key={req.requestId}>
                        <td className="py-2.5 font-semibold text-slate-900">{req.fullName || "—"}</td>
                        <td className="py-2.5 text-slate-600">{req.email}</td>
                        <td className="py-2.5 text-slate-500">{fmtDate(req.createdAt)}</td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setResetTargetReq(req);
                              setResetTargetUser(null);
                              setNewPasswordInput("Canh8533");
                            }}
                            className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700"
                          >
                            <KeyRound size={13} /> Cấp lại mật khẩu
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filter and User List Table */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Lọc vai trò:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border border-slate-300 py-1.5 px-3 text-xs outline-none focus:border-emerald-500"
            >
              <option value="ALL">Tất cả vai trò</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">Người dùng</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const r = roleOf(u);
                const isBusy = busyId === u.userId;
                return (
                  <tr key={u.userId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-300 flex items-center justify-center">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName}
                              className="size-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.email || u.fullName)}`;
                              }}
                            />
                          ) : (
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.email || u.fullName)}`}
                              alt={u.fullName}
                              className="size-full object-cover"
                            />
                          )}
                        </div>
                        <span className="font-semibold text-slate-900">{u.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={r}
                        disabled={isBusy}
                        onChange={(e) => onRoleChange(u, e.target.value)}
                        className={`rounded border px-2 py-1 text-xs font-semibold ${ROLE_BADGE[r] || "border-slate-200 bg-slate-50 text-slate-700"}`}
                      >
                        <optgroup label="Vai trò nghiệp vụ">
                          {BUSINESS_ROLES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Vai trò hệ thống">
                          {SYSTEM_ROLES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${u.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        <span className={`size-1.5 rounded-full ${u.status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {u.status === "ACTIVE" ? "Hoạt động" : "Bị khóa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetUser(u);
                            setResetTargetReq(null);
                            setNewPasswordInput("Canh8533");
                          }}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                          title="Đặt lại mật khẩu cho tài khoản này"
                        >
                          <KeyRound size={13} /> Cấp MK
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onToggleLock(u)}
                          className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-semibold ${u.status === "ACTIVE" ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                        >
                          {u.status === "ACTIVE" ? <Lock size={13} /> : <Unlock size={13} />}
                          {u.status === "ACTIVE" ? "Khóa" : "Mở"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Cấp lại mật khẩu (Admin duyệt) */}
        {(resetTargetUser || resetTargetReq) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound size={18} className="text-emerald-600" /> Cấp lại mật khẩu người dùng
                </h3>
                <button
                  onClick={() => {
                    setResetTargetUser(null);
                    setResetTargetReq(null);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  Tài khoản: <strong className="text-slate-900">{resetTargetReq ? resetTargetReq.email : resetTargetUser?.email}</strong>
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nhập mật khẩu mới cấp cho người dùng:
                  </label>
                  <input
                    type="text"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Ví dụ: Canh8533"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setResetTargetUser(null);
                    setResetTargetReq(null);
                  }}
                  className="rounded px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={resetting || !newPasswordInput.trim()}
                  onClick={handleApproveReset}
                  className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {resetting ? "Đang cấp lại..." : "Xác nhận cấp lại mật khẩu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Thêm người dùng */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Thêm người dùng mới</h3>
                <button onClick={() => setShowCreateModal(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>

              {createError && (
                <div className="mt-3 rounded bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Họ và tên</label>
                  <input
                    type="text"
                    required
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Mật khẩu</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Ảnh đại diện (URL Avatar - Tùy chọn)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.png (để trống sẽ tạo tự động)"
                    value={createForm.avatarUrl}
                    onChange={(e) => setCreateForm({ ...createForm, avatarUrl: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Vai trò ban đầu</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    {creating ? "Đang tạo..." : "Tạo người dùng"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
