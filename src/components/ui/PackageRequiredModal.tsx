'use client';
import { X, Coffee, Star, Zap } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PackageRequiredModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-cafe-800">Chọn gói để tiếp tục sử dụng</h2>
          <button onClick={onClose} className="text-cafe-400 hover:text-cafe-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-cafe-600 mb-6">
          Bạn cần kích hoạt Fun Free hoặc đăng ký Pro / Pro Max để thực hiện thao tác này.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 text-center">
            <Coffee className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <div className="text-base font-bold text-blue-700 mb-1">Fun Free</div>
            <div className="text-xs text-blue-600 font-medium mb-1">Miễn phí</div>
            <p className="text-xs text-blue-500">Dùng thử 7 ngày, chỉ dùng một lần</p>
          </div>

          <div className="border border-cafe-200 rounded-xl p-4 bg-cafe-50 text-center">
            <Star className="w-6 h-6 text-cafe-600 mx-auto mb-2" />
            <div className="text-base font-bold text-cafe-700 mb-1">Pro</div>
            <div className="text-xs text-cafe-600 font-medium mb-1">Từ 199.000đ/tháng</div>
            <p className="text-xs text-cafe-500">Quản lý đầy đủ chức năng cơ bản, không có thống kê doanh thu</p>
          </div>

          <div className="border border-cafe-700 rounded-xl p-4 bg-cafe-700 text-center text-white">
            <Zap className="w-6 h-6 mx-auto mb-2" />
            <div className="text-base font-bold mb-1">Pro Max</div>
            <div className="text-xs font-medium mb-1 text-cafe-200">Từ 299.000đ/tháng</div>
            <p className="text-xs text-cafe-300">Đầy đủ chức năng Pro, có thống kê doanh thu</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 btn-secondary">Để sau</button>
          <a href="/user/subscription" className="flex-1 btn-primary text-center">Xem gói dịch vụ</a>
        </div>
      </div>
    </div>
  );
}
