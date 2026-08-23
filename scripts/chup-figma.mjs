/**
 * Chụp toàn bộ màn hình của cả ba khu, TRỌN TRANG, để dựng lại giao diện trong Figma.
 *
 * Khác `shot-report.mjs` ở ba điểm, đều vì mục đích khác nhau:
 *   · Ở đây chụp trọn trang cho MỌI màn hình, kể cả trang dài. Báo cáo phải cắt theo
 *     khung vì khổ giấy, còn dựng lại giao diện thì cần thấy hết từ đầu tới chân.
 *   · Chụp ở độ phân giải gấp đôi để phóng to trong Figma vẫn không vỡ chữ.
 *   · Xếp ảnh theo ba thư mục con đúng ba khu, đánh số theo thứ tự người dùng đi qua,
 *     để lúc dựng khỏi phải nhớ màn nào trước màn nào.
 *
 * Khu Quản lý và Quản trị cần đăng nhập; thiếu khoá thì BỎ QUA khu đó chứ không dừng,
 * nên vẫn chụp được khu công khai mà không cần gì.
 *
 *   node scripts/chup-figma.mjs                      (chỉ khu công khai)
 *   MAT_KHAU='...' node scripts/chup-figma.mjs       (đủ ba khu)
 *   BASE=http://localhost:3000 node scripts/chup-figma.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'https://funcafe.pro';
const RA = process.env.RA || 'figma';
const RONG = Number(process.env.RONG || 1440);
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// MẬT KHẨU KHÔNG VIẾT CỨNG — kho này công khai, cùng quy ước với shot-report.mjs.
// Kịch bản CHỈ MỞ TRANG VÀ CHỤP: không bấm nút nào, không tạo dữ liệu.
//
//   MAT_KHAU='...' node scripts/chup-figma.mjs
//
// Hai khu cần đăng nhập sẽ bị BỎ QUA nếu không có mật khẩu, khu công khai vẫn chụp.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'adminfuncafe@gmail.com';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'nphec4007@gmail.com';
const MAT_KHAU = process.env.MAT_KHAU;
const ADMIN_PASS = process.env.ADMIN_PASS || MAT_KHAU;
const OWNER_PASS = process.env.OWNER_PASS || MAT_KHAU;
/** Vẫn nhận token dán sẵn nếu có — nhanh hơn một lượt đăng nhập. */
const OWNER_TOKEN = process.env.OWNER_TOKEN;

const CONG_KHAI = [
  ['/', 'trang-chu'],
  ['/features', 'tinh-nang'],
  ['/pricing', 'goi-dich-vu'],
  ['/support', 'ho-tro'],
  ['/contact', 'lien-he'],
  ['/register', 'dang-ky'],
  ['/login', 'dang-nhap'],
  ['/forgot-password', 'quen-mat-khau'],
  ['/reset-password?token=demo&email=demo%40funcafe.vn', 'dat-lai-mat-khau'],
  ['/terms', 'dieu-khoan'],
  ['/privacy', 'chinh-sach-bao-mat'],
];

const QUAN_LY = [
  ['/user/dashboard', 'tong-quan'],
  ['/user/shop', 'thong-tin-quan'],
  ['/user/tables', 'quan-ly-ban'],
  ['/user/menu', 'thuc-don'],
  ['/user/toppings', 'topping'],
  ['/user/sales', 'ban-hang-pos'],
  ['/user/invoices', 'hoa-don'],
  ['/user/revenue', 'doanh-thu'],
  ['/user/subscription', 'goi-dang-dung'],
  ['/user/profile', 'ho-so-ca-nhan'],
];

const QUAN_TRI = [
  ['/admin/dashboard', 'tong-quan'],
  ['/admin/users', 'nguoi-dung'],
  ['/admin/packages', 'goi-dich-vu'],
  ['/admin/payments', 'doi-soat-thanh-toan'],
  ['/admin/revenue', 'doanh-thu-he-thong'],
  ['/admin/reviews', 'danh-gia'],
  ['/admin/contacts', 'tin-nhan-lien-he'],
];

