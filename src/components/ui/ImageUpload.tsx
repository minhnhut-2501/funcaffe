'use client';
import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { api } from '@/lib/api-client';

interface Props {
  currentImage?: string;
  onUpload: (url: string) => void;
  onRemove?: () => void;
}

export default function ImageUpload({ currentImage, onUpload, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await api.upload(file);
      onUpload(url);
    } catch {
      // error handled silently
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {currentImage ? (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-cafe-200 bg-cafe-50">
          <img src={currentImage} alt="" className="w-full h-full object-cover" />
          {onRemove && (
            <button type="button" onClick={onRemove}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-cafe-200 bg-cafe-50 flex items-center justify-center text-cafe-300">
          <Upload className="w-5 h-5" />
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="btn-secondary text-sm py-1.5 px-3">
        {uploading ? 'Đang tải...' : 'Chọn ảnh'}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}
