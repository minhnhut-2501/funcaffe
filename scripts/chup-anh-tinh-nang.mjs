/**
 * Chụp ảnh sản phẩm cho TRANG CÔNG KHAI (public/product/*.png).
 *
 * Khác `shot-report.mjs`: ảnh ở đây đi vào trang chủ và trang Tính năng cho người
 * ngoài xem, nên chụp đúng khung 1400×875 như các ảnh đã có — lệch khổ là bố cục
 * hai cột trên trang chủ so le nhau.
 *
 * Cần: `npm run dev` và `php artisan serve` đang chạy, CSDL có bộ demo.
 *
 *   node scripts/chup-anh-tinh-nang.mjs
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const B = 'http://localhost:3000';
const OUT = 'public/product';
const CHU = 'nphec4007@gmail.com';
// Mật khẩu KHÔNG viết cứng trong mã — kho này công khai.
const MAT_KHAU = process.env.OWNER_PASS ?? '12345678';

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ locale: 'vi-VN', viewport: { width: 1400, height: 875 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(`${B}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('input[type=email]', { timeout: 60000 });
await page.waitForTimeout(2500);
await page.fill('input[type=email]', CHU);
await page.fill('input[type=password]', MAT_KHAU);
await page.click('button[type=submit]');
await page.waitForFunction(() => location.pathname.startsWith('/user'), { timeout: 60000 });

/** Chuyển sang quán Pro Max — quán đó có đủ nhân viên và thực đơn dài nhất. */
const doiQuan = async (ten) => {
  // Bộ chọn quán là nút DUY NHẤT trong header có chữ tên quán đang chọn.
  await page.getByRole('button', { name: /Cà Phê|Nắng|Chọn quán/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: ten }).first().click();
  await page.waitForTimeout(4000);
};

const chup = async (ten, duong, chuanBi) => {
  await page.goto(B + duong, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(7000);
  if (chuanBi) await chuanBi(page);
  await page.screenshot({ path: `${OUT}/${ten}.png` });
  console.log(`  ✓ ${OUT}/${ten}.png`);
};

await doiQuan('Nắng Sài Gòn Coffee');

await chup('staff', '/user/staff');

await chup('pos-takeaway', '/user/sales', async (p) => {
  await p.getByText('MANG VỀ', { exact: true }).first().click();
  await p.waitForTimeout(1200);

  // Giỏ RỖNG thì ảnh không nói được gì — cả điểm đáng xem của tính năng này là phiếu
  // mang về không gắn bàn nào. Thêm vài món có thật trong thực đơn của quán đó.
  let daThem = 0;
  for (const m of ['Bánh Croissant', 'Bánh Su Kem', 'Tắc Đá Viên']) {
    const the = p.getByText(m, { exact: true }).first();
    if (!(await the.count())) continue;
    await the.click();
    await p.waitForSelector('button:has-text("Thêm vào order")', { timeout: 15000 });
    await p.locator('button', { hasText: 'Thêm vào order' }).first().click();
    await p.waitForSelector('button:has-text("Thêm vào order")', { state: 'detached', timeout: 20000 });
    daThem++;
  }
  if (daThem === 0) throw new Error('Không thêm được món nào — đổi tên món trong danh sách trên.');

  // Cuộn thực đơn về đầu: sau mỗi lần bấm món khung giữa bị đẩy xuống, chụp ra ảnh
  // là một lưới món cắt ngang giữa hàng.
  await p.evaluate(() => document.querySelectorAll('.overflow-y-auto').forEach((e) => { e.scrollTop = 0; }));
  await p.waitForTimeout(1500);
});

await browser.close();
console.log('\nXong. Nhớ dọn đơn nháp mang về nếu nó còn nằm lại.');
