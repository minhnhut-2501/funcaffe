/**
 * Trả tiền MoMo sandbox bằng THẺ ATM thử, chạy ngầm trên trình duyệt.
 *
 * Chỉ chạy được khi MOMO_REQUEST_TYPE=payWithATM. Với captureWallet thì trang chỉ
 * hiện mã QR và phải quét bằng ứng dụng MoMo Test — xem scripts/kt-momo.mjs để dò.
 *
 * Thẻ thử công khai của MoMo, không phải tiền thật.
 */
import { chromium } from 'playwright-core';

const THE = {
  so: '9704000000000018',
  ten: 'NGUYEN VAN A',
  ngay: '03/07',
  dien_thoai: '0912345678',
  // Trang giả lập NAPAS có bảng mã OTP riêng, mỗi mã ép ra một kết cục:
  //   000 SUCCESS · 001 PENDING · 111 OTP sai · 444 không đủ số dư · 888 huỷ
  // Dùng 000 cho tường minh, đừng gõ đại rồi trông vào nhánh mặc định.
  otp: process.env.OTP || '000000',
};

const url = process.argv[2];
if (!url) { console.error('Thiếu URL'); process.exit(1); }

const trinhDuyet = await chromium.launch({ channel: 'msedge', headless: true });
const trang = await trinhDuyet.newPage();

let buoc = 0;
const anh = async (ten) => {
  buoc += 1;
  await trang.screenshot({ path: `scripts/.kt-momo-${buoc}-${ten}.png`, fullPage: true });
};
const lang = () => trang.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
const chu = async () => (await trang.evaluate(() => document.body.innerText))
  .replace(/\s+/g, ' ').trim();

await trang.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await lang();
await trang.waitForTimeout(2000);
console.log('1. Mở trang thẻ:', await trang.title());
await anh('form-the');

const dien = async (id, gia_tri) => {
  const o = trang.locator(`#${id}`).first();
  await o.waitFor({ state: 'visible', timeout: 20000 });
  await o.fill(gia_tri);
};
await dien('card-number', THE.so);
await dien('card-expire', THE.ngay);
await dien('card-name', THE.ten);
await dien('number-phone', THE.dien_thoai);
console.log('2. Đã điền thẻ');
await anh('da-dien');

const bam = async (nhan) => {
  for (const c of [
    trang.getByRole('button', { name: nhan, exact: false }),
    trang.locator(`:text-is("${nhan}")`),
    trang.locator(`input[type=submit][value*="${nhan}" i]`),
  ]) {
    if (await c.count().catch(() => 0)) {
      await c.first().click({ timeout: 15000 }).catch(() => {});
      return true;
    }
  }
  return false;
};

console.log('3. Bấm Thanh Toán:', await bam('Thanh Toán'));
await lang();
await trang.waitForTimeout(4000);
await anh('sau-thanh-toan');
console.log('   trang giờ là:', (await chu()).slice(0, 150));

// Chặng OTP: MoMo sandbox nhận đúng chữ "OTP" làm mã.
const oOtp = trang.locator('input[type=tel], input[type=text], input[type=password]')
  .filter({ hasNot: trang.locator('[type=hidden]') });
const soO = await oOtp.count().catch(() => 0);
if (soO) {
  await oOtp.last().fill(THE.otp).catch(() => {});
  console.log('4. Đã nhập OTP');
  for (const n of ['Tiếp tục', 'Xác nhận', 'Thanh Toán', 'Xác thực']) if (await bam(n)) break;

  // Sau OTP còn một chặng "Đang hoàn tất giao dịch..." rồi mới quay về trang mình.
  // Lần trước đóng trình duyệt ở đây nên cắt ngang đúng lúc MoMo chưa gửi xong.
  console.log('5. Chờ MoMo quay về funcafe.pro (tối đa 300 giây)...');
  await trang.waitForURL(/funcafe\.pro/, { timeout: 300000 })
    .then(() => console.log('   đã quay về'))
    .catch(() => console.log('   HẾT GIỜ, vẫn ở:', trang.url()));
  await trang.waitForTimeout(3000);
} else {
  console.log('4. Không thấy ô OTP');
}
await anh('ket-thuc');

console.log('\nURL cuối :', trang.url());
console.log('Chữ cuối :', (await chu()).slice(0, 250));
await trinhDuyet.close();
