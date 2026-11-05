"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { repoService, RepoItem, GitHubFileItem } from "@/services/repoService";
import { codeEntityService, CodeEntityDto } from "@/services/codeEntityService";
import { documentService } from "@/services/documentService";
import { parseUniversalCodeEntities } from "@/utils/universalCodeParser";
import type { DocumentItem, GroundingEvidenceItem } from "@/types/document";
import {
  GitFork,
  FileCode,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Layers,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Eye,
  Activity,
  Code2,
  Database,
  RotateCcw,
  Compass,
  ArrowUp,
} from "lucide-react";
import Link from "next/link";

interface GraphNode {
  id: string;
  name: string;
  type: "REPO" | "CLASS" | "METHOD" | "DOC";
  filePath?: string;
  signature?: string;
  docStatus?: "DOCUMENTED" | "DRIFTED" | "UNDOCUMENTED";
  x: number;
  y: number;
  docId?: number;
  entityId?: number;
  docTitle?: string;
  version?: string;
  description?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "CONTAINS" | "CALLS" | "DOCUMENTS";
  status?: "DOCUMENTED" | "DRIFTED" | "UNDOCUMENTED";
}

export default function DoThiLienKetPage() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Real Data states
  const [rawFiles, setRawFiles] = useState<string[]>([]);
  const [dbEntities, setDbEntities] = useState<CodeEntityDto[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [codeLinksMap, setCodeLinksMap] = useState<Record<number, GroundingEvidenceItem[]>>({});
  const [parsedEntities, setParsedEntities] = useState<CodeEntityDto[]>([]);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"GRAPH" | "TABLE">("GRAPH");

  // Interactive selection & Zoom
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(0.9);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 1. Tải danh sách Repositories THẬT từ Backend DB
  useEffect(() => {
    async function initRepos() {
      setLoading(true);
      try {
        const repoList = await repoService.getRepositories();
        setRepos(repoList);
        if (repoList.length > 0) {
          const preferredRepo =
            repoList.find((r) => r.repoFullName?.includes("Review_JavaSpringBoot")) ||
            repoList.find((r) => r.repoFullName?.includes("Java_UTH")) ||
            repoList[0];
          setSelectedRepoId(preferredRepo.repositoryId);
        }
      } catch (err) {
        console.error("Không thể tải danh sách repositories:", err);
      } finally {
        setLoading(false);
      }
    }
    initRepos();
  }, []);

  // 2. Tải Dữ liệu THẬT (Git Tree, Documents, Code Links, Code Entities) của Repo được chọn
  useEffect(() => {
    if (!selectedRepoId) return;

    async function loadRealRepoData() {
      const currentRepo = repos.find((r) => r.repositoryId === selectedRepoId);
      if (!currentRepo) return;
      const repoFullName = currentRepo.repoFullName;
      const defaultBranch = currentRepo.defaultBranch || "main";
      setLoadingDetails(true);
      try {
        // A. Tải danh sách Documents thật của repo
        const docList = await documentService
          .getDocuments({ repoId: selectedRepoId! })
          .catch(() => [] as DocumentItem[]);
        setDocuments(docList);

        // B. Tải các doc_code_links thật cho từng document
        const linksObj: Record<number, GroundingEvidenceItem[]> = {};
        await Promise.all(
          docList.map(async (doc) => {
            try {
              const links = await documentService.getDocumentCodeLinks(doc.docId);
              if (links && links.length > 0) {
                linksObj[doc.docId] = links;
              }
            } catch {
              // ignore
            }
          })
        );
        setCodeLinksMap(linksObj);

        // C. Tải Code Entities từ CSDL backend nếu đã có
        const entitiesFromDb = await codeEntityService
          .getByRepository(selectedRepoId!)
          .catch(() => [] as CodeEntityDto[]);
        setDbEntities(entitiesFromDb);

        // D. Tải Cây thư mục (Git Tree) THẬT từ backend hoặc GitHub API
        let treeFiles: string[] = [];
        try {
          const treeRes = await repoService.getRepositoryTree(selectedRepoId!);
          if (treeRes && treeRes.length > 0) {
            treeFiles = treeRes
              .filter((item: GitHubFileItem) => item.type === "blob" || item.path?.includes("."))
              .map((item: GitHubFileItem) => item.path);
          }
        } catch {
          // fallback sang GitHub public tree API
        }

        if (treeFiles.length === 0 && repoFullName) {
          try {
            const ghRes = await fetch(
              `https://api.github.com/repos/${repoFullName}/git/trees/${defaultBranch}?recursive=1`
            );
            if (ghRes.ok) {
              const ghData = await ghRes.json();
              if (ghData && Array.isArray(ghData.tree)) {
                treeFiles = ghData.tree
                  .filter((item: any) => item.type === "blob" || item.path?.includes("."))
                  .map((item: any) => item.path);
              }
            }
          } catch (ghErr) {
            console.warn("Không thể tải Git Tree từ GitHub:", ghErr);
          }
        }
        setRawFiles(treeFiles);

        // E. Bóc tách AST THẬT từ các file mã nguồn chính trong repo
        const codeFiles = treeFiles.filter((f) =>
          /\.(java|py|ts|tsx|js|cs|cpp|h)$/i.test(f) &&
          !f.includes(".git") &&
          !f.includes("target/") &&
          !f.includes("build/") &&
          !f.includes("node_modules/")
        );

        // Lấy tối đa 5 file code cốt lõi để tải mã nguồn thật và parse AST
        const candidateFiles = codeFiles.slice(0, 5);
        const newlyParsed: CodeEntityDto[] = [];

        await Promise.all(
          candidateFiles.map(async (filePath) => {
            try {
              const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/${defaultBranch}/${filePath}`;
              const resp = await fetch(rawUrl);
              if (resp.ok) {
                const text = await resp.text();
                const parsed = parseUniversalCodeEntities(filePath, text, selectedRepoId!);
                if (parsed && parsed.length > 0) {
                  newlyParsed.push(...parsed);
                }
              }
            } catch {
              // ignore
            }
          })
        );

        setParsedEntities(newlyParsed);
        setSelectedNode(null);
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu thật cho đồ thị:", err);
      } finally {
        setLoadingDetails(false);
      }
    }

    loadRealRepoData();
  }, [selectedRepoId, repos]);

  // 3. XÂY DỰNG CẤU TRÚC ĐỒ THỊ GỌN GÀNG (COMPACT HIERARCHICAL GRAPH)
  const { nodes, edges, stats } = useMemo(() => {
    const selectedRepo = repos.find((r) => r.repositoryId === selectedRepoId);
    const repoName = selectedRepo?.repoFullName || selectedRepo?.repoName || "Repository";

    const nodeList: GraphNode[] = [];
    const edgeList: GraphEdge[] = [];
    const repoNodeId = `repo-${selectedRepoId}`;

    // Gom tập hợp tất cả entities thật (từ DB + từ AST parser của mã nguồn thật + từ doc_code_links)
    const allEntities = [...dbEntities, ...parsedEntities];

    // Lấy danh sách Class thật
    const realClassesMap = new Map<string, { className: string; filePath: string; signature?: string; entityId?: number }>();

    // 1. Từ AST Entities thật
    allEntities.forEach((ent) => {
      const clsName =
        ent.className ||
        ent.signature?.split("class ")?.[1]?.split(" ")?.[0] ||
        ent.filePath.split("/").pop()?.replace(/\.\w+$/, "");
      if (clsName && !realClassesMap.has(clsName)) {
        realClassesMap.set(clsName, {
          className: clsName,
          filePath: ent.filePath,
          signature: ent.signature,
          entityId: ent.entityId,
        });
      }
    });

    // 2. Từ doc_code_links thật trong DB
    Object.values(codeLinksMap).forEach((linkList) => {
      linkList.forEach((link) => {
        if (link.className && !realClassesMap.has(link.className)) {
          realClassesMap.set(link.className, {
            className: link.className,
            filePath: link.filePath,
            signature: `class ${link.className}`,
          });
        }
      });
    });

    // 3. Fallback từ cây tệp tin
    if (realClassesMap.size === 0 && rawFiles.length > 0) {
      const codeFiles = rawFiles.filter((f) => /\.(java|ts|tsx|py|cs|cpp)$/i.test(f));
      codeFiles.slice(0, 6).forEach((f) => {
        const baseName = f.split("/").pop()?.replace(/\.\w+$/, "") || "Module";
        realClassesMap.set(baseName, {
          className: baseName,
          filePath: f,
          signature: `class ${baseName}`,
        });
      });
    }

    // Giới hạn số lớp hiển thị trọng tâm để đồ thị thoáng đãng và trực quan
    const realClassesList = Array.from(realClassesMap.values()).slice(0, 5);

    // Lấy danh sách Methods thật
    const realMethodsList: Array<{
      methodName: string;
      className: string;
      filePath: string;
      signature: string;
      docStatus: "DOCUMENTED" | "DRIFTED" | "UNDOCUMENTED";
      entityId?: number;
    }> = [];

    // Từ AST Entities
    allEntities
      .filter((e) => e.entityType === "METHOD" || e.entityType === "ENDPOINT" || e.entityType === "CONSTRUCTOR")
      .forEach((m) => {
        const mName = m.methodName || m.signature?.split("(")[0]?.split(" ")?.pop() || "method()";
        if (!realMethodsList.some((existing) => existing.methodName === mName && existing.filePath === m.filePath)) {
          realMethodsList.push({
            methodName: mName,
            className: m.className || "",
            filePath: m.filePath,
            signature: m.signature || `${mName}()`,
            docStatus: (m.docStatus as any) || (documents.length > 0 ? "DOCUMENTED" : "UNDOCUMENTED"),
            entityId: m.entityId,
          });
        }
      });

    // Từ doc_code_links
    Object.values(codeLinksMap).forEach((linkList) => {
      linkList.forEach((link) => {
        if (link.methodName && !realMethodsList.some((m) => m.methodName === link.methodName)) {
          realMethodsList.push({
            methodName: link.methodName,
            className: link.className || "",
            filePath: link.filePath,
            signature: `${link.methodName}()`,
            docStatus: "DOCUMENTED",
          });
        }
      });
    });

    // GOM NHÓM METHODS THEO CLASS CHA
    const assignedMethodKeys = new Set<string>();
    const classBlocks: Array<{
      cls: (typeof realClassesList)[0];
      methods: typeof realMethodsList;
    }> = [];

    realClassesList.forEach((cls) => {
      const clsMethods = realMethodsList.filter((mth) => {
        const isMatch =
          (mth.className && mth.className.toLowerCase() === cls.className.toLowerCase()) ||
          (mth.filePath && cls.filePath && mth.filePath.toLowerCase().endsWith(cls.filePath.toLowerCase())) ||
          (mth.filePath && cls.filePath && cls.filePath.toLowerCase().endsWith(mth.filePath.toLowerCase()));
        if (isMatch) {
          assignedMethodKeys.add(`${mth.methodName}-${mth.filePath}`);
        }
        return isMatch;
      });
      // Mỗi class lấy tối đa 4 phương thức tiêu biểu để đồ thị vừa vặn trong màn hình
      classBlocks.push({ cls, methods: clsMethods.slice(0, 4) });
    });

    // CÁC THÔNG SỐ KÍCH THƯỚC COMPACT (TỐI ƯU CHIỀU DỌC)
    const nodeHeight = 52;
    const methodGap = 10;
    const methodStep = nodeHeight + methodGap; // 62px
    let currentY = 30; // Bắt đầu từ đỉnh

    classBlocks.forEach(({ cls, methods }, clsIdx) => {
      const clsId = `cls-${clsIdx}`;
      const methodCount = methods.length;
      const blockHeight = methodCount > 0 ? methodCount * methodStep - methodGap : nodeHeight;
      const clsY = currentY + (blockHeight - nodeHeight) / 2;

      const isDocumented = documents.some(
        (d) =>
          d.title?.toLowerCase().includes(cls.className.toLowerCase()) ||
          d.targetPath?.toLowerCase().includes(cls.className.toLowerCase())
      );

      // Thêm Class Node (x = 310)
      nodeList.push({
        id: clsId,
        name: cls.className,
        type: "CLASS",
        filePath: cls.filePath,
        signature: cls.signature,
        docStatus: isDocumented ? "DOCUMENTED" : "UNDOCUMENTED",
        x: 310,
        y: clsY,
        entityId: cls.entityId,
        description: `Tệp nguồn: ${cls.filePath}`,
      });

      // Cạnh nối Repo -> Class
      edgeList.push({
        id: `e-${repoNodeId}-${clsId}`,
        source: repoNodeId,
        target: clsId,
        type: "CONTAINS",
      });

      // Thêm Method Nodes (x = 580)
      methods.forEach((mth, mIdx) => {
        const mthId = `mth-${clsIdx}-${mIdx}`;
        const mthY = currentY + mIdx * methodStep;

        nodeList.push({
          id: mthId,
          name: mth.methodName,
          type: "METHOD",
          filePath: mth.filePath,
          signature: mth.signature,
          docStatus: mth.docStatus,
          x: 580,
          y: mthY,
          entityId: mth.entityId,
          description: mth.signature,
        });

        // Cạnh nối Class -> Method
        edgeList.push({
          id: `e-${clsId}-${mthId}`,
          source: clsId,
          target: mthId,
          type: "CONTAINS",
          status: mth.docStatus,
        });
      });

      currentY += blockHeight + 24; // Khoảng cách giữa các khối class
    });

    const totalGraphHeight = Math.max(300, currentY - 30);

    // TẦNG 1: NÚT REPOSITORY THẬT (x = 40), căn chỉnh hợp lý theo các lớp
    const repoY = Math.max(30, Math.min(180, totalGraphHeight / 2 - nodeHeight / 2));
    nodeList.unshift({
      id: repoNodeId,
      name: repoName,
      type: "REPO",
      docStatus: documents.length > 0 ? "DOCUMENTED" : "UNDOCUMENTED",
      x: 40,
      y: repoY,
      description: `Nhánh chính: ${selectedRepo?.defaultBranch || "main"} • ${rawFiles.length} tệp tin`,
    });

    // TẦNG 4: VẼ CÁC TÀI LIỆU LIVINGDOCS THẬT TỪ CSDL (x = 850)
    const docStep = Math.max(70, totalGraphHeight / Math.max(1, documents.length));
    documents.forEach((doc, idx) => {
      const docNodeId = `doc-${doc.docId}`;
      const docY = 30 + idx * docStep;
      const docStatus = doc.status === "PUBLISHED" ? "DOCUMENTED" : "DRIFTED";

      nodeList.push({
        id: docNodeId,
        name: doc.title,
        type: "DOC",
        docStatus: docStatus,
        x: 850,
        y: docY,
        docId: doc.docId,
        docTitle: doc.title,
        version: `v${doc.currentVersion || 1}.0`,
        description: `Trạng thái: ${doc.status} • Đường dẫn: ${doc.targetPath || "Gắn trực tiếp vào repo"}`,
      });

      // Liên kết với thực thể code dựa trên doc_code_links thật trong DB
      const linkedEvidence = codeLinksMap[doc.docId] || [];
      let hasFoundLink = false;

      if (linkedEvidence.length > 0) {
        linkedEvidence.forEach((link) => {
          const matchedTarget = nodeList.find(
            (n) =>
              (link.className && n.name.toLowerCase() === link.className.toLowerCase()) ||
              (link.methodName && n.name.toLowerCase() === link.methodName.toLowerCase()) ||
              (link.filePath && n.filePath?.toLowerCase().includes(link.filePath.toLowerCase()))
          );
          if (matchedTarget) {
            hasFoundLink = true;
            edgeList.push({
              id: `e-${matchedTarget.id}-${docNodeId}`,
              source: matchedTarget.id,
              target: docNodeId,
              type: "DOCUMENTS",
              status: docStatus,
            });
          }
        });
      }

      if (!hasFoundLink) {
        // Nếu chưa lưu code_links cụ thể, liên kết với class hoặc method có tên khớp
        const matchedNode = nodeList.find(
          (n) => (n.type === "CLASS" || n.type === "METHOD") && doc.title.toLowerCase().includes(n.name.toLowerCase())
        );
        if (matchedNode) {
          edgeList.push({
            id: `e-${matchedNode.id}-${docNodeId}`,
            source: matchedNode.id,
            target: docNodeId,
            type: "DOCUMENTS",
            status: docStatus,
          });
        }
      }
    });

    // Thống kê số liệu THẬT
    const totalEntities = realClassesList.length + realMethodsList.length;
    const documentedCount = nodeList.filter(
      (n) => (n.type === "CLASS" || n.type === "METHOD") && n.docStatus === "DOCUMENTED"
    ).length;
    const driftedCount = nodeList.filter(
      (n) => (n.type === "CLASS" || n.type === "METHOD") && n.docStatus === "DRIFTED"
    ).length;
    const coverage = totalEntities > 0 ? Math.round((documentedCount / totalEntities) * 100) : 0;

    return {
      nodes: nodeList,
      edges: edgeList,
      stats: {
        totalNodes: nodeList.length,
        totalEdges: edgeList.length,
        coverageRate: coverage,
        documentedCount,
        driftedCount,
        docsCount: documents.length,
        realFilesCount: rawFiles.length,
      },
    };
  }, [selectedRepoId, repos, rawFiles, dbEntities, parsedEntities, documents, codeLinksMap]);

  // Bộ lọc theo từ khóa & trạng thái
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = node.name.toLowerCase().includes(query);
        const matchSign = (node.signature || "").toLowerCase().includes(query);
        const matchFile = (node.filePath || "").toLowerCase().includes(query);
        if (!matchName && !matchSign && !matchFile) return false;
      }

      if (filterType !== "ALL" && node.type !== filterType) {
        return false;
      }

      if (filterStatus !== "ALL" && node.docStatus !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [nodes, searchTerm, filterType, filterStatus]);

  // Bộ lọc Edges chỉ giữ lại các cạnh nối giữa các node còn hiển thị
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, filteredNodes]);

  // TÍNH TOÁN VÀ THU PHÓNG VỪA KHÍT MÀN HÌNH (AUTO-FIT TO SCREEN)
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (!clientWidth || !clientHeight || clientWidth < 100 || clientHeight < 100) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 220);
      maxY = Math.max(maxY, n.y + 54);
    });

    const paddingX = 40;
    const paddingY = 40;
    const graphWidth = maxX - minX + paddingX * 2;
    const graphHeight = maxY - minY + paddingY * 2;

    const scaleX = clientWidth / graphWidth;
    const scaleY = clientHeight / graphHeight;

    // Tỷ lệ co giãn tối ưu để 100% nodes vừa vặn cả ngang và dọc
    const fitScale = Math.min(1.05, Math.max(0.4, Math.min(scaleX, scaleY) * 0.94));

    const scaledWidth = graphWidth * fitScale;
    const scaledHeight = graphHeight * fitScale;

    // Căn giữa canvas theo tỷ lệ
    let panX = (clientWidth - scaledWidth) / 2 - minX * fitScale + paddingX * fitScale;
    let panY = (clientHeight - scaledHeight) / 2 - minY * fitScale + paddingY * fitScale;

    // Đảm bảo node trên cùng luôn nhìn thấy rõ, không bị đẩy âm ra ngoài mép trên
    if (minY * fitScale + panY < 25) {
      panY = 25 - minY * fitScale;
    }
    if (minX * fitScale + panX < 25) {
      panX = 25 - minX * fitScale;
    }

    setZoomLevel(Number(fitScale.toFixed(2)));
    setPanOffset({ x: Math.round(panX), y: Math.round(panY) });
  }, [nodes]);

  // Tự động căn vừa khít màn hình khi tải xong dữ liệu của repo
  useEffect(() => {
    if (!loadingDetails && nodes.length > 0) {
      const timer = setTimeout(() => {
        handleFitToScreen();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedRepoId, loadingDetails, nodes.length, handleFitToScreen]);

  // Lắng nghe thay đổi kích thước container để tự động căn chỉnh
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      if (nodes.length > 0) {
        handleFitToScreen();
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [handleFitToScreen, nodes.length]);

  // Cuộn chuột mượt mà (Mouse Wheel: Cuộn để Pan Y & Pan X, Giữ Ctrl để Phóng to/Thu nhỏ)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoomLevel((prev) => {
          const nextZoom = Math.min(2.5, Math.max(0.35, Number((prev * factor).toFixed(2))));
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          setPanOffset((p) => ({
            x: Math.round(mouseX - (mouseX - p.x) * (nextZoom / prev)),
            y: Math.round(mouseY - (mouseY - p.y) * (nextZoom / prev)),
          }));
          return nextZoom;
        });
      } else {
        setPanOffset((p) => ({
          x: p.x - Math.round(e.deltaX),
          y: p.y - Math.round(e.deltaY),
        }));
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [viewMode]);

  // Kéo thả canvas bằng chuột (Mouse Drag Pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 30, y: 30 });
  };

  const handleScrollToTop = () => {
    setPanOffset({ x: 30, y: 30 });
  };

  const selectedRepo = repos.find((r) => r.repositoryId === selectedRepoId);

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50/60 p-4 sm:p-6 space-y-4">
        {/* HEADER TRANG */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700 shadow-sm">
                <GitFork size={20} />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Đồ thị liên kết (Knowledge & Dependency Graph)
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Dữ liệu thực tế: Trực quan hóa liên kết giữa Kho mã nguồn ➔ Lớp & Hàm (AST thật) ➔ Tài liệu LivingDocs.
                </p>
              </div>
            </div>
          </div>

          {/* CHỌN KHO LƯU TRỮ VÀ CHUYỂN VIEW */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-600">Kho lưu trữ:</span>
            <select
              value={selectedRepoId || ""}
              onChange={(e) => setSelectedRepoId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
            >
              {repos.map((r) => (
                <option key={r.repositoryId} value={r.repositoryId}>
                  {r.repoFullName || r.repoName} ({r.defaultBranch || "main"})
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("GRAPH")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === "GRAPH"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers size={13} /> Đồ thị SVG
              </button>
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === "TABLE"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Code2 size={13} /> Bảng ma trận
              </button>
            </div>
          </div>
        </div>

        {/* THẺ THỐNG KÊ SỐ LIỆU THỰC TẾ (REAL METRICS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase">Tỷ lệ bao phủ tài liệu</div>
              <div className="text-lg font-bold text-slate-900">{stats.coverageRate}%</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <FileCode size={18} />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase">Tệp tin mã nguồn thật</div>
              <div className="text-lg font-bold text-slate-900">{stats.realFilesCount} tệp</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <FileText size={18} />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase">Tài liệu trong CSDL</div>
              <div className="text-lg font-bold text-purple-700">{stats.docsCount} tài liệu</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Database size={18} />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase">Liên kết doc_code_links</div>
              <div className="text-lg font-bold text-amber-600">
                {Object.values(codeLinksMap).reduce((acc, curr) => acc + curr.length, 0)} liên kết
              </div>
            </div>
          </div>
        </div>

        {/* THÔNG BÁO HƯỚNG DẪN NẾU REPO CHƯA CÓ TÀI LIỆU */}
        {documents.length === 0 && !loadingDetails && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <span>
                Kho <strong>{selectedRepo?.repoFullName}</strong> đã bóc tách các tệp và lớp thật từ Git, nhưng chưa có
                tài liệu kỹ thuật nào trong CSDL.
              </span>
            </div>
            <Link
              href="/yeu-cau-sinh-tai-lieu"
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold transition flex items-center gap-1 shrink-0 ml-3"
            >
              <Sparkles size={12} /> Sinh tài liệu AI ngay
            </Link>
          </div>
        )}

        {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl px-3.5 py-2.5 shadow-sm shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Tìm class thật, hàm thật hoặc tài liệu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-emerald-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Filter size={12} /> Lọc:
            </span>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả loại Node</option>
              <option value="CLASS">Chỉ Lớp / Module</option>
              <option value="METHOD">Chỉ Phương thức / Hàm</option>
              <option value="DOC">Chỉ Tài liệu LivingDocs</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DOCUMENTED">Đã có tài liệu (Documented)</option>
              <option value="DRIFTED">Cảnh báo sai lệch (Drifted)</option>
              <option value="UNDOCUMENTED">Chưa có tài liệu</option>
            </select>

            {/* Điều khiển Thu phóng (Zoom Controls) */}
            {viewMode === "GRAPH" && (
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition"
                  title="Phóng to"
                >
                  <ZoomIn size={14} />
                </button>
                <span className="text-[11px] font-bold text-slate-600 px-1 select-none min-w-[38px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.35, Number((z - 0.15).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition"
                  title="Thu nhỏ"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleFitToScreen}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition ml-1"
                  title="Tự động thu phóng vừa khít toàn bộ màn hình"
                >
                  <Compass size={13} /> Vừa màn hình
                </button>
                <button
                  type="button"
                  onClick={handleScrollToTop}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition"
                  title="Cuộn về đầu đồ thị"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition"
                  title="Đặt lại kích thước chuẩn (100%)"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* NỘI DUNG CHÍNH: KHUNG ĐỒ THỊ HOẶC BẢNG MA TRẬN */}
        <div className="flex-1 flex gap-4 min-h-0 relative">
          {/* KHUNG HIỂN THỊ ĐỒ THỊ SVG */}
          {viewMode === "GRAPH" ? (
            <div
              ref={containerRef}
              className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative select-none cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Chú giải các tầng (Layer Labels) */}
              <div className="absolute top-3 left-4 right-4 flex justify-between pointer-events-none z-10 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <span className="bg-slate-100/90 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  Tầng 1: Kho mã nguồn thật
                </span>
                <span className="bg-slate-100/90 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  Tầng 2: Classes / Modules thật
                </span>
                <span className="bg-slate-100/90 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  Tầng 3: Functions / Methods thật
                </span>
                <span className="bg-slate-100/90 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  Tầng 4: Tài liệu LivingDocs trong CSDL
                </span>
              </div>

              {/* Hướng dẫn tương tác nhanh */}
              <div className="absolute bottom-3 left-4 z-10 pointer-events-none text-[11px] text-slate-500 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-2">
                <span>💡 Cuộn chuột để xem các node • Giữ chuột kéo để di chuyển • Giữ Ctrl + Cuộn để phóng to/thu nhỏ</span>
              </div>

              {loadingDetails ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-20">
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <RefreshCw size={18} className="animate-spin text-emerald-600" /> Đang tải cây mã nguồn và tài liệu
                    thực tế từ GitHub & CSDL...
                  </div>
                </div>
              ) : filteredNodes.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                  <GitFork size={42} className="opacity-30 mb-2" />
                  <p className="text-sm font-medium">Không tìm thấy phần tử nào phù hợp với bộ lọc</p>
                </div>
              ) : (
                <svg
                  ref={svgRef}
                  className="w-full h-full"
                  style={{ width: "100%", height: "100%", display: "block" }}
                >
                  <defs>
                    {/* Họa tiết chấm lưới nền kỹ thuật */}
                    <pattern id="dot-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1" fill="#cbd5e1" opacity="0.6" />
                    </pattern>

                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 9 5 L 0 9 z" fill="#94a3b8" />
                    </marker>
                    <marker
                      id="arrow-drifted"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
                    </marker>
                    <marker
                      id="arrow-success"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
                    </marker>
                  </defs>

                  {/* Lớp nền lưới canvas */}
                  <rect width="100%" height="100%" fill="url(#dot-pattern)" />

                  {/* GROUP THU PHÓNG VÀ PAN NATIVE CỦA SVG */}
                  <g
                    transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
                    style={{ transition: isDragging ? "none" : "transform 0.12s ease-out" }}
                  >
                    {/* VẼ ĐƯỜNG LIÊN KẾT (EDGES) */}
                    {filteredEdges.map((edge) => {
                      const sourceNode = nodes.find((n) => n.id === edge.source);
                      const targetNode = nodes.find((n) => n.id === edge.target);
                      if (!sourceNode || !targetNode) return null;

                      const isSelectedEdge =
                        selectedNode?.id === edge.source || selectedNode?.id === edge.target;

                      // Đường cong Bezier kết nối từ mép phải sourceNode (x + 220, y + 26) sang mép trái targetNode (x, y + 26)
                      const x1 = sourceNode.x + 220;
                      const y1 = sourceNode.y + 26;
                      const x2 = targetNode.x;
                      const y2 = targetNode.y + 26;

                      const dx = Math.max(30, (x2 - x1) * 0.45);
                      const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                      let strokeColor = "#cbd5e1";
                      let markerId = "url(#arrow)";
                      if (edge.status === "DRIFTED") {
                        strokeColor = "#f59e0b";
                        markerId = "url(#arrow-drifted)";
                      } else if (edge.status === "DOCUMENTED" || edge.type === "DOCUMENTS") {
                        strokeColor = "#10b981";
                        markerId = "url(#arrow-success)";
                      }

                      return (
                        <g key={edge.id}>
                          <path
                            d={pathData}
                            fill="none"
                            stroke={isSelectedEdge ? "#059669" : strokeColor}
                            strokeWidth={isSelectedEdge ? 2.5 : 1.5}
                            strokeDasharray={edge.type === "DOCUMENTS" ? "4,4" : "none"}
                            markerEnd={markerId}
                            className="transition-all duration-150"
                          />
                        </g>
                      );
                    })}

                    {/* VẼ CÁC NÚT (NODES) - KÍCH THƯỚC GỌN GÀNG 220x52px */}
                    {filteredNodes.map((node) => {
                      const isSelected = selectedNode?.id === node.id;

                      let strokeBorder = isSelected ? "#047857" : "#e2e8f0";
                      let headerBg = "#f8fafc";

                      if (node.type === "REPO") {
                        headerBg = "#eff6ff";
                        strokeBorder = isSelected ? "#2563eb" : "#bfdbfe";
                      } else if (node.type === "CLASS") {
                        headerBg = "#f0fdf4";
                        strokeBorder = isSelected ? "#059669" : "#bbf7d0";
                      } else if (node.type === "METHOD") {
                        if (node.docStatus === "DRIFTED") {
                          headerBg = "#fffbeb";
                          strokeBorder = isSelected ? "#d97706" : "#fde68a";
                        } else if (node.docStatus === "DOCUMENTED") {
                          headerBg = "#f0fdf4";
                          strokeBorder = isSelected ? "#059669" : "#bbf7d0";
                        }
                      } else if (node.type === "DOC") {
                        headerBg = "#faf5ff";
                        strokeBorder = isSelected ? "#9333ea" : "#e9d5ff";
                      }

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(node);
                          }}
                          className="cursor-pointer group"
                        >
                          {/* Hộp nền node */}
                          <rect
                            width="220"
                            height="52"
                            rx="8"
                            fill="#ffffff"
                            stroke={strokeBorder}
                            strokeWidth={isSelected ? 2 : 1}
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.04))"
                            className="transition-all duration-150 group-hover:stroke-emerald-500"
                          />
                          {/* Thanh header loại node */}
                          <rect width="220" height="20" rx="8" fill={headerBg} />

                          {/* Tiêu đề loại node */}
                          <text x="8" y="14" fontSize="9" fontWeight="600" fill="#475569">
                            {node.type === "REPO"
                              ? "📦 REPOSITORY THẬT"
                              : node.type === "CLASS"
                              ? "🏛️ LỚP (CLASS)"
                              : node.type === "METHOD"
                              ? "⚡ PHƯƠNG THỨC"
                              : "📄 TÀI LIỆU CSDL"}
                          </text>

                          {/* Huy hiệu trạng thái */}
                          {node.docStatus && (
                            <text
                              x="212"
                              y="14"
                              textAnchor="end"
                              fontSize="8"
                              fontWeight="600"
                              fill={
                                node.docStatus === "DOCUMENTED"
                                  ? "#059669"
                                  : node.docStatus === "DRIFTED"
                                  ? "#d97706"
                                  : "#94a3b8"
                              }
                            >
                              {node.docStatus === "DOCUMENTED"
                                ? "✓ DOCUMENTED"
                                : node.docStatus === "DRIFTED"
                                ? "⚠ DRIFTED"
                                : "○ CHƯA GẮN DOC"}
                            </text>
                          )}

                          {/* Tên chính của Node */}
                          <text
                            x="8"
                            y="34"
                            fontSize="11"
                            fontWeight="600"
                            fill="#0f172a"
                            className="truncate"
                          >
                            {node.name.length > 24 ? node.name.slice(0, 24) + "..." : node.name}
                          </text>

                          {/* Mô tả phụ / Tệp tin */}
                          <text x="8" y="45" fontSize="8" fill="#64748b">
                            {node.filePath
                              ? node.filePath.split("/").pop()
                              : node.version
                              ? `Phiên bản: ${node.version}`
                              : "Thực thể mã nguồn"}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}
            </div>
          ) : (
            /* KHUNG BẢNG MA TRẬN LIÊN KẾT (MATRIX VIEW) */
            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto flex-1 p-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-semibold">
                      <th className="py-2.5 px-3">Loại</th>
                      <th className="py-2.5 px-3">Tên Phần tử mã nguồn</th>
                      <th className="py-2.5 px-3">Đường dẫn tệp thật</th>
                      <th className="py-2.5 px-3">Trạng thái tài liệu</th>
                      <th className="py-2.5 px-3">Tài liệu liên kết</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredNodes
                      .filter((n) => n.type !== "REPO")
                      .map((node) => (
                        <tr
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`hover:bg-slate-50 cursor-pointer transition ${
                            selectedNode?.id === node.id ? "bg-emerald-50/60 font-medium" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                              {node.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{node.name}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {node.filePath || "-"}
                          </td>
                          <td className="py-2.5 px-3">
                            {node.docStatus === "DOCUMENTED" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-medium border border-emerald-200">
                                <CheckCircle2 size={11} /> Documented
                              </span>
                            ) : node.docStatus === "DRIFTED" ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[11px] font-medium border border-amber-200">
                                <AlertTriangle size={11} /> Drifted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200">
                                <HelpCircle size={11} /> Undocumented
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {node.docTitle || (node.docStatus === "DOCUMENTED" ? "LivingDocs Doc" : "Chưa gắn")}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedNode(node)}
                              className="text-emerald-600 hover:text-emerald-700 font-medium text-[11px] inline-flex items-center gap-1"
                            >
                              <Eye size={12} /> Chi tiết
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CỘT CHI TIẾT NÚT ĐƯỢC CHỌN (NODE DETAILS INSPECTOR) */}
          {selectedNode && (
            <div className="w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col overflow-hidden shrink-0 animate-in fade-in duration-200">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-100 p-1 text-emerald-700">
                    <Code2 size={16} />
                  </span>
                  <h3 className="font-bold text-sm text-slate-900">Chi tiết phần tử liên kết</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400">Tên phần tử thật</label>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 break-all">{selectedNode.name}</div>
                </div>

                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400">Phân loại Node</label>
                  <div className="mt-1">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-semibold">
                      {selectedNode.type}
                    </span>
                  </div>
                </div>

                {selectedNode.filePath && (
                  <div>
                    <label className="text-[11px] uppercase font-bold text-slate-400">Đường dẫn tệp nguồn thật</label>
                    <div className="font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 mt-0.5 break-all">
                      {selectedNode.filePath}
                    </div>
                  </div>
                )}

                {selectedNode.signature && (
                  <div>
                    <label className="text-[11px] uppercase font-bold text-slate-400">Chữ ký hàm / Signature</label>
                    <pre className="font-mono text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 mt-0.5 text-[11px] overflow-x-auto whitespace-pre-wrap">
                      {selectedNode.signature}
                    </pre>
                  </div>
                )}

                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400">Trạng thái tài liệu</label>
                  <div className="mt-1">
                    {selectedNode.docStatus === "DOCUMENTED" ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold border border-emerald-200">
                        <CheckCircle2 size={13} /> Đã có tài liệu kỹ thuật
                      </span>
                    ) : selectedNode.docStatus === "DRIFTED" ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md font-semibold border border-amber-200">
                        <AlertTriangle size={13} /> Phát hiện sai lệch (Drifted)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md font-semibold border border-slate-200">
                        <HelpCircle size={13} /> Chưa được gắn tài liệu trong CSDL
                      </span>
                    )}
                  </div>
                </div>

                {selectedNode.description && (
                  <div>
                    <label className="text-[11px] uppercase font-bold text-slate-400">Mô tả & Thông tin phụ</label>
                    <div className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-0.5 break-all">
                      {selectedNode.description}
                    </div>
                  </div>
                )}

                {/* HÀNH ĐỘNG KHẢ DỤNG */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <label className="text-[11px] uppercase font-bold text-slate-400">Hành động</label>
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href="/cay-ma-nguon"
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-700 transition font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <FileCode size={13} className="text-emerald-600" /> Xem cây mã nguồn & AST chi tiết
                      </span>
                      <ArrowRight size={13} />
                    </Link>

                    <Link
                      href="/yeu-cau-sinh-tai-lieu"
                      className="flex items-center justify-between px-3 py-2 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-800 transition font-medium border border-emerald-200"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles size={13} className="text-emerald-600" /> Sinh tài liệu AI cho kho này
                      </span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
