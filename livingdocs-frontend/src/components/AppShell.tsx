"use client";

function formatDob(dateStr?: string | null): string {
  if (!dateStr) return "17/08/2006";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${d}/${m}/${y}`;
  }
  return trimmed;
}


import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Mail,
  ShieldCheck,
  Hash,
  Eye,
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
  ShieldAlert,
  KeyRound,
  RefreshCw,
  UserCog,
  Check,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useRouter } from "next/navigation";
import { refreshSession, updateCurrentUserProfile } from "@/services/authService";

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

  // Modal cảnh báo hết phiên & gia hạn quyền
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [extendingSession, setExtendingSession] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  useEffect(() => {
    const onSessionExpired = () => {
      setShowSessionModal(true);
      setExtendError(null);
    };
    window.addEventListener("livingdocs:session_expired", onSessionExpired);
    return () => {
      window.removeEventListener("livingdocs:session_expired", onSessionExpired);
    };
  }, []);

  const handleExtendSession = async () => {
    try {
      setExtendingSession(true);
      setExtendError(null);
      await refreshSession();
      setShowSessionModal(false);
      window.location.reload();
    } catch {
      // Nếu không gia hạn được ngầm (ví dụ token cũ/GitHub OAuth cần cấp lại), chuyển hướng đăng nhập lại GitHub để lấy token tươi mới
      const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/dashboard";
      window.location.assign(`/api/auth/github?redirect=${encodeURIComponent(currentPath)}`);
    } finally {
      setExtendingSession(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ld_project_banner");
      if (saved) setBannerUrl(saved);
    }
  }, []);

  // Modal xem chi tiết hồ sơ người dùng
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string>("/project-cover.png");

  // Modal đổi thông tin cá nhân & mật khẩu
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileDob, setProfileDob] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileFullName, setProfileFullName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileOldPassword, setProfileOldPassword] = useState("");
  const [profileNewPassword, setProfileNewPassword] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  const openProfileModal = () => {
    setProfileFullName(user?.fullName || "");
    setProfileAvatarUrl(user?.avatarUrl || "");
    const savedDob = typeof window !== "undefined" ? localStorage.getItem("ld_user_dob_" + (user?.userId || "me")) : "";
    const savedBio = typeof window !== "undefined" ? localStorage.getItem("ld_user_bio_" + (user?.userId || "me")) : "";
    setProfileDob(user?.dateOfBirth || savedDob || "2006-08-17");
    setProfileBio(user?.bio || savedBio || "");
    setProfileOldPassword("");
    setProfileNewPassword("");
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    setShowProfileModal(true);
    setUserMenuOpen(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingProfile(true);
      setProfileErrorMsg(null);
      setProfileSuccessMsg(null);

      if (typeof window !== "undefined") {
        if (profileDob) localStorage.setItem("ld_user_dob_" + (user?.userId || "me"), profileDob);
        if (profileBio) localStorage.setItem("ld_user_bio_" + (user?.userId || "me"), profileBio);
      }
      await updateCurrentUserProfile({
        fullName: profileFullName.trim() || undefined,
        avatarUrl: profileAvatarUrl.trim() || undefined,
        dateOfBirth: profileDob || undefined,
        bio: profileBio || undefined,
        oldPassword: profileOldPassword || undefined,
        newPassword: profileNewPassword || undefined,
      });

      setProfileSuccessMsg("Đã cập nhật thông tin thành công!");
      setTimeout(() => {
        setShowProfileModal(false);
        window.location.reload();
      }, 900);
    } catch (err: any) {
      setProfileErrorMsg(err.response?.data?.message || "Cập nhật thất bại. Vui lòng kiểm tra lại mật khẩu cũ!");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleLogout = useCallback(() => {
    clearSession();
    setUserMenuOpen(false);
    setShowSessionModal(false);
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
            onClick={() => setShowDetailModal(true)}
            title="Nhấn để xem thông tin cá nhân chi tiết"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 8px",
              borderRadius: 8,
              cursor: "pointer",
            }}
            className="hover:bg-white transition-all duration-200 border border-transparent hover:border-[#cbd5e1] hover:shadow-xs group"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
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
            )}
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
                    onClick={() => { setShowDetailModal(true); setNotifOpen(false); setUserMenuOpen(false); }}
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
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt="Avatar"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
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
                    )}
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

                        {/* Thông tin liên kết GitHub */}
                        <div
                          style={{
                            marginTop: 10,
                            padding: "8px 10px",
                            borderRadius: 6,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                              Tài khoản GitHub
                            </span>
                            {user?.githubUsername ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#047857" }}>
                                @{user.githubUsername}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>Chưa liên kết</span>
                            )}
                          </div>
                          <a
                            href="/api/auth/github?redirect=/dashboard"
                            className="ld-btn ld-btn-secondary w-full"
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              height: 26,
                              justifyContent: "center",
                              marginTop: 4,
                            }}
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            {user?.githubUsername ? "Đổi tài khoản GitHub" : "Liên kết GitHub"}
                          </a>
                        </div>
                      </div>
                      <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                        <button
                          type="button"
                          onClick={() => { setShowDetailModal(true); setUserMenuOpen(false); }}
                          className="ld-btn ld-btn-ghost w-full"
                          style={{
                            justifyContent: "flex-start",
                            gap: 8,
                            paddingLeft: 10,
                            fontSize: 13,
                            color: "#087f5b",
                            fontWeight: 600,
                          }}
                        >
                          <Eye size={14} className="text-[#087f5b]" />
                          Xem thông tin cá nhân
                        </button>
                        <button
                          type="button"
                          onClick={openProfileModal}
                          className="ld-btn ld-btn-ghost w-full"
                          style={{
                            justifyContent: "flex-start",
                            gap: 8,
                            paddingLeft: 10,
                            fontSize: 13,
                            color: "#334155",
                          }}
                        >
                          <UserCog size={14} className="text-[#059669]" />
                          Cài đặt tài khoản
                        </button>
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

      {/* ═══ MODAL CẢNH BÁO HẾT PHIÊN & GIA HẠN QUYỀN ═══ */}
      {showSessionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="ld-card"
            style={{
              maxWidth: 440,
              width: "100%",
              padding: 24,
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #bbf7d0",
              background: "#ffffff",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#fef3c7",
                  color: "#d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Phiên làm việc đã hết hạn
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                  Bảo mật tài khoản LivingDocs
                </p>
              </div>
            </div>

            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, marginBottom: 20 }}>
              Phiên đăng nhập của bạn vừa hết hiệu lực bảo mật. Bạn có muốn <strong>kéo dài phiên làm việc và cấp thêm quyền</strong> để tiếp tục thao tác mà không bị mất dữ liệu không?
            </p>

            {extendError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                {extendError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleLogout}
                className="ld-btn ld-btn-secondary"
                style={{ fontSize: 13, padding: "8px 16px" }}
              >
                <LogOut size={14} />
                Đăng xuất
              </button>
              <button
                type="button"
                onClick={handleExtendSession}
                disabled={extendingSession}
                className="ld-btn ld-btn-primary"
                style={{ fontSize: 13, padding: "8px 18px", gap: 6 }}
              >
                {extendingSession ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Đang gia hạn...
                  </>
                ) : (
                  <>
                    <KeyRound size={14} />
                    Gia hạn phiên & Cấp quyền
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ═══ MODAL XEM CHI TIẾT HỒ SƠ NGƯỜI DÙNG (CARD HIỆN ĐẠI) ═══ */}
      {showDetailModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="ld-card"
            style={{
              maxWidth: 460,
              width: "100%",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              animation: "fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Banner Header with Project LivingDocs Cover - Căn giữa 100% rõ nét */}
            <div
              style={{
                position: "relative",
                backgroundColor: "#ffffff",
                padding: "24px 20px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="ld-btn ld-btn-ghost transition-all hover:scale-105"
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  padding: 0,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(15, 23, 42, 0.08)",
                  color: "#334155",
                }}
              >
                <X size={16} />
              </button>

              {/* Logo & Tên dự án LivingDocs trọn vẹn, không bị che khuất */}
              <img
                src={bannerUrl || "/project-cover.png"}
                alt="LivingDocs Project"
                style={{
                  width: "100%",
                  maxWidth: 260,
                  height: "auto",
                  maxHeight: 140,
                  objectFit: "contain",
                  display: "block",
                  margin: "0 auto",
                }}
              />
            </div>

            {/* Profile Avatar & Primary Info */}
            <div style={{ padding: "18px 24px 24px", position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: "50%",
                    border: "3px solid #10b981",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                    overflow: "hidden",
                    background: "#ecfdf5",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName || "Avatar"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: 26, fontWeight: 800, color: "#087f5b" }}>
                      {initials}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      openProfileModal();
                    }}
                    className="ld-btn ld-btn-primary"
                    style={{
                      fontSize: 12,
                      padding: "7px 16px",
                      borderRadius: 10,
                      gap: 6,
                    }}
                  >
                    <UserCog size={13} />
                    Chỉnh sửa
                  </button>
                </div>
              </div>

              {/* Name & Badge Role */}
              <div style={{ marginBottom: 18 }}>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#0f172a",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {user?.fullName || "Người dùng"}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 10px",
                      borderRadius: 9999,
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      color: "#047857",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                  >
                    <ShieldCheck size={13} />
                    {roles[0]?.replace("ROLE_", "") || "DEVELOPER"}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 9999,
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      color: "#475569",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle size={12} className="text-[#10b981]" />
                    {user?.status || "ACTIVE"}
                  </span>
                </div>
              </div>

              {/* Bio if exists */}
              {(user?.bio || (typeof window !== "undefined" && localStorage.getItem("ld_user_bio_" + (user?.userId || "me")))) && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    color: "#475569",
                    lineHeight: 1.5,
                    marginBottom: 16,
                    fontStyle: "italic",
                  }}
                >
                  &ldquo;{user?.bio || (typeof window !== "undefined" ? localStorage.getItem("ld_user_bio_" + (user?.userId || "me")) : "")}&rdquo;
                </div>
              )}

              {/* Detailed Info Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 10,
                  padding: 14,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                {/* Email */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#e0f2fe",
                      color: "#0284c7",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Mail size={15} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, display: "block" }}>
                      Địa chỉ Email
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#0f172a",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "block",
                      }}
                    >
                      {user?.email || "Chưa cập nhật"}
                    </span>
                  </div>
                </div>

                {/* Date of Birth */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#fef3c7",
                      color: "#d97706",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Calendar size={15} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, display: "block" }}>
                      Ngày tháng năm sinh
                    </span>
                    <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
                      {formatDob(
                        user?.dateOfBirth ||
                        (typeof window !== "undefined"
                          ? localStorage.getItem("ld_user_dob_" + (user?.userId || "me"))
                          : null)
                      )}
                    </span>
                  </div>
                </div>

                {/* GitHub */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#f1f5f9",
                      color: "#334155",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, display: "block" }}>
                      Tài khoản GitHub
                    </span>
                    <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
                      {user?.githubUsername ? `@${user.githubUsername}` : "Chưa liên kết"}
                    </span>
                  </div>
                </div>

                {/* User ID / Created Date */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#f3e8ff",
                      color: "#9333ea",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={15} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, display: "block" }}>
                      Tham gia hệ thống
                    </span>
                    <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
                      10/10/2026
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="ld-btn ld-btn-secondary w-full"
                  style={{
                    fontSize: 13,
                    padding: "8px 16px",
                    borderRadius: 10,
                    justifyContent: "center",
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL ĐỔI THÔNG TIN CÁ NHÂN & MẬT KHẨU ═══ */}
      {showProfileModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="ld-card"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 24,
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#ecfdf5",
                    color: "#059669",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserCog size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Cập nhật tài khoản
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                    Thay đổi tên, ảnh đại diện và mật khẩu cá nhân
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="ld-btn ld-btn-ghost"
                style={{ padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {profileSuccessMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                  fontSize: 13,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Check size={16} />
                {profileSuccessMsg}
              </div>
            )}

            {profileErrorMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {profileErrorMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={profileFullName}
                  onChange={(e) => setProfileFullName(e.target.value)}
                  placeholder="Nhập họ và tên của bạn"
                  className="ld-input w-full"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  URL Ảnh đại diện (Avatar)
                </label>
                <input
                  type="url"
                  value={profileAvatarUrl}
                  onChange={(e) => setProfileAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="ld-input w-full"
                />
                <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, display: "block" }}>
                  Dán đường dẫn ảnh trực tiếp (PNG, JPG, WebP)
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Ngày tháng năm sinh
                </label>
                <input
                  type="date"
                  value={profileDob}
                  onChange={(e) => setProfileDob(e.target.value)}
                  className="ld-input w-full"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Tiểu sử ngắn / Giới thiệu
                </label>
                <textarea
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Giới thiệu đôi nét về bản thân..."
                  className="ld-input w-full resize-none"
                  rows={2}
                />
              </div>

              <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", display: "block", marginBottom: 8 }}>
                  Đổi mật khẩu (Bỏ trống nếu không muốn đổi)
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#475569", marginBottom: 4 }}>
                      Mật khẩu hiện tại
                    </label>
                    <input
                      type="password"
                      value={profileOldPassword}
                      onChange={(e) => setProfileOldPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang dùng"
                      className="ld-input w-full"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#475569", marginBottom: 4 }}>
                      Mật khẩu mới (tối thiểu 6 ký tự)
                    </label>
                    <input
                      type="password"
                      value={profileNewPassword}
                      onChange={(e) => setProfileNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới"
                      className="ld-input w-full"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="ld-btn ld-btn-secondary"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="ld-btn ld-btn-primary"
                  style={{ fontSize: 13, padding: "8px 18px", gap: 6 }}
                >
                  {updatingProfile ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
