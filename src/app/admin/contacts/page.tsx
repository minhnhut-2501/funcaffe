'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination, { usePagination } from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import { contactService, type ContactMessage } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, MailOpen, Mail, Eye, Send, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge, { type Tone } from '@/components/user/StatusBadge';

type Stage = 'unread' | 'read' | 'replied';

/**
 * Khớp đúng ràng buộc của Admin\ContactController@reply. Để frontend không biết hai
 * con số này thì người viết chỉ phát hiện ra giới hạn khi bị máy chủ từ chối — sau
 * khi đã gõ xong cả đoạn.
 */
const TRA_LOI_TOI_THIEU = 10;
const TRA_LOI_TOI_DA = 5000;

const stageOf = (m: ContactMessage): Stage => (m.reply ? 'replied' : m.isRead ? 'read' : 'unread');
const stageLabel: Record<Stage, string> = { unread: 'Chưa đọc', read: 'Đã đọc', replied: 'Đã trả lời' };
const stageTone: Record<Stage, Tone> = { unread: 'warning', read: 'neutral', replied: 'success' };

export default function AdminContactsPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [search, setSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [detail, setDetail] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    contactService.adminList()
      .then(setMessages)
      .catch(() => { setError(true); toast({ description: 'Không thể tải tin nhắn liên hệ', variant: 'destructive' }); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleRead = async (m: ContactMessage) => {
    // Gửi trạng thái MONG MUỐN thay vì bảo máy chủ "đảo": bấm hai lần do mạng chậm
    // sẽ ra cùng một kết quả thay vì quay về chỗ cũ.
    const next = !m.isRead;
    try {
      await contactService.setRead(m.id, next);
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, isRead: next } : x));
      toast({ description: next ? 'Đã đánh dấu đã đọc' : 'Đã đánh dấu CHƯA đọc' });
    } catch {
      toast({ description: 'Thao tác thất bại', variant: 'destructive' });
    }
  };

  // Mở chi tiết là đã đọc rồi — không bắt admin bấm thêm một nút nữa.
  const openDetail = (m: ContactMessage) => {
    setDetail(m);
    setReplyText('');
    if (!m.isRead) {
      contactService.setRead(m.id, true)
        .then(() => setMessages(prev => prev.map(x => x.id === m.id ? { ...x, isRead: true } : x)))
        .catch(() => {});
    }
  };

  const doDaiTraLoi = replyText.trim().length;
  const traLoiHopLe = doDaiTraLoi >= TRA_LOI_TOI_THIEU && doDaiTraLoi <= TRA_LOI_TOI_DA;

  const handleSendReply = async () => {
    if (!detail || !traLoiHopLe) return;
    setSending(true);
    try {
      const updated = await contactService.reply(detail.id, replyText.trim());
      setMessages(prev => prev.map(x => x.id === updated.id ? updated : x));
      setDetail(updated);
      setReplyText('');
      toast({ description: `Đã gửi email trả lời tới ${updated.email}` });
    } catch (e) {
      // Backend gửi mail TRƯỚC khi ghi CSDL: lỗi ở đây nghĩa là email chưa gửi đi,
      // tin nhắn vẫn ở trạng thái chưa trả lời để admin bấm gửi lại.
      const msg = e instanceof Error ? e.message : '';
      toast({
        description: msg || 'Gửi email thất bại. Kiểm tra cấu hình SMTP rồi thử lại.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const q = search.toLowerCase();
  const filtered = messages.filter(m =>
    (!onlyUnread || !m.isRead) &&
    (m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.cafeName?.toLowerCase().includes(q) ?? false) ||
      m.content.toLowerCase().includes(q))
  );

  // Cắt trang SAU khi đã lọc và tìm kiếm.
  const paging = usePagination(filtered, undefined, [search]);

  const unreadCount = messages.filter(m => !m.isRead).length;
  const repliedCount = messages.filter(m => m.reply).length;

  return (
    <div>
      <PageHeader
        title="Tin nhắn liên hệ"
        description={`${messages.length} tin nhắn · ${unreadCount} chưa đọc · ${repliedCount} đã trả lời`}
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên, email, quán hoặc nội dung..." />
        <button onClick={() => setOnlyUnread(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors shrink-0 ${onlyUnread ? 'bg-bean text-white' : 'bg-sand text-slate hover:bg-bean-tint hover:text-bean'}`}>
          Chưa đọc ({unreadCount})
        </button>
      </FilterBar>

      {loading && <LoadingSkeleton variant="table" rows={8} cols={5} />}
      {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải tin nhắn liên hệ.</span></div>}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState title="Không có tin nhắn nào" description="Khi khách gửi form Liên hệ trên trang public, tin nhắn sẽ hiển thị ở đây." />
      )}

      {!loading && !error && filtered.length > 0 && (<>
        <div className="bg-white rounded-2xl border border-line overflow-x-auto shadow-soft">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-sand border-b border-line">
              <tr>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Người gửi</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Liên hệ</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Quán</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Nội dung</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Trạng thái</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Thời gian</th>
                <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody className="stagger divide-y divide-line/70">
              {paging.pageRows.map(m => {
                const stage = stageOf(m);
                return (
                  <tr key={m.id} className={`hover:bg-sand/50 transition-colors ${!m.isRead ? 'bg-bean-tint/30' : ''}`}>
                    <td className={`px-4 py-3 ${!m.isRead ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>{m.fullName}</td>
                    <td className="px-4 py-3 text-cafe-600">
                      <span className="block">{m.email}</span>
                      {m.phone && <span className="text-xs text-cafe-400">{m.phone}</span>}
                    </td>
                    <td className="px-4 py-3 text-cafe-600">{m.cafeName ?? '—'}</td>
                    <td className="px-4 py-3 text-cafe-600 max-w-md">
                      <p className="line-clamp-2 whitespace-pre-wrap">{m.content}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={stageTone[stage]}>{stageLabel[stage]}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-cafe-400 text-xs">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openDetail(m)}
                          title="Xem chi tiết và trả lời"
                          className="p-2 rounded-lg text-cafe-500 hover:text-bean hover:bg-sand transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleRead(m)}
                          title={m.isRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                          className={`p-2 rounded-lg transition-colors ${m.isRead ? 'text-cafe-400 hover:text-bean hover:bg-sand' : 'text-bean hover:text-pine hover:bg-pine/12'}`}
                        >
                          {m.isRead ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={paging.page} lastPage={paging.lastPage} total={paging.total}
          onChange={paging.setPage} unit="tin nhắn" />
      </>)}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Chi tiết tin nhắn"
        size="lg"
        footer={detail && (
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <button onClick={() => setDetail(null)} className="btn-secondary">Đóng</button>
            <button
              onClick={handleSendReply}
              disabled={sending || !traLoiHopLe}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Đang gửi...' : 'Gửi trả lời'}
            </button>
          </div>
        )}
      >
        {detail && (
          <div className="space-y-5">
            {/* Nhãn nằm TRÊN giá trị: để cạnh nhau thì tên và email dài bị ngắt dòng giữa chừng */}
            <dl className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Người gửi', value: detail.fullName },
                { label: 'Email', value: detail.email },
                { label: 'Điện thoại', value: detail.phone ?? '—' },
                { label: 'Tên quán', value: detail.cafeName ?? '—' },
                { label: 'Thời gian gửi', value: formatDateTime(detail.createdAt) },
              ].map(r => (
                <div key={r.label} className="min-w-0">
                  <dt className="text-xs text-cafe-500 mb-0.5">{r.label}</dt>
                  <dd className="text-ink font-medium break-words">{r.value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="label-funcafe">Nội dung khách gửi</p>
              <div className="rounded-xl border border-line bg-sand/60 p-4 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {detail.content}
              </div>
            </div>

            {detail.reply && (
              <div className="rounded-xl border border-pine/25 bg-pine/8 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-pine mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Đã trả lời{detail.repliedAt ? ` lúc ${formatDateTime(detail.repliedAt)}` : ''}
                  {detail.repliedBy ? ` · ${detail.repliedBy}` : ''}
                </p>
                <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{detail.reply}</p>
              </div>
            )}

            <div>
              <label htmlFor="contact-reply" className="label-funcafe">
                {detail.reply ? 'Gửi thêm một trả lời khác' : 'Nội dung trả lời'}
              </label>
              <textarea
                id="contact-reply"
                rows={9}
                maxLength={TRA_LOI_TOI_DA}
                className="input-funcafe resize-y"
                placeholder="Nội dung này sẽ được gửi tới email của khách, kèm trích lại tin nhắn gốc..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
              />
              {/* Bộ đếm và lời nhắc còn thiếu bao nhiêu ký tự nằm cùng một dòng: trước
                  đây nút "Gửi trả lời" cứ mờ đi mà không nói vì sao, người viết chỉ
                  đoán được sau khi gõ thêm vài chữ thấy nó sáng lên. */}
              <div className="flex items-baseline justify-between gap-3 mt-1.5">
                <p className="text-xs text-cafe-500">
                  Gửi tới <span className="font-medium text-ink">{detail.email}</span>. Khách bấm Trả lời trong hộp thư
                  sẽ về hòm mail của FunCafe.
                </p>
                <p className={`text-xs shrink-0 tabular-nums ${doDaiTraLoi > TRA_LOI_TOI_DA * 0.9 ? 'text-gold' : 'text-cafe-500'}`}>
                  {doDaiTraLoi < TRA_LOI_TOI_THIEU
                    ? `Cần thêm ${TRA_LOI_TOI_THIEU - doDaiTraLoi} ký tự`
                    : `${doDaiTraLoi.toLocaleString('vi-VN')} / ${TRA_LOI_TOI_DA.toLocaleString('vi-VN')}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
