"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Loader2, ShieldAlert } from "lucide-react";
import { VideoBackground } from "@/components/VideoBackground";
import { apiClient, clearAuthStorage, INACTIVE_ACCOUNT_REDIRECT } from "@/services/apiClient";
import { saveProfile, saveToken } from "@/services/authService";
import type { UserProfile } from "@/types/auth";

/** Chỉ cho phép điều hướng nội bộ sau khi đăng nhập; mặc định về /dashboard. */
function safeRedirect(target: string | null): string {
  if (!target) return "/dashboard";
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    // giữ nguyên nếu không decode được
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard";
  return decoded;
}

function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const token = params.get("token");
    const redirect = safeRedirect(params.get("redirect"));
    const oauthError = params.get("error");
    const oauthNotice = params.get("notice");

    if (oauthNotice) {
      router.replace(`/login?notice=${encodeURIComponent(oauthNotice)}`);
      return;
    }

    if (oauthError) {
      router.replace(`/login?error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (!token) {
      router.replace("/login?error=oauth_failed");
      return;
    }

    void (async () => {
      try {
        // Lưu token trước để interceptor tự gắn Authorization cho lời gọi /api/me.
        saveToken(token);
        const { data } = await apiClient.get<UserProfile>("/api/me");
        if (data.status && data.status !== "ACTIVE") {
          clearAuthStorage();
          const target =
            data.status === "PENDING"
              ? "/login?notice=account_pending"
              : data.status === "REJECTED"
                ? "/login?error=account_rejected"
                : "/login?error=account_locked";
          router.replace(target);
          return;
        }
        saveProfile(data);

        const isRenewed = params.get("githubRenewed") === "true";
        if (isRenewed && typeof window !== "undefined") {
          sessionStorage.setItem("livingdocs:github_renew_success", "true");
        }

        router.replace(redirect);
        router.refresh();
      } catch (caught) {
        clearAuthStorage();
        if (axios.isAxiosError(caught)) {
          const payload = caught.response?.data as { errorCode?: string; message?: string } | undefined;
          if (payload?.errorCode && payload.errorCode in INACTIVE_ACCOUNT_REDIRECT) {
            router.replace(INACTIVE_ACCOUNT_REDIRECT[payload.errorCode]);
            return;
          }
          if (typeof payload?.message === "string" && payload.message.trim()) {
            setError(payload.message);
            return;
          }
        }
        setError("Không thể hoàn tất đăng nhập GitHub. Vui lòng thử lại.");
      }
    })();
  }, [params, router]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12 text-slate-800">
      <VideoBackground overlay="bg-slate-900/80" blur="blur-[4px]" />
      <div className="relative w-full max-w-md">
        <section className="rounded-[6px] border border-slate-200 bg-white p-8 text-center">
          {error ? (
            <>
              <div className="mx-auto mb-4 grid size-11 place-items-center rounded-[6px] border border-rose-200 bg-rose-50">
                <ShieldAlert className="size-5 text-rose-600" aria-hidden />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Đăng nhập chưa hoàn tất
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">{error}</p>
              <Link
                href="/login"
                className="mt-5 inline-flex items-center justify-center rounded-[6px] bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Về trang đăng nhập
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 grid size-11 place-items-center rounded-[6px] border border-slate-200 bg-slate-50">
                <Loader2 className="size-5 animate-spin text-emerald-600" aria-hidden />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Đang hoàn tất đăng nhập GitHub…
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">Vui lòng chờ trong giây lát.</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function GitHubCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12 text-slate-800">
          <VideoBackground overlay="bg-slate-900/80" blur="blur-[4px]" />
          <div className="relative w-full max-w-md">
            <section className="rounded-[6px] border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-slate-500">Đang tải…</p>
            </section>
          </div>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
