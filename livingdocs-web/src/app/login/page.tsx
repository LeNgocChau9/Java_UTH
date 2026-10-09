import { AppShell } from "@/components/AppShell";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <AppShell>
      <article className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div>
          <h1 className="font-display text-5xl tracking-[-0.03em] text-paper">
            Đăng nhập
          </h1>
          <p className="mt-5 max-w-[42ch] text-base leading-7 text-slate-300">
            Email và mật khẩu gửi tới backend. Token trả về được giữ trên máy
            này và tự gắn vào các request sau.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-sheet p-6 sm:p-7">
          <LoginForm />
        </div>
      </article>
    </AppShell>
  );
}
