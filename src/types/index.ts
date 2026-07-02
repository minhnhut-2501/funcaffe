export type UserPackageType = 'none' | 'free' | 'pro' | 'promax';

export type TableStatus = 'empty' | 'serving' | 'reserved' | 'cleaning';
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
// #4: Trạng thái hoàn tiền khi nâng cấp gói
export type RefundStatus = 'none' | 'pending' | 'approved' | 'rejected';

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
  // #4: Khoản hoàn tiền của lần nâng cấp gần nhất (nếu có)
  refundAmount?: number;
  refundStatus?: RefundStatus;
  // Giới hạn & quyền lấy từ gói (Infinity = không giới hạn). Do admin cấu hình.
  maxTables?: number;
  maxMenuItems?: number;
  canUseAI?: boolean;
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
  // #4: Hoàn tiền phần thời gian còn lại của gói cũ khi nâng cấp
  refundAmount?: number;
  refundStatus?: RefundStatus;
  refundNote?: string;
  refundedAt?: string;
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
  refundAmount?: number;
  refundStatus?: RefundStatus;
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
