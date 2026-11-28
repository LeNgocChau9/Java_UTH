"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { ACCESS_TOKEN_KEY, INACTIVE_ACCOUNT_REDIRECT } from "@/services/apiClient";
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
        if (!data.token || (data.user?.status && data.user.status !== "ACTIVE")) {
          logout();
          setToken(null);
          setUser(null);
          const target =
            data.user?.status === "PENDING"
              ? "/login?notice=account_pending"
              : data.user?.status === "REJECTED"
                ? "/login?error=account_rejected"
                : "/login?error=account_locked";
          window.location.replace(target);
          return;
        }
        setToken(data.token);
        setUser(data.user);
      })
      .catch((err) => {
        if (cancelled) return;
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const errorCode = (err.response?.data as { errorCode?: string } | undefined)?.errorCode;
          if ((status === 401 || status === 403) && errorCode && errorCode in INACTIVE_ACCOUNT_REDIRECT) {
            logout();
            setToken(null);
            setUser(null);
            window.location.replace(INACTIVE_ACCOUNT_REDIRECT[errorCode]);
            return;
          }
        }
        setUser(readProfile());
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
