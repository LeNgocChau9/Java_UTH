"use client";

import { FormEvent, useState } from "react";
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
    errors.email = "Nhập email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    errors.email = "Email chưa đúng định dạng.";
  }

  if (!password) {
    errors.password = "Nhập mật khẩu.";
  }

  return errors;
}

function loginErrorMessage(caught: unknown) {
  if (!axios.isAxiosError(caught)) {
    return "Đăng nhập chưa xong. Thử lại.";
  }

  const message = caught.response?.data?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (caught.response?.status === 401) {
    return "Email hoặc mật khẩu không đúng.";
  }

  return "Không kết nối được backend cổng 8080.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

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
    window.location.assign("/api/auth/github");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm text-slate-200">
          Email
        </label>
        <div className="relative">
          <Mail
            aria-hidden
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
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
            className="w-full rounded-md border border-line bg-ink py-2.5 pl-10 pr-3 text-paper outline-none placeholder:text-slate-500"
            placeholder="ten@nhom.local"
          />
        </div>
        {fieldErrors.email ? (
          <p id="email-error" className="text-sm font-medium text-red-400">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm text-slate-200">
          Mật khẩu
        </label>
        <div className="relative">
          <LockKeyhole
            aria-hidden
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
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
            className="w-full rounded-md border border-line bg-ink py-2.5 pl-10 pr-11 text-paper outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-300 hover:text-paper"
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
          <p id="password-error" className="text-sm font-medium text-red-400">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-sm font-medium text-red-400">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>

      <button
        type="button"
        onClick={onGithub}
        className="w-full rounded-md border border-line px-4 py-2.5 text-sm text-slate-200 hover:bg-ink"
      >
        Đăng nhập với GitHub
      </button>
    </form>
  );
}
