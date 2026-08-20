/**
 * Dựng dự án trên MỘT MÁY MỚI vừa clone kho về.
 *
 *     node scripts/setup-may-moi.mjs             # kiểm tra rồi dựng những gì còn thiếu
 *     node scripts/setup-may-moi.mjs --kiem-tra  # chỉ kiểm tra, không đụng gì
 *     node scripts/setup-may-moi.mjs --seed      # dựng xong thì gieo luôn dữ liệu demo
 *
 * MỖI BƯỚC ĐỀU BỎ QUA NẾU ĐÃ XONG, nên chạy lại nhiều lần không hỏng gì: đây cũng là
 * cách kiểm tra nhanh "máy này còn thiếu thứ gì" trên máy đang chạy được.
 *
 * Việc script KHÔNG làm: điền khóa VNPay/MoMo/Gemini/Cloudinary (nằm trong backend/.env,
 * không có trong kho vì kho công khai) và cài PHP/MongoDB. Những thứ đó phải làm tay,
 * script chỉ chỉ ra chỗ thiếu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BE = path.join(GOC, 'backend');
const co = new Set(process.argv.slice(2).filter(t => t.startsWith('--')).map(t => t.slice(2)));
const chiKiemTra = co.has('kiem-tra');

const WIN = process.platform === 'win32';
let hong = 0;
const canLamTay = [];

const inTieuDe = t => console.log(`\n\x1b[1m${t}\x1b[0m`);
const ok = t => console.log(`  \x1b[32mv\x1b[0m ${t}`);
const bo = t => console.log(`  \x1b[90m.\x1b[0m ${t}`);
const loi = t => { console.log(`  \x1b[31mx\x1b[0m ${t}`); hong++; };

/**
 * Chạy lệnh qua shell dưới dạng MỘT chuỗi, không phải mảng tham số.
 *
 * Trên Windows các lệnh cần gọi đều là tệp bọc (`npm.cmd`, `composer.bat`) nên bắt buộc
 * qua shell; mà truyền mảng tham số kèm shell thì Node cảnh báo DEP0190 vì nó chỉ nối
 * chuỗi chứ không thoát ký tự. Ở đây lệnh do chính tệp này viết ra, không nhận gì từ
 * người dùng, nên nối sẵn thành chuỗi là xong.
 */
function hoi(lenh, cwd = GOC) {
  const kq = spawnSync(lenh, { cwd, encoding: 'utf8', shell: true });
  if (kq.status !== 0) return null;
  return (kq.stdout ?? '').trim();
}

/** Như trên, nhưng cho lệnh in thẳng ra màn hình (bước dựng lâu, cần thấy tiến độ). */
function chay(lenh, cwd = GOC) {
  console.log(`  \x1b[36m$\x1b[0m ${lenh}`);
  const kq = spawnSync(lenh, { cwd, stdio: 'inherit', shell: true });
  if (kq.status !== 0) { loi(`lệnh thất bại: ${lenh}`); return false; }
  return true;
}

// ---------------------------------------------------------------- 1. Công cụ
inTieuDe('1. Công cụ trên máy');

const nodeV = process.versions.node;
if (Number(nodeV.split('.')[0]) >= 20) ok(`Node ${nodeV}`);
else loi(`Node ${nodeV} — cần 20 trở lên`);

const phpV = hoi('php -r "echo PHP_VERSION;"');
if (!phpV) {
  loi('PHP chưa cài (hoặc chưa có trong PATH) — cần PHP 8.3');
  canLamTay.push('Cài PHP 8.3 rồi thêm vào PATH');
} else {
  const [ln, nho] = phpV.split('.').map(Number);
  if (ln > 8 || (ln === 8 && nho >= 3)) ok(`PHP ${phpV}`);
  else loi(`PHP ${phpV} — cần 8.3 trở lên`);

  // Phần mở rộng mongodb là thứ hay thiếu nhất: composer install vẫn chạy được,
  // nhưng mọi lệnh artisan chạm CSDL thì chết ngay.
  const dsExt = hoi('php -m') ?? '';
  if (/^mongodb$/im.test(dsExt)) ok('Phần mở rộng PHP mongodb');
  else {
    loi('Thiếu phần mở rộng PHP "mongodb"');
    canLamTay.push(
      WIN
        ? 'Tải php_mongodb.dll khớp phiên bản PHP (x64, TS/NTS) ở pecl.php.net/package/mongodb, bỏ vào thư mục ext\\ rồi thêm dòng extension=mongodb vào php.ini'
        : 'Cài phần mở rộng: sudo pecl install mongodb rồi thêm extension=mongodb vào php.ini',
    );
  }
}

// Composer chỉ cần khi backend/vendor còn thiếu, nên kiểm ở mục 3 chứ không phải ở đây:
// máy đã cài xong thư viện rồi mà báo "thiếu Composer" thì chỉ làm người ta hoang mang.

// -------------------------------------------------------------- 2. Frontend
inTieuDe('2. Frontend');

if (fs.existsSync(path.join(GOC, 'node_modules'))) bo('node_modules đã có — bỏ qua npm install');
else if (chiKiemTra) loi('chưa cài gói npm');
else chay('npm install');