/** Khung nhìn cao dùng cho khu quản lý và quản trị — xem chú thích ở `newCtx`. */
const CAO_KHU_TRONG = Number(process.env.CAO || 2400);

const trinhDuyet = await chromium.launch({ executablePath: EDGE, headless: true });

/**
 * `cao` = chiều cao khung nhìn.
 *
 * Khu công khai để 900 như màn hình thật, vì trang tự dài ra và chụp trọn trang lấy
 * được hết. Khu quản lý và quản trị thì KHÁC HẲN: bố cục cao đúng bằng màn hình, phần
 * thân tự cuộn bên trong, nên `document.body` không hề dài ra và ảnh "trọn trang" cũng
 * chỉ ra đúng một khung — biểu đồ doanh thu bị cắt ngang. Với hai khu đó phải dựng
 * khung nhìn cao hẳn lên để nội dung nở ra rồi mới chụp.
 */
function newCtx(cao = 900) {
  return trinhDuyet.newContext({
    viewport: { width: RONG, height: cao },
    deviceScaleFactor: 2,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  });
}

async function yen(trang) {
  await trang.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {});
  await trang.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    null, { timeout: 20000 },
  ).catch(() => {});

  await trang.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
  });

  await trang.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('img')].filter((i) => i.offsetParent !== null);
    return imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 25000 }).catch(() => {});

  const bieuDo = await trang.locator('.recharts-surface').count().catch(() => 0);
  if (bieuDo) await trang.waitForTimeout(1800);
  await trang.waitForTimeout(1600);
}

let dat = 0, hong = 0;

async function chupKhu(ten, thuMuc, danhSach, dungCtx) {
  console.log(`\n— ${ten}`);
  const ctx = await dungCtx();
  if (!ctx) { console.log('  (bỏ qua: thiếu khoá đăng nhập)'); return; }
  const trang = await ctx.newPage();
  mkdirSync(`${RA}/${thuMuc}`, { recursive: true });

  let stt = 0;
  for (const [duong, ten2] of danhSach) {
    stt += 1;
    const tep = `${RA}/${thuMuc}/${String(stt).padStart(2, '0')}-${ten2}.png`;
    let xong = false;
    for (let lan = 1; lan <= 3 && !xong; lan++) {
      try {
        await trang.goto(BASE + duong, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await yen(trang);
        // Kiểm SAU khi trang đứng yên, không phải ngay sau `domcontentloaded`: việc
        // đá về trang đăng nhập do phía trình duyệt quyết nên xảy ra muộn hơn. Kiểm
        // sớm là bỏ lọt, và ảnh chụp ra toàn trang đăng nhập mà vẫn báo OK.
        if (trang.url().includes('/login') && !duong.includes('login')) {
          console.log(`  BI DA VE /login: ${ten2}`); hong++; xong = true; break;
        }
        const cao = await trang.evaluate(() => document.body.scrollHeight);
        await trang.screenshot({ path: tep, fullPage: true });
        console.log(`  OK   ${String(stt).padStart(2, '0')}-${ten2.padEnd(22)} ${RONG}×${cao}`);
        dat++; xong = true;
      } catch (e) {
        if (lan === 3) { console.log(`  HONG ${ten2} — ${String(e).slice(0, 80)}`); hong++; }
      }
    }
  }
  await ctx.close();
}

/**
 * Đăng nhập bằng biểu mẫu rồi trả về ngữ cảnh đã giữ phiên.
 *
 * BẮT BUỘC tick "Ghi nhớ đăng nhập": không tick thì ứng dụng cất khoá vào
 * `sessionStorage`, mà sessionStorage KHÔNG dùng chung giữa các tab. Đăng nhập ở tab
 * này rồi mở tab khác để chụp là tab đó rỗng và bị đá thẳng về trang đăng nhập —
 * đúng lỗi đã làm hỏng cả 17 ảnh của lượt chụp trước, mà không có dấu hiệu gì báo.
 *
 * Kiểm luôn ở `localStorage` chứ không chấp nhận sessionStorage, để nếu ô tick đổi
 * tên hay biến mất thì hỏng ngay tại đây thay vì hỏng âm thầm ở khâu chụp.
 */
async function dangNhap(email, matKhau, cao = 900) {
  const ctx = await newCtx(cao);
  const p = await ctx.newPage();
  let vao = false;
  for (let i = 1; i <= 4 && !vao; i++) {
    await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1800);
    await p.fill('input[type=email]', email);
    await p.fill('input[type=password]', matKhau);

    const ghiNho = p.locator('input[type=checkbox]').first();
    if (await ghiNho.isVisible().catch(() => false)) {
      await ghiNho.check().catch(() => {});
    }

    await p.click('button[type=submit]');
    vao = await p.waitForFunction(
      () => !!localStorage.getItem('funcafe_token'),
      null, { timeout: 15000 },
    ).then(() => true).catch(() => false);
  }
  await p.close();
  if (!vao) {
    console.log(`  (đăng nhập ${email} không thành công — khoá không vào localStorage)`);
    await ctx.close();
    return null;
  }
  return ctx;
}

