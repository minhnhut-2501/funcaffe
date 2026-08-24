'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api, type AuthUser, type AuthResponse, type SubscriptionData } from '@/lib/api-client';
import type { CurrentUser, UserSubscription, ShopInfo } from '@/types';
import { defaultPackageLimits, daysLeftUntil } from '@/lib/permission';
import { shopService, setActiveShopId, pickActiveShopId, clearShopCache, peekActiveShopId } from '@/services';

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // ĐA QUÁN: danh sách quán + quán đang chọn
  shops: ShopInfo[];
  /**
   * `true` khi lượt gọi /shops THẤT BẠI (mạng, máy chủ) — khác hẳn "chủ quán chưa
   * có quán nào". Không phân biệt hai trạng thái này thì một lần mạng chập cũng
   * đẩy chủ quán đang có 2 quán sang màn hình "tạo quán đầu tiên".
   */
  shopsError: boolean;
  activeShopId: string | null;
  setActiveShop: (id: string) => Promise<void>;
  reloadShops: () => Promise<ShopInfo[]>;
  login: (email: string, password: string, remember?: boolean) => Promise<CurrentUser['role']>;
  register: (data: { fullName: string; email: string; phone: string; password: string }) => Promise<CurrentUser['role']>;
  logout: () => Promise<void>;
  refreshUser?: () => Promise<void>;
}

function mapSubscription(subs: SubscriptionData[]): UserSubscription {
  // Một quán có thể có NHIỀU subscription status 'active': không có tác vụ nào đổi
  // status sang 'expired' khi hết hạn (xem chú thích Subscription::scopeEffective),
  // nên gói cũ đã quá hạn vẫn nằm lại với status 'active'. Lấy phần tử ĐẦU TIÊN là
  // lấy nhầm gói cũ — quán vừa mua gói mới vẫn bị báo "đã hết hạn" và bị khóa thao tác.
  // Chọn gói có end_date MUỘN NHẤT: còn hạn thì luôn thắng gói đã hết, và khi mọi gói
  // đều hết thì lấy đúng gói hết gần đây nhất. Khớp cách ShopController@index chọn gói.
  const active = [...subs]
    .filter((s) => s.status === 'active')
    .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
  if (!active) {
    return { packageType: 'none', packageName: 'Chưa đăng ký', startDate: '', endDate: '', daysLeft: 0 };
  }
  const end = new Date(active.end_date);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));

  // Lấy khoản cấn trừ của giao dịch nâng cấp gần nhất (nếu có)
  const upgradePayments = (active.package_payments ?? [])
    .filter((p) => p.action_type === 'upgrade' && (p.credit_amount ?? 0) > 0)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  const latestCredit = upgradePayments[0];

  const pkg = active.package;
  // Không đọc được loại gói -> 'none', KHÔNG phải 'free'. Fun Free là bản dùng thử
  // Pro Max nên trong PACKAGE_LIMITS nó có bàn/món không giới hạn và bật cả AI —
  // lấy nó làm giá trị dự phòng nghĩa là dữ liệu hỏng (subscription trỏ tới
  // package_id không còn tồn tại) sẽ MỞ KHÓA TỐI ĐA thay vì khóa bớt.
  const packageType = (pkg?.type as UserSubscription['packageType']) || 'none';
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
    // Suy từ số tiền chứ không đọc cờ `credit_status`: máy chủ không còn ghi cờ đó,
    // nên đọc thẳng thì lời nhắc "đã cấn trừ X đồng" không bao giờ hiện ra cho khách
    // (xem `trangThaiCanTru` trong services/payments.ts).
    creditStatus: (latestCredit?.credit_amount ?? 0) > 0 ? 'applied' : 'none',
    shopId: (active as any).shop_id ? String((active as any).shop_id) : undefined,
    maxTables: !hasLimitFields ? fallback.maxTables : (pkg?.max_tables == null ? Infinity : pkg.max_tables),
    maxMenuItems: !hasLimitFields ? fallback.maxMenuItems : (pkg?.max_menu_items == null ? Infinity : pkg.max_menu_items),
    canUseAI: !hasLimitFields ? fallback.canUseAI : (pkg?.can_use_ai ?? false),
  };
}

