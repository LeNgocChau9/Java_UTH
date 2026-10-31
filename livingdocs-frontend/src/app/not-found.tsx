import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center">
      <h2 className="text-4xl font-extrabold mb-3 text-emerald-400">404 - Không tìm thấy trang</h2>
      <p className="text-slate-400 mb-6 max-w-md">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển sang địa chỉ khác.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
      >
        Về trang chủ
      </Link>
    </div>
  );
}

