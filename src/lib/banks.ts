// Danh sách ngân hàng Việt Nam phổ biến kèm mã BIN (Napas) dùng cho VietQR.
// Nguồn mã BIN: https://api.vietqr.io/v2/banks
export interface BankOption {
  bin: string;   // mã BIN Napas (dùng để sinh VietQR)
  code: string;  // mã ngắn
  name: string;  // tên rút gọn
}

export const VN_BANKS: BankOption[] = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank' },
  { bin: '970407', code: 'TCB', name: 'Techcombank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'AGR', name: 'Agribank' },
  { bin: '970415', code: 'ICB', name: 'VietinBank' },
  { bin: '970422', code: 'MB', name: 'MB Bank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970432', code: 'VPB', name: 'VPBank' },
  { bin: '970423', code: 'TPB', name: 'TPBank' },
  { bin: '970403', code: 'STB', name: 'Sacombank' },
  { bin: '970437', code: 'HDB', name: 'HDBank' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970454', code: 'VCCB', name: 'Ngân hàng Bản Việt (BVBank)' },
  { bin: '970429', code: 'SCB', name: 'SCB' },
  { bin: '970409', code: 'BAB', name: 'BacABank' },
  { bin: '970412', code: 'PVCB', name: 'PVcomBank' },
  { bin: '970414', code: 'OCEANBANK', name: 'OceanBank' },
  { bin: '546034', code: 'CAKE', name: 'CAKE by VPBank' },
  { bin: '963388', code: 'TIMO', name: 'Timo' },
];

export function findBank(bin?: string): BankOption | undefined {
  if (!bin) return undefined;
  return VN_BANKS.find((b) => b.bin === bin);
}

/**
 * Dựng URL ảnh VietQR (img.vietqr.io) - không cần API key.
 * template: compact2 hiển thị logo ngân hàng + số tiền + nội dung.
 */
export function buildVietQrImageUrl(opts: {
  bankBin: string;
  accountNumber: string;
  accountName?: string;
  amount?: number;
  addInfo?: string;
}): string {
  const base = `https://img.vietqr.io/image/${opts.bankBin}-${opts.accountNumber}-compact2.png`;
  const params = new URLSearchParams();
  if (opts.amount && opts.amount > 0) params.set('amount', String(Math.round(opts.amount)));
  if (opts.addInfo) params.set('addInfo', opts.addInfo);
  if (opts.accountName) params.set('accountName', opts.accountName);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
