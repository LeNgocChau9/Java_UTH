"use client";

import Image from "next/image";

/**
 * Nền video dùng chung cho Landing / Login / Quên mật khẩu.
 * - Video autoplay (muted), loop, phủ kín bằng object-cover.
 * - Lớp phủ MÀU ĐỒNG NHẤT (không gradient) để chữ đọc rõ và làm mờ watermark.
 * - Logo LivingDocs đặt góc dưới-phải để che logo Gemini của video gốc (vị trí
 *   watermark tiêu chuẩn của Veo/Flow) — vừa che vừa giữ nhận diện thương hiệu.
 */
export function VideoBackground({
  overlay = "bg-slate-900/80",
  blur = "",
}: {
  /** Lớp phủ màu đồng nhất (mặc định tối 80%). KHÔNG dùng gradient. */
  overlay?: string;
  /**
   * Lớp làm mờ video để phá nết watermark Gemini (vd "blur-[4px]").
   * ĐỂ TRỐNG = không làm mờ (landing giữ nét). Chỉ login / quên mật khẩu
   * mới truyền blur. Khi có blur, tự scale-110 để tránh viền trong suốt.
   */
  blur?: string;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Video nền — blur tuỳ chọn (chỉ auth pages) để phá nết watermark Gemini */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={`absolute inset-0 size-full object-cover ${
          blur ? `scale-110 ${blur}` : ""
        }`}
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>

      {/* Lớp phủ màu đồng nhất — không gradient */}
      <div className={`absolute inset-0 ${overlay}`} />

      {/* Logo app che watermark Gemini (góc dưới-phải) — to & đục để che kín */}
      <div className="absolute bottom-5 right-5 flex items-center gap-2.5 rounded-[6px] border border-white/40 bg-white px-4 py-3">
        <Image
          src="/logo.png"
          alt="LivingDocs"
          width={40}
          height={40}
          className="size-10 rounded-[6px] object-contain"
        />
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Living<span className="text-emerald-600">Docs</span>
        </span>
      </div>
    </div>
  );
}
