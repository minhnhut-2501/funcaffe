/**
 * Chup lai MOT SO trang trong bao cao, thay vi chup lai toan bo.
 *
 * Chay:  MSYS_NO_PATHCONV=1 OWNER_TOKEN='...' node scripts/shot-lai.mjs <ten> [<ten> ...]
 * Ten hop le: xem bang TRANG ben duoi (trung ten tep trong doc/report-shots).
 *
 * Quy tac cho tai lieu giong het scripts/shot-report.mjs: cho tai xong han, chup
 * tron trang, khong dan dung tru cac muc von mo ta hop thoai.
 */
import { chromium } from 'playwright-core';

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

/** ten -> { khu, duong-dan, chuan-bi } */
const TRANG = {
  'public-home': { khu: 'public', path: '/' },
  'public-features': { khu: 'public', path: '/features' },
  'public-pricing': { khu: 'public', path: '/pricing' },
  'public-contact': { khu: 'public', path: '/contact' },
  'public-terms': { khu: 'public', path: '/terms' },
  'public-privacy': { khu: 'public', path: '/privacy' },
  'user-invoices': { khu: 'user', path: '/user/invoices' },
  'user-invoice-detail': {
    khu: 'user', path: '/user/invoices',
    chuan_bi: async (p) => {
      await p.locator('button[title="Xem chi tiết"]').first().click();
      await p.waitForTimeout(1400);
    },
  },
  'user-menu': { khu: 'user', path: '/user/menu' },
  // Bo chon topping chi hien khi mon da bat "cho phep topping" — phai sua dung mot
  // mon co huy hieu Topping, khong phai mon bat ky.
  'user-menu-item-toppings': {
    khu: 'user', path: '/user/menu',
    chuan_bi: async (p) => {
      const dong = p.locator('table tbody tr').filter({ hasText: 'Có' }).filter({ has: p.locator('.badge-pro') }).first();
      const nut = (await dong.count()) ? dong.locator('button[title="Sửa"]')
        : p.locator('table tbody tr button[title="Sửa"]');
      await nut.first().click();
      await p.waitForTimeout(1500);
      const mo = p.locator('button:has-text("bấm để chọn"), button:has-text("topping")').last();
      if (await mo.isVisible().catch(() => false)) { await mo.click(); await p.waitForTimeout(1300); }
    },
  },
  'user-tables': { khu: 'user', path: '/user/tables' },
  'user-toppings': { khu: 'user', path: '/user/toppings' },
  'user-revenue': { khu: 'user', path: '/user/revenue' },
  'admin-users': { khu: 'admin', path: '/admin/users' },
  'admin-packages': { khu: 'admin', path: '/admin/packages' },
  // Thoi han goi khong co trang rieng: no nam trong hop thoai sua goi, phai mo hop
  // thoai roi cuon xuong khoi mo c thoi han.
  'admin-timesubs': {
    khu: 'admin', path: '/admin/packages',
    // Bam theo BIEU TUONG chu khong theo chu tieng Viet: chuoi tieng Viet trong ma
    // nguon va chuoi render ra DOM co the khac nhau ve chuan hoa Unicode (NFC/NFD),
    // luc do bo chon theo aria-label khong khop ma khong bao loi gi ro rang.
    chuan_bi: async (p) => {
      // Mo goi CUOI (Pro Max) chu khong phai goi dau (Fun Free): goi mien phi chi co
      // dung mot moc 7 ngay gia 0d, khong minh hoa duoc viec quan ly nhieu moc thoi han.
      await p.locator('button:has(svg.lucide-pencil)').last().click();
      await p.waitForTimeout(2500);
      await p.locator('[role=dialog], .fixed.inset-0').last()
        .evaluate(el => { el.scrollTop = el.scrollHeight; }).catch(() => {});
      await p.waitForTimeout(1000);
    },
  },
  'admin-payments': { khu: 'admin', path: '/admin/payments' },
  'admin-reviews': { khu: 'admin', path: '/admin/reviews' },
  'admin-contacts': { khu: 'admin', path: '/admin/contacts' },
};

