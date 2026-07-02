import Link from 'next/link';
import { Lock } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  upgradeHref?: string;
}

export default function LockedBox({
  title = 'Tính năng bị khóa',
  description = 'Nâng cấp gói dịch vụ để sử dụng tính năng này.',
  upgradeHref = '/user/subscription',
}: Props) {
  return (
    <div className="card-funcafe text-center py-16">
      <div className="w-16 h-16 bg-cafe-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Lock className="w-8 h-8 text-cafe-400" />
      </div>
      <h3 className="text-lg font-bold text-cafe-800 mb-2">{title}</h3>
      <p className="text-cafe-500 text-sm mb-6 max-w-sm mx-auto">{description}</p>
      <Link href={upgradeHref} className="btn-primary">
        Nâng cấp ngay
      </Link>
    </div>
  );
}
