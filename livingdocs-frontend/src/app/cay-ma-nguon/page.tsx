"use client";

import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import {
  codeEntityService,
  CodeEntityDto,
} from "@/services/codeEntityService";
import { repoService, RepoItem } from "@/services/repoService";
import {
  Folder,
  FolderOpen,
  FileCode,
  ChevronRight,
  ChevronDown,
  Box,
  Search,
  Code,
  Hash,
  Sparkles,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

// Dữ liệu fallback chuẩn 5 file Java trong demo-samples khi backend chưa kết nối DB
const DEMO_SAMPLES_ENTITIES: Record<string, CodeEntityDto[]> = {
  "src/com/example/demo/controller/OrderController.java": [
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/controller/OrderController.java",
      entityType: "CLASS",
      className: "OrderController",
      signature: "public class OrderController",
      startLine: 15,
      endLine: 75,
      docStatus: "DOCUMENTED",
      javadoc: "Controller xử lý các REST API liên quan đến quản lý đơn hàng.",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/controller/OrderController.java",
      entityType: "CONSTRUCTOR",
      className: "OrderController",
      methodName: "OrderController",
      signature:
        "public OrderController(PaymentService paymentService, UserService userService, NotificationService notificationService)",
      parameters:
        "PaymentService paymentService, UserService userService, NotificationService notificationService",
      startLine: 21,
      endLine: 25,
      docStatus: "UNDOCUMENTED",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/controller/OrderController.java",
      entityType: "METHOD",
      className: "OrderController",
      methodName: "createOrder",
      signature:
        "public Order createOrder(String userId, BigDecimal amount, String paymentMethod)",
      returnType: "Order",
      parameters: "String userId, BigDecimal amount, String paymentMethod",
      startLine: 35,
      endLine: 52,
      docStatus: "DOCUMENTED",
      javadoc:
        "Tiếp nhận yêu cầu tạo đơn hàng mới và thực hiện thanh toán tự động.\n@param userId Mã người dùng đặt hàng\n@param amount Tổng số tiền đơn hàng\n@param paymentMethod Phương thức thanh toán (VIETQR, CREDIT_CARD)\n@return Order Đối tượng đơn hàng sau khi tạo và xử lý thanh toán",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/controller/OrderController.java",
      entityType: "METHOD",
      className: "OrderController",
      methodName: "getOrderDetails",
      signature: "public Order getOrderDetails(String orderId)",
      returnType: "Order",
      parameters: "String orderId",
      startLine: 60,
      endLine: 63,
      docStatus: "DOCUMENTED",
      javadoc:
        "Tra cứu thông tin chi tiết của một đơn hàng.\n@param orderId Mã định danh đơn hàng cần tìm\n@return Order Đối tượng đơn hàng hoặc null nếu không tìm thấy",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/controller/OrderController.java",
      entityType: "METHOD",
      className: "OrderController",
      methodName: "cancelOrder",
      signature: "public boolean cancelOrder(String orderId, String reason)",
      returnType: "boolean",
      parameters: "String orderId, String reason",
      startLine: 72,
      endLine: 74,
      docStatus: "DOCUMENTED",
      javadoc:
        "Hủy đơn hàng và kích hoạt hoàn tiền nếu đơn đã thanh toán.\n@param orderId Mã đơn hàng cần hủy\n@param reason Lý do hủy đơn\n@return boolean Trả về true nếu hủy thành công",
    },
  ],
  "src/com/example/demo/model/Order.java": [
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/model/Order.java",
      entityType: "CLASS",
      className: "Order",
      signature: "public class Order",
      startLine: 9,
      endLine: 66,
      docStatus: "UNDOCUMENTED",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/model/Order.java",
      entityType: "CONSTRUCTOR",
      className: "Order",
      methodName: "Order",
      signature: "public Order()",
      startLine: 16,
      endLine: 17,
      docStatus: "UNDOCUMENTED",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/model/Order.java",
      entityType: "CONSTRUCTOR",
      className: "Order",
      methodName: "Order",
      signature:
        "public Order(String orderId, String userId, BigDecimal totalAmount, String status, LocalDateTime createdAt)",
      parameters:
        "String orderId, String userId, BigDecimal totalAmount, String status, LocalDateTime createdAt",
      startLine: 19,
      endLine: 25,
      docStatus: "UNDOCUMENTED",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/model/Order.java",
      entityType: "METHOD",
      className: "Order",
      methodName: "getOrderId",
      signature: "public String getOrderId()",
      returnType: "String",
      startLine: 27,
      endLine: 29,
      docStatus: "UNDOCUMENTED",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/model/Order.java",
      entityType: "METHOD",
      className: "Order",
      methodName: "setOrderId",
      signature: "public void setOrderId(String orderId)",
      returnType: "void",
      parameters: "String orderId",
      startLine: 31,
      endLine: 33,
      docStatus: "UNDOCUMENTED",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/model/Order.java",
      entityType: "METHOD",
      className: "Order",
      methodName: "getTotalAmount",
      signature: "public BigDecimal getTotalAmount()",
      returnType: "BigDecimal",
      startLine: 43,
      endLine: 45,
      docStatus: "UNDOCUMENTED",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/model/Order.java",
      entityType: "METHOD",
      className: "Order",
      methodName: "getStatus",
      signature: "public String getStatus()",
      returnType: "String",
      startLine: 51,
      endLine: 53,
      docStatus: "UNDOCUMENTED",
    },
  ],
  "src/com/example/demo/service/NotificationService.java": [
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/NotificationService.java",
      entityType: "CLASS",
      className: "NotificationService",
      signature: "public class NotificationService",
      startLine: 7,
      endLine: 38,
      docStatus: "DOCUMENTED",
      javadoc: "Service phụ trách gửi thông báo cho khách hàng qua Email và Zalo.",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/NotificationService.java",
      entityType: "METHOD",
      className: "NotificationService",
      methodName: "sendEmail",
      signature:
        "public boolean sendEmail(String recipientEmail, String subject, String content)",
      returnType: "boolean",
      parameters: "String recipientEmail, String subject, String content",
      startLine: 16,
      endLine: 22,
      docStatus: "DOCUMENTED",
      javadoc:
        "Gửi email thông báo đơn hàng hoặc cập nhật trạng thái.\n@param recipientEmail Địa chỉ email người nhận\n@param subject Tiêu đề thư\n@param content Nội dung thông báo\n@return boolean Trả về true nếu gửi thành công",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/NotificationService.java",
      entityType: "METHOD",
      className: "NotificationService",
      methodName: "sendZaloNotification",
      signature: "public boolean sendZaloNotification(String zaloUserId, String message)",
      returnType: "boolean",
      parameters: "String zaloUserId, String message",
      startLine: 31,
      endLine: 37,
      docStatus: "DOCUMENTED",
      javadoc: "Gửi tin nhắn Zalo ZNS chăm sóc khách hàng.",
    },
  ],
  "src/com/example/demo/service/PaymentService.java": [
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/PaymentService.java",
      entityType: "CLASS",
      className: "PaymentService",
      signature: "public class PaymentService",
      startLine: 8,
      endLine: 40,
      docStatus: "DOCUMENTED",
      javadoc: "Service tích hợp cổng thanh toán trực tuyến (VietQR, Thẻ quốc tế).",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/PaymentService.java",
      entityType: "METHOD",
      className: "PaymentService",
      methodName: "processPayment",
      signature: "public boolean processPayment(Order order, String paymentMethod)",
      returnType: "boolean",
      parameters: "Order order, String paymentMethod",
      startLine: 18,
      endLine: 25,
      docStatus: "DOCUMENTED",
      javadoc:
        "Xử lý giao dịch thanh toán cho một đơn hàng cụ thể.\n@param order Đơn hàng cần thanh toán\n@param paymentMethod Phương thức thanh toán\n@return boolean True nếu thanh toán thành công",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/PaymentService.java",
      entityType: "METHOD",
      className: "PaymentService",
      methodName: "refundPayment",
      signature: "public boolean refundPayment(String orderId, String reason)",
      returnType: "boolean",
      parameters: "String orderId, String reason",
      startLine: 34,
      endLine: 39,
      docStatus: "DOCUMENTED",
      javadoc: "Kích hoạt hoàn tiền khi đơn hàng bị hủy bỏ.",
    },
  ],
  "src/com/example/demo/service/UserService.java": [
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/UserService.java",
      entityType: "CLASS",
      className: "UserService",
      signature: "public class UserService",
      startLine: 8,
      endLine: 44,
      docStatus: "DOCUMENTED",
      javadoc: "Service quản lý thông tin người dùng và định danh tài khoản.",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/UserService.java",
      entityType: "CONSTRUCTOR",
      className: "UserService",
      methodName: "UserService",
      signature: "public UserService()",
      startLine: 13,
      endLine: 16,
      docStatus: "UNDOCUMENTED",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/UserService.java",
      entityType: "METHOD",
      className: "UserService",
      methodName: "findEmailById",
      signature: "public String findEmailById(String userId)",
      returnType: "String",
      parameters: "String userId",
      startLine: 24,
      endLine: 29,
      docStatus: "DOCUMENTED",
      javadoc:
        "Tìm kiếm email của khách hàng theo mã định danh tài khoản.\n@param userId Mã tài khoản người dùng\n@return String Email khách hàng hoặc null",
    },
    {
      repositoryId: 1,
      filePath: "src/com/example/demo/service/UserService.java",
      entityType: "METHOD",
      className: "UserService",
      methodName: "authenticate",
      signature: "public boolean authenticate(String email, String password)",
      returnType: "boolean",
      parameters: "String email, String password",
      startLine: 38,
      endLine: 43,
      docStatus: "DOCUMENTED",
      javadoc: "Xác thực danh tính người dùng bằng email và mật khẩu.",
    },
  ],
};

