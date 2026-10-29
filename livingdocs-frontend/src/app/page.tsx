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

/* ─── Scroll Reveal Animation Component ─── */
function RevealOnScroll({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}) {
  const [isVisible, setIsVisible] = useState(false);

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(node);
  }, []);

  const getTransform = () => {
    if (!isVisible) {
      if (direction === "up") return "translate-y-10";
      if (direction === "down") return "-translate-y-10";
      if (direction === "left") return "translate-x-10";
      if (direction === "right") return "-translate-x-10";
      return "";
    }
    return "translate-y-0 translate-x-0";
  };

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out will-change-[transform,opacity] ${
        isVisible ? "opacity-100" : "opacity-0"
      } ${getTransform()} ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Showcase Image with Smart Fallback & Placeholders ─── */
function ShowcaseImage({ src, alt, hint }: { src: string; alt: string; hint: string }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-white/15 bg-black/60 shadow-2xl group transition-all duration-300 hover:border-amber-400/50">
      {!hasError ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-zinc-950/90 to-black border border-dashed border-white/20 rounded-2xl group-hover:border-amber-400/60 transition-colors">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-amber-300 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
          <span className="text-xs uppercase tracking-wider font-semibold text-amber-300 mb-1">
            Khu vực hình ảnh minh họa
          </span>
          <p className="text-sm font-medium text-slate-300 max-w-xs leading-snug">
            {hint}
          </p>
          <span className="mt-3 text-[11px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded border border-white/10">
            Lưu ảnh tại: public{src}
          </span>
        </div>
      )}
    </div>
  );
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

/* ─── Dữ Liệu 3 Khối Đan Xen Chi Tiết (Showcase Alternating Sections) ─── */
const SHOWCASE_SECTIONS = [
  {
    id: 1,
    title: "Xây dựng trên nền tảng kỹ thuật hiện đại",
    subtitle: "Tạo lợi thế cạnh tranh vượt trội bằng cách tích hợp các tiêu chuẩn kiến trúc phần mềm hàng đầu",
    imageSlot: "/showcase-1.jpg",
    imageHint: "Bàn làm việc nhóm công nghệ, nhìn từ trên xuống (flat lay: laptop, tai nghe, cốc cà phê)",
    isImageLeft: true,
    items: [
      {
        title: "Phân tích AST đa ngôn ngữ mạnh mẽ",
        description: "Bóc tách cấu trúc Class, Hàm, Interface và Chú thích mã chính xác từ AST, phản ánh trung thực mã nguồn thực tế.",
      },
      {
        title: "Bảo chứng chuỗi khối Hash-Chain SHA-256",
        description: "Mỗi phiên bản tài liệu gắn liền chuỗi băm lồng nhau, tạo cơ chế sổ cái bất biến chống sửa đổi trái phép.",
      },
      {
        title: "Tương thích cao & Vận hành phân tán",
        description: "Đảm bảo tài liệu và hệ sinh thái vận hành đồng bộ, mượt mà giữa môi trường phát triển và máy chủ doanh nghiệp.",
      },
    ],
  },
  {
    id: 2,
    title: "Cá nhân hóa & Quy trình kiểm duyệt chuẩn hóa",
    subtitle: "Đảm bảo tài liệu thể hiện chuẩn xác phong cách và tiêu chuẩn chất lượng của toàn nhóm dự án",
    imageSlot: "/showcase-2.png",
    imageHint: "Bản vẽ thiết kế kiến trúc phần mềm, sơ đồ mạch blueprint neon công nghệ",
    isImageLeft: false,
    items: [
      {
        title: "Tùy biến mẫu tài liệu (Template) linh hoạt",
        description: "Dễ dàng định hình cấu trúc đề mục theo chuẩn IEEE/ISO, phù hợp với từng ngôn ngữ và quy mô dự án.",
      },
      {
        title: "Quy trình kiểm duyệt 2 lớp chuyên nghiệp",
        description: "Phân tách rõ ràng: Kỹ thuật viên đối chiếu thẩm định code thực tế, Trưởng nhóm phê duyệt xuất bản chính thức.",
      },
      {
        title: "So sánh sai lệch mã nguồn (Git Diff) tức thì",
        description: "Tự động phát hiện chênh lệch giữa phiên bản tài liệu cũ và commit mới nhất, ngăn ngừa sai lệch tài liệu.",
      },
      {
        title: "Tích hợp đa phương tiện & Bằng chứng xác minh",
        description: "Gắn liền Commit Hash, tên file nguồn và điểm tin cậy xác thực rõ ràng cho từng mục tài liệu.",
      },
    ],
  },
  {
    id: 3,
    title: "Thiết kế để thúc đẩy năng suất & độ tin cậy",
    subtitle: "Loại bỏ hoàn toàn gánh nặng biên soạn tài liệu thủ công để nhóm tập trung sáng tạo code",
    imageSlot: "/showcase-3.webp",
    imageHint: "Tượng phi hành gia mini trên bàn làm việc, ánh sáng cinematic hoặc robot AI",
    isImageLeft: true,
    items: [
      {
        title: "Tiết kiệm 70% thời gian biên soạn",
        description: "Google Gemini AI tự động phân tích và sinh tài liệu chuyên sâu từ Git Diff chỉ trong vài giây.",
      },
      {
        title: "Đồng bộ liên tục theo chu kỳ phát triển",
        description: "Nhận webhook tự động từ GitHub, đảm bảo tài liệu luôn đồng bộ với từng commit và Pull Request.",
      },
      {
        title: "Tự động đẩy bản thảo Markdown lên Repository",
        description: "Sau khi phê duyệt, tài liệu Markdown chuẩn hóa được commit trực tiếp vào kho dự án của bạn.",
      },
      {
        title: "Minh bạch lịch sử & Truy vết toàn diện",
        description: "Theo dõi đầy đủ phiên bản thay đổi, ai là người thẩm định và thời điểm phê duyệt chính xác.",
      },
    ],
  },
];

