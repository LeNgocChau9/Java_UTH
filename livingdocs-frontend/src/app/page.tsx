"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Clock,
  ChevronRight,
  ArrowUp,
  MessageCircle,
  Headphones,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

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

  // Trạng thái modal Góp ý & Chatbot Hỗ trợ
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("feature");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Chatbot state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "bot" | "user"; text: string }>>([
    {
      sender: "bot",
      text: "Xin chào! Tôi là Trợ lý AI của LivingDocs. Tôi có thể hỗ trợ gì về đồng bộ tài liệu, kiểm duyệt 2 lớp hoặc liên kết GitHub cho bạn?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setChatInput("");
    setIsTyping(true);

    // Xử lý câu trả lời thông minh của Chatbot LivingDocs
    setTimeout(() => {
      let botReply =
        "Cảm ơn câu hỏi của bạn. LivingDocs tự động hóa biên soạn tài liệu kiến trúc phần mềm từ Git Diff, kiểm duyệt sai lệch AST và bảo chứng chất lượng với chuỗi băm SHA-256.";

      const lower = userText.toLowerCase();
      if (lower.includes("github") || lower.includes("repo") || lower.includes("kho")) {
        botReply =
          "Để liên kết GitHub, bạn vào phần 'Kho lưu trữ' (Repository) trên thanh điều hướng, kết nối OAuth hoặc cấp Personal Access Token để nhận Webhook tự động khi có Commit / Pull Request mới nhé.";
      } else if (lower.includes("ast") || lower.includes("phân tích") || lower.includes("diff")) {
        botReply =
          "Bộ phân tích AST của LivingDocs bóc tách toàn diện Class, Method, Signature và Javadoc của mã nguồn. Khi code thay đổi, hệ thống phát hiện chính xác hàm bị sửa đổi và cảnh báo sai lệch (Drift Alert).";
      } else if (lower.includes("duyệt") || lower.includes("review") || lower.includes("phê duyệt") || lower.includes("staff") || lower.includes("manager")) {
        botReply =
          "Quy trình kiểm duyệt 2 lớp gồm: 1) Kỹ thuật viên (Staff) đối chiếu thẩm định tài liệu với code thực tế. 2) Trưởng nhóm (Manager) phê duyệt xuất bản chính thức và tự động commit Markdown vào GitHub.";
      } else if (lower.includes("giá") || lower.includes("chi phí") || lower.includes("free") || lower.includes("tiền")) {
        botReply =
          "LivingDocs là hệ thống mã nguồn mở phát triển cho dự án kỹ thuật, hiện tại hỗ trợ sử dụng hoàn toàn miễn phí với các mô hình AI tích hợp!";
      }

      setChatMessages((prev) => [...prev, { sender: "bot", text: botReply }]);
      setIsTyping(false);
    }, 600);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackSuccess(true);
    setTimeout(() => {
      setIsFeedbackOpen(false);
      setFeedbackSuccess(false);
      setFeedbackContent("");
      setFeedbackEmail("");
    }, 1800);
  };

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

      {/* ─── 7. Footer Phong Cách Cao Cấp (Multi-column Grid & Background Đồng Bộ) ─── */}
      <footer className="relative z-10 mt-20 bg-black/60 text-slate-300">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
            {/* Cột 1: Thương hiệu & Giới thiệu & Đăng ký nhận tin */}
            <div className="space-y-4">
              <Link href="/" className="inline-flex items-center gap-2.5 text-xl font-bold text-white group">
                <Image src="/logo.png" alt="LivingDocs Logo" width={32} height={32} className="rounded object-contain" />
                <span className="text-white">LivingDocs</span>
              </Link>
              <p className="text-sm text-slate-400 leading-relaxed">
                Giải pháp đồng bộ tài liệu kỹ thuật tự động từ mã nguồn, kiểm soát sai lệch AST và bảo chứng bằng chuỗi băm Hash-Chain bất biến.
              </p>

              {/* Form nhận tin đặt ngay dưới phần giới thiệu thương hiệu */}
              <div className="pt-2">
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-2">
                  Đăng ký nhận bản tin cập nhật
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    alert("Cảm ơn bạn đã đăng ký nhận bản tin LivingDocs!");
                  }}
                  className="flex items-center rounded-lg border border-white/15 bg-white/5 p-1 focus-within:border-amber-400 transition-colors"
                >
                  <input
                    type="email"
                    required
                    placeholder="Nhập email..."
                    className="w-full bg-transparent px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-black hover:bg-amber-300 transition-all active:scale-95 shrink-0"
                  >
                    Đăng ký
                  </button>
                </form>
              </div>

              {/* Mạng xã hội */}
              <div className="flex items-center gap-2.5 pt-2">
                <a
                  href="https://github.com/LeNgocChau9/Java_UTH"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub"
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-amber-300 hover:border-amber-400/40 hover:bg-white/10 transition-all"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="X / Twitter"
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-amber-300 hover:border-amber-400/40 hover:bg-white/10 transition-all"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-amber-300 hover:border-amber-400/40 hover:bg-white/10 transition-all"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.46 1.46 0 0 0 1.46-1.46 1.46 1.46 0 0 0-1.46-1.46 1.46 1.46 0 0 0-1.46 1.46c0 .8.66 1.46 1.46 1.46m1.39 9.74v-8.37H5.07v8.37h2.78z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="Facebook"
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-amber-300 hover:border-amber-400/40 hover:bg-white/10 transition-all"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Cột 2: QUICK LINKS (Liên kết nhanh) */}
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-white mb-5">
                LIÊN KẾT NHANH
              </h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Trang chủ
                  </Link>
                </li>
                <li>
                  <a href="#features" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Tính năng cốt lõi
                  </a>
                </li>
                <li>
                  <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Dashboard Tech Lead
                  </Link>
                </li>
                <li>
                  <Link href="/kho-luu-tru" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Kho lưu trữ Repository
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Đăng nhập hệ thống
                  </Link>
                </li>
              </ul>
            </div>

            {/* Cột 3: OUR SERVICES (Dịch vụ & Tính năng) */}
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-white mb-5">
                DỊCH VỤ CỐT LÕI
              </h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/yeu-cau-sinh-tai-lieu" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Sinh tài liệu bằng AI
                  </Link>
                </li>
                <li>
                  <Link href="/hang-doi-xem-xet" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Thẩm định mã nguồn AST
                  </Link>
                </li>
                <li>
                  <Link href="/trung-tam-phe-duyet" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Trung tâm phê duyệt 2 lớp
                  </Link>
                </li>
                <li>
                  <Link href="/canh-bao-sai-lech" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Cảnh báo sai lệch (Drift)
                  </Link>
                </li>
                <li>
                  <Link href="/giam-sat-suc-khoe" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" /> Giám sát sức khỏe tài liệu
                  </Link>
                </li>
              </ul>
            </div>

            {/* Cột 4: GET IN TOUCH (Thông tin liên hệ) */}
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-white mb-5">
                THÔNG TIN LIÊN HỆ
              </h4>
              <ul className="space-y-3.5 text-sm text-slate-400">
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Khu Công nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>+84 (028) 3899 2862</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <a href="mailto:support@livingdocs.internal" className="hover:text-amber-300 transition-colors">
                    support@livingdocs.internal
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Thứ 2 – Thứ 6: 8:00 – 17:30</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </footer>

      {/* ─── 8. Cụm Tiện Ích Cố Định Góc Phải (Nút TOP xếp trên, 2 nút Góp ý & Hỗ trợ phía dưới, không khung bao) ─── */}
      <aside aria-label="Thanh tiện ích nhanh" className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3 select-none">
        {/* Nút Back to Top xếp TRÊN CÙNG */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Cuộn lên đầu trang"
          className="w-11 h-11 rounded-full bg-amber-400 text-black flex flex-col items-center justify-center font-bold text-[10px] shadow-[0_4px_16px_rgba(245,158,11,0.4)] hover:bg-amber-300 hover:scale-105 active:scale-95 transition-all group cursor-pointer"
          title="Cuộn lên đầu trang"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5] group-hover:-translate-y-0.5 transition-transform" />
          <span className="leading-none mt-0.5 font-extrabold tracking-tight">TOP</span>
        </button>

        {/* Nút Góp ý - Không khung bao */}
        <button
          onClick={() => {
            setIsFeedbackOpen(true);
            setIsChatOpen(false);
          }}
          className="flex flex-col items-center justify-center gap-1 group cursor-pointer transition-transform hover:scale-110 active:scale-95"
          title="Gửi góp ý của bạn"
        >
          <div className="w-11 h-11 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg group-hover:bg-amber-300 transition-colors">
            <MessageCircle className="w-5 h-5" fill="currentColor" />
          </div>
          <span className="text-[10px] font-bold text-amber-400 tracking-tight leading-none group-hover:text-amber-300 drop-shadow">
            Góp ý
          </span>
        </button>

        {/* Nút Hỗ trợ (Mở Chatbot) - Không khung bao */}
        <button
          onClick={() => {
            setIsChatOpen((prev) => !prev);
            setIsFeedbackOpen(false);
          }}
          className="flex flex-col items-center justify-center gap-1 group cursor-pointer transition-transform hover:scale-110 active:scale-95"
          title="Chat với Trợ lý Hỗ trợ AI"
        >
          <div className="w-11 h-11 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg group-hover:bg-amber-300 transition-colors">
            <Headphones className="w-5 h-5 stroke-[2.4]" />
          </div>
          <span className="text-[10px] font-bold text-amber-400 tracking-tight leading-none group-hover:text-amber-300 drop-shadow">
            Hỗ trợ
          </span>
        </button>
      </aside>

      {/* ─── Modal Góp ý (Feedback Dialog) ─── */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-[#0a1120] border border-amber-400/30 rounded-2xl p-6 shadow-2xl text-slate-200">
            <button
              onClick={() => setIsFeedbackOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-3 text-amber-400">
              <MessageCircle className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">Gửi ý kiến đóng góp</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Ý kiến của bạn giúp chúng tôi cải thiện hệ thống LivingDocs ngày càng hoàn thiện hơn.
            </p>

            {feedbackSuccess ? (
              <div className="py-8 flex flex-col items-center text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-amber-400 animate-bounce" />
                <h4 className="font-bold text-white text-base">Cảm ơn bạn đã đóng góp!</h4>
                <p className="text-xs text-slate-300">Ý kiến của bạn đã được ghi nhận vào hệ thống.</p>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Chủ đề góp ý
                  </label>
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="feature" className="bg-[#0a1120]">Đề xuất tính năng mới</option>
                    <option value="bug" className="bg-[#0a1120]">Báo cáo lỗi kỹ thuật</option>
                    <option value="ui" className="bg-[#0a1120]">Góp ý giao diện (UI/UX)</option>
                    <option value="other" className="bg-[#0a1120]">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Email của bạn (không bắt buộc)
                  </label>
                  <input
                    type="email"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nội dung chi tiết *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    placeholder="Hãy chia sẻ trải nghiệm hoặc đóng góp của bạn..."
                    className="w-full bg-white/5 border border-white/15 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black rounded-lg transition-all active:scale-95 cursor-pointer"
                  >
                    Gửi góp ý
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── Chatbot Hỗ Trợ AI (Floating Chat Widget) ─── */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-[#0a1120] border border-amber-400/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header Chatbot */}
          <div className="px-4 py-3 bg-gradient-to-r from-amber-950/40 via-[#0a1120] to-[#0a1120] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Trợ lý LivingDocs <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </h4>
                <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Sẵn sàng hỗ trợ
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Vùng tin nhắn */}
          <div className="p-4 h-80 overflow-y-auto space-y-3 text-xs leading-relaxed">
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "bot" && (
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                    msg.sender === "user"
                      ? "bg-amber-400 text-black font-semibold rounded-br-none"
                      : "bg-white/10 text-slate-200 border border-white/10 rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
                {msg.sender === "user" && (
                  <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2 items-center text-slate-400">
                <div className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white/10 border border-white/10 rounded-2xl px-3 py-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Ô nhập tin nhắn */}
          <form
            onSubmit={handleSendChatMessage}
            className="p-3 border-t border-white/10 bg-black/40 flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 rounded-xl bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
