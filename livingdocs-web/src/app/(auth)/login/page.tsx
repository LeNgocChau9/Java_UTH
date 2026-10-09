import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-line bg-sheet px-6 py-8 sm:px-8">
        <p className="font-display text-3xl tracking-[-0.03em] text-paper">LivingDocs</p>
        <h1 className="mt-6 font-display text-4xl tracking-[-0.03em] text-paper">
          Đăng nhập
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Dùng tài khoản được cấp. Khi đúng, token được giữ lại và bạn vào
          Dashboard.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
