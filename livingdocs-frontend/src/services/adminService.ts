import { apiClient } from "@/services/apiClient";
import type { AdminUser, EnterpriseItem } from "@/types/auth";

export interface PasswordResetRequestItem {
  requestId: number;
  userId: number;
  email: string;
  fullName: string;
  status: "PENDING" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string | null;
  newPasswordTemp?: string | null;
}

export interface ListUsersParams {
  status?: string;
  enterpriseId?: number;
  unassigned?: boolean;
}

/** Lấy danh sách người dùng (chỉ ADMIN), hỗ trợ lọc tùy chọn. */
export async function listUsers(params?: ListUsersParams): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>("/api/admin/users", { params });
  return data;
}

/** Đổi vai trò cho 1 người dùng (DEVELOPER | STAFF | MANAGER | TECH_LEAD | ADMIN). */
export async function changeRole(userId: number, role: string): Promise<AdminUser> {
  const { data } = await apiClient.put<AdminUser>(
    `/api/admin/users/${userId}/role`,
    null,
    { params: { role } },
  );
  return data;
}

/** Khóa (active=false) hoặc mở khóa (active=true) tài khoản. */
export async function changeStatus(userId: number, active: boolean): Promise<AdminUser> {
  const { data } = await apiClient.put<AdminUser>(
    `/api/admin/users/${userId}/status`,
    null,
    { params: { active } },
  );
  return data;
}

export interface AdminCreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role?: string;
  avatarUrl?: string;
  enterpriseId?: number | null;
}

/** Tạo tài khoản người dùng mới (chỉ ADMIN, ACTIVE ngay). */
export async function createUser(input: AdminCreateUserInput): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>("/api/admin/users", input);
  return data;
}

/** Phê duyệt tài khoản PENDING hoặc duyệt lại tài khoản REJECTED. */
export async function approveUser(
  userId: number,
  payload?: { enterpriseId?: number | null; role?: string },
): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>(
    `/api/admin/users/${userId}/approve`,
    payload ?? {},
  );
  return data;
}

/** Từ chối yêu cầu đăng ký tài khoản PENDING. */
export async function rejectUser(userId: number, reason?: string): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>(
    `/api/admin/users/${userId}/reject`,
    reason?.trim() ? { reason: reason.trim() } : {},
  );
  return data;
}

/** Gán, chuyển hoặc gỡ doanh nghiệp cho 1 tài khoản (enterpriseId = null để gỡ). */
export async function assignUserEnterprise(
  userId: number,
  enterpriseId: number | null,
): Promise<AdminUser> {
  const { data } = await apiClient.put<AdminUser>(
    `/api/admin/users/${userId}/enterprise`,
    { enterpriseId },
  );
  return data;
}

/** Lấy danh sách doanh nghiệp (chỉ ADMIN). */
export async function listEnterprises(): Promise<EnterpriseItem[]> {
  const { data } = await apiClient.get<EnterpriseItem[]>("/api/admin/enterprises");
  return data;
}

/** Tạo doanh nghiệp mới. */
export async function createEnterprise(name: string): Promise<EnterpriseItem> {
  const { data } = await apiClient.post<EnterpriseItem>("/api/admin/enterprises", { name });
  return data;
}

/** Đổi tên doanh nghiệp. */
export async function updateEnterprise(
  enterpriseId: number,
  name: string,
): Promise<EnterpriseItem> {
  const { data } = await apiClient.put<EnterpriseItem>(
    `/api/admin/enterprises/${enterpriseId}`,
    { name },
  );
  return data;
}

/** Xóa doanh nghiệp (force=false sẽ trả 409 nếu doanh nghiệp còn repository). */
export async function deleteEnterprise(
  enterpriseId: number,
  force = false,
): Promise<{ status?: string; message?: string; enterpriseId?: number }> {
  const { data } = await apiClient.delete<{
    status?: string;
    message?: string;
    enterpriseId?: number;
  }>(`/api/admin/enterprises/${enterpriseId}`, {
    params: { force },
  });
  return data;
}

/** Gán/chuyển nhiều tài khoản vào 1 doanh nghiệp. */
export async function assignUsersToEnterprise(
  enterpriseId: number,
  userIds: number[],
): Promise<AdminUser[]> {
  const { data } = await apiClient.post<AdminUser[]>(
    `/api/admin/enterprises/${enterpriseId}/users`,
    { userIds },
  );
  return data;
}

/** Gỡ 1 tài khoản khỏi doanh nghiệp. */
export async function removeUserFromEnterprise(
  enterpriseId: number,
  userId: number,
): Promise<AdminUser> {
  const { data } = await apiClient.delete<AdminUser>(
    `/api/admin/enterprises/${enterpriseId}/users/${userId}`,
  );
  return data;
}

/** Gửi yêu cầu quên mật khẩu đến quyền Admin */
export async function sendForgotPasswordRequest(email: string, note?: string): Promise<PasswordResetRequestItem> {
  const { data } = await apiClient.post<PasswordResetRequestItem>("/api/auth/forgot-password", {
    email,
    note,
  });
  return data;
}

/** Admin xem danh sách các yêu cầu cấp lại mật khẩu */
export async function listPasswordResetRequests(): Promise<PasswordResetRequestItem[]> {
  const { data } = await apiClient.get<PasswordResetRequestItem[]>("/api/admin/users/password-reset-requests");
  return data;
}

/** Admin cấp lại mật khẩu mới cho yêu cầu của người dùng */
export async function approvePasswordReset(requestId: number, newPassword: string): Promise<PasswordResetRequestItem> {
  const { data } = await apiClient.post<PasswordResetRequestItem>(
    `/api/admin/users/password-reset-requests/${requestId}/approve`,
    { newPassword }
  );
  return data;
}

/** Admin trực tiếp đặt lại mật khẩu cho bất kỳ tài khoản nào */
export async function directResetPassword(userId: number, newPassword: string): Promise<AdminUser> {
  const { data } = await apiClient.put<AdminUser>(
    `/api/admin/users/${userId}/reset-password`,
    { newPassword }
  );
  return data;
}
