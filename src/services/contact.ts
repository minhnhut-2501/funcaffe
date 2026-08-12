/** Tin nhắn liên hệ từ trang công khai. */
import { api } from '@/lib/api-client';

// Contact
export interface ContactMessage {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  cafeName?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  /** Nội dung admin đã trả lời qua email (nếu đã trả lời). */
  reply?: string;
  repliedAt?: string;
  repliedBy?: string;
}

export const contactService = {
  send: async (data: { full_name: string; email: string; phone?: string; cafe_name?: string; content: string }) => {
    return api.post<{ message: string }>('/contact', data);
  },
  /**
   * B6: admin đọc tin nhắn liên hệ từ trang public.
   * Backend phân trang; gom mọi trang lại (mỗi trang 200) để bảng bên admin vẫn tìm
   * kiếm và lọc tại chỗ như hiện tại, nhưng KHÔNG còn mất tin cũ như bản chặn cứng 200.
   */
  adminList: async (): Promise<ContactMessage[]> => {
    const first = await api.get<any>('/admin/contacts?per_page=200');
    if (Array.isArray(first)) return first.map(mapContact);

    const lastPage = first.last_page ?? 1;
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, lastPage - 1) }, (_, i) =>
        api.get<any>(`/admin/contacts?per_page=200&page=${i + 2}`)),
    );
    return [first, ...rest].flatMap((p) => (p.data ?? []).map(mapContact));
  },
  /**
   * Vài tin CHƯA ĐỌC gần nhất — cho chuông báo ở khung quản trị.
   *
   * Chỉ một trang nhỏ, và để MÁY CHỦ lọc chưa đọc. `adminList()` gom mọi trang, quá
   * đắt cho một thứ chạy ở mọi màn hình quản trị; còn lấy vài tin mới nhất rồi tự lọc
   * thì mười tin mới nhất đều đã đọc là chuông im, dù tin chưa đọc vẫn nằm bên dưới.
   */
  chuaDocGanDay: async (soLuong = 10): Promise<ContactMessage[]> => {
    const res = await api.get<any>(`/admin/contacts?is_read=0&per_page=${soLuong}`);
    const rows = Array.isArray(res) ? res : (res.data ?? []);
    return rows.map(mapContact);
  },
  /** Đặt trạng thái đã đọc. Truyền giá trị mong muốn, không đảo — xem ContactController. */
  setRead: async (id: string, isRead: boolean) => {
    return api.put(`/admin/contacts/${id}/read`, { is_read: isRead });
  },
  /** Gửi email trả lời cho khách và lưu lại nội dung đã trả lời. */
  reply: async (id: string, reply: string): Promise<ContactMessage> => {
    const raw = await api.post<any>(`/admin/contacts/${id}/reply`, { reply });
    return mapContact(raw);
  },
};

function mapContact(raw: any): ContactMessage {
  return {
    id: raw.id ?? raw._id,
    fullName: raw.full_name ?? '',
    email: raw.email ?? '',
    phone: raw.phone || undefined,
    cafeName: raw.cafe_name || undefined,
    content: raw.content ?? '',
    isRead: raw.is_read ?? false,
    createdAt: raw.created_at,
    reply: raw.reply || undefined,
    repliedAt: raw.replied_at || undefined,
    repliedBy: raw.replied_by || undefined,
  };
}
