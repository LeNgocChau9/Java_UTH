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
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-ink/95 px-3 backdrop-blur-sm sm:px-5">
      <button
        type="button"
        onClick={onMenu}
        className="grid size-10 place-items-center rounded-md text-slate-200 hover:bg-sheet lg:hidden"
        aria-label="Mở menu"
      >
        <Menu aria-hidden strokeWidth={1.75} className="size-5" />
      </button>

      <Link href="/" className="flex min-w-0 items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-sheet text-sand">
          <BookOpen aria-hidden strokeWidth={1.75} className="size-4" />
        </span>
        <span className="truncate font-display text-2xl tracking-[-0.03em] text-paper">
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
            className="grid size-10 place-items-center rounded-md text-slate-200 hover:bg-sheet"
          >
            <BellIcon className="size-4" />
          </button>
          {noticesOpen ? (
            <p className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-line bg-sheet px-3 py-3 text-sm text-slate-300">
              Chưa có thông báo mới.
            </p>
          ) : null}
        </div>

        <span
          className="grid size-9 place-items-center overflow-hidden rounded-full border border-line bg-sheet text-xs font-medium text-paper"
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
            className="inline-flex h-10 items-center gap-2 rounded-md px-2 text-sm text-slate-200 hover:bg-sheet sm:px-3"
          >
            <LogOut aria-hidden strokeWidth={1.75} className="size-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-md px-3 text-sm text-sand hover:bg-sheet"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
