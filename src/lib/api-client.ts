const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:8000';

// Địa chỉ dự phòng ở trên chỉ đúng khi chạy trên máy lập trình. Bản đã triển khai
// mà thiếu biến môi trường sẽ gọi vào localhost của MÁY NGƯỜI DÙNG — mọi request
// hỏng với lý do khó hiểu. Kêu to một lần lúc nạp thay vì để đoán mò.
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  console.error('[FunCafe] Thiếu NEXT_PUBLIC_API_URL — đang tạm gọi vào http://localhost:8000/api.');
}

/** Hạn chờ mặc định cho một request thường. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Tải ảnh đi qua Cloudinary nên chậm hơn hẳn, cho thêm thời gian. */
const UPLOAD_TIMEOUT_MS = 60_000;

/** `status = 0` nghĩa là request KHÔNG tới được máy chủ (mất mạng, sai địa chỉ, CORS). */
export const NETWORK_ERROR_STATUS = 0;

/**
 * Thông điệp theo mã lỗi. Máy chủ Laravel trả `message` cho phần lớn trường hợp
 * và đa số đã là tiếng Việt (thông báo kiểm tra dữ liệu, lỗi nghiệp vụ) — chỗ đó
 * ưu tiên dùng nguyên văn. Bảng này chỉ đỡ những mã mà Laravel trả câu tiếng Anh
 * mặc định hoặc không trả gì (proxy chết, mất mạng, quá tải).
 */
const STATUS_MESSAGES: Record<number, string> = {
  [NETWORK_ERROR_STATUS]: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  400: 'Yêu cầu không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  408: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.',
  409: 'Dữ liệu vừa bị thay đổi ở nơi khác. Tải lại trang rồi thử lại.',
  413: 'Tệp hoặc dữ liệu gửi lên quá lớn.',
  419: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
  422: 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại các ô đã nhập.',
  429: 'Bạn thao tác quá nhanh. Vui lòng đợi một phút rồi thử lại.',
  500: 'Máy chủ gặp sự cố. Vui lòng thử lại sau ít phút.',
  502: 'Máy chủ đang khởi động lại. Vui lòng thử lại sau ít phút.',
  503: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
  504: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.',
};

/**
 * Câu mặc định của Laravel — tiếng Anh, không nói được gì cho người dùng cuối.
 * Gặp đúng những câu này thì thay bằng thông điệp trong bảng trên.
 */
const GENERIC_SERVER_MESSAGES = new Set([
  'Server Error', 'Unauthenticated.', 'Unauthorized', 'Forbidden',
  'Not Found', 'Too Many Attempts.', 'Too Many Requests',
]);

function messageFor(status: number, serverMessage?: unknown): string {
  const own = typeof serverMessage === 'string' ? serverMessage.trim() : '';
  if (own && !GENERIC_SERVER_MESSAGES.has(own)) return own;
  return STATUS_MESSAGES[status] ?? `Có lỗi xảy ra (mã ${status}).`;
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }

  /** Không tới được máy chủ — khác hẳn "máy chủ đã trả lời là sai". */
  get isNetworkError(): boolean {
    return this.status === NETWORK_ERROR_STATUS;
  }

  /**
   * Gộp lỗi 422 của từng ô thành một câu đọc được. Trước đây mỗi trang tự viết
   * lại `Object.values(err.errors).flat().join(', ')`, chỗ nào quên thì người
   * dùng chỉ thấy "Dữ liệu chưa hợp lệ" mà không biết ô nào sai.
   */
  get detail(): string {
    const fields = Object.values(this.errors ?? {}).flat().filter(Boolean);
    return fields.length ? fields.join(' · ') : this.message;
  }
}

/**
 * Bọc mọi trục trặc của `fetch` thành `ApiError` để nơi gọi chỉ phải xử lý một
 * loại lỗi. Không có bước này thì mất mạng ném ra `TypeError: Failed to fetch`
 * và người dùng nhìn thấy đúng câu tiếng Anh đó trên màn hình.
 */
function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const name = (err as { name?: string })?.name;
  if (name === 'TimeoutError') return new ApiError(STATUS_MESSAGES[408], 408);
  if (name === 'AbortError') return new ApiError('Yêu cầu đã bị hủy.', NETWORK_ERROR_STATUS);
  return new ApiError(STATUS_MESSAGES[NETWORK_ERROR_STATUS], NETWORK_ERROR_STATUS);
}

