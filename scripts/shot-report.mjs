/**
 * Chụp toàn bộ ảnh giao diện dùng trong báo cáo DATN.
 *
 * Chạy:  MSYS_NO_PATHCONV=1 node scripts/shot-report.mjs
 * Cần:   máy chủ Next đang chạy ở :3000 và Laravel ở :8000.
 *
 * QUY TẮC CHỤP (bám theo yêu cầu của báo cáo):
 *   1. Chờ tải xong HẲN mới chụp — khung xám LoadingSkeleton biến mất, mọi thẻ ảnh
 *      báo đã tải, biểu đồ vẽ xong, hiệu ứng stagger/slider chạy hết.
 *   2. Chụp trọn trang (fullPage), không chỉ phần nhìn thấy.
 *   3. Không dàn dựng. Chỉ mở hộp thoại ở những mục vốn mô tả hộp thoại.
 *
 * Token của chủ quán truyền qua biến môi trường OWNER_TOKEN để không ghi vào mã nguồn.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const B = 'http://localhost:3000';
const OUT = 'doc/report-shots';

const ADMIN_EMAIL = 'admin.preview@funcafe.local';
const ADMIN_PASS = process.env.ADMIN_PASS;
// Mat khau KHONG viet cung trong ma nguon — kho nay cong khai.
// Chay:  ADMIN_PASS='...' node scripts/<ten>.mjs
if (!ADMIN_PASS) {
  console.error('Thieu ADMIN_PASS. Chay lai kem bien moi truong ADMIN_PASS truoc lenh node.');
  process.exit(1);
}

const OWNER_TOKEN = process.env.OWNER_TOKEN;

if (!OWNER_TOKEN) {
  console.error('Thiếu OWNER_TOKEN — không chụp được khu User.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

/** Viewport rộng 1440 là khổ phổ biến nhất; scale 2 cho ảnh nét khi in báo cáo. */
const newCtx = () => browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
});

let ok = 0, fail = 0;

/** Chờ trang đứng yên hẳn: hết khung xám, ảnh tải xong, biểu đồ vẽ xong. */
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  // Khung xám chờ tải (LoadingSkeleton dùng animate-pulse)
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    null, { timeout: 20000 },
  ).catch(() => {});

  // Mọi thẻ <img> đang hiển thị phải báo đã tải xong
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('img')]
      .filter(i => i.offsetParent !== null && i.getAttribute('loading') !== 'lazy');
    return imgs.every(i => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 20000 }).catch(() => {});

  // Biểu đồ Recharts vẽ theo hiệu ứng; chờ có <path>/<rect> thật sự
  const hasChart = await page.locator('.recharts-surface').count().catch(() => 0);
  if (hasChart) await page.waitForTimeout(1800);

  // Nhịp cuối cho stagger + hero slider
  await page.waitForTimeout(1600);

  // Cuộn hết trang rồi về đầu: ép các phần lazy dưới màn hình hiện ra
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('  ✓', name);
  ok++;
}

async function capture(page, path, name, prepare) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (page.url().includes('/login') && !path.includes('login')) {
        console.log('  ! bị đá về /login:', path); fail++; return;
      }
      await settle(page);
      if (prepare) { await prepare(page); await page.waitForTimeout(1000); }
      await shoot(page, name);
      return;
    } catch (e) {
      if (attempt === 3) { console.log('  ! hỏng', name, String(e).slice(0, 120)); fail++; }
    }
  }
}

// ===================== PUBLIC =====================
console.log('— Public Website');
{
  const ctx = await newCtx();
  const page = await ctx.newPage();

  await capture(page, '/', 'public-home');
  await capture(page, '/features', 'public-features');
  await capture(page, '/pricing', 'public-pricing');
  await capture(page, '/register', 'public-register');
  await capture(page, '/login', 'public-login');
  await capture(page, '/contact', 'public-contact');
  await capture(page, '/support', 'public-support');
  await capture(page, '/forgot-password', 'public-forgot-password');
  await capture(page, '/reset-password?token=demo&email=demo%40funcafe.vn', 'public-reset-password');
  await capture(page, '/terms', 'public-terms');
  await capture(page, '/privacy', 'public-privacy');

  await ctx.close();
}

