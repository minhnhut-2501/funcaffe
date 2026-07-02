import React from 'react';
import { Inbox } from 'lucide-react';

interface Props {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon = Inbox, title = 'Không có dữ liệu', description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-16 h-16 bg-bean-tint rounded-2xl flex items-center justify-center mb-4 ring-1 ring-line">
        <Icon className="w-8 h-8 text-bean/60" />
      </div>
      <h3 className="text-base font-bold text-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-cafe-500 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}
