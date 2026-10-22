"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* Ảnh banner (nằm trong public/) */
const BANNERS = [
  { src: "/banner_1.png", alt: "Dashboard theo dõi commit và tài liệu" },
  { src: "/banner_2.png", alt: "Website tài liệu kỹ thuật nổi trên giao diện" },
  { src: "/banner_3.png", alt: "Laptop với tài liệu kỹ thuật động" },
  { src: "/banner_4.png", alt: "Không gian làm việc giám sát mã nguồn" },
];

const AUTOPLAY_MS = 3000;

/**
 * Banner carousel full-bleed: tự chuyển ảnh mỗi 3 giây, có nút điều hướng
 * (bo góc 6px) và dots. Không gradient/shadow — flat, border-based.
 */
export function HeroBanner() {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((next: number) => {
    setIndex((next + BANNERS.length) % BANNERS.length);
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % BANNERS.length);
    }, AUTOPLAY_MS);
  }, []);

  useEffect(() => {
    reset();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reset]);

  const prev = () => { go(index - 1); reset(); };
  const next = () => { go(index + 1); reset(); };

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="group relative overflow-hidden rounded-[6px] border border-slate-200">
          {/* Khối ảnh — tỷ lệ 21:9, chuyển bằng opacity crossfade */}
          <div className="relative aspect-[21/9] w-full bg-slate-100">
            {BANNERS.map((b, i) => (
              <Image
                key={b.src}
                src={b.src}
                alt={b.alt}
                fill
                priority={i === 0}
                className={`object-cover transition-opacity duration-700 ${
                  i === index ? "opacity-100" : "opacity-0"
                }`}
                sizes="(max-width: 1152px) 100vw, 1152px"
              />
            ))}
          </div>

          {/* Nút điều hướng — bo góc 6px, chỉ hiện khi hover (desktop) */}
          <button
            type="button"
            onClick={prev}
            aria-label="Ảnh trước"
            className="absolute left-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-[6px] border border-slate-200 bg-white/90 text-slate-700 opacity-0 transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Ảnh tiếp theo"
            className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-[6px] border border-slate-200 bg-white/90 text-slate-700 opacity-0 transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
          >
            <ChevronRight size={18} />
          </button>

          {/* Dots chỉ báo */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {BANNERS.map((b, i) => (
              <button
                key={b.src}
                type="button"
                onClick={() => { go(i); reset(); }}
                aria-label={`Tới ảnh ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-[6px] transition-all ${
                  i === index ? "w-6 bg-emerald-500" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
