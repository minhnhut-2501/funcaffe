/**
 * Mở trang thanh toán MoMo sandbox và đọc xem nó cho những cách trả nào.
 *
 * MoMo có hai kiểu yêu cầu:
 *   captureWallet — quét QR bằng ỨNG DỤNG MoMo Test trên điện thoại
 *   payWithATM    — nhập thẻ ATM ngay trên trình duyệt
 * Kiểu nào đang bật quyết định có tự động hoá được hay không.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) { console.error('Thiếu URL'); process.exit(1); }

const trinhDuyet = await chromium.launch({ channel: 'msedge', headless: true });
const trang = await trinhDuyet.newPage();
await trang.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await trang.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
await trang.waitForTimeout(3000);

console.log('URL   :', trang.url());
console.log('Tiêu đề:', await trang.title());

const soDo = await trang.evaluate(() => ({
  chu: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 900),
  o_nhap: [...document.querySelectorAll('input')]
    .map((e) => `${e.id || e.name || '?'} [${e.type}] ph="${e.placeholder || ''}"`).slice(0, 20),
  co_qr: !!document.querySelector('canvas, img[src*="qr" i], [class*="qr" i]'),
}));
console.log('\n--- CÓ MÃ QR? ---', soDo.co_qr ? 'CÓ' : 'không');
console.log('\n--- Ô NHẬP ---\n' + (soDo.o_nhap.join('\n') || '(không có ô nhập nào)'));
console.log('\n--- CHỮ TRÊN TRANG ---\n' + soDo.chu);

await trang.screenshot({ path: 'scripts/.kt-momo.png', fullPage: true });
console.log('\nẢnh: scripts/.kt-momo.png');
await trinhDuyet.close();
