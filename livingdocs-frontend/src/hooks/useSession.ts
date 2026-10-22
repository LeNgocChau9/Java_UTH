"use client";

import { useCallback, useEffect, useState } from "react";
import { ACCESS_TOKEN_KEY } from "@/services/apiClient";
import { logout, readProfile } from "@/services/auth";
import type { UserProfile } from "@/types/auth";
import { rolesFromProfile } from "@/lib/navigation";
import type { AppRole } from "@/types/navigation";

export function useSession() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(window.localStorage.getItem(ACCESS_TOKEN_KEY));
    setUser(readProfile());
    setReady(true);
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
