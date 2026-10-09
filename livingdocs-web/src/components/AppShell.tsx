"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSession } from "@/hooks/useSession";

const links = [
  { href: "/", label: "Bản đọc", icon: FileText },
  { href: "/login", label: "Đăng nhập", icon: LogIn },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, signedIn, clearSession } = useSession();

  return (
    <div className="min-h-dvh bg-ink text-slate-100 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-line bg-ink px-5 py-6 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <Link href="/" className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 place-items-center rounded-md border border-line bg-sheet text-sand">
            <BookOpen aria-hidden strokeWidth={1.75} className="size-4" />
          </span>
          <span>
            <span className="block font-display text-2xl leading-none tracking-[-0.03em] text-paper">
              LivingDocs
            </span>
            <span className="mt-2 block text-sm leading-5 text-slate-400">
              Tài liệu sống cho cả nhóm.
            </span>
          </span>
        </Link>

        <nav className="mt-10 flex gap-2 lg:flex-col" aria-label="Chính">
          {links.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-sheet hover:text-paper",
                  active && "bg-sheet text-paper",
                )}
              >
                <Icon aria-hidden strokeWidth={1.75} className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-line pt-5 lg:mt-auto">
          <p className="text-sm text-slate-200">
            {!ready
              ? "Đang đọc phiên…"
              : signedIn
                ? "JWT đang nằm trên máy này."
                : "Chưa có phiên đăng nhập."}
          </p>
          {signedIn ? (
            <button
              type="button"
              onClick={clearSession}
              className="mt-3 inline-flex items-center gap-2 text-sm text-sand underline decoration-line underline-offset-4 hover:text-paper"
            >
              <LogOut aria-hidden strokeWidth={1.75} className="size-4" />
              Xóa token
            </button>
          ) : (
            <Link
              href="/login"
              className="mt-3 inline-flex text-sm text-sand underline decoration-line underline-offset-4 hover:text-paper"
            >
              Vào trang đăng nhập
            </Link>
          )}
        </div>
      </aside>

      <div className="relative min-w-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(215,196,163,0.14),transparent_68%)]"
        />
        <main className="relative px-6 py-10 sm:px-10 sm:py-14">{children}</main>
      </div>
    </div>
  );
}
