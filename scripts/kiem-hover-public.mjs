/**
 * Kiểm HIỆU ỨNG RÊ CHUỘT thật sự đổi giá trị, không chỉ "có class".
 *
 * Vì sao không tin việc phần tử mang class là đủ: đã bắt được đúng một lỗi kiểu đó —
 * `.lift` khai `@apply transition-transform transition-shadow`, hai lớp Tailwind cùng
 * ghi vào `transition-property` nên cái sau xoá cái trước; rồi `.reveal` đứng sau lại
 * ghi đè tiếp. Class vẫn nằm nguyên trên DOM, `lift:hover` vẫn nhấc phần tử lên, chỉ
 * là nhấc GIẬT MỘT PHÁT không có chuyển tiếp nào. Nhìn mã nguồn không thấy được.
 *
 * Nên bài này đo giá trị TÍNH TOÁN trước và sau khi rê chuột.
 *
 * Chạy: node scripts/kiem-hover-public.mjs   (cần dev server :3000)
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3000';

const cong = { dat: 0, hong: 0 };
const ok = (dieuKien, chu, them = '') => {
  cong[dieuKien ? 'dat' : 'hong']++;
  console.log(`  ${dieuKien ? 'DAT ' : 'HONG'}  ${chu}${them ? ' — ' + them : ''}`);
};

/** Các mốc cần kiểm: [trang, tên, bộ chọn, thuộc tính phải ĐỔI khi rê chuột] */
const MOC = [
  ['/', 'Anh chup ung dung (AppShot)', '.anh-noi', ['translate', 'boxShadow']],
  ['/', 'The anh nho noi canh anh lon', '.anh-noi-nho', ['translate']],
  ['/', 'O logo tren thanh dieu huong', 'header a[aria-label] span span', ['rotate', 'scale']],
  ['/', 'Mui ten trong lien ket "Xem goi"', '.link-mui-ten svg', ['translate']],
  ['/pricing', 'The goi dich vu', '.lift.relative.rounded-2xl', ['translate', 'boxShadow']],
  ['/contact', 'The thong tin lien he', '.reveal.lift', ['translate', 'boxShadow']],
];

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const [duong, ten, chon, thuocTinh] of MOC) {
  const page = await ctx.newPage();
  await page.goto(BASE + duong, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(700);

  const el = page.locator(chon).first();
  if (await el.count() === 0) {
    ok(false, ten, `khong tim thay "${chon}"`);
    await page.close();
    continue;
  }

  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const doc = () => el.evaluate((n, tt) => {
    const s = getComputedStyle(n);
    const r = {};
    for (const t of tt) r[t] = s[t];
    r.__transition = s.transitionProperty;
    return r;
  }, thuocTinh);

  const truoc = await doc();
  // Rê chuột vào CHÍNH phần tử cha khi mốc là phần tử con (mũi tên, ô logo).
  await (chon.includes(' ') ? page.locator(chon.split(' ').slice(0, -1).join(' ')).first() : el).hover();
  await page.waitForTimeout(800);
  const sau = await doc();

  const doi = thuocTinh.filter((t) => truoc[t] !== sau[t]);
  ok(doi.length === thuocTinh.length, ten,
    doi.length ? `doi: ${doi.join(', ')}` : `KHONG doi gi (truoc=${JSON.stringify(truoc)})`);

  // Đổi giá trị mà không nằm trong danh sách chuyển tiếp = nhảy giật.
  const coChuyenTiep = thuocTinh.every((t) => {
    const ten2 = t === 'boxShadow' ? 'box-shadow' : t;
    return (sau.__transition || '').includes(ten2) || (sau.__transition || '').includes('all');
  });
  ok(coChuyenTiep, `  └ co chuyen tiep muot, khong nhay giat`,
    coChuyenTiep ? '' : `transition-property = "${sau.__transition}"`);

  await page.close();
}

await browser.close();
console.log(`\nTONG: ${cong.dat} dat · ${cong.hong} hong`);
process.exit(cong.hong > 0 ? 1 : 0);
