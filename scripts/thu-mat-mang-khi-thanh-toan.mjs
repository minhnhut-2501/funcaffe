/**
 * VIEC 4.6.15 — mat mang giua luc thanh toan roi bam lai.
 *
 * Gia lap toan bo phan hoi cua lenh thanh toan o TANG MANG nen KHONG chot hoa don
 * that nao; don thu nghiem duoc huy o cuoi va script tu kiem lai so don dang mo.
 *
 * Chay: node scripts/thu-mat-mang-khi-thanh-toan.mjs   (can cong 3100 va 8000)
 */
import { chromium } from 'file:///C:/FunCafe/node_modules/playwright-core/index.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://localhost:3100';
const API = 'http://localhost:8000/api';

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await (await browser.newContext()).newPage();
page.on('pageerror', (e) => console.log('[crash]', String(e).slice(0, 200)));

const ok = (dk, chu) => console.log(`  ${dk ? 'DAT ' : 'HONG'}  ${chu}`);

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=email]', { timeout: 30000 });
await page.fill('input[type=email]', 'nphec4007@gmail.com');
await page.fill('input[type=password]', 'Preview@123');
await page.click('button[type=submit]');
await page.waitForFunction(() => location.pathname.startsWith('/user'), null, { timeout: 30000 });

const goiApi = (duong, tuyChon = {}) => page.evaluate(async ({ api, duong, tuyChon }) => {
  const token = localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token');
  const cafeId = localStorage.getItem('funcafe.activeCafeId');
  const res = await fetch(`${api}${duong.replace('{cafe}', cafeId)}`, {
    ...tuyChon,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Content-Type': 'application/json' },
  });
  const chu = await res.text();
  try { return { ma: res.status, than: JSON.parse(chu) }; } catch { return { ma: res.status, than: chu }; }
}, { api: API, duong, tuyChon });

const dsDon = async () => (await goiApi('/cafes/{cafe}/orders?status=active')).than.map(o => o.id ?? o._id);
const truoc = await dsDon();

// --- Dung mot don thu nghiem tren bàn trong ---
await page.goto(BASE + '/user/sales', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelectorAll('.skeleton-sweep').length === 0 && document.body.innerText.includes('BÀN'), null, { timeout: 30000 });
await page.waitForTimeout(1300);

await page.locator('[data-shot=tables] button').filter({ hasText: /Trống/ }).first().click();
await page.waitForTimeout(900);
await page.locator('button:has(p.line-clamp-2)').first().click();
await page.waitForTimeout(1000);
const hop = page.locator('[role=dialog]');
await hop.locator('button').filter({ hasText: /Thêm vào order|Thêm vào giỏ|Thêm món/ }).first().click();
await page.waitForTimeout(1800);

const giua = await dsDon();
const donThu = giua.find(id => !truoc.includes(id));
if (!donThu) { console.log('KHONG TAO DUOC DON THU NGHIEM'); await browser.close(); process.exit(1); }
console.log('Don thu nghiem:', donThu);

// --- Gia lap: may chu DA chot don nhung phan hoi mat ---
let soLanGoiPay = 0;
await page.route('**/orders/*/pay', async (route) => {
  soLanGoiPay += 1;
  if (soLanGoiPay === 1) {
    await route.abort('failed');              // lan 1: mat mang giua chung
  } else {
    await route.fulfill({                      // lan 2: may chu bao da thu tien roi
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Order này đã được thanh toán.' }),
    });
  }
});
// Doc lai don -> tra ve mot don DA THANH TOAN (dung nhu CSDL that se tra)
await page.route(`**/orders/${donThu}`, (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    _id: donThu, code: 'ORD-TEST-0001', invoice_code: 'INV-TEST-0001',
    status: 'paid', payment_method: 'cash', subtotal: 25000, discount_amount: 0,
    total_amount: 25000, cash_received: 50000, change_amount: 25000,
    order_details: [], created_at: new Date().toISOString(), paid_at: new Date().toISOString(),
  }),
}));

// --- Lan bam thu nhat: mat mang ---
await page.locator('button').filter({ hasText: /^Thanh toán$/ }).first().click();
await page.waitForTimeout(1200);
await page.locator('[role=dialog] button').filter({ hasText: /Tiền mặt/ }).first().click();
await page.waitForTimeout(500);
await page.locator('[role=dialog] button').filter({ hasText: /Xác nhận thanh toán/ }).first().click();
await page.waitForTimeout(2500);

const chuSauLan1 = await page.locator('body').innerText();
ok(/[Tt]hanh toán thất bại|thử lại/.test(chuSauLan1), 'lan 1 mat mang -> giao dien BAO LOI, khong tu cho la xong');
ok(await page.locator('[role=dialog]').filter({ hasText: /Xác nhận thanh toán/ }).count() > 0,
   'hop thoai thanh toan van mo de bam lai');

// --- Lan bam thu hai: may chu bao da thu tien ---
await page.locator('[role=dialog] button').filter({ hasText: /Xác nhận thanh toán/ }).first().click();
await page.waitForTimeout(2800);

const chuSauLan2 = await page.locator('body').innerText();
ok(/ghi nhận thanh toán từ lần bấm trước/.test(chuSauLan2), 'lan 2 -> giao dien hieu la giao dich DA THANH CONG');
ok(/INV-TEST-0001/.test(chuSauLan2), 'bien lai lay ma phieu tu may chu (INV-TEST-0001)');
ok(!/Thanh toán thất bại/.test(chuSauLan2.split('ghi nhận thanh toán').pop() ?? ''), 'khong con bao that bai');

const conBanDangPhucVu = await page.locator('[data-shot=tables]').innerText();
console.log('  So ban dang phuc vu tren so do:', (conBanDangPhucVu.match(/Đang phục vụ/g) ?? []).length);

// --- Don dep: don that VAN CHUA duoc thanh toan (moi phan hoi deu la gia lap) ---
await page.unroute('**/orders/*/pay');
await page.unroute(`**/orders/${donThu}`);
const trangThaiThat = (await goiApi(`/cafes/{cafe}/orders/${donThu}`)).than.status;
ok(trangThaiThat === 'active', `don that trong CSDL VAN chua bi thanh toan (status = ${trangThaiThat})`);

await goiApi(`/cafes/{cafe}/orders/${donThu}/cancel`, { method: 'POST', body: '{}' });
const sau = await dsDon();
ok(sau.length === truoc.length, `da don don thu nghiem (${truoc.length} -> ${sau.length} don dang mo)`);

await browser.close();
