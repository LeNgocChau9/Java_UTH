"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/AppShell";
import { documentService } from "@/services/documentService";
import { repoService, type RepoItem } from "@/services/repoService";
import type { DocCollection, DocumentDetail, DocumentItem, GroundingEvidenceItem } from "@/types/document";
import { ExternalLink, Folder, GitCommit, ShieldCheck } from "lucide-react";

type TocItem = { id: string; level: number; text: string };

function headingText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(headingText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return headingText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "muc";
}

function extractToc(markdown: string): TocItem[] {
  const used = new Map<string, number>();
  let inFence = false;
  return markdown.split(/\r?\n/).flatMap((line) => {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      return [];
    }
    if (inFence) return [];
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (!match) return [];
    const text = match[2].replace(/[*_`]/g, "").trim();
    const base = slugify(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return [{ id: count === 0 ? base : `${base}-${count}`, level: match[1].length, text }];
  });
}

function MermaidChart({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("mermaid")
      .then(async (mod) => {
        const mermaid = mod.default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const rendered = await mermaid.render(id, chart);
        if (!cancelled) setSvg(rendered.svg);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (failed) {
    return <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs">{chart}</pre>;
  }
  if (!svg) {
    return <p className="text-xs text-slate-500">Đang vẽ sơ đồ...</p>;
  }
  return <div className="my-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function PublicDocsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [collections, setCollections] = useState<DocCollection[]>([]);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [links, setLinks] = useState<GroundingEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      documentService.getDocuments({ status: "PUBLISHED" }),
      documentService.getCollections().catch(() => [] as DocCollection[]),
      repoService.getRepositories().catch(() => [] as RepoItem[]),
    ])
      .then(([docs, cols, repoList]) => {
        const published = docs.filter((doc) => doc.status === "PUBLISHED");
        setDocuments(published);
        setCollections(cols);
        setRepos(repoList);
        if (published[0]) setSelectedId(published[0].docId);
      })
      .catch(() => setError("Không tải được tài liệu đã xuất bản."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    Promise.all([
      documentService.getDocumentById(selectedId),
      documentService.getDocumentCodeLinks(selectedId).catch(() => [] as GroundingEvidenceItem[]),
    ]).then(([doc, codeLinks]) => {
      if (cancelled) return;
      if (doc.status !== "PUBLISHED") {
        setDetail(null);
        setLinks([]);
        return;
      }
      setDetail(doc);
      setLinks(codeLinks);
    }).catch(() => {
      if (!cancelled) setError("Không mở được tài liệu đã chọn.");
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const groups = useMemo(() => {
    const named = collections
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        docs: documents.filter((doc) => doc.collectionId === collection.id),
      }))
      .filter((group) => group.docs.length > 0);
    const loose = documents.filter((doc) => !doc.collectionId);
    if (loose.length > 0) {
      named.push({ id: 0, name: "Chưa xếp bộ sưu tập", docs: loose });
    }
    return named;
  }, [collections, documents]);

  const markdown = detail?.latestVersion?.content || detail?.versionHistory?.[0]?.content || "";
  const toc = useMemo(() => extractToc(markdown), [markdown]);
  const repo = repos.find((item) => item.repositoryId === detail?.repoId);
  const commitUrl = detail?.latestVersion?.commitUrl || detail?.versionHistory?.[0]?.commitUrl;
  const sourceUrl = repo && detail?.targetPath
    ? `https://github.com/${repo.repoFullName}/blob/${repo.defaultBranch || "main"}/${detail.targetPath.replace(/^\//, "")}`
    : null;
  const grounded = links.length > 0;
  const usedHeadingIds = new Map<string, number>();
  const nextHeadingId = (children: ReactNode) => {
    const base = slugify(headingText(children));
    const count = usedHeadingIds.get(base) ?? 0;
    usedHeadingIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)_200px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3">
          <h1 className="px-2 text-sm font-bold text-slate-900">Tài liệu công khai</h1>
          <p className="px-2 pb-2 text-xs text-slate-500">Chỉ các bản đã xuất bản.</p>
          {loading && <p className="px-2 text-xs text-slate-500">Đang tải...</p>}
          {!loading && groups.length === 0 && (
            <p className="px-2 text-xs text-slate-500">Chưa có tài liệu PUBLISHED.</p>
          )}
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="flex items-center gap-1 px-2 text-xs font-semibold text-emerald-800">
                  <Folder size={12} /> {group.name}
                </p>
                <ul className="mt-1 space-y-1">
                  {group.docs.map((doc) => (
                    <li key={doc.docId}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(doc.docId)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                          selectedId === doc.docId ? "bg-emerald-50 font-semibold text-emerald-900" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {doc.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-6">
          {error && <p className="text-sm text-rose-700">{error}</p>}
          {detail && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{detail.title}</h2>
                {grounded && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    <ShieldCheck size={12} /> AST Grounded
                  </span>
                )}
              </div>
              <div className="mb-5 flex flex-wrap gap-2 text-xs">
                {commitUrl && (
                  <a href={commitUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-emerald-800">
                    <GitCommit size={12} /> Mở commit
                  </a>
                )}
                {sourceUrl && (
                  <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-emerald-800">
                    <ExternalLink size={12} /> Mở file nguồn
                  </a>
                )}
              </div>
              <div className="prose-doc text-sm leading-7 text-slate-800 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-3">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 id={nextHeadingId(children)}>{children}</h1>,
                    h2: ({ children }) => <h2 id={nextHeadingId(children)}>{children}</h2>,
                    h3: ({ children }) => <h3 id={nextHeadingId(children)}>{children}</h3>,
                    code: ({ className, children }) => {
                      const text = String(children).replace(/\n$/, "");
                      if (className === "language-mermaid") return <MermaidChart chart={text} />;
                      return <code className={className}>{children}</code>;
                    },
                  }}
                >
                  {markdown || "_Tài liệu chưa có nội dung._"}
                </ReactMarkdown>
              </div>
            </>
          )}
          {!detail && !loading && (
            <p className="text-sm text-slate-500">Chọn một tài liệu đã xuất bản ở cây bên trái.</p>
          )}
        </article>

        <aside className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="px-2 text-xs font-bold uppercase tracking-wide text-slate-500">On this page</p>
          <ul className="mt-2 space-y-1">
            {toc.map((item) => (
              <li key={item.id} style={{ paddingLeft: (item.level - 1) * 10 }}>
                <a href={`#${item.id}`} className="block rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                  {item.text}
                </a>
              </li>
            ))}
            {toc.length === 0 && <li className="px-2 text-xs text-slate-400">Không có đề mục H1–H3.</li>}
          </ul>
          <Link href="/tai-lieu-cua-toi" className="mt-4 block px-2 text-xs font-semibold text-emerald-800">
            Về tài liệu nội bộ
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
