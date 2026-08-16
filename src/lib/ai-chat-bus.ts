/**
 * Mở hộp chat AI từ bất kỳ đâu trong trang.
 *
 * Vì sao dùng sự kiện cửa sổ chứ không phải React context: widget được gắn ở HAI
 * nơi độc lập — `AiChatMount` trong layout gốc (trang công khai) và `UserLayout`
 * (khu quản lý). Dựng một provider bao trùm cả hai nghĩa là kéo state của widget
 * lên tận layout gốc, bắt mọi trang phải nằm trong provider đó chỉ để vài chỗ gọi
 * được một hàm. Sự kiện cửa sổ giữ widget khép kín: nơi gọi không cần biết widget
 * nằm ở đâu, có tồn tại hay không.
 */
export const SU_KIEN_MO_CHAT = 'funcafe:mo-hop-chat';

export interface ChiTietMoChat {
  /** Câu hỏi gửi luôn khi mở. Bỏ trống thì chỉ mở hộp, để người dùng tự gõ. */
  cauHoi?: string;
}

/** Mở hộp chat AI. An toàn khi gọi ở phía máy chủ (không làm gì cả). */
export function moHopChat(cauHoi?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ChiTietMoChat>(SU_KIEN_MO_CHAT, { detail: { cauHoi } }));
}
