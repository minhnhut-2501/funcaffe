/**
 * Kiểm thử VNPay đầu-cuối trên BẢN THẬT, môi trường sandbox.
 *
 * Chạy:  node scripts/kt-vnpay.mjs <url-thanh-toan>
 *
 * Thẻ thử công khai của VNPay sandbox (ngân hàng NCB) — KHÔNG phải tiền thật.
 * Chạy ngầm (headless) để không chiếm màn hình; mỗi bước chụp một ảnh vào
 * scripts/.kt-vnpay-*.png để soi khi hỏng.
 */
import { chromium } from 'playwright-core';

const THE = {
  so:  '9704198526191432198',
  ten: 'NGUYEN VAN A',
  ngay: '07/15',
  otp: '123456',
};

const url = process.argv[2];
if (!url) { console.error('Thiếu URL thanh toán'); process.exit(1); }

const trinhDuyet = await chromium.launch({ channel: 'msedge', headless: true });
const trang = await trinhDuyet.newPage();

let buoc = 0;
const anh = async (ten) => {
  buoc += 1;
  await trang.screenshot({ path: `scripts/.kt-vnpay-${buoc}-${ten}.png`, fullPage: true });
};
const chu = async () => (await trang.evaluate(() => document.body.innerText))
  .replace(/\s+/g, ' ').trim();

// Trang chuyển hướng nhiều chặng; chờ mạng lặng rồi mới đọc DOM.
const lang = () => trang.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});

await trang.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await lang();
console.log('1. Chọn phương thức:', await trang.title());
await anh('chon-phuong-thuc');

await trang.getByText('Thẻ nội địa và tài khoản ngân hàng', { exact: false }).first().click();
await lang();
await trang.waitForTimeout(1500);
console.log('2. Danh sách ngân hàng');
await anh('danh-sach-ngan-hang');

// NCB là ngân hàng duy nhất sandbox phát hành thẻ thử.
await trang.locator('[id*="NCB" i], img[alt*="NCB" i], li:has-text("NCB")').first().click();
await lang();
await trang.waitForTimeout(1500);
console.log('3. Form nhập thẻ');
await anh('form-the');

// Nhắm theo chữ gợi ý đang hiển thị chứ không theo id/name: id của VNPay sandbox
// không đoán được, còn chữ gợi ý thì chính người dùng cũng nhìn thấy nên bền hơn.
const dien = async (goi_y, gia_tri) => {
  const o = trang.getByPlaceholder(goi_y, { exact: false }).first();
  await o.waitFor({ state: 'visible', timeout: 20000 });
  await o.fill(gia_tri);
};
await dien('Nhập số thẻ', THE.so);
await dien('Nhập tên chủ thẻ', THE.ten);
await dien('MM/YY', THE.ngay);
await anh('da-dien-the');

// Nút của VNPay không phải lúc nào cũng là <button> — có chặng nó là <a>, có chặng
// là <input type=submit>. Thử lần lượt vài cách nhắm thay vì tin vào một cách.
const bam = async (nhan) => {
  const cach = [
    trang.getByRole('button', { name: nhan, exact: false }),
    trang.getByRole('link', { name: nhan, exact: false }),
    trang.locator(`input[type=submit][value*="${nhan}" i]`),
    trang.locator(`:text-is("${nhan}")`),
  ];
  for (const c of cach) {
    if (await c.count().catch(() => 0)) {
      await c.first().click({ timeout: 15000 }).catch(() => {});
      return true;
    }
  }
  return false;
};

console.log('   bấm Tiếp tục:', await bam('Tiếp tục'));
await lang();
await trang.waitForTimeout(3000);
console.log('4. Trang xác nhận:', (await chu()).slice(0, 160));
await anh('xac-nhan');

// Chặng xác nhận có thể có hoặc không, tuỳ luồng của ngân hàng.
for (const nhan of ['Tiếp tục', 'Đồng ý', 'Xác nhận']) {
  if (await trang.locator(`:text-is("${nhan}")`).count().catch(() => 0)) {
    await bam(nhan);
    await lang();
    await trang.waitForTimeout(3000);
    break;
  }
}
await anh('truoc-otp');

const oOtp = trang.locator('#otpvalue, input[name="otpvalue"], input[maxlength="6"]').first();
if (await oOtp.count()) {
  await oOtp.fill(THE.otp);
  console.log('5. Đã nhập OTP');
  for (const nhan of ['Thanh toán', 'Xác nhận', 'Tiếp tục']) {
    if (await bam(nhan)) break;
  }
  await lang();
  await trang.waitForTimeout(5000);
} else {
  console.log('5. KHÔNG thấy ô OTP — dừng ở:', trang.url());
}
await anh('ket-thuc');

console.log('\nURL cuối :', trang.url());
console.log('Chữ cuối :', (await chu()).slice(0, 300));
await trinhDuyet.close();
