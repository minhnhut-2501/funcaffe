/**
 * SÁU KỊCH BẢN ĐẦU–CUỐI (việc 8.6.1 → 8.6.6).
 *
 * Đây là bằng chứng cho chương 5 của báo cáo. Việc 9.4.1 cấm ghi "PASS" cho ca chưa
 * từng chạy, nên mỗi dòng DAT dưới đây phải là một phép kiểm thật sự đã chạy.
 *
 * ═══ BẮT BUỘC ĐỌC TRƯỚC KHI CHẠY ═══
 *
 * Kịch bản này GHI DỮ LIỆU: tạo tài khoản, tạo quán, bán hàng, mua gói, khóa tài
 * khoản. KHÔNG được chạy trên cơ sở dữ liệu thật. Cách dựng môi trường nháp:
 *
 *   cd backend
 *   MONGODB_DATABASE=funcafe_e2e php artisan db:seed --class=DemoSeeder --force
 *   MONGODB_DATABASE=funcafe_e2e php artisan db:indexes
 *   MONGODB_DATABASE=funcafe_e2e php artisan serve --port=8000
 *
 * Và frontend chạy bình thường (`npm run dev`, cổng 3000).
 * Xong việc thì xóa CSDL nháp đi.
 *
 * Script tự kiểm tra điều này ở bước đầu và DỪNG nếu thấy đang trỏ vào `funcafe`.
 *
 * Chạy: node scripts/kich-ban-dau-cuoi.mjs
 */
import { chromium } from 'file:///C:/FunCafe/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3000';
// 127.0.0.1 chứ KHÔNG phải localhost: Node 18 trở lên phân giải `localhost` thành
// IPv6 (::1) trước, trong khi `php artisan serve` chỉ nghe trên IPv4 — lượt gọi hỏng
// với lý do "fetch failed" trông y như máy chủ chưa chạy.
const API = process.env.API ?? 'http://127.0.0.1:8000/api';

// ── Báo cáo ────────────────────────────────────────────────────────────────────
const ketQua = [];
let kichBanHienTai = '';
const batDau = (ma, ten) => { kichBanHienTai = ma; console.log(`\n══ ${ma} — ${ten}`); };
const ok = (dieuKien, chu) => {
  ketQua.push({ ma: kichBanHienTai, dat: !!dieuKien, chu });
  console.log(`  ${dieuKien ? 'DAT ' : 'HONG'}  ${chu}`);
  return !!dieuKien;
};

// ── Gọi API trực tiếp (dựng bối cảnh + đối chiếu kết quả) ──────────────────────
async function api(duong, { token, method = 'GET', body } = {}) {
  const res = await fetch(API + duong, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const chu = await res.text();
  let than = null;
  try { than = chu ? JSON.parse(chu) : null; } catch { than = chu; }
  return { ma: res.status, than };
}

/**
 * ── CHỐT AN TOÀN ──────────────────────────────────────────────────────────────
 *
 * Hỏi CHÍNH MÁY CHỦ xem nó đang nói chuyện với cơ sở dữ liệu nào, bằng cách tìm một
 * CÁI CỌC chỉ tồn tại trong CSDL nháp. Không thấy cọc → dừng, không chạy gì hết.
 *
 * Vì sao không đọc `backend/.env`: bản trước làm đúng vậy và nó ĐÃ THỦNG. Tệp .env
 * chỉ nói lên Ý ĐỊNH; thứ quyết định là biến môi trường mà tiến trình PHP thật sự
 * nhận được, và biến đó có thể không tới nơi (tiến trình cũ chưa chết, trình bao nuốt
 * mất tiền tố, người ta khởi động lại server bằng tay...). Lần đó kịch bản ghi thẳng
 * 54 bản ghi vào dữ liệu thật.
 *
 * Cắm cọc:
 *   MONGODB_DATABASE=funcafe_e2e php artisan tinker --execute="App\Models\Package::updateOrCreate(['name'=>'__E2E_SANDBOX__'],['type'=>'free','status'=>'active','features'=>[]]);"
 */
const COC = '__E2E_SANDBOX__';
{
  const { than } = await api('/packages');
  if (!Array.isArray(than)) {
    console.error('Không gọi được API. Backend đã chạy chưa?');
    process.exit(1);
  }
  if (!than.some((g) => g.name === COC)) {
    console.error('\n╔═══════════════════════════════════════════════════════════════╗');
    console.error('║  DỪNG — máy chủ KHÔNG trỏ vào cơ sở dữ liệu nháp.             ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    console.error(`\nKhông thấy cọc "${COC}" trong danh sách gói. Kịch bản này GHI DỮ LIỆU`);
    console.error('(tạo tài khoản, bán hàng, mua gói, khóa tài khoản) nên nó từ chối chạy.');
    console.error('\nXem hướng dẫn dựng môi trường nháp ở đầu tệp này.\n');
    process.exit(1);
  }
  console.log(`Chốt an toàn: thấy cọc "${COC}" — đang ở cơ sở dữ liệu nháp.`);
}
const env = readFileSync('C:/FunCafe/backend/.env', 'utf8');
const doc = (k, mac = '') => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] ?? mac).trim();

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ locale: 'vi-VN', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('     [crash]', String(e).slice(0, 140)));

