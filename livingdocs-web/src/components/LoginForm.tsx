"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { login } from "@/services/authService";

type FieldErrors = {
  email?: string;
  password?: string;
};

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = email.trim();

  if (!trimmed) {
    errors.email = "Vui lòng nhập email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    errors.email = "Email chưa đúng định dạng.";
  }

  if (!password) {
    errors.password = "Vui lòng nhập mật khẩu.";
  }

  return errors;
}

function loginErrorMessage(caught: unknown) {
  if (!axios.isAxiosError(caught)) {
    return "Đăng nhập chưa hoàn tất. Vui lòng thử lại.";
  }

  const message = caught.response?.data?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (caught.response?.status === 401) {
    return "Email hoặc mật khẩu không chính xác.";
  }

  return "Đăng nhập thất bại. Vui lòng thử lại.";
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(initialError ?? null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(email, password);
    setFieldErrors(nextErrors);
    setFormError(null);

    if (nextErrors.email || nextErrors.password) {
      return;
    }

    setPending(true);
    try {
      await login({ email: email.trim(), password });
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      setFormError(loginErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function onGithub() {
    const next = new URLSearchParams(window.location.search).get("next");
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    const query = target ? `?redirect=${encodeURIComponent(target)}` : "";
    window.location.assign(`/api/auth/github${query}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Email doanh nghiệp
        </label>
        <div className="relative">
          <Mail
            aria-hidden
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className="w-full rounded-[6px] border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500"
            placeholder="dev01@company.com"
          />
        </div>
        {fieldErrors.email ? (
          <p id="email-error" className="text-xs font-semibold text-rose-500">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Mật khẩu
          </label>
          <Link
            href="/quen-mat-khau"
            className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole
            aria-hidden
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className="w-full rounded-[6px] border border-slate-300 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-[6px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? (
              <EyeOff aria-hidden strokeWidth={1.75} className="size-4" />
            ) : (
              <Eye aria-hidden strokeWidth={1.75} className="size-4" />
            )}
          </button>
        </div>
        {fieldErrors.password ? (
          <p id="password-error" className="text-xs font-semibold text-rose-500">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      {formError ? (
        <div role="alert" className="rounded-[6px] border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-600">
          {formError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-[6px] bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        {pending ? "Đang xử lý đăng nhập…" : "Đăng nhập hệ thống"}
      </button>

      <div className="relative my-2 text-center">
        <span className="bg-white px-3 text-xs text-slate-400">hoặc</span>
        <div className="absolute inset-y-1/2 inset-x-0 -z-10 border-t border-slate-200" />
      </div>

      <button
        type="button"
        onClick={onGithub}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
      >
        <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
        </svg>
        Đăng nhập với GitHub
      </button>
    </form>
  );
}
