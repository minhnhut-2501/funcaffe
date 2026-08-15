/**
 * Trang Doanh thu + Quan ly quan CHAY THAT, doi chieu voi hoa don doc thang tu may chu.
 *
 * Vi sao can bai nay: tu khi hai trang chuyen sang /revenue/summary, khong con ai
 * cong tay tren man hinh de doi chieu duoc nua — so hien ra la so may chu doc noi.
 * Bai nay dung lai cai neo do: no tu keo hoa don tho ve, tu cong, roi so voi tung
 * con so tren giao dien. Lech mot dong la bao.
 *
 * Kiem luon hai thu de vo nhat khi bo danh sach hoa don khoi duong mo trang:
 *  · nut Xuat Excel (nay tu di lay chi tiet luc bam),
 *  · trang Quan ly quan KHONG con quet /orders khi loc theo khoang ngay.
 *
 * Chay:
 *   1. cd backend && php artisan serve            (cong 8000)
 *   2. npm run dev            HOAC  npm run build && npx next start -p 3100
 *   3. node scripts/thu-doanh-thu.mjs             (dat BASE neu dung cong khac)
 *
 * Chi DOC — khong tao, khong sua, khong xoa gi.
 */
import { chromium } from 'file:///C:/FunCafe/node_modules/playwright-core/index.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const API = process.env.API ?? 'http://localhost:8000/api';

let hong = 0;
const ok = (dk, chu) => { if (!dk) hong++; console.log(`  ${dk ? 'DAT ' : 'HONG'}  ${chu}`); };
const tien = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const soTu = (s) => Number(String(s).replace(/[^\d]/g, ''));
const ngayVN = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1500, height: 1300 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => { hong++; console.log('  HONG  [crash]', String(e).slice(0, 300)); });

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=email]', { timeout: 120000 });
// Cho REACT HYDRATE xong roi moi dien. O che do dev, hydrate cham hon han: dien
// truoc khi hydrate thi React ve lai o input va nuot mat gia tri -> may chu nhan
// form rong va tra 422 "The email field is required".
await page.waitForTimeout(3000);
await page.fill('input[type=email]', 'nphec4007@gmail.com');
await page.fill('input[type=password]', 'Preview@123');
await page.waitForFunction(() => document.querySelector('input[type=email]')?.value?.includes('@'), null, { timeout: 30000 });
await page.click('button[type=submit]');
await page.waitForFunction(() => location.pathname.startsWith('/user'), null, { timeout: 120000 });

