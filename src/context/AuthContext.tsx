'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api, type AuthUser, type AuthResponse, type SubscriptionData } from '@/lib/api-client';
import type { CurrentUser, UserSubscription, CafeInfo } from '@/types';
import { defaultPackageLimits } from '@/lib/permission';
import { cafeService, setActiveCafeId, pickActiveCafeId, clearCafeCache } from '@/services';

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // ĐA QUÁN: danh sách quán + quán đang chọn
  cafes: CafeInfo[];
  activeCafeId: string | null;
  setActiveCafe: (id: string) => Promise<void>;
  reloadCafes: () => Promise<CafeInfo[]>;
  login: (email: string, password: string, remember?: boolean) => Promise<'user' | 'admin'>;
  register: (data: { fullName: string; email: string; phone: string; password: string }) => Promise<'user' | 'admin'>;
  logout: () => Promise<void>;
  refreshUser?: () => Promise<void>;
}

function mapSubscription(subs: SubscriptionData[]): UserSubscription {
  // Một quán có thể có NHIỀU subscription status 'active': không có tác vụ nào đổi
  // status sang 'expired' khi hết hạn (xem chú thích Subscription::scopeEffective),
  // nên gói cũ đã quá hạn vẫn nằm lại với status 'active'. Lấy phần tử ĐẦU TIÊN là
  // lấy nhầm gói cũ — quán vừa mua gói mới vẫn bị báo "đã hết hạn" và bị khóa thao tác.
  // Chọn gói có end_date MUỘN NHẤT: còn hạn thì luôn thắng gói đã hết, và khi mọi gói
  // đều hết thì lấy đúng gói hết gần đây nhất. Khớp cách CafeController@index chọn gói.
  const active = [...subs]
    .filter((s) => s.status === 'active')
    .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
  if (!active) {
    return { packageType: 'none', packageName: 'Chưa đăng ký', startDate: '', endDate: '', daysLeft: 0 };
  }
  const start = new Date(active.start_date);
  const end = new Date(active.end_date);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));

  // Lấy khoản cấn trừ của giao dịch nâng cấp gần nhất (nếu có)
  const upgradePayments = (active.package_payments ?? [])
    .filter((p) => p.action_type === 'upgrade' && (p.credit_amount ?? 0) > 0)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  const latestCredit = upgradePayments[0];

  const pkg = active.package;
  const packageType = (pkg?.type as UserSubscription['packageType']) || 'free';
  // Giới hạn/quyền lấy từ gói (do admin cấu hình). null/thiếu => không giới hạn.
  // Fallback theo loại gói khi document gói chưa có field (dữ liệu cũ).
  const fallback = defaultPackageLimits(packageType);
  const hasLimitFields = pkg != null && ('max_tables' in pkg || 'can_use_ai' in pkg);

  return {
    packageType,
    packageName: pkg?.name || 'Free',
    startDate: active.start_date,
    endDate: active.end_date,
    daysLeft,
    isPendingReview: active.is_pending_review ?? false,
    creditAmount: latestCredit?.credit_amount,
    creditStatus: latestCredit?.credit_status as UserSubscription['creditStatus'],
    cafeId: (active as any).cafe_id ? String((active as any).cafe_id) : undefined,
    maxTables: !hasLimitFields ? fallback.maxTables : (pkg?.max_tables == null ? Infinity : pkg.max_tables),
    maxMenuItems: !hasLimitFields ? fallback.maxMenuItems : (pkg?.max_menu_items == null ? Infinity : pkg.max_menu_items),
    canUseAI: !hasLimitFields ? fallback.canUseAI : (pkg?.can_use_ai ?? false),
  };
}

function mapUser(u: AuthUser, subs: SubscriptionData[]): CurrentUser {
  return {
    // `id ?? _id`: API trả `id`. Chỉ đọc `_id` thì user.id là undefined, và mọi
    // useEffect phụ thuộc user.id sẽ không bao giờ chạy lại khi user nạp xong.
    id: u.id ?? u._id ?? '',
    fullName: u.full_name,
    email: u.email,
    phone: u.phone || '',
    avatarUrl: u.avatar ?? undefined,
    role: u.role === 'admin' ? 'admin' : 'user',
    subscription: mapSubscription(subs),
  };
}

