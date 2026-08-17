/** Đánh giá phần mềm FunCafe. */
import type { PublicReview, Review } from '@/types';
import { api } from '@/lib/api-client';
import { getCafeId } from './cafe-id';

// Reviews
export const reviewService = {
  // Gửi đánh giá FunCafe của chủ quán (backend upsert: gửi lại = cập nhật đánh giá cũ).
  // title và comment bắt buộc — khớp ràng buộc của ReviewController@store.
  create: async (data: {
    rating: number;
    title: string;
    comment: string;
  }) => {
    const cafeId = await getCafeId();
    return api.post(`/cafes/${cafeId}/reviews`, data);
  },
  adminList: async () => {
    const items = await api.get<any[]>('/admin/reviews');
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? '',
      userEmail: raw.user_email ?? undefined,
      cafeId: raw.cafe_id,
      cafeName: raw.cafe_name ?? raw.cafe?.name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? raw.package?.name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at ?? raw.created_at,
      // Đánh giá tạo trước khi có tính năng lưu lịch sử sẽ không có field này.
      history: (raw.history ?? []).map((h: any) => ({
        rating: h.rating,
        title: h.title ?? undefined,
        comment: h.comment ?? undefined,
        writtenAt: h.written_at ?? undefined,
        replacedAt: h.replaced_at ?? undefined,
      })),
    } as Review));
  },
  getPublicReviews: async () => {
    const items = await api.get<any[]>(`/reviews`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? raw.user?.full_name ?? '',
      avatarUrl: raw.avatar ?? undefined,
      cafeId: raw.cafe_id,
      cafeName: raw.cafe_name ?? raw.cafe?.name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? raw.package?.name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
    } as PublicReview));
  },
  /**
   * Đánh giá FunCafe của chính người đang đăng nhập — KHÔNG đi qua quán đang chọn.
   * Mỗi tài khoản chỉ có một đánh giá, nên hỏi theo quán thì đổi sang quán chưa
   * đánh giá sẽ tưởng là chưa từng viết. Trả về null khi chưa viết.
   */
  mine: async (): Promise<Review | null> => {
    const raw = await api.get<any>('/reviews/mine');
    if (!raw) return null;
    return {
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? '',
      cafeId: raw.cafe_id,
      cafeName: raw.cafe_name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at ?? raw.created_at,
      history: (raw.history ?? []).map((h: any) => ({
        rating: h.rating,
        title: h.title ?? undefined,
        comment: h.comment ?? undefined,
        writtenAt: h.written_at ?? undefined,
        replacedAt: h.replaced_at ?? undefined,
      })),
    } as Review;
  },
  listByCafe: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/reviews`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? raw.user?.full_name ?? '',
      cafeId: raw.cafe_id,
      cafeName: raw.cafe?.name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? raw.package?.name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
    } as Review));
  },
  toggleStatus: async (id: string) => {
    await api.put(`/admin/reviews/${id}/toggle`);
  },
};