function mapUser(u: AuthUser, subscription: UserSubscription): CurrentUser {
  return {
    // `id ?? _id`: API trả `id`. Chỉ đọc `_id` thì user.id là undefined, và mọi
    // useEffect phụ thuộc user.id sẽ không bao giờ chạy lại khi user nạp xong.
    id: u.id ?? u._id ?? '',
    fullName: u.full_name,
    email: u.email,
    phone: u.phone || '',
    avatarUrl: u.avatar ?? undefined,
    // Đọc vai trò theo DANH SÁCH TRẮNG, không phải "khác admin thì là user": vai trò
    // lạ (dữ liệu hỏng, backend mới thêm giá trị) phải rơi về `user`... KHÔNG — phải
    // rơi về vai trò HẸP NHẤT. Nhưng ở đây hẹp nhất là 'staff', mà gán nhầm ai đó
    // thành nhân viên thì họ mất quyền vào chính quán mình. Nên giữ 'user' làm mặc
    // định và để backend quyết định thật — mọi chốt chặn đều nằm ở đó.
    role: u.role === 'admin' ? 'admin' : u.role === 'staff' ? 'staff' : 'user',
    shopId: u.shop_id ? String(u.shop_id) : undefined,
    subscription,
  };
}

/**
 * Gói của MỘT quán cụ thể (theo quán đang chọn).
 *
 * Ném lỗi thay vì trả mảng rỗng. Mảng rỗng có nghĩa xác định là "quán chưa mua gói
 * nào", và nếu dùng nó cho cả trường hợp gọi API hỏng thì một nhịp mạng chập sẽ
 * khoá toàn bộ thao tác của một quán đang có gói: `packageType` thành 'none' ->
 * `canManage()` false -> mọi nút thêm/sửa/bán hàng bị khoá kèm lời mời mua gói,
 * mà không có thông báo lỗi nào. Backend trên gói miễn phí hay ngủ đông nên nhịp
 * chập này xảy ra thường xuyên chứ không hiếm.
 *
 * Nơi gọi chịu trách nhiệm xử lý lỗi (xem `subscriptionOf` bên dưới).
 */
async function fetchSubscriptions(shopId: string | null, laNhanVien = false): Promise<SubscriptionData[]> {
  if (!shopId) return [];
  // NHÂN VIÊN không gọi endpoint này: máy chủ trả 403 (gói là chuyện của chủ quán),
  // nên mỗi lần mở trang lại đẻ ra một dòng đỏ trong console và một lượt gọi vứt đi.
  // Ném lỗi ở đây để nơi gọi rơi vào đúng nhánh dự phòng vốn đã có — dựng gói lại từ
  // dữ liệu `GET /shops`, thứ mà nhân viên đọc được bình thường.
  if (laNhanVien) throw new Error('STAFF_NO_SUBSCRIPTION_ACCESS');

  return api.get<SubscriptionData[]>(`/shops/${shopId}/subscriptions`);
}

/**
 * Gói của quán đang chọn, có đường lui khi API gói không gọi được.
 *
 * `GET /shops` đã đính kèm `packageType` / `packageName` / `packageEndDate` cho từng
 * quán, nên khi endpoint chi tiết hỏng ta vẫn dựng lại được gói từ dữ liệu đó —
 * giới hạn số bàn/món và quyền AI rơi về mặc định theo loại gói. Chủ quán tiếp tục
 * bán hàng bình thường thay vì bị báo "chưa đăng ký gói".
 */
async function subscriptionOf(shopId: string | null, shops: ShopInfo[], laNhanVien = false): Promise<UserSubscription> {
  try {
    return mapSubscription(await fetchSubscriptions(shopId, laNhanVien));
  } catch {
    const shop = shops.find((c) => c.id === shopId);
    if (!shop?.packageType || shop.packageType === 'none') {
      // Không có gì để lui về: giữ nguyên 'none' như trước.
      return mapSubscription([]);
    }
    const limits = defaultPackageLimits(shop.packageType);
    return {
      packageType: shop.packageType,
      packageName: shop.packageName || 'Gói hiện tại',
      startDate: '',
      endDate: shop.packageEndDate ?? '',
      daysLeft: shop.packageEndDate ? daysLeftUntil(shop.packageEndDate) : 0,
      shopId: shop.id,
      maxTables: limits.maxTables,
      maxMenuItems: limits.maxMenuItems,
      canUseAI: limits.canUseAI,
    };
  }
}

