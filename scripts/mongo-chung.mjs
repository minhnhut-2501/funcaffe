/**
 * Tiện ích dùng chung cho hai lệnh xuất/nhập dữ liệu MongoDB
 * (scripts/xuat-mongo.mjs và scripts/nhap-mongo.mjs).
 *
 * Không dùng thư viện dotenv: chỉ cần đọc đúng hai khóa MONGODB_* trong
 * backend/.env, mà tệp đó thì mỗi máy một khác nên không thể ghi cứng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

export const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Các collection KHÔNG xuất theo mặc định.
 *
 * personal_access_tokens là token đăng nhập — gửi nó đi nghĩa là gửi luôn quyền vào
 * tài khoản của mình, mà máy nhận cũng chẳng dùng được (họ đăng nhập lại là có token
 * mới). Còn lại là bảng kỹ thuật của Laravel, dựng lại được bằng migrate.
 *
 * Cần đủ mọi thứ thì thêm --tat-ca.
 */
export const BO_QUA = new Set([
  'personal_access_tokens',
  'sessions', 'cache', 'cache_locks',
  'jobs', 'job_batches', 'failed_jobs',
  'migrations',
]);

function docEnv(duongDan) {
  const kq = {};
  if (!fs.existsSync(duongDan)) return kq;
  for (const dong of fs.readFileSync(duongDan, 'utf8').split(/\r?\n/)) {
    const sach = dong.trim();
    if (!sach || sach.startsWith('#')) continue;
    const dau = sach.indexOf('=');
    if (dau < 0) continue;
    const ten = sach.slice(0, dau).trim();
    let giaTri = sach.slice(dau + 1).trim();
    if (giaTri.length > 1 && ((giaTri[0] === '"' && giaTri.at(-1) === '"') || (giaTri[0] === "'" && giaTri.at(-1) === "'"))) {
      giaTri = giaTri.slice(1, -1);
    }
    kq[ten] = giaTri;
  }
  return kq;
}

/** Tham số dòng lệnh: --ten=giatri, cờ --ten, phần còn lại là tham số vị trí. */
export function thamSo(argv = process.argv.slice(2)) {
  const co = new Set();
  const gia = {};
  const viTri = [];
  for (const t of argv) {
    if (!t.startsWith('--')) { viTri.push(t); continue; }
    const dau = t.indexOf('=');
    if (dau < 0) co.add(t.slice(2));
    else gia[t.slice(2, dau)] = t.slice(dau + 1);
  }
  return { co, gia, viTri };
}

/**
 * Chuỗi kết nối + tên CSDL, ưu tiên: tham số dòng lệnh > biến môi trường > backend/.env
 * > mặc định máy đơn. Nhờ vậy chạy sang một CSDL khác để thử không cần sửa .env.
 */
export function cauHinh(ts = thamSo()) {
  const env = docEnv(path.join(GOC, 'backend', '.env'));
  return {
    dsn: ts.gia.dsn ?? process.env.MONGODB_DSN ?? env.MONGODB_DSN ?? 'mongodb://127.0.0.1:27017',
    db: ts.gia.db ?? process.env.MONGODB_DATABASE ?? env.MONGODB_DATABASE ?? 'funcafe',
  };
}

/** Che mật khẩu trước khi in chuỗi kết nối ra màn hình (Atlas nhét nó vào URL). */
export function che(dsn) {
  return dsn.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:***@');
}

export async function moKetNoi(dsn) {
  const may = new MongoClient(dsn, { serverSelectionTimeoutMS: 8000 });
  try {
    await may.connect();
  } catch (e) {
    console.error(`\nKhông kết nối được MongoDB tại ${che(dsn)}`);
    console.error(`  ${e.message}`);
    console.error('  Kiểm tra dịch vụ MongoDB đã chạy chưa, hoặc truyền --dsn=... cho đúng máy chủ.\n');
    process.exit(1);
  }
  return may;
}

export function coCollection(danhSach, tatCa) {
  return danhSach
    .filter(ten => tatCa || !BO_QUA.has(ten))
    .sort((a, b) => a.localeCompare(b));
}
