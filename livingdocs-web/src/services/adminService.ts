import { apiClient } from "@/services/apiClient";
import type { AdminUser } from "@/types/auth";

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
