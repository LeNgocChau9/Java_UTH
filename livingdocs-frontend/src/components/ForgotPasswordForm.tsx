"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MailCheck, ShieldAlert } from "lucide-react";
import { sendForgotPasswordRequest } from "@/services/adminService";

function validate(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Vui lòng nhập email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Email chưa đúng định dạng.";
  return null;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
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
      await sendForgotPasswordRequest(email.trim(), note.trim() || undefined);
      setSent(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Không thể gửi yêu cầu đến Admin. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  // Trạng thái: đã gửi yêu cầu thành công đến Admin
  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-[6px] border border-emerald-200 bg-emerald-50 text-emerald-600">
          <MailCheck size={22} strokeWidth={1.75} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Đã gửi yêu cầu đến Quản trị viên (Admin)</h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
          Yêu cầu cấp lại mật khẩu cho tài khoản{" "}
          <span className="font-semibold text-slate-900">{email.trim()}</span> đã được chuyển đến tài khoản Admin. Quản trị viên sẽ phê duyệt và cấp lại mật khẩu mới cho bạn.
        </p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail("");
              setNote("");
            }}
            className="w-full cursor-pointer rounded-[6px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Gửi yêu cầu cho email khác
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

  // Trạng thái: nhập email gửi lên Admin
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Email doanh nghiệp cần cấp lại mật khẩu
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
            className="w-full rounded-[6px] border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500"
            placeholder="dev01@company.com"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="note" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Lý do hoặc ghi chú gửi kèm Admin (tùy chọn)
        </label>
        <input
          id="note"
          name="note"
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-[6px] border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500"
          placeholder="Ví dụ: Đổi máy tính mới hoặc quên mật khẩu đăng nhập..."
        />
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
          <ShieldAlert size={14} /> {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-[6px] bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Đang gửi yêu cầu đến Admin..." : "Gửi yêu cầu cấp lại mật khẩu"}
      </button>
    </form>
  );
}
