/**
 * Dựng logo FunCafe dạng PNG để nhúng vào email.
 *
 * Vì sao cần PNG riêng thay vì dùng thẳng public/favicon.svg:
 *   - Hầu hết ứng dụng mail (Gmail, Outlook) KHÔNG hiển thị SVG.
 *   - Logo gốc là ô vuông XANH, đặt lên nền xanh của đầu thư sẽ chìm mất.
 *     Bản dùng cho email đảo màu: ô trắng, ly cà phê xanh.
 *
 * Chạy: MSYS_NO_PATHCONV=1 node scripts/make-mail-logo.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEST = 'backend/resources/mail-assets';
const SIZE = 144; // hiển thị ở 48px, gấp 3 cho màn hình mật độ cao

const svg = `
<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="180" rx="40" fill="#FFFFFF"/>
  <g transform="translate(90 90) scale(5.6) translate(-12 -11.5)"
     fill="none" stroke="#2563EB" stroke-width="2.2"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2v2"/>
    <path d="M14 2v2"/>
    <path d="M6 2v2"/>
    <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>
  </g>
</svg>`;

mkdirSync(DEST, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.setContent(
  `<body style="margin:0;background:transparent">${svg.replace('width="180" height="180"', `width="${SIZE}" height="${SIZE}"`)}</body>`,
);
await page.waitForTimeout(300);
await page.screenshot({ path: `${DEST}/logo-funcafe.png`, omitBackground: true });
await browser.close();

console.log(`đã dựng ${DEST}/logo-funcafe.png (${SIZE}x${SIZE})`);
