"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { VideoBackground } from "@/components/VideoBackground";
import { HeroBanner } from "@/components/HeroBanner";
import {
  GitPullRequest,
  CheckCircle2,
  FileCode2,
  Search,
  ArrowRight,
  TrendingUp,
  Zap,
  BookOpenCheck,
  ScanLine,
  FileCheck2,
  Send,
  ChevronRight,
  Globe,
  Mail,
  ArrowUpRight,
  AlertTriangle,
  FileX2,
  Clock,
  XCircle,
  ShieldAlert,
} from "lucide-react";

/* ─── Counter hook (chạy khi scroll vào viewport) ─── */
function useCounterOnView(target: number, duration: number = 2000, decimals: number = 0, from: number = 0) {
  const [count, setCount] = useState(from);
  const [hasStarted, setHasStarted] = useState(false);

  // Callback ref — tương thích khi gắn vào nhiều loại phần tử (<li>, <div>, ...).
  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasStarted(true);
      },
      { threshold: 0.3 }
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
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(val);
    }, stepTime);
    return () => clearInterval(timer);
  }, [hasStarted, target, duration, decimals, from]);

  return { count, ref };
}

/* Định dạng số kiểu Việt Nam (dùng dấu phẩy động, cố định số chữ số thập phân) */
const vnNum = (n: number, d: number) =>
  n.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });

/* ─── Ảnh nội bộ có sẵn cho banner vai trò ─── */
const ROLE_BANNERS = {
  dev: "/role_dev.jpg",
  staff: "/role_staff.jpg",
  lead: "/role_lead.jpg",
};

/* ─── Icon thương hiệu thật (simple-icons, tô theo currentColor) ─── */
const BRAND_POSTGRES_PATH =
  "M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z";

const BRAND_PATHS = {
  fastapi:
    "M12 .0387C5.3729.0384.0003 5.3931 0 11.9988c-.001 6.6066 5.372 11.9628 12 11.9625 6.628.0003 12.001-5.3559 12-11.9625-.0003-6.6057-5.3729-11.9604-12-11.96m-.829 5.4153h7.55l-7.5805 5.3284h5.1828L5.279 18.5436q2.9466-6.5444 5.892-13.0896",
  jwt: "M10.2 0v6.456L12 8.928l1.8-2.472V0zm3.6 6.456v3.072l2.904-.96L20.52 3.36l-2.928-2.136zm2.904 2.112l-1.8 2.496 2.928.936 6.144-1.992-1.128-3.432zM17.832 12l-2.928.936 1.8 2.496 6.144 1.992 1.128-3.432zm-1.128 3.432l-2.904-.96v3.072l3.792 5.232 2.928-2.136zM13.8 17.544L12 15.072l-1.8 2.472V24h3.6zm-3.6 0v-3.072l-2.904.96L3.48 20.64l2.928 2.136zm-2.904-2.112l1.8-2.496L6.168 12 .024 13.992l1.128 3.432zM6.168 12l2.928-.936-1.8-2.496-6.144-1.992-1.128 3.432zm1.128-3.432l2.904.96V6.456L6.408 1.224 3.48 3.36Z",
  postgresql: BRAND_POSTGRES_PATH,
} as const;

function BrandIcon({ name, className = "size-5" }: { name: keyof typeof BRAND_PATHS; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={BRAND_PATHS[name]} />
    </svg>
  );
}

/* ─── Các bước quy trình ─── */
const FLOW_STEPS = [
  {
    num: "01",
    icon: <GitPullRequest size={18} />,
    title: "Pull Request trên GitHub",
    desc: "Developer mở PR → Webhook bắt sự kiện tức thì, trích xuất diff code để phân tích tác động.",
  },
  {
    num: "02",
    icon: <ScanLine size={18} />,
    title: "AI Quét & Đề Xuất",
    desc: "AI Engine đối chiếu Vector DB pgvector, phát hiện mô-đun bị tác động và sinh bản thảo cập nhật.",
  },
  {
    num: "03",
    icon: <FileCheck2 size={18} />,
    title: "Staff Thẩm Định",
    desc: "Kiểm duyệt viên kỹ thuật xem xét, so sánh diff song song, chấm điểm chất lượng và ghi chú thẩm định.",
  },
  {
    num: "04",
    icon: <Send size={18} />,
    title: "Manager Publish",
    desc: "Quản lý phê duyệt 1-click, phát hành vào kho chính thức và đồng bộ toàn team tức thì.",
  },
];

