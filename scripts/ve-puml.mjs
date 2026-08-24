/**
 * Dựng ảnh PNG cho các sơ đồ PlantUML trong doc/ (use case, biểu đồ trạng thái).
 *
 * Máy này không có Java nên không chạy được plantuml.jar — script gửi mã sang máy
 * chủ công khai plantuml.com và tải ảnh về. Chạy TAY lúc cập nhật tài liệu, không
 * nằm trong luồng dựng, nên phụ thuộc mạng ở đây là chấp nhận được.
 *
 * Cũng là bước KIỂM CÚ PHÁP: máy chủ trả về ảnh "Syntax Error" thay vì báo lỗi HTTP,
 * nên script tải kèm bản SVG và soi chữ trong đó — sai cú pháp là thoát khác 0 chứ
 * không lẳng lặng ghi ra một tấm ảnh lỗi.
 *
 *   node scripts/ve-puml.mjs
 */
import { deflateRawSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const MAY_CHU = 'https://www.plantuml.com/plantuml';
const BANG = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/** Base64 biến thể của PlantUML — khác bảng chữ cái chuẩn, không dùng btoa được. */
function maHoa(txt) {
  const b = deflateRawSync(Buffer.from(txt, 'utf8'), { level: 9 });
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const [x, y, z] = [b[i], b[i + 1] ?? 0, b[i + 2] ?? 0];
    out += BANG[x >> 2] + BANG[((x & 0x3) << 4) | (y >> 4)]
         + BANG[((y & 0xf) << 2) | (z >> 6)] + BANG[z & 0x3f];
  }
  return out;
}

const TEP = [
  ['doc/usecase-user.puml', 'doc/report-shots/usecase-user.png'],
  ['doc/usecase-nhanvien.puml', 'doc/report-shots/usecase-nhanvien.png'],
  ['doc/usecase-admin.puml', 'doc/report-shots/usecase-admin.png'],
  ['doc/statechart-order.puml', 'doc/report-shots/statechart-order.png'],
];

let hong = 0;
for (const [nguon, dich] of TEP) {
  const ma = maHoa(await (await import('node:fs/promises')).readFile(nguon, 'utf8'));

  const svg = await (await fetch(`${MAY_CHU}/svg/${ma}`)).text();
  if (/Syntax Error|cannot be parsed/i.test(svg)) {
    const chiTiet = svg.match(/>([^<]*(?:Syntax Error|cannot be parsed)[^<]*)</i)?.[1] ?? '';
    console.error(`  ✗ ${nguon} — PlantUML báo sai cú pháp. ${chiTiet}`);
    hong++;
    continue;
  }

  const png = Buffer.from(await (await fetch(`${MAY_CHU}/png/${ma}`)).arrayBuffer());
  writeFileSync(dich, png);
  console.log(`  ✓ ${dich}  (${(png.length / 1024).toFixed(0)} KB)`);
}
process.exit(hong ? 1 : 0);
