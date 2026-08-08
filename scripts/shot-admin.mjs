/**
 * Chụp các trang quản trị để đối chiếu sau khi sửa.
 * Chạy: MSYS_NO_PATHCONV=1 node scripts/shot-admin.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync, mkdtempSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const B = 'http://localhost:3000';
const EMAIL = 'admin.preview@funcafe.local';
const ADMIN_PASS = process.env.ADMIN_PASS;
const PASS = ADMIN_PASS;
// Mat khau KHONG viet cung trong ma nguon — kho nay cong khai.
// Chay:  ADMIN_PASS='...' node scripts/<ten>.mjs
if (!ADMIN_PASS) {
  console.error('Thieu ADMIN_PASS. Chay lai kem bien moi truong ADMIN_PASS truoc lenh node.');
  process.exit(1);
}

const DEST = 'design-shots/admin-audit';
const OUT = mkdtempSync(join(tmpdir(), 'funcafe-admin-'));

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 160)));

// Đăng nhập, có thử lại: bấm trước khi React hydrate xong thì nút không có handler
let loggedIn = false;
for (let i = 1; i <= 4 && !loggedIn; i++) {
  await page.goto(B + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASS);
  await page.click('button[type=submit]');
  loggedIn = await page.waitForFunction(
    () => !!(localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token')),
    null, { timeout: 15000 },
  ).then(() => true).catch(() => false);
  if (!loggedIn) console.log(`  ...đăng nhập chưa được, thử lại (${i}/4)`);
}
if (!loggedIn) { console.log('! KHÔNG đăng nhập được — dừng'); await browser.close(); process.exit(1); }
console.log('đã đăng nhập, URL:', page.url());

const shoot = async (path, name, ready) => {
  for (let i = 0; i < 3; i++) {
    await page.goto(B + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const ok = await page.waitForFunction(
      () => (document.querySelector('main')?.innerText || '').length > 200,
      null, { timeout: 20000 },
    ).then(() => true).catch(() => false);
    // Bị đá về /login thì nội dung vẫn dài — phải kiểm URL, không thì chụp nhầm trang đăng nhập
    if (!ok || page.url().includes('/login')) continue;
    if (ready) await page.waitForSelector(ready, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('  ✓', name);
    return true;
  }
  console.log('  ! không mở được', path);
  return false;
};

await shoot('/admin/dashboard', 'dashboard', '.recharts-surface');
await shoot('/admin/payments', 'payments', 'table');
await shoot('/admin/revenue', 'revenue', '.recharts-surface');
await shoot('/admin/contacts', 'contacts', 'table');

// Mở modal chi tiết tin nhắn (nút mắt ở dòng đầu)
const eye = page.locator('table tbody tr button[title="Xem chi tiết và trả lời"]').first();
if (await eye.isVisible().catch(() => false)) {
  await eye.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/contact-detail.png` });
  console.log('  ✓ contact-detail');
} else {
  console.log('  ! không thấy nút xem chi tiết');
}

await browser.close();

mkdirSync(DEST, { recursive: true });
for (const f of readdirSync(OUT)) copyFileSync(join(OUT, f), join(DEST, f));
console.log(`đã lưu ${readdirSync(OUT).length} ảnh vào ${DEST}`);