function GitHubGlyph({ className = "size-5 fill-slate-700" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ─── Logo thương hiệu ─── */
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight text-slate-900 ${className}`}>
      Living<span className="text-emerald-600">Docs</span>
    </span>
  );
}

/* ─── Dữ liệu vai trò ─── */
const ROLE_CARDS = [
  {
    img: ROLE_BANNERS.dev,
    alt: "Developer",
    badge: "Developer",
    title: "Đồng bộ tức thời với GitHub",
    desc: "Xem tài liệu kho code phụ trách, kích hoạt AI sinh tài liệu mẫu từ source file, nhận cảnh báo ngay khi code sửa làm tài liệu cũ sai lệch.",
    tags: ["Kho lưu trữ", "Sinh tài liệu AI", "Cảnh báo sai lệch"],
    icon: <FileCode2 size={13} />,
  },
  {
    img: ROLE_BANNERS.staff,
    alt: "Staff review",
    badge: "Review Staff",
    title: "Kiểm soát chất lượng kỹ thuật",
    desc: "Hàng đợi kiểm tra trực quan, so sánh diff song song giữa code và tài liệu, chấm điểm AI và ghi chú thẩm định trước khi chuyển Manager.",
    tags: ["Hàng đợi duyệt", "Diff song song", "Điểm AI"],
    icon: <BookOpenCheck size={13} />,
  },
  {
    img: ROLE_BANNERS.lead,
    alt: "Tech lead",
    badge: "Manager",
    title: "Phê duyệt & phát hành",
    desc: "Xem toàn bộ nhật ký kiểm toán, phê duyệt 1-click, phát hành vào kho chính thức và đồng bộ toàn team tức thì.",
    tags: ["Phê duyệt", "Nhật ký kiểm toán", "Phát hành"],
    icon: <CheckCircle2 size={13} />,
  },
];

/* ─── Dữ liệu tính năng ─── */
const FEATURES = [
  {
    icon: <BrandIcon name="postgresql" className="size-6 text-sky-600" />,
    title: "AI Vector Search",
    desc: "pgvector trên PostgreSQL — tìm kiếm ngữ nghĩa toàn bộ tài liệu với độ chính xác cao.",
  },
  {
    icon: <GitHubGlyph className="size-5 fill-slate-900" />,
    title: "GitHub Webhook",
    desc: "Tích hợp trực tiếp qua Webhook — bắt sự kiện Push/PR ngay tức thì, không polling.",
  },
  {
    icon: <BrandIcon name="jwt" className="size-6 text-violet-600" />,
    title: "JWT + OAuth2",
    desc: "Xác thực an toàn với Spring Security — hỗ trợ email/password và GitHub OAuth2.",
  },
  {
    icon: <BrandIcon name="fastapi" className="size-6 text-teal-600" />,
    title: "FastAPI AI Engine",
    desc: "Python FastAPI xử lý embedding, phân tích diff và sinh bản nháp tài liệu tự động.",
  },
  {
    icon: <GitPullRequest size={20} className="text-emerald-600" />,
    title: "Real-time Diff",
    desc: "So sánh code diff với tài liệu hiện tại — highlight chính xác phần bị ảnh hưởng.",
  },
  {
    icon: <TrendingUp size={20} className="text-sky-600" />,
    title: "Quality Dashboard",
    desc: "Dashboard chất lượng cho Tech Lead — phân tích xu hướng, điểm số và báo cáo tổng hợp.",
  },
];


export default function HomePage() {
  const stat1 = useCounterOnView(14250, 2000);
  const stat2 = useCounterOnView(86, 1400);
  const stat3 = useCounterOnView(3840, 2400);
  const stat4 = useCounterOnView(99, 1600);

  // Counter cho cột "Số liệu nghiên cứu" (28,9% / 82,3% / 4,2–4,7 năm)
  const r289 = useCounterOnView(28.9, 1400, 1);
  const r823 = useCounterOnView(82.3, 1600, 1);
  const rYears = useCounterOnView(4.7, 1800, 1);

  const [searchQuery, setSearchQuery] = useState("");

  const stats = [
    { ref: stat1.ref, value: stat1.count, suffix: "+", label: "Tài liệu đã đồng bộ" },
    { ref: stat2.ref, value: stat2.count, suffix: "", label: "Kho GitHub kết nối" },
    { ref: stat3.ref, value: stat3.count, suffix: "h", label: "Giờ viết docs tiết kiệm" },
    { ref: stat4.ref, value: stat4.count, suffix: "%", label: "Độ chính xác 2 lớp duyệt" },
  ];

  return (
    <div className="min-h-screen bg-[#f8faf9] text-slate-900 font-sans">

      {/* ═══ NAV — flat, phân tách bằng border ═══ */}
      <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="LivingDocs" width={32} height={32} className="rounded-[6px] object-contain" />
          <Wordmark className="text-base" />
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="transition-colors hover:text-emerald-600">Tính năng</a>
          <a href="#workflow" className="transition-colors hover:text-emerald-600">Quy trình</a>
          <a href="#roles" className="transition-colors hover:text-emerald-600">Vai trò</a>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-[6px] bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Đăng nhập <ArrowRight size={15} />
        </Link>
      </nav>


      {/* ═══ HERO — video nền full-bleed, nội dung căn giữa ═══ */}
      <section className="relative isolate overflow-hidden border-b border-slate-200">
        <VideoBackground overlay="bg-slate-900/70" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
          <div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              Tự động đồng bộ
              <br />
              <span className="text-emerald-400">tài liệu theo code</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-200">
              Giải quyết triệt để vấn đề{" "}
              <span className="font-semibold text-white">tài liệu kỹ thuật bị lỗi thời</span>. LivingDocs
              đọc mã nguồn từ GitHub, dùng AI phát hiện sai lệch khi có PR, và đưa qua luồng kiểm soát
              chất lượng 2 lớp chuẩn doanh nghiệp.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-[6px] bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
              >
                <Zap size={16} /> Bắt đầu sử dụng ngay
              </Link>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 rounded-[6px] border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Xem luồng vận hành <ChevronRight size={15} />
              </a>
            </div>

            {/* Ô tìm kiếm flat trên nền video */}
            <div className="mx-auto mt-8 flex max-w-lg items-center rounded-[6px] border border-white/30 bg-white/95 focus-within:border-emerald-400">
              <Search size={18} className="ml-3.5 shrink-0 text-slate-400" />
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tài liệu, API specs, Module guides..."
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <Link
                href="/login"
                className="m-1 inline-flex items-center gap-1.5 rounded-[6px] bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Tìm kiếm <ArrowRight size={14} />
              </Link>
            </div>

            {/* Dòng trạng thái real-time */}
            <div className="mt-8 flex items-center justify-center gap-2">
              <span className="inline-block size-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-slate-200">Đồng bộ real-time qua GitHub Webhook</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ VẤN ĐỀ — nỗi đau & lý do cần LivingDocs ═══ */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-12 max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Vấn đề thực tế</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tài liệu kỹ thuật đang <span className="font-bold">lỗi thời</span> âm thầm
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Tan và cộng sự đã phân tích hơn 3.000 kho lưu trữ GitHub. Kết quả cho thấy documentation
              drift là vấn đề phổ biến nhưng hầu như không được phát hiện — đây chính là lý do bạn cần LivingDocs.
            </p>
          </div>

          {/* Layout 2 cột: trái = số liệu nghiên cứu, phải = nỗi đau (phân tách bằng hairline) */}
          <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-[6px] border border-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            {/* Cột trái — Số liệu nghiên cứu (đếm khi lướt tới) */}
            <div className="p-8 sm:p-10">
              <h3 className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Số liệu nghiên cứu</h3>
              <ul className="space-y-7">
                {[
                  { ref: r289.ref, value: `${vnNum(r289.count, 1)}%`, label: "tham chiếu mã lỗi thời", desc: "dự án GitHub phổ biến nhất hiện đang chứa tham chiếu tới mã đã bị xóa hoặc đổi tên." },
                  { ref: r823.ref, value: `${vnNum(r823.count, 1)}%`, label: "từng trải qua drift", desc: "dự án đã trải qua documentation drift trong suốt lịch sử phát triển của chúng." },
                  { ref: rYears.ref, value: `4,2–${vnNum(rYears.count, 1)} năm`, label: "không được phát hiện", desc: "tài liệu lỗi thời tồn tại lâu đến vậy mà không có cơ chế phát hiện tự động nào phát hiện ra." },
                ].map((s) => (
                  <li key={s.label} ref={s.ref}>
                    <p className="font-mono text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">{s.value}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cột phải — Nỗi đau */}
            <div className="p-8 sm:p-10">
              <h3 className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Nỗi đau của đội ngũ</h3>
              <ul className="space-y-7">
                {[
                  { title: "Code đổi, docs đứng im", desc: "Method bị đổi tên, endpoint đổi tham số — nhưng README, Wiki vẫn giữ nguyên nội dung cũ suốt nhiều năm." },
                  { title: "Viết docs thủ công, tốn công sức", desc: "Developer phải tự viết & tự cập nhật tài liệu mỗi khi merge — công việc lặp lại, dễ bỏ sót." },
                  { title: "Regex cho kết quả sai (false positive)", desc: "Cách tiếp cận dùng biểu thức chính quy dễ nhận diện sai với comment, changelog và cấu trúc riêng từng ngôn ngữ." },
                  { title: "Không tích hợp CI/CD", desc: "Phân tích tài liệu vẫn thủ công, không tự động chạy khi có Pull Request hay commit mới." },
                ].map((pain) => (
                  <li key={pain.title}>
                    <h4 className="text-sm font-bold text-slate-900">{pain.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{pain.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BANNER CAROUSEL — 4 ảnh, tự chuyển mỗi 3s ═══ */}
      <HeroBanner />

      {/* ═══ STATS — 4 ô flat phân tách bằng border ═══ */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-slate-200 bg-slate-200 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div key={i} ref={s.ref} className="bg-[#f8faf9] p-6 text-center">
                <p className="font-mono text-3xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-4xl">
                  {s.value.toLocaleString("vi-VN")}{s.suffix}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══ WORKFLOW — 4 bước ═══ */}
      <section id="workflow" className="border-b border-slate-200 bg-[#f8faf9]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Quy trình chuẩn doanh nghiệp</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Từ Pull Request đến <span className="text-emerald-600">Bản Publish hoàn chỉnh</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-600">
              Không còn tình trạng code một đằng tài liệu một nẻo nhờ cơ chế kiểm soát chất lượng khép kín.
            </p>
          </div>

          <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-[6px] border border-slate-200 bg-slate-200 md:grid-cols-4">
            {FLOW_STEPS.map((step) => (
              <li key={step.num} className="bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-emerald-600 text-white">
                    {step.icon}
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">{step.title}</h3>
                <p className="text-xs leading-relaxed text-slate-600">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ ROLES — 3 card dùng ảnh vai trò có sẵn ═══ */}
      <section id="roles" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Phân quyền trải nghiệm</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Không gian làm việc <span className="text-emerald-600">chuyên biệt theo vai trò</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-600">
              Mỗi vị trí trong dự án được trang bị công cụ tự động hóa riêng, chuẩn hóa luồng tài liệu từ đầu đến cuối.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {ROLE_CARDS.map((role) => (
              <article key={role.badge} className="overflow-hidden rounded-[6px] border border-slate-200 bg-white transition-colors hover:border-emerald-300">
                <div className="relative h-44 overflow-hidden bg-slate-100">
                  <Image src={role.img} alt={role.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                </div>
                <div className="p-5">
                  <h3 className="mb-2 text-base font-bold text-slate-900">{role.title}</h3>
                  <p className="mb-4 text-xs leading-relaxed text-slate-600">{role.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {role.tags.map((tag) => (
                      <span key={tag} className="rounded-[6px] border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES — lưới 6 tính năng ═══ */}
      <section id="features" className="border-b border-slate-200 bg-[#f8faf9]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Năng lực cốt lõi</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Một nền tảng, <span className="text-emerald-600">mọi khâu tài liệu</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[6px] border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white p-6 transition-colors hover:bg-[#f8faf9]">
                <div className="mb-4 grid size-10 place-items-center rounded-[6px] border border-slate-200 bg-[#f8faf9]">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">{f.title}</h3>
                <p className="text-xs leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══ CTA — ảnh nền network_bg + lớp phủ màu đồng nhất (không gradient) ═══ */}
      <section className="bg-[#f8faf9]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="relative overflow-hidden rounded-[6px] border border-emerald-800">
            <Image src="/network_bg.jpg" alt="" fill className="object-cover" sizes="(max-width: 1152px) 100vw, 1152px" />
            <div className="absolute inset-0 bg-emerald-900/85" />
            <div className="relative mx-auto max-w-2xl px-6 py-16 text-center sm:py-20">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Sẵn sàng đồng bộ hóa <span className="text-emerald-300">tài liệu dự án?</span>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-emerald-50/90">
                Đăng nhập với tài khoản được cấp bởi tổ chức hoặc kết nối trực tiếp với tài khoản GitHub để
                bắt đầu ngay hôm nay.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-[6px] bg-white px-6 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  <Zap size={16} /> Đăng nhập ngay hôm nay
                </Link>
                <a
                  href="#workflow"
                  className="inline-flex items-center gap-2 rounded-[6px] border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Xem quy trình <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-4">
            <div>
              <Link href="/" className="mb-4 flex items-center gap-2.5">
                <Image src="/logo.png" alt="LivingDocs" width={32} height={32} className="rounded-[6px] object-contain" />
                <Wordmark className="text-sm" />
              </Link>
              <p className="text-xs leading-relaxed text-slate-500">
                Hệ thống tài liệu kỹ thuật sống — đồng bộ tự động với mọi thay đổi của mã nguồn.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <a href="#" aria-label="GitHub" className="grid size-8 place-items-center rounded-[6px] border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700">
                  <GitHubGlyph className="size-4 fill-current" />
                </a>
                <a href="#" aria-label="Website" className="grid size-8 place-items-center rounded-[6px] border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700">
                  <Globe size={15} />
                </a>
                <a href="#" aria-label="Email" className="grid size-8 place-items-center rounded-[6px] border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700">
                  <Mail size={15} />
                </a>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-slate-900">Sản phẩm</h4>
              <ul className="space-y-2.5">
                {["Tính năng", "Quy trình Review", "Phân quyền vai trò", "API Documentation"].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-slate-500 transition-colors hover:text-emerald-600">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-slate-900">Tài nguyên</h4>
              <ul className="space-y-2.5">
                {["Hướng dẫn cài đặt", "Flyway Migration", "Spring Boot Backend", "Next.js Frontend"].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-slate-500 transition-colors hover:text-emerald-600">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-slate-900">Hỗ trợ</h4>
              <ul className="space-y-2.5">
                {["Đăng nhập hệ thống", "Liên hệ nhóm phát triển", "Báo lỗi", "Changelog"].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-slate-500 transition-colors hover:text-emerald-600">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row">
            <p className="text-[11px] text-slate-400">
              © 2026 LivingDocs. Hệ thống tài liệu kỹ thuật cho doanh nghiệp phần mềm.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
              Hệ thống hoạt động bình thường · Spring Boot 8080 · Next.js 3000
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

