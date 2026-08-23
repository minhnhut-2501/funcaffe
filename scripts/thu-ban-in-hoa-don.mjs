/**
 * M4.7 — kiem BAN IN cua hoa don (A4 + giay nhiet 58/80mm), khong phai ban tren
 * man hinh. Xuat anh va PDF ra thu muc RA de xem bang mat.
 *
 * Chay: node scripts/thu-ban-in-hoa-don.mjs   (can cong 3100 va 8000 dang chay)
 * Chi DOC.
 */
import { chromium } from 'file:///C:/FunCafe/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://localhost:3100';
const API = 'http://localhost:8000/api';
const RA = 'C:/Users/anh90/AppData/Local/Temp/claude/c--FunCafe/38f73f17-efaa-4ed4-82d8-c37f425ed059/scratchpad/in';
mkdirSync(RA, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' })).newPage();
page.on('pageerror', (e) => console.log('[crash]', String(e).slice(0, 200)));
const ok = (dk, chu) => console.log(`  ${dk ? 'DAT ' : 'HONG'}  ${chu}`);

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=email]', { timeout: 30000 });
await page.fill('input[type=email]', 'nphec4007@gmail.com');
await page.fill('input[type=password]', 'Preview@123');
await page.click('button[type=submit]');
await page.waitForFunction(() => location.pathname.startsWith('/user'), null, { timeout: 30000 });