export default function AstroshipLivingDocsHomePage() {
  const statDocs = useCounterOnView(1420, 1600);
  const statAccuracy = useCounterOnView(98.8, 1600, 1, 80);
  const statAudit = useCounterOnView(100, 1200);
  const statTime = useCounterOnView(70, 1400);

  return (
    <div className="mac-cursor-root relative min-h-screen text-slate-100 font-sans antialiased overflow-x-hidden">
      {/* ─── 1. Background Video Không Gian Vũ Trụ (Full-bleed) ─── */}
      <div className="fixed inset-0 w-full h-full -z-20 overflow-hidden bg-black pointer-events-none select-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/background.mp4" type="video/mp4" />
        </video>
      </div>

      {/* ─── Lớp Overlay Đen Sang Trọng (Giữ trọn không gian video, không sài blur) ─── */}
      <div className="fixed inset-0 w-full h-full -z-10 bg-black/80 pointer-events-none" />

      {/* ─── 1. Header / Navbar Cố Định (Fixed Top - Luôn ở yên 1 chỗ khi cuộn trang) ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-black/90 border-b border-white/10 shadow-lg">
        <div className="mx-auto max-w-7xl px-6 py-3.5 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex w-full lg:w-auto items-center justify-between">
            <Link href="/" className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 group">
              <Image src="/logo.png" alt="LivingDocs Logo" width={32} height={32} className="rounded object-contain" />
              <span>Living<span className="transition-colors group-hover:text-amber-300">Docs</span></span>
            </Link>
          </div>

          <nav className="flex items-center gap-1 sm:gap-3 md:gap-5 text-[15px] sm:text-base text-slate-200 font-medium">
            <a
              href="#features"
              className="px-3.5 py-1.5 rounded-lg hover:text-amber-300 hover:bg-white/5 transition-all duration-200"
            >
              Tính năng
            </a>
            <Link
              href="/yeu-cau-sinh-tai-lieu"
              className="px-3.5 py-1.5 rounded-lg hover:text-amber-300 hover:bg-white/5 transition-all duration-200"
            >
              Tạo tài liệu AI
            </Link>
            <Link
              href="/hang-doi-xem-xet"
              className="px-3.5 py-1.5 rounded-lg hover:text-amber-300 hover:bg-white/5 transition-all duration-200"
            >
              Hàng đợi Thẩm định
            </Link>
            <Link
              href="/trung-tam-phe-duyet"
              className="px-3.5 py-1.5 rounded-lg hover:text-amber-300 hover:bg-white/5 transition-all duration-200"
            >
              Trung tâm Phê duyệt
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center text-sm font-semibold text-slate-200 hover:text-amber-300 px-3.5 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/login"
              className="rounded-full text-center transition-all px-6 py-2.5 bg-white text-black hover:bg-amber-300 hover:text-black text-sm font-semibold inline-block hover:scale-105 active:scale-95 duration-200 shadow-md"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </header>

      {/* ─── 2. Hero Section chuẩn bố cục Astroship (Cột Trái Tiêu đề, Cột Phải Ảnh Phi Hành Gia) ─── */}
      <main className="mx-auto max-w-7xl px-5 pt-20 md:pt-24">
        <section className="grid lg:grid-cols-2 place-items-center pt-12 pb-16 md:pt-16 md:pb-24 gap-8">
          {/* Cột trái: Tiêu đề thuần trắng & nút bấm */}
          <RevealOnScroll direction="up" delay={100} className="w-full">
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold lg:tracking-tight xl:tracking-tighter text-white leading-[1.1]">
              Tài liệu kỹ thuật đồng bộ theo code
            </h1>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/yeu-cau-sinh-tai-lieu"
                className="rounded-full px-6 py-3 bg-white text-black hover:bg-amber-300 hover:text-black font-semibold text-sm transition-all hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
              >
                Tạo tài liệu bằng AI
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full px-6 py-3 bg-black/50 border border-white/20 text-white hover:border-amber-400 hover:text-amber-300 font-semibold text-sm transition-all hover:scale-105 active:scale-95"
              >
                Vào Dashboard
              </Link>
            </div>
          </RevealOnScroll>

          {/* Cột phải: Hình ảnh minh họa Hero Phi Hành Gia bồng bềnh trong không gian ─── */}
          <RevealOnScroll direction="up" delay={250} className="w-full">
            <div className="py-6 flex justify-center w-full animate-cosmic-float">
              <div className="relative w-full max-w-[540px] aspect-[4/3] flex items-center justify-center">
                <Image
                  src="/hero.png"
                  alt="LivingDocs System Illustration"
                  width={540}
                  height={405}
                  priority
                  className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)] select-none transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>
          </RevealOnScroll>
        </section>

        {/* ─── 3. Stats Section — Các chỉ số thuần trắng, animation trượt lên khi lướt tới ─── */}
        <RevealOnScroll direction="up" delay={150}>
          <section className="py-12 border-y border-white/10 bg-black/60 rounded-2xl my-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-6">
              <div className="text-center md:text-left group cursor-default" ref={statDocs.ref as React.Ref<HTMLDivElement>}>
                <div className="font-mono text-4xl font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                  {statDocs.count}+
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-400">Tài liệu đã tạo</p>
              </div>

              <div className="text-center md:text-left group cursor-default" ref={statAccuracy.ref as React.Ref<HTMLDivElement>}>
                <div className="font-mono text-4xl font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                  {statAccuracy.count}%
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-400">Độ chuẩn xác AST</p>
              </div>

              <div className="text-center md:text-left group cursor-default" ref={statAudit.ref as React.Ref<HTMLDivElement>}>
                <div className="font-mono text-4xl font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                  {statAudit.count}%
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-400">Bất biến Hash-Chain</p>
              </div>

              <div className="text-center md:text-left group cursor-default" ref={statTime.ref as React.Ref<HTMLDivElement>}>
                <div className="font-mono text-4xl font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                  -{statTime.count}%
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-400">Thời gian biên soạn</p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 4. Features Grid — 6 Cột Tính Năng Nguyên Bản (Animation xuất hiện lần lượt khi cuộn tới) ─── */}
        <section id="features" className="py-16 md:py-24">
          <RevealOnScroll direction="up" delay={100}>
            <div className="max-w-2xl mx-auto text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-white">
                Mọi tính năng cần thiết cho tài liệu doanh nghiệp
              </h2>
              <p className="text-slate-300 mt-4 text-base md:text-lg leading-relaxed">
                LivingDocs kết hợp chặt chẽ giữa trình phân tích mã nguồn, mô hình ngôn ngữ lớn và cơ chế lưu trữ chuỗi băm để tạo nên quy trình tài liệu chuẩn mực.
              </p>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {LIVINGDOCS_FEATURES.map((item, index) => {
              return (
                <RevealOnScroll key={item.title} direction="up" delay={index * 100}>
                  <div className="h-full rounded-xl border border-white/10 bg-black/65 p-6 transition-all duration-300 hover:border-amber-400 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(255,171,61,0.15)] group">
                    <h3 className="font-semibold text-lg text-white group-hover:text-amber-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-slate-300 mt-2 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </RevealOnScroll>
              );
            })}
          </div>
        </section>

        {/* ─── 5. Showcase Alternating Sections — 3 Khối Đan Xen Chi Tiết (Ảnh & Danh Sách Checkmark) ─── */}
        <section className="py-12 md:py-20 space-y-24">
          {SHOWCASE_SECTIONS.map((section) => {
            const isLeft = section.isImageLeft;
            return (
              <div
                key={section.id}
                className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center"
              >
                {/* Cột Ảnh */}
                <div className={`w-full ${isLeft ? "lg:order-1" : "lg:order-2"}`}>
                  <RevealOnScroll direction={isLeft ? "right" : "left"} delay={150}>
                    <ShowcaseImage
                      src={section.imageSlot}
                      alt={section.title}
                      hint={section.imageHint}
                    />
                  </RevealOnScroll>
                </div>

                {/* Cột Nội Dung & Danh sách Checkmark */}
                <div className={`w-full ${isLeft ? "lg:order-2" : "lg:order-1"}`}>
                  <RevealOnScroll direction={isLeft ? "left" : "right"} delay={200}>
                    <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
                      {section.title}
                    </h2>
                    <p className="text-slate-400 mt-3 text-base lg:text-lg leading-relaxed">
                      {section.subtitle}
                    </p>

                    <div className="mt-8 space-y-6">
                      {section.items.map((item, idx) => (
                        <div key={idx} className="group">
                          <h4 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </RevealOnScroll>
                </div>
              </div>
            );
          })}
        </section>

        {/* ─── 6. Call-to-Action Card chuẩn Astroship (Animation xuất hiện khi lướt tới) ─── */}
        <RevealOnScroll direction="up" delay={150}>
          <section className="py-12 md:py-20">
            <div className="bg-black/85 border border-white/15 p-8 md:px-20 md:py-20 mx-auto max-w-5xl rounded-2xl flex flex-col items-center text-center shadow-2xl">
              <h2 className="text-white text-3xl md:text-5xl font-bold tracking-tight leading-tight">
                Bắt đầu chuẩn hóa tài liệu dự án ngay hôm nay.
              </h2>
              <p className="text-slate-300 mt-4 text-base md:text-lg max-w-xl leading-relaxed">
                Kết nối kho lưu trữ GitHub của nhóm, tự động tạo tài liệu từ mã nguồn và trải nghiệm luồng thẩm định hai lớp chuyên nghiệp.
              </p>
              <div className="flex flex-wrap gap-4 mt-8 justify-center">
                <Link
                  href="/yeu-cau-sinh-tai-lieu"
                  className="rounded-full px-7 py-3.5 bg-white text-black hover:bg-amber-300 hover:text-black font-semibold text-sm transition-all hover:scale-105 active:scale-95 inline-block"
                >
                  Tạo tài liệu bằng AI
                </Link>
                <Link
                  href="/login"
                  className="rounded-full px-7 py-3.5 bg-transparent border border-white/40 text-white hover:border-amber-400 hover:text-amber-300 font-semibold text-sm transition-all hover:scale-105 active:scale-95 inline-block"
                >
                  Đăng nhập hệ thống
                </Link>
              </div>
            </div>
          </section>
        </RevealOnScroll>
      </main>

      {/* ─── 7. Footer chuẩn Astroship ─── */}
      <RevealOnScroll direction="up" delay={100}>
        <footer className="my-16 border-t border-white/10 pt-8">
          <div className="mx-auto max-w-7xl px-5 text-center text-sm text-slate-400">
            <p>
              Copyright © {new Date().getFullYear()} LivingDocs. Hệ thống tài liệu kỹ thuật sống động đồng bộ mã nguồn GitHub.
            </p>
            <div className="flex justify-center gap-6 mt-4 text-xs font-medium text-slate-300">
              <Link href="/dashboard" className="hover:text-amber-300 transition-colors">Dashboard</Link>
              <Link href="/yeu-cau-sinh-tai-lieu" className="hover:text-amber-300 transition-colors">Tạo tài liệu AI</Link>
              <Link href="/hang-doi-xem-xet" className="hover:text-amber-300 transition-colors">Hàng đợi Thẩm định</Link>
              <Link href="/trung-tam-phe-duyet" className="hover:text-amber-300 transition-colors">Trung tâm Phê duyệt</Link>
              <a
                href="https://github.com/LeNgocChau9/Java_UTH"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-amber-300 transition-colors"
              >
                GitHub <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </footer>
      </RevealOnScroll>
    </div>
  );
}
