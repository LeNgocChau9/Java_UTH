"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";

function validate(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Vui lòng nhập email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Email chưa đúng định dạng.";
  return null;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validate(email);
    setError(nextError);
    if (nextError) return;

    setPending(true);
    try {
      // TODO(backend): thay bằng API thật khi endpoint đặt lại mật khẩu được triển khai.
      // Ví dụ: await apiClient.post("/api/auth/forgot-password", { email: email.trim() });
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSent(true);
    } catch {
      setError("Không thể gửi yêu cầu. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  // Trạng thái: đã gửi link khôi phục thành công
  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-[6px] border border-emerald-200 bg-emerald-50 text-emerald-600">
          <MailCheck size={22} strokeWidth={1.75} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Kiểm tra hộp thư của bạn</h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
          Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu tới{" "}
          <span className="font-semibold text-slate-900">{email.trim()}</span>. Vui lòng kiểm tra cả thư
          mục spam nếu không thấy email trong vài phút tới.
        </p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="w-full cursor-pointer rounded-[6px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Gửi lại với email khác
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
          >
            <ArrowLeft size={14} /> Quay lại đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  // Trạng thái: nhập email
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
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "forgot-email-error" : undefined}
            className="w-full rounded-[6px] border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500"
            placeholder="dev01@company.com"
          />
        </div>
        {error ? (
          <p id="forgot-email-error" className="text-xs font-semibold text-rose-500">
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-[6px] bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        {pending ? "Đang gửi…" : "Gửi liên kết đặt lại"}
      </button>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition-colors hover:text-emerald-600"
        >
          <ArrowLeft size={14} /> Quay lại đăng nhập
        </Link>
      </div>
    </form>
  );
}
