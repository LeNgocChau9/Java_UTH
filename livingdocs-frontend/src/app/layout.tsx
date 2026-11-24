import type { Metadata } from "next";
import { Roboto, Roboto_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";

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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://livingdocs-ai.vercel.app"
  ),
  title: "LivingDocs - Nền tảng tài liệu kỹ thuật sống động bằng AI",
  description:
    "Tự động sinh, cập nhật và đồng bộ tài liệu kỹ thuật theo mã nguồn bằng AI.",
  applicationName: "LivingDocs",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "LivingDocs - Nền tảng tài liệu kỹ thuật sống động bằng AI",
    description:
      "Tự động sinh, cập nhật và đồng bộ tài liệu kỹ thuật theo mã nguồn bằng AI.",
    url: "https://livingdocs-ai.vercel.app",
    siteName: "LivingDocs",
    locale: "vi_VN",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "LivingDocs Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LivingDocs - Nền tảng tài liệu kỹ thuật sống động bằng AI",
    description:
      "Tự động sinh, cập nhật và đồng bộ tài liệu kỹ thuật theo mã nguồn bằng AI.",
    images: ["/logo.png"],
  },
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
      <body
        suppressHydrationWarning
        className="min-h-dvh bg-[#f7faf8] text-slate-900"
      >
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
