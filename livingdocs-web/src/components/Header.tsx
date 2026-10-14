"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, Menu } from "lucide-react";
import { BellIcon } from "@/components/navIcons";
import type { UserProfile } from "@/types/auth";

function initials(user: UserProfile | null) {
  const source = user?.fullName?.trim() || user?.email || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "LD";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Header({
  user,
  signedIn,
  onMenu,
  onLogout,
}: {
  user: UserProfile | null;
  signedIn: boolean;
  onMenu: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const [noticesOpen, setNoticesOpen] = useState(false);

  function logout() {
    onLogout();
    setNoticesOpen(false);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#e4eae6] bg-white/95 px-3 backdrop-blur-sm sm:px-5">
      <button
        type="button"
        onClick={onMenu}
        className="grid size-10 place-items-center rounded-md text-[#526158] hover:bg-[#f2f6f3] lg:hidden"
        aria-label="Mở menu"
      >
        <Menu aria-hidden strokeWidth={1.75} className="size-5" />
      </button>

      <Link href="/" className="flex min-w-0 items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-[#b8dec5] bg-[#eaf6ef] text-[#087f5b]">
          <BookOpen aria-hidden strokeWidth={1.75} className="size-4" />
        </span>
        <span className="truncate font-display text-2xl tracking-[-0.03em] text-[#17231c]">
          LivingDocs
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <div className="relative">
          <button
            type="button"
            aria-label="Thông báo"
            aria-expanded={noticesOpen}
            onClick={() => setNoticesOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-md text-[#526158] hover:bg-[#f2f6f3]"
          >
            <BellIcon className="size-4" />
          </button>
          {noticesOpen ? (
            <p className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-[#e4eae6] bg-white px-3 py-3 text-sm text-[#526158] shadow-lg">
              Chưa có thông báo mới.
            </p>
          ) : null}
        </div>

        <span
          className="grid size-9 place-items-center overflow-hidden rounded-full border border-[#e4eae6] bg-[#f2f6f3] text-xs font-medium text-[#17231c]"
          aria-label={user?.fullName ? `Ảnh đại diện ${user.fullName}` : "Ảnh đại diện"}
        >
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(user)
          )}
        </span>

        {signedIn ? (
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-10 items-center gap-2 rounded-md px-2 text-sm text-[#526158] hover:bg-[#f2f6f3] sm:px-3"
          >
            <LogOut aria-hidden strokeWidth={1.75} className="size-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-[#087f5b] hover:bg-[#eaf6ef]"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
