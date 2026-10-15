"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Archive,
  FileText,
  Sparkles,
  AlertTriangle,
  Inbox,
  Clock,
  CheckCircle,
  Scroll,
  BarChart2,
  LayoutTemplate,
  GitFork,
  Users,
  Settings,
  Activity,
  ChevronDown,
  ChevronRight,
  LogOut,
  Bell,
  Menu,
  X,
  User,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useRouter } from "next/navigation";

type AppRole = "DEVELOPER" | "STAFF" | "MANAGER" | "TECH_LEAD" | "ADMIN";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: AppRole[];
  children?: { href: string; label: string }[];
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tổng quan",
    icon: <LayoutDashboard size={16} />,
    roles: ["DEVELOPER", "STAFF", "MANAGER", "TECH_LEAD", "ADMIN"],
  },
  {
    href: "/kho-luu-tru",
    label: "Kho lưu trữ",
    icon: <Archive size={16} />,
    roles: ["DEVELOPER"],
    children: [
      { href: "/kho-luu-tru", label: "Tất cả tài liệu" },
      { href: "/kho-luu-tru/theo-du-an", label: "Theo dự án" },
    ],
  },
  {
    href: "/tai-lieu-cua-toi",
    label: "Tài liệu của tôi",
    icon: <FileText size={16} />,
    roles: ["DEVELOPER"],
  },
  {
    href: "/cay-ma-nguon",
    label: "Cây mã nguồn & AST",
    icon: <GitFork size={16} />,
    roles: ["DEVELOPER", "TECH_LEAD"],
  },
  {
    href: "/yeu-cau-sinh-tai-lieu",
    label: "Sinh tài liệu AI",
    icon: <Sparkles size={16} />,
    roles: ["DEVELOPER"],
  },
  {
    href: "/canh-bao-sai-lech",
    label: "Cảnh báo sai lệch",
    icon: <AlertTriangle size={16} />,
    roles: ["DEVELOPER"],
  },
  {
    href: "/hang-doi-xem-xet",
    label: "Hàng đợi xem xét",
    icon: <Inbox size={16} />,
    roles: ["STAFF"],
  },
  {
    href: "/lich-su-xem-xet",
    label: "Lịch sử xem xét",
    icon: <Clock size={16} />,
    roles: ["STAFF"],
  },
  {
    href: "/trung-tam-phe-duyet",
    label: "Phê duyệt tài liệu",
    icon: <CheckCircle size={16} />,
    roles: ["MANAGER"],
  },
  {
    href: "/chinh-sach-phe-duyet",
    label: "Chính sách phê duyệt",
    icon: <Scroll size={16} />,
    roles: ["MANAGER"],
  },
  {
    href: "/dashboard-chat-luong",
    label: "Dashboard chất lượng",
    icon: <BarChart2 size={16} />,
    roles: ["TECH_LEAD"],
  },
  {
    href: "/quan-ly-template",
    label: "Quản lý Template",
    icon: <LayoutTemplate size={16} />,
    roles: ["TECH_LEAD"],
  },
  {
    href: "/do-thi-lien-ket",
    label: "Đồ thị liên kết",
    icon: <GitFork size={16} />,
    roles: ["TECH_LEAD"],
  },
  {
    href: "/quan-tri-nguoi-dung",
    label: "Người dùng",
    icon: <Users size={16} />,
    roles: ["ADMIN"],
  },
  {
    href: "/cai-dat-he-thong",
    label: "Cài đặt hệ thống",
    icon: <Settings size={16} />,
    roles: ["ADMIN"],
  },
  {
    href: "/giam-sat-suc-khoe",
    label: "Giám sát hệ thống",
    icon: <Activity size={16} />,
    roles: ["ADMIN"],
  },
];