/** Đăng nhập qua giao diện — CHỜ HYDRATE XONG rồi mới gõ (xem scripts/thu-xuat-excel.mjs). */
async function dangNhapQuaGiaoDien(email, matKhau) {
  // Dọn phiên cũ TRƯỚC. Trang /login tự chuyển hướng vào khu làm việc khi thấy còn
  // token — nên nếu bước trước đã đăng ký/đăng nhập rồi thì ô email không bao giờ
  // hiện ra, và phép chờ nó sẽ hết giờ với lý do khó hiểu.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('input[type=email]', { timeout: 60000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', matKhau);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/user') || location.pathname.startsWith('/admin'),
    null, { timeout: 60000 });
}

const duy = Date.now().toString().slice(-7);
const MAT_KHAU = 'Password@123';

// ═══ 8.6.1 ═══ đăng ký → tạo quán → nhận gói dùng thử → thấy khu làm việc ══════
batDau('8.6.1', 'Đăng ký → tạo quán → gói dùng thử → khu làm việc');

const emailMoi = `e2e-${duy}@funcafe.test`;
await page.goto(BASE + '/register', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#reg-email', { timeout: 60000 });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(2500);
await page.fill('#reg-name', 'Chủ quán E2E');
await page.fill('#reg-email', emailMoi);
await page.fill('#reg-phone', '0901234567');
await page.fill('#reg-password', MAT_KHAU);
await page.fill('#reg-confirm', MAT_KHAU);
await page.check('#reg-agree');
await page.click('button[type=submit]');
await page.waitForFunction(() => location.pathname.startsWith('/user'), null, { timeout: 60000 });

ok(page.url().includes('/user/shop'), 'đăng ký xong vào thẳng bước tạo quán đầu tiên');

const { than: dangNhap } = await api('/auth/login', { method: 'POST', body: { email: emailMoi, password: MAT_KHAU } });
const token = dangNhap?.token;
ok(!!token, 'tài khoản mới đăng nhập được ngay');
ok(dangNhap?.user?.role === 'user', 'vai trò mặc định là chủ quán, không phải quản trị');

const { ma: maTaoQuan, than: quanMoi } = await api('/shops', {
  token, method: 'POST', body: { name: `Quán E2E ${duy}`, address: '1 Đường Thử, TP.HCM', phone: '0901234567' },
});
ok(maTaoQuan === 201, 'tạo được quán đầu tiên');
const quanId = quanMoi?.id ?? quanMoi?._id;

const { than: dsGoi } = await api('/packages');
const goiThu = dsGoi.find((g) => g.is_trial);
ok(!!goiThu, 'bảng giá có gói dùng thử');

const { ma: maNhanThu } = await api(`/shops/${quanId}/subscriptions`, {
  token, method: 'POST', body: { package_id: goiThu.id ?? goiThu._id, payment_method: 'vnpay' },
});
ok(maNhanThu === 201, 'nhận được gói dùng thử miễn phí');

const { than: goiCuaQuan } = await api(`/shops/${quanId}/subscriptions`, { token });
const subThu = goiCuaQuan?.[0];
const soNgayThu = subThu ? Math.round((new Date(subThu.end_date) - new Date(subThu.start_date)) / 86400000) : 0;
ok(soNgayThu === 7, `gói dùng thử đúng 7 ngày (đo được ${soNgayThu})`);
ok(subThu?.status === 'active', 'gói ở trạng thái đang hiệu lực, dùng được ngay');

const { ma: maLanHai } = await api(`/shops/${quanId}/subscriptions`, {
  token, method: 'POST', body: { package_id: goiThu.id ?? goiThu._id, payment_method: 'vnpay' },
});
ok(maLanHai >= 400, 'không xin được gói dùng thử lần thứ hai');

// ═══ 8.6.2 ═══ bán một đơn có topping và giảm giá → hóa đơn → doanh thu ════════
batDau('8.6.2', 'Dựng thực đơn → bán đơn có topping và giảm giá → hóa đơn → doanh thu');

const { than: dm } = await api(`/shops/${quanId}/categories`, { token, method: 'POST', body: { name: 'Trà sữa', is_active: true } });
const dmId = dm?.id ?? dm?._id;
ok(!!dmId, 'tạo được danh mục');

const { than: mon } = await api(`/shops/${quanId}/products`, {
  token, method: 'POST',
  body: { category_id: dmId, name: 'Trà sữa E2E', base_price: 30000, is_available: true, allow_topping: true },
});
const monId = mon?.id ?? mon?._id;
ok(!!monId, 'tạo được món giá 30.000 đ');

const { than: tp } = await api(`/shops/${quanId}/toppings`, {
  token, method: 'POST', body: { name: 'Trân châu E2E', price: 7000, is_available: true },
});
const tpId = tp?.id ?? tp?._id;
ok(!!tpId, 'tạo được topping giá 7.000 đ');

const { than: ban } = await api(`/shops/${quanId}/tables`, { token, method: 'POST', body: { name: 'Bàn E2E', capacity: 4 } });
const banId = ban?.id ?? ban?._id;
ok(!!banId, 'tạo được bàn');

// 2 ly × (30.000 + 7.000 topping) = 74.000, giảm 4.000 -> phải thu 70.000.
//
// Giảm giá nhập ở bước THANH TOÁN chứ không phải lúc lên order — đúng như quầy thật:
// thu ngân bấm giảm giá rồi mới nhận tiền. `store()` không nhận trường này.
const { ma: maDon, than: don } = await api(`/shops/${quanId}/orders`, {
  token, method: 'POST',
  body: {
    table_id: banId,
    items: [{
      product_id: monId, product_name_snapshot: 'Trà sữa E2E', quantity: 2,
      toppings: [{ topping_id: tpId, topping_name_snapshot: 'Trân châu E2E', quantity: 1 }],
    }],
  },
});
const donId = don?.id ?? don?._id;
ok(maDon === 201, 'lên được order có topping');

const { than: donDoc } = await api(`/shops/${quanId}/orders/${donId}`, { token });
ok(Number(donDoc?.subtotal) === 74000, `tạm tính = 2 × (30.000 + 7.000) = 74.000 (đọc được ${donDoc?.subtotal})`);

const { ma: maTra, than: hoaDon } = await api(`/shops/${quanId}/orders/${donId}/pay`, {
  token, method: 'POST', body: { payment_method: 'cash', cash_received: 100000, discount_amount: 4000 },
});
ok(maTra === 200, 'thanh toán thành công');
ok(Number(hoaDon?.total_amount) === 70000, `sau giảm 4.000 phải thu 70.000 (đọc được ${hoaDon?.total_amount})`);
ok(Number(hoaDon?.change_amount) === 30000, `tiền thối = 100.000 − 70.000 = 30.000 (đọc được ${hoaDon?.change_amount})`);
ok(!!hoaDon?.invoice_code, `sinh mã hóa đơn (${hoaDon?.invoice_code})`);

const { than: banSau } = await api(`/shops/${quanId}/tables`, { token });
ok(banSau.find((b) => (b.id ?? b._id) === banId)?.status === 'empty', 'bàn được trả về trống sau khi thu tiền');

const { than: dsHoaDon } = await api(`/shops/${quanId}/orders?status=paid`, { token });
const tongDoanhThu = dsHoaDon.reduce((s, h) => s + Number(h.total_amount ?? 0), 0);
ok(tongDoanhThu === 70000, `doanh thu quán = đúng 70.000 (đọc được ${tongDoanhThu})`);

// Nhìn tận mắt trên giao diện, không chỉ qua API.
await dangNhapQuaGiaoDien(emailMoi, MAT_KHAU);
await page.goto(BASE + '/user/invoices', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const chuHoaDon = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
ok(chuHoaDon.includes(hoaDon.invoice_code), 'hóa đơn hiện ra ở màn hình Hóa đơn');
ok(/70\.000/.test(chuHoaDon), 'số tiền trên màn hình khớp 70.000');

// ═══ 8.6.3 ═══ mua gói qua VNPay → cổng gọi về → hạn gói đúng ══════════════════
batDau('8.6.3', 'Mua gói qua VNPay → cổng gọi về → hạn gói cộng đúng');

const goiTraPhi = dsGoi.find((g) => !g.is_trial && g.type === 'pro');
const { than: mocThoiHan } = await api(`/packages/${goiTraPhi.id ?? goiTraPhi._id}/time-subscriptions`);
const moc1Thang = mocThoiHan.find((m) => m.duration_unit === 'month' && Number(m.duration_value) === 1) ?? mocThoiHan[0];
ok(!!moc1Thang, `có mốc thời hạn để mua (${moc1Thang?.label})`);

const { ma: maMua, than: ketQuaMua } = await api(`/shops/${quanId}/subscriptions`, {
  token, method: 'POST',
  body: { package_id: goiTraPhi.id ?? goiTraPhi._id, time_subscription_id: moc1Thang.id ?? moc1Thang._id, payment_method: 'vnpay' },
});
ok(maMua === 201 || maMua === 200, 'tạo được giao dịch mua gói');
ok(typeof ketQuaMua?.payment_url === 'string' && ketQuaMua.payment_url.includes('vnpayment'),
  'máy chủ trả về đường dẫn sang cổng VNPay');

// Đọc mã giao dịch và số tiền từ CHÍNH đường dẫn cổng. Không tra qua
// /subscriptions/payments được: endpoint đó CỐ Ý ẩn đơn cổng đang chờ — khách bấm
// mua rồi bỏ dở giữa chừng không nên thấy một dòng "đang chờ" trong lịch sử của mình.
const urlCong = new URL(ketQuaMua.payment_url);
const maGiaoDich = urlCong.searchParams.get('vnp_TxnRef');
const soTien = Number(urlCong.searchParams.get('vnp_Amount'));
ok(!!maGiaoDich && soTien > 0, `đường dẫn cổng mang đủ mã giao dịch và số tiền (${maGiaoDich}, ${soTien / 100} đ)`);

// Điều thật sự cần giữ ở bước này: CHƯA trả tiền thì CHƯA có gói.
const { than: goiTruocKhiTra } = await api(`/shops/${quanId}/subscriptions`, { token });
ok(!goiTruocKhiTra.some((s) => s.status === 'active' && s.package?.type === 'pro'),
  'trước khi cổng xác nhận: gói Pro CHƯA được cấp');

// Giả lập cổng gọi về, KÝ ĐÚNG bằng khóa thật trong .env — chữ ký sai là bị từ chối.
const biMat = doc('VNPAY_HASH_SECRET');
const thamSo = {
  vnp_Amount: String(soTien), vnp_BankCode: 'NCB', vnp_CardType: 'ATM',
  vnp_OrderInfo: `Thanh toan goi ${maGiaoDich}`, vnp_PayDate: '20260813120000',
  vnp_ResponseCode: '00', vnp_TmnCode: doc('VNPAY_TMN_CODE'),
  vnp_TransactionNo: '99999999', vnp_TransactionStatus: '00', vnp_TxnRef: maGiaoDich,
};
const chuoiKy = Object.keys(thamSo).sort().map((k) => `${k}=${encodeURIComponent(thamSo[k]).replace(/%20/g, '+')}`).join('&');
const chuKy = createHmac('sha512', biMat).update(chuoiKy).digest('hex');

const traLoiCong = await fetch(`${API}/payments/vnpay/return?${chuoiKy}&vnp_SecureHash=${chuKy}`);
ok(traLoiCong.status < 400, `cổng gọi về được chấp nhận (HTTP ${traLoiCong.status})`);

const { than: gdSau } = await api(`/shops/${quanId}/subscriptions/payments`, { token });
ok(gdSau.find((p) => p.transaction_code === maGiaoDich)?.payment_status === 'paid',
  'sau khi cổng xác nhận: giao dịch hiện ra trong lịch sử với trạng thái ĐÃ THANH TOÁN');

const { than: goiSauMua } = await api(`/shops/${quanId}/subscriptions`, { token });
const goiPro = goiSauMua.find((s) => s.status === 'active' && s.package?.type === 'pro');
ok(!!goiPro, 'gói Pro đã được kích hoạt');
const soNgayPro = goiPro ? Math.round((new Date(goiPro.end_date) - new Date()) / 86400000) : 0;
ok(soNgayPro >= 27 && soNgayPro <= 32, `hạn gói cộng đúng khoảng một tháng (còn ${soNgayPro} ngày)`);

// Cổng gọi về LẦN HAI (VNPay gửi cả Return lẫn IPN) không được cộng hạn thêm lần nữa.
const hanTruoc = goiPro.end_date;
await fetch(`${API}/payments/vnpay/return?${chuoiKy}&vnp_SecureHash=${chuKy}`);
const { than: goiLanHai } = await api(`/shops/${quanId}/subscriptions`, { token });
ok(goiLanHai.find((s) => (s._id ?? s.id) === (goiPro._id ?? goiPro.id))?.end_date === hanTruoc,
  'cổng gọi về lần hai KHÔNG cộng hạn thêm lần nữa');

// ═══ 8.6.4 ═══ gói hết hạn → ghi bị chặn → gia hạn → mở khóa ═══════════════════
batDau('8.6.4', 'Gói hết hạn → thao tác ghi bị chặn → gia hạn → mở khóa ngay');

// Đẩy mọi gói của quán về quá khứ — không có cách nào làm việc này qua API, và cũng
// không nên có: "cho gói hết hạn ngay" không phải một thao tác của người dùng.
//
// execFileSync (KHÔNG phải execSync): execSync đi qua shell, mà shell nuốt mất dấu
// gạch chéo ngược trong tên lớp PHP `App\Models\Subscription` — lỗi cú pháp khó hiểu.
// Truyền tham số dạng mảng thì chuỗi tới thẳng php, nguyên vẹn.
const { execFileSync } = await import('node:child_process');
execFileSync(
  'php',
  ['artisan', 'tinker', '--execute',
    `App\\Models\\Subscription::where('shop_id','${quanId}')->update(['end_date' => now()->subDay()]);`],
  { cwd: 'C:/FunCafe/backend', env: { ...process.env, MONGODB_DATABASE: 'funcafe_e2e' }, stdio: 'pipe' },
);

const { ma: maGhiKhiHetHan } = await api(`/shops/${quanId}/categories`, {
  token, method: 'POST', body: { name: 'Danh mục lẽ ra bị chặn', is_active: true },
});
ok(maGhiKhiHetHan === 403, `gói hết hạn thì thao tác ghi bị chặn (nhận ${maGhiKhiHetHan})`);

const { ma: maDocKhiHetHan } = await api(`/shops/${quanId}/orders?status=paid`, { token });
ok(maDocKhiHetHan === 200, 'nhưng vẫn ĐỌC được số liệu cũ — dữ liệu của quán không bị giam');

const { than: giaHan } = await api(`/shops/${quanId}/subscriptions`, {
  token, method: 'POST',
  body: { package_id: goiTraPhi.id ?? goiTraPhi._id, time_subscription_id: moc1Thang.id ?? moc1Thang._id, payment_method: 'vnpay' },
});
const urlGiaHan = new URL(giaHan.payment_url);
const maGdGiaHan = urlGiaHan.searchParams.get('vnp_TxnRef');
const thamSo2 = {
  ...thamSo,
  vnp_Amount: urlGiaHan.searchParams.get('vnp_Amount'),
  vnp_TxnRef: maGdGiaHan,
  vnp_OrderInfo: `Thanh toan goi ${maGdGiaHan}`,
};
const chuoiKy2 = Object.keys(thamSo2).sort().map((k) => `${k}=${encodeURIComponent(thamSo2[k]).replace(/%20/g, '+')}`).join('&');
const chuKy2 = createHmac('sha512', biMat).update(chuoiKy2).digest('hex');
await fetch(`${API}/payments/vnpay/return?${chuoiKy2}&vnp_SecureHash=${chuKy2}`);

const { ma: maGhiSauGiaHan } = await api(`/shops/${quanId}/categories`, {
  token, method: 'POST', body: { name: 'Danh mục sau gia hạn', is_active: true },
});
ok(maGhiSauGiaHan === 201, `gia hạn xong là ghi được NGAY, không phải đăng nhập lại (nhận ${maGhiSauGiaHan})`);

// ═══ 8.6.6 ═══ hai quán → doanh thu tổng khớp tổng hai quán ════════════════════
batDau('8.6.6', 'Hai quán → doanh thu gộp khớp tổng từng quán');

const { than: quanHai } = await api('/shops', {
  token, method: 'POST', body: { name: `Quán E2E hai ${duy}`, address: '2 Đường Thử, TP.HCM', phone: '0901234568' },
});
const quanHaiId = quanHai?.id ?? quanHai?._id;
ok(!!quanHaiId, 'tạo được quán thứ hai');

const { than: dsQuan } = await api('/shops', { token });
ok(dsQuan.length === 2, `danh sách quán trả về đúng 2 quán (đọc được ${dsQuan.length})`);

const { than: tongHop } = await api('/revenue/overview', { token });
const tongGop = Number(tongHop?.total_revenue ?? tongHop?.total ?? 0);
const { than: hd1 } = await api(`/shops/${quanId}/orders?status=paid`, { token });
const { than: hd2 } = await api(`/shops/${quanHaiId}/orders?status=paid`, { token });
const tongTay = [...hd1, ...hd2].reduce((s, h) => s + Number(h.total_amount ?? 0), 0);
ok(tongGop === tongTay, `doanh thu gộp (${tongGop}) = tổng cộng tay hai quán (${tongTay})`);

// ═══ 8.6.5 ═══ quản trị khóa tài khoản → phiên của người đó dừng ngay ══════════
batDau('8.6.5', 'Quản trị khóa tài khoản → phiên đang mở dừng ngay lập tức');

// Mật khẩu do TestUserSeeder đặt (hằng số PASSWORD trong seeder đó).
const { than: dnAdmin } = await api('/auth/login', { method: 'POST', body: { email: 'adminfuncafe@gmail.com', password: '12345678' } });
const tokenAdmin = dnAdmin?.token;
ok(!!tokenAdmin, 'đăng nhập được tài khoản quản trị');

if (tokenAdmin) {
  const { ma: maTruocKhiKhoa } = await api('/user', { token });
  ok(maTruocKhiKhoa === 200, 'trước khi khóa: chủ quán dùng bình thường');

  const { than: dsNguoiDung } = await api('/admin/users', { token: tokenAdmin });
  const nanNhan = (dsNguoiDung.data ?? dsNguoiDung).find((u) => u.email === emailMoi);
  ok(!!nanNhan, 'quản trị thấy tài khoản chủ quán trong danh sách');

  const { ma: maKhoa } = await api(`/admin/users/${nanNhan.id ?? nanNhan._id}/lock`, { token: tokenAdmin, method: 'PUT' });
  ok(maKhoa === 200, 'khóa tài khoản thành công');

  const { ma: maSauKhiKhoa } = await api('/user', { token });
  ok(maSauKhiKhoa === 401, `token đang cầm mất hiệu lực NGAY (nhận ${maSauKhiKhoa})`);

  const { ma: maDangNhapLai } = await api('/auth/login', { method: 'POST', body: { email: emailMoi, password: MAT_KHAU } });
  ok(maDangNhapLai >= 400, 'và cũng không đăng nhập lại được');
}

// ── Tổng kết ───────────────────────────────────────────────────────────────────
await browser.close();

console.log('\n' + '═'.repeat(66));
const theoKichBan = {};
ketQua.forEach((r) => {
  theoKichBan[r.ma] ??= { dat: 0, tong: 0 };
  theoKichBan[r.ma].tong++;
  if (r.dat) theoKichBan[r.ma].dat++;
});
Object.entries(theoKichBan).forEach(([ma, v]) => {
  console.log(`  ${ma}  ${v.dat}/${v.tong} ${v.dat === v.tong ? 'DAT' : '<-- CO PHEP KIEM HONG'}`);
});
const hong = ketQua.filter((r) => !r.dat);
console.log(`\n  TONG: ${ketQua.length - hong.length}/${ketQua.length} phep kiem dat`);
if (hong.length) {
  console.log('\n  Cac phep kiem HONG:');
  hong.forEach((r) => console.log(`    ${r.ma}  ${r.chu}`));
}
process.exit(hong.length ? 1 : 0);
