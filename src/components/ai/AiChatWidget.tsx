'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, X, Send, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canUseAI } from '@/lib/permission';
import { aiService } from '@/services';
import { ApiError } from '@/lib/api-client';

interface ChatMsg { role: 'user' | 'assistant'; content: string }

/**
 * MỘT hộp chat cho cả trang giới thiệu lẫn portal, cư xử theo quyền của người hỏi.
 *
 * Trước đây widget này chỉ nằm trong UserLayout và dựng một màn hình khóa cho ai
 * không có Pro Max — tức là người đang cân nhắc MUA thì không hỏi được gì, đúng chỗ
 * họ cần hỏi nhất. Nay chia làm hai chế độ:
 *
 *  · CÓ quyền đọc số liệu (gói bật can_use_ai) -> cafes/{cafe}/ai/chat/stream,
 *    ngữ cảnh có doanh thu, bàn, thực đơn của quán.
 *  · KHÔNG có quyền, hoặc chưa đăng nhập      -> ai/consult/stream, ngữ cảnh chỉ có
 *    bảng gói và thông tin sản phẩm.
 *
 * Ranh giới do MÁY CHỦ giữ, không phải chỗ này: tuyến cafes/{cafe}/ai/* vẫn qua
 * middleware 'ai' và trả 403 nếu gói không cho. Biến `duocDocDuLieu` ở đây chỉ để
 * chọn đúng tuyến ngay từ đầu, tránh cho người dùng ăn một lỗi 403 vô duyên.
 */

/** Câu mở đầu khi chưa hỏi được máy chủ, hoặc khi đang ở chế độ tư vấn bán hàng. */
const GOI_Y_TU_VAN = [
  'Quán tôi 25 bàn thì nên chọn gói nào?',
  'Gói Pro và Pro Max khác nhau chỗ nào?',
  'Đang dùng Pro, nâng lên Pro Max có được cấn trừ tiền không?',
];

const GOI_Y_QUAN = [
  'Gợi ý combo cho buổi chiều ế khách',
  'Làm sao tăng doanh thu cuối tuần?',
  'Nên đặt giá món mới thế nào cho hợp lý?',
];

/**
 * Gemini trả lời có markdown đậm (**...**) và nghiêng (*...*). Không render thì
 * người dùng thấy nguyên dấu sao. Chỉ xử lý đậm/nghiêng — đủ cho câu trả lời hội
 * thoại, không cần kéo cả thư viện markdown vào bundle.
 */
function renderBold(text: string) {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    // Gemini dùng "* " hoặc "- " làm dấu đầu dòng — đổi thành "•" cho gọn mắt.
    // (Không xử lý in nghiêng *...*: dấu sao đầu dòng sẽ bị nhận nhầm thành nghiêng.)
    const normalized = line.replace(/^(\s*)[*-]\s+/, '$1• ');
    // Sau khi đã bỏ dấu sao đầu dòng thì mọi cặp *...* còn lại đúng là in nghiêng.
    const parts = normalized.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
    return <span key={li}>{parts}{li < lines.length - 1 ? '\n' : ''}</span>;
  });
}

