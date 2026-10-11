import Image from "next/image";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { VideoBackground } from "@/components/VideoBackground";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12 text-slate-800">
      <VideoBackground overlay="bg-slate-900/80" blur="blur-[4px]" />
      <div className="relative w-full max-w-md">
        {/* Back Link */}
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-200 transition-colors hover:text-emerald-400"
        >
          <ArrowLeft size={14} />
          Quay lại đăng nhập
        </Link>

        {/* Panel — flat surface, phân tách bằng border, bo góc 6px */}
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
              <p className="text-xs font-medium text-slate-500">Khôi phục truy cập</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quên mật khẩu
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Nhập email doanh nghiệp của bạn. Chúng tôi sẽ gửi một liên kết để đặt lại mật khẩu.
          </p>

          <div className="mt-6">
            <ForgotPasswordForm />
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Liên kết đặt lại chỉ có hiệu lực trong 30 phút</span>
          </div>
        </section>

      </div>
    </main>
  );
}
