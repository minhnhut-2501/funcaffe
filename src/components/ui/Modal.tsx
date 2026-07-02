'use client';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import React from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export default function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', onKey);
      return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    }
    document.body.style.overflow = '';
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div className={`relative bg-white rounded-3xl shadow-pop w-full ${sizeMap[size]} max-h-[90vh] flex flex-col anim-pop`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg text-cafe-400 hover:text-bean hover:bg-sand transition-colors" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
