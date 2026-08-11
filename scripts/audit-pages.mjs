/**
 * Rà soát toàn bộ trang: lỗi console, lỗi mạng, trang trắng, tràn ngang.
 * Chạy: MSYS_NO_PATHCONV=1 node scripts/audit-pages.mjs   (cần dev server :3000)
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
// Mặc định soi bản BUILD (next start) ở :3100 — dev server biên dịch từng trang khi
// truy cập nên điều hướng nhanh sẽ dính lỗi chunk giả, không phải lỗi của trang.
const B = process.env.AUDIT_BASE || 'http://localhost:3100';

const PUBLIC = ['/', '/features', '/pricing', '/support', '/contact', '/login', '/register', '/forgot-password', '/khong-ton-tai'];
const USER = ['/user/dashboard', '/user/sales', '/user/menu', '/user/toppings', '/user/tables', '/user/invoices', '/user/revenue', '/user/cafe', '/user/profile', '/user/subscription'];
const ADMIN = ['/admin/dashboard', '/admin/users', '/admin/payments', '/admin/revenue', '/admin/reviews', '/admin/packages', '/admin/contacts'];

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

async function sweep(label, paths, creds) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const bucket = { errors: [], net: [] };
  page.on('console', (m) => { if (m.type() === 'error') bucket.errors.push(m.text().slice(0, 150)); });
  page.on('pageerror', (e) => bucket.errors.push('[crash] ' + String(e).slice(0, 150)));
  page.on('response', (r) => { if (r.status() >= 400) bucket.net.push(`${r.status()} ${r.url().replace(B, '').slice(0, 90)}`); });

  if (creds) {
    await page.goto(B + '/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.fill('input[type=email]', creds[0]);
    await page.fill('input[type=password]', creds[1]);
    await page.click('button[type=submit]');
    const ok = await page
      .waitForFunction(() => !!(localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token')), null, { timeout: 15000 })
      .then(() => true).catch(() => false);
    if (!ok) { console.log(`\n## ${label}: KHÔNG ĐĂNG NHẬP ĐƯỢC — bỏ qua`); await ctx.close(); return; }
  }

  console.log(`\n## ${label}`);
  for (const p of paths) {
    bucket.errors.length = 0; bucket.net.length = 0;
    // Chờ React mount thật (body có chữ) rồi mới chờ hết skeleton — thử lại 3 lần,
    // vì goto liên tiếp đôi khi bắt được lúc trang chưa kịp hydrate.
    for (let i = 0; i < 3; i++) {
      await page.goto(B + p, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const mounted = await page
        .waitForFunction(() => document.body.innerText.trim().length > 50, null, { timeout: 20000 })
        .then(() => true).catch(() => false);
      if (mounted) break;
      await page.waitForTimeout(1000);
    }
    // Khung xương của dự án dùng lớp `.skeleton-sweep` (LoadingSkeleton), không phải
    // `.animate-pulse`. Chờ nhầm lớp = không chờ gì cả: công cụ đo lúc trang mới có
    // mỗi tiêu đề rồi báo "NỘI DUNG NGẮN" cho những trang gọi nhiều API nhất.
    await page.waitForFunction(() => document.querySelectorAll('.skeleton-sweep, .animate-pulse').length === 0, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => ({
      len: (document.querySelector('main')?.innerText || document.body.innerText || '').trim().length,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      url: location.pathname,
    }));
    const flags = [];
    if (m.len < 200) flags.push(`NỘI DUNG NGẮN (${m.len} ký tự)`);
    if (m.over > 2) flags.push(`TRÀN NGANG ${m.over}px`);
    if (m.url !== p && !p.startsWith('/khong-ton-tai')) flags.push(`bị chuyển tới ${m.url}`);
    // Ảnh ngoài (pravatar) hỏng khi offline — không phải lỗi của mình
    const net = bucket.net.filter((x) => !x.includes('pravatar'));
    const errs = [...new Set(bucket.errors)].filter((e) => !e.includes('pravatar') && !e.includes('Failed to load resource'));
    const bad = flags.length || net.length || errs.length;
    console.log(`${bad ? '!!' : 'OK'} ${p}`);
    for (const f of flags) console.log(`     · ${f}`);
    for (const n of [...new Set(net)]) console.log(`     · mạng: ${n}`);
    for (const e of errs) console.log(`     · console: ${e}`);
  }
  await ctx.close();
}

await sweep('CÔNG KHAI', PUBLIC, null);
await sweep('CHỦ QUÁN', USER, ['nphec4007@gmail.com', 'Preview@123']);
await sweep('QUẢN TRỊ', ADMIN, ['admin.preview@funcafe.local', process.env.ADMIN_PASS]);
await browser.close();
