'use client';
import { useRef, useState } from 'react';
import { ImagePlus, Camera, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  shape?: 'square' | 'circle';
  label?: string;
  hint?: string;
}

/**
 * Uploader ảnh gọn dùng chung (logo quán...): ô preview có badge camera góc dưới
 * (kiểu Facebook) + chữ mô tả nằm cạnh. Kéo-thả vào ô, spinner khi tải. Bố cục
 * bám nội dung nên KHÔNG để lại khoảng trống thừa dù thẻ có rộng.
 */
export default function MediaUploader({ value, onChange, onRemove, shape = 'square', label = 'Ảnh', hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const { toast } = useToast();
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

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
    <div className="flex items-center gap-4">
      {/* Ô preview + badge camera (drop target) */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
        className="relative shrink-0 w-24 h-24"
      >
        <div className={`w-full h-full overflow-hidden bg-white transition-all ${radius} ${drag ? 'ring-2 ring-bean' : 'ring-1 ring-line'}`}>
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} className="w-full h-full flex items-center justify-center text-bean/70 bg-bean-tint/50 hover:bg-bean-tint transition-colors">
              <ImagePlus className="w-8 h-8" />
            </button>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-bean animate-spin" />
            </div>
          )}
        </div>
        {/* Badge camera */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          title="Tải / đổi ảnh"
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-bean text-white ring-2 ring-white shadow-soft flex items-center justify-center hover:bg-bean-dark active:scale-95 transition"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {/* Chữ mô tả + nút xóa */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-xs text-cafe-500 mt-1 leading-relaxed max-w-xs">{hint ?? 'Kéo & thả ảnh vào ô, hoặc bấm biểu tượng camera. Nên dùng ảnh vuông (PNG, JPG).'}</p>
        {value && !uploading && onRemove && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />Xóa ảnh
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} className="hidden" />
    </div>
  );
}
