"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { navItemsForRoles } from "@/lib/navigation";
import type { AppRole } from "@/types/navigation";
import { NavIcon } from "@/components/navIcons";

export function Sidebar({
  roles,
  open,
  onNavigate,
}: {
  roles: AppRole[];
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const items = navItemsForRoles(roles);

  return (
    <>
      <button
        type="button"
        aria-label="Đóng menu"
        onClick={onNavigate}
        className={cn(
          "fixed inset-0 z-30 bg-ink/70 lg:hidden",
          open ? "block" : "hidden",
        )}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[min(18rem,85vw)] flex-col border-r border-line bg-ink px-4 py-5 transition-transform lg:static lg:z-0 lg:w-72 lg:shrink-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <p className="px-2 text-sm text-slate-400">
          {items.length === 0
            ? "Đăng nhập để thấy mục của vai trò."
            : "Mục đúng với quyền đang đăng nhập."}
        </p>
        <nav className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Điều hướng">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2.5 py-2 text-sm leading-5 text-slate-300 hover:bg-sheet hover:text-paper",
                  active && "bg-sheet text-paper",
                )}
              >
                <NavIcon name={item.icon} className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
