import { apiClient } from "./apiClient";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: "gemini" | "ollama" | "fallback";
  model?: string;
  citations?: string[];
  timestamp: string;
}

export interface ChatResponseDto {
  status: string;
  reply: string;
  provider: "gemini" | "ollama" | "fallback";
  model: string;
  citations?: string[];
}

export interface ChatContextDto {
  repositoryId?: number;
  docId?: number;
}

export const aiChatService = {
  async sendMessage(
    message: string,
    history: ChatMessage[] = [],
    context?: ChatContextDto
  ): Promise<ChatResponseDto> {
    const formattedHistory = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await apiClient.post<ChatResponseDto>("/api/v1/ai/chat", {
      message,
      history: formattedHistory,
      repositoryId: context?.repositoryId,
      docId: context?.docId,
    });
    return res.data;
  },
};
