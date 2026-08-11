import { describe, it, expect } from 'vitest';
import { VN_BANKS, buildVietQrImageUrl } from './banks';

describe('danh sách ngân hàng', () => {
  it('mã BIN không trùng nhau', () => {
    const bins = VN_BANKS.map((b) => b.bin);
    expect(new Set(bins).size).toBe(bins.length);
  });

  it('mã BIN đúng dạng số 6 chữ số của Napas', () => {
    for (const b of VN_BANKS) {
      expect(b.bin, `${b.name} có BIN sai dạng`).toMatch(/^\d{6}$/);
    }
  });
});

describe('buildVietQrImageUrl — mã QR khách quét để trả tiền', () => {
  const co = { bankBin: '970436', accountNumber: '0123456789' };

  it('số tiền đi vào mã, làm tròn về đồng', () => {
    const url = buildVietQrImageUrl({ ...co, amount: 125_499.6 });
    expect(url).toContain('amount=125500');
  });

  it('số tiền lẻ hàng nghìn giữ nguyên, không làm tròn lên nghìn', () => {
    const url = buildVietQrImageUrl({ ...co, amount: 47_500 });
    expect(url).toContain('amount=47500');
  });

  it('không truyền số tiền thì QR để khách tự nhập, không gắn amount=0', () => {
    const url = buildVietQrImageUrl(co);
    expect(url).not.toContain('amount');
    expect(url).toBe('https://img.vietqr.io/image/970436-0123456789-compact2.png');
  });

  it('số tiền 0 cũng không gắn vào mã', () => {
    expect(buildVietQrImageUrl({ ...co, amount: 0 })).not.toContain('amount');
  });

  it('nội dung chuyển khoản được mã hóa an toàn cho URL', () => {
    const url = buildVietQrImageUrl({ ...co, amount: 50_000, addInfo: 'ORD-20260811-001' });
    expect(url).toContain('addInfo=ORD-20260811-001');
    const coDau = buildVietQrImageUrl({ ...co, addInfo: 'Thanh toán bàn 5' });
    expect(coDau).toContain('addInfo=Thanh+to%C3%A1n+b%C3%A0n+5');
  });

  it('tên chủ tài khoản đi kèm khi có', () => {
    expect(buildVietQrImageUrl({ ...co, accountName: 'NGUYEN VAN A' })).toContain('accountName=NGUYEN+VAN+A');
  });
});
