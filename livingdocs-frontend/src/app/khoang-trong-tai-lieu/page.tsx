"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  Sparkles,
  Layers,
  FileCode2,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Code2,
  Boxes,
  RefreshCw,
  FolderTree,
  Check,
  Copy,
  ShieldAlert,
  Percent,
} from "lucide-react";
import { repoService, type RepoItem } from "@/services/repoService";
import {
  codeEntityService,
  type DocGapSummaryDto,
  type DocumentationGapDto,
} from "@/services/codeEntityService";

function KhoangTrongTaiLieuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRepoParam = searchParams.get("repo") || searchParams.get("repositoryId");

  // State kho lưu trữ
  const [repositories, setRepositories] = useState<RepoItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>(initialRepoParam || "ALL");
  const [loadingRepos, setLoadingRepos] = useState<boolean>(true);

  // State bộ lọc
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedPackage, setSelectedPackage] = useState<string>("ALL");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // State dữ liệu khoảng trống
  const [gapData, setGapData] = useState<DocGapSummaryDto | null>(null);
  const [loadingGaps, setLoadingGaps] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Feedback copy
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  // 1. Tải danh sách Repositories
  useEffect(() => {
    repoService
      .getRepositories()
      .then((items) => {
        setRepositories(items);
        if (items.length > 0) {
          if (initialRepoParam && items.some((r) => String(r.repositoryId) === initialRepoParam)) {
            setSelectedRepoId(initialRepoParam);
          } else {
            const saved = typeof window !== "undefined" ? localStorage.getItem("livingdocs_selected_repo_id") : null;
            if (saved && (saved === "ALL" || items.some((r) => String(r.repositoryId) === saved))) {
              setSelectedRepoId(saved);
            } else if (!selectedRepoId) {
              setSelectedRepoId("ALL");
            }
          }
        }
      })
      .catch(() => {
        setRepositories([]);
      })
      .finally(() => setLoadingRepos(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Tải danh sách Khoảng trống tài liệu khi thay đổi repo hoặc filter
  const fetchGaps = async () => {
    setLoadingGaps(true);
    setError(null);
    try {
      const repoId = selectedRepoId && selectedRepoId !== "ALL" ? Number(selectedRepoId) : undefined;
      const res = await codeEntityService.getDocumentationGaps({
        repositoryId: repoId,
        packagePath: selectedPackage !== "ALL" ? selectedPackage : undefined,
        entityType: selectedType !== "ALL" ? selectedType : undefined,
        search: searchKeyword.trim() ? searchKeyword.trim() : undefined,
      });
      setGapData(res);
    } catch (err: unknown) {
      console.error("Lỗi khi tải khoảng trống tài liệu:", err);
      setError("Không thể tải danh sách khoảng trống tài liệu. Vui lòng kiểm tra lại kết nối máy chủ.");
    } finally {
      setLoadingGaps(false);
    }
  };

  useEffect(() => {
    fetchGaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepoId, selectedType, selectedPackage]);

  // Tìm kiếm có debounce nhẹ hoặc ấn Enter / form submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGaps();
  };

  // Copy chữ ký hàm / tên lớp
  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSig(text);
    setTimeout(() => setCopiedSig(null), 2000);
  };

  // Nút một chạm: Chuyển hướng sang trang tạo tài liệu tự động
  const handleOneClickGenerate = (gap: DocumentationGapDto) => {
    const targetRepo = gap.repositoryId || (selectedRepoId !== "ALL" ? selectedRepoId : "1");
    const targetScope = gap.filePath || "";
    const targetClass = gap.className || "";
    const targetMethod = gap.methodName || "";
    const targetType = gap.entityType || "CLASS";

    const query = new URLSearchParams({
      repo: String(targetRepo),
      scope: targetScope,
      className: targetClass,
      methodName: targetMethod,
      entityType: targetType,
      templateId: "1", // Mặc định API Reference
      note: `Tự động sinh tài liệu kỹ thuật cho ${targetType} ${targetClass}${targetMethod ? "." + targetMethod : ""}`,
    });

    router.push(`/yeu-cau-sinh-tai-lieu?${query.toString()}`);
  };

  // Danh sách package duy nhất để hiển thị dropdown
  const packageOptions = useMemo(() => {
    if (!gapData?.packages || gapData.packages.length === 0) return [];
    return gapData.packages.filter((p) => p && p.trim().length > 0);
  }, [gapData?.packages]);

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Header Title */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-lg bg-indigo-50 p-2 text-indigo-600 ring-1 ring-indigo-200">
                <FileCode2 size={22} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Khoảng trống Tài liệu
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchGaps}
              disabled={loadingGaps}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={loadingGaps ? "animate-spin text-indigo-600" : ""} />
              Làm mới
            </button>
            <Link
              href="/yeu-cau-sinh-tai-lieu"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 cursor-pointer"
            >
              <Sparkles size={14} />
              Tạo tài liệu AI
            </Link>
          </div>
        </div>

        {/* Metric Overview Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Tổng khoảng trống */}
          <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50/50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cần bổ sung
              </span>
              <AlertCircle size={18} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-700">
                {loadingGaps ? "--" : gapData?.totalGaps ?? 0}
              </span>
              <span className="text-xs text-slate-400">phần tử</span>
            </div>
            <p className="mt-1 text-xs text-rose-600 font-medium">Khoảng trống chưa có tài liệu</p>
          </div>

          {/* Card 2: Lớp thiếu tài liệu */}
          <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Lớp (Classes)
              </span>
              <Boxes size={18} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-700">
                {loadingGaps ? "--" : gapData?.totalClasses ?? 0}
              </span>
              <span className="text-xs text-slate-400">lớp</span>
            </div>
            <p className="mt-1 text-xs text-blue-600 font-medium">Class chưa có tài liệu</p>
          </div>

          {/* Card 3: Giao diện thiếu tài liệu */}
          <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50/50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-purple-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Giao diện (Interfaces)
              </span>
              <Layers size={18} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-700">
                {loadingGaps ? "--" : gapData?.totalInterfaces ?? 0}
              </span>
              <span className="text-xs text-slate-400">interface</span>
            </div>
            <p className="mt-1 text-xs text-purple-600 font-medium">Interface chưa có tài liệu</p>
          </div>

          {/* Card 4: Phương thức thiếu tài liệu */}
          <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Phương thức (Methods)
              </span>
              <Code2 size={18} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-700">
                {loadingGaps ? "--" : gapData?.totalMethods ?? 0}
              </span>
              <span className="text-xs text-slate-400">phương thức</span>
            </div>
            <p className="mt-1 text-xs text-amber-600 font-medium">Hàm / Method cần tài liệu hóa</p>
          </div>

          {/* Card 5: Độ bao phủ tài liệu */}
          <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Độ bao phủ
              </span>
              <Percent size={18} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-700">
                {loadingGaps ? "--" : `${gapData?.coveragePercentage ?? 0}%`}
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(gapData?.coveragePercentage ?? 0, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Thanh Bộ Lọc Đa Chiều (Filters Bar) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 items-center">
            {/* 1. Lọc theo Kho lưu trữ */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Kho lưu trữ (Repository)
              </label>
              <select
                value={selectedRepoId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedRepoId(val);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("livingdocs_selected_repo_id", val);
                  }
                }}
                disabled={loadingRepos}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="ALL">-- Tất cả kho lưu trữ --</option>
                {repositories.map((repo) => (
                  <option key={repo.repositoryId} value={String(repo.repositoryId)}>
                    {repo.repoFullName || repo.repoName}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Lọc theo Gói thư mục / Package */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Gói thư mục (Package)
              </label>
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">-- Tất cả gói thư mục --</option>
                {packageOptions.map((pkg) => (
                  <option key={pkg} value={pkg}>
                    {pkg}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Lọc theo Loại phần tử mã nguồn */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Loại phần tử (Entity Type)
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả (All Types)</option>
                <option value="CLASS">Lớp (CLASS)</option>
                <option value="INTERFACE">Giao diện (INTERFACE)</option>
                <option value="METHOD">Phương thức (METHOD)</option>
              </select>
            </div>

            {/* 4. Ô tìm kiếm từ khóa */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tìm kiếm từ khóa
              </label>
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  placeholder="Tên lớp, tên hàm, chữ ký..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-12 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
                <button
                  type="submit"
                  className="absolute right-1 top-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Tìm
                </button>
              </form>
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium text-[11px]">Lọc nhanh loại:</span>
            {[
              { id: "ALL", label: "Tất cả", color: "bg-slate-100 text-slate-700" },
              { id: "CLASS", label: "Lớp (Class)", color: "bg-blue-50 text-blue-700 border-blue-200" },
              { id: "INTERFACE", label: "Giao diện (Interface)", color: "bg-purple-50 text-purple-700 border-purple-200" },
              { id: "METHOD", label: "Phương thức (Method)", color: "bg-amber-50 text-amber-700 border-amber-200" },
            ].map((p) => {
              const active = selectedType === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedType(p.id)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border transition cursor-pointer ${active
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  {p.label}
                </button>
              );
            })}

            {searchKeyword && (
              <button
                onClick={() => {
                  setSearchKeyword("");
                  setTimeout(fetchGaps, 0);
                }}
                className="ml-auto text-xs text-rose-600 hover:underline cursor-pointer"
              >
                Xóa tìm kiếm: &ldquo;{searchKeyword}&rdquo;
              </button>
            )}
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <ShieldAlert size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Bảng Hiển Thị Chi Tiết Khoảng Trống Tài Liệu */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <FolderTree size={16} className="text-slate-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Danh sách phần tử mã nguồn chưa có tài liệu (
                {gapData?.items?.length ?? 0} mục)
              </h2>
            </div>
            {gapData && gapData.totalGaps > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                Kho lưu trữ: <strong className="text-slate-800">{gapData.repoFullName || "Tất cả"}</strong>
              </span>
            )}
          </div>

          {loadingGaps ? (
            <div className="p-12 text-center">
              <RefreshCw size={24} className="mx-auto animate-spin text-indigo-600" />
              <p className="mt-3 text-xs font-medium text-slate-500">
                Đang quét và đối chiếu các phần tử mã nguồn với bảng tài liệu...
              </p>
            </div>
          ) : !gapData || gapData.items.length === 0 ? (
            gapData && gapData.totalEntities === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
                  <FolderTree size={24} />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-800">
                  Kho lưu trữ chưa có dữ liệu phần tử mã nguồn
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  Kho lưu trữ này chưa bóc tách Class/Method qua Tree-sitter AST hoặc chưa có file mã nguồn được đồng bộ.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setSelectedRepoId("ALL")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Filter size={13} />
                    Xem tất cả kho lưu trữ
                  </button>
                  <Link
                    href={`/cay-ma-nguon?repo=${selectedRepoId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                  >
                    <Sparkles size={13} />
                    Mở Cây mã nguồn quét AST
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-800">
                  Tuyệt vời! Không phát hiện khoảng trống tài liệu
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  Tất cả các lớp, giao diện và phương thức phù hợp với bộ lọc hiện tại đã được tài liệu hóa đầy đủ (Độ bao phủ 100%).
                </p>
                {selectedType !== "ALL" || selectedPackage !== "ALL" || searchKeyword ? (
                  <button
                    onClick={() => {
                      setSelectedType("ALL");
                      setSelectedPackage("ALL");
                      setSearchKeyword("");
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Filter size={13} />
                    Đặt lại tất cả bộ lọc
                  </button>
                ) : null}
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Loại phần tử</th>
                    <th className="py-3 px-4">Tên phần tử & Chữ ký</th>
                    <th className="py-3 px-4">Tệp & Gói thư mục</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác một chạm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {gapData.items.map((item, index) => {
                    const isMethod = item.entityType === "METHOD" || item.entityType === "CONSTRUCTOR";
                    const isInterface = item.entityType === "INTERFACE";
                    const isClass = item.entityType === "CLASS";

                    return (
                      <tr
                        key={item.entityId ? `gap-${item.entityId}` : `idx-${index}`}
                        className="transition hover:bg-slate-50/75 group"
                      >
                        {/* 1. Loại phần tử */}
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${isClass
                                ? "bg-blue-50 text-blue-700 ring-blue-200"
                                : isInterface
                                  ? "bg-purple-50 text-purple-700 ring-purple-200"
                                  : isMethod
                                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                                    : "bg-slate-100 text-slate-700 ring-slate-200"
                              }`}
                          >
                            {isClass && <Boxes size={12} />}
                            {isInterface && <Layers size={12} />}
                            {isMethod && <Code2 size={12} />}
                            {item.entityType}
                          </span>
                        </td>

                        {/* 2. Tên phần tử & Chữ ký hàm */}
                        <td className="py-3.5 px-4 align-top max-w-md">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-[13px]">
                              {item.className}
                            </span>
                            {item.methodName && (
                              <>
                                <span className="text-slate-400">.</span>
                                <span className="font-bold text-indigo-700 text-[13px]">
                                  {item.methodName}()
                                </span>
                              </>
                            )}

                            {/* Copy button */}
                            {item.signature && (
                              <button
                                onClick={() => handleCopy(item.signature || "")}
                                title="Sao chép chữ ký"
                                className="text-slate-400 hover:text-slate-600 transition p-0.5 cursor-pointer"
                              >
                                {copiedSig === item.signature ? (
                                  <Check size={12} className="text-emerald-600" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Code Signature Box */}
                          {item.signature && (
                            <div className="mt-1 rounded bg-slate-900 px-2.5 py-1 text-[11px] font-mono text-emerald-400 overflow-x-auto max-w-sm sm:max-w-md shadow-inner">
                              <code>{item.signature}</code>
                            </div>
                          )}

                          {item.suggestedDocTitle && (
                            <p className="mt-1 text-[11px] text-slate-500 italic">
                              💡 Gợi ý: {item.suggestedDocTitle}
                            </p>
                          )}
                        </td>

                        {/* 3. Tệp & Gói thư mục */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-800 text-xs">
                              {item.packagePath ? (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-700">
                                  {item.packagePath}
                                </span>
                              ) : (
                                "default"
                              )}
                            </span>
                            <span
                              className="text-[11px] text-slate-500 font-mono break-all mt-0.5"
                              title={item.filePath}
                            >
                              {item.filePath}
                              {item.startLine && item.endLine ? (
                                <span className="text-indigo-600 font-semibold ml-1">
                                  #L{item.startLine}-L{item.endLine}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>

                        {/* 4. Trạng thái */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                            Chưa có tài liệu
                          </span>
                        </td>

                        {/* 5. Nút một chạm: Sinh tài liệu AI */}
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOneClickGenerate(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 hover:shadow cursor-pointer active:scale-95"
                            title="Tự động điền thông tin tệp, lớp và mở ngay trang tạo tài liệu AI"
                          >
                            <Sparkles size={13} className="text-amber-300" />
                            <span>Sinh tài liệu AI</span>
                            <ArrowRight size={12} className="text-indigo-200 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function KhoangTrongTaiLieuPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw size={18} className="animate-spin text-indigo-600" />
              <span>Đang tải khoảng trống tài liệu...</span>
            </div>
          </div>
        </AppShell>
      }
    >
      <KhoangTrongTaiLieuContent />
    </Suspense>
  );
}
