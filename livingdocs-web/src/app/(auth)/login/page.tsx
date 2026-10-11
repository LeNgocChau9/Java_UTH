import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { VideoBackground } from "@/components/VideoBackground";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12 text-slate-800">
      <VideoBackground overlay="bg-slate-900/80" blur="blur-[4px]" />
      <div className="relative w-full max-w-md">
        {/* Back Link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-200 transition-colors hover:text-emerald-400"
        >
          <ArrowLeft size={14} />
          Quay lại trang chủ
        </Link>

        {/* Login Panel — flat surface, phân tách bằng border, bo góc 6px */}
        <section className="rounded-[6px] border border-slate-200 bg-white p-8">
          <div className="mb-6 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="LivingDocs"
              width={42}
              height={42}
              className="rounded-[6px] object-contain"
            />
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Living<span className="text-emerald-600">Docs</span>
              </span>
              <p className="text-xs font-medium text-slate-500">Cổng xác thực kỹ thuật</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Đăng nhập hệ thống
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Nhập tài khoản doanh nghiệp được cấp để truy cập vào không gian làm việc.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Xác thực an toàn với JWT &amp; GitHub OAuth2</span>
          </div>
        </section>

      </div>
    </main>
  );
}
