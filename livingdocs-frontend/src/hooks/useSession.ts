"use client";

import { useCallback, useEffect, useState } from "react";
import { ACCESS_TOKEN_KEY } from "@/services/apiClient";
import { logout, readProfile } from "@/services/auth";
import { refreshSession } from "@/services/authService";
import type { UserProfile } from "@/types/auth";
import { rolesFromProfile } from "@/lib/navigation";
import type { AppRole } from "@/types/navigation";

export function useSession() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    setToken(storedToken);
    setUser(readProfile());
    if (!storedToken) {
      setReady(true);
      return;
    }
    let cancelled = false;
    refreshSession()
      .then((data) => {
        if (cancelled) return;
        setToken(data.token);
        setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(readProfile());
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSession = useCallback(() => {
    logout();
    setToken(null);
    setUser(null);
  }, []);

  const roles: AppRole[] = rolesFromProfile(user?.roles);

  return {
    token,
    user,
    roles,
    ready,
    signedIn: Boolean(token),
    clearSession,
  };
}