const goiApi = (duong) => page.evaluate(async ({ api, duong }) => {
  const token = localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token');
  const shopId = localStorage.getItem('funcafe.activeShopId');
  const res = await fetch(`${api}${duong.replace('{shop}', shopId)}`, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  return res.json();
}, { api: API, duong });

// Hoa don NHIEU DONG nhat: hoa don ngan khong lo ra loi cat.
const hoaDon = await goiApi('/shops/{shop}/orders?status=paid');
console.log(`Tong so hoa don: ${hoaDon.length}`);
if (!hoaDon.length) { console.log('BO QUA: quan chua co hoa don nao'); await browser.close(); process.exit(0); }

const soDong = (o) => (o.order_details ?? []).reduce((s, d) => s + 1 + (d.order_detail_toppings ?? []).length, 0);
const hdDai = [...hoaDon].sort((a, b) => soDong(b) - soDong(a))[0];
const idHd = hdDai.id ?? hdDai._id;
console.log(`Hoa don dai nhat: ${hdDai.invoice_code} — ${soDong(hdDai)} dong in, ${hdDai.total_amount}d\n`);

// ===== 4.7.1 — vao thang hoa don bang ?hoadon= (duong ma POS dung sau khi thu tien) =====
console.log('4.7.1  Vao thang hoa don tu POS');
await page.goto(`${BASE}/user/invoices?hoadon=${idHd}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelectorAll('.skeleton-sweep, .animate-pulse').length === 0, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

const daMo = await page.locator('.print-area').isVisible().catch(() => false);
ok(daMo, 'hop thoai hoa don TU MO, thu ngan khong phai do lai trong danh sach');
const chuTrongPhieu = daMo ? await page.locator('.print-area').innerText() : '';
ok(chuTrongPhieu.includes(hdDai.invoice_code), `mo DUNG to vua chon (${hdDai.invoice_code})`);
ok(!/[?]hoadon=/.test(page.url()), 'tham so da duoc go khoi thanh dia chi');

// ===== 4.7.3 — doi chieu tung truong voi CSDL =====
console.log('\n4.7.3  Doi chieu ban in voi du lieu trong CSDL');
const tien = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const truong = [
  ['ma hoa don', hdDai.invoice_code],
  ['ma order', hdDai.code],
  ['ten ban', hdDai.table?.name],
  ['tong thanh toan', tien(hdDai.total_amount)],
  ['tam tinh', tien(hdDai.subtotal)],
];
for (const [ten, gt] of truong) {
  if (gt == null || gt === '') { console.log(`  (bo qua "${ten}": CSDL khong co gia tri)`); continue; }
  ok(chuTrongPhieu.includes(String(gt)), `${ten}: "${gt}" co tren ban in`);
}
for (const d of (hdDai.order_details ?? [])) {
  ok(chuTrongPhieu.includes(d.product_name_snapshot), `dong mon "${d.product_name_snapshot}"`);
  for (const t of (d.order_detail_toppings ?? [])) {
    ok(chuTrongPhieu.includes(t.topping_name_snapshot), `  topping "${t.topping_name_snapshot}"`);
  }
}
const nhanBatBuoc = ['PHIẾU TÍNH TIỀN', 'Bàn', 'Ngày', 'Thanh toán', 'Tạm tính', 'Giảm giá', 'TỔNG THANH TOÁN'];
const thieuNhan = nhanBatBuoc.filter(n => !chuTrongPhieu.includes(n));
ok(thieuNhan.length === 0, `du nhan bat buoc${thieuNhan.length ? ' — thieu: ' + thieuNhan.join(', ') : ''}`);
if (hdDai.payment_method === 'cash' && hdDai.cash_received != null) {
  ok(chuTrongPhieu.includes('Tiền khách đưa') && chuTrongPhieu.includes('Tiền thối'), 'co tien khach dua va tien thoi');
}

// ===== 4.7.2 — che do in that: co bi cat khong =====
console.log('\n4.7.2  Che do in — kiem tra bi cat');
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(700);
await page.screenshot({ path: `${RA}/01-che-do-in.png`, fullPage: true });
await page.pdf({ path: `${RA}/02-A4.pdf`, format: 'A4', printBackground: true });

const doPhieu = await page.evaluate(() => {
  const el = document.querySelector('.print-area');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const toCha = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (s.overflow !== 'visible' || s.maxHeight !== 'none') {
      toCha.push(`${(p.className || '').toString().slice(0, 40)} overflow=${s.overflow} maxH=${s.maxHeight}`);
    }
  }
  return {
    cao: Math.round(r.height), rong: Math.round(r.width),
    caoThat: el.scrollHeight, rongThat: el.scrollWidth,
    soChu: (el.innerText || '').replace(/\s+/g, ' ').trim().length,
    toCha,
  };
});
console.log('  kich thuoc phieu:', JSON.stringify(doPhieu));
ok(doPhieu && doPhieu.caoThat <= doPhieu.cao + 2, `khong bi cat theo chieu doc (${doPhieu?.caoThat} <= ${doPhieu?.cao})`);
ok(doPhieu && doPhieu.rongThat <= doPhieu.rong + 2, 'khong bi cat theo chieu ngang');
ok(doPhieu && doPhieu.toCha.length === 0, `khong to cha nao cat noi dung${doPhieu?.toCha.length ? ': ' + doPhieu.toCha.join(' | ') : ''}`);

// ===== 4.7.4 — kho giay nhiet 58 / 80 mm =====
console.log('\n4.7.4  Kho giay nhiet');
for (const kho of ['80mm', '58mm']) {
  await page.pdf({ path: `${RA}/03-${kho}.pdf`, width: kho, height: '300mm', printBackground: true,
                   margin: { top: '2mm', bottom: '2mm', left: '2mm', right: '2mm' } });
  const rongGiayPx = (parseFloat(kho) - 4) / 25.4 * 96;   // tru le hai ben
  await page.setViewportSize({ width: Math.round(rongGiayPx), height: 900 });
  await page.waitForTimeout(500);
  const tran = await page.evaluate(() => {
    const el = document.querySelector('.print-area');
    return el ? { rongThat: el.scrollWidth, rongKhung: Math.round(el.getBoundingClientRect().width),
                  boThan: document.body.scrollWidth, khungThan: document.body.clientWidth } : null;
  });
  ok(tran && tran.boThan <= tran.khungThan + 2,
     `kho ${kho}: noi dung nam gon trong ${Math.round(rongGiayPx)}px (rong that ${tran?.boThan} / khung ${tran?.khungThan})`);
}
await page.setViewportSize({ width: 1440, height: 900 });

console.log(`\nTep in da xuat: ${RA}`);
await browser.close();
