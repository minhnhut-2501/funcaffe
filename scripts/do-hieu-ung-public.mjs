/**
 * ĐO hiệu ứng chuyển động trên các trang public — trước và sau khi sửa.
 *
 * Vì sao phải đo trong trình duyệt chứ không đếm chuỗi "hover:" trong mã nguồn:
 * hiệu ứng có thể tới từ class CSS gộp (`lift`, `btn-cafe`, `card-interactive`)
 * chứ không phải class Tailwind viết thẳng ra. Đếm chuỗi trong .tsx cho ra con số
 * THẤP HƠN thực tế — tôi đã tự lừa mình đúng kiểu đó một lần: báo trang liên hệ
 * "0 hiệu ứng" trong khi nó đang dùng `lift`.
 *
 * Chạy: node scripts/do-hieu-ung-public.mjs   (cần dev server :3000)
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const TRANG = [
  ['trang chu', '/'],
  ['tinh nang', '/features'],
  ['bang gia', '/pricing'],
  ['ho tro', '/support'],
  ['lien he', '/contact'],
];

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const dem = async (page) => page.evaluate(() => {
  // BỎ QUA thứ người dùng không nhìn thấy: slide đang ẩn của băng chuyền, liên kết
  // "bỏ qua tới nội dung" chỉ hiện khi focus. Không lọc thì thước đo báo là "ảnh
  // đứng im" cho ba slide mà người xem không hề thấy — con số sai theo hướng bi quan,
  // và mình sẽ đi sửa một thứ vốn đã đúng.
  const nhinThay = (el) => el.offsetParent !== null
    && !el.closest('[aria-hidden="true"]')
    && !el.closest('.sr-only');

  const coChuyenDong = (el) => {
    const s = getComputedStyle(el);
    const t = (s.transitionDuration || '').split(',').some((d) => parseFloat(d) > 0);
    const a = (s.animationName || 'none') !== 'none';
    return t || a;
  };

  // Thứ người ta rê chuột vào: liên kết, nút, và các thẻ nội dung.
  const tuongTac = [...document.querySelectorAll('a, button, [class*="card"], [class*="rounded-2xl"]')]
    .filter(nhinThay);

  // Ảnh: tính cả khung bao ngoài, vì hiệu ứng thường đặt ở khung chứ không ở <img>.
  const anh = [...document.querySelectorAll('img')].filter(nhinThay);

  return {
    tuongTac: tuongTac.length,
    tuongTacCoHieuUng: tuongTac.filter(coChuyenDong).length,
    anh: anh.length,
    anhCoHieuUng: anh.filter((im) => coChuyenDong(im) || (im.parentElement && coChuyenDong(im.parentElement))).length,
  };
});

console.log('\n  trang        | tuong tac co hieu ung | anh co hieu ung');
console.log('  -------------|-----------------------|-----------------');

let tongTT = 0, tongTTco = 0, tongAnh = 0, tongAnhCo = 0;

for (const [ten, duong] of TRANG) {
  const page = await ctx.newPage();
  await page.goto(BASE + duong, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900); // để scroll-reveal chạy xong
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const k = await dem(page);
  tongTT += k.tuongTac; tongTTco += k.tuongTacCoHieuUng;
  tongAnh += k.anh; tongAnhCo += k.anhCoHieuUng;

  const pct = k.tuongTac ? Math.round((k.tuongTacCoHieuUng / k.tuongTac) * 100) : 0;
  console.log(`  ${ten.padEnd(12)} | ${String(k.tuongTacCoHieuUng).padStart(4)}/${String(k.tuongTac).padEnd(4)} (${String(pct).padStart(3)}%)      | ${String(k.anhCoHieuUng).padStart(3)}/${k.anh}`);
  await page.close();
}

console.log('  -------------|-----------------------|-----------------');
console.log(`  TONG         | ${tongTTco}/${tongTT} (${Math.round((tongTTco / tongTT) * 100)}%)      | ${tongAnhCo}/${tongAnh}`);

await browser.close();