const envLocal = path.join(GOC, '.env.local');
if (fs.existsSync(envLocal)) bo('.env.local đã có');
else if (chiKiemTra) loi('thiếu .env.local');
else {
  fs.writeFileSync(envLocal,
    'NEXT_PUBLIC_API_URL=http://localhost:8000/api\n' +
    'NEXT_PUBLIC_STORAGE_URL=http://localhost:8000\n');
  ok('đã tạo .env.local trỏ về API ở cổng 8000');
}

// --------------------------------------------------------------- 3. Backend
inTieuDe('3. Backend');

if (fs.existsSync(path.join(BE, 'vendor'))) {
  bo('backend/vendor đã có — bỏ qua composer install');
} else if (chiKiemTra) {
  loi('chưa cài gói composer (backend/vendor trống)');
} else if (hoi('composer --version')) {
  chay('composer install', BE);
} else {
  loi('cần cài thư viện PHP nhưng máy chưa có Composer');
  canLamTay.push('Cài Composer 2 ở getcomposer.org rồi chạy lại lệnh này');
}

const envBE = path.join(BE, '.env');
if (fs.existsSync(envBE)) bo('backend/.env đã có');
else if (chiKiemTra) loi('thiếu backend/.env');
else {
  fs.copyFileSync(path.join(BE, '.env.example'), envBE);
  ok('đã tạo backend/.env từ .env.example');
  canLamTay.push('Điền khóa VNPAY_*, MOMO_*, GEMINI_API_KEY, CLOUDINARY_URL, MAIL_* vào backend/.env (xin của người giữ dự án — kho công khai nên không có sẵn)');
  if (WIN) canLamTay.push('Windows: tải cacert.pem rồi trỏ CA_BUNDLE tới nó, không thì gọi Gemini/MoMo báo cURL error 60');
}

if (fs.existsSync(envBE)) {
  const noiDung = fs.readFileSync(envBE, 'utf8');
  if (/^APP_KEY=.+$/m.test(noiDung)) bo('APP_KEY đã có');
  else if (chiKiemTra) loi('APP_KEY còn rỗng');
  else chay('php artisan key:generate', BE);
}

// Tệp SQLite (chỉ giữ bảng token của Sanctum) không nằm trong kho. Thiếu nó thì lệnh
// migrate dừng lại hỏi "tạo không?" và treo khi chạy tự động.
const sqlite = path.join(BE, 'database', 'database.sqlite');
if (fs.existsSync(sqlite)) bo('database/database.sqlite đã có');
else if (chiKiemTra) loi('thiếu database/database.sqlite');
else { fs.writeFileSync(sqlite, ''); ok('đã tạo database/database.sqlite'); }

if (!chiKiemTra && fs.existsSync(envBE)) chay('php artisan migrate --force', BE);

// --------------------------------------------------------------- 4. MongoDB
inTieuDe('4. MongoDB');

let mongoOk = false;
let soCollection = 0;
try {
  const { cauHinh, che } = await import('./mongo-chung.mjs');
  const { MongoClient } = await import('mongodb');
  const { dsn, db } = cauHinh({ co: new Set(), gia: {}, viTri: [] });
  const may = new MongoClient(dsn, { serverSelectionTimeoutMS: 5000 });
  try {
    await may.connect();
    soCollection = (await may.db(db).listCollections().toArray()).length;
    ok(`Kết nối được ${che(dsn)} / ${db} — ${soCollection} collection`);
    mongoOk = true;
  } finally {
    await may.close().catch(() => {});
  }
} catch (e) {
  loi(`Không kết nối được MongoDB: ${e.message}`);
  canLamTay.push('Cài và khởi động MongoDB 6+ (máy đơn là đủ), hoặc sửa MONGODB_DSN trong backend/.env');
}

if (mongoOk && !chiKiemTra) {
  if (soCollection === 0 || co.has('seed')) {
    chay('php artisan db:seed --force', BE);
    if (co.has('seed')) {
      // DemoSeeder XÓA SẠCH rồi gieo lại, nên chỉ chạy khi được yêu cầu thẳng.
      chay('php artisan db:seed --class=DemoSeeder --force', BE);
    } else {
      canLamTay.push('Muốn dữ liệu demo đầy đủ: php artisan db:seed --class=DemoSeeder (XÓA SẠCH rồi gieo lại), hoặc xin tệp mongo-*.ndjson.gz rồi node scripts/nhap-mongo.mjs <tệp>');
    }
  } else {
    bo(`CSDL đã có ${soCollection} collection — không gieo lại`);
  }
  chay('php artisan db:indexes', BE);
}

// ------------------------------------------------------------------ Tóm tắt
inTieuDe('Tóm tắt');
if (hong === 0) console.log('  Không thiếu gì. Chạy: npm run dev  và  cd backend && php artisan serve');
else console.log(`  \x1b[31m${hong} chỗ chưa đạt\x1b[0m — xem các dòng x ở trên.`);

if (canLamTay.length) {
  console.log('\n  Việc phải làm tay:');
  canLamTay.forEach((v, i) => console.log(`    ${i + 1}. ${v}`));
}
console.log('');
process.exit(hong === 0 ? 0 : 1);
