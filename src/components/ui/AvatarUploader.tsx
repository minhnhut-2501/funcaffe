'use client';
import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  fallback?: string;   // chữ cái hiển thị khi chưa có ảnh
  size?: number;       // px, mặc định 80
}

/**
 * Avatar tròn với badge camera góc dưới (kiểu Facebook): bấm để đổi ảnh,
 * spinner khi tải, nút xóa nhỏ hiện khi hover (nếu có onRemove).
 */
export default function AvatarUploader({ value, onChange, onRemove, fallback = 'U', size = 80 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const upload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ description: 'Vui lòng chọn tệp ảnh (PNG, JPG...).', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      onChange(await api.upload(file));
    } catch {
      toast({ description: 'Tải ảnh thất bại, vui lòng thử lại.', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="relative inline-block group" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full ring-4 ring-white bg-bean-tint shadow-soft overflow-hidden flex items-center justify-center text-bean font-bold" style={{ fontSize: size * 0.4 }}>
        {value ? <img src={value} alt="Ảnh đại diện" className="w-full h-full object-cover" /> : fallback}
        {uploading && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center rounded-full">
            <Loader2 className="w-6 h-6 text-bean animate-spin" />
          </div>
        )}
      </div>

      {/* Badge camera */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Đổi ảnh đại diện"
        className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-bean text-white ring-2 ring-white shadow-soft flex items-center justify-center hover:bg-bean-dark active:scale-95 transition"
      >
        <Camera className="w-4 h-4" />
      </button>

      {/* Nút xóa nhỏ (hiện khi hover) */}
      {value && !uploading && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Xóa ảnh"
          className="absolute top-0 right-0 w-6 h-6 rounded-full bg-white text-red-500 ring-1 ring-line shadow-soft flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} className="hidden" />
    </div>
  );
}
