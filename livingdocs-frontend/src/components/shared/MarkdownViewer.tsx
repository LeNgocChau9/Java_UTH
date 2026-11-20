"use client";

import { useEffect, useRef, useState, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code, Eye, ZoomIn, ZoomOut, Copy, Check, AlertTriangle } from "lucide-react";

type MarkdownViewerProps = {
  content: string;
  className?: string;
};

/**
 * Component hiển thị đồ họa SVG Mermaid trực quan cho các khối mã ```mermaid ... ```
 */
function MermaidBlock({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "_");
  const uniqueId = `mermaid_${rawId}`;

  // Tự động nhận diện loại biểu đồ Mermaid
  const chartType = (() => {
    const firstLine = chart.trim().split("\n")[0].trim().toLowerCase();
    if (firstLine.startsWith("flowchart") || firstLine.startsWith("graph")) return "Flowchart (Luồng xử lý)";
    if (firstLine.startsWith("sequencediagram")) return "Sequence Diagram (Trình tự gọi hàm)";
    if (firstLine.startsWith("erdiagram")) return "ER Diagram (Thực thể & CSDL)";
    if (firstLine.startsWith("classdiagram")) return "Class Diagram (Cấu trúc Lớp)";
    if (firstLine.startsWith("statediagram")) return "State Diagram (Trạng thái)";
    return "Sơ đồ Kiến trúc Mermaid";
  })();

  useEffect(() => {
    let isCancelled = false;

    async function renderMermaid() {
      try {
        setError(null);
        let mermaidInstance: any = (window as any).mermaid;
        if (!mermaidInstance) {
          try {
            const m = await import("mermaid");
            mermaidInstance = m.default || m;
          } catch {
            // Nạp từ CDN ESM nếu bundle client chưa tải sẵn
            const cdnUrl = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
            const m: any = await import(/* webpackIgnore: true */ cdnUrl);
            mermaidInstance = m.default || m;
          }
          (window as any).mermaid = mermaidInstance;
        }

        mermaidInstance.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          flowchart: { htmlLabels: true, curve: "basis" },
          sequence: { actorMargin: 50 },
        });

        const cleanChart = chart.trim();
        const { svg: renderedSvg } = await mermaidInstance.render(uniqueId, cleanChart);
        if (!isCancelled) {
          setSvg(renderedSvg);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("[MermaidViewer] Lỗi render sơ đồ:", err);
          setError(err?.message || "Cú pháp sơ đồ Mermaid chưa hợp lệ");
        }
      }
    }

    renderMermaid();

    return () => {
      isCancelled = true;
      const tempEl = document.getElementById(uniqueId);
      if (tempEl) tempEl.remove();
    };
  }, [chart, uniqueId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chart.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-5 overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all">
      {/* Header thanh công cụ điều khiển sơ đồ Mermaid */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-text-primary">{chartType}</span>
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-accent">SVG</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom Controls */}
          {!error && svg && !showCode && (
            <div className="flex items-center gap-0.5 border-r border-border pr-2 mr-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))}
                className="rounded p-1 text-text-secondary hover:bg-muted hover:text-text-primary"
                title="Phóng to"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
                className="rounded p-1 text-text-secondary hover:bg-muted hover:text-text-primary"
                title="Thu nhỏ"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1.0)}
                className="rounded p-1 text-text-secondary hover:bg-muted hover:text-text-primary text-[10px] font-mono"
                title="Đặt lại 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
            </div>
          )}

          {/* Toggle Code / Preview */}
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
              showCode ? "bg-accent text-white" : "text-text-secondary hover:bg-muted hover:text-text-primary"
            }`}
            title={showCode ? "Xem đồ họa SVG" : "Xem mã nguồn Mermaid"}
          >
            {showCode ? <Eye size={12} /> : <Code size={12} />}
            <span className="text-[11px]">{showCode ? "Xem đồ họa" : "Mã nguồn"}</span>
          </button>

          {/* Copy code */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded p-1 text-text-secondary hover:bg-muted hover:text-text-primary"
            title="Sao chép cú pháp Mermaid"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Nội dung: Hiển thị SVG đồ họa hoặc Khối code */}
      {showCode ? (
        <pre className="m-0 overflow-x-auto bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
          <code>{chart.trim()}</code>
        </pre>
      ) : error ? (
        <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium mb-1.5">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
            <span>Không thể kết xuất đồ họa Mermaid trực quan: {error}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Bạn có thể bấm &quot;Mã nguồn&quot; ở góc phải để xem cú pháp biểu đồ thô.
          </p>
          <pre className="overflow-x-auto rounded bg-muted/60 p-2.5 font-mono text-[11px]">
            {chart.trim()}
          </pre>
        </div>
      ) : svg ? (
        <div
          ref={containerRef}
          className="flex justify-center items-center overflow-x-auto p-4 transition-transform bg-white/50 dark:bg-slate-950/40"
          style={{ minHeight: "140px" }}
        >
          <div
            className="transition-transform duration-150 ease-out origin-center max-w-full"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 p-6 text-xs text-text-secondary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Đang tạo biểu đồ SVG Mermaid...</span>
        </div>
      )}
    </div>
  );
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div
      className={`min-w-0 overflow-x-auto text-sm leading-7 text-text-primary [&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:text-text-secondary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:mb-4 [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:my-6 [&_hr]:border-border [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 ${className ?? ""}`.trim()}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const lang = match ? match[1].toLowerCase() : "";
            const rawContent = String(children).replace(/\n$/, "");

            if (!inline && lang === "mermaid") {
              return <MermaidBlock chart={rawContent} />;
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
