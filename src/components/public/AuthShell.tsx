'use client';
import type { ReactNode, InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import PublicLayout from '@/components/layouts/PublicLayout';
import AuthAside from './AuthAside';

/**
 * Khung dùng chung cho trang đăng nhập và đăng ký.
 * Trước đây hai trang chép nguyên khối JSX giống hệt nhau nên mỗi lần chỉnh giao
 * diện phải sửa hai chỗ và rất dễ lệch nhau.
 */
export default function AuthShell({
  aside,
  title,
  subtitle,
  error,
  onSubmit,
  children,
  footer,
}: {
  aside: { image: string; title: string; subtitle: string; points: string[] };
  title: string;
  subtitle: string;
  error?: string;
  onSubmit: (e: React.FormEvent) => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <PublicLayout>
      <div className="bg-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="grid md:grid-cols-2 overflow-hidden rounded-3xl border border-line bg-white shadow-xl shadow-bean/10">
            <AuthAside {...aside} />

            <div className="p-6 sm:p-8 lg:p-10 flex items-center">
              <div className="w-full max-w-md mx-auto">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-ink">{title}</h1>
                  <p className="text-ink/70 text-sm mt-1.5">{subtitle}</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4" noValidate>
                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  {children}
                </form>

                <div className="mt-6 pt-5 border-t border-line text-center text-sm text-ink/70">
                  {footer}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Ghi chú dưới ô, ví dụ yêu cầu độ dài mật khẩu. */
  hint?: string;
  /** Lỗi của riêng ô này — hiện ngay dưới ô thay vì chỉ báo bằng toast. */
  error?: string;
  /** Nút phụ nằm trong ô, ví dụ nút hiện/ẩn mật khẩu. */
  trailing?: ReactNode;
  /**
   * Hiện dấu * cạnh nhãn. Chỉ bật khi form có lẫn ô tuỳ chọn (trang đăng ký);
   * form mà ô nào cũng bắt buộc (trang đăng nhập) thì dấu * chỉ thành nhiễu.
   */
  markRequired?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthField({ id, label, icon: Icon, hint, error, trailing, required, markRequired, ...input }: AuthFieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink/80 mb-1.5">
        {label}
        {required && markRequired && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
      </label>

      <div className="relative">
        <Icon
          aria-hidden
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
            error ? 'text-red-400' : 'text-cafe-400'
          }`}
        />
        <input
          id={id}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`w-full h-11 rounded-xl border bg-white pl-10 ${trailing ? 'pr-11' : 'pr-3.5'} text-sm text-ink placeholder-cafe-400 transition-colors duration-150 focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
              : 'border-line hover:border-cafe-300 focus:border-bean focus:ring-bean/35'
          }`}
          {...input}
        />
        {trailing && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink/70">{hint}</p>
      ) : null}
    </div>
  );
}

/** Nút hiện/ẩn mật khẩu đặt trong ô nhập — vùng chạm đủ 44px cho di động. */
export function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      aria-pressed={shown}
      className="w-8 h-8 grid place-items-center rounded-lg text-ink/70 hover:text-bean hover:bg-sand transition-colors focus:outline-none focus:ring-2 focus:ring-bean/35"
    >
      {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}
