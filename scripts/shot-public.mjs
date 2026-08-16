/**
 * Chụp + kiểm tra các trang public ở nhiều bề rộng.
 * Chạy: node scripts/shot-public.mjs   (cần dev server ở :3000)
 */
import { chromium } from 'playwright-core';
import { mkdirSync, mkdtempSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
// Đọc từ môi trường như mọi script kiểm khác: bản dev chạy 3000, nhưng muốn soi đúng
// thứ sắp đưa lên mạng thì phải chạy trên bản đã dựng (`next start -p 3100`).
const BASE = process.env.BASE ?? 'http://localhost:3000';
const DEST = 'design-shots/public-audit';
// Ghi thẳng vào project sẽ làm Next dev rebuild giữa chừng -> Fast Refresh remount
// component -> state (menu đang mở) bị reset và phép kiểm báo sai.
const OUT = mkdtempSync(join(tmpdir(), 'funcafe-public-'));

const routes = [
  ['home', '/'],
  ['features', '/features'],
  ['pricing', '/pricing'],
  ['support', '/support'],
  ['contact', '/contact'],
  ['login', '/login'],
];
const widths = [390, 768, 1440];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const problems = [];

for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: w < 500 ? 844 : 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  for (const [name, path] of routes) {
    consoleErrors.length = 0;
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    // Cho reveal-on-scroll chạy hết rồi mới chụp toàn trang
    await page.evaluate(async () => {
      // Bước nhỏ + chờ lâu hơn: ảnh lazy load xong sẽ đẩy nội dung dài ra,
      // bước nhảy lớn dễ vượt qua một section mà chưa kịp kích hoạt reveal.
      const step = window.innerHeight * 0.45;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 220));
      }
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 500));
      // Đợi mọi ảnh tải xong rồi mới chụp
      await Promise.all(
        [...document.images].filter((i) => !i.complete).map(
          (i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); })
        )
      );
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 600));
    });

    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const over = de.scrollWidth - de.clientWidth;
      if (over <= 1) return null;
      // Tìm thủ phạm: phần tử vượt quá mép phải viewport
      const guilty = [...document.querySelectorAll('*')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.right > de.clientWidth + 1)
        .slice(0, 5)
        .map(({ el, r }) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} (right=${Math.round(r.right)})`);
      return { over, guilty };
    });
    if (overflow) problems.push(`[${w}px] ${path} tràn ngang ${overflow.over}px → ${overflow.guilty.join(' | ')}`);
    if (consoleErrors.length) problems.push(`[${w}px] ${path} console error: ${consoleErrors.slice(0, 2).join(' / ')}`);

    await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
  }

  // Trạng thái mở menu trên di động
  if (w === 390) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    // Bấm quá sớm sẽ trúng HTML chưa hydrate (chưa có handler) -> thử lại vài lần
    let expanded = 'false';
    for (let t = 0; t < 5 && expanded !== 'true'; t++) {
      await page.waitForTimeout(600);
      await page.click('button[aria-controls="mobile-nav"]');
      await page.waitForTimeout(400);
      expanded = await page.getAttribute('button[aria-controls="mobile-nav"]', 'aria-expanded');
    }
    const locked = await page.evaluate(() => getComputedStyle(document.body).overflow);
    if (expanded !== 'true') problems.push('[390px] nút menu không đặt aria-expanded=true');
    if (locked !== 'hidden') problems.push(`[390px] nền không khoá cuộn khi mở menu (overflow=${locked})`);
    await page.screenshot({ path: `${OUT}/home-390-menu.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const afterEsc = await page.getAttribute('button[aria-controls="mobile-nav"]', 'aria-expanded');
    if (afterEsc !== 'false') problems.push('[390px] phím Esc không đóng menu');
  }

  await ctx.close();
}

await browser.close();

mkdirSync(DEST, { recursive: true });
for (const f of readdirSync(OUT)) copyFileSync(join(OUT, f), join(DEST, f));
console.log(`đã lưu ${readdirSync(OUT).length} ảnh vào ${DEST}`);

console.log(problems.length ? 'VẤN ĐỀ:\n' + problems.map((p) => ' - ' + p).join('\n') : 'OK: không tràn ngang, không lỗi console, menu di động đạt.');
