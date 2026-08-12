/**
 * M5.2 — kiem NUT XUAT EXCEL o trang Doanh thu: bam that, bat tep tai ve, mo lai
 * bang exceljs de doi chieu so dong / kieu du lieu voi API.
 *
 * Chay: node scripts/thu-xuat-excel.mjs   (can cong 3100 va 8000 dang chay)
 * Chi DOC — khong tao, sua hay xoa ban ghi nao.
 */
import { chromium } from 'file:///C:/FunCafe/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';
import ExcelJS from 'file:///C:/FunCafe/node_modules/exceljs/lib/exceljs.nodejs.js';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE ?? "http://localhost:3100";
const RA = 'C:/Users/anh90/AppData/Local/Temp/claude/c--FunCafe/38f73f17-efaa-4ed4-82d8-c37f425ed059/scratchpad/excel';
mkdirSync(RA, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', acceptDownloads: true });
const page = await ctx.newPage();

// BAT MOI TIENG KEU CUA TRANG. Nut xuat file bat loi rat rong (`catch {}` roi hien
// mot cau chung), nen ly do that chi con o console — khong nghe thi khong biet gi.
const loi = [];
page.on('pageerror', (e) => loi.push('[crash] ' + String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') loi.push('[console] ' + m.text().slice(0, 300)); });
page.on('requestfailed', (r) => loi.push(`[mang] ${r.failure()?.errorText} ${r.url().slice(0, 160)}`));
page.on('response', (r) => { if (r.status() >= 400) loi.push(`[http ${r.status()}] ${r.url().slice(0, 160)}`); });

const ok = (dk, chu) => console.log(`  ${dk ? 'DAT ' : 'HONG'}  ${chu}`);

/**
 * Dang nhap — CHO HYDRATE XONG roi moi go.
 *
 * O che do dev, React gan vao DOM cham hon han ban dung san. Go vao o nhap truoc
 * luc do thi chu hien tren man hinh nhung state cua React van rong, va may chu tra
 * "The email field is required" — trong khi nhin bang mat thi form da dien day du.
 * Doc nguoc gia tri o o nhap la cach duy nhat chac chan chu da vao den React.
 */
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=email]', { timeout: 60000 });
// CHO REACT GAN XONG roi moi go. Doc nguoc gia tri o o nhap KHONG kiem duoc dieu
// nay: `fill()` dat thang vao DOM nen doc lai luc nao cung thay chu, ke ca khi
// React chua he nghe. Luc do form gui di {"email":"","password":""} — nhin bang
// mat thi form day du, con may chu bao "thieu email". O che do dev hydrate cham
// hon han ban dung san nen bay nay chi lo ra o day.
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(2500);
await page.fill('input[type=email]', 'nphec4007@gmail.com');
await page.fill('input[type=password]', 'Preview@123');
await page.click('button[type=submit]');
await page.waitForFunction(() => location.pathname.startsWith('/user'), null, { timeout: 60000 });

await page.goto(BASE + '/user/revenue', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelectorAll('.skeleton-sweep, .animate-pulse').length === 0, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);

const nut = page.getByRole('button', { name: /Xuất Excel/i });
ok(await nut.isVisible().catch(() => false), 'thay nut "Xuat Excel"');

console.log('\nBam nut va cho tep tai ve...');
let tep = null;
try {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    nut.click(),
  ]);
  tep = `${RA}/${dl.suggestedFilename()}`;
  await dl.saveAs(tep);
  ok(true, `tai ve duoc: ${dl.suggestedFilename()}`);
} catch (e) {
  ok(false, 'KHONG tai ve duoc tep nao — ' + String(e.message).slice(0, 120));
}

// Cau bao loi tren man hinh (neu co) noi len rang nhanh catch da chay.
const toast = await page.locator('text=Xuất file thất bại').isVisible().catch(() => false);
if (toast) ok(false, 'trang hien "Xuat file that bai"');

if (tep) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tep);
  const ws = wb.worksheets[0];
  console.log(`\nDoc lai tep: sheet "${ws.name}", ${ws.rowCount} dong (ke ca dong tieu de)`);

  const tieuDe = ws.getRow(1).values.slice(1);
  console.log('  Cot:', tieuDe.join(' | '));
  ok(tieuDe.length >= 5, 'du cot');

  const dong2 = ws.getRow(2);
  const oTien = dong2.getCell(tieuDe.indexOf('Số tiền') + 1);
  const oNgay = dong2.getCell(tieuDe.indexOf('Ngày thanh toán') + 1);
  ok(typeof oTien.value === 'number', `cot "So tien" la KIEU SO (dang la ${typeof oTien.value})`);
  ok(oNgay.value instanceof Date, `cot "Ngay thanh toan" la KIEU NGAY (dang la ${typeof oNgay.value})`);

  const pt = dong2.getCell(tieuDe.indexOf('Phương thức') + 1).value;
  ok(!/^(cash|vietqr|bank_transfer|transfer)$/.test(String(pt)), `phuong thuc la nhan tieng Viet, khong phai ma tho ("${pt}")`);

  const coDauTV = ws.getRow(2).values.some((v) => /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(String(v)));
  ok(coDauTV, 'tieng Viet co dau doc lai duoc, khong loi phong');
}

if (loi.length) {
  console.log('\n=== TIENG KEU CUA TRANG ===');
  [...new Set(loi)].forEach((d) => console.log('  ' + d));
} else {
  console.log('\nKhong co loi nao tren console / mang.');
}

console.log(`\nTep da luu o: ${RA}`);
await browser.close();
