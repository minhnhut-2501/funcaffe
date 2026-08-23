import { describe, it, expect } from 'vitest';
import {
  defaultPackageLimits,
  packageLimits,
  isSubscriptionExpired,
  canManage,
  canUseAI,
  canPrint,
  expiryState,
  daysLeftUntil,
} from './permission';
import type { UserSubscription, UserPackageType } from '@/types';

const ngay = (lech: number) => new Date(Date.now() + lech * 86_400_000).toISOString();

function sub(patch: Partial<UserSubscription> = {}): UserSubscription {
  return {
    packageType: 'pro',
    packageName: 'Pro',
    startDate: ngay(-10),
    endDate: ngay(20),
    daysLeft: 20,
    ...patch,
  };
}

describe('defaultPackageLimits — bảng dự phòng theo loại gói', () => {
  it('chưa có gói thì không được gì', () => {
    expect(defaultPackageLimits('none')).toEqual({ maxTables: 0, maxMenuItems: 0, maxStaff: 0, canUseAI: false });
  });

  /**
   * Fun Free từ 08/2026 là bản dùng thử gói PRO (không phải Pro Max nữa): cùng trần
   * bàn/món với Pro, nhưng VẪN có AI để người dùng thử được tính năng đinh trước khi
   * quyết mua. Đổi ở đây phải đi kèm đổi `packages.json` — hai chỗ lệch nhau là bảng
   * giá quảng cáo một đằng, máy chủ chặn một nẻo.
   */
  it('Fun Free = trần của Pro (20 bàn / 40 món / 2 nhân viên) nhưng CÓ AI', () => {
    expect(defaultPackageLimits('free')).toEqual({ maxTables: 20, maxMenuItems: 40, maxStaff: 2, canUseAI: true });
  });

  it('Pro: 20 bàn, 40 món, 2 nhân viên, không có AI', () => {
    expect(defaultPackageLimits('pro')).toEqual({ maxTables: 20, maxMenuItems: 40, maxStaff: 2, canUseAI: false });
  });

  it('Pro Max không giới hạn gì cả và có AI', () => {
    expect(defaultPackageLimits('promax'))
      .toEqual({ maxTables: Infinity, maxMenuItems: Infinity, maxStaff: Infinity, canUseAI: true });
  });

  it('loại gói lạ rơi về "none" — KHÔNG được rơi về "free"', () => {
    // Rơi về bất kỳ gói nào có quyền đều là MỞ KHÓA khi dữ liệu hỏng. Fun Free nay
    // đã hẹp hơn trước, nhưng nó vẫn có AI và 20 bàn — vẫn nhiều hơn "không có gì".
    expect(defaultPackageLimits('la_hoac_hong' as UserPackageType)).toEqual(defaultPackageLimits('none'));
  });
});

describe('packageLimits — cấu hình trên gói thắng bảng dự phòng', () => {
  it('lấy đúng số admin đã cấu hình', () => {
    expect(packageLimits(sub({ maxTables: 25, maxMenuItems: 60, maxStaff: 9, canUseAI: true })))
      .toEqual({ maxTables: 25, maxMenuItems: 60, maxStaff: 9, canUseAI: true });
  });

  it('gói thiếu trường nào thì trường đó dùng bảng dự phòng', () => {
    expect(packageLimits(sub({ maxTables: 5 })))
      .toEqual({ maxTables: 5, maxMenuItems: 40, maxStaff: 2, canUseAI: false });
  });

  it('không có gói thì trả mức của "none"', () => {
    expect(packageLimits(null)).toEqual(defaultPackageLimits('none'));
    expect(packageLimits(undefined)).toEqual(defaultPackageLimits('none'));
  });
});

describe('isSubscriptionExpired', () => {
  it('hạn đã qua là hết hạn', () => {
    expect(isSubscriptionExpired(sub({ endDate: ngay(-1) }))).toBe(true);
  });

  it('còn hạn thì chưa hết', () => {
    expect(isSubscriptionExpired(sub({ endDate: ngay(1) }))).toBe(false);
  });

  it('chưa từng có gói thì không gọi là "hết hạn"', () => {
    expect(isSubscriptionExpired(sub({ packageType: 'none' }))).toBe(false);
    expect(isSubscriptionExpired(null)).toBe(false);
  });
});

describe('canManage — cổng chặn mọi thao tác ghi', () => {
  it('gói còn hiệu lực thì được ghi', () => {
    expect(canManage(sub())).toBe(true);
  });

  it('gói hết hạn thì chỉ xem', () => {
    expect(canManage(sub({ endDate: ngay(-1) }))).toBe(false);
  });

  it('chưa có gói thì không ghi được', () => {
    expect(canManage(sub({ packageType: 'none' }))).toBe(false);
    expect(canManage(null)).toBe(false);
  });
});

describe('quyền theo gói', () => {
  it('AI theo cấu hình của gói, không theo tên gói', () => {
    expect(canUseAI(sub({ canUseAI: true }))).toBe(true);
    expect(canUseAI(sub())).toBe(false); // Pro mặc định không có AI
    expect(canUseAI(null)).toBe(false);
  });

  it('in hóa đơn cần có gói bất kỳ', () => {
    expect(canPrint('pro')).toBe(true);
    expect(canPrint('none')).toBe(false);
  });
});

describe('expiryState — ba nơi cảnh báo phải dùng chung một ngưỡng', () => {
  it('quán chưa có gói khác hẳn quán đã hết hạn', () => {
    expect(expiryState(null)).toBe('none');
    expect(expiryState('')).toBe('none');
  });

  it('ngày hỏng không làm sập, coi như chưa có gói', () => {
    expect(expiryState('khong-phai-ngay')).toBe('none');
  });

  it('quá hạn / sắp hết / còn nhiều', () => {
    expect(expiryState(ngay(-1))).toBe('expired');
    expect(expiryState(ngay(3))).toBe('soon');
    expect(expiryState(ngay(30))).toBe('ok');
  });
});

describe('daysLeftUntil — làm tròn LÊN', () => {
  it('còn vài tiếng vẫn là 1 ngày, không phải 0', () => {
    const bonTiengNua = new Date(Date.now() + 4 * 3_600_000).toISOString();
    expect(daysLeftUntil(bonTiengNua)).toBe(1);
  });

  it('đã qua hạn thì là 0, không âm', () => {
    expect(daysLeftUntil(ngay(-5))).toBe(0);
  });
});
