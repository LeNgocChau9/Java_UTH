"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Search, Users, UserCheck, UserX, Lock, Unlock, ShieldCheck, Loader2, ChevronDown } from "lucide-react";
import { changeRole, changeStatus, listUsers } from "@/services/adminService";
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
  return Number.isNaN(d.getTime()) ? "?" : d.toLocaleDateString("vi-VN");
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setUsers(await listUsers()); }
    catch { setError("Kh?ng t?i ???c danh s?ch ng??i d?ng. Vui l?ng th? l?i."); }
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
    catch { setError("??i vai tr? th?t b?i. Vui l?ng th? l?i."); }
    finally { setBusyId(null); }
  }
  async function onToggleLock(user: AdminUser) {
    const nextActive = user.status !== "ACTIVE";
    setBusyId(user.userId); setError(null);
    try { const up = await changeStatus(user.userId, nextActive); setUsers((p) => p.map((u) => (u.userId === up.userId ? up : u))); }
    catch { setError("C?p nh?t tr?ng th?i th?t b?i. Vui l?ng th? l?i."); }
    finally { setBusyId(null); }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Qu?n tr? ng??i d?ng</h1>
        <p className="mt-1 text-sm text-slate-500">{total} ng??i d?ng trong h? th?ng</p>
      </div>
      {error ? (<div role="alert" className="mb-5 rounded-[6px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</div>) : null}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="T?ng ng??i d?ng" value={total} icon={<Users size={16} />} />
        <StatCard label="?ang ho?t ??ng" value={activeCount} icon={<UserCheck size={16} />} tone="emerald" />
        <StatCard label="V? hi?u ho?" value={lockedCount} icon={<UserX size={16} />} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} placeholder="T?m t?n, email..." className="w-full rounded-[6px] border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500" />
        </div>
        <div className="relative">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="appearance-none rounded-[6px] border border-slate-300 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-500">
            <option value="ALL">T?t c? vai tr?</option>
            {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
      <div className="overflow-hidden rounded-[6px] border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm font-medium text-slate-500"><Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden />?ang t?i ng??i d?ng?</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">Kh?ng c? ng??i d?ng ph? h?p.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Ng??i d?ng</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Vai tr?</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Tr?ng th?i</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">T?o l?c</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">H?nh ??ng</th>
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
                            <p className="truncate text-sm font-semibold text-slate-900">{user.fullName || "?"}</p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[role] ?? ROLE_BADGE.DEVELOPER}`}><ShieldCheck size={11} aria-hidden />{roleLabel(role)}</span>
                          <div className="relative">
                            <select value={role} disabled={busy} onChange={(e) => void onRoleChange(user, e.target.value)} aria-label={`??i vai tr? cho ${user.fullName}`} className="appearance-none rounded-[6px] border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-emerald-500 disabled:opacity-50">
                              {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                            </select>
                            <ChevronDown aria-hidden className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {isActive ? (<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />Ho?t ??ng</span>) : (<span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"><span className="size-1.5 rounded-full bg-slate-400" aria-hidden />V? hi?u</span>)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{fmtDate(user.createdAt)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button type="button" disabled={busy} onClick={() => void onToggleLock(user)} className={`inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${isActive ? "border-rose-200 bg-white text-rose-600 hover:bg-rose-50" : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}>
                          {isActive ? <Lock size={13} aria-hidden /> : <Unlock size={13} aria-hidden />}{isActive ? "Kh?a" : "M? kh?a"}
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
