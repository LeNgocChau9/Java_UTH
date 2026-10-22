"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";

/* ─── Metric Counter Hook ─── */
function useCounterOnView(target: number, duration: number = 1800, decimals: number = 0, from: number = 0) {
  const [count, setCount] = useState(from);
  const [hasStarted, setHasStarted] = useState(false);

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasStarted(true);
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
  }, []);

  useEffect(() => {
    if (!hasStarted) return;
    let start = from;
    const stepTime = 16;
    const totalSteps = duration / stepTime;
    const increment = (target - from) / totalSteps;
    const timer = setInterval(() => {
      start += increment;
      const val = decimals > 0 ? Number(start.toFixed(decimals)) : Math.floor(start);
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(val);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [hasStarted, target, duration, decimals, from]);

  return { count, ref };
}

/* ─── 6 Cột Năng Lực Cốt Lõi (Astroship Features Grid) ─── */
const LIVINGDOCS_FEATURES = [
  {
    title: "Phân tích cú pháp AST đa ngôn ngữ",
    description:
      "Bóc tách cấu trúc mã nguồn toàn diện (Class, Hàm, Interface, Chú thích mã), đảm bảo tài liệu phản ánh chính xác cấu trúc thực tế.",
  },
  {
    title: "Bảo chứng chuỗi băm Hash-Chain",
    description:
      "Mỗi phiên bản gắn liền với mã SHA-256 lồng nhau, tạo cơ chế sổ cái bất biến bảo vệ tài liệu không bị sửa đổi trái phép.",
  },
  {
    title: "Kiểm duyệt 2 lớp: Thẩm định & Phê duyệt",
    description:
      "Quy trình phân quyền rõ ràng: Kỹ thuật viên đối chiếu thẩm định với code thực tế, Trưởng nhóm phê duyệt xuất bản chính thức.",
  },
  {
    title: "Tự động đồng bộ từ Kho lưu trữ GitHub",
    description:
      "Nhận tín hiệu webhook tự động khi có commit hoặc Pull Request mới, kiểm tra sai lệch nội dung và cập nhật tài liệu tức thì.",
  },
  {
    title: "Minh bạch nguồn gốc dữ liệu",
    description:
      "Mỗi mục tài liệu đều đi kèm bằng chứng xác minh: Tên hàm, Commit Hash, liên kết file nguồn và điểm độ tin cậy.",
  },
  {
    title: "Tự động đẩy bản thảo lên Kho lưu trữ",
    description:
      "Sau khi Trưởng nhóm phê duyệt, hệ thống tự động xuất bản tài liệu Markdown chuẩn hóa trực tiếp vào kho dự án.",
  },
];

export default function AstroshipLivingDocsHomePage() {
  const statDocs = useCounterOnView(1420, 1600);
  const statAccuracy = useCounterOnView(98.8, 1600, 1, 80);
  const statAudit = useCounterOnView(100, 1200);
  const statTime = useCounterOnView(70, 1400);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-slate-900 selection:text-white">
      {/* ─── 1. Header / Navbar ─── */}
      <header className="mx-auto max-w-7xl px-5">
        <div className="flex flex-col lg:flex-row justify-between items-center my-6 gap-4">
          <div className="flex w-full lg:w-auto items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
              <Image src="/logo.png" alt="LivingDocs Logo" width={28} height={28} className="rounded object-contain" />
              <span>Living<span className="text-slate-500">Docs</span></span>
            </Link>
          </div>

          <nav className="flex items-center gap-6 text-sm text-slate-600 font-medium">
            <a href="#features" className="hover:text-slate-900 transition-colors">Tính năng</a>
            <Link href="/yeu-cau-sinh-tai-lieu" className="hover:text-slate-900 transition-colors">Tạo tài liệu AI</Link>
            <Link href="/hang-doi-xem-xet" className="hover:text-slate-900 transition-colors">Hàng đợi Thẩm định</Link>
            <Link href="/trung-tam-phe-duyet" className="hover:text-slate-900 transition-colors">Trung tâm Phê duyệt</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/login"
              className="rounded-full text-center transition focus-visible:ring-2 ring-offset-2 ring-gray-200 px-5 py-2 bg-[#111111] !text-white hover:bg-slate-800 border-2 border-transparent text-sm font-semibold inline-block"
              style={{ color: "#ffffff" }}
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </header>

      {/* ─── 2. Hero Section chuẩn bố cục Astroship (2 cột: Trái tiêu đề, Phải ảnh Hero) ─── */}
      <main className="mx-auto max-w-7xl px-5">
        <section className="grid lg:grid-cols-2 place-items-center pt-12 pb-16 md:pt-16 md:pb-24 gap-8">
          {/* Cột trái: Tiêu đề */}
          <div>
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold lg:tracking-tight xl:tracking-tighter text-slate-900 leading-[1.1]">
              Tài liệu kỹ thuật đồng bộ theo code
            </h1>
          </div>

          {/* Cột phải: Hình ảnh minh họa Hero Astroship */}
          <div className="py-6 flex justify-center w-full">
            <div className="relative w-full max-w-[540px] aspect-[4/3] flex items-center justify-center">
              <Image
                src="/hero.png"
                alt="LivingDocs System Illustration"
                width={540}
                height={405}
                priority
                className="object-contain drop-shadow-sm select-none"
              />
            </div>
          </div>
        </section>

        {/* ─── 3. Stats Section — Các chỉ số ấn tượng ─── */}
        <section className="py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center md:text-left" ref={statDocs.ref as React.Ref<HTMLDivElement>}>
              <div className="font-mono text-4xl font-bold text-slate-900 tracking-tight">
                {statDocs.count}+
              </div>
              <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-500">Tài liệu đã tạo</p>
            </div>

            <div className="text-center md:text-left" ref={statAccuracy.ref as React.Ref<HTMLDivElement>}>
              <div className="font-mono text-4xl font-bold text-slate-900 tracking-tight">
                {statAccuracy.count}%
              </div>
              <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-500">Độ chuẩn xác AST</p>
            </div>

            <div className="text-center md:text-left" ref={statAudit.ref as React.Ref<HTMLDivElement>}>
              <div className="font-mono text-4xl font-bold text-slate-900 tracking-tight">
                {statAudit.count}%
              </div>
              <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-500">Bất biến Hash-Chain</p>
            </div>

            <div className="text-center md:text-left" ref={statTime.ref as React.Ref<HTMLDivElement>}>
              <div className="font-mono text-4xl font-bold text-slate-900 tracking-tight">
                -{statTime.count}%
              </div>
              <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-500">Thời gian biên soạn</p>
            </div>
          </div>
        </section>

        {/* ─── 4. Features Grid — 6 Cột Tính Năng ─── */}
        <section id="features" className="py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              Mọi tính năng cần thiết cho tài liệu doanh nghiệp
            </h2>
            <p className="text-slate-500 mt-4 text-base md:text-lg">
              LivingDocs kết hợp chặt chẽ giữa trình phân tích mã nguồn, mô hình ngôn ngữ lớn và cơ chế lưu trữ chuỗi băm để tạo nên quy trình tài liệu chuẩn mực.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {LIVINGDOCS_FEATURES.map((item) => {
              return (
                <div key={item.title} className="flex gap-4 items-start group">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900">{item.title}</h3>
                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── 5. Call-to-Action Card chuẩn Astroship (Hộp nền đen, bo góc, căn giữa) ─── */}
        <section className="py-12 md:py-20">
          <div className="bg-black p-8 md:px-20 md:py-20 mx-auto max-w-5xl rounded-2xl flex flex-col items-center text-center">
            <h2 className="text-white text-3xl md:text-5xl font-bold tracking-tight">
              Bắt đầu chuẩn hóa tài liệu dự án ngay hôm nay.
            </h2>
            <p className="text-slate-400 mt-4 text-base md:text-lg max-w-xl leading-relaxed">
              Kết nối kho lưu trữ GitHub của nhóm, tự động tạo tài liệu từ mã nguồn và trải nghiệm luồng thẩm định hai lớp chuyên nghiệp.
            </p>
            <div className="flex flex-wrap gap-4 mt-8 justify-center">
              <Link
                href="/yeu-cau-sinh-tai-lieu"
                className="rounded-full px-7 py-3.5 bg-white !text-black hover:bg-slate-100 font-semibold text-sm transition-all inline-block"
                style={{ color: "#000000" }}
              >
                Tạo tài liệu bằng AI
              </Link>
              <Link
                href="/login"
                className="rounded-full px-7 py-3.5 bg-transparent border-2 border-white !text-white hover:bg-white/10 font-semibold text-sm transition-all inline-block"
                style={{ color: "#ffffff" }}
              >
                Đăng nhập hệ thống
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ─── 6. Footer chuẩn Astroship ─── */}
      <footer className="my-16 border-t border-slate-100 pt-8">
        <div className="mx-auto max-w-7xl px-5 text-center text-sm text-slate-500">
          <p>
            Copyright © {new Date().getFullYear()} LivingDocs. Hệ thống tài liệu kỹ thuật sống động đồng bộ mã nguồn GitHub.
          </p>
          <div className="flex justify-center gap-6 mt-4 text-xs font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-black">Dashboard</Link>
            <Link href="/yeu-cau-sinh-tai-lieu" className="hover:text-black">Tạo tài liệu AI</Link>
            <Link href="/hang-doi-xem-xet" className="hover:text-black">Hàng đợi Thẩm định</Link>
            <Link href="/trung-tam-phe-duyet" className="hover:text-black">Trung tâm Phê duyệt</Link>
            <a
              href="https://github.com/LeNgocChau9/Java_UTH"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-black"
            >
              GitHub <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
