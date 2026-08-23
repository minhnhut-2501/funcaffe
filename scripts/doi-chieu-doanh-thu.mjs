/**
 * VIEC 5.5.1 — doi chieu doanh thu o NAM NOI. CHAY LAI moi khi dung vao ma tinh tien.
 *
 * Chay:
 *   1. cd backend && php artisan serve        (cong 8000)
 *   2. npm run build && npx next start -p 3100
 *   3. node scripts/doi-chieu-doanh-thu.mjs
 *
 * Dang chay `npm run dev` san o cong 3000 thi khoi dung buoc 2:
 *   BASE=http://localhost:3000 node scripts/doi-chieu-doanh-thu.mjs
 *
 * Chi DOC — khong tao, khong sua, khong xoa gi. An toan chay tren du lieu that.
 */
import { chromium } from 'file:///C:/FunCafe/node_modules/playwright-core/index.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3100';
const API = process.env.API ?? 'http://localhost:8000/api';

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1300 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' })).newPage();
page.on('pageerror', (e) => console.log('[crash]', String(e).slice(0, 200)));
const ok = (dk, chu) => console.log(`  ${dk ? 'DAT ' : 'HONG'}  ${chu}`);
const tien = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const soTu = (s) => Number(String(s).replace(/[^\d]/g, ''));
/** Ngay theo GIO VIET NAM cua mot moc ISO (may chu tra ve chuoi UTC). */
const ngayVN = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=email]', { timeout: 30000 });
// Cho React hydrate xong roi moi dien. O che do dev, dien truoc khi hydrate thi
// React ve lai o input va nuot mat gia tri — may chu nhan form rong, tra 422.
await page.waitForTimeout(3000);
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

// ===== NGUON CHAN LY: hoa don doc thang tu may chu =====
const quan = await goiApi('/shops');
const donTheoQuan = {};
for (const c of quan) {
  const cid = c.id ?? c._id;
  donTheoQuan[cid] = { ten: c.name, don: await goiApi(`/shops/${cid}/orders?status=paid`) };
}
const moiDon = Object.entries(donTheoQuan).flatMap(([cid, v]) => v.don.map(o => ({ shopId: cid, ...o })));
const tongCua = (ds) => ds.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

console.log(`Quan: ${quan.length}. Tong hoa don da thanh toan: ${moiDon.length}\n`);
console.log('NGUON CHAN LY (may chu):');
for (const [cid, v] of Object.entries(donTheoQuan)) {
  console.log(`  ${v.ten}: ${tien(tongCua(v.don))} d — ${v.don.length} hoa don`);
}
const tongMoiQuan = tongCua(moiDon);
console.log(`  => GOP: ${tien(tongMoiQuan)} d — ${moiDon.length} hoa don\n`);

// ===== 1. /revenue/overview =====
console.log('1) DOANH THU TONG DA QUAN (/revenue/overview)');
const ov = await goiApi('/revenue/overview');
ok(Number(ov.total) === tongMoiQuan, `overview.total = ${tien(ov.total)} = tong hoa don moi quan`);

const homNayVN = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const thangNayVN = homNayVN.slice(0, 7);
const tayHomNay = tongCua(moiDon.filter(o => ngayVN(o.paid_at ?? o.created_at) === homNayVN));
const tayThangNay = tongCua(moiDon.filter(o => ngayVN(o.paid_at ?? o.created_at).startsWith(thangNayVN)));
ok(Number(ov.today) === tayHomNay, `overview.today = ${tien(ov.today)} = cong tay hom nay (${homNayVN})`);
ok(Number(ov.this_month) === tayThangNay, `overview.this_month = ${tien(ov.this_month)} = cong tay thang ${thangNayVN}`);

for (const hang of ov.shops ?? []) {
  const that = tongCua(donTheoQuan[hang.shop_id]?.don ?? []);
  ok(Number(hang.total) === that, `  tung quan: "${hang.shop_name}" ${tien(hang.total)} = ${tien(that)}`);
}

let thangLech = 0;
const tayTheoThang = {};
for (const o of moiDon) {
  const k = ngayVN(o.paid_at ?? o.created_at).slice(0, 7);
  tayTheoThang[k] = (tayTheoThang[k] ?? 0) + Number(o.total_amount ?? 0);
}
for (const [k, v] of Object.entries(ov.revenue_by_month ?? {})) {
  if (Number(v) !== (tayTheoThang[k] ?? 0)) {
    thangLech += 1;
    console.log(`     thang ${k}: overview ${tien(v)} vs cong tay ${tien(tayTheoThang[k] ?? 0)}`);
  }
}
ok(thangLech === 0, `bang theo thang khong lech thang nao (${Object.keys(ov.revenue_by_month ?? {}).length} thang)`);