// Tải danh sách quán + xác định quán đang chọn (admin không có quán -> bỏ qua).
async function loadShops(role: CurrentUser['role']): Promise<{ shops: ShopInfo[]; activeShopId: string | null; failed: boolean }> {
  // Admin không có quán nào. Nhân viên CÓ đúng một quán và `/shops` chỉ trả về nó,
  // nên vẫn gọi bình thường — chỉ khác là họ không có gì để chọn.
  if (role === 'admin') return { shops: [], activeShopId: null, failed: false };
  let failed = false;
  const shops = await shopService.list().catch(() => { failed = true; return [] as ShopInfo[]; });
  const activeShopId = pickActiveShopId(shops.map((c) => c.id));
  return { shops, activeShopId, failed };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [activeShopId, setActiveShopIdState] = useState<string | null>(null);
  const [shopsError, setShopsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Nạp toàn bộ trạng thái sau khi có AuthUser: quán + quán đang chọn + gói của quán đó.
   *
   * Hai request phụ chạy SONG SONG chứ không nối đuôi. Trước đây là chuỗi ba lượt
   * mạng chờ nhau (`/user` -> `/shops` -> `/shops/{id}/subscriptions`) trước khi giao
   * diện dùng được — trên backend đang ngủ đông của gói miễn phí thì đó là vài giây
   * màn hình trắng.
   *
   * Mẹo ở đây: quán đang chọn hầu như luôn biết trước từ lựa chọn đã lưu, nên hỏi gói
   * được ngay mà không cần đợi `/shops`. Phỏng đoán đó vẫn phải kiểm lại: đổi tài
   * khoản thì quán đã lưu không còn thuộc người dùng này nữa, khi đó bỏ kết quả đoán
   * và hỏi lại đúng quán.
   */
  const hydrate = useCallback(async (u: AuthUser): Promise<CurrentUser> => {
    const role: CurrentUser['role'] = u.role === 'admin' ? 'admin' : u.role === 'staff' ? 'staff' : 'user';
    const guessedShopId = role === 'admin' ? null : peekActiveShopId();

    const laNhanVien = role === 'staff';
    const [{ shops, activeShopId, failed }, guessedSubs] = await Promise.all([
      loadShops(role),
      guessedShopId && !laNhanVien
        ? fetchSubscriptions(guessedShopId).catch(() => null)
        : Promise.resolve(null),
    ]);

    const subscription = guessedShopId === activeShopId && guessedSubs !== null
      ? mapSubscription(guessedSubs)
      : await subscriptionOf(activeShopId, shops, laNhanVien);

    setShops(shops);
    setShopsError(failed);
    setActiveShopIdState(activeShopId);
    const mapped = mapUser(u, subscription);
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

  const login = useCallback(async (email: string, password: string, remember = true): Promise<CurrentUser['role']> => {
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

  const register = useCallback(async (data: { fullName: string; email: string; phone: string; password: string }): Promise<CurrentUser['role']> => {
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
    clearShopCache();
    setUser(null);
    setShops([]);
    setActiveShopIdState(null);
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
      setShops([]);
      setActiveShopIdState(null);
    }
  }, [hydrate]);

  // Chuyển quán đang chọn: đổi id trong services + nạp lại gói của quán mới.
  const setActiveShop = useCallback(async (id: string) => {
    setActiveShopId(id);
    setActiveShopIdState(id);
    const subscription = await subscriptionOf(id, shops);
    setUser((prev) => (prev ? { ...prev, subscription } : prev));
  }, [shops]);

  // Nạp lại danh sách quán (sau khi tạo quán mới), giữ quán đang chọn hợp lệ.
  const reloadShops = useCallback(async (): Promise<ShopInfo[]> => {
    let failed = false;
    const list = await shopService.list().catch(() => { failed = true; return [] as ShopInfo[]; });
    setShops(list);
    setShopsError(failed);
    const active = pickActiveShopId(list.map((c) => c.id));
    setActiveShopIdState(active);
    return list;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: user !== null,
      shops, shopsError, activeShopId, setActiveShop, reloadShops,
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
