"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AppShell } from "@/components/AppShell";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Unlock,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import {
  approvePasswordReset,
  approveUser,
  assignUserEnterprise,
  assignUsersToEnterprise,
  changeRole,
  changeStatus,
  createEnterprise,
  createUser,
  deleteEnterprise,
  directResetPassword,
  listEnterprises,
  listPasswordResetRequests,
  listUsers,
  rejectUser,
  removeUserFromEnterprise,
  updateEnterprise,
  type PasswordResetRequestItem,
} from "@/services/adminService";
import { getAdminEnterpriseScope, setAdminEnterpriseScope } from "@/services/apiClient";
import type { AdminUser, EnterpriseItem } from "@/types/auth";

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

type StatusTab = "ALL" | "PENDING" | "ACTIVE" | "REJECTED" | "LOCKED";
type EnterpriseFilter = "ALL" | "UNASSIGNED" | number;

function roleOf(u: AdminUser): string {
  return (u.roles?.[0] ?? "ROLE_DEVELOPER").replace(/^ROLE_/, "").toUpperCase();
}
function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}
function isLockedStatus(status: string): boolean {
  return status === "LOCKED" || status === "DISABLED";
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}
function extractApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string } | undefined)?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function generateSecurePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*()-_=+";
  const all = upper + lower + digits + special;

  const randomInt = (max: number): number => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  };

  const chars: string[] = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)],
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(all[randomInt(all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function notifyEnterprisesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("livingdocs:enterprises_changed"));
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [enterprises, setEnterprises] = useState<EnterpriseItem[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);

  // Filters
  const [statusTab, setStatusTab] = useState<StatusTab>("ALL");
  const [enterpriseFilter, setEnterpriseFilter] = useState<EnterpriseFilter>("ALL");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<number | null>(null);

  // Modal: Create User
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "DEVELOPER",
    avatarUrl: "",
    enterpriseId: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal: Password Reset
  const [resetTargetUser, setResetTargetUser] = useState<AdminUser | null>(null);
  const [resetTargetReq, setResetTargetReq] = useState<PasswordResetRequestItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [resetting, setResetting] = useState(false);

  // Modal: Approve / Re-approve User
  const [approveTarget, setApproveTarget] = useState<AdminUser | null>(null);
  const [approveRole, setApproveRole] = useState("DEVELOPER");
  const [approveEnterpriseId, setApproveEnterpriseId] = useState("");
  const [approving, setApproving] = useState(false);

  // Modal: Reject User
  const [rejectTarget, setRejectTarget] = useState<AdminUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Modal: Create / Rename Enterprise
  const [enterpriseModalMode, setEnterpriseModalMode] = useState<"create" | "rename" | null>(null);
  const [editingEnterprise, setEditingEnterprise] = useState<EnterpriseItem | null>(null);
  const [enterpriseNameInput, setEnterpriseNameInput] = useState("");
  const [enterpriseSaving, setEnterpriseSaving] = useState(false);
  const [enterpriseModalError, setEnterpriseModalError] = useState<string | null>(null);

  // Modal: Delete Enterprise
  const [deleteEnterpriseTarget, setDeleteEnterpriseTarget] = useState<EnterpriseItem | null>(null);
  const [deletingEnterprise, setDeletingEnterprise] = useState(false);
  const [deleteNeedsForce, setDeleteNeedsForce] = useState(false);
  const [deleteEnterpriseError, setDeleteEnterpriseError] = useState<string | null>(null);

  // Modal: Bulk Add Accounts to Enterprise
  const [addUsersEnterprise, setAddUsersEnterprise] = useState<EnterpriseItem | null>(null);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkOnlyUnassigned, setBulkOnlyUnassigned] = useState(true);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<number[]>([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [uList, eList, rList] = await Promise.all([
        listUsers(),
        listEnterprises(),
        listPasswordResetRequests().catch(() => [] as PasswordResetRequestItem[]),
      ]);
      setUsers(uList);
      setEnterprises(eList);
      setResetRequests(rList);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setForbidden(true);
      } else {
        setError(extractApiError(err, "Không tải được danh sách người dùng. Vui lòng thử lại."));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedEnterprise = useMemo(
    () =>
      typeof enterpriseFilter === "number"
        ? enterprises.find((e) => e.enterpriseId === enterpriseFilter) ?? null
        : null,
    [enterprises, enterpriseFilter],
  );

  // Counts (always derived from live users state for instant accuracy)
  const total = users.length;
  const pendingCount = useMemo(() => users.filter((u) => u.status === "PENDING").length, [users]);
  const activeCount = useMemo(() => users.filter((u) => u.status === "ACTIVE").length, [users]);
  const rejectedCount = useMemo(() => users.filter((u) => u.status === "REJECTED").length, [users]);
  const lockedCount = useMemo(() => users.filter((u) => isLockedStatus(u.status)).length, [users]);
  const unassignedCount = useMemo(() => users.filter((u) => !u.enterpriseId).length, [users]);
  const pendingResetCount = useMemo(
    () => resetRequests.filter((r) => r.status === "PENDING").length,
    [resetRequests],
  );

  const memberCountByEnterprise = useMemo(() => {
    const map = new Map<number, number>();
    for (const u of users) {
      if (u.enterpriseId) {
        map.set(u.enterpriseId, (map.get(u.enterpriseId) ?? 0) + 1);
      }
    }
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (statusTab === "PENDING" && u.status !== "PENDING") return false;
      if (statusTab === "ACTIVE" && u.status !== "ACTIVE") return false;
      if (statusTab === "REJECTED" && u.status !== "REJECTED") return false;
      if (statusTab === "LOCKED" && !isLockedStatus(u.status)) return false;

      if (enterpriseFilter === "UNASSIGNED" && u.enterpriseId) return false;
      if (typeof enterpriseFilter === "number" && u.enterpriseId !== enterpriseFilter) return false;

      if (roleFilter !== "ALL" && roleOf(u) !== roleFilter) return false;

      if (q) {
        const hay = `${u.fullName} ${u.email} ${u.githubUsername ?? ""} ${u.enterpriseName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, statusTab, enterpriseFilter, roleFilter, query]);

  const bulkEligibleUsers = useMemo(() => {
    if (!addUsersEnterprise) return [];
    const q = bulkSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (u.status === "PENDING" || u.status === "REJECTED") return false;
      if (u.enterpriseId === addUsersEnterprise.enterpriseId) return false;
      if (bulkOnlyUnassigned && u.enterpriseId) return false;
      if (q) {
        const hay = `${u.fullName} ${u.email} ${u.githubUsername ?? ""} ${u.enterpriseName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, addUsersEnterprise, bulkSearch, bulkOnlyUnassigned]);

  async function onRoleChange(user: AdminUser, role: string) {
    setBusyId(user.userId);
    setError(null);
    try {
      const up = await changeRole(user.userId, role);
      setUsers((prev) => prev.map((u) => (u.userId === up.userId ? up : u)));
      setSuccessMsg(
        role === "STAFF"
          ? `Đã gán ${user.fullName} vào nhóm Nhân viên. Tài khoản này thấy hàng đợi xem xét ngay sau khi tải lại trang.`
          : `Đã đổi vai trò của ${user.fullName} thành ${roleLabel(role)}.`,
      );
    } catch (err) {
      setError(extractApiError(err, "Đổi vai trò thất bại. Vui lòng thử lại."));
    } finally {
      setBusyId(null);
    }
  }

  async function onEnterpriseChange(user: AdminUser, rawEnterpriseId: string) {
    const nextEnterpriseId = rawEnterpriseId ? Number(rawEnterpriseId) : null;
    setBusyId(user.userId);
    setError(null);
    try {
      const up = await assignUserEnterprise(user.userId, nextEnterpriseId);
      setUsers((prev) => prev.map((u) => (u.userId === up.userId ? up : u)));
      const targetName = nextEnterpriseId
        ? enterprises.find((e) => e.enterpriseId === nextEnterpriseId)?.name ?? `#${nextEnterpriseId}`
        : null;
      setSuccessMsg(
        targetName
          ? `Đã phân ${user.fullName} vào ${targetName}.`
          : `Đã gỡ ${user.fullName} khỏi doanh nghiệp.`,
      );
    } catch (err) {
      setError(extractApiError(err, "Cập nhật doanh nghiệp cho tài khoản thất bại."));
    } finally {
      setBusyId(null);
    }
  }

  async function onRemoveFromSelectedEnterprise(user: AdminUser) {
    if (!selectedEnterprise) return;
    setBusyId(user.userId);
    setError(null);
    try {
      const up = await removeUserFromEnterprise(selectedEnterprise.enterpriseId, user.userId);
      setUsers((prev) => prev.map((u) => (u.userId === up.userId ? up : u)));
      setSuccessMsg(`Đã gỡ ${user.fullName} khỏi ${selectedEnterprise.name}.`);
    } catch (err) {
      setError(extractApiError(err, "Không thể gỡ tài khoản khỏi doanh nghiệp."));
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleLock(user: AdminUser) {
    const nextActive = user.status !== "ACTIVE";
    setBusyId(user.userId);
    setError(null);
    try {
      const up = await changeStatus(user.userId, nextActive);
      setUsers((prev) => prev.map((u) => (u.userId === up.userId ? up : u)));
      setSuccessMsg(
        nextActive
          ? `Đã mở khóa tài khoản ${user.fullName}.`
          : `Đã khóa tài khoản ${user.fullName}.`,
      );
    } catch (err) {
      setError(extractApiError(err, "Cập nhật trạng thái thất bại. Vui lòng thử lại."));
    } finally {
      setBusyId(null);
    }
  }

  function openApproveModal(user: AdminUser) {
    setApproveTarget(user);
    setApproveRole(roleOf(user) || "DEVELOPER");
    const defaultEnt =
      user.enterpriseId ??
      selectedEnterprise?.enterpriseId ??
      enterprises[0]?.enterpriseId ??
      null;
    setApproveEnterpriseId(defaultEnt ? String(defaultEnt) : "");
  }

  async function handleConfirmApprove() {
    if (!approveTarget) return;
    setApproving(true);
    setError(null);
    try {
      const up = await approveUser(approveTarget.userId, {
        role: approveRole,
        enterpriseId: approveEnterpriseId ? Number(approveEnterpriseId) : null,
      });
      setUsers((prev) => prev.map((u) => (u.userId === up.userId ? up : u)));
      setSuccessMsg(
        `Đã phê duyệt tài khoản ${up.fullName} (${roleLabel(roleOf(up))}${up.enterpriseName ? ` · ${up.enterpriseName}` : ""}).`,
      );
      setApproveTarget(null);
    } catch (err) {
      setError(extractApiError(err, "Phê duyệt tài khoản thất bại. Vui lòng thử lại."));
    } finally {
      setApproving(false);
    }
  }

  async function handleConfirmReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    setError(null);
    try {
      const up = await rejectUser(rejectTarget.userId, rejectReason);
      setUsers((prev) => prev.map((u) => (u.userId === up.userId ? up : u)));
      setSuccessMsg(`Đã từ chối yêu cầu đăng ký của ${up.fullName}.`);
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      setError(extractApiError(err, "Từ chối tài khoản thất bại. Vui lòng thử lại."));
    } finally {
      setRejecting(false);
    }
  }

  function openCreateUserModal() {
    setCreateError(null);
    setCreateForm({
      fullName: "",
      email: "",
      password: "",
      role: "DEVELOPER",
      avatarUrl: "",
      enterpriseId: selectedEnterprise ? String(selectedEnterprise.enterpriseId) : "",
    });
    setShowCreateModal(true);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await createUser({
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        avatarUrl: createForm.avatarUrl.trim() || undefined,
        enterpriseId: createForm.enterpriseId ? Number(createForm.enterpriseId) : null,
      });
      setShowCreateModal(false);
      setSuccessMsg("Tạo tài khoản người dùng mới thành công!");
      await load();
    } catch (err) {
      setCreateError(extractApiError(err, "Không thể tạo tài khoản. Vui lòng thử lại."));
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
        setResetSuccessNotice(
          `Đã cấp lại mật khẩu thành công cho ${resetTargetReq.email}: ${newPasswordInput.trim()}`,
        );
      } else if (resetTargetUser) {
        await directResetPassword(resetTargetUser.userId, newPasswordInput.trim());
        setResetSuccessNotice(
          `Đã đặt lại mật khẩu thành công cho ${resetTargetUser.email}: ${newPasswordInput.trim()}`,
        );
      }
      setResetTargetReq(null);
      setResetTargetUser(null);
      setNewPasswordInput("");
      await load();
    } catch (err) {
      setError(extractApiError(err, "Cấp lại mật khẩu thất bại."));
    } finally {
      setResetting(false);
    }
  }

  function openCreateEnterpriseModal() {
    setEditingEnterprise(null);
    setEnterpriseNameInput("");
    setEnterpriseModalError(null);
    setEnterpriseModalMode("create");
  }

  function openRenameEnterpriseModal(ent: EnterpriseItem) {
    setEditingEnterprise(ent);
    setEnterpriseNameInput(ent.name);
    setEnterpriseModalError(null);
    setEnterpriseModalMode("rename");
  }

  async function handleSaveEnterprise(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = enterpriseNameInput.trim();
    if (!trimmed) {
      setEnterpriseModalError("Vui lòng nhập tên doanh nghiệp.");
      return;
    }
    setEnterpriseSaving(true);
    setEnterpriseModalError(null);
    try {
      if (enterpriseModalMode === "create") {
        const created = await createEnterprise(trimmed);
        setEnterprises((prev) => [...prev, created]);
        setEnterpriseFilter(created.enterpriseId);
        setSuccessMsg(`Đã tạo doanh nghiệp "${created.name}".`);
      } else if (enterpriseModalMode === "rename" && editingEnterprise) {
        const updated = await updateEnterprise(editingEnterprise.enterpriseId, trimmed);
        setEnterprises((prev) =>
          prev.map((ent) => (ent.enterpriseId === updated.enterpriseId ? updated : ent)),
        );
        setUsers((prev) =>
          prev.map((u) =>
            u.enterpriseId === updated.enterpriseId ? { ...u, enterpriseName: updated.name } : u,
          ),
        );
        setSuccessMsg(`Đã đổi tên doanh nghiệp thành "${updated.name}".`);
      }
      notifyEnterprisesChanged();
      setEnterpriseModalMode(null);
      setEditingEnterprise(null);
    } catch (err) {
      setEnterpriseModalError(extractApiError(err, "Không thể lưu thông tin doanh nghiệp."));
    } finally {
      setEnterpriseSaving(false);
    }
  }

  function openDeleteEnterpriseModal(ent: EnterpriseItem) {
    setDeleteEnterpriseTarget(ent);
    setDeleteNeedsForce(ent.repositoryCount > 0);
    setDeleteEnterpriseError(null);
  }

  async function handleConfirmDeleteEnterprise(force: boolean) {
    if (!deleteEnterpriseTarget) return;
    setDeletingEnterprise(true);
    setDeleteEnterpriseError(null);
    try {
      await deleteEnterprise(deleteEnterpriseTarget.enterpriseId, force);
      if (getAdminEnterpriseScope() === deleteEnterpriseTarget.enterpriseId) {
        setAdminEnterpriseScope(null);
      }
      setEnterpriseFilter("ALL");
      setSuccessMsg(`Đã xóa doanh nghiệp "${deleteEnterpriseTarget.name}".`);
      setDeleteEnterpriseTarget(null);
      setDeleteNeedsForce(false);
      notifyEnterprisesChanged();
      await load();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409 && !force) {
        setDeleteNeedsForce(true);
        setDeleteEnterpriseError(
          extractApiError(
            err,
            "Doanh nghiệp này vẫn còn kho lưu trữ. Xác nhận xóa bắt buộc nếu bạn muốn xóa kèm toàn bộ dữ liệu.",
          ),
        );
      } else {
        setDeleteEnterpriseError(extractApiError(err, "Không thể xóa doanh nghiệp."));
      }
    } finally {
      setDeletingEnterprise(false);
    }
  }

  function openBulkAddModal(ent: EnterpriseItem) {
    setAddUsersEnterprise(ent);
    setBulkSearch("");
    setBulkOnlyUnassigned(true);
    setBulkSelectedIds([]);
  }

  function toggleBulkUser(userId: number) {
    setBulkSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  async function handleConfirmBulkAdd() {
    if (!addUsersEnterprise || bulkSelectedIds.length === 0) return;
    setBulkAssigning(true);
    setError(null);
    try {
      const updatedList = await assignUsersToEnterprise(
        addUsersEnterprise.enterpriseId,
        bulkSelectedIds,
      );
      const updatedMap = new Map(updatedList.map((u) => [u.userId, u]));
      setUsers((prev) => prev.map((u) => updatedMap.get(u.userId) ?? u));
      setSuccessMsg(
        `Đã thêm ${bulkSelectedIds.length} tài khoản vào ${addUsersEnterprise.name}.`,
      );
      setAddUsersEnterprise(null);
      setBulkSelectedIds([]);
      notifyEnterprisesChanged();
    } catch (err) {
      setError(extractApiError(err, "Không thể thêm tài khoản vào doanh nghiệp."));
    } finally {
      setBulkAssigning(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Quản trị người dùng &amp; Doanh nghiệp
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Phê duyệt tài khoản đăng ký mới, phân nhóm theo doanh nghiệp độc lập dữ liệu và quản lý vai trò hệ thống.
            </p>
          </div>
          {!forbidden && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={openCreateEnterpriseModal}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <Plus size={15} /> Tạo doanh nghiệp
              </button>
              <button
                type="button"
                onClick={openCreateUserModal}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <UserPlus size={16} /> Thêm người dùng
              </button>
            </div>
          )}
        </div>

        {/* 403 Guard */}
        {forbidden && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">Không có quyền truy cập</p>
              <p className="mt-1 text-amber-800">
                Trang quản trị người dùng và doanh nghiệp chỉ dành cho tài khoản Quản trị viên (ADMIN).
              </p>
            </div>
          </div>
        )}

        {!forbidden && (
          <>
            {/* Notices */}
            {successMsg && (
              <div className="mt-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
                <button type="button" onClick={() => setSuccessMsg(null)}>
                  <X size={16} />
                </button>
              </div>
            )}
            {resetSuccessNotice && (
              <div className="mt-4 flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-blue-600" />
                  <span>{resetSuccessNotice}</span>
                </div>
                <button type="button" onClick={() => setResetSuccessNotice(null)}>
                  <X size={16} />
                </button>
              </div>
            )}
            {error && (
              <div className="mt-4 flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* 5 KPI Cards */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => setStatusTab("ALL")}
                className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Tổng người dùng</p>
                    <p className="text-xl font-bold text-slate-900">{total}</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusTab("PENDING");
                  setEnterpriseFilter("ALL");
                }}
                className={`rounded-lg border p-4 text-left shadow-sm transition ${
                  pendingCount > 0
                    ? "border-amber-300 bg-amber-50/70 ring-1 ring-amber-200 hover:bg-amber-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-800">Chờ xét duyệt</p>
                    <p className="text-xl font-bold text-amber-900">{pendingCount}</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusTab("ACTIVE")}
                className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-600">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Đang hoạt động</p>
                    <p className="text-xl font-bold text-emerald-600">{activeCount}</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusTab(rejectedCount > 0 ? "REJECTED" : "LOCKED")}
                className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-rose-300"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-rose-50 text-rose-600">
                    <UserX size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Từ chối / Bị khóa</p>
                    <p className="text-xl font-bold text-rose-600">
                      {rejectedCount + lockedCount}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {rejectedCount} từ chối · {lockedCount} khóa
                    </p>
                  </div>
                </div>
              </button>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-indigo-50 text-indigo-600">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Doanh nghiệp</p>
                    <p className="text-xl font-bold text-slate-900">{enterprises.length}</p>
                    <p className="text-[11px] text-slate-400">
                      {unassignedCount} chưa phân nhóm
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Danh sách yêu cầu cấp lại mật khẩu đang chờ Admin duyệt */}
            {pendingResetCount > 0 && (
              <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50/40 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900">
                  <KeyRound size={16} /> Yêu cầu cấp lại mật khẩu đang chờ ({pendingResetCount})
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
                            <td className="py-2.5 font-semibold text-slate-900">
                              {req.fullName || "—"}
                            </td>
                            <td className="py-2.5 text-slate-600">{req.email}</td>
                            <td className="py-2.5 text-slate-500">{fmtDate(req.createdAt)}</td>
                            <td className="py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setResetTargetReq(req);
                                  setResetTargetUser(null);
                                  setNewPasswordInput(generateSecurePassword(12));
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

            {/* Status Filter Tabs */}
            <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
              {(
                [
                  { id: "ALL", label: "Tất cả", count: total, badgeClass: "bg-slate-100 text-slate-700" },
                  {
                    id: "PENDING",
                    label: "Chờ xét duyệt",
                    count: pendingCount,
                    badgeClass:
                      pendingCount > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600",
                  },
                  { id: "ACTIVE", label: "Hoạt động", count: activeCount, badgeClass: "bg-emerald-100 text-emerald-700" },
                  {
                    id: "REJECTED",
                    label: "Đã từ chối",
                    count: rejectedCount,
                    badgeClass:
                      rejectedCount > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
                  },
                  { id: "LOCKED", label: "Bị khóa", count: lockedCount, badgeClass: "bg-slate-200 text-slate-700" },
                ] as const
              ).map((tab) => {
                const active = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                        active ? "bg-white/20 text-white" : tab.badgeClass
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Enterprise Grouping Pill Strip */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <Building2 size={14} className="text-emerald-600" /> Doanh nghiệp:
                </span>
                <button
                  type="button"
                  onClick={() => setEnterpriseFilter("ALL")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    enterpriseFilter === "ALL"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Tất cả ({total})
                </button>
                {enterprises.map((ent) => {
                  const active = enterpriseFilter === ent.enterpriseId;
                  const count = memberCountByEnterprise.get(ent.enterpriseId) ?? 0;
                  return (
                    <button
                      key={ent.enterpriseId}
                      type="button"
                      onClick={() => setEnterpriseFilter(ent.enterpriseId)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {ent.name} ({count})
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setEnterpriseFilter("UNASSIGNED")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    enterpriseFilter === "UNASSIGNED"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  Chưa phân doanh nghiệp ({unassignedCount})
                </button>
              </div>

              {/* Contextual Enterprise Action Bar */}
              {selectedEnterprise && (
                <div className="mt-3 flex flex-col gap-2.5 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-bold text-slate-900">{selectedEnterprise.name}</span>
                    {selectedEnterprise.enterpriseId === 1 && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        Mặc định
                      </span>
                    )}
                    <span>
                      · {memberCountByEnterprise.get(selectedEnterprise.enterpriseId) ?? 0} tài khoản
                    </span>
                    <span>· {selectedEnterprise.repositoryCount} kho lưu trữ</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openBulkAddModal(selectedEnterprise)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <UserPlus size={13} /> Thêm tài khoản vào doanh nghiệp
                    </button>
                    <button
                      type="button"
                      onClick={() => openRenameEnterpriseModal(selectedEnterprise)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil size={13} /> Đổi tên
                    </button>
                    {selectedEnterprise.enterpriseId !== 1 && (
                      <button
                        type="button"
                        onClick={() => openDeleteEnterpriseModal(selectedEnterprise)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={13} /> Xóa doanh nghiệp
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Search & Role Filter */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Tìm theo tên, email, GitHub hoặc doanh nghiệp..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Lọc vai trò:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="ALL">Tất cả vai trò</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  title="Tải lại danh sách"
                >
                  <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới
                </button>
              </div>
            </div>

            {/* User Table */}
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[820px] text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Người dùng</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Doanh nghiệp</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        <Loader2 size={18} className="mx-auto mb-2 animate-spin text-emerald-600" />
                        Đang tải danh sách người dùng...
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        Không có tài khoản nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filtered.map((u) => {
                      const r = roleOf(u);
                      const isBusy = busyId === u.userId;
                      const isPending = u.status === "PENDING";
                      const isRejected = u.status === "REJECTED";
                      const isActive = u.status === "ACTIVE";
                      const isLocked = isLockedStatus(u.status);

                      return (
                        <tr key={u.userId} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-300">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={
                                    u.avatarUrl ||
                                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                                      u.email || u.fullName,
                                    )}`
                                  }
                                  alt={u.fullName}
                                  className="size-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src =
                                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                                        u.email || u.fullName,
                                      )}`;
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-slate-900">
                                    {u.fullName}
                                  </span>
                                  {u.githubUsername && (
                                    <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                      @{u.githubUsername}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  Tạo ngày {fmtDate(u.createdAt)}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            <div>{u.email}</div>
                            {isRejected && u.rejectionReason && (
                              <p
                                className="mt-0.5 max-w-[240px] truncate text-[11px] italic text-rose-600"
                                title={u.rejectionReason}
                              >
                                Lý do: {u.rejectionReason}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isPending || isRejected ? (
                              <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                                <Building2 size={12} />
                                {u.enterpriseName || "Chưa phân doanh nghiệp"}
                              </span>
                            ) : (
                              <select
                                value={u.enterpriseId ? String(u.enterpriseId) : ""}
                                disabled={isBusy}
                                onChange={(e) => onEnterpriseChange(u, e.target.value)}
                                className={`max-w-[190px] rounded border px-2 py-1 text-xs font-medium outline-none focus:border-emerald-500 ${
                                  u.enterpriseId
                                    ? "border-slate-300 bg-white text-slate-800"
                                    : "border-amber-200 bg-amber-50/60 text-amber-800"
                                }`}
                              >
                                <option value="">Chưa phân doanh nghiệp</option>
                                {enterprises.map((ent) => (
                                  <option key={ent.enterpriseId} value={String(ent.enterpriseId)}>
                                    {ent.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isPending || isRejected ? (
                              <span
                                className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${
                                  ROLE_BADGE[r] || "border-slate-200 bg-slate-50 text-slate-700"
                                }`}
                              >
                                {roleLabel(r)}
                              </span>
                            ) : (
                              <select
                                value={r}
                                disabled={isBusy}
                                onChange={(e) => onRoleChange(u, e.target.value)}
                                className={`rounded border px-2 py-1 text-xs font-semibold ${
                                  ROLE_BADGE[r] || "border-slate-200 bg-slate-50 text-slate-700"
                                }`}
                              >
                                <optgroup label="Vai trò nghiệp vụ">
                                  {BUSINESS_ROLES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Vai trò hệ thống">
                                  {SYSTEM_ROLES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isActive && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                Hoạt động
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                <span className="size-1.5 rounded-full bg-amber-500" />
                                Chờ xét duyệt
                              </span>
                            )}
                            {isRejected && (
                              <span
                                title={u.rejectionReason || "Yêu cầu đăng ký đã bị từ chối"}
                                className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700"
                              >
                                <span className="size-1.5 rounded-full bg-rose-500" />
                                Đã từ chối
                              </span>
                            )}
                            {isLocked && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                <span className="size-1.5 rounded-full bg-slate-500" />
                                Bị khóa
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => openApproveModal(u)}
                                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    <CheckCircle2 size={13} /> Phê duyệt
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setRejectTarget(u);
                                      setRejectReason("");
                                    }}
                                    className="inline-flex items-center gap-1 rounded border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                                  >
                                    <X size={13} /> Từ chối
                                  </button>
                                </>
                              )}

                              {isRejected && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => openApproveModal(u)}
                                  className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  <RotateCcw size={13} /> Duyệt lại
                                </button>
                              )}

                              {(isActive || isLocked) && (
                                <>
                                  {selectedEnterprise &&
                                    u.enterpriseId === selectedEnterprise.enterpriseId && (
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => onRemoveFromSelectedEnterprise(u)}
                                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-60"
                                        title={`Gỡ khỏi ${selectedEnterprise.name}`}
                                      >
                                        <UserMinus size={13} /> Gỡ
                                      </button>
                                    )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetTargetUser(u);
                                      setResetTargetReq(null);
                                      setNewPasswordInput(generateSecurePassword(12));
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
                                    className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-semibold ${
                                      isActive
                                        ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                                        : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                    }`}
                                  >
                                    {isActive ? <Lock size={13} /> : <Unlock size={13} />}
                                    {isActive ? "Khóa" : "Mở"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Modal: Approve / Re-approve User */}
        {approveTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  {approveTarget.status === "REJECTED"
                    ? "Duyệt lại tài khoản"
                    : "Phê duyệt tài khoản"}
                </h3>
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-sm">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{approveTarget.fullName}</p>
                  <p className="text-xs text-slate-600">{approveTarget.email}</p>
                  {approveTarget.githubUsername && (
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      GitHub: @{approveTarget.githubUsername}
                    </p>
                  )}
                  {approveTarget.status === "REJECTED" && approveTarget.rejectionReason && (
                    <p className="mt-1.5 text-xs italic text-rose-600">
                      Lý do từ chối trước đó: {approveTarget.rejectionReason}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Doanh nghiệp phân công
                  </label>
                  <select
                    value={approveEnterpriseId}
                    onChange={(e) => setApproveEnterpriseId(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="">Chưa phân doanh nghiệp</option>
                    {enterprises.map((ent) => (
                      <option key={ent.enterpriseId} value={String(ent.enterpriseId)}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Vai trò hệ thống
                  </label>
                  <select
                    value={approveRole}
                    onChange={(e) => setApproveRole(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  className="rounded px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={approving}
                  onClick={() => void handleConfirmApprove()}
                  className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {approving ? "Đang phê duyệt..." : "Xác nhận phê duyệt"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Reject User */}
        {rejectTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <UserX size={18} className="text-rose-600" /> Từ chối tài khoản
                </h3>
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  Từ chối yêu cầu đăng ký của{" "}
                  <strong className="text-slate-900">{rejectTarget.fullName}</strong> (
                  {rejectTarget.email})? Bạn vẫn có thể duyệt lại tài khoản này sau trong mục{" "}
                  <strong>Đã từ chối</strong>.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Lý do từ chối (tùy chọn)
                  </label>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ví dụ: Email không thuộc danh sách nhân sự doanh nghiệp..."
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="rounded px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={rejecting}
                  onClick={() => void handleConfirmReject()}
                  className="rounded bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {rejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create / Rename Enterprise */}
        {enterpriseModalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Building2 size={18} className="text-emerald-600" />
                  {enterpriseModalMode === "create"
                    ? "Tạo doanh nghiệp mới"
                    : "Đổi tên doanh nghiệp"}
                </h3>
                <button
                  type="button"
                  onClick={() => setEnterpriseModalMode(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              {enterpriseModalError && (
                <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {enterpriseModalError}
                </div>
              )}

              <form onSubmit={handleSaveEnterprise} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tên doanh nghiệp
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ví dụ: Doanh nghiệp A"
                    value={enterpriseNameInput}
                    onChange={(e) => setEnterpriseNameInput(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setEnterpriseModalMode(null)}
                    className="rounded px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={enterpriseSaving}
                    className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {enterpriseSaving
                      ? "Đang lưu..."
                      : enterpriseModalMode === "create"
                        ? "Tạo doanh nghiệp"
                        : "Lưu tên mới"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Enterprise */}
        {deleteEnterpriseTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <AlertTriangle size={18} className="text-rose-600" /> Xóa doanh nghiệp
                </h3>
                <button
                  type="button"
                  onClick={() => setDeleteEnterpriseTarget(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  Bạn có chắc muốn xóa{" "}
                  <strong className="text-slate-900">{deleteEnterpriseTarget.name}</strong>? Các
                  tài khoản thành viên sẽ được chuyển sang trạng thái{" "}
                  <strong>Chưa phân doanh nghiệp</strong> (không bị xóa tài khoản).
                </p>

                {deleteEnterpriseTarget.repositoryCount > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    Doanh nghiệp này hiện có{" "}
                    <strong>{deleteEnterpriseTarget.repositoryCount} kho lưu trữ</strong>. Nếu chọn
                    xóa bắt buộc, toàn bộ dữ liệu kho lưu trữ và tài liệu thuộc doanh nghiệp này sẽ
                    bị xóa vĩnh viễn.
                  </div>
                )}

                {deleteEnterpriseError && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    {deleteEnterpriseError}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setDeleteEnterpriseTarget(null)}
                  className="rounded px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                {!deleteNeedsForce ? (
                  <button
                    type="button"
                    disabled={deletingEnterprise}
                    onClick={() => void handleConfirmDeleteEnterprise(false)}
                    className="rounded bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {deletingEnterprise ? "Đang xóa..." : "Xóa doanh nghiệp"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={deletingEnterprise}
                    onClick={() => void handleConfirmDeleteEnterprise(true)}
                    className="rounded bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
                  >
                    {deletingEnterprise ? "Đang xóa..." : "Xác nhận xóa bắt buộc"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Bulk Add Accounts to Enterprise */}
        {addUsersEnterprise && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <UserPlus size={18} className="text-emerald-600" /> Thêm tài khoản vào{" "}
                    {addUsersEnterprise.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Chọn các tài khoản cần gán hoặc chuyển sang doanh nghiệp này.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddUsersEnterprise(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      placeholder="Tìm theo tên hoặc email..."
                      className="w-full rounded border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={bulkOnlyUnassigned}
                      onChange={(e) => setBulkOnlyUnassigned(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    Chỉ tài khoản chưa phân DN
                  </label>
                </div>

                <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                  {bulkEligibleUsers.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Không có tài khoản khả dụng phù hợp.
                    </div>
                  ) : (
                    bulkEligibleUsers.map((u) => {
                      const checked = bulkSelectedIds.includes(u.userId);
                      return (
                        <label
                          key={u.userId}
                          className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs transition ${
                            checked ? "bg-emerald-50/70" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBulkUser(u.userId)}
                              className="rounded accent-emerald-600"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{u.fullName}</p>
                              <p className="truncate text-[11px] text-slate-500">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              {roleOf(u)}
                            </span>
                            {u.enterpriseName ? (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                                Từ: {u.enterpriseName}
                              </span>
                            ) : (
                              <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                                Chưa phân DN
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  Đã chọn <strong className="text-slate-900">{bulkSelectedIds.length}</strong> tài
                  khoản
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddUsersEnterprise(null)}
                    className="rounded px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={bulkAssigning || bulkSelectedIds.length === 0}
                    onClick={() => void handleConfirmBulkAdd()}
                    className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {bulkAssigning
                      ? "Đang thêm..."
                      : `Thêm ${bulkSelectedIds.length || ""} tài khoản`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Cấp lại mật khẩu (Admin duyệt) */}
        {(resetTargetUser || resetTargetReq) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <KeyRound size={18} className="text-emerald-600" /> Cấp lại mật khẩu người dùng
                </h3>
                <button
                  type="button"
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
                  Tài khoản:{" "}
                  <strong className="text-slate-900">
                    {resetTargetReq ? resetTargetReq.email : resetTargetUser?.email}
                  </strong>
                </p>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Nhập mật khẩu mới cấp cho người dùng:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Nhập hoặc tạo mật khẩu ngẫu nhiên bảo mật"
                      className="flex-1 rounded border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setNewPasswordInput(generateSecurePassword(12))}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      title="Sinh mật khẩu ngẫu nhiên 12 ký tự (CSPRNG)"
                    >
                      <RefreshCw size={13} /> Tạo ngẫu nhiên
                    </button>
                  </div>
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
                  onClick={() => void handleApproveReset()}
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
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              {createError && (
                <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
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
                  <label className="block text-xs font-semibold text-slate-700">
                    Doanh nghiệp (Tùy chọn)
                  </label>
                  <select
                    value={createForm.enterpriseId}
                    onChange={(e) => setCreateForm({ ...createForm, enterpriseId: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="">Chưa phân doanh nghiệp</option>
                    {enterprises.map((ent) => (
                      <option key={ent.enterpriseId} value={String(ent.enterpriseId)}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Vai trò ban đầu
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Ảnh đại diện (URL Avatar - Tùy chọn)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.png (để trống sẽ tạo tự động)"
                    value={createForm.avatarUrl}
                    onChange={(e) => setCreateForm({ ...createForm, avatarUrl: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
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
                    className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
