/**
 * VIEC 8.7.1 · 8.7.2 · 8.7.3 — kiem BAN TRIEN KHAI dang song tren mang.
 *
 * Vi sao phai co script nay: bon lenh kiem thuong ngay (typecheck, lint, npm test,
 * php artisan test) deu chay tren MAY MINH, voi CSDL cua may minh. Chung khong noi
 * duoc mot cau nao ve ban tren mang — noi ma bien moi truong khac, CSDL khac, kho
 * anh khac, va la ban ma hoi dong se mo ra xem.
 *
 * Chay (mat khau KHONG viet cung trong ma nguon — kho nay cong khai):
 *   USER_EMAIL=... USER_PASS=... ADMIN_EMAIL=... ADMIN_PASS=... \
 *     node scripts/kiem-ban-trien-khai.mjs
 *
 * MAC DINH CHI DOC. Hai phep kiem co GHI du lieu phai bat rieng:
 *   --tai-anh   8.7.2 · tai mot anh 1x1 len Cloudinary (them 1 tep trong kho anh)
 *   --tao-don   8.7.3 · tao mot don mua goi de xem duong tra ve cua cong thanh toan
 *               (don nay o trang thai cho, tu bi don thanh 'that bai' o lan mua sau)
 */
import { chromium } from 'file:///C:/FunCafe/node_modules/playwright-core/index.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE ?? 'https://funcaffe.vercel.app';
const API = process.env.API ?? 'https://funcaffe.onrender.com/api';
const TAI_ANH = process.argv.includes('--tai-anh');
const TAO_DON = process.argv.includes('--tao-don');

const cong = { dat: 0, hong: 0 };
const ok = (dieuKien, chu, themVao = '') => {
  cong[dieuKien ? 'dat' : 'hong']++;
  console.log(`  ${dieuKien ? 'DAT ' : 'HONG'}  ${chu}${themVao ? ' — ' + themVao : ''}`);
};

const cauHinh = ['USER_EMAIL', 'USER_PASS', 'ADMIN_EMAIL', 'ADMIN_PASS'].filter((k) => !process.env[k]);
if (cauHinh.length) {
  console.error('Thieu bien moi truong: ' + cauHinh.join(', '));
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
const page = await ctx.newPage();
const loiTrang = [];
page.on('pageerror', (e) => loiTrang.push(String(e).slice(0, 160)));

/** May chu Render free ngu sau ~15' khong dung — lan goi dau co the mat gan mot phut. */
const CHO = 90_000;

const dangNhap = async (email, matKhau, tienTo) => {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type=email]', { timeout: CHO });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', matKhau);
  await page.click('button[type=submit]');
  return page.waitForFunction(
    (t) => location.pathname.startsWith(t),
    tienTo, { timeout: CHO },
  ).then(() => true).catch(() => false);
};

