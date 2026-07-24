const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
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
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    // BUG-28 FIX: Token hết hạn → xóa token và redirect về login
    if (response.status === 401) {
      removeToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.message || `HTTP ${response.status}`,
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
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/plain',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      if (res.status === 401) {
        removeToken();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.message || `HTTP ${res.status}`, res.status, body.errors);
    }
    return res;
  },
  upload: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) throw new ApiError('Upload thất bại', response.status);
    const data = await response.json();
    // Cloudinary trả URL tuyệt đối (https://res.cloudinary.com/...) -> dùng thẳng.
    // Ảnh cũ lưu local trả path tương đối (/storage/...) -> ghép STORAGE_URL.
    return /^https?:\/\//i.test(data.url) ? data.url : `${STORAGE_URL}${data.url}`;
  },
};

export interface AuthUser {
  _id: string;
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
