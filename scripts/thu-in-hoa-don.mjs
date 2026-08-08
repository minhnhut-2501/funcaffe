/**
 * Kiem tra ban IN cua hoa don, khong phai ban tren man hinh.
 *
 * Chay: MSYS_NO_PATHCONV=1 OWNER_TOKEN='...' node scripts/thu-in-hoa-don.mjs
 *
 * Dung emulateMedia('print') de trinh duyet ap dung dung bo quy tac @media print,
 * roi xuat ra PDF — chinh la thu may in se nhan. Xem tren man hinh khong phat hien
 * duoc cac loi chi xay ra khi in (bi cat, ra to trang, mat noi dung).
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const B = 'http://localhost:3000';
const RA = process.env.RA_DIR
  || 'C:/Users/anh90/AppData/Local/Temp/claude/c--FunCafe/24dd442d-509d-483b-a7b3-af02e816158f/scratchpad/in';

mkdirSync(RA, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
await ctx.addInitScript(t => localStorage.setItem('funcafe_token', t), process.env.OWNER_TOKEN);
const page = await ctx.newPage();

await page.goto(B + '/user/invoices', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('table tbody tr', { timeout: 30000 });
await page.waitForFunction(
  () => document.querySelectorAll('.animate-pulse').length === 0, null, { timeout: 20000 },
).catch(() => {});
await page.waitForTimeout(2500);

const nut = await page.evaluate(() => [...document.querySelectorAll('table tbody tr:first-child button')]
  .map(b => b.getAttribute('title') || b.getAttribute('aria-label') || '(khong nhan)'));
console.log('  nút trên dòng đầu:', JSON.stringify(nut));

// Mo hoa don co NHIEU MON nhat trong trang dau: hoa don ngan thi khong lo ra loi cat
const dong = page.locator('table tbody tr');
const soDong = await dong.count();
console.log('  số dòng trong trang:', soDong);

// Bam dung NUT IN trong bang (khong phai nut xem): truoc day nut nay goi thang
// window.print() ma chua mo hoa don nao, nen may in nhan mot to trang.
await dong.nth(0).locator('button[title="In hóa đơn"]').click();
await page.waitForTimeout(2000);

const daMo = await page.locator('.print-area').isVisible().catch(() => false);
console.log('  nút In trong bảng có mở đúng hóa đơn không:', daMo ? 'CÓ' : 'KHÔNG');

// 1. Ban tren MAN HINH
await page.screenshot({ path: `${RA}/01-man-hinh.png`, fullPage: true });
console.log('  ✓ ảnh trên màn hình');

// 2. Ban IN — ap dung @media print
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(600);
await page.screenshot({ path: `${RA}/02-che-do-in.png`, fullPage: true });
await page.pdf({ path: `${RA}/03-ban-in.pdf`, format: 'A4', printBackground: true });
console.log('  ✓ ảnh chế độ in + tệp PDF');

// Bao nhieu chu that su hien ra tren ban in?
const chu = await page.evaluate(() => {
  const el = document.querySelector('.print-area');
  if (!el) return { co: false };
  const r = el.getBoundingClientRect();
  return {
    co: true,
    cao: Math.round(r.height),
    rong: Math.round(r.width),
    doDai: (el.innerText || '').replace(/\s+/g, ' ').trim().length,
    dauDong: (el.innerText || '').trim().slice(0, 60),
  };
});
console.log('  .print-area:', JSON.stringify(chu));

// Co bi to cha nao cat khong?
const cat = await page.evaluate(() => {
  const el = document.querySelector('.print-area');
  if (!el) return 'khong co .print-area';
  const ra = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (s.overflow !== 'visible' || s.maxHeight !== 'none') {
      ra.push(`${p.className.toString().slice(0, 46)} | overflow=${s.overflow} maxH=${s.maxHeight}`);
    }
  }
  return ra.length ? ra : 'khong to cha nao cat';
});
console.log('  tổ cha cắt nội dung:', JSON.stringify(cat, null, 2));

await browser.close();
console.log(`\nKết quả: ${RA}`);
