"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function AiDocsRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const destination = params ? `/yeu-cau-sinh-tai-lieu?${params}` : "/yeu-cau-sinh-tai-lieu";
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-sm font-semibold text-slate-700">
        Đang chuyển hướng tới trình tạo tài liệu AI với thông tin thực thể...
      </p>
    </div>
  );
}

export default function AiDocsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <AiDocsRedirectContent />
    </Suspense>
  );
}