// Gói của MỘT quán cụ thể (theo quán đang chọn).
async function fetchSubscriptions(cafeId: string | null): Promise<SubscriptionData[]> {
  if (!cafeId) return [];
  try {
    return await api.get<SubscriptionData[]>(`/cafes/${cafeId}/subscriptions`);
  } catch {
    return [];
  }
}

// Tải danh sách quán + xác định quán đang chọn (admin không có quán -> bỏ qua).
async function loadCafes(role: 'user' | 'admin'): Promise<{ cafes: CafeInfo[]; activeCafeId: string | null }> {
  if (role === 'admin') return { cafes: [], activeCafeId: null };
  const cafes = await cafeService.list().catch(() => [] as CafeInfo[]);
  const activeCafeId = pickActiveCafeId(cafes.map((c) => c.id));
  return { cafes, activeCafeId };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [cafes, setCafes] = useState<CafeInfo[]>([]);
  const [activeCafeId, setActiveCafeIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Nạp toàn bộ trạng thái sau khi có AuthUser: quán + quán đang chọn + gói của quán đó.
  const hydrate = useCallback(async (u: AuthUser): Promise<CurrentUser> => {
    const role = u.role === 'admin' ? 'admin' : 'user';
    const { cafes, activeCafeId } = await loadCafes(role);
    const subs = await fetchSubscriptions(activeCafeId);
    setCafes(cafes);
    setActiveCafeIdState(activeCafeId);
    const mapped = mapUser(u, subs);
    setUser(mapped);
    return mapped;
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.get<AuthUser>('/user')
      .then((u) => hydrate(u))
      .catch(() => {
        api.removeToken();
      })
      .finally(() => setIsLoading(false));
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string, remember = true): Promise<'user' | 'admin'> => {
    setIsLoading(true);
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      api.setToken(res.token, remember);
      const mapped = await hydrate(res.user);
      return mapped.role;
    } finally {
      setIsLoading(false);
    }
  }, [hydrate]);

  const register = useCallback(async (data: { fullName: string; email: string; phone: string; password: string }): Promise<'user' | 'admin'> => {
    setIsLoading(true);
    try {
      const res = await api.post<AuthResponse>('/auth/register', {
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });
      api.setToken(res.token);
      const mapped = await hydrate(res.user);
      return mapped.role;
    } finally {
      setIsLoading(false);
    }
  }, [hydrate]);

  const logout = useCallback(async () => {
    // Gửi lệnh thu hồi token rồi DỌN TRẠNG THÁI NGAY, không chờ mạng: request()
    // đã đọc token ra trước lần await đầu tiên nên yêu cầu vẫn đi kèm đúng
    // token. Nhờ vậy nút Đăng xuất phản hồi tức thì kể cả khi backend chậm.
    const revoked = api.post('/auth/logout').catch(() => {});
    api.removeToken();
    // BUG-15 FIX: Xóa quán đang chọn khi đăng xuất tránh dùng của user cũ
    clearCafeCache();
    setUser(null);
    setCafes([]);
    setActiveCafeIdState(null);
    await revoked;
  }, []);

  const refreshUser = useCallback(async () => {
    const token = api.getToken();
    if (!token) return;
    try {
      const u = await api.get<AuthUser>('/user');
      await hydrate(u);
    } catch {
      api.removeToken();
      setUser(null);
      setCafes([]);
      setActiveCafeIdState(null);
    }
  }, [hydrate]);

  // Chuyển quán đang chọn: đổi id trong services + nạp lại gói của quán mới.
  const setActiveCafe = useCallback(async (id: string) => {
    setActiveCafeId(id);
    setActiveCafeIdState(id);
    const subs = await fetchSubscriptions(id);
    setUser((prev) => (prev ? { ...prev, subscription: mapSubscription(subs) } : prev));
  }, []);

  // Nạp lại danh sách quán (sau khi tạo quán mới), giữ quán đang chọn hợp lệ.
  const reloadCafes = useCallback(async (): Promise<CafeInfo[]> => {
    const list = await cafeService.list().catch(() => [] as CafeInfo[]);
    setCafes(list);
    const active = pickActiveCafeId(list.map((c) => c.id));
    setActiveCafeIdState(active);
    return list;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: user !== null,
      cafes, activeCafeId, setActiveCafe, reloadCafes,
      login, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
