"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Search, Users, UserCheck, UserX, Lock, Unlock, ShieldCheck, Loader2, ChevronDown, UserPlus, X } from "lucide-react";
import { changeRole, changeStatus, createUser, listUsers } from "@/services/adminService";
import type { AdminUser } from "@/types/auth";

const ROLE_OPTIONS = [
  { value: "DEVELOPER", label: "Developer" },
  { value: "STAFF", label: "Staff" },
  { value: "MANAGER", label: "Manager" },
  { value: "TECH_LEAD", label: "Tech Lead" },
  { value: "ADMIN", label: "Admin" },
];
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

  // Modal tạo người dùng
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "DEVELOPER",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setUsers(await listUsers()); }
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

  async function onRoleChange(user: AdminUser, role: string) {
    setBusyId(user.userId); setError(null);
    try { const up = await changeRole(user.userId, role); setUsers((p) => p.map((u) => (u.userId === up.userId ? up : u))); }
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
    setCreateError(null);
    if (!createForm.email.trim() || !createForm.password || !createForm.fullName.trim()) {
      setCreateError("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setCreating(true);
    try {
      const newUser = await createUser({
        email: createForm.email.trim(),
        password: createForm.password,
        fullName: createForm.fullName.trim(),
        role: createForm.role,
      });
      setUsers((prev) => [newUser, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ fullName: "", email: "", password: "", role: "DEVELOPER" });
      setSuccessMsg(`Đã tạo thành công tài khoản "${newUser.email}" (${roleLabel(createForm.role)}).`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || "Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản trị người dùng</h1>
          <p className="mt-1 text-sm text-slate-500">{total} người dùng trong hệ thống</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreateModal(true); setCreateError(null); }}
          className="inline-flex items-center gap-2 rounded-[6px] bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <UserPlus size={16} aria-hidden />
          Tạo tài khoản mới
        </button>
      </div>

      {successMsg ? (
        <div role="status" className="mb-5 rounded-[6px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMsg}
        </div>
      ) : null}

      {error ? (<div role="alert" className="mb-5 rounded-[6px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</div>) : null}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Tổng người dùng" value={total} icon={<Users size={16} />} />
        <StatCard label="Đang hoạt động" value={activeCount} icon={<UserCheck size={16} />} tone="emerald" />
        <StatCard label="Vô hiệu hoá" value={lockedCount} icon={<UserX size={16} />} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Tìm tên, email..." className="w-full rounded-[6px] border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500" />
        </div>
        <div className="relative">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="appearance-none rounded-[6px] border border-slate-300 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-500">
            <option value="ALL">Tất cả vai trò</option>
            {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
      <div className="overflow-hidden rounded-[6px] border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm font-medium text-slate-500"><Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden />Đang tải người dùng…</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">Không có người dùng phù hợp.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Người dùng</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Vai trò</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Tạo lúc</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const role = roleOf(user);
                  const isActive = user.status === "ACTIVE";
                  const busy = busyId === user.userId;
                  return (
                    <tr key={user.userId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{initials(user.fullName || user.email)}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{user.fullName || "—"}</p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[role] ?? ROLE_BADGE.DEVELOPER}`}><ShieldCheck size={11} aria-hidden />{roleLabel(role)}</span>
                          <div className="relative">
                            <select value={role} disabled={busy} onChange={(e) => void onRoleChange(user, e.target.value)} aria-label={`Đổi vai trò cho ${user.fullName}`} className="appearance-none rounded-[6px] border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-emerald-500 disabled:opacity-50">
                              {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                            </select>
                            <ChevronDown aria-hidden className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {isActive ? (<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />Hoạt động</span>) : (<span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"><span className="size-1.5 rounded-full bg-slate-400" aria-hidden />Vô hiệu</span>)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{fmtDate(user.createdAt)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button type="button" disabled={busy} onClick={() => void onToggleLock(user)} className={`inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${isActive ? "border-rose-200 bg-white text-rose-600 hover:bg-rose-50" : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}>
                          {isActive ? <Lock size={13} aria-hidden /> : <Unlock size={13} aria-hidden />}{isActive ? "Khóa" : "Mở khóa"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tạo Người Dùng Mới */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tạo tài khoản người dùng</h3>
                <p className="mt-0.5 text-xs text-slate-500">Chỉ Admin có quyền tạo tài khoản và phân quyền trực tiếp.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {createError ? (
              <div role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                {createError}
              </div>
            ) : null}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Email đăng nhập <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="user@example.com"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Mật khẩu khởi tạo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Ít nhất 6 ký tự"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Vai trò hệ thống <span className="text-rose-500">*</span>
                </label>
                <div className="relative mt-1">
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 pr-8 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label} ({r.value})
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <UserPlus size={14} aria-hidden />}
                  {creating ? "Đang tạo..." : "Xác nhận tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function StatCard({ label, value, icon, tone = "slate" }: { label: string; value: number; icon: ReactNode; tone?: "slate" | "emerald" }) {
  return (
    <div className="rounded-[6px] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={tone === "emerald" ? "text-emerald-600" : "text-slate-500"}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
