"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  RefreshCw,
  Minus,
  Zap,
} from "lucide-react";
import { aiChatService, type ChatMessage } from "@/services/aiChatService";
import { MarkdownViewer } from "@/components/shared/MarkdownViewer";

const INITIAL_MESSAGE: ChatMessage = {
  id: "init-1",
  role: "assistant",
  content:
    "Xin chào! Tôi là **ZAZA AI** của LivingDocs.\n\n" +
    "Tôi có thể hỗ trợ giải đáp mọi thắc mắc về:\n" +
    "- **Workspace:** Soạn thảo, nạp & xuất Word (`.docx`), đối chiếu Template chuẩn.\n" +
    "- **Khoảng trống tài liệu:** Tìm Class/Method chưa có tài liệu và tự động bổ sung.\n" +
    "- **Cây mã nguồn:** Bóc tách AST các thực thể mã nguồn.\n" +
    "- **Cảnh báo sai lệch (Drift):** Kiểm tra code thay đổi so với tài liệu hiện hành.\n\n" +
    "Bạn cần hỗ trợ điều gì hôm nay?",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

const SUGGESTIONS = [
  "Workspace & Xuất Word hoạt động ra sao?",
  "Cách đối chiếu tài liệu theo Template?",
  "Phát hiện Khoảng trống tài liệu ở đâu?",
  "Cảnh báo sai lệch (Drift) là gì?",
];

export function FloatingChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Send message handler
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await aiChatService.sendMessage(text, messages);

      const botMsg: ChatMessage = {
        id: "b-" + Date.now(),
        role: "assistant",
        content: res.reply,
        provider: res.provider,
        model: res.model,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        content:
          "Xin lỗi bạn, kết nối tới dịch vụ AI tạm thời bị gián đoạn. Bạn vui lòng thử lại sau giây lát hoặc kiểm tra kết nối mạng nhé!",
        provider: "fallback",
        model: "Offline Fallback",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <>
      {/* FLOATING ACTION LAUNCHER BUTTON */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }}
      >
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 10px 25px -3px rgba(220, 38, 38, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              transform: "scale(1)",
              display: "grid",
              placeItems: "center",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.08)";
              e.currentTarget.style.boxShadow = "0 14px 28px -3px rgba(220, 38, 38, 0.65)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 10px 25px -3px rgba(220, 38, 38, 0.5)";
            }}
            title="Mở ZAZA AI"
          >
            <div
              style={{
                position: "relative",
                width: 44,
                height: 44,
                borderRadius: "50%",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                backgroundColor: "#0b0f19",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-ai.png"
                alt="ZAZA AI"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <span
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                border: "2px solid #ffffff",
              }}
            />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -3,
                  right: -3,
                  fontSize: 10,
                  fontWeight: 700,
                  background: "#111827",
                  color: "#ffffff",
                  padding: "1px 6px",
                  borderRadius: 10,
                  border: "2px solid #ffffff",
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        )}

        {/* CHATBOT WINDOW DIALOG */}
        {isOpen && (
          <div
            style={{
              width: "min(400px, calc(100vw - 32px))",
              height: "min(580px, calc(100vh - 100px))",
              backgroundColor: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              boxShadow: "0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 10px 15px -5px rgba(0, 0, 0, 0.08)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "12px 16px",
                background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "1.5px solid rgba(255, 255, 255, 0.6)",
                    backgroundColor: "#0b0f19",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo-ai.png"
                    alt="ZAZA AI"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
                    ZAZA AI
                  </div>
                </div>
              </div>

              {/* Header Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={handleReset}
                  title="Làm mới đoạn hội thoại"
                  style={{
                    border: "none",
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    borderRadius: 6,
                    padding: 5,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Thu nhỏ Chatbot"
                  style={{
                    border: "none",
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    borderRadius: 6,
                    padding: 5,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Minus size={14} />
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "14px 14px 8px 14px",
                backgroundColor: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "88%",
                        padding: isUser ? "8px 12px" : "10px 14px",
                        borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                        backgroundColor: isUser ? "#dc2626" : "#ffffff",
                        color: isUser ? "#ffffff" : "#0f172a",
                        boxShadow: isUser
                          ? "0 2px 6px rgba(220, 38, 38, 0.25)"
                          : "0 1px 3px rgba(0, 0, 0, 0.08)",
                        border: isUser ? "none" : "1px solid #e2e8f0",
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}
                    >
                      {isUser ? (
                        <span>{m.content}</span>
                      ) : (
                        <div>
                          <MarkdownViewer content={m.content} />
                          {m.provider && (
                            <div
                              style={{
                                marginTop: 8,
                                paddingTop: 6,
                                borderTop: "1px dashed #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: 9.5,
                                color: "#64748b",
                              }}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                {m.provider === "gemini" ? (
                                  <>
                                    <Sparkles size={11} style={{ color: "#2563eb" }} />
                                    <span>Gemini API (Cloud)</span>
                                  </>
                                ) : m.provider === "ollama" ? (
                                  <>
                                    <Zap size={11} style={{ color: "#d97706" }} />
                                    <span>AI Local (Ollama GPU)</span>
                                  </>
                                ) : (
                                  <span>Trợ lý Dự phòng</span>
                                )}
                              </span>
                              <span>{m.timestamp}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px" }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#0b0f19",
                      flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo-ai.png"
                      alt="ZAZA AI"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
                    ZAZA AI đang suy nghĩ...
                  </span>
                </div>
              )}

              {/* Initial Suggestions */}
              {messages.length === 1 && !loading && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                    Gợi ý câu hỏi nhanh:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(s)}
                        style={{
                          textAlign: "left",
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                          fontSize: 11,
                          color: "#1e293b",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#eff6ff";
                          e.currentTarget.style.borderColor = "#93c5fd";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#ffffff";
                          e.currentTarget.style.borderColor = "#cbd5e1";
                        }}
                      >
                        💡 {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div
              style={{
                padding: "8px 12px 10px 12px",
                backgroundColor: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#f8fafc",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  padding: "4px 8px",
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Hỏi ZAZA AI (Enter để gửi)..."
                  rows={1}
                  disabled={loading}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    backgroundColor: "transparent",
                    fontSize: 12,
                    resize: "none",
                    maxHeight: 70,
                    lineHeight: 1.4,
                    color: "#0f172a",
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  style={{
                    border: "none",
                    backgroundColor: input.trim() && !loading ? "#dc2626" : "#cbd5e1",
                    color: "#ffffff",
                    borderRadius: 8,
                    width: 28,
                    height: 28,
                    display: "grid",
                    placeItems: "center",
                    cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                    transition: "background-color 0.15s ease",
                    flexShrink: 0,
                  }}
                  title="Gửi câu hỏi"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
