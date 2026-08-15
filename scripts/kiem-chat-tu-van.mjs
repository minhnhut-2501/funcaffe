/**
 * Kiểm hộp chat tư vấn ở trang công khai bằng trình duyệt thật.
 *
 * Bộ kiểm thử PHPUnit chứng minh RANH GIỚI dữ liệu; bài này chứng minh thứ nó không
 * với tới được: nút có hiện đúng trang không, mở ra có gõ được không, chữ có chảy
 * dần ra không, và trang nào KHÔNG được có nó.
 *
 * HAI BÀI HỌC đã trả giá khi viết kịch bản này, đừng lặp lại:
 *
 *  1. Bấm xong phải CHỜ PANEL HIỆN, không chờ theo mốc thời gian đoán chừng. Ở lần
 *     viết đầu tôi chờ 400ms rồi kiểm luôn — React chưa hydrate xong nên cú bấm rơi
 *     vào hư không, panel không hề mở, mà cả bộ kiểm vẫn chạy tiếp.
 *  2. Mọi phép kiểm phải NEO TRONG PANEL. Lần đầu tôi tìm chuỗi "Dùng thử miễn phí
 *     7 ngày" trên cả trang và nó báo ĐẠT — nhưng nó khớp chữ vốn có sẵn của trang
 *     bảng giá chứ không phải chữ trong hộp chat. Một phép kiểm xanh trong khi thứ
 *     nó canh còn chưa xuất hiện là loại sai nguy hiểm nhất.
 *
 * Chạy: node scripts/kiem-chat-tu-van.mjs   (cần dev server :3000 và backend :8000)
 */
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = mkdtempSync(join(tmpdir(), 'funcafe-chat-'));

const cong = { dat: 0, hong: 0 };
const ok = (dieuKien, chu, them = '') => {
  cong[dieuKien ? 'dat' : 'hong']++;
  console.log(`  ${dieuKien ? 'DAT ' : 'HONG'}  ${chu}${them ? ' — ' + them : ''}`);
};

const NUT = 'button[aria-label="Mở trợ lý AI"]';
const CO_MAT = ['/', '/pricing', '/features', '/support', '/contact'];
const KHONG_DUOC_CO = ['/login', '/register'];

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

console.log('\n1) Nut noi xuat hien dung trang');
for (const duong of CO_MAT) {
  const page = await ctx.newPage();
  await page.goto(BASE + duong, { waitUntil: 'domcontentloaded' });
  const co = await page.locator(NUT).count();
  ok(co === 1, `${duong} co dung 1 nut`, `dem duoc ${co}`);
  await page.close();
}

console.log('\n2) Trang xac thuc KHONG duoc co nut (che mat nut bam chinh)');
for (const duong of KHONG_DUOC_CO) {
  const page = await ctx.newPage();
  await page.goto(BASE + duong, { waitUntil: 'domcontentloaded' });
  const co = await page.locator(NUT).count();
  ok(co === 0, `${duong} khong co nut`, `dem duoc ${co}`);
  await page.close();
}

console.log('\n3) Mo hop chat o trang bang gia');
const page = await ctx.newPage();
await page.goto(BASE + '/pricing', { waitUntil: 'domcontentloaded' });

// BẤM LẠI CHO TỚI KHI PANEL MỞ, đừng bấm một phát rồi tin là xong.
//
// Next.js gắn sự kiện sau khi hydrate, mà hydrate xong lúc nào thì không có mốc nào
// chắc chắn để chờ — bấm trước thời điểm đó là cú bấm rơi vào hư không, im lặng
// không báo gì. Đây chính là chỗ làm cả bộ kiểm chạy tiếp trên một panel chưa hề mở.
// (Người dùng thật gặp cảnh này thì bấm phát nữa; kịch bản kiểm phải làm y như vậy.)
await page.waitForLoadState('networkidle').catch(() => {});
const panel = page.getByRole('dialog');
let moDuoc = false;
for (let lan = 1; lan <= 6 && !moDuoc; lan++) {
  await page.locator(NUT).click();
  moDuoc = await panel.isVisible().catch(() => false)
    || await panel.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false);
}
ok(moDuoc, 'Panel mo duoc');
if (!moDuoc) {
  await browser.close();
  console.log(`\nTONG: ${cong.dat} dat · ${cong.hong} hong`);
  process.exit(1);
}

// TẤT CẢ phép kiểm dưới đây neo trong `panel`, không tìm trên cả trang.
ok(await panel.getByText('Tư vấn FunCafe').count() === 1,
  'Tieu de dung che do tu van (khach chua dang nhap)');
ok(await panel.getByText('Dùng thử miễn phí 7 ngày').count() === 1,
  'Loi moi cho khach la DUNG THU, khong phai "nang len Pro Max"');
ok(await panel.locator('a[href="/register"]').count() === 1,
  'Duong dan tro toi /register, khong phai /user/subscription');

const goiY = panel.getByRole('button', { name: /25 bàn/ });
ok(await goiY.count() === 1, 'Co san cau goi y ve chon goi theo quy mo');

console.log('\n4) Hoi that va doc cau tra loi chay dan');
const t0 = Date.now();
await goiY.click();

const bong = panel.locator('.bg-sand.rounded-bl-sm').last();
let chuDau = null;
let truoc = '';
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(500);
  const chu = (await bong.count()) ? (await bong.innerText()).trim() : '';
  if (chu && chuDau === null && !chu.includes('Đang soạn')) chuDau = Date.now() - t0;
  if (chu && chu === truoc && chu.length > 60) break;
  truoc = chu;
}

ok(chuDau !== null, 'Co cau tra loi', chuDau ? `chu dau sau ${(chuDau / 1000).toFixed(1)}s` : '');
ok(truoc.length > 60, 'Cau tra loi du dai', `${truoc.length} ky tu`);
ok(!truoc.startsWith('⚠️'), 'Khong phai thong bao loi');
ok(/Pro Max/i.test(truoc), 'Co nhac toi goi Pro Max');
ok(/\b20\b/.test(truoc), 'Co doi chieu voi han muc 20 ban cua goi Pro');
ok(!truoc.includes('**'), 'Da render chu dam, khong con dau sao tho');

console.log('\n--- CAU TRA LOI ---');
console.log(truoc.slice(0, 400));
console.log('-------------------');

await page.screenshot({ path: join(OUT, 'chat-tu-van.png') });
console.log(`\nAnh chup: ${join(OUT, 'chat-tu-van.png')}`);

await browser.close();
console.log(`\nTONG: ${cong.dat} dat · ${cong.hong} hong`);
process.exit(cong.hong > 0 ? 1 : 0);