function SidebarNavItem({
  item,
  currentPath,
}: {
  item: NavItem;
  currentPath: string;
}) {
  const isActive =
    currentPath === item.href ||
    (item.children?.some((c) => c.href === currentPath) ?? false);
  const hasChildren = item.children && item.children.length > 0;
  const [open, setOpen] = useState(isActive);

  const baseClass =
    "flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-[8px] w-full transition-all duration-150 cursor-pointer select-none";
  const activeClass = "bg-[#eaf6ef] text-[#07543f] font-semibold border border-[#b8dec5]";
  const inactiveClass = "text-[#475569] hover:bg-[#edf5ef] hover:text-[#17231c]";

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${baseClass} ${isActive ? activeClass : inactiveClass} justify-between`}
        >
          <span className="flex items-center gap-2.5">
            {item.icon}
            {item.label}
          </span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {open && (
          <div className="ml-[22px] mt-1 border-l-2 border-[#e2e8f0] pl-2.5 space-y-1">
            {item.children!.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={`block px-2.5 py-1.5 text-[13px] rounded-[6px] transition-colors ${
                  currentPath === child.href
                    ? "text-[#07543f] font-semibold bg-[#eaf6ef]"
                    : "text-[#64748b] hover:text-[#17231c] hover:bg-[#edf5ef]"
                }`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.href} className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}>
      {item.icon}
      {item.label}
    </Link>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, signedIn, user, roles, clearSession } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = useCallback(() => {
    clearSession();
    setUserMenuOpen(false);
    router.push("/login");
  }, [clearSession, router]);

  const roleSet = new Set(roles as AppRole[]);

  const sections: { title: string; role: AppRole; items: NavItem[] }[] = [
    {
      title: "Developer",
      role: "DEVELOPER",
      items: NAV.filter((n) => n.roles.includes("DEVELOPER") && n.href !== "/dashboard"),
    },
    {
      title: "Staff",
      role: "STAFF",
      items: NAV.filter((n) => n.roles.includes("STAFF") && !n.roles.includes("DEVELOPER")),
    },
    {
      title: "Manager",
      role: "MANAGER",
      items: NAV.filter((n) => n.roles.includes("MANAGER") && !n.roles.includes("STAFF")),
    },
    {
      title: "Tech Lead",
      role: "TECH_LEAD",
      items: NAV.filter((n) => n.roles.includes("TECH_LEAD") && !n.roles.includes("MANAGER")),
    },
    {
      title: "Admin",
      role: "ADMIN",
      items: NAV.filter((n) => n.roles.includes("ADMIN") && !n.roles.includes("TECH_LEAD")),
    },
  ];

  const dashboardItem = NAV.find((n) => n.href === "/dashboard")!;

  const initials = (() => {
    const src = user?.fullName?.trim() || user?.email || "";
    const parts = src.split(/\s+/).filter(Boolean);
    if (!parts.length) return "LD";
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  })();

  const Sidebar = (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      {/* Brand Header */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 18px",
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <Image
          src="/logo.png"
          alt="LivingDoc Logo"
          width={32}
          height={32}
          className="rounded-lg object-contain shadow-xs"
        />
        <div className="flex flex-col">
          <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", lineHeight: 1.1 }}>
            Living<span style={{ color: "#087f5b" }}>Docs</span>
          </span>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>AI Documentation</span>
        </div>
      </Link>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {ready && signedIn && (
          <div style={{ marginBottom: 6 }}>
            <SidebarNavItem item={dashboardItem} currentPath={pathname} />
          </div>
        )}

        {sections.map((section) => {
          if (!roleSet.has(section.role)) return null;
          if (!section.items.length) return null;
          return (
            <SidebarSection key={section.role} title={section.title}>
              {section.items.map((item) => (
                <SidebarNavItem key={item.href} item={item} currentPath={pathname} />
              ))}
            </SidebarSection>
          );
        })}

        {ready && !signedIn && (
          <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center my-4">
            <p style={{ fontSize: 13, color: "#475569", fontWeight: 500, marginBottom: 10 }}>
              Khám phá đầy đủ tính năng khi đăng nhập
            </p>
            <Link
              href="/login"
              className="ld-btn ld-btn-primary w-full text-[13px] py-1.5"
            >
              Đăng nhập ngay
            </Link>
          </div>
        )}
      </nav>

      {/* User footer */}
      {ready && signedIn && (
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            padding: "12px",
            background: "#f8fafc",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 8px",
              borderRadius: 8,
              cursor: "pointer",
            }}
            className="hover:bg-white transition-colors border border-transparent hover:border-[#e2e8f0]"
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#059669",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  margin: 0,
                }}
              >
                {user?.fullName || user?.email || "Người dùng"}
              </p>
              <p style={{ fontSize: 11, color: "#087f5b", fontWeight: 600, margin: 0 }}>
                {roles[0]?.replace("ROLE_", "") || ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="ld-btn ld-btn-ghost w-full mt-2 text-[13px]"
            style={{ justifyContent: "flex-start", gap: 8, paddingLeft: 8, color: "#ef4444" }}
          >
            <LogOut size={14} />
            Đăng xuất
          </button>
        </div>
      )}
    </aside>
  );

  return (
    <div className="ld-app-shell" style={{ display: "flex", height: "100dvh", overflow: "hidden" }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex" style={{ height: "100%" }}>
        {Sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 50,
              display: "flex",
            }}
          >
            {Sidebar}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              style={{
                position: "absolute",
                top: 12,
                right: -40,
                width: 32,
                height: 32,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top header bar */}
        <header
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 12,
            borderBottom: "1px solid #e2e8f0",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden ld-btn ld-btn-ghost"
            style={{ padding: "6px" }}
          >
            <Menu size={18} />
          </button>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={26} height={26} className="rounded-md" />
            <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
              Living<span style={{ color: "#087f5b" }}>Docs</span>
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Top navigation links when not signed in */}
          {!signedIn && (
            <div className="hidden md:flex items-center gap-6 mr-4 text-[13px] font-semibold text-[#475569]">
              <Link href="/" className="hover:text-[#087f5b] transition-colors">
                Trang chủ
              </Link>
              <Link href="#tinh-nang" className="hover:text-[#087f5b] transition-colors">
                Tính năng
              </Link>
              <Link href="#quy-trinh" className="hover:text-[#087f5b] transition-colors">
                Quy trình Review
              </Link>
            </div>
          )}

          {/* Notifications */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => { setNotifOpen((v) => !v); setUserMenuOpen(false); }}
              className="ld-btn ld-btn-ghost"
              style={{ padding: "6px 10px", position: "relative", borderRadius: 8 }}
              aria-label="Thông báo"
            >
              <Bell size={17} />
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  width: 7,
                  height: 7,
                  background: "#087f5b",
                  borderRadius: "50%",
                  border: "2px solid #ffffff",
                }}
              />
            </button>

            {notifOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 320,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Thông báo hệ thống
                  </p>
                </div>
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                    Hệ thống LivingDocs đã đồng bộ với kho code mới nhất.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* User profile / Login button */}
          {ready && (
            <div style={{ position: "relative" }}>
              {signedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen((v) => !v); setNotifOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 8px 4px 4px",
                      borderRadius: 20,
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#087f5b",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#ffffff",
                      }}
                    >
                      {initials}
                    </div>
                    <span className="text-[13px] font-semibold text-[#0f172a] hidden sm:inline">
                      {user?.fullName?.split(" ").slice(-1)[0] || "Tài khoản"}
                    </span>
                    <ChevronDown size={14} className="text-[#64748b]" />
                  </button>

                  {userMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        width: 220,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
                        zIndex: 50,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                          {user?.fullName || "Người dùng"}
                        </p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                          {user?.email}
                        </p>
                      </div>
                      <div style={{ padding: 6 }}>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="ld-btn ld-btn-ghost w-full"
                          style={{
                            justifyContent: "flex-start",
                            gap: 8,
                            paddingLeft: 10,
                            fontSize: 13,
                            color: "#ef4444",
                          }}
                        >
                          <LogOut size={14} />
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href="/login"
                  className="ld-btn ld-btn-primary ld-btn-sm"
                  style={{ borderRadius: 6, fontWeight: 600 }}
                >
                  <User size={14} />
                  Đăng nhập
                </Link>
              )}
            </div>
          )}
        </header>

        {/* Page content */}
        <main
          className="ld-app-content"
          style={{
            flex: 1,
            overflowY: "auto",
          }}
          onClick={() => { setNotifOpen(false); setUserMenuOpen(false); }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