// ===== 2. TRANG QUAN LY QUAN =====
console.log('\n2) TRANG QUAN LY QUAN (tat ca quan, toan bo thoi gian)');
await page.goto(BASE + '/user/shop', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => /Tổng doanh thu/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);
const chuQuan = await page.locator('main').innerText();
const docSau = (chu, nhan) => {
  const m = chu.match(new RegExp(nhan + '[^\\d]{0,30}([\\d.]+)\\s*₫'));
  return m ? soTu(m[1]) : null;
};
const uiTongQuan = docSau(chuQuan, 'Tổng doanh thu');
const uiHomNay = docSau(chuQuan, 'Hôm nay');
const uiThangNay = docSau(chuQuan, 'Tháng này');
console.log(`   Tổng doanh thu ${tien(uiTongQuan ?? 0)} | Hôm nay ${tien(uiHomNay ?? 0)} | Tháng này ${tien(uiThangNay ?? 0)}`);
ok(uiTongQuan === tongMoiQuan, `tong = may chu (${tien(uiTongQuan ?? 0)} vs ${tien(tongMoiQuan)})`);
ok(uiHomNay === tayHomNay, `hom nay = cong tay theo gio VN (${tien(uiHomNay ?? 0)} vs ${tien(tayHomNay)})`);
ok(uiThangNay === tayThangNay, `thang nay = cong tay theo gio VN (${tien(uiThangNay ?? 0)} vs ${tien(tayThangNay)})`);

// Bang so sanh tung quan tren chinh trang do
for (const [cid, v] of Object.entries(donTheoQuan)) {
  const that = tongCua(v.don);
  ok(chuQuan.includes(tien(that)), `  bang so sanh co dong "${v.ten}" = ${tien(that)} d`);
}

// ===== 3. TRANG DOANH THU — tung pham vi =====
console.log('\n3) TRANG DOANH THU (mac dinh 30 ngay gan nhat)');
const cuaSoTu = new Date(Date.now() - 29 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const trongCuaSoMacDinh = (o) => {
  const d = ngayVN(o.paid_at ?? o.created_at);
  return d >= cuaSoTu && d <= homNayVN;
};
await page.goto(BASE + '/user/revenue', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => /Doanh thu hôm nay/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);

const oPhamVi = page.locator('select').first();
const cacPhamVi = await oPhamVi.locator('option').allInnerTexts();
console.log('   pham vi chon duoc:', JSON.stringify(cacPhamVi.map(t => t.trim())));

for (const nhan of cacPhamVi.map(t => t.trim())) {
  await oPhamVi.selectOption({ label: nhan });
  await page.waitForTimeout(1600);
  const chu = await page.locator('main').innerText();
  const uiDoanhThu = docSau(chu, 'Doanh thu');
  const mSoHd = chu.match(/(\d+)\s*hóa đơn/);
  const uiSoHd = mSoHd ? Number(mSoHd[1]) : null;

  // Tap hoa don tuong ung voi pham vi dang chon, GIOI HAN trong cua so mac dinh
  // cua trang: 30 ngay gan nhat, tinh ca hom nay.
  //
  // Truoc day cho nay so voi TOAN BO lich su, va no dung — hoi trang con mac dinh
  // "toan bo thoi gian". Tu khi trang doi sang mac dinh 30 ngay thi phep so ay bao
  // LECH o moi lan chay, trong khi ca hai ben deu dang dung. Mot bai kiem bao dong
  // gia deu dan thi chang bao lau se khong con ai doc nua.
  const laTatCa = /Tất cả quán/.test(nhan);
  const tenQuan = nhan.replace(/\s*\(\d+\)\s*$/, '').trim();
  const tap = (laTatCa
    ? moiDon
    : (Object.values(donTheoQuan).find(v => v.ten === tenQuan)?.don ?? [])
  ).filter(trongCuaSoMacDinh);
  const that = tongCua(tap);

  ok(uiDoanhThu === that && uiSoHd === tap.length,
     `"${nhan}": man hinh ${tien(uiDoanhThu ?? 0)} d / ${uiSoHd} hoa don — may chu ${tien(that)} d / ${tap.length} hoa don`);
}

// Doanh thu HOM NAY tren trang nay
const chuDT = await page.locator('main').innerText();
const uiHomNayDT = docSau(chuDT, 'Doanh thu hôm nay');
ok(uiHomNayDT === tayHomNay, `"Doanh thu hôm nay" = cong tay theo gio VN (${tien(uiHomNayDT ?? 0)} vs ${tien(tayHomNay)})`);

// ===== 4. TRANG HOA DON =====
console.log('\n4) TRANG HOA DON (quan dang chon)');
const quanDangChon = await page.evaluate(() => localStorage.getItem('funcafe.activeShopId'));
const donQuanDangChon = donTheoQuan[quanDangChon]?.don ?? [];
await page.goto(BASE + '/user/invoices', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => /INV-/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);
const chuHD = await page.locator('main').innerText();
const mTongSo = chuHD.match(/(\d+)\s*(?:hóa đơn|kết quả)/i);
console.log('   dong dau bang:', (chuHD.match(/INV-\d{8}-\d{4}/g) ?? []).slice(0, 3).join(', '));
const mPhanTrang = chuHD.match(/Trang \d+\s*\/\s*(\d+)/);
console.log(`   phan trang: ${mPhanTrang ? mPhanTrang[0] : '(khong thay)'} | tong so doc duoc: ${mTongSo ? mTongSo[1] : '(khong thay)'}`);
if (mTongSo) {
  ok(Number(mTongSo[1]) === donQuanDangChon.length,
     `so hoa don cua quan dang chon = may chu (${mTongSo[1]} vs ${donQuanDangChon.length})`);
}

// ===== 5. QUAN TRI =====
console.log('\n5) DOANH THU HE THONG CUA QUAN TRI');
console.log('   Tinh TIEN GOI DICH VU cua moi tai khoan, khong tinh tien ban hang cua quan.');
console.log('   => Con so nay KHAC bon noi tren, va do la chenh lech GIAI THICH DUOC.');

await browser.close();
