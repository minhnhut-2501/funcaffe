/**
 * Xem thử mẫu email trả lời tin nhắn Liên hệ.
 *
 * Dựng HTML trước bằng:
 *   cd backend && php artisan tinker --execute="... view('emails.contact-reply') ..."
 * rồi chạy:  MSYS_NO_PATHCONV=1 node scripts/shot-mail.mjs <duong-dan-html> <duong-dan-png>
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [src, dest] = process.argv.slice(2);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 820, height: 1200 }, deviceScaleFactor: 2 });
await page.goto('file:///' + src.replace(/\\/g, '/'));
await page.waitForTimeout(700);
await page.screenshot({ path: dest, fullPage: true });
await browser.close();
console.log('đã lưu', dest);
