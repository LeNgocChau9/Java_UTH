import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function HomePage() {
  return (
    <AppShell>
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-balance text-5xl leading-[1.05] tracking-[-0.03em] text-paper sm:text-6xl">
          Bản viết của nhóm, đọc được ngay trên máy.
        </h1>
        <p className="mt-6 max-w-[58ch] text-base leading-7 text-slate-300">
          LivingDocs Web là mặt trước độc lập. Nó giữ phiên JWT, gọi backend
          cổng 8080, và để sẵn chỗ cho tìm kiếm ngữ nghĩa khi tài liệu được
          đưa vào.
        </p>

        <figure className="mt-12 overflow-hidden rounded-2xl border border-line bg-sheet">
          <figcaption className="flex items-center justify-between border-b border-line px-5 py-3 text-xs text-slate-400">
            <span className="font-mono">huong-dan-nhom.md</span>
            <span>bản trên máy</span>
          </figcaption>
          <div className="space-y-4 px-5 py-6 sm:px-8">
            <p className="font-display text-3xl text-paper">Mở dự án trước khi viết.</p>
            <p className="max-w-[62ch] text-sm leading-7 text-slate-300">
              Database chạy trong Docker. Frontend mở ở cổng 3000. Token đăng
              nhập không đi lên Git; mỗi máy tự giữ trong trình duyệt.
            </p>
            <p className="max-w-[62ch] text-sm leading-7 text-slate-300">
              Khi một request bị từ chối với mã 401, interceptor xóa token và
              đưa bạn về trang đăng nhập.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
            <p className="text-sm text-slate-400">Sẵn sàng để đăng nhập.</p>
            <Link
              href="/login"
              className="rounded-md bg-paper px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-white"
            >
              Đăng nhập
            </Link>
          </div>
        </figure>
      </article>
    </AppShell>
  );
}