const can = process.argv.slice(2);
if (!can.length) {
  console.error('Thiếu tên trang. Có thể chụp:', Object.keys(TRANG).join(', '));
  process.exit(1);
}
for (const t of can) {
  if (!TRANG[t]) { console.error('Không biết trang:', t); process.exit(1); }
}
if (can.some(t => TRANG[t].khu === 'user') && !OWNER_TOKEN) {
  console.error('Thiếu OWNER_TOKEN cho khu User.');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const newCtx = () => browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
});

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0,
    null, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('img')]
      .filter(i => i.offsetParent !== null && i.getAttribute('loading') !== 'lazy');
    return imgs.every(i => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 20000 }).catch(() => {});
  if (await page.locator('.recharts-surface').count().catch(() => 0)) await page.waitForTimeout(1800);
  await page.waitForTimeout(1600);
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

const ctxs = {};

async function layCtx(khu) {
  if (ctxs[khu]) return ctxs[khu];
  const ctx = await newCtx();
  if (khu === 'user') {
    await ctx.addInitScript(t => localStorage.setItem('funcafe_token', t), OWNER_TOKEN);
  }
  if (khu === 'admin') {
    const p = await ctx.newPage();
    let ok = false;
    for (let i = 1; i <= 4 && !ok; i++) {
      await p.goto(B + '/login', { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1600);
      await p.fill('input[type=email]', ADMIN_EMAIL);
      await p.fill('input[type=password]', ADMIN_PASS);
      await p.click('button[type=submit]');
      ok = await p.waitForFunction(
        () => !!(localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token')),
        null, { timeout: 15000 }).then(() => true).catch(() => false);
    }
    if (!ok) { console.error('Không đăng nhập được tài khoản quản trị'); process.exit(1); }

    // Dang nhap khong tick "ghi nho" thi token nam o sessionStorage, ma sessionStorage
    // KHONG dung chung giua cac tab — dong tab dang nhap la mat phien. Doc token ra
    // roi nhet vao localStorage cho moi tab mo sau nay.
    const token = await p.evaluate(
      () => localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token'));
    await ctx.addInitScript(t => localStorage.setItem('funcafe_token', t), token);
    await p.close();
  }
  ctxs[khu] = ctx;
  return ctx;
}

for (const ten of can) {
  const { khu, path, chuan_bi } = TRANG[ten];
  const ctx = await layCtx(khu);
  const page = await ctx.newPage();
  await page.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page);

  if (page.url().includes('/login') && !path.includes('login')) {
    console.error(`  ! bị đá về /login khi mở ${path} — phiên đăng nhập không được giữ`);
    process.exit(1);
  }

  if (chuan_bi) {
    try {
      await chuan_bi(page);
    } catch (e) {
      // Bo chon khong khop thi in ra trang dang o dau va co nhung nut nao, thay vi
      // chi nem ra mot loi timeout khong noi len dieu gi.
      console.error(`  ! bước chuẩn bị hỏng ở ${ten}: ${String(e).split('\n')[0]}`);
      console.error('    URL:', page.url());
      const nut = await page.evaluate(() => [...document.querySelectorAll('button')]
        .filter(e => e.offsetParent !== null)
        .map(e => (e.getAttribute('aria-label') || e.title || e.innerText || '').trim().slice(0, 30))
        .filter(Boolean).slice(0, 20));
      console.error('    Nút đang thấy:', nut.join(' · ') || '(không có)');
      throw e;
    }
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: `${OUT}/${ten}.png`, fullPage: true });
  await page.close();
  console.log('  ✓', ten);
}

await browser.close();
console.log(`\nXong ${can.length} ảnh. Nhớ chạy scripts/nen-anh-bao-cao.py trước khi nhúng.`);
