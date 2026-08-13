/** Giao dịch mua gói. */
import type { Payment } from '@/types';
import { api } from '@/lib/api-client';

function mapPayment(raw: any): Payment {
  const sub = raw.subscription ?? {};
  const pkg = sub.package ?? raw.package ?? {};
  // Người trả tiền nằm trên chính giao dịch; subscription không giữ user nữa.
  const usr = raw.user ?? sub.user ?? {};
  const rawStatus = raw.payment_status ?? 'pending';
  const status: Payment['status'] = ['paid', 'pending', 'failed', 'rejected'].includes(rawStatus)
    ? rawStatus as Payment['status']
    : 'pending';
  return {
    id: raw.id ?? raw._id,
    transactionCode: raw.transaction_code ?? '',
    userId: raw.user_id ?? sub.user_id ?? '',
    userName: usr.full_name ?? '',
    userEmail: usr.email ?? '',
    packageName: pkg.name ?? '',
    packageType: (pkg.type as Payment['packageType']) ?? 'free',
    // Thời hạn nằm ở quan hệ time_subscription. KHÔNG có trường `duration_months`
    // nào ở backend — trước đây đọc nó nên mọi giao dịch đều hiện "1 tháng".
    durationValue: raw.time_subscription?.duration_value ?? undefined,
    durationUnit: raw.time_subscription?.duration_unit ?? undefined,
    amount: raw.amount ?? 0,
    status,
    createdAt: raw.created_at,
    confirmedAt: raw.paid_at ?? undefined,
    note: raw.note ?? undefined,
    actionType: raw.action_type ?? undefined,
    creditAmount: raw.credit_amount ?? 0,
    creditStatus: trangThaiCanTru(raw),
  };
}

/**
 * Có khoản cấn trừ hay không — SUY TỪ SỐ TIỀN, không đọc cờ `credit_status`.
 *
 * Máy chủ KHÔNG còn ghi `credit_status`: cờ đó thuộc thời còn khâu admin duyệt hoàn
 * tiền, đã gỡ ngày 22/07/2026, và không bản ghi nào trong CSDL còn mang nó. Nhưng
 * giao diện vẫn đọc, và vì `raw.credit_status ?? 'none'` luôn ra `'none'` nên mọi
 * phép kiểm dạng `creditStatus === 'applied'` đều SAI VĨNH VIỄN.
 *
 * Hậu quả im lặng: khách nâng cấp giữa kỳ được cấn trừ tiền thật, số tiền đó có ghi
 * trong `credit_amount`, nhưng KHÔNG hiện ra ở đâu cả — không ở lịch sử giao dịch của
 * khách, không ở màn hình đối soát của quản trị. Khách trả ít hơn mà không biết vì sao.
 *
 * Nguồn sự thật duy nhất còn lại là chính số tiền: có cấn trừ nghĩa là `credit_amount`
 * lớn hơn 0. Vẫn tôn trọng cờ cũ nếu bản ghi lịch sử nào còn mang nó.
 */
export function trangThaiCanTru(raw: any): 'none' | 'applied' {
  if (raw?.credit_status === 'applied' || raw?.credit_status === 'none') return raw.credit_status;
  return Number(raw?.credit_amount ?? 0) > 0 ? 'applied' : 'none';
}

// Payments (admin)
export const paymentService = {
  list: async () => {
    const items = await api.get<any[]>('/admin/payments');
    return items.map(mapPayment);
  },
  // Chỉ đọc: số tiền là bản ghi tài chính từ cổng thanh toán, admin không sửa;
  // hoàn tiền khi nâng cấp giữa kỳ được cấn trừ tự động, không có duyệt tay.
};
