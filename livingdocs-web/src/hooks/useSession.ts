"use client";

import { useCallback, useEffect, useState } from "react";
import { ACCESS_TOKEN_KEY } from "@/services/apiClient";
import { logout } from "@/services/auth";

export function useSession() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(window.localStorage.getItem(ACCESS_TOKEN_KEY));
    setReady(true);
  }, []);

  const clearSession = useCallback(() => {
    logout();
    setToken(null);
  }, []);

  return {
    token,
    ready,
    signedIn: Boolean(token),
    clearSession,
  };
}
