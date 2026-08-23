export type UserPackageType = 'none' | 'free' | 'pro' | 'promax';

export type TableStatus = 'empty' | 'serving';
export type OrderStatus = 'active' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'qr_code' | 'e_wallet' | 'vietqr' | 'vnpay' | 'momo';
/** Cổng online tự kích hoạt gói qua callback — khớp PackagePayment::ONLINE_GATEWAYS ở backend. */
export type OnlineGateway = 'vnpay' | 'momo';
export type InvoiceStatus = 'paid';
export type PackageType = 'free' | 'pro' | 'promax';
export type DurationMonths = 1 | 3 | 12;
export type UserStatus = 'active' | 'locked';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'rejected';
export type ActionType = 'new' | 'renew' | 'upgrade';
// Nâng cấp gói giữa kỳ: phần còn lại của gói cũ được CẤN TRỪ thẳng vào giá gói mới.
// Không có luồng hoàn tiền mặt chờ duyệt -> chỉ 2 trạng thái.
export type CreditStatus = 'none' | 'applied';

export interface ProductSize {
  id: string;
  sizeId?: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  basePrice: number;
  categoryId: string;
  imageUrl?: string;
  description?: string;
  hasSize: boolean;
  sizes: ProductSize[];
  hasTopping: boolean;
  allowedToppingIds: string[];
  isAvailable: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  /** Danh mục ẩn không hiện ở màn hình bán hàng. Luôn có giá trị — mapCategory
   *  điền `true` khi bản ghi cũ chưa có trường này. */
  isActive: boolean;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface ShopTable {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string;
  /**
   * Còn dùng hay đã ẩn. Bàn KHÔNG xóa được (hóa đơn cũ còn trỏ tới), chỉ ẩn —
   * giống danh mục, món, topping. Bàn ẩn không hiện ở màn Bán hàng.
   */
  isActive: boolean;
}

export interface OrderItemTopping {
  toppingId: string;
  toppingNameSnapshot: string;
  quantity: number;
  priceAtTime: number;
  subtotal: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  sizeId?: string;
  sizeNameSnapshot?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itemSubtotal?: number;
  toppingTotal?: number;
  totalPrice?: number;
  toppings: OrderItemTopping[];
  note?: string;
}

/** Bán tại quán (có bàn) hay mang về (không bàn). */
export type OrderType = 'dine_in' | 'takeaway';

export interface Order {
  id: string;
  code: string;
  /** Rỗng với đơn mang về — đơn đó không gắn bàn nào. */
  tableId: string;
  tableName: string;
  orderType: OrderType;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod?: PaymentMethod;
  note?: string;
  createdAt: string;
  paidAt?: string;
}

export interface Invoice {
  id: string;
  invoiceCode: string;
  orderId: string;
  orderType: OrderType;
  shopId?: string;
  tableId?: string;
  orderCode: string;
  tableName: string;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  createdAt: string;
  paidAt: string;
  cashReceived?: number;
  changeAmount?: number;
}

export interface ShopInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  description?: string;
  logoUrl?: string;
  status: 'open' | 'closed' | 'inactive';
  // Tài khoản ngân hàng nhận tiền (VietQR)
  bankBin?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  /**
   * Gói còn hiệu lực của CHÍNH quán này — chỉ có ở danh sách GET /shops.
   * Dùng để cảnh báo sắp hết hạn cho cả những quán người dùng không đang đứng.
   * undefined = endpoint không trả (không phải "chưa có gói"; 'none' mới là vậy).
   */
  packageType?: UserPackageType;
  packageName?: string;
  packageEndDate?: string;
}

export interface Package {
  id: string;
  name: string;
  type: PackageType;
  level: number;
  isTrial: boolean;
  description: string;
  isActive: boolean;
  features: string[];
  maxTables?: number | null;     // null = không giới hạn
  maxMenuItems?: number | null;  // null = không giới hạn
  maxStaff?: number | null;      // null = không giới hạn
  canUseAI?: boolean;
  vatRate?: number;              // % VAT áp khi mua gói (0 với gói trial)
}

export interface TimeSubscription {
  id: string;
  packageId: string;
  durationValue: number;
  durationUnit: 'day' | 'month';
  price: number;
  label: string;
  status: 'active' | 'inactive';
}

