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
    creditStatus: raw.credit_status ?? 'none',
  };
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
