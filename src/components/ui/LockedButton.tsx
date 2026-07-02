'use client';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import React from 'react';
import PackageRequiredModal from './PackageRequiredModal';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export default function LockedButton({ children, className, variant = 'primary' }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const base = variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-secondary';

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={cn(base, 'opacity-60 flex items-center gap-1.5', className)}
      >
        <Lock className="w-3.5 h-3.5" />
        {children}
      </button>
      <PackageRequiredModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