await chupKhu('Khu công khai', 'cong-khai', CONG_KHAI, () => newCtx());

/**
 * Chọn quán có gói còn hạn XA NHẤT làm quán đang xem.
 *
 * Không làm bước này thì ứng dụng lấy quán đầu danh sách — mà quán đó đang hết hạn
 * gói, nên mọi màn hình đều đội một băng đỏ "chế độ chỉ xem" và các tính năng bị khoá.
 * Ảnh chụp ra là giao diện lúc HỎNG, không dùng để dựng lại được.
 *
 * Chọn theo hạn xa nhất thay vì ghi cứng một mã quán: dữ liệu đổi thì kịch bản vẫn tự
 * tìm được quán khoẻ nhất, và quán có hạn xa nhất thường cũng là quán gói cao nhất.
 */
async function chonQuanTot(ctx) {
  const p = await ctx.newPage();
  await p.goto(BASE + '/user/dashboard', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);

  const chon = await p.evaluate(async () => {
    const t = localStorage.getItem('funcafe_token');
    const h = { Authorization: 'Bearer ' + t, Accept: 'application/json' };
    const goc = location.origin.replace('funcafe.pro', 'api.funcafe.pro');
    const quan = await (await fetch(`${goc}/api/shops`, { headers: h })).json();
    let tot = null;
    for (const c of quan) {
      const id = c.id ?? c._id;
      try {
        const s = await (await fetch(`${goc}/api/shops/${id}/subscriptions`, { headers: h })).json();
        const dang = (Array.isArray(s) ? s : s?.data ?? []).find((x) => x.status === 'active');
        if (dang && (!tot || new Date(dang.end_date) > new Date(tot.het))) {
          tot = { id, ten: c.name, het: dang.end_date, goi: dang.package_name_snapshot };
        }
      } catch { /* quán không đọc được gói thì bỏ qua */ }
    }
    if (tot) localStorage.setItem('funcafe.activeShopId', tot.id);
    return tot;
  });

  await p.close();
  if (chon) console.log(`  (chọn quán "${chon.ten}" — gói ${chon.goi}, còn hạn tới ${chon.het.slice(0, 10)})`);
  else console.log('  (không tìm được quán nào còn hạn gói — ảnh sẽ ở chế độ chỉ xem)');
  return ctx;
}

await chupKhu('Khu quản lý quán', 'quan-ly', QUAN_LY, async () => {
  if (!OWNER_TOKEN && !OWNER_PASS) return null;
  let ctx;
  if (OWNER_TOKEN) {
    ctx = await newCtx(CAO_KHU_TRONG);
    await ctx.addInitScript((t) => localStorage.setItem('funcafe_token', t), OWNER_TOKEN);
  } else {
    ctx = await dangNhap(OWNER_EMAIL, OWNER_PASS, CAO_KHU_TRONG);
  }
  return ctx ? chonQuanTot(ctx) : null;
});

await chupKhu('Khu quản trị', 'quan-tri', QUAN_TRI,
  () => (ADMIN_PASS ? dangNhap(ADMIN_EMAIL, ADMIN_PASS, CAO_KHU_TRONG) : null));

await trinhDuyet.close();
console.log(`\n${dat} đạt · ${hong} hỏng · lưu ở ${RA}/`);
