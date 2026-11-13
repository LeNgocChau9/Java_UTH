"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { diffLines, type Change } from "diff";
import { AppShell } from "@/components/AppShell";
import { documentService } from "@/services/documentService";
import { reviewService, type ReviewQueueItem } from "@/services/reviewService";
import { codeEntityService, type CodeEntityDto } from "@/services/codeEntityService";
import { repoService, type RepoItem } from "@/services/repoService";
import type { DocumentDetail } from "@/types/document";

function splitMarkdownSections(markdown: string): { heading: string; body: string }[] {
  const lines = markdown.split(/\r?\n/);
  const sections: { heading: string; body: string }[] = [];
  let current = { heading: "Mở đầu", body: "" };
  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (match) {
      if (current.heading !== "Mở đầu" || current.body.trim()) {
        sections.push(current);
      }
      current = { heading: match[2].trim(), body: "" };
    } else {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current.heading !== "Mở đầu" || current.body.trim()) {
    sections.push(current);
  }
  return sections.length > 0 ? sections : [{ heading: "Nội dung", body: markdown }];
}
import {
  Inbox,
  Clock,
  FileText,
  GitBranch,
  Eye,
  Edit3,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  AlertCircle,
  Code2,
  FileCode2,
  Save,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  X,
  FileDiff,
  CheckCircle2,
  Maximize2,
  Minimize2,
} from "lucide-react";

