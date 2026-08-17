/**
 * Chụp lại toàn bộ trang khu công khai, trọn trang, để thay ảnh trong báo cáo.
 *
 * Vì sao tách khỏi `shot-report.mjs`: kịch bản đó đòi mật khẩu quản trị và token chủ
 * quán ngay từ đầu rồi mới chạy, trong khi khu công khai không cần đăng nhập gì cả.
 *
 * Mặc định chụp thẳng bản ĐANG CHẠY THẬT trên funcafe.pro thay vì máy cục bộ: ảnh
 * trong báo cáo nên khớp với thứ hội đồng bấm vào xem, và làm vậy thì không phải dựng
 * thêm một máy chủ Next thứ hai — chuyện từng làm hỏng thư mục .next của máy đang mở.
 *
 *   node scripts/chup-public.mjs
 *   BASE=http://localhost:3000 node scripts/chup-public.mjs      (chụp bản cục bộ)
 *   RONG=1440 node scripts/chup-public.mjs                       (đổi bề rộng)
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'https://funcafe.pro';
const RA = process.env.RA || 'doc/report-shots';
const RONG = Number(process.env.RONG || 1440);
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/**
 * Tên tệp trùng tên cũ trong `shot-report.mjs` để chỗ thay ảnh khỏi phải đoán.
 *
 * Mỗi trang chụp HAI kiểu, vì hai nơi dùng cần hai thứ khác nhau:
 *   · `<tên>.png`      trọn trang — để dựng lại giao diện trong Figma
 *   · `<tên>-khung.png` đúng một khung màn hình — để đặt vào báo cáo
 *
 * Trang dài bắt buộc phải dùng bản khung: trang chủ cao gần 7000px, đặt rộng 15,5cm
 * trong Word thì hình cao tới 75cm, trải ra tám trang giấy.
 */
const TRANG = [
  ['/', 'public-home'],
  ['/features', 'public-features'],
  ['/pricing', 'public-pricing'],
  ['/register', 'public-register'],
  ['/login', 'public-login'],
  ['/contact', 'public-contact'],
  ['/support', 'public-support'],
  ['/forgot-password', 'public-forgot-password'],
  ['/reset-password?token=demo&email=demo%40funcafe.vn', 'public-reset-password'],
  ['/terms', 'public-terms'],
  ['/privacy', 'public-privacy'],
];

mkdirSync(RA, { recursive: true });

const trinhDuyet = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await trinhDuyet.newContext({
  viewport: { width: RONG, height: 900 },
  deviceScaleFactor: 2,
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
});
const trang = await ctx.newPage();

/** Chờ trang đứng yên hẳn — cùng cách làm với shot-report.mjs. */
async function yen() {
  await trang.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {});

  await trang.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    null, { timeout: 20000 },
  ).catch(() => {});

  // Cuộn hết trang rồi quay về đầu: ép phần ảnh lazy phía dưới hiện ra, và cho các
  // khối có hiệu ứng cuộn-mới-hiện chạy xong. Không làm bước này thì nửa dưới trang
  // chủ chụp ra trắng trơn.
  await trang.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
  });

  // Giờ mới đòi MỌI ảnh phải tải xong, kể cả ảnh lazy vừa được kéo qua.
  await trang.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('img')].filter((i) => i.offsetParent !== null);
    return imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 25000 }).catch(() => {});

  // Nhịp cuối cho hiệu ứng vào trang và băng ảnh tự chạy dừng ở một khung ổn định.
  await trang.waitForTimeout(1800);
}

let dat = 0, hong = 0;
console.log(`Chụp từ ${BASE} · bề rộng ${RONG}px · lưu vào ${RA}/\n`);

for (const [duong, ten] of TRANG) {
  let xong = false;
  for (let lan = 1; lan <= 3 && !xong; lan++) {
    try {
      await trang.goto(BASE + duong, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await yen();
      const cao = await trang.evaluate(() => document.body.scrollHeight);

      await trang.screenshot({ path: `${RA}/${ten}.png`, fullPage: true });
      // Bản khung chụp SAU khi đã cuộn về đầu trang, nên nó là đúng thứ người dùng
      // nhìn thấy ngay lúc mở trang — kể cả băng ảnh đầu trang đang ở khung nào.
      await trang.screenshot({ path: `${RA}/${ten}-khung.png`, fullPage: false });

      console.log(`  OK   ${ten.padEnd(24)} trọn trang ${RONG}×${cao}  ·  khung ${RONG}×900`);
      dat++; xong = true;
    } catch (e) {
      if (lan === 3) { console.log(`  HONG ${ten} — ${String(e).slice(0, 90)}`); hong++; }
    }
  }
}

await trinhDuyet.close();
console.log(`\n${dat} đạt · ${hong} hỏng`);
process.exit(hong ? 1 : 0);
