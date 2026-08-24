/**
 * Dựng ảnh PNG cho từng sơ đồ trong doc/erd-drawio.mmd.
 *
 * Tệp .mmd chứa NHIỀU khối `erDiagram` (1 tổng quan + 3 cụm) — mermaid chỉ nhận
 * một sơ đồ mỗi lần vẽ, nên ở đây cắt tệp theo từng khối rồi vẽ riêng.
 *
 * Cũng là bước KIỂM CÚ PHÁP: mermaid vẽ hỏng thì in lỗi và thoát khác 0, nên
 * không thể lỡ commit một sơ đồ không mở được.
 *
 *   node scripts/ve-erd.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = 'doc/report-shots';
const TEN = ['erd-0-tong-quan', 'erd-1-tai-khoan-goi', 'erd-2-quan-thuc-don', 'erd-3-ban-hang'];

const nguon = readFileSync('doc/erd-drawio.mmd', 'utf8');
const dong = nguon.split(/\r?\n/);
const moc = dong.map((d, i) => (d.trim() === 'erDiagram' ? i : -1)).filter((i) => i >= 0);
if (moc.length !== TEN.length) {
  console.error(`Cần ${TEN.length} khối erDiagram, tệp đang có ${moc.length}`);
  process.exit(1);
}
// Cắt tới sát dòng có nội dung cuối cùng: khối nào cũng dính phần chú thích tiêu đề
// của sơ đồ kế tiếp, mà mermaid coi `%%` đứng sau thân sơ đồ là lỗi cú pháp.
const khoi = moc.map((bd, k) => {
  let cuoi = moc[k + 1] ?? dong.length;
  while (cuoi > bd && (dong[cuoi - 1].trim() === '' || dong[cuoi - 1].trim().startsWith('%%'))) cuoi--;
  return dong.slice(bd, cuoi).join('\n');
});

mkdirSync(OUT, { recursive: true });
// mermaid tải từ CDN: dự án không có gói này trong node_modules và cũng không cần —
// đây là script chạy tay lúc cập nhật tài liệu, không nằm trong luồng dựng.
const html = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>body{margin:0;background:#fff;font-family:'Segoe UI',sans-serif}
.o{display:inline-block;padding:24px}</style></head>
<body><div id="k"></div><script>
  mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose',
    themeVariables: { primaryColor: '#F5EFE6', primaryBorderColor: '#6F4E37',
      primaryTextColor: '#3B2314', lineColor: '#8B6F52', fontSize: '15px' } });
  window.ve = async (ma, i) => {
    const { svg } = await mermaid.render('d' + i, ma);
    document.getElementById('k').innerHTML = '<div class="o">' + svg + '</div>';
    // mermaid đặt max-width theo bề rộng khung nhìn -> ảnh chụp ra bị ép còn ~350px
    // và chữ nhòe. Trả kích thước về đúng viewBox rồi mới chụp.
    const s = document.querySelector('.o svg');
    const vb = s.getAttribute('viewBox').split(/\\s+/).map(Number);
    s.style.maxWidth = 'none';
    s.setAttribute('width', vb[2]);
    s.setAttribute('height', vb[3]);
  };
</script></body></html>`;
// Trang tạm để ngoài OUT: OUT là thư mục ảnh đi vào báo cáo, đừng để lẫn rác vào đó.
const tmp = join(tmpdir(), 'funcafe-mermaid.html');
writeFileSync(tmp, html);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 2 });
const loi = [];
page.on('pageerror', (e) => loi.push(e.message));
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });

let hong = 0;
for (const [i, ma] of khoi.entries()) {
  loi.length = 0;
  try {
    await page.evaluate(([m, k]) => window.ve(m, k), [ma, i]);
  } catch (e) {
    console.error(`  ✗ ${TEN[i]} — mermaid không vẽ được:\n${e.message}`);
    hong++;
    continue;
  }
  const el = await page.$('.o');
  await el.screenshot({ path: `${OUT}/${TEN[i]}.png` });
  const b = await el.boundingBox();
  console.log(`  ✓ ${TEN[i]}  (${Math.round(b.width)}×${Math.round(b.height)})`);
}
await browser.close();
process.exit(hong ? 1 : 0);