const goiApi = (duong, tuyChon = {}) => page.evaluate(async ({ api, duong, tuyChon }) => {
  const token = localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token');
  const res = await fetch(api + duong, {
    method: tuyChon.method ?? 'GET',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', ...(tuyChon.body ? { 'Content-Type': 'application/json' } : {}) },
    body: tuyChon.body ? JSON.stringify(tuyChon.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}, { api: API, duong, tuyChon });

// ===== 8.7.1a — KHU CONG KHAI =============================================
console.log('\n8.7.1a · Khu cong khai');
for (const duong of ['/', '/pricing', '/features', '/support', '/contact', '/login']) {
  const res = await page.goto(BASE + duong, { waitUntil: 'domcontentloaded' }).catch(() => null);
  const chu = await page.evaluate(() => (document.body.innerText || '').trim().length);
  ok(res?.status() === 200 && chu > 400, `mo duoc ${duong}`, `HTTP ${res?.status()}, ${chu} ky tu`);
}

// ===== Bang gia: dong quang cao PHAI khop han muc that ====================
// Day la cho da sai that tren ban trien khai: the goi Pro doc truong `features`
// (chu do admin dat), con bang so sanh ben duoi doc `max_tables`. Hai nguon, mot
// trang — lech nhau la khach doc duoc hai con so nguoc nhau.
console.log('\nBang gia · dong quang cao co khop han muc that khong');
const goi = await fetch(API + '/packages').then((r) => r.json());
for (const p of goi) {
  const chuHanMuc = [p.description ?? '', ...(p.features ?? [])].join(' | ');
  const soBan = chuHanMuc.match(/(\d+)\s*bàn/i)?.[1];
  const soMon = chuHanMuc.match(/(\d+)\s*món/i)?.[1];
  if (soBan) ok(Number(soBan) === p.max_tables, `${p.name}: chu quang cao "${soBan} bàn"`, `han muc that: ${p.max_tables ?? 'khong gioi han'}`);
  if (soMon) ok(Number(soMon) === p.max_menu_items, `${p.name}: chu quang cao "${soMon} món"`, `han muc that: ${p.max_menu_items ?? 'khong gioi han'}`);
  if (!soBan && !soMon) console.log(`  (bo qua) ${p.name}: khong co con so han muc trong chu quang cao`);
}

// ===== 8.7.1b — KHU CHU QUAN ==============================================
console.log('\n8.7.1b · Khu chu quan');
const vaoUser = await dangNhap(process.env.USER_EMAIL, process.env.USER_PASS, '/user');
ok(vaoUser, 'dang nhap chu quan vao duoc khu lam viec');
if (vaoUser) {
  const quan = await goiApi('/cafes');
  ok(quan.status === 200 && Array.isArray(quan.body), 'doc duoc danh sach quan tu Atlas', `${quan.body?.length ?? 0} quan`);
}

// ===== 8.7.2 — TAI ANH LEN CLOUDINARY =====================================
console.log('\n8.7.2 · Tai anh len kho anh');
if (!TAI_ANH) {
  console.log('  (bo qua) them --tai-anh de chay — phep kiem nay GHI mot tep vao kho anh');
} else if (!vaoUser) {
  ok(false, 'khong dang nhap duoc nen khong thu tai anh duoc');
} else {
  const anh = await page.evaluate(async (api) => {
    // PNG 1x1 trong suot, dung sinh tai cho de khong phai kem tep nhi phan vao kho.
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.append('file', new Blob([bin], { type: 'image/png' }), 'kiem-trien-khai.png');
    const token = localStorage.getItem('funcafe_token') || sessionStorage.getItem('funcafe_token');
    const res = await fetch(api + '/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, body: fd });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, API);
  ok(anh.status === 201, 'may chu nhan anh', `HTTP ${anh.status}${anh.body?.message ? ' · ' + anh.body.message : ''}`);
  const url = anh.body?.url ?? '';
  ok(/res\.cloudinary\.com/.test(url), 'anh nam tren Cloudinary chu khong phai dia cua Render', url.slice(0, 80));
  if (url) {
    const ve = await fetch(url).catch(() => null);
    ok(ve?.ok && (ve.headers.get('content-type') ?? '').startsWith('image/'), 'mo lai duoc bang duong dan tra ve', `HTTP ${ve?.status}`);
  }
}

// ===== 8.7.3 — DUONG TRA VE CUA CONG THANH TOAN ===========================
console.log('\n8.7.3 · Duong tra ve cua cong thanh toan');
if (!TAO_DON) {
  console.log('  (bo qua) them --tao-don de chay — phep kiem nay TAO mot don mua goi');
} else if (!vaoUser) {
  ok(false, 'khong dang nhap duoc nen khong tao don duoc');
} else {
  const quan = await goiApi('/cafes');
  const cafeId = quan.body?.[0]?.id ?? quan.body?.[0]?._id;
  const proGoi = goi.find((p) => p.type === 'pro');
  const moc = await fetch(`${API}/packages/${proGoi.id}/time-subscriptions`).then((r) => r.json());
  const don = await goiApi(`/cafes/${cafeId}/subscriptions`, {
    method: 'POST',
    body: { package_id: proGoi.id, time_subscription_id: moc[0].id, payment_method: 'vnpay' },
  });
  const duongCong = JSON.stringify(don.body ?? {});
  const traVe = decodeURIComponent(duongCong).match(/vnp_ReturnUrl=([^&"]+)/)?.[1] ?? duongCong;
  ok(don.status === 201 || don.status === 200, 'tao duoc don mua goi', `HTTP ${don.status}`);
  ok(!/localhost|127\.0\.0\.1/.test(duongCong), 'duong tra ve KHONG tro ve localhost', traVe.slice(0, 100));
  ok(/funcaffe\.(vercel\.app|onrender\.com)/.test(duongCong), 'duong tra ve tro dung ten mien that', traVe.slice(0, 100));
}

// ===== 8.7.1c — KHU QUAN TRI ==============================================
console.log('\n8.7.1c · Khu quan tri');
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
const vaoAdmin = await dangNhap(process.env.ADMIN_EMAIL, process.env.ADMIN_PASS, '/admin');
ok(vaoAdmin, 'dang nhap quan tri vao duoc khu quan tri');
if (vaoAdmin) {
  const nguoiDung = await goiApi('/admin/users');
  ok(nguoiDung.status === 200, 'doc duoc danh sach nguoi dung', `HTTP ${nguoiDung.status}`);
  const goiQt = await goiApi('/admin/packages');
  ok(goiQt.status === 200 && Array.isArray(goiQt.body), 'doc duoc danh sach goi (ke ca goi da tat)', `${goiQt.body?.length ?? 0} goi`);
}

// ===== KET =================================================================
console.log('\nLoi JavaScript trong luc chay: ' + (loiTrang.length ? loiTrang.length : 'khong co'));
loiTrang.slice(0, 5).forEach((l) => console.log('  ' + l));
console.log(`\nTONG: ${cong.dat} dat / ${cong.hong} hong`);
await browser.close();
process.exit(cong.hong ? 1 : 0);
