/**
 * Dựng favicon.ico + apple-touch-icon.png TỪ CHÍNH public/favicon.svg.
 *
 * Vẽ lại bằng tay thì hai tệp sẽ trôi khỏi nhau lúc nào không biết. Sinh ra từ một
 * nguồn duy nhất thì sửa logo chỉ cần sửa .svg rồi chạy lại kịch bản này.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const GOC = 'c:/FunCafe';
const SVG = fs.readFileSync(path.join(GOC, 'public/favicon.svg'), 'utf8');

// 16 và 32 là cỡ thẻ trình duyệt thật dùng; 48 cho lối tắt Windows; 180 cho iOS.
const CO_ICO = [16, 32, 48];
const CO_PNG = { 'apple-touch-icon.png': 180 };

const trang = (n) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}
svg{display:block;width:${n}px;height:${n}px}</style>${SVG}`;

/**
 * Gói các PNG thành một tệp .ico.
 *
 * ICO cho phép nhét thẳng PNG vào từ Windows Vista trở đi, nên không cần dựng BMP.
 * Bố cục: ICONDIR 6 byte, rồi mỗi ảnh một ICONDIRENTRY 16 byte, rồi tới dữ liệu.
 */
function dongGoiIco(anhs) {
  const dau = Buffer.alloc(6);
  dau.writeUInt16LE(0, 0);            // dự trữ, luôn 0
  dau.writeUInt16LE(1, 2);            // 1 = icon (2 là con trỏ chuột)
  dau.writeUInt16LE(anhs.length, 4);

  const muc = [];
  // Dữ liệu ảnh nằm sau phần đầu và TOÀN BỘ bảng mục lục, nên phải tính sẵn.
  let viTri = 6 + anhs.length * 16;

  for (const { co, du_lieu } of anhs) {
    const m = Buffer.alloc(16);
    m.writeUInt8(co >= 256 ? 0 : co, 0);  // 256 được ghi là 0 vì trường chỉ 1 byte
    m.writeUInt8(co >= 256 ? 0 : co, 1);
    m.writeUInt8(0, 2);                   // số màu bảng màu (0 = không dùng bảng màu)
    m.writeUInt8(0, 3);                   // dự trữ
    m.writeUInt16LE(1, 4);                // số mặt phẳng màu
    m.writeUInt16LE(32, 6);               // bit mỗi điểm ảnh
    m.writeUInt32LE(du_lieu.length, 8);
    m.writeUInt32LE(viTri, 12);
    viTri += du_lieu.length;
    muc.push(m);
  }
  return Buffer.concat([dau, ...muc, ...anhs.map((a) => a.du_lieu)]);
}

const trinhDuyet = await chromium.launch({ channel: 'msedge' });
const trangWeb = await trinhDuyet.newPage();

async function ve(n) {
  await trangWeb.setViewportSize({ width: n, height: n });
  await trangWeb.setContent(trang(n));
  // omitBackground giữ 4 góc bo trong suốt, không thì chúng hoá thành ô trắng.
  return await trangWeb.screenshot({ omitBackground: true });
}

const anhs = [];
for (const co of CO_ICO) anhs.push({ co, du_lieu: await ve(co) });

const duongIco = path.join(GOC, 'public/favicon.ico');
fs.writeFileSync(duongIco, dongGoiIco(anhs));
console.log(`favicon.ico        ${CO_ICO.join('/')}px  ${fs.statSync(duongIco).size} byte`);

for (const [ten, co] of Object.entries(CO_PNG)) {
  const d = path.join(GOC, 'public', ten);
  fs.writeFileSync(d, await ve(co));
  console.log(`${ten.padEnd(19)}${co}px  ${fs.statSync(d).size} byte`);
}

await trinhDuyet.close();
