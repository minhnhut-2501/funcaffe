'use client';
import { useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

/**
 * Phần LOGIC dùng chung của ba bộ tải ảnh (ảnh món, logo quán, ảnh đại diện).
 *
 * Ba component đó khác nhau ở CÁCH BÀY (một hàng gọn, ô vuông có badge camera,
 * hình tròn) — chỗ đó nên giữ riêng. Nhưng phần chọn tệp → kiểm tra → gọi API →
 * báo lỗi thì giống hệt nhau, mà lại lệch: bản ở trang Thực đơn quên kiểm loại
 * tệp, và KHÔNG bản nào kiểm dung lượng.
 */

/** Máy chủ chặn ở `max:2048` (KB). Kiểm trước ở trình duyệt để khỏi tải lên rồi mới bị từ chối. */
const TOI_DA_MB = 2;
const TOI_DA_BYTE = TOI_DA_MB * 1024 * 1024;

/** Khớp `mimes:jpeg,png,jpg,gif,webp` phía máy chủ. */
const DUOI_CHO_PHEP = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function useImageUpload(onDone: (url: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const bao = (description: string) => toast({ description, variant: 'destructive' });

  const upload = async (file?: File | null) => {
    if (!file) return;

    if (!DUOI_CHO_PHEP.includes(file.type)) {
      bao('Chỉ nhận ảnh PNG, JPG, GIF hoặc WEBP.');
      return;
    }
    if (file.size > TOI_DA_BYTE) {
      // Nói rõ nặng bao nhiêu: "quá lớn" không cho người dùng biết phải nén xuống mức nào.
      const mb = (file.size / 1024 / 1024).toFixed(1).replace('.', ',');
      bao(`Ảnh nặng ${mb} MB, vượt mức ${TOI_DA_MB} MB. Hãy chọn ảnh nhỏ hơn.`);
      return;
    }

    setUploading(true);
    try {
      onDone(await api.upload(file));
    } catch (e) {
      // ApiError đã mang sẵn câu tiếng Việt theo mã lỗi (mất mạng, quá hạn chờ,
      // máy chủ từ chối). Nuốt lỗi ở đây là người dùng thấy "Đang tải..." tắt đi
      // mà không có ảnh và không có lời giải thích nào.
      bao(e instanceof ApiError ? e.message : 'Tải ảnh thất bại, vui lòng thử lại.');
    } finally {
      setUploading(false);
      // Xóa giá trị input để chọn LẠI ĐÚNG tệp vừa rồi vẫn kích hoạt onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return { inputRef, uploading, upload, moHopChonTep: () => inputRef.current?.click() };
}
