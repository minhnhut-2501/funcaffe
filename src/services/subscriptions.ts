/** Đăng ký gói của từng quán. */
import type { MyPayment } from '@/types';
import { api } from '@/lib/api-client';
import { getShopId } from './shop-id';
import { mapPackage } from './packages';
import { trangThaiCanTru } from './payments';

// Subscriptions — ĐA QUÁN: gói theo quán đang chọn (shops/{shopId}/subscriptions)
export const subscriptionService = {
  list: async () => {
    const shopId = await getShopId();
    const items = await api.get<any[]>(`/shops/${shopId}/subscriptions`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      packageId: raw.package_id,
      package: raw.package ? mapPackage(raw.package) : undefined,
      timeSubscriptionId: raw.time_subscription_id,
      packageNameSnapshot: raw.package_name_snapshot,
      startDate: raw.start_date,
      endDate: raw.end_date,
      // Chi tiết tiền (subtotal/VAT) và loại giao dịch nằm ở package_payments,
      // xem subscriptionService.payments(). Ở đây chỉ có tổng tiền của chu kỳ hiện hành.
      totalAmount: raw.total_amount,
      status: raw.status,
      isPendingReview: raw.is_pending_review ?? false,
      createdAt: raw.created_at,
    }));
  },
  active: async () => {
    const shopId = await getShopId();
    const raw = await api.get<any>(`/shops/${shopId}/subscriptions/active`);
    return raw ? {
      id: raw.id ?? raw._id,
      packageId: raw.package_id,
      package: raw.package ? mapPackage(raw.package) : undefined,
      timeSubscriptionId: raw.time_subscription_id,
      packageNameSnapshot: raw.package_name_snapshot,
      startDate: raw.start_date,
      endDate: raw.end_date,
      totalAmount: raw.total_amount,
      status: raw.status,
      isPendingReview: raw.is_pending_review ?? false,
      createdAt: raw.created_at,
    } : null;
  },
  /**
   * Xem trước số phải trả TRƯỚC khi tạo giao dịch.
   *
   * Phải hỏi máy chủ chứ không tự tính: phần cấn trừ khi nâng cấp giữa kỳ là tỉ lệ
   * theo giây giữa ngày bắt đầu và ngày hết hạn của gói cũ. Cài lại công thức đó ở
   * đây là tạo ra hai bản chắc chắn sẽ lệch nhau ở lần sửa sau — mà lệch nghĩa là
   * màn hình hứa một con số còn cổng thanh toán thu một con số khác.
   */
  preview: async (packageId: string, timeSubscriptionId?: string) => {
    const shopId = await getShopId();
    const q = new URLSearchParams({ package_id: packageId });
    if (timeSubscriptionId) q.set('time_subscription_id', timeSubscriptionId);
    const raw = await api.get<{
      action_type: 'new' | 'renew' | 'upgrade' | 'downgrade';
      subtotal: number; vat_rate: number; vat_amount: number;
      gross: number; credit: number; payable: number; needs_gateway: boolean;
    }>(`/shops/${shopId}/subscriptions/preview?${q.toString()}`);
    return {
      actionType: raw.action_type,
      subtotal: raw.subtotal,
      vatRate: raw.vat_rate,
      vatAmount: raw.vat_amount,
      gross: raw.gross,
      credit: raw.credit,
      payable: raw.payable,
      needsGateway: raw.needs_gateway,
    };
  },
  create: async (data: { package_id: string; time_subscription_id?: string; payment_method: string; note?: string }) => {
    const shopId = await getShopId();
    const raw = await api.post<any>(`/shops/${shopId}/subscriptions`, data);
    return raw;
  },
  // Lịch sử thanh toán gói của quán đang chọn
  payments: async (): Promise<MyPayment[]> => {
    const shopId = await getShopId();
    const items = await api.get<any[]>(`/shops/${shopId}/subscriptions/payments`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      transactionCode: raw.transaction_code ?? '',
      packageName: raw.package?.name ?? '',
      amount: raw.amount ?? 0,
      paymentMethod: raw.payment_method ?? '',
      status: (['paid', 'pending', 'failed', 'rejected'].includes(raw.payment_status) ? raw.payment_status : 'pending'),
      actionType: raw.action_type ?? undefined,
      createdAt: raw.created_at,
      paidAt: raw.paid_at ?? undefined,
      creditAmount: raw.credit_amount ?? 0,
      // Suy từ số tiền, không đọc cờ `credit_status` (máy chủ không còn ghi cờ đó —
      // xem chú thích ở `trangThaiCanTru` trong services/payments.ts).
      creditStatus: trangThaiCanTru(raw),
    } as MyPayment));
  },
};
