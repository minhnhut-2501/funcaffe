/** Đăng ký gói của từng quán. */
import type { MyPayment } from '@/types';
import { api } from '@/lib/api-client';
import { getCafeId } from './cafe-id';
import { mapPackage } from './packages';

// Subscriptions — ĐA QUÁN: gói theo quán đang chọn (cafes/{cafeId}/subscriptions)
export const subscriptionService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/subscriptions`);
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
    const cafeId = await getCafeId();
    const raw = await api.get<any>(`/cafes/${cafeId}/subscriptions/active`);
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
  create: async (data: { package_id: string; time_subscription_id?: string; payment_method: string; note?: string }) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/subscriptions`, data);
    return raw;
  },
  // Lịch sử thanh toán gói của quán đang chọn
  payments: async (): Promise<MyPayment[]> => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/subscriptions/payments`);
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
      creditStatus: raw.credit_status ?? 'none',
    } as MyPayment));
  },
};
