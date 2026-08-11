/** Trợ lý AI: hỏi đáp và phân tích doanh thu. */
import { api } from '@/lib/api-client';
import { getCafeId } from './cafe-id';

// Trợ lý AI (chat + phân tích doanh thu). Quyền do BE chặn (middleware 'ai');
// FE khóa nút bằng canUseAI() cho gọn UX.
export interface AiRevenueAnalysis {
  tom_tat: string;
  diem_noi_bat: string[];
  canh_bao: string[];
  goi_y_hanh_dong: string[];
}

export interface AiRevenueResponse {
  analysis: AiRevenueAnalysis;
  stats: Record<string, unknown>;
  cached: boolean;
}

export const aiService = {
  chat: async (messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const cafeId = await getCafeId();
    const res = await api.post<{ reply: string }>(`/cafes/${cafeId}/ai/chat`, { messages });
    return res.reply;
  },
  // Streaming: gọi onChunk(text) cho từng đoạn AI sinh ra (hiệu ứng gõ chữ).
  chatStream: async (
    messages: { role: 'user' | 'assistant'; content: string }[],
    onChunk: (text: string) => void,
  ): Promise<void> => {
    const cafeId = await getCafeId();
    const res = await api.postStream(`/cafes/${cafeId}/ai/chat/stream`, { messages });
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) onChunk(chunk);
    }
  },
  revenueAnalysis: async (refresh = false) => {
    const cafeId = await getCafeId();
    return api.post<AiRevenueResponse>(`/cafes/${cafeId}/ai/revenue-analysis`, { refresh });
  },
  /**
   * Câu gợi ý mở đầu, chọn theo tình trạng thật của quán.
   *
   * Backend sinh chứ không ghi cứng ở đây: nó là nơi biết quán đang có bàn nào
   * phục vụ, hôm nay bán được gì — và cũng là nơi dựng ngữ cảnh gửi cho Gemini.
   * Hai bên cùng một nguồn thì không còn cảnh gợi ý hỏi thứ AI không trả lời được.
   * Endpoint này KHÔNG gọi Gemini, chỉ đếm dữ liệu.
   */
  suggestions: async (): Promise<string[]> => {
    const cafeId = await getCafeId();
    const res = await api.get<{ suggestions: string[] }>(`/cafes/${cafeId}/ai/suggestions`);
    return res.suggestions ?? [];
  },
};