// Cấu trúc node cây thư mục
interface FileTreeNode {
  id: string;
  name: string;
  fullPath: string;
  isFolder: boolean;
  children?: FileTreeNode[];
  entityCount?: number;
}

export default function SourceTreePage() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>(
    "src/com/example/demo/controller/OrderController.java"
  );
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    src: true,
    "src/com": true,
    "src/com/example": true,
    "src/com/example/demo": true,
    "src/com/example/demo/controller": true,
    "src/com/example/demo/model": true,
    "src/com/example/demo/service": true,
  });

  const [entities, setEntities] = useState<CodeEntityDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  // 1. Tải danh sách repositories
  useEffect(() => {
    async function loadRepos() {
      try {
        const data = await repoService.getRepositories();
        if (data && data.length > 0) {
          setRepos(data);
          setSelectedRepo(data[0]);
        } else {
          const fallback: RepoItem = {
            repositoryId: 1,
            workspaceId: 1,
            connectionId: 1,
            githubRepoId: 987654,
            repoName: "Java_UTH",
            repoFullName: "LeNgocChau9/Java_UTH",
            defaultBranch: "main",
            isActive: true,
            autoDocEnabled: true,
          };
          setRepos([fallback]);
          setSelectedRepo(fallback);
        }
      } catch {
        const fallback: RepoItem = {
          repositoryId: 1,
          workspaceId: 1,
          connectionId: 1,
          githubRepoId: 987654,
          repoName: "Java_UTH",
          repoFullName: "LeNgocChau9/Java_UTH",
          defaultBranch: "main",
          isActive: true,
          autoDocEnabled: true,
        };
        setRepos([fallback]);
        setSelectedRepo(fallback);
      }
    }
    loadRepos();
  }, []);

  // 2. Tải danh sách Code Entities cho file được chọn
  useEffect(() => {
    if (!selectedRepo || !selectedFile) return;

    async function loadEntities() {
      setLoading(true);
      try {
        const data = await codeEntityService.getByFile(
          selectedRepo!.repositoryId,
          selectedFile
        );
        if (data && data.length > 0) {
          setEntities(data);
        } else {
          // Dùng dữ liệu fallback chuẩn Tree-sitter demo
          setEntities(DEMO_SAMPLES_ENTITIES[selectedFile] || []);
        }
      } catch {
        setEntities(DEMO_SAMPLES_ENTITIES[selectedFile] || []);
      } finally {
        setLoading(false);
      }
    }

    loadEntities();
  }, [selectedRepo, selectedFile]);

  // 3. Xây dựng cây thư mục từ các đường dẫn file
  const treeData = useMemo<FileTreeNode[]>(() => {
    const filePaths = Object.keys(DEMO_SAMPLES_ENTITIES);
    const rootNodes: Record<string, FileTreeNode> = {};

    filePaths.forEach((path) => {
      const parts = path.split("/");
      let currentPath = "";
      const currentLevel: Record<string, FileTreeNode> = rootNodes;

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = index === parts.length - 1;

        if (!currentLevel[part]) {
          currentLevel[part] = {
            id: currentPath,
            name: part,
            fullPath: currentPath,
            isFolder: !isFile,
            children: isFile ? undefined : [],
            entityCount: isFile
              ? DEMO_SAMPLES_ENTITIES[currentPath]?.length || 0
              : 0,
          };
        }
        if (!isFile) {
          if (!currentLevel[part].children) {
            currentLevel[part].children = [];
          }
          // Chuyển level sang children dạng record tạm
        }
      });
    });

    // Xây dựng tree đệ quy chuẩn
    function buildNodeTree(paths: string[]): FileTreeNode[] {
      const root: FileTreeNode[] = [];

      paths.forEach((p) => {
        const parts = p.split("/");
        let currentArr = root;

        parts.forEach((part, idx) => {
          const isFile = idx === parts.length - 1;
          const fullPath = parts.slice(0, idx + 1).join("/");
          let existing = currentArr.find((n) => n.name === part);

          if (!existing) {
            existing = {
              id: fullPath,
              name: part,
              fullPath,
              isFolder: !isFile,
              children: isFile ? undefined : [],
              entityCount: isFile ? DEMO_SAMPLES_ENTITIES[p]?.length || 0 : 0,
            };
            currentArr.push(existing);
          }

          if (!isFile && existing.children) {
            currentArr = existing.children;
          }
        });
      });

      return root;
    }

    return buildNodeTree(filePaths);
  }, []);

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSig(text);
    setTimeout(() => setCopiedSig(null), 2000);
  };

  // 4. Lọc danh sách entities theo bộ lọc & tìm kiếm
  const filteredEntities = useMemo(() => {
    return entities.filter((item) => {
      // Lọc theo entityType
      if (filterType !== "ALL") {
        if (filterType === "CLASS" && item.entityType !== "CLASS") return false;
        if (filterType === "METHOD" && item.entityType !== "METHOD") return false;
        if (filterType === "CONSTRUCTOR" && item.entityType !== "CONSTRUCTOR")
          return false;
      }
      // Lọc theo search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName =
          item.methodName?.toLowerCase().includes(q) ||
          item.className?.toLowerCase().includes(q);
        const matchSig = item.signature?.toLowerCase().includes(q);
        const matchJd = item.javadoc?.toLowerCase().includes(q);
        if (!matchName && !matchSig && !matchJd) return false;
      }
      return true;
    });
  }, [entities, filterType, searchQuery]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = entities.length;
    const classes = entities.filter((e) => e.entityType === "CLASS").length;
    const methods = entities.filter((e) => e.entityType === "METHOD").length;
    const constructors = entities.filter(
      (e) => e.entityType === "CONSTRUCTOR"
    ).length;
    const documented = entities.filter((e) => e.docStatus === "DOCUMENTED").length;
    return { total, classes, methods, constructors, documented };
  }, [entities]);

  // Render đệ quy cây thư mục
  const renderTree = (nodes: FileTreeNode[], depth = 0) => {
    return (
      <div className="space-y-0.5">
        {nodes.map((node) => {
          if (node.isFolder) {
            const isOpen = !!openFolders[node.fullPath];
            return (
              <div key={node.id}>
                <button
                  type="button"
                  onClick={() => toggleFolder(node.fullPath)}
                  style={{ paddingLeft: `${depth * 14 + 8}px` }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100  :bg-slate-800"
                >
                  <span className="text-slate-400">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  {isOpen ? (
                    <FolderOpen size={15} className="text-amber-500 shrink-0" />
                  ) : (
                    <Folder size={15} className="text-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{node.name}</span>
                </button>
                {isOpen && node.children && (
                  <div>{renderTree(node.children, depth + 1)}</div>
                )}
              </div>
            );
          }

          // File Java
          const isSelected = selectedFile === node.fullPath;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedFile(node.fullPath)}
              style={{ paddingLeft: `${depth * 14 + 24}px` }}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition ${
                isSelected
                  ? "bg-emerald-50 font-semibold text-emerald-800 border-l-2 border-emerald-600  "
                  : "text-slate-600 hover:bg-slate-100  :bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode size={15} className="text-emerald-600 shrink-0" />
                <span className="truncate">{node.name}</span>
              </div>
              {node.entityCount !== undefined && node.entityCount > 0 && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-600  ">
                  {node.entityCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header trang */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 ">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-100 p-1.5 text-emerald-700">
                <Code size={20} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]" style={{ color: "#0f172a" }}>
                Cây mã nguồn & AST Inspector
              </h1>
            </div>
            <p className="mt-1 text-sm text-[#475569]" style={{ color: "#475569" }}>
              Khám phá cấu trúc mã nguồn dự án, trực quan hóa Class, Function, Method và tài liệu được bóc tách từ Tree-sitter AST.
            </p>
          </div>

          {/* Chọn Kho lưu trữ */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Kho lưu trữ:</span>
            <select
              value={selectedRepo?.repositoryId || 1}
              onChange={(e) => {
                const r = repos.find(
                  (item) => item.repositoryId === Number(e.target.value)
                );
                if (r) setSelectedRepo(r);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none   "
            >
              {repos.map((r) => (
                <option key={r.repositoryId} value={r.repositoryId}>
                  {r.repoFullName || r.repoName} ({r.defaultBranch || "main"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nội dung 2 cột: Cột trái Cây thư mục - Cột phải Danh sách Entities */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* CỘT TRÁI: Cây thư mục mã nguồn (4 cols) */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm  ">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 ">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800 ">
                  Cây thư mục mã nguồn
                </h2>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600  ">
                File mã nguồn
              </span>
            </div>

            <div className="max-h-[620px] overflow-y-auto pr-1">
              {renderTree(treeData)}
            </div>

            <div className="mt-4 rounded-lg bg-emerald-50/70 p-3 text-xs text-emerald-800   border border-emerald-100 ">
              <div className="flex items-start gap-1.5">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <span className="font-semibold">Mẹo:</span> Click vào file mã nguồn bất kỳ để xem toàn bộ danh sách Class, Hàm và Phương thức đã phân tích cú pháp AST.
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: Chi tiết AST của file được chọn (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Thanh thông tin file + Bộ lọc */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm  ">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCode size={18} className="text-emerald-600" />
                    <span className="text-sm font-bold text-slate-900  break-all">
                      {selectedFile}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 ">
                    <span>Tổng số: <strong className="text-slate-700 ">{stats.total} phần tử</strong></span>
                    <span>•</span>
                    <span>Class: <strong className="text-emerald-600">{stats.classes}</strong></span>
                    <span>•</span>
                    <span>Method: <strong className="text-blue-600">{stats.methods}</strong></span>
                    <span>•</span>
                    <span>Constructor: <strong className="text-amber-600">{stats.constructors}</strong></span>
                    <span>•</span>
                    <span>Có Javadoc: <strong className="text-purple-600">{stats.documented}/{stats.total}</strong></span>
                  </div>
                </div>

                {/* Nhóm Filter & Search */}
                <div className="flex items-center gap-2">
                  {/* Filter Type */}
                  <div className="relative">
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none   "
                    >
                      <option value="ALL">Tất cả loại</option>
                      <option value="CLASS">Chỉ Class</option>
                      <option value="METHOD">Chỉ Method</option>
                      <option value="CONSTRUCTOR">Chỉ Constructor</option>
                    </select>
                  </div>

                  {/* Search Query */}
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Tìm method, class..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-36 sm:w-44 rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none   "
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Danh sách các Entities bóc tách */}
            {loading ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white  ">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <RefreshCw size={16} className="animate-spin text-emerald-600" />
                  Đang tải phần tử mã nguồn từ AST...
                </div>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center  ">
                <Box size={36} className="text-slate-300  mb-2" />
                <p className="text-sm font-medium text-slate-700 ">
                  Không tìm thấy phần tử mã nào
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Thử thay đổi từ khóa tìm kiếm hoặc chọn loại phần tử khác.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntities.map((item, idx) => {
                  const isClass = item.entityType === "CLASS";
                  const isMethod = item.entityType === "METHOD";
                  const isCtor = item.entityType === "CONSTRUCTOR";

                  return (
                    <div
                      key={idx}
                      className={`group rounded-xl border bg-white p-4.5 shadow-sm transition-all hover:shadow-md  ${
                        isClass
                          ? "border-emerald-200 hover:border-emerald-400 "
                          : isCtor
                          ? "border-amber-200 hover:border-amber-400 "
                          : "border-slate-200 hover:border-blue-400 "
                      }`}
                    >
                      {/* Dòng tiêu đề entity */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Entity Type Badge */}
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-semibold tracking-wider ${
                                isClass
                                  ? "bg-emerald-100 text-emerald-800  "
                                  : isMethod
                                  ? "bg-blue-100 text-blue-800  "
                                  : "bg-amber-100 text-amber-800  "
                              }`}
                            >
                              {item.entityType}
                            </span>

                            {/* Entity Name */}
                            <h3 className="text-sm font-bold text-slate-900 ">
                              {item.methodName || item.className}
                            </h3>

                            {/* Return Type Badge */}
                            {item.returnType && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700  ">
                                ➔ {item.returnType}
                              </span>
                            )}

                            {/* Doc Status Badge */}
                            <span
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                item.docStatus === "DOCUMENTED"
                                  ? "bg-purple-100 text-purple-700  "
                                  : "bg-slate-100 text-slate-500  "
                              }`}
                            >
                              {item.docStatus === "DOCUMENTED" ? (
                                <>
                                  <CheckCircle2 size={10} /> Đã có Javadoc
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={10} /> Chưa có tài liệu
                                </>
                              )}
                            </span>
                          </div>

                          {/* Full Signature Box */}
                          <div className="relative mt-2 flex items-center rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-400 shadow-inner">
                            <code className="truncate pr-8">{item.signature}</code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.signature)}
                              title="Sao chép chữ ký"
                              className="absolute right-2 text-slate-400 hover:text-white transition"
                            >
                              {copiedSig === item.signature ? (
                                <Check size={14} className="text-emerald-400" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Vị trí dòng mã */}
                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-600  ">
                            <Hash size={12} />
                            Dòng {item.startLine} ➔ {item.endLine}
                          </span>
                        </div>
                      </div>

                      {/* Chi tiết Parameters nếu có */}
                      {item.parameters && (
                        <div className="mt-3 border-t border-slate-100 pt-2 ">
                          <span className="text-[11px] font-medium text-slate-500 ">
                            Tham số ({item.parameters.split(",").length}):
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {item.parameters.split(",").map((p, pIdx) => (
                              <span
                                key={pIdx}
                                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700  "
                              >
                                {p.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Javadoc / Tài liệu trích xuất từ mã nguồn */}
                      {item.javadoc && (
                        <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50/50 p-2.5 text-xs text-purple-900   ">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-700  mb-1">
                            <BookOpen size={12} />
                            Javadoc trích xuất:
                          </div>
                          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 ">
                            {item.javadoc}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
