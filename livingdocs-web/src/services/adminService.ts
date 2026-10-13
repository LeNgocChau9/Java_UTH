import { apiClient } from "@/services/apiClient";
import type { AdminUser } from "@/types/auth";

/** L?y danh s?ch to?n b? ng??i d?ng (ch? ADMIN). */
export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>("/api/admin/users");
  return data;
}

/** ??i vai tr? cho 1 ng??i d?ng (DEVELOPER | STAFF | MANAGER | TECH_LEAD | ADMIN). */
export async function changeRole(userId: number, role: string): Promise<AdminUser> {
  const { data } = await apiClient.put<AdminUser>(
    `/api/admin/users/${userId}/role`,
    null,
    { params: { role } },
  );
  return data;
}

/** Kh?a (active=false) ho?c m? kh?a (active=true) t?i kho?n. */
export async function changeStatus(userId: number, active: boolean): Promise<AdminUser> {
  const { data } = await apiClient.put<AdminUser>(
    `/api/admin/users/${userId}/status`,
    null,
    { params: { active } },
  );
  return data;
}
