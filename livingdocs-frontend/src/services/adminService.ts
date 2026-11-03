import { apiClient } from "@/services/apiClient";
import type { AdminUser } from "@/types/auth";

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

/** Lấy danh sách toàn bộ người dùng (chỉ ADMIN). */
export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>("/api/admin/users");
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
}

/** Tạo tài khoản người dùng mới (chỉ ADMIN). */
export async function createUser(input: AdminCreateUserInput): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>("/api/admin/users", input);
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
