import type { AppRole, NavItem } from "@/types/navigation";
import { APP_ROLES } from "@/types/navigation";

export const NAV_ITEMS: NavItem[] = [
  { role: "DEVELOPER", href: "/nhat-ky-thay-doi", label: "Nhật ký thay đổi", icon: "history" },
  { role: "DEVELOPER", href: "/kho-luu-tru", label: "Kho lưu trữ", icon: "archive" },
  { role: "DEVELOPER", href: "/tai-lieu-cua-toi", label: "Tài liệu của tôi", icon: "files" },
  { role: "DEVELOPER", href: "/cay-ma-nguon", label: "Cây mã nguồn & AST", icon: "tree" },
  { role: "DEVELOPER", href: "/canh-bao-sai-lech", label: "Cảnh báo sai lệch", icon: "alert" },
  { role: "STAFF", href: "/nhat-ky-thay-doi", label: "Nhật ký thay đổi", icon: "history" },
  { role: "STAFF", href: "/hang-doi-xem-xet", label: "Hàng đợi xem xét tài liệu", icon: "inbox" },
  { role: "STAFF", href: "/lich-su-xem-xet", label: "Lịch sử xem xét", icon: "history" },
  { role: "MANAGER", href: "/nhat-ky-thay-doi", label: "Nhật ký thay đổi", icon: "history" },
  { role: "MANAGER", href: "/trung-tam-phe-duyet", label: "Trung tâm phê duyệt tài liệu", icon: "check" },
  { role: "MANAGER", href: "/chinh-sach-phe-duyet", label: "Chính sách phê duyệt", icon: "scroll" },
  { role: "TECH_LEAD", href: "/nhat-ky-thay-doi", label: "Nhật ký thay đổi", icon: "history" },
  { role: "TECH_LEAD", href: "/dashboard-chat-luong", label: "Dashboard chất lượng", icon: "gauge" },
  { role: "TECH_LEAD", href: "/quan-ly-template", label: "Quản lý Template", icon: "template" },
  { role: "TECH_LEAD", href: "/do-thi-lien-ket", label: "Đồ thị liên kết", icon: "graph" },
  { role: "ADMIN", href: "/nhat-ky-thay-doi", label: "Nhật ký thay đổi", icon: "history" },
  { role: "ADMIN", href: "/quan-tri-nguoi-dung", label: "Quản trị người dùng", icon: "users" },
  { role: "ADMIN", href: "/cai-dat-he-thong", label: "Cài đặt hệ thống", icon: "settings" },
  { role: "ADMIN", href: "/giam-sat-suc-khoe", label: "Giám sát sức khỏe", icon: "activity" },
];

export function normalizeRole(value: string): AppRole | null {
  const clean = value.trim().toUpperCase().replace(/^ROLE_/, "");
  return APP_ROLES.find((role) => role === clean) ?? null;
}

export function rolesFromProfile(roles: string[] | undefined): AppRole[] {
  const found = new Set<AppRole>();
  for (const role of roles ?? []) {
    const normalized = normalizeRole(role);
    if (normalized) {
      found.add(normalized);
    }
  }
  return APP_ROLES.filter((role) => found.has(role));
}

export function navItemsForRoles(roles: AppRole[]) {
  const allowed = new Set(roles);
  const items = NAV_ITEMS.filter((item) => allowed.has(item.role));
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

export function navItemByHref(href: string) {
  return NAV_ITEMS.find((item) => item.href === href) ?? null;
}