export default function HangDoiXemXetStaffPage() {
  // Danh sách tài liệu trong hàng đợi
  const [documents, setDocuments] = useState<ReviewQueueItem[]>([]);
  const [sectionComments, setSectionComments] = useState<Record<string, string>>({});
  const [repositories, setRepositories] = useState<Record<number, RepoItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  // Tài liệu đang được chọn để đối chiếu và xem xét
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDocDetail, setSelectedDocDetail] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Dữ liệu đối chiếu: Code entities tham chiếu từ AST
  const [codeEntities, setCodeEntities] = useState<CodeEntityDto[]>([]);
  const [loadingEntities, setLoadingEntities] = useState<boolean>(false);

  // State chỉnh sửa trực tiếp nội dung Markdown
  const [editingContent, setEditingContent] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"diff" | "preview" | "edit">("diff");
  const [compareVersionNum, setCompareVersionNum] = useState<number | null>(null);
  const [isWideDiff, setIsWideDiff] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");

  // State Review comment và quyết định
  const [reviewComment, setReviewComment] = useState<string>("");
  const [processingAction, setProcessingAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // 1. Tải danh sách tài liệu UNDER_REVIEW_STAFF và Repository thật từ CSDL
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffQueue, allRepos] = await Promise.all([
        reviewService.getStaffQueue(),
        repoService.getRepositories().catch(() => [] as RepoItem[]),
      ]);
      setDocuments(staffQueue);

      const repoMap: Record<number, RepoItem> = {};
      allRepos.forEach((r) => {
        repoMap[r.repositoryId] = r;
      });
      setRepositories(repoMap);

      // Nếu tài liệu đang chọn không còn trong hàng đợi, reset selection
      if (selectedDocId && !staffQueue.some((d) => d.docId === selectedDocId)) {
        setSelectedDocId(null);
        setSelectedDocDetail(null);
      }
    } catch (err) {
      console.error("Lỗi khi tải hàng đợi xem xét:", err);
      setError("Không thể kết nối API để tải danh sách tài liệu chờ Staff xem xét.");
    } finally {
      setLoading(false);
    }
  }, [selectedDocId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // 2. Tải chi tiết tài liệu và AST Code Entities tham chiếu khi chọn tài liệu
  const handleSelectDoc = async (docId: number) => {
    setSelectedDocId(docId);
    setLoadingDetail(true);
    setLoadingEntities(true);
    setError(null);
    setActionSuccessMessage(null);
    setActiveTab("diff");
    setCompareVersionNum(null);
    setIsWideDiff(false);
    setShowRejectModal(false);
    setReviewComment("");
    setSectionComments({});

    try {
      const detail = await documentService.getDocumentById(docId);
      setSelectedDocDetail(detail);
      const content = detail.latestVersion?.content || "";
      setEditingContent(content);

      // Lấy danh sách code entities của repository này để đối chiếu
      try {
        const entities = await codeEntityService.getByRepository(detail.repoId);
        // Nếu document có targetPath (ví dụ: src/.../UserService.java.md), lọc các entity theo filePath tương ứng
        const rawSourcePath = detail.targetPath ? detail.targetPath.replace(/\.md$/, "") : "";
        const matchedEntities = rawSourcePath
          ? entities.filter((e) => e.filePath.includes(rawSourcePath) || rawSourcePath.includes(e.filePath))
          : entities;

        setCodeEntities(matchedEntities.length > 0 ? matchedEntities : entities);
      } catch (entityErr) {
        console.warn("Không tải được code entities tương ứng:", entityErr);
        setCodeEntities([]);
      }
    } catch (err) {
      console.error("Lỗi khi tải chi tiết tài liệu:", err);
      setError("Không thể tải chi tiết tài liệu hoặc phiên bản mới nhất.");
    } finally {
      setLoadingDetail(false);
      setLoadingEntities(false);
    }
  };

  // 3. Cho phép Staff chỉnh sửa trực tiếp các lỗi nhỏ và lưu lại bản mới
  const handleSaveEdit = async () => {
    if (!selectedDocDetail) return;
    setSavingEdit(true);
    setError(null);

    try {
      await documentService.updateDocument(selectedDocDetail.docId, {
        content: editingContent,
        actorRole: "STAFF",
        triggerType: "STAFF_INLINE_EDIT",
      });

      // Tải lại chi tiết bản ghi vừa cập nhật
      const refreshed = await documentService.getDocumentById(selectedDocDetail.docId);
      setSelectedDocDetail(refreshed);
      setEditingContent(refreshed.latestVersion?.content || "");
      setActiveTab("diff");
      setActionSuccessMessage("Đã lưu các chỉnh sửa nhỏ của Staff thành công (tạo phiên bản v" + refreshed.currentVersion + ").");
    } catch (err) {
      console.error("Lỗi khi lưu chỉnh sửa:", err);
      setError("Không thể lưu thay đổi. Vui lòng thử lại.");
    } finally {
      setSavingEdit(false);
    }
  };

  // 4. Hai nút hành động: Phê duyệt (chuyển sang UNDER_REVIEW_MANAGER) hoặc Từ chối (kèm lý do)
  const handleDecision = async (decision: "APPROVE" | "REJECT", customComment?: string) => {
    if (!selectedDocDetail) return;

    const filledSections = Object.entries(sectionComments)
      .filter(([, text]) => text.trim())
      .map(([textSegment, detailedComment]) => ({
        textSegment,
        detailedComment: detailedComment.trim(),
      }));

    const finalComment = customComment !== undefined ? customComment : reviewComment.trim();

    if (decision === "REJECT" && !finalComment && filledSections.length === 0) {
      setError("Vui lòng nhập lý do từ chối để trả tài liệu về nhà phát triển.");
      return;
    }

    setProcessingAction(decision);
    setError(null);
    setActionSuccessMessage(null);

    try {
      await reviewService.processStaffAction(selectedDocDetail.docId, {
        decision,
        sectionComments: filledSections,
      });

      const successText = decision === "APPROVE"
        ? `Tài liệu "${selectedDocDetail.title}" đã được duyệt và chuyển Manager (UNDER_REVIEW_MANAGER).`
        : `Tài liệu "${selectedDocDetail.title}" đã bị từ chối (REJECTED) và trả về nhà phát triển kèm lý do.`;

      setActionSuccessMessage(successText);
      setSelectedDocId(null);
      setSelectedDocDetail(null);
      await fetchQueue();
    } catch (err) {
      console.error(`Lỗi khi xử lý quyết định ${decision}:`, err);
      setError("Không thể cập nhật trạng thái tài liệu. Vui lòng kiểm tra lại quyền truy cập.");
    } finally {
      setProcessingAction(null);
    }
  };

  // 3 Nút thao tác nhanh của bảng So sánh Diff hai cột:
  // Nút 1: Chấp nhận đề xuất cập nhật tài liệu
  const handleQuickApprove = () => {
    const comment = reviewComment.trim() || "Staff đã đối chiếu trực quan diff hai cột và chấp nhận đề xuất cập nhật tự động của AI.";
    handleDecision("APPROVE", comment);
  };

  // Nút 2: Chỉnh sửa thêm
  const handleQuickEdit = () => {
    setActiveTab("edit");
  };

  // Nút 3: Loại bỏ phiên bản cập nhật (mở modal xác nhận)
  const handleQuickRejectOpen = () => {
    setRejectReason(reviewComment.trim() || "Từ chối đề xuất cập nhật tự động của AI do sai lệch nội dung so với mã nguồn thực tế.");
    setShowRejectModal(true);
  };

  const handleConfirmRejectModal = () => {
    setShowRejectModal(false);
    handleDecision("REJECT", rejectReason.trim() || "Loại bỏ đề xuất cập nhật của AI do không đạt yêu cầu đối chiếu.");
  };

  // Lịch sử phiên bản trước để so sánh đối chiếu hai cột
  const earlierVersions = useMemo(() => {
    if (!selectedDocDetail?.versionHistory) return [];
    return selectedDocDetail.versionHistory
      .filter((v) => v.versionNum < selectedDocDetail.currentVersion)
      .sort((a, b) => b.versionNum - a.versionNum);
  }, [selectedDocDetail]);

  const previousVersion = useMemo(() => {
    if (earlierVersions.length === 0) return null;
    if (compareVersionNum !== null) {
      const matched = earlierVersions.find((v) => v.versionNum === compareVersionNum);
      if (matched) return matched;
    }
    return earlierVersions[0];
  }, [earlierVersions, compareVersionNum]);

  const publishedContent = previousVersion ? previousVersion.content || "" : "";
  const aiContent = editingContent || selectedDocDetail?.latestVersion?.content || "";

  interface DiffRowItem {
    leftLineNo: number | null;
    leftText: string;
    leftType: "delete" | "equal" | "empty";
    rightLineNo: number | null;
    rightText: string;
    rightType: "insert" | "equal" | "empty";
  }

  const diffAnalysis = useMemo(() => {
    if (!selectedDocDetail) {
      return { rows: [] as DiffRowItem[], addedCount: 0, removedCount: 0, unchangedCount: 0 };
    }

    // Nếu là tài liệu v1 hoàn toàn mới, chưa có phiên bản xuất bản trước đó
    if (!previousVersion) {
      const lines = (aiContent || "").split(/\r?\n/);
      if (lines.length > 0 && lines[lines.length - 1] === "" && aiContent.endsWith("\n")) {
        lines.pop();
      }
      const rows: DiffRowItem[] = lines.map((line, idx) => ({
        leftLineNo: null,
        leftText: "",
        leftType: "empty",
        rightLineNo: idx + 1,
        rightText: line,
        rightType: "insert",
      }));
      return {
        rows,
        addedCount: lines.length,
        removedCount: 0,
        unchangedCount: 0,
      };
    }

    const changes: Change[] = diffLines(publishedContent, aiContent);
    const rows: DiffRowItem[] = [];
    let leftLine = 1;
    let rightLine = 1;
    let addedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];

      if (!change.added && !change.removed) {
        const lines = change.value.split(/\r?\n/);
        if (lines.length > 0 && lines[lines.length - 1] === "" && change.value.endsWith("\n")) {
          lines.pop();
        }
        for (const line of lines) {
          rows.push({
            leftLineNo: leftLine++,
            leftText: line,
            leftType: "equal",
            rightLineNo: rightLine++,
            rightText: line,
            rightType: "equal",
          });
          unchangedCount++;
        }
      } else {
        let removedLines: string[] = [];
        let addedLines: string[] = [];

        if (change.removed) {
          removedLines = change.value.split(/\r?\n/);
          if (removedLines.length > 0 && removedLines[removedLines.length - 1] === "" && change.value.endsWith("\n")) {
            removedLines.pop();
          }
          if (i + 1 < changes.length && changes[i + 1].added) {
            addedLines = changes[i + 1].value.split(/\r?\n/);
            if (addedLines.length > 0 && addedLines[addedLines.length - 1] === "" && changes[i + 1].value.endsWith("\n")) {
              addedLines.pop();
            }
            i++;
          }
        } else if (change.added) {
          addedLines = change.value.split(/\r?\n/);
          if (addedLines.length > 0 && addedLines[addedLines.length - 1] === "" && change.value.endsWith("\n")) {
            addedLines.pop();
          }
        }

        removedCount += removedLines.length;
        addedCount += addedLines.length;

        const maxLen = Math.max(removedLines.length, addedLines.length);
        for (let k = 0; k < maxLen; k++) {
          const hasLeft = k < removedLines.length;
          const hasRight = k < addedLines.length;

          rows.push({
            leftLineNo: hasLeft ? leftLine++ : null,
            leftText: hasLeft ? removedLines[k] : "",
            leftType: hasLeft ? "delete" : "empty",
            rightLineNo: hasRight ? rightLine++ : null,
            rightText: hasRight ? addedLines[k] : "",
            rightType: hasRight ? "insert" : "empty",
          });
        }
      }
    }

    return { rows, addedCount, removedCount, unchangedCount };
  }, [selectedDocDetail, previousVersion, publishedContent, aiContent]);

  // Lọc theo từ khóa tìm kiếm
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const repoName = repositories[doc.repoId]?.repoFullName || "";
      const query = search.toLowerCase();
      return doc.title.toLowerCase().includes(query) || (doc.targetPath && doc.targetPath.toLowerCase().includes(query)) || repoName.toLowerCase().includes(query);
    });
  }, [documents, repositories, search]);

  return (
    <AppShell>
      {/* Page Header */}
      <div className="ld-page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="ld-page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Inbox size={22} style={{ color: "#0f766e" }} />
              Hàng đợi xem xét của Staff (Review Queue)
            </h1>
            <p className="ld-page-subtitle">
              Đối chiếu tài liệu AI sinh với mã nguồn thực tế (AST code_entities), chỉnh sửa trực tiếp và phê duyệt chuyển Manager.
            </p>
          </div>
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="ld-btn ld-btn-secondary ld-btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Làm mới hàng đợi
          </button>
        </div>
      </div>

      {/* Thông báo Alert */}
      {actionSuccessMessage && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            borderRadius: 6,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            color: "#166534",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={16} />
            <span>{actionSuccessMessage}</span>
          </div>
          <button onClick={() => setActionSuccessMessage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            borderRadius: 6,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="ld-card" style={{ flex: "1 1 180px", padding: "14px 18px", borderLeft: "4px solid #0f766e" }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Đang chờ Staff duyệt</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#0f766e", margin: "4px 0 0" }}>
            {documents.length}
          </p>
        </div>
        <div className="ld-card" style={{ flex: "1 1 180px", padding: "14px 18px", borderLeft: "4px solid #b45309" }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Trạng thái quy trình</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#b45309", margin: "8px 0 0" }}>
            UNDER_REVIEW_STAFF
          </p>
        </div>
        <div className="ld-card" style={{ flex: "1 1 180px", padding: "14px 18px", borderLeft: "4px solid #2563eb" }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Bước tiếp theo</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#2563eb", margin: "8px 0 0" }}>
            Chuyển sang UNDER_REVIEW_MANAGER
          </p>
        </div>
      </div>

      {/* Main Container */}
      {!selectedDocId ? (
        /* Danh sách Hàng đợi khi chưa chọn tài liệu */
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Ô tìm kiếm */}
          <div style={{ position: "relative", maxWidth: 400 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
                pointerEvents: "none",
              }}
            />
            <input
              className="ld-input"
              style={{ paddingLeft: 32 }}
              placeholder="Tìm theo tên tài liệu, đường dẫn file, repo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Bảng danh sách hàng đợi */}
          <div className="ld-card" style={{ padding: 0, overflow: "hidden", border: "1px solid #dfe7e4" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #dfe7e4", background: "#f8faf9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f766e", margin: 0 }}>
                Danh sách tài liệu cần đối chiếu ({filteredDocs.length})
              </p>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Nguồn: CSDL thực tế (bảng documents)
              </span>
            </div>

            {loading ? (
              <div style={{ padding: "48px 0", textAlign: "center", color: "#64748b" }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px", color: "#0f766e" }} />
                <p style={{ margin: 0, fontSize: 13 }}>Đang tải hàng đợi tài liệu...</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center", color: "#64748b" }}>
                <CheckCircle size={32} style={{ margin: "0 auto 10px", color: "#10b981", opacity: 0.6 }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: "#0f172a", margin: "0 0 4px" }}>
                  Hàng đợi xem xét đang trống
                </p>
                <p style={{ fontSize: 12, margin: 0 }}>
                  Không có tài liệu nào ở trạng thái UNDER_REVIEW_STAFF cần xử lý.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredDocs.map((doc) => {
                  const repoInfo = repositories[doc.repoId];
                  return (
                    <div
                      key={doc.docId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 18px",
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 150ms",
                        cursor: "pointer",
                      }}
                      className="queue-hover-item"
                      onClick={() => handleSelectDoc(doc.docId)}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 6,
                            background: "#ecfdf5",
                            color: "#0f766e",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        >
                          <FileText size={18} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                              {doc.title}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: "#fffbeb",
                                color: "#b45309",
                                border: "1px solid #fde68a",
                                padding: "2px 8px",
                                borderRadius: 4,
                              }}
                            >
                              Chờ Staff duyệt
                            </span>
                            {doc.structureWarning && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: "#fef2f2",
                                  color: "#991b1b",
                                  border: "1px solid #fecaca",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                }}
                              >
                                Thiếu đề mục bắt buộc
                              </span>
                            )}
                            {(doc.aiGenerated ||
                              doc.authorRole === "AI_AGENT" ||
                              doc.authorRole === "AI" ||
                              doc.latestVersion?.actorRole === "AI_AGENT" ||
                              doc.latestVersion?.triggerType === "AUTO_DRIFT_AI_REWRITE") && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: "#f5f3ff",
                                  color: "#7c3aed",
                                  border: "1px solid #ddd6fe",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                Agent tự cập nhật
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                              v{doc.currentVersion}
                            </span>
                          </div>

                          <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <GitBranch size={12} />
                              {repoInfo?.repoFullName || `Repo #${doc.repoId}`}
                            </span>
                            {doc.targetPath && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <FileCode2 size={12} />
                                {doc.targetPath}
                              </span>
                            )}
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={12} />
                              Cập nhật: {new Date(doc.updatedAt || doc.createdAt).toLocaleString("vi-VN")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="ld-btn ld-btn-primary ld-btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectDoc(doc.docId);
                        }}
                      >
                        <Eye size={13} />
                        Mở đối chiếu & Xét duyệt
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Giao diện đối chiếu Split-View khi đã chọn tài liệu */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Top Bar điều hướng */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={() => {
                setSelectedDocId(null);
                setSelectedDocDetail(null);
              }}
              className="ld-btn ld-btn-secondary ld-btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <ChevronLeft size={14} />
              Quay lại danh sách hàng đợi
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Đang xem xét: <strong style={{ color: "#0f172a" }}>{selectedDocDetail?.title}</strong>
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: "#fffbeb",
                  color: "#b45309",
                  border: "1px solid #fde68a",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                UNDER_REVIEW_STAFF
              </span>
            </div>
          </div>

          {selectedDocDetail?.structureWarning && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 6,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              <strong>Cảnh báo cấu trúc template.</strong> Tài liệu AI thiếu đề mục bắt buộc:{" "}
              {(selectedDocDetail.missingHeadings || []).join(", ") || "xem chi tiết template"}.
            </div>
          )}

          {loadingDetail ? (
            <div className="ld-card" style={{ padding: "60px 0", textAlign: "center", color: "#64748b" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px", color: "#0f766e" }} />
              <p style={{ margin: 0, fontSize: 13 }}>Đang tải nội dung đối chiếu...</p>
            </div>
          ) : (
            <>
              {/* Giao diện đối chiếu 2 cột (Split View): Bên trái Tài liệu AI - Bên phải Code tham chiếu AST */}
              <div
                className="comparison-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.15fr 0.85fr",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                {/* CỘT TRÁI: Nội dung tài liệu do AI tạo (Có chế độ Xem trước và Chỉnh sửa trực tiếp lỗi nhỏ) */}
                <div className="ld-card" style={{ padding: 0, overflow: "hidden", border: "1px solid #dfe7e4" }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #dfe7e4",
                      background: "#f8faf9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Sparkles size={15} style={{ color: "#0f766e" }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f766e", margin: 0 }}>
                        {activeTab === "diff"
                          ? `So sánh phiên bản: Đang xuất bản vs AI đề xuất (v${selectedDocDetail?.currentVersion})`
                          : `Nội dung tài liệu do AI sinh ra (v${selectedDocDetail?.currentVersion})`}
                      </p>
                    </div>

                    {/* Tab chuyển đổi Xem trước Markdown / Sửa trực tiếp */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("diff");
                        }}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "5px 10px",
                          borderRadius: 4,
                          border: "none",
                          background: activeTab === "diff" ? "#0f766e" : "#e2e8f0",
                          color: activeTab === "diff" ? "#ffffff" : "#475569",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <FileDiff size={12} />
                        So sánh Diff hai cột
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("preview");
                        }}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "5px 10px",
                          borderRadius: 4,
                          border: "none",
                          background: activeTab === "preview" ? "#0f766e" : "#e2e8f0",
                          color: activeTab === "preview" ? "#ffffff" : "#475569",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Eye size={12} />
                        Xem trước Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("edit");
                        }}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "5px 10px",
                          borderRadius: 4,
                          border: "none",
                          background: activeTab === "edit" ? "#0f766e" : "#e2e8f0",
                          color: activeTab === "edit" ? "#ffffff" : "#475569",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Edit3 size={12} />
                        Sửa trực tiếp lỗi nhỏ
                      </button>

                      {/* Nút mở rộng toàn màn hình cho khung so sánh Diff */}
                      <button
                        type="button"
                        onClick={() => setIsWideDiff((prev) => !prev)}
                        title={isWideDiff ? "Thu gọn về chế độ chia cột" : "Mở rộng toàn màn hình để xem diff thoải mái hơn"}
                        style={{
                          fontSize: 11,
                          padding: "5px 8px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#475569",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {isWideDiff ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        <span className="hidden sm:inline">{isWideDiff ? "Thu gọn" : "Mở rộng"}</span>
                      </button>
                    </div>
                  </div>

                  {/* VÙNG NỘI DUNG: TAB DIFF HAI CỘT HOẶC PREVIEW HOẶC EDIT */}
                  {activeTab === "diff" ? (
                    <div>
                      {/* THANH THAO TÁC NHANH (QUICK ACTIONS TOOLBAR) VÀ THỐNG KÊ DIFF */}
                      <div
                        style={{
                          padding: "8px 14px",
                          borderBottom: "1px solid #e2e8f0",
                          background: "#f8fafc",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        {/* Thống kê chênh lệch số dòng và bộ chọn phiên bản đối chiếu */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#047857",
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            +{diffAnalysis.addedCount} thêm mới
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#b91c1c",
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            -{diffAnalysis.removedCount} lược bỏ
                          </span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            ({diffAnalysis.unchangedCount} dòng giữ nguyên)
                          </span>

                          {earlierVersions.length > 1 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 6 }}>
                              <span style={{ fontSize: 11, color: "#64748b" }}>So sánh với:</span>
                              <select
                                className="ld-input"
                                style={{ fontSize: 11, padding: "2px 6px", height: 26, background: "#ffffff" }}
                                value={compareVersionNum || previousVersion?.versionNum || ""}
                                onChange={(e) => setCompareVersionNum(Number(e.target.value))}
                              >
                                {earlierVersions.map((v) => (
                                  <option key={v.versionId} value={v.versionNum}>
                                    v{v.versionNum} ({v.actorRole || "DEV"})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* 3 NÚT THAO TÁC NHANH: Chấp nhận đề xuất, Chỉnh sửa thêm, Loại bỏ phiên bản cập nhật */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {/* Nút 1: Chấp nhận đề xuất */}
                          <button
                            type="button"
                            onClick={handleQuickApprove}
                            disabled={processingAction !== null}
                            className="ld-btn ld-btn-primary ld-btn-sm"
                            title="Chấp nhận đề xuất cập nhật tài liệu do AI tạo và phê duyệt"
                            style={{
                              background: "#087f5b",
                              color: "#ffffff",
                              gap: 6,
                              fontSize: 12,
                              padding: "6px 14px",
                              fontWeight: 600,
                              boxShadow: "0 2px 6px rgba(8, 127, 91, 0.2)",
                              cursor: processingAction !== null ? "not-allowed" : "pointer",
                            }}
                          >
                            {processingAction === "APPROVE" ? (
                              <>
                                <RefreshCw size={13} className="animate-spin" />
                                Đang duyệt...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={14} />
                                Chấp nhận đề xuất
                              </>
                            )}
                          </button>

                          {/* Nút 2: Chỉnh sửa thêm */}
                          <button
                            type="button"
                            onClick={handleQuickEdit}
                            className="ld-btn ld-btn-secondary ld-btn-sm"
                            title="Mở trình soạn thảo Markdown để chỉnh sửa thêm nội dung"
                            style={{
                              gap: 6,
                              fontSize: 12,
                              padding: "6px 12px",
                              fontWeight: 600,
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              color: "#334155",
                            }}
                          >
                            <Edit3 size={13} style={{ color: "#0284c7" }} />
                            Chỉnh sửa thêm
                          </button>

                          {/* Nút 3: Loại bỏ phiên bản cập nhật */}
                          <button
                            type="button"
                            onClick={handleQuickRejectOpen}
                            disabled={processingAction !== null}
                            className="ld-btn ld-btn-ghost ld-btn-sm"
                            title="Loại bỏ phiên bản đề xuất cập nhật này và trả về nhà phát triển"
                            style={{
                              gap: 6,
                              fontSize: 12,
                              padding: "6px 12px",
                              fontWeight: 600,
                              color: "#dc2626",
                              background: "#ffffff",
                              border: "1px solid #fca5a5",
                              cursor: processingAction !== null ? "not-allowed" : "pointer",
                            }}
                          >
                            {processingAction === "REJECT" ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <XCircle size={13} />
                            )}
                            Loại bỏ phiên bản cập nhật
                          </button>
                        </div>
                      </div>

                      {/* HEADER HAI CỘT SONG SONG */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          borderBottom: "1px solid #e2e8f0",
                          background: "#f1f5f9",
                        }}
                      >
                        {/* Cột trái: Bản đang xuất bản / Phiên bản trước */}
                        <div
                          style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#334155",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }}></span>
                            Phiên bản đang xuất bản {previousVersion ? `(v${previousVersion.versionNum})` : "(Gốc)"}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#b91c1c",
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            HIỆN TẠI / GỐC
                          </span>
                        </div>

                        {/* Cột phải: Bản do AI đề xuất cập nhật */}
                        <div
                          style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#334155",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></span>
                            Phiên bản do AI đề xuất cập nhật tự động (v{selectedDocDetail?.currentVersion})
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#047857",
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            AI ĐỀ XUẤT CẬP NHẬT
                          </span>
                        </div>
                      </div>

                      {/* BẢNG SO SÁNH DIFF HAI CỘT SONG SONG VỚI CUỘN ĐỒNG BỘ */}
                      <div
                        style={{
                          maxHeight: "540px",
                          overflowY: "auto",
                          overflowX: "auto",
                          background: "#ffffff",
                        }}
                      >
                        {diffAnalysis.rows.length === 0 ? (
                          <div style={{ padding: "40px 16px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
                            Không có nội dung để hiển thị đối chiếu.
                          </div>
                        ) : (
                          <>
                            {diffAnalysis.addedCount === 0 && diffAnalysis.removedCount === 0 && (
                              <div
                                style={{
                                  padding: "8px 14px",
                                  background: "#f0fdf4",
                                  color: "#166534",
                                  fontSize: 12,
                                  borderBottom: "1px solid #bbf7d0",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <CheckCircle size={14} style={{ color: "#16a34a" }} />
                                Hai phiên bản hoàn toàn giống nhau, không có sự sai lệch nội dung.
                              </div>
                            )}

                            {diffAnalysis.rows.map((row, idx) => {
                              const isDel = row.leftType === "delete";
                              const isIns = row.rightType === "insert";
                              const isLeftEmpty = row.leftType === "empty";
                              const isRightEmpty = row.rightType === "empty";

                              return (
                                <div
                                  key={`diff-row-${idx}`}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    minHeight: 24,
                                    borderBottom: "1px solid #f1f5f9",
                                    fontFamily: "var(--font-mono, 'Consolas', monospace)",
                                    fontSize: 12,
                                  }}
                                >
                                  {/* CỘT TRÁI: Dòng của phiên bản trước/đang xuất bản */}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "stretch",
                                      borderRight: "1px solid #e2e8f0",
                                      background: isDel ? "#fef2f2" : isLeftEmpty ? "#f8fafc" : "#ffffff",
                                      borderLeft: isDel ? "3px solid #ef4444" : "3px solid transparent",
                                      color: isDel ? "#991b1b" : "#334155",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 38,
                                        flexShrink: 0,
                                        textAlign: "right",
                                        paddingRight: 6,
                                        userSelect: "none",
                                        color: isDel ? "#dc2626" : "#94a3b8",
                                        background: isDel ? "#fee2e2" : "#f8fafc",
                                        borderRight: "1px solid #e2e8f0",
                                        lineHeight: "24px",
                                      }}
                                    >
                                      {row.leftLineNo ?? ""}
                                    </div>
                                    <div
                                      style={{
                                        width: 18,
                                        flexShrink: 0,
                                        textAlign: "center",
                                        userSelect: "none",
                                        fontWeight: 700,
                                        lineHeight: "24px",
                                        color: isDel ? "#dc2626" : "transparent",
                                      }}
                                    >
                                      {isDel ? "-" : " "}
                                    </div>
                                    <div
                                      style={{
                                        flex: 1,
                                        padding: "0 8px",
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-all",
                                        lineHeight: "24px",
                                      }}
                                    >
                                      {row.leftText}
                                    </div>
                                  </div>

                                  {/* CỘT PHẢI: Dòng của phiên bản AI đề xuất cập nhật */}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "stretch",
                                      background: isIns ? "#f0fdf4" : isRightEmpty ? "#f8fafc" : "#ffffff",
                                      borderLeft: isIns ? "3px solid #10b981" : "3px solid transparent",
                                      color: isIns ? "#166534" : "#334155",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 38,
                                        flexShrink: 0,
                                        textAlign: "right",
                                        paddingRight: 6,
                                        userSelect: "none",
                                        color: isIns ? "#16a34a" : "#94a3b8",
                                        background: isIns ? "#dcfce7" : "#f8fafc",
                                        borderRight: "1px solid #e2e8f0",
                                        lineHeight: "24px",
                                      }}
                                    >
                                      {row.rightLineNo ?? ""}
                                    </div>
                                    <div
                                      style={{
                                        width: 18,
                                        flexShrink: 0,
                                        textAlign: "center",
                                        userSelect: "none",
                                        fontWeight: 700,
                                        lineHeight: "24px",
                                        color: isIns ? "#16a34a" : "transparent",
                                      }}
                                    >
                                      {isIns ? "+" : " "}
                                    </div>
                                    <div
                                      style={{
                                        flex: 1,
                                        padding: "0 8px",
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-all",
                                        lineHeight: "24px",
                                      }}
                                    >
                                      {row.rightText}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  ) : activeTab === "preview" ? (
                    <div style={{ padding: 18, maxHeight: "560px", overflowY: "auto" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {splitMarkdownSections(editingContent || selectedDocDetail?.latestVersion?.content || "").map((section) => (
                          <div key={section.heading} style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f766e", margin: "0 0 8px" }}>
                              {section.heading}
                            </h3>
                            <div className="markdown-viewer" style={{ fontSize: 13, lineHeight: 1.6 }}>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {section.body.trim() || "_Mục này chưa có nội dung._"}
                              </ReactMarkdown>
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginTop: 8 }}>
                              Nhận xét mục này
                            </label>
                            <textarea
                              className="ld-input"
                              style={{ minHeight: 52, fontSize: 12, marginTop: 4, background: "#ffffff" }}
                              placeholder={`Nhận xét cho "${section.heading}"...`}
                              value={sectionComments[section.heading] || ""}
                              onChange={(e) =>
                                setSectionComments((prev) => ({ ...prev, [section.heading]: e.target.value }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 18, maxHeight: "560px", overflowY: "auto" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                          Staff có thể trực tiếp sửa lỗi chính tả, câu từ hoặc format Markdown trước khi bấm phê duyệt:
                        </p>
                        <textarea
                          className="ld-input"
                          style={{
                            minHeight: "440px",
                            fontFamily: "monospace",
                            fontSize: 12,
                            lineHeight: 1.5,
                            resize: "vertical",
                          }}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <button
                            type="button"
                            className="ld-btn ld-btn-secondary ld-btn-sm"
                            onClick={() => {
                              setEditingContent(selectedDocDetail?.latestVersion?.content || "");
                              setActiveTab("diff");
                            }}
                          >
                            Hủy sửa
                          </button>
                          <button
                            type="button"
                            className="ld-btn ld-btn-primary ld-btn-sm"
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            style={{ display: "flex", alignItems: "center", gap: 4 }}
                          >
                            {savingEdit ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Save size={12} />
                            )}
                            Lưu bản sửa (Tạo v{selectedDocDetail ? selectedDocDetail.currentVersion + 1 : 2})
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CỘT PHẢI: Thông tin code tham chiếu (file_path, signature, AST entities) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Bảng thông tin code tham chiếu */}
                  <div className="ld-card" style={{ padding: 0, overflow: "hidden", border: "1px solid #dfe7e4" }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #dfe7e4", background: "#f8faf9" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f766e", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <Code2 size={15} />
                        Mã nguồn tham chiếu (Code Entities AST)
                      </p>
                    </div>

                    <div style={{ padding: 14 }}>
                      {/* Meta file_path & repo */}
                      <div style={{ marginBottom: 12, padding: "8px 10px", background: "#f8faf9", borderRadius: 4, border: "1px solid #dfe7e4", fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: "#64748b" }}>File mã nguồn:</span>
                          <strong style={{ color: "#0f766e" }}>{selectedDocDetail?.targetPath?.replace(/\.md$/, "") || "Java source"}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748b" }}>Kho lưu trữ:</span>
                          <span>{repositories[selectedDocDetail?.repoId || 0]?.repoFullName || `Repo #${selectedDocDetail?.repoId}`}</span>
                        </div>
                      </div>

                      {/* Danh sách chữ ký (signature) và method/class đối chiếu */}
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>
                        Danh sách Method / Class đối chiếu ({codeEntities.length})
                      </p>

                      <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                        {loadingEntities ? (
                          <div style={{ padding: "20px 0", textAlign: "center", color: "#64748b", fontSize: 12 }}>
                            <RefreshCw size={14} className="animate-spin" style={{ margin: "0 auto 4px", color: "#0f766e" }} />
                            Đang tải AST entities...
                          </div>
                        ) : codeEntities.length === 0 ? (
                          <div style={{ padding: "20px 0", textAlign: "center", color: "#64748b", fontSize: 12 }}>
                            Chưa có AST code_entities nào được bóc tách cho file này.
                          </div>
                        ) : (
                          codeEntities.map((ent, idx) => (
                            <div
                              key={ent.entityId || idx}
                              style={{
                                padding: "8px 10px",
                                background: "#ffffff",
                                border: "1px solid #dfe7e4",
                                borderRadius: 4,
                                fontSize: 11,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                                <span style={{ fontWeight: 600, color: "#0f766e" }}>
                                  {ent.methodName || ent.className || ent.entityType}
                                </span>
                                <span style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: "1px 5px", borderRadius: 3 }}>
                                  L{ent.startLine}-L{ent.endLine}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: 10,
                                  color: "#334155",
                                  background: "#f8faf9",
                                  padding: "4px 6px",
                                  borderRadius: 3,
                                  overflowX: "auto",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {ent.signature}
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#64748b" }}>
                                <span>Trạng thái: <strong>{ent.docStatus}</strong></span>
                                <span>Commit: <code>{ent.commitHash?.substring(0, 7) || "head"}</code></span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Form Nhận xét & 2 Nút hành động của Staff */}
                  <div className="ld-card" style={{ padding: 16, border: "1px solid #dfe7e4", background: "#f8faf9" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
                      <MessageSquare size={15} style={{ color: "#0f766e" }} />
                      Nhận xét của Staff & Quyết định duyệt
                    </p>

                    <label style={{ fontSize: 11, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                      Ghi chú / Nhận xét (Review comment) hoặc Lý do từ chối:
                    </label>
                    <textarea
                      className="ld-input"
                      style={{
                        minHeight: 70,
                        resize: "vertical",
                        fontSize: 12,
                        marginBottom: 12,
                        background: "#ffffff",
                      }}
                      placeholder="Nhập ghi chú cho Manager hoặc lý do từ chối gửi lại tác giả (bắt buộc khi Từ chối)..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />

                    {/* 2 nút hành động: Phê duyệt chuyển Manager & Từ chối */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleDecision("APPROVE")}
                        disabled={processingAction !== null}
                        className="ld-btn ld-btn-primary"
                        style={{
                          justifyContent: "center",
                          gap: 6,
                          fontSize: 12,
                          padding: "9px 12px",
                        }}
                      >
                        {processingAction === "APPROVE" ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            Đang duyệt...
                          </>
                        ) : (
                          <>
                            <CheckCircle size={14} />
                            Phê duyệt trình quản lý
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDecision("REJECT")}
                        disabled={processingAction !== null}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          fontSize: 12,
                          padding: "9px 12px",
                          borderRadius: 6,
                          border: "1px solid #ef4444",
                          background: "#ffffff",
                          color: "#dc2626",
                          cursor: "pointer",
                          fontWeight: 600,
                          transition: "all 150ms",
                        }}
                      >
                        {processingAction === "REJECT" ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            Đang từ chối...
                          </>
                        ) : (
                          <>
                            <XCircle size={14} />
                            Từ chối trả về nhà phát triển
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL XÁC NHẬN LOẠI BỎ PHIÊN BẢN CẬP NHẬT */}
      {showRejectModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setShowRejectModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              padding: 24,
              width: "90%",
              maxWidth: 520,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <XCircle size={18} />
                Loại bỏ phiên bản đề xuất cập nhật
              </h3>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#475569", marginBottom: 12, lineHeight: 1.5 }}>
              Bạn đang chọn từ chối phiên bản cập nhật tự động do AI đề xuất cho tài liệu <strong>&quot;{selectedDocDetail?.title}&quot;</strong>. Vui lòng xác nhận lý do loại bỏ để gửi lại nhà phát triển / tác giả:
            </p>
            <textarea
              className="ld-input"
              style={{ minHeight: 90, fontSize: 12, width: "100%", marginBottom: 16, background: "#ffffff" }}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do loại bỏ phiên bản cập nhật..."
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="ld-btn ld-btn-secondary ld-btn-sm"
                onClick={() => setShowRejectModal(false)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="ld-btn ld-btn-sm"
                onClick={handleConfirmRejectModal}
                disabled={processingAction !== null}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  fontWeight: 600,
                  gap: 6,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <XCircle size={14} />
                Xác nhận loại bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .queue-hover-item:hover {
          background-color: #f8faf9;
        }
        @media (max-width: 900px) {
          .comparison-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .markdown-viewer h1 { font-size: 1.4rem; font-weight: 700; color: #0f766e; margin-bottom: 0.6rem; border-bottom: 1px solid #dfe7e4; padding-bottom: 0.2rem; }
        .markdown-viewer h2 { font-size: 1.2rem; font-weight: 600; color: #115e59; margin-top: 1.1rem; margin-bottom: 0.4rem; }
        .markdown-viewer h3 { font-size: 1.05rem; font-weight: 600; color: #0f172a; margin-top: 0.9rem; margin-bottom: 0.3rem; }
        .markdown-viewer p { margin-bottom: 0.6rem; color: #334155; }
        .markdown-viewer ul, .markdown-viewer ol { padding-left: 1.4rem; margin-bottom: 0.6rem; }
        .markdown-viewer li { margin-bottom: 0.2rem; }
        .markdown-viewer pre { background: #f8faf9; border: 1px solid #dfe7e4; border-radius: 6px; padding: 10px; overflow-x: auto; font-family: monospace; font-size: 11px; margin-bottom: 0.6rem; }
        .markdown-viewer code { background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #0f766e; }
        .markdown-viewer pre code { background: transparent; padding: 0; color: #0f172a; }
        .markdown-viewer table { width: 100%; border-collapse: collapse; margin-bottom: 0.6rem; font-size: 11px; }
        .markdown-viewer th, .markdown-viewer td { border: 1px solid #dfe7e4; padding: 5px 8px; }
        .markdown-viewer th { background: #f8faf9; font-weight: 600; color: #0f766e; }
        .markdown-viewer blockquote { border-left: 3px solid #0f766e; padding-left: 10px; color: #64748b; font-style: italic; margin-bottom: 0.6rem; }
      `}</style>
    </AppShell>
  );
}