const goiApi = (duong) => page.evaluate(async ({ api, duong }) => {
  const token = localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token');
  const res = await fetch(api + duong, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
  return res.json();
}, { api: API, duong });

// ===== Nguon chan ly =====
const quan = await goiApi('/cafes');
const donTheoQuan = {};
for (const c of quan) {
  const cid = c.id ?? c._id;
  donTheoQuan[cid] = { ten: c.name, don: await goiApi(`/cafes/${cid}/orders?status=paid`) };
}
const moiDon = Object.entries(donTheoQuan).flatMap(([cid, v]) => v.don.map(o => ({ cafeId: cid, ...o })));
const tongCua = (ds) => ds.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

// Cua so MAC DINH cua trang: 30 ngay gan nhat, tinh ca hom nay.
const homNay = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const tuNgay = new Date(Date.now() - 29 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const trongCuaSo = (o) => { const d = ngayVN(o.paid_at ?? o.created_at); return d >= tuNgay && d <= homNay; };

console.log(`Cua so mac dinh: ${tuNgay} -> ${homNay}`);
console.log(`Tong hoa don da thanh toan: ${moiDon.length} (trong cua so: ${moiDon.filter(trongCuaSo).length})\n`);

// ===== 1. Endpoint /revenue/summary =====
console.log('1) ENDPOINT /revenue/summary');
const sum = await goiApi(`/revenue/summary?from=${tuNgay}&to=${homNay}`);
const tayGop = tongCua(moiDon.filter(trongCuaSo));
ok(Number(sum.total) === tayGop, `gop moi quan: ${tien(sum.total)} = cong tay ${tien(tayGop)}`);
ok(Number(sum.count) === moiDon.filter(trongCuaSo).length, `so hoa don: ${sum.count} = ${moiDon.filter(trongCuaSo).length}`);

for (const [cid, v] of Object.entries(donTheoQuan)) {
  const rieng = await goiApi(`/revenue/summary?from=${tuNgay}&to=${homNay}&cafe_id=${cid}`);
  const that = tongCua(v.don.filter(trongCuaSo));
  ok(Number(rieng.total) === that, `  "${v.ten}": ${tien(rieng.total)} = ${tien(that)}`);
}

// Tung moc ngay
let ngayLech = 0;
const tayTheoNgay = {};
for (const o of moiDon.filter(trongCuaSo)) {
  const k = ngayVN(o.paid_at ?? o.created_at);
  tayTheoNgay[k] = (tayTheoNgay[k] ?? 0) + Number(o.total_amount ?? 0);
}
for (const [k, v] of Object.entries(sum.by_day ?? {})) {
  if (Number(v) !== (tayTheoNgay[k] ?? 0)) { ngayLech++; console.log(`     ngay ${k}: ${tien(v)} vs ${tien(tayTheoNgay[k] ?? 0)}`); }
}
ok(ngayLech === 0, `bang theo ngay khong lech moc nao (${Object.keys(sum.by_day ?? {}).length} moc)`);

// ===== 2. Trang Doanh thu =====
console.log('\n2) TRANG DOANH THU (mac dinh 30 ngay)');
const batDau = Date.now();
await page.goto(BASE + '/user/revenue', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => /Doanh thu hôm nay/.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(4000);
console.log(`   thoi gian den khi co so: ${Date.now() - batDau}ms`);

const docSau = (chu, nhan) => {
  const m = chu.match(new RegExp(nhan + '[^\\d]{0,30}([\\d.]+)\\s*₫'));
  return m ? soTu(m[1]) : null;
};

const oPhamVi = page.locator('select').first();
const coPhamVi = await oPhamVi.count();
const cacPhamVi = coPhamVi ? (await oPhamVi.locator('option').allInnerTexts()).map(t => t.trim()) : ['(mot quan)'];
console.log('   pham vi:', JSON.stringify(cacPhamVi));

for (const nhan of cacPhamVi) {
  if (coPhamVi) { await oPhamVi.selectOption({ label: nhan }); await page.waitForTimeout(2500); }
  const chu = await page.locator('main').innerText();
  const uiTien = docSau(chu, 'Doanh thu');
  const mHd = chu.match(/·\s*(\d+)\s*hóa đơn/);
  const uiHd = mHd ? Number(mHd[1]) : null;

  const laTatCa = /Tất cả quán/.test(nhan);
  const ten = nhan.replace(/\s*\(\d+\)\s*$/, '').trim();
  const tap = (laTatCa || !coPhamVi ? moiDon : (Object.values(donTheoQuan).find(v => v.ten === ten)?.don ?? []))
    .filter(trongCuaSo);

  ok(uiTien === tongCua(tap) && uiHd === tap.length,
     `"${nhan}": man hinh ${tien(uiTien ?? 0)} d / ${uiHd} hd — cong tay ${tien(tongCua(tap))} d / ${tap.length} hd`);
}

// Bieu do co ve khong
const soCot = await page.locator('svg .recharts-layer').count().catch(() => 0);
ok(soCot > 0, `bieu do co ve (${soCot} lop svg)`);

// Top mon
const chuCuoi = await page.locator('main').innerText();
ok(/Top 5 món bán chạy/.test(chuCuoi), 'khoi "Top 5 mon ban chay" hien ra');
ok(!/Không có dữ liệu trong khoảng đã lọc/.test(chuCuoi) || tongCua(moiDon.filter(trongCuaSo)) === 0,
   'top mon co du lieu (khong roi vao trang thai rong sai)');

// ===== 3. Nut Xuat Excel =====
console.log('\n3) NUT XUAT EXCEL (tai chi tiet theo yeu cau)');
try {
  const cho = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: /Xuất Excel/ }).click();
  const tep = await cho;
  const ten = tep.suggestedFilename();
  ok(/\.xlsx$/.test(ten), `tai duoc tep: ${ten}`);
} catch (e) {
  ok(false, 'khong tai duoc tep Excel: ' + String(e).slice(0, 200));
}

// ===== 4. TRANG QUAN LY QUAN =====
console.log('\n4) TRANG QUAN LY QUAN');
await page.goto(BASE + '/user/cafe', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => /Tổng doanh thu/.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(4000);
let chuQ = await page.locator('main').innerText();
const tongMoiThoi = tongCua(moiDon);
ok(docSau(chuQ, 'Tổng doanh thu') === tongMoiThoi,
   `mac dinh (toan bo thoi gian): ${tien(docSau(chuQ, 'Tổng doanh thu') ?? 0)} = ${tien(tongMoiThoi)}`);

// Chon khoang ngay -> phai di qua /revenue/summary
const goiSummary = [];
page.on('request', (r) => { if (r.url().includes('/revenue/summary')) goiSummary.push(r.url()); });
const goiOrders = [];
page.on('request', (r) => { if (/\/orders\?/.test(r.url())) goiOrders.push(r.url()); });

const oNgay = page.getByRole('button', { name: /Chọn khoảng ngày|thời gian/ }).first();
if (await oNgay.count()) {
  await oNgay.click();
  await page.waitForTimeout(600);
  const nut30 = page.getByRole('button', { name: /30 ngày qua/ }).first();
  if (await nut30.count()) {
    await nut30.click();
    await page.waitForTimeout(500);
    // Chon preset moi chi dat NHAP; phai bam "Ap dung" thi onChange moi ban ra.
    await page.getByRole('button', { name: /^Áp dụng$/ }).first().click();
    await page.waitForTimeout(4000);
    chuQ = await page.locator('main').innerText();
    // Co loc thi nhan doi thanh "Doanh thu trong khoang" (khong con la tong toan thoi gian).
    const uiKhoang = docSau(chuQ, 'Doanh thu trong khoảng');
    ok(uiKhoang === tayGop, `sau khi loc 30 ngay: ${tien(uiKhoang ?? 0)} = cong tay ${tien(tayGop)}`);
    ok(goiSummary.length > 0, `co goi /revenue/summary (${goiSummary.length} lan)`);
    ok(goiOrders.length === 0, `KHONG con quet /orders (${goiOrders.length} lan)`);
  } else {
    console.log('  (bo qua: khong thay nut "30 ngay" trong bo chon)');
  }
} else {
  console.log('  (bo qua: khong thay bo chon ngay)');
}

console.log(`\n${hong === 0 ? 'TAT CA DAT' : hong + ' MUC HONG'}`);
await browser.close();
process.exit(hong === 0 ? 0 : 1);
