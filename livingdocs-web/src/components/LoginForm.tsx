"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { login } from "@/services/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await login({ email, password });
      router.push("/");
      router.refresh();
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        setError("Email hoặc mật khẩu không đúng.");
      } else if (axios.isAxiosError(caught) && !caught.response) {
        setError("Không kết nối được máy chủ. Kiểm tra backend cổng 8080.");
      } else {
        setError("Đăng nhập chưa xong. Thử lại sau ít phút.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm text-slate-200">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-line bg-ink px-3 py-2.5 text-paper outline-none placeholder:text-slate-500"
          placeholder="ten@nhom.local"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm text-slate-200">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-line bg-ink px-3 py-2.5 text-paper outline-none placeholder:text-slate-500"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
