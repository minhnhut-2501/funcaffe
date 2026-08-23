/**
 * Trả tiền MoMo sandbox bằng THẺ QUỐC TẾ (requestType=payWithCC).
 *
 * Lý do có tệp này: luồng thẻ nội địa (payWithATM) đi qua trang giả lập NAPAS,
 * mà trang đó treo vĩnh viễn ở "Đang hoàn tất giao dịch..." — API tra cứu của
 * MoMo đứng mãi ở resultCode 7002. Thẻ quốc tế đi mock khác nên thử đường này.
 *
 * Thẻ thử công khai (developers.momo.vn):
 *   5200000000001096 · 05/26 · CVC 111 -> THÀNH CÔNG
 *   5200000000001104 · 05/26 · CVC 111 -> THẤT BẠI
 * OTP cho mọi thẻ thử: 000000
 *
 * QUAN TRỌNG: nút "Thanh Toán" chuyển sang trạng thái đang quay rồi mới sang
 * chặng xác thực. Điền OTP ngay sau khi bấm là ghi đè lên ô ĐIỆN THOẠI của form
 * thẻ -> giao dịch bị từ chối (1002) và tưởng nhầm là thẻ sai.
 */
import { chromium } from 'playwright-core';

const THE = {
  so: process.env.THE_SO || '5200000000001096',
  ngay: process.env.THE_NGAY || '05/26',
  ten: 'NGUYEN VAN A',
  cvc: process.env.THE_CVC || '111',
  dien_thoai: '0912345678',
  otp: process.env.OTP || '000000',
};

const url = process.argv[2];
if (!url) { console.error('Thiếu URL'); process.exit(1); }

const td = await chromium.launch({ channel: 'msedge', headless: true });
const t = await td.newPage();
let b = 0;
const anh = async (n) => { b += 1; await t.screenshot({ path: `scripts/.kt-cc-${b}-${n}.png`, fullPage: true }); };
const chu = async () => (await t.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();

await t.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await t.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
console.log('1. Trang thẻ:', await t.title());

const dien = async (id, v) => {
  const o = t.locator(`#${id}`).first();
  await o.waitFor({ state: 'visible', timeout: 20000 });
  await o.fill(v);
};
await dien('card-number', THE.so);
await dien('card-expire', THE.ngay);
await dien('card-name', THE.ten);
await dien('card-cvc', THE.cvc);
await dien('number-phone', THE.dien_thoai);
await anh('da-dien');
console.log('2. Đã điền thẻ', THE.so, THE.ngay, 'CVC', THE.cvc);

await t.getByRole('button', { name: 'Thanh Toán' }).first().click({ timeout: 15000 });
console.log('3. Đã bấm Thanh Toán, chờ chặng kế...');

// Chờ ô nhập số thẻ biến mất (đã rời form thẻ) HOẶC hiện ô OTP. Không đặt mốc
// theo thời gian: mock của MoMo lúc nhanh lúc chậm.
await t.waitForFunction(
  () => !document.querySelector('#card-number') || !!document.querySelector('input[name*="otp" i], input[id*="otp" i]'),
  { timeout: 120000 },
).catch(() => console.log('   (hết giờ chờ chuyển chặng)'));
await t.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await anh('sau-bam');
console.log('   URL:', t.url());
console.log('   chữ:', (await chu()).slice(0, 250));

// Chặng OTP — chỉ điền khi form thẻ đã đi khỏi, tránh ghi đè ô điện thoại.
const conFormThe = await t.locator('#card-number').count().catch(() => 0);
if (!conFormThe) {
  const o = t.locator('input:not([type=hidden])');
  if (await o.count().catch(() => 0)) {
    await o.last().fill(THE.otp).catch(() => {});
    for (const n of ['Tiếp tục', 'Xác nhận', 'Thanh Toán', 'Xác thực', 'Submit']) {
      const nut = t.getByRole('button', { name: n, exact: false });
      if (await nut.count().catch(() => 0)) { await nut.first().click({ timeout: 10000 }).catch(() => {}); break; }
    }
    console.log('4. Đã nhập OTP', THE.otp);
  } else console.log('4. Không có ô OTP (thẻ này không cần)');
}

await t.waitForURL(/funcafe\.pro/, { timeout: 180000 })
  .then(() => console.log('5. ĐÃ QUAY VỀ funcafe.pro'))
  .catch(() => console.log('5. hết giờ, vẫn ở:', t.url()));
await anh('ket-thuc');
console.log('\nURL cuối:', t.url());
await td.close();