// ===================== USER =====================
console.log('— User Portal');
{
  const ctx = await newCtx();
  await ctx.addInitScript(t => localStorage.setItem('funcafe_token', t), OWNER_TOKEN);
  const page = await ctx.newPage();

  await capture(page, '/user/dashboard', 'user-dashboard');
  await capture(page, '/user/cafe', 'user-cafe-multi');
  await capture(page, '/user/tables', 'user-tables');

  // Thực đơn — tab Món ăn
  await capture(page, '/user/menu', 'user-menu');

  // Thực đơn — tab Danh mục (màn hình mới)
  await capture(page, '/user/menu', 'user-menu-category', async (p) => {
    await p.getByRole('button', { name: /Danh mục/ }).first().click();
    await p.waitForTimeout(700);
  });

  // Form thêm/sửa món — nơi khai báo size và giá theo size
  await capture(page, '/user/menu', 'user-menu-item-form', async (p) => {
    await p.locator('table tbody tr button[title="Sửa"]').first().click();
    await p.waitForTimeout(1200);
  });

  // Form món — phần tích chọn topping cho món (ảnh RIÊNG, không dùng lại ảnh size)
  await capture(page, '/user/menu', 'user-menu-item-toppings', async (p) => {
    await p.locator('table tbody tr button[title="Sửa"]').first().click();
    await p.waitForTimeout(1200);
    const btn = p.getByRole('button', { name: /topping/i }).last();
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await p.waitForTimeout(900); }
  });

  await capture(page, '/user/toppings', 'user-toppings');
  await capture(page, '/user/sales', 'user-sales-pos');
  await capture(page, '/user/invoices', 'user-invoices');

  // Chi tiết hóa đơn
  await capture(page, '/user/invoices', 'user-invoice-detail', async (p) => {
    await p.locator('button[title="Xem chi tiết"]').first().click();
    await p.waitForTimeout(1400);
  });

  await capture(page, '/user/revenue', 'user-revenue');
  await capture(page, '/user/subscription', 'user-subscription');

  // Lịch sử thanh toán (tab thứ hai)
  await capture(page, '/user/subscription', 'user-subscription-history', async (p) => {
    await p.getByRole('button', { name: /Lịch sử thanh toán/ }).first().click();
    await p.waitForTimeout(800);
  });

  await capture(page, '/user/profile', 'user-profile');

  // Bộ chọn quán trên thanh đầu trang — minh hoạ mô hình đa quán
  await capture(page, '/user/dashboard', 'user-cafe-switcher', async (p) => {
    await p.locator('header button:has(svg)').filter({ hasText: /./ }).first().click();
    await p.waitForTimeout(800);
  });

  // Hộp thoại mua gói: chỉ MỞ, không bấm thanh toán
  await capture(page, '/user/subscription', 'user-subscription-buy', async (p) => {
    await p.locator('.grid > div').filter({ hasText: /Pro Max|Pro|Fun Free/ }).first().click();
    await p.waitForTimeout(1100);
  });

  // Khung chat trợ lý AI — mở widget, hiện câu gợi ý; KHÔNG gửi câu hỏi
  await capture(page, '/user/dashboard', 'user-ai-chat', async (p) => {
    await p.locator('button[aria-label="Trợ lý AI"]').click();
    await p.waitForTimeout(1600);
  });

  // Phân tích doanh thu bằng AI — nằm sẵn trong trang Doanh thu
  await capture(page, '/user/revenue', 'user-ai-revenue', async (p) => {
    const btn = p.getByRole('button', { name: /phân tích|AI/i }).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await p.waitForTimeout(6000); }
  });

  // POS — hộp thoại thanh toán, chọn VietQR để hiện mã. KHÔNG bấm xác nhận,
  // nên không có đơn hàng hay giao dịch nào bị tạo ra.
  await capture(page, '/user/sales', 'user-sales-vietqr', async (p) => {
    const pay = p.getByRole('button', { name: /^Thanh toán$/ }).first();
    if (await pay.isVisible().catch(() => false)) {
      await pay.click();
      await p.waitForTimeout(1200);
      const qr = p.getByText('VietQR', { exact: true }).first();
      if (await qr.isVisible().catch(() => false)) { await qr.click(); await p.waitForTimeout(1800); }
    }
  });

  await ctx.close();
}

// ===================== ADMIN =====================
console.log('— Admin Portal');
{
  const ctx = await newCtx();
  const page = await ctx.newPage();

  let logged = false;
  for (let i = 1; i <= 4 && !logged; i++) {
    await page.goto(B + '/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    await page.fill('input[type=email]', ADMIN_EMAIL);
    await page.fill('input[type=password]', ADMIN_PASS);
    await page.click('button[type=submit]');
    logged = await page.waitForFunction(
      () => !!(localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token')),
      null, { timeout: 15000 },
    ).then(() => true).catch(() => false);
  }

  if (!logged) {
    console.log('  ! không đăng nhập được tài khoản quản trị');
    fail++;
  } else {
    await capture(page, '/admin/dashboard', 'admin-dashboard');
    await capture(page, '/admin/users', 'admin-users');
    await capture(page, '/admin/packages', 'admin-packages');

    // Thời hạn gói: ảnh RIÊNG, trước đây dùng chung ảnh với trang Gói dịch vụ
    await capture(page, '/admin/packages', 'admin-timesubs', async (p) => {
      const btn = p.getByRole('button', { name: /thời hạn/i }).first();
      if (await btn.isVisible().catch(() => false)) { await btn.click(); await p.waitForTimeout(1200); }
    });

    await capture(page, '/admin/payments', 'admin-payments');
    await capture(page, '/admin/revenue', 'admin-revenue');
    await capture(page, '/admin/reviews', 'admin-reviews');
    await capture(page, '/admin/contacts', 'admin-contacts');
  }

  await ctx.close();
}

await browser.close();
console.log(`\nXong: ${ok} ảnh, ${fail} lỗi. Thư mục: ${OUT}`);