const TOKEN_KEY = 'funcafe_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  // "Ghi nhớ" -> localStorage (bền qua phiên); ngược lại sessionStorage (hết khi đóng tab)
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token: string, remember = true) {
  if (typeof window === 'undefined') return;
  // Chỉ giữ token ở một nơi để tránh lệch trạng thái
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

function removeToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Có nên đá người dùng về /login khi gặp 401 không?
 *
 * Chỉ khi một PHIÊN ĐANG SỐNG bị từ chối giữa chừng (token hết hạn / bị thu
 * hồi từ thiết bị khác). Đá là `window.location.href` — nạp lại cả trang và
 * cắt ngang mọi việc đang chạy — nên phải rất chọn lọc:
 *
 *  - `endpoint` thuộc `/auth/*`: /auth/logout trả 401 khi token đã bị thu hồi
 *    là chuyện bình thường, không phải lý do nạp lại trang.
 *  - Trong storage KHÔNG còn token: nghĩa là phiên đã được kết thúc CÓ CHỦ Ý
 *    (bấm Đăng xuất) ngay trước đó. Các request đã bay đi từ trước — bảng
 *    thông báo, danh sách hoá đơn... — mang theo token cũ nên vẫn nhận 401,
 *    nhưng chúng chỉ là dư âm. Trước đây chính chúng kéo người dùng về /login
 *    thay vì về trang chủ sau khi đăng xuất.
 *
 * Vì vậy phải đọc token TẠI THỜI ĐIỂM nhận 401, không dùng token đã bắt lúc
 * gửi request.
 */
function shouldBounceToLogin(endpoint: string): boolean {
  if (endpoint.startsWith('/auth/')) return false;
  if (typeof window === 'undefined') return false;
  if (!getToken()) return false;
  return !window.location.pathname.startsWith('/login');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      // Không có hạn chờ thì máy chủ treo = vòng quay chờ vĩnh viễn: nút vẫn khóa,
      // người dùng không biết nên đợi hay bấm lại. Nơi gọi tự truyền `signal`
      // (để hủy giữa chừng) thì tôn trọng lựa chọn đó.
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw toApiError(err);
  }

  if (!response.ok) {
    // BUG-28 FIX: Token hết hạn → xóa token và redirect về login
    if (response.status === 401) {
      // Quyết định TRƯỚC khi xoá token — hàm dưới đọc storage để phân biệt
      // "phiên hết hạn" với "vừa bấm đăng xuất".
      const bounce = shouldBounceToLogin(endpoint);
      removeToken();
      if (bounce) window.location.href = '/login';
    }
    // Máy chủ 5xx thường trả trang HTML chứ không phải JSON — `.catch` giữ cho
    // chỗ này không sập, còn thông điệp lấy từ bảng theo mã lỗi.
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      messageFor(response.status, body.message),
      response.status,
      body.errors,
    );
  }

  // 204/205 hoặc thân rỗng: response.json() sẽ ném "Unexpected end of JSON input"
  // và làm sập cả trang. Trả về null cho các phản hồi không có nội dung.
  if (response.status === 204 || response.status === 205) return null as T;
  const text = await response.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
  setToken,
  getToken,
  removeToken,
  // Trả về Response thô để đọc body dạng stream (hiệu ứng gõ chữ cho chat AI).
  postStream: async (endpoint: string, data?: unknown): Promise<Response> => {
    const token = getToken();
    let res: Response;
    try {
      // KHÔNG đặt hạn chờ ở đây: phản hồi là dòng chữ chảy dần, sống lâu hơn hẳn
      // một request thường — cắt theo REQUEST_TIMEOUT_MS là cắt ngang câu trả lời.
      res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/plain',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      throw toApiError(err);
    }
    if (!res.ok) {
      if (res.status === 401) {
        const bounce = shouldBounceToLogin(endpoint);
        removeToken();
        if (bounce) window.location.href = '/login';
      }
      const body = await res.json().catch(() => ({}));
      throw new ApiError(messageFor(res.status, body.message), res.status, body.errors);
    }
    return res;
  },
  upload: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
    } catch (err) {
      throw toApiError(err);
    }
    if (!response.ok) {
      // Đọc lời giải thích của máy chủ thay vì nuốt đi. Upload hỏng vì đủ thứ lý do
      // khác nhau — ảnh quá 2MB, sai định dạng, kho ảnh Cloudinary từ chối — mà chỉ
      // báo "Upload thất bại" thì người dùng không biết phải sửa gì.
      const body = await response.json().catch(() => ({}));
      throw new ApiError(messageFor(response.status, body.message), response.status, body.errors);
    }
    const data = await response.json();
    // Cloudinary trả URL tuyệt đối (https://res.cloudinary.com/...) -> dùng thẳng.
    // Ảnh cũ lưu local trả path tương đối (/storage/...) -> ghép STORAGE_URL.
    return /^https?:\/\//i.test(data.url) ? data.url : `${STORAGE_URL}${data.url}`;
  },
};

export interface AuthUser {
  /**
   * Laravel serialize model Mongo ra khóa `id`, KHÔNG phải `_id`. Khai cả hai và
   * để nơi dùng lấy `id ?? _id` — giống hệt cách mọi mapper khác trong services
   * đang làm. Trước đây chỗ này chỉ khai `_id` nên `user.id` luôn undefined.
   */
  id?: string;
  _id?: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  has_used_free_trial?: boolean;
  avatar?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface SubscriptionData {
  _id: string;
  package_id: string;
  start_date: string;
  end_date: string;
  status: string;
  is_pending_review?: boolean;
  action_type?: string;
  package?: {
    _id: string;
    name: string;
    type: string;
    can_use_ai?: boolean;
    max_tables?: number | null;
    max_menu_items?: number | null;
  };
  // Các giao dịch của subscription, kèm khoản cấn trừ khi nâng cấp
  package_payments?: Array<{
    _id: string;
    action_type?: string;
    credit_amount?: number;
    credit_status?: string;
    created_at?: string;
  }>;
}
