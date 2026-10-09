"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useSession } from "@/hooks/useSession";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, signedIn, user, roles, clearSession } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-slate-100">
      <Header
        user={ready ? user : null}
        signedIn={ready && signedIn}
        onMenu={() => setMenuOpen(true)}
        onLogout={clearSession}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          roles={ready ? roles : []}
          open={menuOpen}
          onNavigate={() => setMenuOpen(false)}
        />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