export default function AiChatWidget() {
  const { user } = useAuth();
  const duocDocDuLieu = canUseAI(user?.subscription);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(
    duocDocDuLieu ? GOI_Y_QUAN : GOI_Y_TU_VAN,
  );
  const suggestionsLoaded = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Gợi ý theo tình trạng THẬT của quán chỉ có nghĩa khi ngữ cảnh cũng có số liệu
  // quán — chế độ tư vấn thì dùng bộ câu bán hàng, không gọi máy chủ làm gì.
  //
  // Hỏi khi widget được MỞ chứ không lúc mount: widget nằm ở layout nên có mặt trên
  // mọi trang, gọi lúc mount là thêm một request cho mỗi lượt tải trang của mọi
  // người dùng, kể cả người không bao giờ mở nó.
  useEffect(() => {
    if (!open || !duocDocDuLieu || suggestionsLoaded.current) return;
    suggestionsLoaded.current = true;
    aiService.suggestions()
      .then(list => { if (list.length > 0) setSuggestions(list); })
      .catch(() => { /* giữ bộ mặc định */ });
  }, [open, duocDocDuLieu]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const base: ChatMsg[] = [...messages, { role: 'user', content }];
    // Thêm bong bóng trả lời rỗng để chữ chảy dần vào (hiệu ứng gõ chữ)
    setMessages([...base, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    const nhan = (chunk: string) => setMessages(prev => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { role: 'assistant', content: last.content + chunk };
      return copy;
    });

    try {
      if (duocDocDuLieu) {
        try {
          await aiService.chatStream(base.slice(-20), nhan);
        } catch (e) {
          // Tài khoản có gói nhưng chưa tạo quán nào: getCafeId() ném NO_CAFE. Rơi
          // về tuyến tư vấn còn hơn báo lỗi — họ vẫn hỏi được về sản phẩm.
          if (e instanceof Error && e.message === 'NO_CAFE') {
            await aiService.consultStream(base.slice(-10), nhan);
          } else {
            throw e;
          }
        }
      } else {
        await aiService.consultStream(base.slice(-10), nhan);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Có lỗi khi gọi trợ lý AI. Thử lại sau nhé.';
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  // Người chưa đăng nhập thì đường nâng gói là trang đăng ký; đã đăng nhập thì vào
  // thẳng trang gói. Gửi khách lạ tới /user/subscription là đá họ ra màn hình login.
  const duongNangGoi = user ? '/user/subscription' : '/register';

  return (
    <>
      {/* Nút nổi */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-bean text-white shadow-pop grid place-items-center transition-all duration-300 hover:bg-bean-dark hover:scale-110 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-bean/30"
        aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
        aria-expanded={open}
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label={duocDocDuLieu ? 'Trợ lý AI' : 'Tư vấn FunCafe'}
          className="fixed bottom-24 right-5 z-[60] w-[calc(100vw-2.5rem)] sm:w-96 max-h-[70vh] bg-white rounded-2xl border border-line shadow-pop flex flex-col overflow-hidden anim-pop origin-bottom-right"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line bg-bean text-white">
            <Sparkles className="w-5 h-5" />
            <div className="min-w-0">
              <p className="font-bold leading-tight">
                {duocDocDuLieu ? 'Trợ lý AI' : 'Tư vấn FunCafe'}
              </p>
              <p className="text-[11px] text-white/80">
                {duocDocDuLieu
                  ? 'Hỏi về quán, doanh thu, kinh doanh…'
                  : 'Hỏi về gói, tính năng, giá — trả lời ngay'}
              </p>
            </div>
          </div>

          {/* Chế độ tư vấn: nói rõ đang thiếu gì và mở đường nâng gói, thay vì khóa
              cứng không cho hỏi như trước. */}
          {!duocDocDuLieu && (
            <div className="flex items-start gap-2 px-3.5 py-2 bg-bean-tint/60 border-b border-line">
              <Lock className="w-3.5 h-3.5 text-bean shrink-0 mt-0.5" />
              <p className="text-[11px] leading-snug text-cafe-600">
                Muốn hỏi doanh thu và số liệu quán của mình?{' '}
                <Link
                  href={duongNangGoi}
                  onClick={() => setOpen(false)}
                  className="font-semibold text-bean underline underline-offset-2 transition-colors hover:text-bean-dark"
                >
                  {user ? 'Nâng lên Pro Max' : 'Dùng thử miễn phí 7 ngày'}
                </Link>
              </p>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2.5">
                <p className="text-sm text-cafe-500">
                  {duocDocDuLieu
                    ? 'Xin chào! Bạn có thể hỏi tôi, ví dụ:'
                    : 'Chào anh/chị! Mình tư vấn giúp chọn gói phù hợp. Ví dụ:'}
                </p>
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left text-sm bg-sand text-ink rounded-xl px-3 py-2 transition-all duration-200 hover:bg-bean-tint hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bean/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => {
              if (m.content === '') return null;
              const streaming = i === messages.length - 1 && loading && m.role === 'assistant';
              return (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-bean text-white rounded-br-sm' : 'bg-sand text-ink rounded-bl-sm'
                  }`}>
                    {m.role === 'assistant' ? renderBold(m.content) : m.content}
                    {streaming && <span className="inline-block w-[3px] h-4 ml-0.5 -mb-0.5 align-middle bg-bean/70 animate-pulse" />}
                  </div>
                </div>
              );
            })}
            {loading && messages[messages.length - 1]?.content === '' && (
              <div className="flex justify-start">
                <div className="bg-sand text-cafe-500 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang soạn trả lời…
                </div>
              </div>
            )}
          </div>

          <form onSubmit={e => { e.preventDefault(); send(input); }}
            className="border-t border-line p-2.5 flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Nhập câu hỏi…"
              // Khớp trần của máy chủ: tuyến tư vấn chặn ở 1000 ký tự, tuyến trong
              // portal 4000. Không khớp thì người dùng gõ xong mới ăn lỗi 422.
              maxLength={duocDocDuLieu ? 4000 : 1000}
              className="input-funcafe flex-1 !py-2 text-sm"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-bean text-white grid place-items-center shrink-0 transition-all duration-200 hover:bg-bean-dark hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bean/40">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
