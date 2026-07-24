'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { userService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, formatPackageName } from '@/lib/format';
import { getPackageBadgeClass } from '@/lib/permission';
import type { User, UserCafeSummary } from '@/types';
import { Eye, Lock, Unlock, Store, Users as UsersIcon } from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge, { type Tone } from '@/components/user/StatusBadge';

type CafeStatus = UserCafeSummary['status'];
const CAFE_LABEL: Record<CafeStatus, string> = { open: 'Đang mở cửa', closed: 'Đã đóng cửa', inactive: 'Ngừng hoạt động' };
const CAFE_TONE: Record<CafeStatus, Tone> = { open: 'success', closed: 'neutral', inactive: 'danger' };

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [pkgFilter, setPkgFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [lockTarget, setLockTarget] = useState<User | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    userService.list().then(setUsers).catch(() => toast({ description: 'Không thể tải người dùng', variant: 'destructive' })).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    (pkgFilter === 'all' || u.packageType === pkgFilter) &&
    (statusFilter === 'all' || u.status === statusFilter) &&
    (u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleLock = async (u: User) => {
    setProcessing(true);
    try {
      await userService.toggleLock(u.id);
      setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, status: usr.status === 'active' ? 'locked' as const : 'active' as const } : usr));
      setLockTarget(null);
      toast({ description: `Đã ${u.status === 'active' ? 'khóa' : 'mở khóa'} tài khoản` });
    } catch {
      toast({ description: 'Thao tác thất bại', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <PageHeader title="Quản lý người dùng" description={`${users.length} tài khoản`} />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên hoặc email..." />
        <select className="input-funcafe !w-auto min-w-[150px]" value={pkgFilter} onChange={e => setPkgFilter(e.target.value)}>
          <option value="all">Tất cả gói</option>
          <option value="none">Chưa có gói</option>
          <option value="free">Fun Free</option>
          <option value="pro">Pro</option>
          <option value="promax">Pro Max</option>
        </select>
        <select className="input-funcafe !w-auto min-w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="locked">Bị khóa</option>
        </select>
      </FilterBar>

      {loading ? <LoadingSkeleton variant="table" rows={8} cols={6} /> : (
      <div className="bg-white rounded-2xl border border-line overflow-x-auto shadow-soft">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-sand border-b border-line">
            <tr>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Họ tên</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Email</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Tên quán</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Gói</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Trạng thái</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Ngày tạo</th>
              <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-sand/50 transition-colors">
                <td className="px-4 py-3 font-semibold text-ink">{u.fullName}</td>
                <td className="px-4 py-3 text-cafe-600">{u.email}</td>
                {/* Cột này trước chỉ hiện quán ĐẦU TIÊN nên người có nhiều quán trông như chỉ có một. */}
                <td className="px-4 py-3 text-cafe-500">
                  {u.cafeName ?? '—'}
                  {(u.cafeCount ?? 0) > 1 && (
                    <span className="ml-1.5 text-xs text-bean font-semibold">+{(u.cafeCount ?? 1) - 1} quán</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={getPackageBadgeClass(u.packageType)}>{formatPackageName(u.packageType)}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={u.status === 'active' ? 'success' : 'neutral'}>
                    {u.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-cafe-400 text-xs">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setViewUser(u)} className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                    <button
                      onClick={() => setLockTarget(u)}
                      className={`p-2 rounded-lg transition-colors ${u.status === 'active' ? 'text-gold-deep hover:bg-gold/15' : 'text-pine hover:bg-pine/12'}`}
                    >
                      {u.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7}><EmptyState icon={UsersIcon} title="Không tìm thấy người dùng nào" description="Thử đổi từ khóa hoặc bộ lọc." /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      <Modal open={!!viewUser} onClose={() => setViewUser(null)} title="Chi tiết người dùng" size="xl">
        {viewUser && (
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-bean-tint rounded-full flex items-center justify-center text-bean font-bold text-xl ring-2 ring-white shadow-soft shrink-0">
                {viewUser.fullName.charAt(0)}
              </div>
              <div className="flex flex-col items-start gap-1 min-w-0">
                <p className="font-bold text-ink truncate">{viewUser.fullName}</p>
                <StatusBadge tone={viewUser.status === 'active' ? 'success' : 'neutral'}>
                  {viewUser.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                </StatusBadge>
              </div>
            </div>

            {/* Bốn con số trả lời ngay "người này là khách cỡ nào" */}
            {/* 2 cột: số tiền dài (vd "12.566.800 ₫") cần chỗ, ép 4 cột là bị cắt cụt */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Số quán', value: String(viewUser.cafeCount ?? viewUser.cafes?.length ?? 0) },
                { label: 'Quán còn gói', value: String(viewUser.activePackageCount ?? 0) },
                { label: 'Số giao dịch', value: String(viewUser.paymentCount ?? 0) },
                { label: 'Tổng đã thanh toán', value: formatCurrency(viewUser.totalPaid ?? 0) },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-line bg-sand/50 px-3.5 py-2.5 min-w-0">
                  <p className="text-xs text-cafe-500 mb-0.5 whitespace-nowrap">{s.label}</p>
                  <p className="font-bold text-ink tabular-nums text-lg">{s.value}</p>
                </div>
              ))}
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                // Email chiếm trọn hàng: ép vào nửa cột thì địa chỉ dài bị ngắt giữa chừng
                { label: 'Email', value: viewUser.email, wide: true },
                { label: 'Điện thoại', value: viewUser.phone || '—' },
                { label: 'Ngày đăng ký', value: formatDate(viewUser.createdAt) },
                { label: 'Thanh toán gần nhất', value: viewUser.lastPaymentAt ? formatDate(viewUser.lastPaymentAt) : 'Chưa có' },
                { label: 'Đã dùng thử Fun Free', value: viewUser.hasUsedFreeTrial ? 'Rồi' : 'Chưa' },
              ].map(r => (
                <div key={r.label} className={`min-w-0 ${r.wide ? 'col-span-2' : ''}`}>
                  <dt className="text-xs text-cafe-500 mb-0.5">{r.label}</dt>
                  <dd className="text-ink font-medium break-words">{r.value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="label-funcafe flex items-center gap-1.5">
                <Store className="w-4 h-4 text-bean" />
                Quán đang quản lý ({viewUser.cafes?.length ?? 0})
              </p>
              {!viewUser.cafes?.length ? (
                <p className="text-cafe-500 rounded-xl border border-line bg-sand/50 px-4 py-3">
                  Tài khoản này chưa mở quán nào.
                </p>
              ) : (
                <ul className="space-y-2">
                  {viewUser.cafes.map(c => (
                    <li key={c.id} className="rounded-xl border border-line p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{c.name}</p>
                          {c.address && <p className="text-xs text-cafe-500 truncate">{c.address}</p>}
                        </div>
                        <StatusBadge tone={CAFE_TONE[c.status]}>{CAFE_LABEL[c.status]}</StatusBadge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={getPackageBadgeClass(c.packageType)}>{formatPackageName(c.packageType)}</span>
                        {c.packageEndDate && c.packageType !== 'none' && (
                          <span className="text-xs text-cafe-500">còn hạn tới {formatDate(c.packageEndDate)}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!lockTarget}
        onClose={() => setLockTarget(null)}
        onConfirm={() => lockTarget && toggleLock(lockTarget)}
        title={lockTarget?.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        message={`Bạn có chắc muốn ${lockTarget?.status === 'active' ? 'khóa' : 'mở khóa'} tài khoản của ${lockTarget?.fullName}?`}
        confirmLabel={lockTarget?.status === 'active' ? 'Khóa' : 'Mở khóa'}
        danger={lockTarget?.status === 'active'}
      />
    </div>
  );
}
