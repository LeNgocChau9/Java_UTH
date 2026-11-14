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
  FolderTree,
  File,
  Terminal,
  FolderGit2,
} from "lucide-react";
import Link from "next/link";

interface GraphNode {
  id: string;
  name: string;
  type: "REPO" | "FILE" | "CLASS" | "METHOD" | "ENDPOINT" | "DOC";
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
  startLine?: number;
  endLine?: number;
  returnType?: string;
  parameters?: string;
  parentFile?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "CONTAINS" | "CALLS" | "DOCUMENTS";
  status?: "DOCUMENTED" | "DRIFTED" | "UNDOCUMENTED";
}

// Nhận diện ngôn ngữ & định dạng huy hiệu cho TẤT CẢ các loại mã nguồn phổ biến
function getLanguageMeta(filePath?: string): {
  label: string;
  icon: string;
  bg: string;
  border: string;
  text: string;
} {
  if (!filePath) return { label: "TỆP NGUỒN", icon: "📁", bg: "#f1f5f9", border: "#cbd5e1", text: "#475569" };
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const fn = filePath.split("/").pop()?.toLowerCase() || "";

  if (ext === "java") return { label: "JAVA", icon: "☕", bg: "#fff7ed", border: "#fdba74", text: "#c2410c" };
  if (ext === "py") return { label: "PYTHON", icon: "🐍", bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" };
  if (ext === "ts" || ext === "tsx") return { label: "TYPESCRIPT", icon: "⚛️", bg: "#f0fdf4", border: "#86efac", text: "#15803d" };
  if (ext === "js" || ext === "jsx") return { label: "JAVASCRIPT", icon: "🟨", bg: "#fefce8", border: "#fde047", text: "#a16207" };
  if (ext === "go") return { label: "GO", icon: "🐹", bg: "#ecfeff", border: "#67e8f9", text: "#0e7490" };
  if (ext === "rs") return { label: "RUST", icon: "🦀", bg: "#fff1f2", border: "#fca5a5", text: "#be123c" };
  if (["cpp", "c", "cc", "cxx", "h", "hpp"].includes(ext)) return { label: "C/C++", icon: "⚙️", bg: "#f8fafc", border: "#cbd5e1", text: "#334155" };
  if (ext === "cs") return { label: "C#", icon: "🔷", bg: "#f5f3ff", border: "#c4b5fd", text: "#6d28d9" };
  if (ext === "php") return { label: "PHP", icon: "🐘", bg: "#eef2ff", border: "#a5b4fc", text: "#4338ca" };
  if (ext === "rb") return { label: "RUBY", icon: "💎", bg: "#fff1f2", border: "#fda4af", text: "#be123c" };
  if (ext === "kt" || ext === "kts") return { label: "KOTLIN", icon: "🟣", bg: "#faf5ff", border: "#d8b4fe", text: "#7e22ce" };
  if (ext === "swift") return { label: "SWIFT", icon: "🕊️", bg: "#fff7ed", border: "#fdba74", text: "#c2410c" };
  if (ext === "sql") return { label: "SQL", icon: "🗄️", bg: "#f0fdfa", border: "#5eead4", text: "#0f766e" };
  if (["sh", "bash", "zsh", "bat", "ps1"].includes(ext)) return { label: "SHELL", icon: "💻", bg: "#f1f5f9", border: "#94a3b8", text: "#334155" };
  if (["html", "vue", "svelte"].includes(ext)) return { label: "HTML/UI", icon: "🌐", bg: "#fff7ed", border: "#fdba74", text: "#c2410c" };
  if (["css", "scss", "sass", "less"].includes(ext)) return { label: "STYLE", icon: "🎨", bg: "#fdf2f8", border: "#f472b6", text: "#be185d" };
  if (["json", "yaml", "yml", "xml", "toml", "env", "properties"].includes(ext) || fn.includes("docker") || fn.includes("config")) {
    return { label: "CONFIG", icon: "⚙️", bg: "#f8fafc", border: "#cbd5e1", text: "#475569" };
  }
  if (["md", "txt", "doc"].includes(ext)) return { label: "DOCS", icon: "📝", bg: "#f8fafc", border: "#cbd5e1", text: "#475569" };

  return { label: ext ? ext.toUpperCase() : "CODE", icon: "📄", bg: "#f8fafc", border: "#cbd5e1", text: "#475569" };
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
  const [filterFile, setFilterFile] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"GRAPH" | "TABLE">("GRAPH");

  // Interactive selection & Zoom
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging state
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragNodeStartRef = useRef<{ mouseX: number; mouseY: number; initialNodeX: number; initialNodeY: number } | null>(null);
  const isNodeDraggedRef = useRef(false);

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
          setSelectedRepoId(repoList[0].repositoryId);
        } else {
          setSelectedRepoId(null);
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

        // D. Tải Cây thư mục (Git Tree) THẬT từ backend
        let treeFiles: string[] = [];
        try {
          const treeRes = await repoService.getRepositoryTree(selectedRepoId!);
          if (treeRes && treeRes.length > 0) {
            treeFiles = treeRes
              .filter((item: GitHubFileItem) => item.type === "blob" || item.path?.includes("."))
              .map((item: GitHubFileItem) => item.path);
          }
        } catch {
          // fallback
        }
        setRawFiles(treeFiles);

        // E. Bóc tách AST THẬT từ các file mã nguồn cốt lõi trong repo (Hỗ trợ TẤT CẢ các loại code file)
        const codeFiles = treeFiles.filter((f) =>
          /\.(java|py|ts|tsx|js|jsx|go|rs|cpp|c|cc|h|hpp|cs|php|rb|kt|kts|swift|sql|sh|bash|html|css|scss|json|yaml|yml|xml|toml)$/i.test(f) &&
          !f.includes(".git/") &&
          !f.includes("target/") &&
          !f.includes("build/") &&
          !f.includes("node_modules/")
        );

        const newlyParsed: CodeEntityDto[] = [];

        await Promise.all(
          codeFiles.slice(0, 5).map(async (filePath) => {
            try {
              const fileContent = await repoService.getFileContent(selectedRepoId!, filePath, defaultBranch);
              if (fileContent?.content) {
                const parsed = parseUniversalCodeEntities(filePath, fileContent.content, selectedRepoId!);
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

  // 3. XÂY DỰNG CẤU TRÚC ĐỒ THỊ CHI TIẾT (FULL KNOWLEDGE & CODE TREE GRAPH)
  const { nodes, edges, stats, fileOptions } = useMemo(() => {
    const selectedRepo = repos.find((r) => r.repositoryId === selectedRepoId);
    const repoName = selectedRepo?.repoFullName || selectedRepo?.repoName || "Repository";

    const nodeList: GraphNode[] = [];
    const edgeList: GraphEdge[] = [];
    const repoNodeId = `repo-${selectedRepoId}`;

    // Gom tập hợp tất cả entities thật (từ DB + từ AST parser của mã nguồn thật + từ doc_code_links)
    const allEntities = [...dbEntities, ...parsedEntities];

    // Trích xuất danh sách các TỆP NGUỒN THỰC TẾ
    const filesMap = new Map<string, { filePath: string; fileName: string; folder: string; entities: CodeEntityDto[] }>();

    // 1. Từ AST Entities
    allEntities.forEach((ent) => {
      const fp = ent.filePath || "unknown";
      if (!filesMap.has(fp)) {
        const parts = fp.split("/");
        const fn = parts.pop() || fp;
        const fol = parts.join("/") || "root";
        filesMap.set(fp, { filePath: fp, fileName: fn, folder: fol, entities: [] });
      }
      filesMap.get(fp)!.entities.push(ent);
    });

    // 2. Từ doc_code_links
    Object.values(codeLinksMap).forEach((linkList) => {
      linkList.forEach((link) => {
        if (link.filePath && !filesMap.has(link.filePath)) {
          const parts = link.filePath.split("/");
          const fn = parts.pop() || link.filePath;
          const fol = parts.join("/") || "root";
          filesMap.set(link.filePath, { filePath: link.filePath, fileName: fn, folder: fol, entities: [] });
        }
      });
    });

    // 3. Từ cây Git Tree (Hỗ trợ TẤT CẢ các loại mã nguồn và tệp cấu hình dự án)
    rawFiles
      .filter((f) =>
        /\.(java|py|ts|tsx|js|jsx|go|rs|cpp|c|cc|h|hpp|cs|php|rb|kt|kts|swift|sql|sh|bash|html|css|scss|json|yaml|yml|xml|toml)$/i.test(f) &&
        !f.includes(".git/") &&
        !f.includes("target/") &&
        !f.includes("build/") &&
        !f.includes("node_modules/")
      )
      .forEach((f) => {
        if (!filesMap.has(f)) {
          const parts = f.split("/");
          const fn = parts.pop() || f;
          const fol = parts.join("/") || "root";
          filesMap.set(f, { filePath: f, fileName: fn, folder: fol, entities: [] });
        }
      });

    // Lọc theo bộ chọn file nếu người dùng chọn xem 1 file cụ thể
    let displayFiles = Array.from(filesMap.values());
    if (filterFile !== "ALL") {
      displayFiles = displayFiles.filter((f) => f.filePath === filterFile);
    } else {
      // Khi xem tất cả (ALL), sắp xếp đa dạng các ngôn ngữ đại diện của cả dự án
      const getLanguageRank = (p: string) => {
        const ext = p.split(".").pop()?.toLowerCase() || "";
        if (ext === "java") return 1;
        if (ext === "py") return 2;
        if (ext === "ts" || ext === "tsx") return 3;
        if (ext === "go") return 4;
        if (ext === "rs") return 5;
        if (ext === "cs") return 6;
        if (["cpp", "c", "h", "hpp"].includes(ext)) return 7;
        if (ext === "sql") return 8;
        if (ext === "js" || ext === "jsx") return 9;
        if (["sh", "bash"].includes(ext)) return 10;
        if (ext === "php" || ext === "rb" || ext === "kt" || ext === "swift") return 11;
        if (["json", "yaml", "yml", "xml", "toml"].includes(ext)) return 12;
        return 20;
      };

      displayFiles.sort((a, b) => {
        const rDiff = getLanguageRank(a.filePath) - getLanguageRank(b.filePath);
        if (rDiff !== 0) return rDiff;
        return b.entities.length - a.entities.length;
      });

      // Lấy tối đa 14 tệp đại diện cho full dự án
      displayFiles = displayFiles.slice(0, 14);
    }

    // TẦNG 2: VẼ CÁC TỆP TIN / MODULES MÃ NGUỒN THẬT (x = 320)
    // TẦNG 3: VẼ CÁC LỚP & HÀM CHI TIẾT TRONG TỆP ĐÓ (x = 640)
    const nodeHeight = 52;
    const itemGap = 10;
    const itemStep = nodeHeight + itemGap; // 62px
    let currentY = 30;

    displayFiles.forEach((fObj, fIdx) => {
      const fileNodeId = `file-${fIdx}`;
      const fEntities = fObj.entities;

      // Gom Class và Methods trong file này
      const fileClasses = fEntities.filter((e) => e.entityType === "CLASS" || e.entityType === "INTERFACE");
      const fileMethods = fEntities.filter(
        (e) => e.entityType === "METHOD" || e.entityType === "ENDPOINT" || e.entityType === "CONSTRUCTOR"
      );

      // Danh sách các phần tử code con sẽ hiển thị ở Tầng 3
      const childNodesToRender: Array<{
        name: string;
        type: "CLASS" | "METHOD" | "ENDPOINT";
        signature: string;
        docStatus: "DOCUMENTED" | "DRIFTED" | "UNDOCUMENTED";
        startLine?: number;
        endLine?: number;
        parameters?: string;
        returnType?: string;
      }> = [];

      // Thêm class nếu có
      fileClasses.forEach((c) => {
        childNodesToRender.push({
          name: c.className || fObj.fileName.replace(/\.\w+$/, ""),
          type: "CLASS",
          signature: c.signature || `class ${c.className}`,
          docStatus: (c.docStatus as any) || "DOCUMENTED",
          startLine: c.startLine,
          endLine: c.endLine,
        });
      });

      // Thêm các methods / endpoints
      fileMethods.forEach((m) => {
        childNodesToRender.push({
          name: m.methodName || m.signature.split("(")[0].split(" ").pop() || "function()",
          type: m.entityType === "ENDPOINT" ? "ENDPOINT" : "METHOD",
          signature: m.signature || `${m.methodName}()`,
          docStatus: (m.docStatus as any) || "DOCUMENTED",
          startLine: m.startLine,
          endLine: m.endLine,
          parameters: m.parameters,
          returnType: m.returnType,
        });
      });

      // Nếu file chưa bóc tách method con, tạo method đại diện từ tên file
      if (childNodesToRender.length === 0) {
        const baseName = fObj.fileName.replace(/\.\w+$/, "");
        childNodesToRender.push({
          name: baseName,
          type: "CLASS",
          signature: `class ${baseName}`,
          docStatus: "UNDOCUMENTED",
        });
      }

      // Giới hạn số hàm con hiển thị mỗi file khi xem tổng quan để không bị quá dài
      const limitedChildren = filterFile !== "ALL" ? childNodesToRender : childNodesToRender.slice(0, 5);

      const blockHeight = limitedChildren.length * itemStep - itemGap;
      const fileY = currentY + (blockHeight - nodeHeight) / 2;

      // 1. Thêm File Node (x = 320)
      nodeList.push({
        id: fileNodeId,
        name: fObj.fileName,
        type: "FILE",
        filePath: fObj.filePath,
        x: 320,
        y: fileY,
        description: `Thư mục: ${fObj.folder} • ${childNodesToRender.length} phần tử AST`,
        docStatus: fEntities.some((e) => e.docStatus === "DOCUMENTED") ? "DOCUMENTED" : "UNDOCUMENTED",
      });

      // Nối Repo -> File
      edgeList.push({
        id: `e-${repoNodeId}-${fileNodeId}`,
        source: repoNodeId,
        target: fileNodeId,
        type: "CONTAINS",
      });

      // 2. Thêm các Lớp & Hàm con (x = 640)
      limitedChildren.forEach((child, cIdx) => {
        const childId = `child-${fIdx}-${cIdx}`;
        const childY = currentY + cIdx * itemStep;

        nodeList.push({
          id: childId,
          name: child.name,
          type: child.type,
          filePath: fObj.filePath,
          parentFile: fObj.fileName,
          signature: child.signature,
          docStatus: child.docStatus,
          startLine: child.startLine,
          endLine: child.endLine,
          parameters: child.parameters,
          returnType: child.returnType,
          x: 640,
          y: childY,
          description: `Tệp: ${fObj.fileName} ${child.startLine ? `(Dòng ${child.startLine}-${child.endLine})` : ""}`,
        });

        // Nối File -> Lớp / Hàm
        edgeList.push({
          id: `e-${fileNodeId}-${childId}`,
          source: fileNodeId,
          target: childId,
          type: "CONTAINS",
          status: child.docStatus,
        });
      });

      currentY += blockHeight + 24; // Khoảng cách giữa các file block
    });

    const totalGraphHeight = Math.max(340, currentY - 30);

    // TẦNG 1: NÚT REPOSITORY THẬT (x = 40)
    const repoY = Math.max(30, totalGraphHeight / 2 - nodeHeight / 2);
    nodeList.unshift({
      id: repoNodeId,
      name: repoName,
      type: "REPO",
      docStatus: documents.length > 0 ? "DOCUMENTED" : "UNDOCUMENTED",
      x: 40,
      y: repoY,
      description: `Nhánh chính: ${selectedRepo?.defaultBranch || "main"} • ${rawFiles.length} tệp tin trong kho`,
    });

    // TẦNG 4: VẼ CÁC TÀI LIỆU LIVINGDOCS THẬT TỪ CSDL (x = 980)
    const docStep = Math.max(80, totalGraphHeight / Math.max(1, documents.length));
    documents.forEach((doc, idx) => {
      const docNodeId = `doc-${doc.docId}`;
      const docY = 30 + idx * docStep;
      const docStatus = doc.status === "PUBLISHED" ? "DOCUMENTED" : "DRIFTED";

      nodeList.push({
        id: docNodeId,
        name: doc.title,
        type: "DOC",
        docStatus: docStatus,
        x: 980,
        y: docY,
        docId: doc.docId,
        docTitle: doc.title,
        version: `v${doc.currentVersion || 1}.0`,
        description: `Trạng thái: ${doc.status} • Đường dẫn: ${doc.targetPath || "Tài liệu kỹ thuật tổng hợp"}`,
      });

      // 1. Nếu là tài liệu tổng quan kiến trúc hoặc README -> Nối DUY NHẤT 1 đường từ REPO gốc!
      const isArchitectureDoc =
        doc.title.toLowerCase().includes("readme") ||
        doc.title.toLowerCase().includes("tổng quan") ||
        doc.title.toLowerCase().includes("kiến trúc") ||
        doc.title.toLowerCase().includes("hệ thống") ||
        (doc as any).scope === "REPOSITORY";

      if (isArchitectureDoc) {
        edgeList.push({
          id: `e-${repoNodeId}-${docNodeId}`,
          source: repoNodeId,
          target: docNodeId,
          type: "DOCUMENTS",
          status: docStatus,
        });
        return; // Đã liên kết xong cho tài liệu kiến trúc, không kết nối spiderweb vào từng hàm con!
      }

      // 2. LIÊN KẾT CHUẨN XÁC CHO TÀI LIỆU CỤ THỂ: Chỉ nối tới tệp hoặc hàm thực sự tương ứng
      const linkedEvidence = codeLinksMap[doc.docId] || [];
      let connected = false;

      if (linkedEvidence.length > 0) {
        // Chỉ nối đến các mục tiêu khớp thực sự (ưu tiên class hoặc file trước, không nối bừa bãi hàng chục method con)
        linkedEvidence.forEach((link) => {
          const matchedTarget = nodeList.find(
            (n) =>
              (link.methodName && n.name.toLowerCase() === link.methodName.toLowerCase()) ||
              (link.className && n.name.toLowerCase() === link.className.toLowerCase()) ||
              (link.filePath && n.filePath && n.filePath.toLowerCase().endsWith(link.filePath.toLowerCase()) && (n.type === "FILE" || n.type === "CLASS"))
          );
          if (matchedTarget && !edgeList.some((e) => e.source === matchedTarget.id && e.target === docNodeId)) {
            connected = true;
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

      // 3. Nếu chưa kết nối, thử tìm node có tên xuất hiện trong tiêu đề tài liệu
      if (!connected) {
        const matchedNode = nodeList.find(
          (n) => (n.type === "FILE" || n.type === "CLASS") && doc.title.toLowerCase().includes(n.name.toLowerCase())
        );
        if (matchedNode) {
          edgeList.push({
            id: `e-${matchedNode.id}-${docNodeId}`,
            source: matchedNode.id,
            target: docNodeId,
            type: "DOCUMENTS",
            status: docStatus,
          });
        } else {
          // Fallback: Nối vào repo root
          edgeList.push({
            id: `e-${repoNodeId}-${docNodeId}`,
            source: repoNodeId,
            target: docNodeId,
            type: "DOCUMENTS",
            status: docStatus,
          });
        }
      }
    });

    // Thống kê số liệu
    const codeEntitiesCount = nodeList.filter((n) => n.type === "CLASS" || n.type === "METHOD" || n.type === "ENDPOINT").length;
    const documentedCount = nodeList.filter(
      (n) => (n.type === "CLASS" || n.type === "METHOD" || n.type === "ENDPOINT") && n.docStatus === "DOCUMENTED"
    ).length;
    const driftedCount = nodeList.filter(
      (n) => (n.type === "CLASS" || n.type === "METHOD" || n.type === "ENDPOINT") && n.docStatus === "DRIFTED"
    ).length;
    const coverage = codeEntitiesCount > 0 ? Math.round((documentedCount / codeEntitiesCount) * 100) : 0;

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
      fileOptions: Array.from(filesMap.values())
        .sort((a, b) => a.fileName.localeCompare(b.fileName))
        .map((f) => {
          const meta = getLanguageMeta(f.filePath);
          return {
            path: f.filePath,
            name: f.fileName,
            displayName: `${meta.icon} [${meta.label}] ${f.fileName}`,
            entityCount: f.entities.length,
          };
        }),
    };
  }, [selectedRepoId, repos, rawFiles, dbEntities, parsedEntities, documents, codeLinksMap, filterFile]);

  // Áp dụng tọa độ kéo thả tùy chỉnh của người dùng vào các node
  const positionedNodes = useMemo(() => {
    return nodes.map((node) => {
      const custom = nodePositions[node.id];
      return custom ? { ...node, x: custom.x, y: custom.y } : node;
    });
  }, [nodes, nodePositions]);

  // Đặt lại vị trí kéo thả khi đổi repo hoặc đổi file lọc
  useEffect(() => {
    setNodePositions({});
  }, [selectedRepoId, filterFile]);

  // Bộ lọc theo từ khóa & trạng thái
  const filteredNodes = useMemo(() => {
    return positionedNodes.filter((node) => {
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
  }, [positionedNodes, searchTerm, filterType, filterStatus]);

  // Bộ lọc Edges chỉ giữ lại các cạnh nối giữa các node còn hiển thị
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, filteredNodes]);

  // TÍNH TOÁN VÀ THU PHÓNG VỪA KHÍT MÀN HÌNH (AUTO-FIT TO SCREEN)
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || positionedNodes.length === 0) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (!clientWidth || !clientHeight || clientWidth < 100 || clientHeight < 100) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    positionedNodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 230);
      maxY = Math.max(maxY, n.y + 54);
    });

    const paddingX = 40;
    const paddingY = 40;
    const graphWidth = maxX - minX + paddingX * 2;
    const graphHeight = maxY - minY + paddingY * 2;

    const scaleX = clientWidth / graphWidth;
    const scaleY = clientHeight / graphHeight;

    const fitScale = Math.min(1.05, Math.max(0.38, Math.min(scaleX, scaleY) * 0.94));
    const scaledWidth = graphWidth * fitScale;
    const scaledHeight = graphHeight * fitScale;

    let panX = (clientWidth - scaledWidth) / 2 - minX * fitScale + paddingX * fitScale;
    let panY = (clientHeight - scaledHeight) / 2 - minY * fitScale + paddingY * fitScale;

    if (minY * fitScale + panY < 25) {
      panY = 25 - minY * fitScale;
    }
    if (minX * fitScale + panX < 25) {
      panX = 25 - minX * fitScale;
    }

    setZoomLevel(Number(fitScale.toFixed(2)));
    setPanOffset({ x: Math.round(panX), y: Math.round(panY) });
  }, [positionedNodes]);

  // Tự động căn vừa khít màn hình khi tải xong dữ liệu của repo hoặc khi đổi file lọc
  useEffect(() => {
    if (!loadingDetails && positionedNodes.length > 0) {
      const timer = setTimeout(() => {
        handleFitToScreen();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedRepoId, loadingDetails, positionedNodes.length, filterFile, handleFitToScreen]);

  // Lắng nghe thay đổi kích thước container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      if (positionedNodes.length > 0) {
        handleFitToScreen();
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [handleFitToScreen, positionedNodes.length]);

  // Cuộn chuột mượt mà (Mouse Wheel: Cuộn để Pan Y & Pan X, Giữ Ctrl để Phóng to/Thu nhỏ)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoomLevel((prev) => {
          const nextZoom = Math.min(2.5, Math.max(0.3, Number((prev * factor).toFixed(2))));
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

  // Kéo thả canvas bằng chuột (Mouse Drag Pan) hoặc kéo thả từng node (Node Drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && dragNodeStartRef.current) {
      const dx = (e.clientX - dragNodeStartRef.current.mouseX) / zoomLevel;
      const dy = (e.clientY - dragNodeStartRef.current.mouseY) / zoomLevel;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isNodeDraggedRef.current = true;
      }
      const newX = Math.round(dragNodeStartRef.current.initialNodeX + dx);
      const newY = Math.round(dragNodeStartRef.current.initialNodeY + dy);
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: { x: newX, y: newY },
      }));
      return;
    }

    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
      dragNodeStartRef.current = null;
    }
    setIsDragging(false);
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 30, y: 30 });
    setNodePositions({});
  };

  // Lắng nghe di chuyển chuột toàn cục khi đang kéo thả node (kéo mượt mà không bị tuột)
  useEffect(() => {
    if (!draggingNodeId) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      if (!dragNodeStartRef.current) return;
      const dx = (e.clientX - dragNodeStartRef.current.mouseX) / zoomLevel;
      const dy = (e.clientY - dragNodeStartRef.current.mouseY) / zoomLevel;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isNodeDraggedRef.current = true;
      }
      const newX = Math.round(dragNodeStartRef.current.initialNodeX + dx);
      const newY = Math.round(dragNodeStartRef.current.initialNodeY + dy);
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: { x: newX, y: newY },
      }));
    };

    const onGlobalMouseUp = () => {
      setDraggingNodeId(null);
      dragNodeStartRef.current = null;
    };

    window.addEventListener("mousemove", onGlobalMouseMove);
    window.addEventListener("mouseup", onGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", onGlobalMouseMove);
      window.removeEventListener("mouseup", onGlobalMouseUp);
    };
  }, [draggingNodeId, zoomLevel]);

  const handleScrollToTop = () => {
    setPanOffset({ x: 30, y: 30 });
  };

  const selectedRepo = repos.find((r) => r.repositoryId === selectedRepoId);

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50/60 p-4 sm:p-6 space-y-3.5">
        {/* HEADER TRANG */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700 shadow-sm">
                <FolderTree size={20} />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Đồ thị liên kết (Knowledge & Dependency Graph)
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Mô phỏng đầy đủ kiến trúc: Kho mã nguồn ➔ Tệp tin Git Tree ➔ Lớp & Phương thức (AST thật) ➔ Tài liệu LivingDocs.
                </p>
              </div>
            </div>
          </div>

          {/* CHỌN KHO LƯU TRỮ VÀ CHUYỂN VIEW */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-600">Kho lưu trữ:</span>
            <select
              value={selectedRepoId || ""}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSelectedRepoId(val || null);
                setFilterFile("ALL");
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
            >
              {repos.length === 0 && (
                <option value="">-- Chưa có kho lưu trữ --</option>
              )}
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

        {!selectedRepoId ? (
          <div className="bg-white rounded-2xl border border-dashed border-amber-300 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
            <FolderGit2 className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Vui lòng chọn hoặc tải lên kho lưu trữ
            </h2>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              Chưa có kho lưu trữ nào được chọn hoặc tài khoản chưa kết nối kho lưu trữ. Vui lòng kết nối GitHub hoặc tạo kho lưu trữ để xem đồ thị liên kết.
            </p>
            <div className="flex items-center justify-center gap-3 mt-5">
              <Link
                href="/cai-dat"
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
              >
                Kết nối kho lưu trữ
              </Link>
            </div>
          </div>
        ) : (
          <>
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
              <div className="text-[11px] font-medium text-slate-500 uppercase">Tệp tin mã nguồn Git Tree</div>
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

        {/* THANH TÌM KIẾM, BỘ LỌC TỆP TIN VÀ ĐIỀU KHIỂN */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl px-3.5 py-2.5 shadow-sm shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Tìm file, class, endpoint hoặc tài liệu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-emerald-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bộ chọn Tệp mã nguồn như Cây thư mục */}
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              <File size={12} className="text-emerald-600" /> Tệp nguồn:
            </span>
            <select
              value={filterFile}
              onChange={(e) => setFilterFile(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none max-w-[240px] truncate"
            >
              <option value="ALL">📁 Toàn bộ dự án (Full: Java, Python, TypeScript)</option>
              {fileOptions.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.displayName} ({f.entityCount} phần tử)
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả loại Node</option>
              <option value="FILE">Chỉ Tệp nguồn (Files)</option>
              <option value="CLASS">Chỉ Lớp (Classes)</option>
              <option value="METHOD">Chỉ Phương thức (Methods)</option>
              <option value="ENDPOINT">Chỉ API Endpoints</option>
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
                <span className="text-[11px] font-bold text-slate-600 px-1 select-none min-w-[36px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))}
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
              {/* Chú giải 4 tầng kiến trúc chuẩn */}
              <div className="absolute top-3 left-4 right-4 flex justify-between pointer-events-none z-10 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <span className="bg-slate-100/90 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  Tầng 1: Kho mã nguồn
                </span>
                <span className="bg-slate-100/90 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  Tầng 2: Cây Tệp tin / Modules
                </span>
                <span className="bg-slate-100/90 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  Tầng 3: Lớp & Hàm / Endpoints (AST chi tiết)
                </span>
                <span className="bg-slate-100/90 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  Tầng 4: Tài liệu LivingDocs liên kết
                </span>
              </div>

              {loadingDetails ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-20">
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <RefreshCw size={18} className="animate-spin text-emerald-600" /> Đang tải cây mã nguồn, AST chi tiết và tài liệu
                    thực tế từ GitHub & CSDL...
                  </div>
                </div>
              ) : (filteredNodes.length <= 1 && stats.realFilesCount === 0 && stats.docsCount === 0) ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center z-10">
                  <FolderGit2 size={42} className="text-amber-500 mb-3" />
                  <h3 className="text-sm font-bold text-slate-800 mb-1">
                    Kho lưu trữ chưa có dữ liệu mã nguồn hoặc tài liệu
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mb-4 leading-relaxed">
                    Kho lưu trữ này chưa tải lên mã nguồn hoặc chưa kết nối tài liệu qua MCP. Vui lòng tải lên tài liệu/mã nguồn để trực quan hóa đồ thị liên kết.
                  </p>
                  <div className="flex items-center gap-2.5">
                    <Link
                      href="/tai-lieu-cua-toi"
                      className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
                    >
                      Tải lên tài liệu
                    </Link>
                    <Link
                      href={`/cay-ma-nguon?repoId=${selectedRepoId}`}
                      className="px-3.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 transition"
                    >
                      Đồng bộ mã nguồn
                    </Link>
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

                  <rect width="100%" height="100%" fill="url(#dot-pattern)" />

                  {/* GROUP THU PHÓNG VÀ PAN NATIVE CỦA SVG */}
                  <g
                    transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
                    style={{ transition: isDragging || draggingNodeId ? "none" : "transform 0.12s ease-out" }}
                  >
                    {/* VẼ ĐƯỜNG LIÊN KẾT (EDGES) */}
                    {filteredEdges.map((edge) => {
                      const sourceNode = positionedNodes.find((n) => n.id === edge.source);
                      const targetNode = positionedNodes.find((n) => n.id === edge.target);
                      if (!sourceNode || !targetNode) return null;

                      const isSelectedEdge =
                        selectedNode?.id === edge.source || selectedNode?.id === edge.target;

                      const x1 = sourceNode.x + 230;
                      const y1 = sourceNode.y + 26;
                      const x2 = targetNode.x;
                      const y2 = targetNode.y + 26;

                      const dx = Math.max(30, Math.abs(x2 - x1) * 0.45);
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

                    {/* VẼ CÁC NÚT (NODES) CHI TIẾT */}
                    {filteredNodes.map((node) => {
                      const isSelected = selectedNode?.id === node.id;

                      let strokeBorder = isSelected ? "#047857" : "#e2e8f0";
                      let headerBg = "#f8fafc";
                      let headerIcon = "📦";
                      let headerLabel = "REPOSITORY";

                      const meta = getLanguageMeta(node.filePath);

                      if (node.type === "REPO") {
                        headerBg = "#eff6ff";
                        strokeBorder = isSelected ? "#2563eb" : "#bfdbfe";
                        headerIcon = "📦";
                        headerLabel = "REPOSITORY";
                      } else if (node.type === "FILE") {
                        headerBg = meta.bg;
                        strokeBorder = isSelected ? "#0284c7" : meta.border;
                        headerIcon = meta.icon;
                        headerLabel = `${meta.label} FILE`;
                      } else if (node.type === "CLASS") {
                        headerBg = meta.bg;
                        strokeBorder = isSelected ? "#059669" : meta.border;
                        headerIcon = meta.icon;
                        headerLabel = `${meta.label} CLASS`;
                      } else if (node.type === "ENDPOINT") {
                        headerBg = "#fffbeb";
                        strokeBorder = isSelected ? "#d97706" : "#fde68a";
                        headerIcon = "🔌";
                        headerLabel = `${meta.label} ENDPOINT`;
                      } else if (node.type === "METHOD") {
                        headerBg = "#f5f3ff";
                        strokeBorder = isSelected ? "#7c3aed" : "#ddd6fe";
                        headerIcon = meta.icon;
                        headerLabel = `${meta.label} METHOD`;
                      } else if (node.type === "DOC") {
                        headerBg = "#faf5ff";
                        strokeBorder = isSelected ? "#9333ea" : "#e9d5ff";
                        headerIcon = "📄";
                        headerLabel = "TÀI LIỆU CSDL";
                      }

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            isNodeDraggedRef.current = false;
                            setDraggingNodeId(node.id);
                            dragNodeStartRef.current = {
                              mouseX: e.clientX,
                              mouseY: e.clientY,
                              initialNodeX: node.x,
                              initialNodeY: node.y,
                            };
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isNodeDraggedRef.current) return;
                            setSelectedNode(node);
                          }}
                          className="cursor-grab active:cursor-grabbing group select-none"
                        >
                          <title>Kéo thả node để sắp xếp dây nối dễ nhìn • Nhấp để xem chi tiết</title>
                          {/* Hộp nền node */}
                          <rect
                            width="230"
                            height="52"
                            rx="8"
                            fill="#ffffff"
                            stroke={strokeBorder}
                            strokeWidth={isSelected ? 2 : 1}
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.04))"
                            className="transition-all duration-150 group-hover:stroke-emerald-500"
                          />
                          {/* Thanh header loại node */}
                          <rect width="230" height="20" rx="8" fill={headerBg} />

                          {/* Tiêu đề loại node */}
                          <text x="8" y="14" fontSize="9" fontWeight="600" fill="#475569">
                            {headerIcon} {headerLabel}
                          </text>

                          {/* Huy hiệu trạng thái */}
                          {node.docStatus && (
                            <text
                              x="222"
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
                            {node.name.length > 25 ? node.name.slice(0, 25) + "..." : node.name}
                          </text>

                          {/* Mô tả phụ / Tệp tin / Chữ ký */}
                          <text x="8" y="45" fontSize="8" fill="#64748b" className="truncate font-mono">
                            {node.signature
                              ? node.signature.length > 32
                                ? node.signature.slice(0, 32) + "..."
                                : node.signature
                              : node.filePath
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
                      <th className="py-2.5 px-3">Chữ ký hàm / Signature</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredNodes.filter((n) => n.type !== "REPO").length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          {stats.realFilesCount === 0 && stats.docsCount === 0 ? (
                            <div className="max-w-md mx-auto">
                              <FolderGit2 size={32} className="text-amber-500 mx-auto mb-2" />
                              <p className="font-semibold text-slate-800">Kho lưu trữ chưa có dữ liệu mã nguồn hoặc tài liệu</p>
                              <p className="text-xs text-slate-500 mt-1">Vui lòng tải lên tài liệu hoặc đồng bộ mã nguồn để xem ma trận.</p>
                            </div>
                          ) : (
                            "Không tìm thấy phần tử nào phù hợp với bộ lọc"
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredNodes
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
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] max-w-xs truncate">
                              {node.signature || "-"}
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
                        ))
                    )}
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
                  <label className="text-[11px] uppercase font-bold text-slate-400">Phân loại & Mô-đun</label>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-semibold">
                      {selectedNode.type}
                    </span>
                    {selectedNode.filePath && (() => {
                      const meta = getLanguageMeta(selectedNode.filePath);
                      return (
                        <span
                          className="px-2 py-0.5 rounded font-semibold text-[11px] border"
                          style={{ backgroundColor: meta.bg, borderColor: meta.border, color: meta.text }}
                        >
                          {meta.icon} {meta.label}
                        </span>
                      );
                    })()}
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

                {selectedNode.parameters && (
                  <div>
                    <label className="text-[11px] uppercase font-bold text-slate-400">Tham số hàm</label>
                    <div className="font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 mt-0.5 break-all">
                      {selectedNode.parameters}
                    </div>
                  </div>
                )}

                {selectedNode.returnType && (
                  <div>
                    <label className="text-[11px] uppercase font-bold text-slate-400">Kiểu trả về</label>
                    <div className="font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 mt-0.5">
                      {selectedNode.returnType}
                    </div>
                  </div>
                )}

                {selectedNode.startLine && (
                  <div>
                    <label className="text-[11px] uppercase font-bold text-slate-400">Vị trí dòng trong mã nguồn</label>
                    <div className="font-mono text-slate-700 mt-0.5">
                      Dòng {selectedNode.startLine} → Dòng {selectedNode.endLine || selectedNode.startLine}
                    </div>
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
      </>
    )}
  </div>
</AppShell>
  );
}
