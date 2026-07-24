export type UserPackageType = 'none' | 'free' | 'pro' | 'promax';

export type TableStatus = 'empty' | 'serving';
export type OrderStatus = 'active' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'qr_code' | 'e_wallet' | 'vietqr' | 'vnpay';
export type InvoiceStatus = 'paid' | 'refunded';
export type MenuItemStatus = 'available' | 'unavailable';
export type ToppingStatus = 'available' | 'unavailable';
export type PackageType = 'free' | 'pro' | 'promax';
export type DurationMonths = 1 | 3 | 12;
export type UserStatus = 'active' | 'locked';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'rejected';
export type ActionType = 'new' | 'renew' | 'upgrade';
// Nâng cấp gói giữa kỳ: phần còn lại của gói cũ được CẤN TRỪ thẳng vào giá gói mới.
// Không có luồng hoàn tiền mặt chờ duyệt -> chỉ 2 trạng thái.
export type CreditStatus = 'none' | 'applied';

export interface MenuItemSize {
  id: string;
  sizeId?: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  basePrice: number;
  categoryId: string;
  imageUrl?: string;
  description?: string;
  hasSize: boolean;
  sizes: MenuItemSize[];
  allowTopping: boolean;
  allowedToppingIds: string[];
  isAvailable: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface CafeTable {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string;
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
  itemId: string;
  itemNameSnapshot: string;
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

export interface Order {
  id: string;
  code: string;
  tableId: string;
  tableName: string;
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
  cafeId?: string;
  tableId?: string;
  orderCode: string;
  tableName: string;
  cafeName?: string;
  cafeAddress?: string;
  cafePhone?: string;
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
  // C4: hoàn tiền hóa đơn
  refundedAt?: string;
  refundReason?: string;
}

export interface CafeInfo {
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
  cafeId?: string;
  // Giới hạn & quyền lấy từ gói (Infinity = không giới hạn). Do admin cấu hình.
  maxTables?: number;
  maxMenuItems?: number;
  canUseAI?: boolean;
}

/** Một quán của người dùng, kèm gói đang chạy — dùng ở màn chi tiết người dùng (admin). */
export interface UserCafeSummary {
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
  cafeName?: string;
  hasUsedFreeTrial?: boolean;
  createdAt: string;
  // Chỉ có ở API quản trị (/admin/users)
  cafes?: UserCafeSummary[];
  cafeCount?: number;
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
  duration: number;
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

export interface Review {
  id: string;
  userId: string;
  userName?: string;
  cafeId: string;
  cafeName?: string;
  packageId?: string;
  packageName?: string;
  rating: number;
  title?: string;
  comment?: string;
  status: 'visible' | 'hidden';
  createdAt: string;
}

export interface PublicReview extends Review {
  cafeName: string;
  userName: string;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  subscription: UserSubscription;
}
