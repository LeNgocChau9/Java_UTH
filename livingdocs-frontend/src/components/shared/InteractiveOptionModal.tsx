"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  FileText,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Code,
  Check,
} from "lucide-react";
import type { MissingCodeEntityDto } from "@/services/templateService";

export type OptionMode =
  | "AUTO_SCAFFOLD_ALL"
  | "CUSTOM_SELECTION"
  | "APPEND_EVIDENCE_ONLY"
  | "IGNORE_KEEP_RAW";

export interface InteractiveOptionChoice {
  mode: OptionMode;
  selectedHeadings: string[];
  selectedEntities: MissingCodeEntityDto[];
}

export interface InteractiveOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  templateName?: string;
  missingHeadings: string[];
  missingEntities: MissingCodeEntityDto[];
  onApplyOption: (choice: InteractiveOptionChoice) => void;
}

export const InteractiveOptionModal: React.FC<InteractiveOptionModalProps> = ({
  isOpen,
  onClose,
  title = "Tùy chọn Bổ sung & Chuẩn hóa Tài liệu",
  templateName = "Mẫu Tiêu chuẩn Dự án (10 Phần)",
  missingHeadings,
  missingEntities,
  onApplyOption,
}) => {
  const [selectedMode, setSelectedMode] = useState<OptionMode>("AUTO_SCAFFOLD_ALL");
  const [chosenHeadings, setChosenHeadings] = useState<string[]>([]);
  const [chosenEntities, setChosenEntities] = useState<MissingCodeEntityDto[]>([]);
  const [showCustomDetails, setShowCustomDetails] = useState(false);

  // Khởi tạo các mục được chọn mặc định khi mở modal
  useEffect(() => {
    if (isOpen) {
      setChosenHeadings([...missingHeadings]);
      setChosenEntities([...missingEntities]);
      setSelectedMode("AUTO_SCAFFOLD_ALL");
      setShowCustomDetails(false);
    }
  }, [isOpen, missingHeadings, missingEntities]);

  if (!isOpen) return null;

  const totalMissing = missingHeadings.length + missingEntities.length;

  const toggleHeading = (heading: string) => {
    setChosenHeadings((prev) =>
      prev.includes(heading) ? prev.filter((h) => h !== heading) : [...prev, heading]
    );
  };

  const toggleEntity = (entity: MissingCodeEntityDto) => {
    setChosenEntities((prev) => {
      const exists = prev.some(
        (e) => e.className === entity.className && e.methodName === entity.methodName
      );
      if (exists) {
        return prev.filter(
          (e) => !(e.className === entity.className && e.methodName === entity.methodName)
        );
      } else {
        return [...prev, entity];
      }
    });
  };

  const selectAllCustom = () => {
    setChosenHeadings([...missingHeadings]);
    setChosenEntities([...missingEntities]);
  };

  const deselectAllCustom = () => {
    setChosenHeadings([]);
    setChosenEntities([]);
  };

  const handleConfirm = () => {
    onApplyOption({
      mode: selectedMode,
      selectedHeadings: selectedMode === "CUSTOM_SELECTION" ? chosenHeadings : missingHeadings,
      selectedEntities: selectedMode === "CUSTOM_SELECTION" ? chosenEntities : missingEntities,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                {title}
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0 0" }}>
                Đối chiếu với: <strong style={{ color: "#334155" }}>{templateName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cảnh báo tình trạng tài liệu */}
        <div
          style={{
            padding: "0.875rem 1.5rem",
            background: totalMissing > 0 ? "#fffbeb" : "#ecfdf5",
            borderBottom: "1px solid",
            borderColor: totalMissing > 0 ? "#fef3c7" : "#d1fae5",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {totalMissing > 0 ? (
            <AlertTriangle size={18} style={{ color: "#d97706", flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={18} style={{ color: "#10b981", flexShrink: 0 }} />
          )}
          <div style={{ fontSize: "0.875rem", color: totalMissing > 0 ? "#92400e" : "#065f46" }}>
            {totalMissing > 0 ? (
              <span>
                Phát hiện <strong>{missingHeadings.length} mục thiếu</strong> theo mẫu chuẩn và{" "}
                <strong>{missingEntities.length} thực thể mã nguồn</strong> chưa được tài liệu hóa.
                Hãy chọn phương án xử lý bên dưới:
              </span>
            ) : (
              <span>Tài liệu đã đầy đủ toàn bộ các phần theo mẫu và mã nguồn.</span>
            )}
          </div>
        </div>

        {/* Nội dung danh sách Options */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {/* OPTION 1: Tự động bổ sung tất cả (Khuyên dùng) */}
            <label
              onClick={() => {
                setSelectedMode("AUTO_SCAFFOLD_ALL");
                setShowCustomDetails(false);
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                padding: "1rem",
                borderRadius: "12px",
                border: "2px solid",
                borderColor: selectedMode === "AUTO_SCAFFOLD_ALL" ? "#2563eb" : "#e2e8f0",
                backgroundColor: selectedMode === "AUTO_SCAFFOLD_ALL" ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="radio"
                name="optionMode"
                checked={selectedMode === "AUTO_SCAFFOLD_ALL"}
                onChange={() => {
                  setSelectedMode("AUTO_SCAFFOLD_ALL");
                  setShowCustomDetails(false);
                }}
                style={{ marginTop: "4px", accentColor: "#2563eb" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#1e293b" }}>
                    Tự động bổ sung toàn bộ {missingHeadings.length} mục còn thiếu
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: "#2563eb",
                      color: "#ffffff",
                      textTransform: "uppercase",
                      letterSpacing: "0.025em",
                    }}
                  >
                    Khuyên dùng
                  </span>
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.45 }}>
                  AI sẽ tự động chèn khung sườn kỹ thuật cho các phần bị thiếu theo đúng template 10 phần, 
                  đồng thời đính kèm tài liệu tóm tắt cho các class/method còn thiếu vào cuối tài liệu.
                </p>
              </div>
            </label>

            {/* OPTION 2: Tự chọn từng mục */}
            <div
              style={{
                borderRadius: "12px",
                border: "2px solid",
                borderColor: selectedMode === "CUSTOM_SELECTION" ? "#2563eb" : "#e2e8f0",
                backgroundColor: selectedMode === "CUSTOM_SELECTION" ? "#f8fafc" : "#ffffff",
                transition: "all 0.15s ease",
                overflow: "hidden",
              }}
            >
              <label
                onClick={() => {
                  setSelectedMode("CUSTOM_SELECTION");
                  setShowCustomDetails(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                  padding: "1rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="optionMode"
                  checked={selectedMode === "CUSTOM_SELECTION"}
                  onChange={() => {
                    setSelectedMode("CUSTOM_SELECTION");
                    setShowCustomDetails(true);
                  }}
                  style={{ marginTop: "4px", accentColor: "#2563eb" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#1e293b" }}>
                      Tự chọn từng mục muốn bổ sung (Custom Checklist)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCustomDetails((v) => !v);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#64748b",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        fontSize: "0.75rem",
                      }}
                    >
                      {showCustomDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      {chosenHeadings.length + chosenEntities.length} đã chọn
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.45 }}>
                    Chủ động lựa chọn chính xác các phần hoặc lớp mã nguồn mà bạn muốn chèn thêm vào tài liệu.
                  </p>
                </div>
              </label>

              {/* Chi tiết Checklist mở rộng */}
              {selectedMode === "CUSTOM_SELECTION" && showCustomDetails && (
                <div
                  style={{
                    padding: "0 1rem 1rem 2.75rem",
                    borderTop: "1px dashed #cbd5e1",
                    background: "#f1f5f9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      margin: "0.75rem 0 0.5rem 0",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                      CHỌN CÁC MỤC BỔ SUNG ({chosenHeadings.length + chosenEntities.length} / {totalMissing})
                    </span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={selectAllCustom}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#2563eb",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Chọn tất cả
                      </button>
                      <span style={{ color: "#cbd5e1" }}>|</span>
                      <button
                        type="button"
                        onClick={deselectAllCustom}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#64748b",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  {/* Mục Heading còn thiếu */}
                  {missingHeadings.length > 0 && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                        Tiêu đề mẫu còn thiếu:
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {missingHeadings.map((heading) => {
                          const isChecked = chosenHeadings.includes(heading);
                          return (
                            <label
                              key={heading}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.8125rem",
                                color: isChecked ? "#1e293b" : "#64748b",
                                background: "#ffffff",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleHeading(heading)}
                                style={{ accentColor: "#2563eb" }}
                              />
                              <FileText size={13} style={{ color: "#2563eb" }} />
                              <span style={{ fontWeight: isChecked ? 600 : 400 }}>{heading}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Thực thể Code còn thiếu */}
                  {missingEntities.length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                        Thực thể mã nguồn chưa tài liệu hóa:
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "150px", overflowY: "auto" }}>
                        {missingEntities.map((ent, idx) => {
                          const isChecked = chosenEntities.some(
                            (e) => e.className === ent.className && e.methodName === ent.methodName
                          );
                          return (
                            <label
                              key={`${ent.className}-${ent.methodName || idx}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.8125rem",
                                color: isChecked ? "#1e293b" : "#64748b",
                                background: "#ffffff",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleEntity(ent)}
                                style={{ accentColor: "#2563eb" }}
                              />
                              <Code size={13} style={{ color: "#087f5b" }} />
                              <span>
                                <strong style={{ color: "#0f172a" }}>{ent.className}</strong>
                                {ent.methodName ? ` .${ent.methodName}()` : ""}
                                <span style={{ color: "#94a3b8", fontSize: "0.75rem", marginLeft: 4 }}>
                                  ({ent.entityType})
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* OPTION 3: Giữ nguyên văn bản Word gốc & Chỉ gắn hộp đối soát */}
            <label
              onClick={() => {
                setSelectedMode("APPEND_EVIDENCE_ONLY");
                setShowCustomDetails(false);
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                padding: "1rem",
                borderRadius: "12px",
                border: "2px solid",
                borderColor: selectedMode === "APPEND_EVIDENCE_ONLY" ? "#2563eb" : "#e2e8f0",
                backgroundColor: selectedMode === "APPEND_EVIDENCE_ONLY" ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="radio"
                name="optionMode"
                checked={selectedMode === "APPEND_EVIDENCE_ONLY"}
                onChange={() => {
                  setSelectedMode("APPEND_EVIDENCE_ONLY");
                  setShowCustomDetails(false);
                }}
                style={{ marginTop: "4px", accentColor: "#2563eb" }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#1e293b" }}>
                  Giữ nguyên 100% nội dung Word gốc & Chỉ gắn Hộp đối soát AST
                </span>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.45 }}>
                  Không chèn thêm tiêu đề còn thiếu vào văn bản, chỉ bổ sung bảng{" "}
                  <strong>Grounding Evidence Box</strong> ở cuối để lưu vết xác thực mã nguồn.
                </p>
              </div>
            </label>

            {/* OPTION 4: Bỏ qua kiểm tra */}
            <label
              onClick={() => {
                setSelectedMode("IGNORE_KEEP_RAW");
                setShowCustomDetails(false);
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                padding: "1rem",
                borderRadius: "12px",
                border: "2px solid",
                borderColor: selectedMode === "IGNORE_KEEP_RAW" ? "#2563eb" : "#e2e8f0",
                backgroundColor: selectedMode === "IGNORE_KEEP_RAW" ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="radio"
                name="optionMode"
                checked={selectedMode === "IGNORE_KEEP_RAW"}
                onChange={() => {
                  setSelectedMode("IGNORE_KEEP_RAW");
                  setShowCustomDetails(false);
                }}
                style={{ marginTop: "4px", accentColor: "#2563eb" }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#1e293b" }}>
                  Bỏ qua cảnh báo & Giữ nguyên bản
                </span>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.45 }}>
                  Không thực hiện bất kỳ thay đổi nào lên tài liệu. Bạn có thể tự chỉnh sửa thủ công bất cứ lúc nào.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            background: "#f8fafc",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Check size={16} />
            Xác nhận & Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
};
