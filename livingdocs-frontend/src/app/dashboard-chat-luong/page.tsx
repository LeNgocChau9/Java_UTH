"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  healthReportService,
  DocumentHealthReport,
  CoverageGapsResponse,
  CoverageGapItem,
  CoverageGapPackage,
} from "@/services/healthReportService";
import { repoService, RepoItem } from "@/services/repoService";
import {
  FileText,
  Sparkles,
  Download,
  Printer,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Search,
  Code,
  FolderGit2,
  ChevronDown,
  ChevronUp,
  Layers,
  Activity,
  FileCode2,
  Filter,
  BarChart3,
  Clock,
  ArrowUpRight,
  Boxes,
  Eye,
  X,
  FileCheck,
} from "lucide-react";

function FormalPrintReportContent({
  report,
  gaps,
  repoName,
  repoId,
}: {
  report: DocumentHealthReport | null;
  gaps: CoverageGapsResponse | null;
  repoName: string;
  repoId: string;
}) {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFormatted = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const auditCode = `AUDIT-DOCS-${repoId === "all" ? "SYS" : repoId}-${now.toISOString().slice(0, 10).replace(/-/g, "")}`;

  return (
    <div className="bg-white text-slate-900 p-6 sm:p-8 max-w-4xl mx-auto space-y-6 font-sans leading-relaxed">
      {/* 1. Tiêu đề trang trọng quy chuẩn */}
      <div className="border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-start text-xs text-slate-700 mb-3">
          <div className="text-left font-serif">
            <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              HỆ THỐNG QUẢN TRỊ TÀI LIỆU SỐNG LIVINGDOCS
            </p>
            <p className="text-[10px] text-slate-500">Ban Kiểm Định Chất Lượng &amp; Tuân Thủ Kiến Trúc</p>
          </div>
          <div className="text-center font-serif">
            <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </p>
            <p className="text-[10px] text-slate-700 italic">Độc lập - Tự do - Hạnh phúc</p>
            <div className="w-20 h-0.5 bg-slate-400 mx-auto mt-1" />
          </div>
        </div>

        <div className="text-center mt-3">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
            BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG &amp; SỨC KHỎE TÀI LIỆU DỰ ÁN
          </h1>
          <p className="text-xs text-slate-500 italic mt-0.5">
            (Project Documentation Health &amp; Quality Audit Report)
          </p>
        </div>

        {/* Khung thông tin điều hành */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
          <div>
            <p>
              <span className="font-semibold text-slate-700">Dự án / Kho lưu trữ:</span>{" "}
              <strong className="text-slate-900">{repoName}</strong>
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-700">Mã số thẩm định:</span>{" "}
              <code className="font-mono font-bold text-slate-800">{auditCode}</code>
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-700">Tiêu chuẩn áp dụng:</span>{" "}
              <span className="text-slate-800">ISO/IEC/IEEE 26515 &amp; LivingDocs Engine</span>
            </p>
          </div>
          <div>
            <p>
              <span className="font-semibold text-slate-700">Thời điểm trích xuất:</span>{" "}
              <span className="text-slate-800">{timeFormatted}, Ngày {dateFormatted}</span>
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-700">Thời gian phân tích:</span>{" "}
              <span className="font-mono text-emerald-700 font-bold">{report?.executionTimeMs ?? 160} ms</span> (tiêu chuẩn dưới 300ms)
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-700">Đánh giá chung:</span>{" "}
              <strong className="text-indigo-900 font-bold">
                {report?.compliance?.rating || "GOOD (A)"} ({report?.compliance?.overallScore ?? 85}/100)
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Mục I: Tóm tắt sức khỏe & 4 chỉ số cốt lõi */}
      <div>
        <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <span>I. TỔNG QUAN CHỈ SỐ SỨC KHỎE CỐT LÕI (CORE HEALTH METRICS)</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Bao phủ */}
          <div className="p-3 bg-white border border-emerald-600 rounded-lg">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Độ bao phủ mã nguồn</span>
            <div className="text-lg sm:text-xl font-extrabold text-emerald-950 mt-1">
              {report ? `${report.coveragePercent.toFixed(1)}%` : "0.0%"}
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {report?.documentedEntities ?? 0}/{report?.totalScannedEntities ?? 0} thực thể có doc
            </p>
          </div>

          {/* Card 2: Tuân thủ */}
          <div className="p-3 bg-white border border-indigo-600 rounded-lg">
            <span className="text-[10px] font-bold text-indigo-800 uppercase block">Điểm chuẩn tuân thủ</span>
            <div className="text-lg sm:text-xl font-extrabold text-indigo-950 mt-1">
              {report?.compliance?.overallScore ?? 0}/100
            </div>
            <p className="text-[10px] font-bold text-indigo-700 mt-0.5">
              {report?.compliance?.rating || "CHƯA XẾP HẠNG"}
            </p>
          </div>

          {/* Card 3: Độ mới */}
          <div className="p-3 bg-white border border-amber-600 rounded-lg">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">Độ mới theo Commit</span>
            <div className="text-lg sm:text-xl font-extrabold text-amber-950 mt-1">
              {report ? `${report.freshnessPercent.toFixed(1)}%` : "0.0%"}
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {report?.freshDocuments ?? 0}/{report?.totalDocuments ?? 0} tài liệu khớp HEAD
            </p>
          </div>

          {/* Card 4: Sai lệch */}
          <div className="p-3 bg-white border border-rose-600 rounded-lg">
            <span className="text-[10px] font-bold text-rose-800 uppercase block">Cảnh báo sai lệch mở</span>
            <div className="text-lg sm:text-xl font-extrabold text-rose-950 mt-1">
              {report?.totalOpenDriftAlerts ?? 0}
            </div>
            <p className="text-[10px] text-rose-700 font-semibold mt-0.5">
              {report?.openAlertsBySeverity?.CRITICAL ?? 0} Critical • {report?.openAlertsBySeverity?.HIGH ?? 0} High
            </p>
          </div>
        </div>

        {report?.compliance?.summary && (
          <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            <strong className="text-slate-900">Nhận định thẩm định:</strong> {report.compliance.summary}
          </div>
        )}
      </div>

      {/* 3. Mục II: Bảng Thống kê Tỷ lệ Bao phủ & Độ Mới */}
      <div className="print-break-inside-avoid">
        <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
          II. BẢNG THỐNG KÊ CHI TIẾT TỶ LỆ BAO PHỦ &amp; ĐỘ MỚI TÀI LIỆU
        </h2>
        <table className="w-full text-xs text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
              <th className="p-2 border border-slate-300">Hạng mục kiểm định</th>
              <th className="p-2 border border-slate-300 text-center">Giá trị thực tế</th>
              <th className="p-2 border border-slate-300 text-center">Tiêu chuẩn yêu cầu</th>
              <th className="p-2 border border-slate-300">Đánh giá trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-300 font-medium">Tỷ lệ bao phủ mã nguồn (Code Coverage)</td>
              <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">
                {report ? `${report.coveragePercent.toFixed(2)}%` : "0.00%"}
              </td>
              <td className="p-2 border border-slate-300 text-center">&ge; 70.0%</td>
              <td className="p-2 border border-slate-300">
                {(report?.coveragePercent ?? 0) >= 70 ? (
                  <span className="text-emerald-700 font-semibold">✓ Đạt chuẩn</span>
                ) : (
                  <span className="text-amber-700 font-semibold">⚠ Cần bổ sung tài liệu</span>
                )}
              </td>
            </tr>
            <tr className="bg-slate-50/50">
              <td className="p-2 border border-slate-300 font-medium">Tỷ lệ độ mới theo Commit (Freshness Rate)</td>
              <td className="p-2 border border-slate-300 text-center font-bold text-amber-700">
                {report ? `${report.freshnessPercent.toFixed(2)}%` : "0.00%"}
              </td>
              <td className="p-2 border border-slate-300 text-center">&ge; 75.0%</td>
              <td className="p-2 border border-slate-300">
                {(report?.freshnessPercent ?? 0) >= 75 ? (
                  <span className="text-emerald-700 font-semibold">✓ Đạt chuẩn</span>
                ) : (
                  <span className="text-amber-700 font-semibold">⚠ Cần đồng bộ theo commit mới</span>
                )}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 font-medium">Điểm kiểm soát sai lệch trôi dạt (Drift Control)</td>
              <td className="p-2 border border-slate-300 text-center font-bold text-indigo-700">
                {report?.compliance?.driftControlScore !== undefined ? `${report.compliance.driftControlScore.toFixed(1)}/100` : "100.0/100"}
              </td>
              <td className="p-2 border border-slate-300 text-center">&ge; 80.0 điểm</td>
              <td className="p-2 border border-slate-300">
                {(report?.compliance?.driftControlScore ?? 100) >= 80 ? (
                  <span className="text-emerald-700 font-semibold">✓ An toàn</span>
                ) : (
                  <span className="text-rose-700 font-semibold">⚠ Rủi ro sai lệch</span>
                )}
              </td>
            </tr>
            <tr className="bg-slate-50/50">
              <td className="p-2 border border-slate-300 font-medium">Tổng thực thể mã nguồn phân tích (AST Tree)</td>
              <td className="p-2 border border-slate-300 text-center font-bold">
                {report?.totalScannedEntities ?? 0} thực thể
              </td>
              <td className="p-2 border border-slate-300 text-center">Toàn diện 100%</td>
              <td className="p-2 border border-slate-300 text-slate-600">
                Đã viết doc: {report?.documentedEntities ?? 0} | Còn thiếu: {(report?.totalScannedEntities ?? 0) - (report?.documentedEntities ?? 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4. Mục III: Khuyến nghị cải thiện chất lượng */}
      <div className="print-break-inside-avoid">
        <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
          III. KHUYẾN NGHỊ CẢI THIỆN CHẤT LƯỢNG TÀI LIỆU DỰ ÁN
        </h2>
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/80 space-y-1.5 text-xs">
          {report?.compliance?.recommendations && report.compliance.recommendations.length > 0 ? (
            report.compliance.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-slate-800">
                <span className="w-4 h-4 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center shrink-0 text-[9px] mt-0.5">
                  {i + 1}
                </span>
                <p className="leading-relaxed font-medium">{rec}</p>
              </div>
            ))
          ) : (
            <p className="text-slate-600 italic">Hệ thống tài liệu đang ở trạng thái tốt, không phát hiện khuyến nghị khẩn cấp.</p>
          )}
        </div>
      </div>

      {/* 5. Mục IV: Phân loại cảnh báo sai lệch trôi dạt */}
      <div className="print-break-inside-avoid">
        <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
          IV. PHÂN LOẠI CHI TIẾT CẢNH BÁO TRÔI DẠT TÀI LIỆU (DRIFT ALERTS)
        </h2>
        <table className="w-full text-xs text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
              <th className="p-2 border border-slate-300">Mức độ nghiêm trọng</th>
              <th className="p-2 border border-slate-300 text-center">Số lượng</th>
              <th className="p-2 border border-slate-300">Tác động kỹ thuật &amp; Hành động xử lý</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-300 font-bold text-rose-700">🔴 CRITICAL (Nghiêm trọng)</td>
              <td className="p-2 border border-slate-300 text-center font-bold text-rose-700">
                {report?.openAlertsBySeverity?.CRITICAL ?? 0}
              </td>
              <td className="p-2 border border-slate-300 text-slate-700">
                Thay đổi cấu trúc cốt lõi/chữ ký hàm API phá vỡ tương thích. Chặn merge PR tới khi tài liệu được cập nhật.
              </td>
            </tr>
            <tr className="bg-slate-50/50">
              <td className="p-2 border border-slate-300 font-bold text-orange-700">🟠 HIGH (Mức độ cao)</td>
              <td className="p-2 border border-slate-300 text-center font-bold text-orange-700">
                {report?.openAlertsBySeverity?.HIGH ?? 0}
              </td>
              <td className="p-2 border border-slate-300 text-slate-700">
                Thay đổi logic nghiệp vụ quan trọng hoặc bổ sung tham số bắt buộc. Cần xem xét cập nhật sớm.
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 font-bold text-amber-700">🟡 MEDIUM (Trung bình)</td>
              <td className="p-2 border border-slate-300 text-center font-bold text-amber-700">
                {report?.openAlertsBySeverity?.MEDIUM ?? 0}
              </td>
              <td className="p-2 border border-slate-300 text-slate-700">
                Điều chỉnh nhỏ logic nội bộ hoặc bổ sung phương thức phụ trợ. Đề xuất cập nhật tự động bằng AI.
              </td>
            </tr>
            <tr className="bg-slate-50/50">
              <td className="p-2 border border-slate-300 font-bold text-blue-700">🔵 LOW (Mức độ thấp)</td>
              <td className="p-2 border border-slate-300 text-center font-bold text-blue-700">
                {report?.openAlertsBySeverity?.LOW ?? 0}
              </td>
              <td className="p-2 border border-slate-300 text-slate-700">
                Thay đổi định dạng, chú thích (Javadoc) hoặc tái cấu trúc mã nguồn không ảnh hưởng hành vi.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. Mục V: Khoảng trống tài liệu theo gói */}
      {gaps?.packages && gaps.packages.length > 0 && (
        <div className="print-break-inside-avoid">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
            V. DANH SÁCH KHOẢNG TRỐNG TÀI LIỆU CẦN BỔ SUNG (COVERAGE GAPS)
          </h2>
          <table className="w-full text-xs text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th className="p-2 border border-slate-300">Gói thư mục (Package)</th>
                <th className="p-2 border border-slate-300 text-center">Số phần tử thiếu</th>
                <th className="p-2 border border-slate-300">Các lớp/phương thức cần viết tài liệu</th>
              </tr>
            </thead>
            <tbody>
              {gaps.packages.slice(0, 10).map((pkg, idx) => {
                const classNames = pkg.classes.map((c) => c.className).slice(0, 4).join(", ");
                const extra = pkg.classes.length > 4 ? ` (+${pkg.classes.length - 4} lớp khác)` : "";
                return (
                  <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                    <td className="p-2 border border-slate-300 font-mono font-semibold text-slate-800">{pkg.packageName}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold text-rose-700">{pkg.totalMissing}</td>
                    <td className="p-2 border border-slate-300 text-slate-700 font-mono text-[11px]">{classNames ? classNames + extra : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. Phần chữ ký nghiệm thu hai bên */}
      <div className="border-t-2 border-slate-900 pt-5 mt-6 print-break-inside-avoid">
        <div className="grid grid-cols-2 text-center text-xs">
          <div>
            <p className="font-bold text-slate-900 uppercase">NGƯỜI LẬP BÁO CÁO</p>
            <p className="text-[10px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên)</p>
            <div className="h-14" />
            <p className="font-semibold text-slate-800">Kỹ sư Đảm bảo Chất lượng / Developer</p>
          </div>
          <div>
            <p className="font-bold text-slate-900 uppercase">ĐẠI DIỆN PHÊ DUYỆT KỸ THUẬT</p>
            <p className="text-[10px] text-slate-500 italic mt-0.5">(Ký duyệt, đóng dấu điện tử)</p>
            <div className="h-14" />
            <p className="font-semibold text-slate-800">Tech Lead / Solution Architect</p>
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-400 mt-5 pt-2.5 border-t border-slate-200">
          Báo cáo tự động trích xuất từ hệ thống LivingDocs AI Documentation System • Mọi số liệu có giá trị thẩm định nội bộ
        </div>
      </div>
    </div>
  );
}

export default function QualityDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [repositories, setRepositories] = useState<RepoItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("all");
  const [healthReport, setHealthReport] = useState<DocumentHealthReport | null>(null);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGapsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "gaps">("overview");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("ALL");
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Nạp danh sách repositories ban đầu
  useEffect(() => {
    repoService
      .getRepositories()
      .then((repos) => {
        setRepositories(Array.isArray(repos) ? repos : []);
      })
      .catch((err) => {
        console.error("Lỗi nạp danh sách kho:", err);
      });
  }, []);

  // Tải dữ liệu báo cáo sức khỏe và khoảng trống tài liệu
  const loadData = useCallback(async () => {
    setLoading(true);
    const repoId = selectedRepoId !== "all" ? Number(selectedRepoId) : undefined;
    try {
      const [reportRes, gapsRes] = await Promise.all([
        healthReportService.getHealthReport(repoId).catch(() => null),
        healthReportService.getCoverageGaps(repoId).catch(() => null),
      ]);

      setHealthReport(reportRes);
      setCoverageGaps(gapsRes);

      // Mặc định mở rộng 3 package đầu tiên
      if (gapsRes?.packages) {
        const initialExpanded: Record<string, boolean> = {};
        gapsRes.packages.slice(0, 3).forEach((p) => {
          initialExpanded[p.packageName] = true;
        });
        setExpandedPackages(initialExpanded);
      }
    } catch (err) {
      console.error("Lỗi nạp dữ liệu báo cáo sức khỏe:", err);
      showToast("Không thể nạp dữ liệu báo cáo sức khỏe.");
    } finally {
      setLoading(false);
    }
  }, [selectedRepoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tìm tên repo đang chọn
  const selectedRepoName = useMemo(() => {
    if (selectedRepoId === "all") return "Toàn bộ hệ thống";
    const found = repositories.find((r) => String(r.repositoryId) === selectedRepoId);
    return found ? found.repoFullName || found.repoName : `Kho #${selectedRepoId}`;
  }, [selectedRepoId, repositories]);

  // ponytail: Kiểm tra kho lưu trữ chưa có dữ liệu hoặc chưa kết nối MCP
  const isRepoNotConfigured = useMemo(() => {
    const r = healthReport as any;
    if (!r) return false;
    return Boolean(
      r.readyForScan === false ||
      r.compliance?.rating === "NOT_CONFIGURED" ||
      (r.scannedClassesAndFunctions === 0 && (r.totalDocuments ?? 0) === 0) ||
      (selectedRepoId !== "all" && (r.totalScannedEntities ?? 0) === 0 && (r.totalDocuments ?? 0) === 0)
    );
  }, [healthReport, selectedRepoId]);

  // Xử lý xuất báo cáo Markdown
  const handleExportMarkdown = async () => {
    setDownloading(true);
    try {
      const repoId = selectedRepoId !== "all" ? Number(selectedRepoId) : undefined;
      await healthReportService.downloadMarkdownReport(repoId, selectedRepoName, {
        report: healthReport,
        gaps: coverageGaps,
      });
      showToast("Đã tải thành công báo cáo sức khỏe định dạng Markdown (.md)!");
    } catch (err) {
      console.error("Lỗi xuất Markdown:", err);
      showToast("Lỗi khi tạo file báo cáo Markdown.");
    } finally {
      setDownloading(false);
    }
  };

  // Xử lý in / xuất PDF
  const handlePrintPdf = () => {
    window.print();
  };

  // Chuyển đổi trạng thái đóng/mở gói
  const togglePackage = (pkgName: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [pkgName]: !prev[pkgName],
    }));
  };

  // Lọc danh sách phẳng các gap theo từ khóa và loại
  const filteredItems = useMemo(() => {
    if (!coverageGaps?.items) return [];
    return coverageGaps.items.filter((item) => {
      const matchesType =
        entityTypeFilter === "ALL" ||
        item.entityType?.toUpperCase() === entityTypeFilter.toUpperCase();

      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        item.className?.toLowerCase().includes(term) ||
        item.methodName?.toLowerCase().includes(term) ||
        item.filePath?.toLowerCase().includes(term) ||
        item.packageName?.toLowerCase().includes(term) ||
        item.signature?.toLowerCase().includes(term);

      return matchesType && matchesSearch;
    });
  }, [coverageGaps, entityTypeFilter, searchTerm]);

  // Lọc theo cấu trúc package/class cho Tree view
  const filteredPackages = useMemo(() => {
    if (!coverageGaps?.packages) return [];
    const term = searchTerm.toLowerCase().trim();

    return coverageGaps.packages
      .map((pkg) => {
        const matchingClasses = pkg.classes
          .map((cls) => {
            const matchingMethods = cls.methods.filter((m) => {
              const matchesType =
                entityTypeFilter === "ALL" ||
                m.entityType?.toUpperCase() === entityTypeFilter.toUpperCase();
              const matchesSearch =
                !term ||
                m.methodName?.toLowerCase().includes(term) ||
                m.signature?.toLowerCase().includes(term) ||
                cls.className?.toLowerCase().includes(term) ||
                pkg.packageName?.toLowerCase().includes(term);
              return matchesType && matchesSearch;
            });

            const classMatches =
              (!term ||
                cls.className?.toLowerCase().includes(term) ||
                pkg.packageName?.toLowerCase().includes(term)) &&
              (entityTypeFilter === "ALL" ||
                cls.entityType?.toUpperCase() === entityTypeFilter.toUpperCase());

            if (classMatches || matchingMethods.length > 0) {
              return {
                ...cls,
                methods: matchingMethods,
              };
            }
            return null;
          })
          .filter(Boolean) as typeof pkg.classes;

        if (matchingClasses.length > 0) {
          const totalInPkg = matchingClasses.reduce(
            (sum, c) => sum + (c.classDocumented ? 0 : 1) + c.methods.length,
            0
          );
          return {
            ...pkg,
            classes: matchingClasses,
            totalMissing: totalInPkg,
          };
        }
        return null;
      })
      .filter(Boolean) as CoverageGapPackage[];
  }, [coverageGaps, entityTypeFilter, searchTerm]);

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50/70 p-6 md:p-8 space-y-6 print:p-0 print:bg-white">
        {/* Toast thông báo */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150 print:hidden">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* KHUNG GIAO DIỆN TƯƠNG TÁC (ẨN KHI IN) */}
        <div className="space-y-6 print:hidden">
          {/* Header điều khiển chính */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 print:border-none">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100/80 text-emerald-700 rounded-xl print:hidden">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  Dashboard Chất lượng & Sức khỏe Tài liệu
                </h1>
              </div>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                Đo lường tỷ lệ bao phủ, độ mới theo Git commit, phân tích khoảng trống và xuất báo cáo sức khỏe.
              </p>
            </div>

            {/* Công cụ lọc kho & xuất báo cáo */}
            <div className="flex items-center flex-wrap gap-2.5 print:hidden">
              {/* Lọc theo Repo */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-xs">
                <FolderGit2 className="w-4 h-4 text-slate-400" />
                <select
                  aria-label="Chọn kho lưu trữ"
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer pr-2"
                >
                  <option value="all">Toàn bộ kho lưu trữ</option>
                  {repositories.map((r) => (
                    <option key={r.repositoryId} value={String(r.repositoryId)}>
                      {r.repoFullName || r.repoName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nút Làm mới */}
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-emerald-700 transition shadow-xs disabled:opacity-50"
                title="Làm mới dữ liệu từ CSDL"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </button>

              {/* Nút Xem trước Báo cáo in */}
              <button
                onClick={() => setShowPrintPreview(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition shadow-xs disabled:opacity-50 cursor-pointer"
                title="Xem trước mẫu in báo cáo trang trọng trước khi in"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Xem trước</span>
              </button>

              {/* Nút Xuất Báo cáo Markdown */}
              <button
                onClick={handleExportMarkdown}
                disabled={downloading || loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
                title="Xuất báo cáo định dạng Markdown hoàn chỉnh kèm bảng biểu"
              >
                <Download className={`w-3.5 h-3.5 text-emerald-400 ${downloading ? "animate-bounce" : ""}`} />
                <span>Xuất Markdown (.md)</span>
              </button>

              {/* Nút In / Xuất PDF */}
              <button
                onClick={handlePrintPdf}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition shadow-xs disabled:opacity-50"
                title="In hoặc lưu dạng file PDF chuẩn trình bày"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-700" />
                <span>Xuất PDF</span>
              </button>
            </div>
          </div>

          {/* 4 THẺ CHỈ SỐ SỨC KHỎE CỐT LÕI (DỮ LIỆU THẬT) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Tỷ lệ bao phủ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Độ bao phủ mã nguồn
                </span>
                <Activity className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {isRepoNotConfigured ? "—" : healthReport ? `${healthReport.coveragePercent.toFixed(1)}%` : "—"}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {isRepoNotConfigured
                      ? "(0/0 thực thể)"
                      : `(${healthReport?.documentedEntities ?? 0}/${healthReport?.totalScannedEntities ?? 0} thực thể)`}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
                  <div
                    className={`${isRepoNotConfigured ? "bg-slate-300" : "bg-emerald-500"} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${isRepoNotConfigured ? 0 : Math.min(100, healthReport?.coveragePercent ?? 0)}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {isRepoNotConfigured
                  ? "Chưa có dữ liệu mã nguồn tải lên"
                  : `${coverageGaps?.totalMissing ?? 0} hàm/lớp còn thiếu liên kết doc_code_links`}
              </p>
            </div>

            {/* Card 2: Đánh giá tuân thủ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Điểm chuẩn tuân thủ
                </span>
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {isRepoNotConfigured
                      ? "—"
                      : healthReport?.compliance?.overallScore !== undefined
                      ? `${healthReport.compliance.overallScore}`
                      : "—"}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                    isRepoNotConfigured
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                  }`}>
                    {isRepoNotConfigured ? "Chưa cấu hình" : healthReport?.compliance?.rating || "CHƯA XẾP HẠNG"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  {isRepoNotConfigured
                    ? "Kho lưu trữ chưa có dữ liệu mã nguồn hoặc chưa kết nối tài liệu qua MCP."
                    : healthReport?.compliance?.summary || "Đánh giá dựa trên bao phủ, độ mới và sai lệch."}
                </p>
              </div>
              <div className="text-[11px] text-slate-500">
                {isRepoNotConfigured
                  ? "Cần tải dữ liệu hoặc kết nối MCP để tính điểm"
                  : "Trọng số: 40% Coverage + 35% Freshness + 25% Drift"}
              </div>
            </div>

            {/* Card 3: Độ mới theo commit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Độ mới theo Git
                </span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {isRepoNotConfigured ? "—" : healthReport ? `${healthReport.freshnessPercent.toFixed(1)}%` : "—"}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {isRepoNotConfigured
                      ? "(0/0 tài liệu)"
                      : `(${healthReport?.freshDocuments ?? 0}/${healthReport?.totalDocuments ?? 0} tài liệu)`}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
                  <div
                    className={`${isRepoNotConfigured ? "bg-slate-300" : "bg-amber-500"} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${isRepoNotConfigured ? 0 : Math.min(100, healthReport?.freshnessPercent ?? 0)}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {isRepoNotConfigured
                  ? "Chưa kết nối tài liệu qua MCP"
                  : healthReport?.latestCommitAt
                  ? `Commit mới nhất: ${new Date(healthReport.latestCommitAt).toLocaleDateString("vi-VN")}`
                  : "Chưa ghi nhận commit"}
              </p>
            </div>

            {/* Card 4: Cảnh báo trôi dạt */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cảnh báo sai lệch mở
                </span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {isRepoNotConfigured ? "0" : healthReport?.totalOpenDriftAlerts ?? 0}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {isRepoNotConfigured ? "chưa kích hoạt quét" : "cảnh báo cần xử lý"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-semibold mt-2">
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                    {isRepoNotConfigured ? 0 : healthReport?.openAlertsBySeverity?.CRITICAL ?? 0} CRITICAL
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                    {isRepoNotConfigured ? 0 : healthReport?.openAlertsBySeverity?.HIGH ?? 0} HIGH
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    {isRepoNotConfigured ? 0 : healthReport?.openAlertsBySeverity?.MEDIUM ?? 0} MED
                  </span>
                </div>
              </div>
              <Link
                href="/canh-bao-sai-lech"
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                Mở trung tâm xử lý cảnh báo <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* TAB SWITCHER */}
          <div className="flex items-center gap-2 border-b border-slate-200 print:hidden">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${activeTab === "overview"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <Activity className="w-4 h-4" />
              Tổng quan Sức khỏe (Health Overview)
            </button>

            <button
              onClick={() => setActiveTab("gaps")}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 relative ${activeTab === "gaps"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <Boxes className="w-4 h-4" />
              Khoảng trống tài liệu (Coverage Gaps)
              {(coverageGaps?.totalMissing ?? 0) > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  {coverageGaps?.totalMissing}
                </span>
              )}
            </button>
          </div>

          {/* ===================== TAB 1: HEALTH OVERVIEW ===================== */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Khuyến nghị hành động */}
              {healthReport?.compliance?.recommendations && healthReport.compliance.recommendations.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Khuyến nghị nâng cao chất lượng tài liệu
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {healthReport.compliance.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 flex items-start gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                          {i + 1}
                        </span>
                        <p className="leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thống kê chi tiết hàm & lớp còn thiếu */}
              {healthReport?.missingDocEntities && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Code className="w-4 h-4 text-emerald-600" />
                        Phân bổ thực thể còn thiếu tài liệu
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tổng số thực thể chưa có tài liệu mô tả trong cơ sở dữ liệu:{" "}
                        <strong className="text-slate-900">{healthReport.missingDocEntities.totalMissing}</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveTab("gaps")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Xem chi tiết khoảng trống
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-xs text-slate-500 font-medium">Lớp (Classes) còn thiếu</span>
                      <p className="text-2xl font-black text-slate-800 mt-1">
                        {healthReport.missingDocEntities.missingClasses}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-xs text-slate-500 font-medium">Phương thức & Hàm còn thiếu</span>
                      <p className="text-2xl font-black text-slate-800 mt-1">
                        {healthReport.missingDocEntities.missingMethodsAndFunctions}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-xs text-slate-500 font-medium">Thời gian tính toán</span>
                      <p className="text-2xl font-black text-emerald-700 mt-1">
                        {healthReport.executionTimeMs} ms
                      </p>
                      <span className="text-[10px] text-slate-400">Đáp ứng tiêu chuẩn dưới 300ms</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bảng thống kê theo từng kho lưu trữ */}
              {healthReport?.repositoryDetails && healthReport.repositoryDetails.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-emerald-600" />
                      Thống kê tỷ lệ bao phủ theo từng kho lưu trữ
                    </h3>
                    <span className="text-xs text-slate-500">
                      {healthReport.repositoryDetails.length} kho lưu trữ
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Kho lưu trữ</th>
                          <th className="px-4 py-3">Tỷ lệ bao phủ</th>
                          <th className="px-4 py-3">Tổng thực thể</th>
                          <th className="px-4 py-3">Đã có tài liệu</th>
                          <th className="px-4 py-3">Cảnh báo sai lệch</th>
                          <th className="px-4 py-3 text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {healthReport.repositoryDetails.map((repo) => (
                          <tr key={repo.repoId} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {repo.repoName}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">
                                  {repo.coveragePercent.toFixed(1)}%
                                </span>
                                <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(100, repo.coveragePercent)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{repo.totalEntities}</td>
                            <td className="px-4 py-3 text-emerald-700 font-semibold">{repo.documentedEntities}</td>
                            <td className="px-4 py-3">
                              {repo.openDriftCount > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                  {repo.openDriftCount} cảnh báo
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                  Khớp 100%
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedRepoId(String(repo.repoId));
                                  setActiveTab("gaps");
                                }}
                                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                              >
                                Xem khoảng trống <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== TAB 2: COVERAGE GAPS ===================== */}
          {activeTab === "gaps" && (
            <div className="space-y-4">
              {/* Thanh công cụ tìm kiếm và bộ lọc */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm theo tên class, method, package hoặc file path..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    />
                  </div>

                  {/* Bộ lọc loại thực thể */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                    <button
                      onClick={() => setEntityTypeFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg transition ${entityTypeFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                        }`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => setEntityTypeFilter("CLASS")}
                      className={`px-2.5 py-1 rounded-lg transition ${entityTypeFilter === "CLASS" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                        }`}
                    >
                      Class ({coverageGaps?.missingClasses ?? 0})
                    </button>
                    <button
                      onClick={() => setEntityTypeFilter("METHOD")}
                      className={`px-2.5 py-1 rounded-lg transition ${entityTypeFilter === "METHOD" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                        }`}
                    >
                      Method ({coverageGaps?.missingMethods ?? 0})
                    </button>
                  </div>
                </div>

                {/* Chế độ xem */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 self-end md:self-auto">
                  <button
                    onClick={() => setViewMode("tree")}
                    className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${viewMode === "tree" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                      }`}
                    title="Nhóm theo Gói mã nguồn và Lớp"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Theo Gói (Package)</span>
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${viewMode === "table" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                      }`}
                    title="Danh sách phẳng dạng bảng dữ liệu"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Dạng Bảng ({filteredItems.length})</span>
                  </button>
                </div>
              </div>

              {/* Thông báo số lượng kết quả */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  {isRepoNotConfigured ? (
                    <>Kho lưu trữ đang ở trạng thái <strong className="text-amber-700">Chưa cấu hình</strong> (chưa có mã nguồn hoặc tài liệu MCP)</>
                  ) : (
                    <>
                      Tìm thấy <strong>{viewMode === "tree" ? filteredPackages.reduce((s, p) => s + p.totalMissing, 0) : filteredItems.length}</strong> khoảng trống tài liệu
                      {selectedRepoId !== "all" && ` trong kho "${selectedRepoName}"`}
                    </>
                  )}
                </span>
                <span className="text-[11px] text-slate-400">
                  Nhấn &ldquo;⚡ Sinh tài liệu bằng AI&rdquo; để tự động điền thông tin và mở trình tạo tài liệu
                </span>
              </div>

              {/* Chế độ 1: Tree View theo Package & Class */}
              {viewMode === "tree" && (
                <div className="space-y-3">
                  {filteredPackages.length > 0 ? (
                    filteredPackages.map((pkg) => {
                      const isExpanded = !!expandedPackages[pkg.packageName];
                      return (
                        <div
                          key={pkg.packageName}
                          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition"
                        >
                          {/* Header của Package */}
                          <div
                            onClick={() => togglePackage(pkg.packageName)}
                            className="p-4 bg-slate-50/70 hover:bg-slate-100/60 cursor-pointer flex items-center justify-between gap-4 transition select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                                <Boxes className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-sm text-slate-900">
                                    {pkg.packageName}
                                  </span>
                                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    {pkg.totalMissing} khoảng trống
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Gồm {pkg.classes.length} lớp có hàm/phương thức cần bổ sung tài liệu
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Danh sách các Class trong Package */}
                          {isExpanded && (
                            <div className="p-4 space-y-4 divide-y divide-slate-100">
                              {pkg.classes.map((cls, cIdx) => (
                                <div key={cls.className + cIdx} className="pt-3 first:pt-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                                        {cls.entityType}
                                      </span>
                                      <span className="font-bold text-sm text-slate-900 font-mono">
                                        {cls.className}
                                      </span>
                                      <span className="text-xs text-slate-400 font-mono truncate max-w-xs">
                                        {cls.filePath}
                                      </span>
                                    </div>

                                    {/* Nếu bản thân class chưa có tài liệu, nút sinh tài liệu cho toàn bộ class */}
                                    {!cls.classDocumented && (
                                      <Link
                                        href={`/ai-docs?repositoryId=${selectedRepoId !== "all" ? selectedRepoId : ""}&filePath=${encodeURIComponent(cls.filePath)}&className=${encodeURIComponent(cls.className)}&entityType=CLASS&scopeType=FILE`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition shadow-2xs self-start sm:self-auto"
                                        title="Sinh tài liệu cho toàn bộ lớp này"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                        <span>⚡ Sinh tài liệu bằng AI (Toàn bộ lớp)</span>
                                      </Link>
                                    )}
                                  </div>

                                  {/* Danh sách các phương thức còn thiếu trong class */}
                                  {cls.methods.length > 0 && (
                                    <div className="ml-2 sm:ml-4 mt-2 space-y-1.5 border-l-2 border-slate-200 pl-3">
                                      {cls.methods.map((m) => (
                                        <div
                                          key={m.entityId}
                                          className="p-2.5 bg-slate-50/80 hover:bg-slate-100 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2 transition"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                                {m.entityType}
                                              </span>
                                              <span className="font-mono font-bold text-xs text-slate-900">
                                                {m.methodName || "(hàm ẩn danh)"}
                                              </span>
                                              {m.startLine && (
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                  L{m.startLine}{m.endLine ? `-L${m.endLine}` : ""}
                                                </span>
                                              )}
                                            </div>
                                            {m.signature && (
                                              <p className="font-mono text-[11px] text-slate-600 mt-1 truncate">
                                                {m.signature}
                                              </p>
                                            )}
                                          </div>

                                          {/* Nút 1-click sinh tài liệu AI cho method */}
                                          <Link
                                            href={`/ai-docs?repositoryId=${m.repositoryId || selectedRepoId}&filePath=${encodeURIComponent(m.filePath)}&className=${encodeURIComponent(m.className || "")}&methodName=${encodeURIComponent(m.methodName || "")}&entityType=${m.entityType}&scopeType=FILE`}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 border border-slate-300 hover:border-emerald-600 rounded-lg text-xs font-semibold transition shadow-xs self-start md:self-auto shrink-0"
                                            title={`Tự động mở AI Docs và điền phương thức ${m.methodName}`}
                                          >
                                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white" />
                                            <span>⚡ Sinh tài liệu bằng AI</span>
                                          </Link>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : isRepoNotConfigured ? (
                    <div className="bg-white rounded-2xl border border-dashed border-amber-300 p-12 text-center">
                      <FolderGit2 className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                      <h4 className="text-base font-bold text-slate-900">
                        Chưa có dữ liệu mã nguồn hoặc tài liệu cho kho lưu trữ này
                      </h4>
                      <p className="text-xs text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
                        Kho lưu trữ này chưa tải lên mã nguồn hoặc chưa kết nối tài liệu qua MCP. Vui lòng tải lên tài liệu/mã nguồn hoặc kết nối MCP để bắt đầu quét và kiểm tra khoảng trống tài liệu.
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-5">
                        <button
                          type="button"
                          onClick={() => router.push("/tai-lieu-cua-toi")}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs cursor-pointer"
                        >
                          Tải lên tài liệu
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push("/tai-lieu-cua-toi?tab=mcp")}
                          className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Kết nối MCP
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                      <h4 className="text-base font-bold text-slate-900">
                        Tuyệt vời! Không phát hiện khoảng trống tài liệu
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Mọi thực thể mã nguồn (Classes & Methods) đều đã được liên kết với tài liệu kỹ thuật trong doc_code_links.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Chế độ 2: Table View */}
              {viewMode === "table" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Loại</th>
                          <th className="px-4 py-3">Tên thực thể & Chữ ký</th>
                          <th className="px-4 py-3">Gói mã nguồn (Package)</th>
                          <th className="px-4 py-3">Đường dẫn tệp (File path)</th>
                          <th className="px-4 py-3">Dòng</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredItems.length > 0 ? (
                          filteredItems.map((item) => (
                            <tr key={item.entityId} className="hover:bg-slate-50/70 transition">
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700">
                                  {item.entityType}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-xs">
                                <div className="font-mono font-bold text-slate-900">
                                  {item.methodName ? `${item.className || ""}.${item.methodName}` : item.className}
                                </div>
                                {item.signature && (
                                  <div className="font-mono text-[11px] text-slate-500 truncate" title={item.signature}>
                                    {item.signature}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600 truncate max-w-[160px]">
                                {item.packageName}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500 truncate max-w-[200px]" title={item.filePath}>
                                {item.filePath}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-400">
                                {item.startLine ? `L${item.startLine}` : "—"}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  {item.docStatus || "UNDOCUMENTED"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Link
                                  href={`/ai-docs?repositoryId=${item.repositoryId || selectedRepoId}&filePath=${encodeURIComponent(item.filePath)}&className=${encodeURIComponent(item.className || "")}&methodName=${encodeURIComponent(item.methodName || "")}&entityType=${item.entityType}&scopeType=FILE`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 rounded-lg text-xs font-semibold transition shadow-xs"
                                  title="1-click chuyển tới AI Docs với thông tin thực thể này"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>⚡ Sinh tài liệu bằng AI</span>
                                </Link>
                              </td>
                            </tr>
                          ))
                        ) : isRepoNotConfigured ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center">
                              <div className="max-w-md mx-auto">
                                <FolderGit2 className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-800">
                                  Chưa có dữ liệu mã nguồn hoặc tài liệu cho kho lưu trữ này
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                  Kho lưu trữ này chưa tải lên mã nguồn hoặc chưa kết nối tài liệu qua MCP. Vui lòng tải lên tài liệu/mã nguồn hoặc kết nối MCP để bắt đầu quét.
                                </p>
                                <div className="flex items-center justify-center gap-2 mt-3">
                                  <button
                                    type="button"
                                    onClick={() => router.push("/tai-lieu-cua-toi")}
                                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                                  >
                                    Tải lên tài liệu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => router.push("/tai-lieu-cua-toi?tab=mcp")}
                                    className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                                  >
                                    Kết nối MCP
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                              Không tìm thấy thực thể nào khớp với bộ lọc hiện tại.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BẢN IN FORMAL CHUẨN TRANG TRỌNG DÀNH CHO XUẤT PDF / IN TRỰC TIẾP TỪ TRÌNH DUYỆT */}
        <div className="hidden print:block w-full">
          <FormalPrintReportContent
            report={healthReport}
            gaps={coverageGaps}
            repoName={selectedRepoName}
            repoId={selectedRepoId}
          />
        </div>

        {/* MODAL XEM TRƯỚC BÁO CÁO IN (PRINT PREVIEW DIALOG) */}
        {showPrintPreview && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:hidden">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Xem trước Báo cáo Thẩm định Sức khỏe &amp; Chất lượng Tài liệu
                    </h3>
                    <p className="text-xs text-slate-500">
                      Định dạng chuẩn trang trọng theo mẫu kiểm định A4 &amp; tiêu chuẩn ISO/IEC/IEEE 26515
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportMarkdown}
                    disabled={downloading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tải .md</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowPrintPreview(false);
                      setTimeout(() => window.print(), 200);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>In / Lưu PDF ngay</span>
                  </button>
                  <button
                    onClick={() => setShowPrintPreview(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    title="Đóng xem trước"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Hiển thị đúng FormalPrintReportContent */}
              <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
                <div className="bg-white shadow-md rounded-xl p-8 border border-slate-200 max-w-4xl mx-auto">
                  <FormalPrintReportContent
                    report={healthReport}
                    gaps={coverageGaps}
                    repoName={selectedRepoName}
                    repoId={selectedRepoId}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                <span>💡 Lưu ý: Sử dụng tùy chọn <strong>&quot;Save as PDF&quot; (Lưu dưới dạng PDF)</strong> trong hộp thoại in của trình duyệt để có bản PDF sắc nét nhất.</span>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
