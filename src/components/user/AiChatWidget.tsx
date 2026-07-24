'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, X, Send, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canUseAI } from '@/lib/permission';
import { aiService } from '@/services';
import { ApiError } from '@/lib/api-client';

interface ChatMsg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Quán tôi có bao nhiêu bàn?',
  'Doanh thu hôm nay bao nhiêu?',
  'Gợi ý combo cho buổi chiều ế khách',
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
  const allowed = canUseAI(user?.subscription);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const base: ChatMsg[] = [...messages, { role: 'user', content }];
    // Thêm bong bóng trả lời rỗng để chữ chảy dần vào (hiệu ứng gõ chữ)
    setMessages([...base, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    try {
      await aiService.chatStream(base.slice(-20), (chunk) => {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { role: 'assistant', content: last.content + chunk };
          return copy;
        });
      });
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

  return (
    <>
      {/* Nút nổi */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-bean text-white shadow-pop grid place-items-center hover:bg-bean-dark transition-colors"
        aria-label="Trợ lý AI"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[60] w-[calc(100vw-2.5rem)] sm:w-96 max-h-[70vh] bg-white rounded-2xl border border-line shadow-pop flex flex-col overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line bg-bean text-white">
            <Sparkles className="w-5 h-5" />
            <div className="min-w-0">
              <p className="font-bold leading-tight">Trợ lý AI</p>
              <p className="text-[11px] text-white/80">Hỏi về quán, doanh thu, kinh doanh…</p>
            </div>
          </div>

          {!allowed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
              <div className="w-12 h-12 rounded-full bg-bean-tint grid place-items-center">
                <Lock className="w-6 h-6 text-bean" />
              </div>
              <p className="font-semibold text-ink">Tính năng của gói Pro Max</p>
              <p className="text-sm text-cafe-500">Nâng cấp lên Pro Max để trò chuyện với trợ lý AI và phân tích doanh thu tự động.</p>
              <Link href="/user/subscription" onClick={() => setOpen(false)} className="btn-primary text-sm mt-1">
                Nâng cấp Pro Max
              </Link>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-2.5">
                    <p className="text-sm text-cafe-500">Xin chào! Bạn có thể hỏi tôi, ví dụ:</p>
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => send(s)}
                        className="block w-full text-left text-sm bg-sand hover:bg-bean-tint text-ink rounded-xl px-3 py-2 transition-colors">
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
                  className="input-funcafe flex-1 !py-2 text-sm"
                  disabled={loading}
                />
                <button type="submit" disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-bean text-white grid place-items-center shrink-0 hover:bg-bean-dark disabled:opacity-40 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
