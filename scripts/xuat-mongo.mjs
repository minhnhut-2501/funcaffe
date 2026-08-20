/**
 * XUẤT dữ liệu MongoDB của máy này ra MỘT tệp để gửi cho người khác.
 *
 *     node scripts/xuat-mongo.mjs
 *     node scripts/xuat-mongo.mjs --ra=D:\funcafe.ndjson.gz --tat-ca
 *     node scripts/xuat-mongo.mjs --dsn=mongodb://127.0.0.1:27017 --db=funcafe_thu
 *
 * Định dạng: NDJSON nén gzip — mỗi dòng một document, kèm tên collection. Dùng
 * Extended JSON dạng canonical (`relaxed: false`) chứ KHÔNG phải JSON.stringify:
 * JSON thường biến ObjectId thành chuỗi và UTCDateTime thành chuỗi ISO, nạp lại là
 * mọi khóa ngoại đứt ngầm và mọi truy vấn theo khoảng ngày trả về rỗng — hỏng im
 * lặng, không báo lỗi dòng nào.
 *
 * Gzip lấy từ zlib có sẵn của Node nên không cần cài thêm công cụ nén, và tệp ra chỉ
 * một cái để gửi qua Zalo/Drive.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { once } from 'node:events';
import { EJSON } from 'bson';
import { thamSo, cauHinh, moKetNoi, che, coCollection } from './mongo-chung.mjs';

const ts = thamSo();
const { dsn, db: tenDb } = cauHinh(ts);
const tatCa = ts.co.has('tat-ca');

const ngay = new Date().toISOString().slice(0, 10);
const tepRa = ts.gia.ra ?? ts.viTri[0] ?? `mongo-${tenDb}-${ngay}.ndjson.gz`;

const may = await moKetNoi(dsn);
const db = may.db(tenDb);

const tenCollection = coCollection((await db.listCollections().toArray()).map(c => c.name), tatCa);
if (tenCollection.length === 0) {
  console.error(`CSDL "${tenDb}" không có collection nào để xuất.`);
  await may.close();
  process.exit(1);
}

console.log(`Nguồn : ${che(dsn)} / ${tenDb}`);
console.log(`Tệp ra: ${tepRa}`);
console.log('');

const nen = zlib.createGzip({ level: 9 });
const tep = fs.createWriteStream(tepRa);
nen.pipe(tep);

// Ghi có kiểm soát áp lực ngược: dữ liệu đọc từ Mongo nhanh hơn tốc độ nén + ghi đĩa,
// cứ write() liên tục là bộ đệm phình ra tới lúc hết RAM.
async function ghi(dong) {
  if (!nen.write(dong)) await once(nen, 'drain');
}

await ghi(JSON.stringify({
  meta: { loai: 'funcafe-mongo', phien_ban: 1, csdl: tenDb, luc: new Date().toISOString() },
}) + '\n');

let tong = 0;
for (const ten of tenCollection) {
  let dem = 0;
  const con = db.collection(ten).find({});
  for await (const doc of con) {
    await ghi(`{"c":${JSON.stringify(ten)},"d":${EJSON.stringify(doc, { relaxed: false })}}\n`);
    dem++;
  }
  tong += dem;
  console.log(`  ${ten.padEnd(28)} ${String(dem).padStart(7)} document`);
}

nen.end();
await once(tep, 'finish');
await may.close();

const co = fs.statSync(tepRa).size;
console.log('');
console.log(`Xong: ${tenCollection.length} collection, ${tong} document, ${(co / 1024 / 1024).toFixed(2)} MB.`);
if (!tatCa) console.log('(Bỏ qua token đăng nhập và các bảng kỹ thuật của Laravel — thêm --tat-ca nếu cần đủ.)');
console.log('');
console.log('Gửi tệp này cho thành viên, rồi bảo họ chạy:');
console.log(`  node scripts/nhap-mongo.mjs ${tepRa}`);
