import type { CoverageGapsResponse, DocumentHealthReport } from "@/services/healthReportService";

function num(value: number | null | undefined, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function bar(label: string, value: number | null | undefined, color: string, unit = "%"): string {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return `
    <div style="margin: 8px 0 12px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span>${label}</span><strong>${num(value)}${unit}</strong>
      </div>
      <div style="height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
        <div style="height:10px;width:${width}%;background:${color};"></div>
      </div>
    </div>`;
}

export function printHealthReport(input: {
  report: DocumentHealthReport | null;
  gaps: CoverageGapsResponse | null;
  repoName: string;
}) {
  const report = input.report;
  const now = new Date();
  const score = report?.compliance?.overallScore;
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Báo cáo sức khỏe tài liệu</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { margin: 0; color: #0f172a; font-family: "Segoe UI", Arial, sans-serif; font-size: 12px; line-height: 1.45; }
    h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
    h2 { font-size: 13px; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    .meta { width: 100%; border: 0; margin-top: 12px; }
    .meta td { border: 0; padding: 2px 8px; }
  </style>
</head>
<body>
  <p style="font-size:11px;letter-spacing:.04em;font-weight:700;">HỆ THỐNG LIVINGDOCS</p>
  <h1>BÁO CÁO SỨC KHỎE TÀI LIỆU</h1>
  <p style="text-align:center;color:#64748b;margin-top:0;">${now.toLocaleString("vi-VN")}</p>
  <table class="meta">
    <tr><td>Kho</td><td><strong>${input.repoName}</strong></td><td>Thời gian phân tích</td><td>${report ? `${report.executionTimeMs} ms` : "—"}</td></tr>
    <tr><td>Xếp hạng</td><td>${report?.compliance?.rating ?? "—"}</td><td>Điểm tuân thủ</td><td>${score ?? "—"} / 100</td></tr>
  </table>
  <h2>Biểu đồ độ bao phủ</h2>
  ${bar("Độ bao phủ mã nguồn", report?.coveragePercent, "#047857")}
  ${bar("Độ mới theo commit", report?.freshnessPercent, "#b45309")}
  ${bar("Điểm tuân thủ", score, "#1d4ed8", "/100")}
  <h2>Bảng chỉ số</h2>
  <table>
    <thead><tr><th>Chỉ số</th><th>Giá trị</th><th>Chi tiết</th></tr></thead>
    <tbody>
      <tr><td>Độ bao phủ</td><td>${num(report?.coveragePercent, 2)}%</td><td>${report?.documentedEntities ?? "—"} / ${report?.totalScannedEntities ?? "—"} thực thể có tài liệu</td></tr>
      <tr><td>Độ mới</td><td>${num(report?.freshnessPercent, 2)}%</td><td>${report?.freshDocuments ?? "—"} / ${report?.totalDocuments ?? "—"} tài liệu khớp HEAD</td></tr>
      <tr><td>Cảnh báo sai lệch đang mở</td><td>${report?.totalOpenDriftAlerts ?? "—"}</td><td>Critical ${report?.openAlertsBySeverity?.CRITICAL ?? 0} · High ${report?.openAlertsBySeverity?.HIGH ?? 0}</td></tr>
      <tr><td>Điểm kiểm soát sai lệch</td><td>${report?.compliance ? num(report.compliance.driftControlScore, 1) : "—"}</td><td>${report?.compliance?.summary ?? "Chưa có nhận định."}</td></tr>
      <tr><td>Khoảng trống tài liệu</td><td>${input.gaps?.totalMissing ?? "—"}</td><td>Lớp ${input.gaps?.missingClasses ?? "—"} · Phương thức ${input.gaps?.missingMethods ?? "—"}</td></tr>
    </tbody>
  </table>
  ${report?.repositoryDetails?.length ? `<h2>Theo từng kho</h2><table><thead><tr><th>Kho</th><th>Bao phủ</th><th>Đã viết</th><th>Sai lệch mở</th></tr></thead><tbody>${report.repositoryDetails.map((repo) => `<tr><td>${repo.repoName}</td><td>${num(repo.coveragePercent, 1)}%</td><td>${repo.documentedEntities}/${repo.totalEntities}</td><td>${repo.openDriftCount}</td></tr>`).join("")}</tbody></table>` : ""}
  ${report?.compliance?.recommendations?.length ? `<h2>Khuyến nghị</h2><ol>${report.compliance.recommendations.map((item) => `<li>${item}</li>`).join("")}</ol>` : ""}
</body>
</html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Báo cáo sức khỏe tài liệu");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Không mở được khung in.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 1000);
}
