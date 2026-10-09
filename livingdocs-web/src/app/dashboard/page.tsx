"use client";

import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";

export default function DashboardPage() {
  const { ready, user, roles, signedIn } = useSession();
  const name = user?.fullName || user?.email || "bạn";

  return (
    <AppShell>
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl tracking-[-0.03em] text-paper sm:text-5xl">
          Dashboard
        </h1>
        <p className="mt-5 max-w-[58ch] text-base leading-7 text-slate-300">
          {!ready
            ? "Đang mở phiên đăng nhập."
            : signedIn
              ? `${name} đã vào. Menu bên trái theo vai trò ${roles.join(", ") || "chưa gán"}.`
              : "Chưa có phiên. Đăng nhập để vào Dashboard."}
        </p>
      </article>
    </AppShell>
  );
}
