import type { Metadata } from "next";
import { Roboto, Roboto_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Font chủ đạo toàn hệ thống: Roboto (thân thiện, dễ đọc, hỗ trợ tiếng Việt).
// Giữ nguyên tên CSS variable để không phá vỡ các chỗ tham chiếu trong globals.css.
const robotoSans = Roboto({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
});

// Font mono cho số liệu, mã nguồn, hash commit.
const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "vietnamese"],
});

// Giữ font display (Instrument Serif): Header của team đang dùng class font-display.
const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "LivingDocs",
  description: "Khung frontend LivingDocs cho tài liệu và tìm kiếm ngữ nghĩa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${robotoSans.variable} ${robotoMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-[#f7faf8] text-slate-900">{children}</body>
    </html>
  );
}
