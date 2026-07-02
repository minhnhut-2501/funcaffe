'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api, type AuthUser, type AuthResponse, type SubscriptionData } from '@/lib/api-client';
import type { CurrentUser, UserSubscription } from '@/types';
import { defaultPackageLimits } from '@/lib/permission';

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<'user' | 'admin'>;
  register: (data: { fullName: string; email: string; phone: string; password: string }) => Promise<'user' | 'admin'>;
  logout: () => void;
  refreshUser?: () => Promise<void>;
}

function mapSubscription(subs: SubscriptionData[]): UserSubscription {
  const active = subs.find((s) => s.status === 'active');
  if (!active) {
    return { packageType: 'none', packageName: 'Chưa đăng ký', startDate: '', endDate: '', daysLeft: 0 };
  }
  const start = new Date(active.start_date);
  const end = new Date(active.end_date);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));

  // #4: Lấy khoản hoàn tiền của giao dịch nâng cấp gần nhất (nếu có)
  const upgradePayments = (active.package_payments ?? [])
    .filter((p) => p.action_type === 'upgrade' && (p.refund_amount ?? 0) > 0)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  const latestRefund = upgradePayments[0];

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
    refundAmount: latestRefund?.refund_amount,
    refundStatus: latestRefund?.refund_status as UserSubscription['refundStatus'],
    maxTables: !hasLimitFields ? fallback.maxTables : (pkg?.max_tables == null ? Infinity : pkg.max_tables),
    maxMenuItems: !hasLimitFields ? fallback.maxMenuItems : (pkg?.max_menu_items == null ? Infinity : pkg.max_menu_items),
    canUseAI: !hasLimitFields ? fallback.canUseAI : (pkg?.can_use_ai ?? false),
  };
}

function mapUser(u: AuthUser, subs: SubscriptionData[]): CurrentUser {
  return {
    id: u._id,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone || '',
    avatarUrl: u.avatar ?? undefined,
    role: u.role === 'admin' ? 'admin' : 'user',
    subscription: mapSubscription(subs),
  };
}

async function fetchSubscriptions(): Promise<SubscriptionData[]> {
  try {
    return await api.get<SubscriptionData[]>('/subscriptions');
  } catch {
    return [];
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.get<AuthUser>('/user')
      .then(async (u) => {
        const subs = await fetchSubscriptions();
        setUser(mapUser(u, subs));
      })
      .catch(() => {
        api.removeToken();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, remember = true): Promise<'user' | 'admin'> => {
    setIsLoading(true);
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      api.setToken(res.token, remember);
      const subs = await fetchSubscriptions();
      const user = mapUser(res.user, subs);
      setUser(user);
      return user.role;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      const subs = await fetchSubscriptions();
      const user = mapUser(res.user, subs);
      setUser(user);
      return user.role;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    api.removeToken();
    // BUG-15 FIX: Xóa cafeIdCache khi đăng xuất tránh dùng cache của user cũ
    const { clearCafeCache } = await import('@/services');
    clearCafeCache();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = api.getToken();
    if (!token) return;
    try {
      const u = await api.get<AuthUser>('/user');
      const subs = await fetchSubscriptions();
      setUser(mapUser(u, subs));
    } catch {
      api.removeToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: user !== null, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