export interface UserSubscription {
  packageType: UserPackageType;
  packageName: string;
  startDate: string;
  endDate: string;
  daysLeft: number;
  isPendingReview?: boolean;
  // Khoản cấn trừ của lần nâng cấp gần nhất (nếu có)
  creditAmount?: number;
  creditStatus?: CreditStatus;
  // ĐA QUÁN: gói này thuộc quán nào (id). Undefined nếu chưa có gói.
  shopId?: string;
  // Giới hạn & quyền lấy từ gói (Infinity = không giới hạn). Do admin cấu hình.
  maxTables?: number;
  maxMenuItems?: number;
  maxStaff?: number;
  canUseAI?: boolean;
}

/** Một quán của người dùng, kèm gói đang chạy — dùng ở màn chi tiết người dùng (admin). */
export interface UserShopSummary {
  id: string;
  name: string;
  address: string;
  /** Quán không xóa được, chỉ đổi trạng thái. */
  status: 'open' | 'closed' | 'inactive';
  packageType: UserPackageType;
  packageName: string;
  packageEndDate?: string;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar?: string;
  status: UserStatus;
  packageType: UserPackageType;
  packageName: string;
  shopName?: string;
  hasUsedFreeTrial?: boolean;
  createdAt: string;
  /**
   * Vai trò. /admin/users chỉ trả về tài khoản chủ quán, nhưng giữ trường này để
   * giao diện còn tự nhận biết được thay vì đoán.
   */
  role?: 'user' | 'admin';
  // Chỉ có ở API quản trị (/admin/users)
  shops?: UserShopSummary[];
  shopCount?: number;
  /** Số quán đang có gói còn hạn. */
  activePackageCount?: number;
  /** Số giao dịch mua gói ĐÃ THANH TOÁN (không tính pending/failed). */
  paymentCount?: number;
  totalPaid?: number;
  lastPaymentAt?: string;
}

export interface Payment {
  id: string;
  transactionCode: string;
  userId: string;
  userName: string;
  userEmail: string;
  packageName: string;
  packageType: PackageType;
  /**
   * Thời hạn đã mua, lấy từ quan hệ time_subscription của giao dịch.
   * Phải đi theo CẶP giá trị + đơn vị: gói dùng thử tính bằng NGÀY, gói trả phí
   * tính bằng THÁNG. undefined = giao dịch cũ không gắn mốc thời hạn nào.
   */
  durationValue?: number;
  durationUnit?: 'day' | 'month';
  amount: number;
  status: PaymentStatus;
  createdAt: string;
  confirmedAt?: string;
  note?: string;
  actionType?: ActionType;
  // Cấn trừ phần thời gian còn lại của gói cũ khi nâng cấp
  creditAmount?: number;
  creditStatus?: CreditStatus;
}

// Lịch sử thanh toán gói của chính user (trang Gói dịch vụ)
export interface MyPayment {
  id: string;
  transactionCode: string;
  packageName: string;
  amount: number;
  paymentMethod: string;
  status: PaymentStatus;
  actionType?: ActionType;
  createdAt: string;
  paidAt?: string;
  creditAmount?: number;
  creditStatus?: CreditStatus;
}

/** Một bản đánh giá cũ đã bị chủ quán sửa đè lên. */
export interface ReviewVersion {
  rating: number;
  title?: string;
  comment?: string;
  /** Thời điểm bản này được viết. */
  writtenAt?: string;
  /** Thời điểm bản này bị thay bằng bản mới. */
  replacedAt?: string;
}

export interface Review {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  shopId: string;
  shopName?: string;
  packageId?: string;
  packageName?: string;
  rating: number;
  title?: string;
  comment?: string;
  status: 'visible' | 'hidden';
  createdAt: string;
  /** Lần sửa gần nhất; bằng createdAt nếu chưa từng sửa. */
  updatedAt?: string;
  /** Các bản cũ, mới nhất trước. Rỗng nghĩa là chưa sửa lần nào. */
  history?: ReviewVersion[];
}

export interface PublicReview extends Review {
  shopName: string;
  userName: string;
  /** Ảnh đại diện chủ quán tự tải lên; chỉ API công khai trả field này. */
  avatarUrl?: string;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  /**
   * 'user' = chủ quán · 'staff' = nhân viên (chỉ dùng màn Bán hàng) · 'admin'.
   * Nhân viên gắn với đúng MỘT quán, id nằm ở `shopId` bên dưới.
   */
  role: 'user' | 'admin' | 'staff';
  /** Chỉ nhân viên có: quán họ làm việc. Chủ quán và admin để trống. */
  shopId?: string;
  subscription: UserSubscription;
}
