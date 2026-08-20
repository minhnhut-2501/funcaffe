/**
 * NHẬP tệp dữ liệu do scripts/xuat-mongo.mjs tạo ra vào MongoDB của máy này.
 *
 *     node scripts/nhap-mongo.mjs mongo-funcafe-2026-08-20.ndjson.gz
 *     node scripts/nhap-mongo.mjs tep.ndjson.gz --db=funcafe_thu --yes
 *
 * XÓA SẠCH từng collection có trong tệp rồi nạp lại, nên hỏi xác nhận trước khi làm.
 * Các collection KHÔNG có trong tệp thì không đụng tới.
 *
 * Sau khi nạp phải chạy lại `php artisan db:indexes`: xóa collection là xóa luôn chỉ
 * mục của nó, hệ thống vẫn chạy nhưng mọi truy vấn quay về quét toàn bộ dữ liệu.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline/promises';
import { EJSON } from 'bson';
import { thamSo, cauHinh, moKetNoi, che } from './mongo-chung.mjs';

const ts = thamSo();
const { dsn, db: tenDb } = cauHinh(ts);
const tep = ts.gia.tep ?? ts.viTri[0];

if (!tep) {
  console.error('Thiếu tệp dữ liệu.  Cách dùng: node scripts/nhap-mongo.mjs <tep.ndjson.gz>');
  process.exit(1);
}
if (!fs.existsSync(tep)) {
  console.error(`Không thấy tệp: ${tep}`);
  process.exit(1);
}

// Tệp cỡ vài MB nên đọc hết một lần: đổi lại là đếm được đầy đủ trước khi hỏi xác
// nhận, thay vì xóa nửa chừng rồi mới phát hiện tệp hỏng.
const tho = tep.endsWith('.gz')
  ? zlib.gunzipSync(fs.readFileSync(tep)).toString('utf8')
  : fs.readFileSync(tep, 'utf8');

const theo = new Map();
let soDong = 0;
for (const dong of tho.split('\n')) {
  if (!dong.trim()) continue;
  soDong++;
  let doc;
  try {
    doc = JSON.parse(dong);
  } catch {
    console.error(`Tệp hỏng ở dòng ${soDong}: không phải JSON. Nhờ người gửi xuất lại.`);
    process.exit(1);
  }
  if (doc.meta) continue; // dòng đầu là thông tin bản xuất
  if (!doc.c || !doc.d) {
    console.error(`Tệp sai định dạng ở dòng ${soDong}: thiếu tên collection hoặc dữ liệu.`);
    process.exit(1);
  }
  // Giải mã Extended JSON: chuỗi "$oid"/"$date" trở lại thành ObjectId/UTCDateTime.
  // Bỏ qua bước này là nạp vào toàn chuỗi, quan hệ giữa các collection đứt hết.
  if (!theo.has(doc.c)) theo.set(doc.c, []);
  theo.get(doc.c).push(EJSON.parse(JSON.stringify(doc.d), { relaxed: false }));
}

if (theo.size === 0) {
  console.error('Tệp không có document nào.');
  process.exit(1);
}

const ten = [...theo.keys()].sort((a, b) => a.localeCompare(b));
console.log(`Tệp   : ${tep}`);
console.log(`Đích  : ${che(dsn)} / ${tenDb}`);
console.log('');
for (const t of ten) console.log(`  ${t.padEnd(28)} ${String(theo.get(t).length).padStart(7)} document`);
console.log('');
console.log(`XÓA SẠCH ${ten.length} collection trên rồi nạp lại. Collection khác không bị đụng tới.`);

if (!ts.co.has('yes')) {
  const hoi = readline.createInterface({ input: process.stdin, output: process.stdout });
  const traLoi = (await hoi.question("Gõ 'dong y' để tiếp tục: ")).trim().toLowerCase();
  hoi.close();
  if (traLoi !== 'dong y') {
    console.log('Đã hủy, chưa thay đổi gì.');
    process.exit(0);
  }
}

const may = await moKetNoi(dsn);
const db = may.db(tenDb);

let tong = 0;
for (const t of ten) {
  await db.collection(t).drop().catch(() => {}); // chưa có thì thôi
  const docs = theo.get(t);
  // Chia lô: một lệnh insertMany quá lớn vượt trần 16 MB của một thông điệp BSON.
  for (let i = 0; i < docs.length; i += 500) {
    await db.collection(t).insertMany(docs.slice(i, i + 500), { ordered: false });
  }
  tong += docs.length;
  console.log(`  ${t.padEnd(28)} ${String(docs.length).padStart(7)} document đã nạp`);
}

await may.close();
console.log('');
console.log(`Xong: ${ten.length} collection, ${tong} document.`);
console.log('');
console.log('CÒN MỘT BƯỚC NỮA — xóa collection là xóa luôn chỉ mục của nó:');
console.log('  cd backend && php artisan db:indexes');
