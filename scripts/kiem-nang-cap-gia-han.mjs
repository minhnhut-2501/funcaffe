/**
 * Kiem NANG CAP · GIA HAN · CAN TRU tren BAN TRIEN KHAI, cong viec 8.7.3.
 *
 * Cong thuc can tru khi nang cap giua ky (SubscriptionController::calculateProratedCredit):
 *
 *     can_tru = lam_tron( da_tra * (giay_con_lai / tong_so_giay) ),  toi da = gia goi moi
 *
 * Script tu tinh lai con so do bang tay roi doi chieu voi con so may chu tra ve. Chi
 * kiem "co khac 0" thi khong phat hien duoc sai lech ti le — ma sai ti le la sai TIEN.
 *
 * Chay:
 *   USER_EMAIL=... USER_PASS=... node scripts/kiem-nang-cap-gia-han.mjs
 *
 * MAC DINH CHI DOC: dung /subscriptions/preview, endpoint co cam ghi CSDL.
 * Bat --tai-khoan-test de them phan CO GHI: tao mot tai khoan test moi, mot quan,
 * nhan goi dung thu, roi tao mot don VNPay de doc duong tra ve cua cong.
 */
const API = process.env.API ?? 'https://funcaffe.onrender.com/api';
const CO_GHI = process.argv.includes('--tai-khoan-test');

const cong = { dat: 0, hong: 0 };
const ok = (dieuKien, chu, them = '') => {
  cong[dieuKien ? 'dat' : 'hong']++;
  console.log(`  ${dieuKien ? 'DAT ' : 'HONG'}  ${chu}${them ? ' — ' + them : ''}`);
};
const tien = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' d';

/**
 * Goi API, co thu lai khi may chu chua thuc day.
 *
 * May chu mien phi cua Render ngu sau ~15' khong ai dung, va trong luc no thuc day
 * Cloudflare tra ve 502/520 chu khong phai phan hoi cua ung dung. Khong thu lai thi
 * moi lan kiem sau mot dem deu bao "hong" o buoc dau tien — mot ket qua sai, va la
 * loai sai lam nguoi ta thoi tin vao bo kiem.
 */
async function goi(duong, { token, method = 'GET', body, thuLai = 4 } = {}) {
  for (let lan = 1; ; lan++) {
    const res = await fetch(API + duong, {
      method,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const noiDung = await res.json().catch(() => null);
    // CHI thu lai voi loi ha tang (>=502). Loi 4xx la cau tra loi that cua ung dung
    // — thu lai chi che mat no.
    if (res.status >= 502 && lan <= thuLai) {
      console.log(`  ... may chu chua san sang (HTTP ${res.status}), doi 20s roi thu lai (${lan}/${thuLai})`);
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    return { status: res.status, body: noiDung };
  }
}

/** Xem truoc: la GET kem tham so truy van, khong phai POST (routes/api.php:137). */
const xemTruoc = (cid, goiId, mocId, token) =>
  goi(`/cafes/${cid}/subscriptions/preview?package_id=${goiId}&time_subscription_id=${mocId}`, { token })
    .then((r) => r.body);

/** Cong thuc can tru, viet lai doc lap voi may chu de doi chieu. */
function canTruTinhTay(sub, giaGoiMoi) {
  const daTra = Number(sub.total_amount ?? 0);
  if (daTra <= 0) return 0;
  const batDau = new Date(sub.start_date).getTime();
  const ketThuc = new Date(sub.end_date).getTime();
  const bayGio = Date.now();
  if (ketThuc <= bayGio) return 0;
  const tong = ketThuc - batDau;
  if (tong <= 0) return 0;
  const tiLe = Math.min(1, Math.max(0, (ketThuc - bayGio) / tong));
  return Math.min(Math.round(daTra * tiLe), giaGoiMoi);
}

const dangNhap = await goi('/auth/login', { method: 'POST', body: { email: process.env.USER_EMAIL, password: process.env.USER_PASS } });
if (!dangNhap.body?.token) { console.error('Khong dang nhap duoc:', dangNhap.body); process.exit(1); }
const token = dangNhap.body.token;

const goiDichVu = (await goi('/packages')).body;
const proGoi = goiDichVu.find((p) => p.type === 'pro');
const promaxGoi = goiDichVu.find((p) => p.type === 'promax');
const freeGoi = goiDichVu.find((p) => p.is_trial);
const mocCua = async (p) => (await goi(`/packages/${p.id}/time-subscriptions`)).body;
const mocPro = await mocCua(proGoi);
const mocPromax = await mocCua(promaxGoi);
const VAT = 10; // config('funcafe.vat_rate')
const gomVat = (gia) => gia + Math.round((gia * VAT) / 100);

// ===== A · XEM TRUOC TREN QUAN THAT (khong ghi gi) ========================
console.log('\nA · Nang cap / gia han tren cac quan that (chi doc)');
const quan = (await goi('/cafes', { token })).body;

for (const c of quan) {
  const cid = c.id ?? c._id;
  const sub = (await goi(`/cafes/${cid}/subscriptions/active`, { token })).body;
  if (!sub?.package_name_snapshot) { console.log(`\n  ${c.name}: chua co goi nao — bo qua`); continue; }

  const conHan = new Date(sub.end_date) > new Date();
  console.log(`\n  ${c.name} · dang ${sub.package_name_snapshot} · den ${String(sub.end_date).slice(0, 10)}` +
    ` · da tra ${tien(sub.total_amount ?? 0)}${conHan ? '' : ' (DA HET HAN)'}`);

  // -- Gia han: cung goi, cung cap bac -> khong duoc can tru dong nao ------
  const dangDung = goiDichVu.find((p) => p.name === sub.package_name_snapshot);
  if (dangDung && !dangDung.is_trial) {
    const moc = await mocCua(dangDung);
    const xem = await xemTruoc(cid, dangDung.id, moc[0].id, token);
    ok(xem?.action_type === 'renew', `gia han ${dangDung.name}: nhan dung la GIA HAN`, `may chu noi: ${xem?.action_type}`);
    ok(xem?.credit === 0, 'gia han KHONG can tru', `can tru ${tien(xem?.credit ?? -1)}`);
    ok(xem?.payable === gomVat(moc[0].price), 'phai tra dung gia niem yet + VAT',
      `${tien(xem?.payable)} (gia ${tien(moc[0].price)} + ${VAT}% VAT)`);
  }

  // -- Nang cap len Pro Max ------------------------------------------------
  if (sub.package_name_snapshot !== promaxGoi.name) {
    const xem = await xemTruoc(cid, promaxGoi.id, mocPromax[0].id, token);
    const gross = gomVat(mocPromax[0].price);
    const tuTinh = canTruTinhTay(sub, gross);
    ok(xem?.action_type === 'upgrade', 'len Pro Max: nhan dung la NANG CAP', `may chu noi: ${xem?.action_type}`);
    // Sai lech 1 dong la do lam tron giay giua hai lan doc dong ho, khong phai sai cong thuc.
    const lech = Math.abs((xem?.credit ?? 0) - tuTinh);
    ok(lech <= Math.max(2, gross * 0.001), 'so tien can tru khop cong thuc tinh tay',
      `may chu ${tien(xem?.credit ?? 0)} · tinh tay ${tien(tuTinh)} · lech ${tien(lech)}`);
    ok(xem?.payable === Math.max(0, Math.round(gross - (xem?.credit ?? 0))), 'phai tra = gia goi moi tru phan can tru',
      `${tien(gross)} - ${tien(xem?.credit ?? 0)} = ${tien(xem?.payable)}`);
    if (!conHan || Number(sub.total_amount ?? 0) === 0) {
      ok(xem?.credit === 0, 'goi da het han hoac goi mien phi thi KHONG can tru gi', `can tru ${tien(xem?.credit ?? 0)}`);
    }
  }

  // -- Ha goi: phai bi tu choi ---------------------------------------------
  if (sub.package_name_snapshot === promaxGoi.name && conHan) {
    const xem = await xemTruoc(cid, proGoi.id, mocPro[0].id, token);
    ok(xem?.action_type === 'downgrade', 'xuong Pro: nhan dung la HA GOI', `may chu noi: ${xem?.action_type}`);
    ok(xem?.credit === 0, 'ha goi KHONG can tru', `can tru ${tien(xem?.credit ?? 0)}`);
  }
}

// ===== B · TAI KHOAN TEST (co ghi du lieu) ================================
console.log('\nB · Tai khoan test moi');
if (!CO_GHI) {
  console.log('  (bo qua) them --tai-khoan-test de chay — phan nay TAO tai khoan, quan va don mua goi');
} else {
  const dau = Date.now().toString(36);
  const email = `test.trienkhai.${dau}@funcafe.test`;
  const dangKy = await goi('/auth/register', {
    method: 'POST',
    body: { full_name: 'Tai khoan kiem thu trien khai', email, password: 'KiemThu@2026', phone: '0912345678' },
  });
  ok(dangKy.status === 201 && !!dangKy.body?.token, 'dang ky duoc tai khoan moi', email);
  const tk = dangKy.body?.token;

  if (tk) {
    const quanMoi = await goi('/cafes', { token: tk, method: 'POST', body: { name: 'Quan kiem thu ' + dau, address: 'Khong co that', phone: '0912345678' } });
    ok(quanMoi.status === 201 || quanMoi.status === 200, 'tao duoc quan', `HTTP ${quanMoi.status}`);
    const cid = quanMoi.body?.id ?? quanMoi.body?._id;

    // Goi dung thu: kich hoat NGAY, khong qua cong thanh toan.
    const mocFree = await mocCua(freeGoi);
    const thu = await goi(`/cafes/${cid}/subscriptions`, {
      token: tk, method: 'POST',
      body: { package_id: freeGoi.id, time_subscription_id: mocFree[0]?.id ?? null, payment_method: 'vnpay' },
    });
    ok(thu.status === 201, 'nhan duoc goi dung thu', `HTTP ${thu.status}`);
    const dangChay = (await goi(`/cafes/${cid}/subscriptions/active`, { token: tk })).body;
    ok(dangChay?.status === 'active', 'goi dung thu co hieu luc NGAY, khong cho cong thanh toan', `trang thai: ${dangChay?.status}`);

    // Dung thu lan hai tren quan khac cua CUNG tai khoan -> phai bi chan.
    const quanHai = await goi('/cafes', { token: tk, method: 'POST', body: { name: 'Quan kiem thu 2 ' + dau } });
    const cid2 = quanHai.body?.id ?? quanHai.body?._id;
    const thuLai = await goi(`/cafes/${cid2}/subscriptions`, {
      token: tk, method: 'POST',
      body: { package_id: freeGoi.id, time_subscription_id: mocFree[0]?.id ?? null, payment_method: 'vnpay' },
    });
    ok(thuLai.status === 400, 'dung thu lan hai bi chan theo TAI KHOAN, khong chi theo quan', `HTTP ${thuLai.status} · ${String(thuLai.body?.message).slice(0, 70)}`);

    // Nang cap tu goi dung thu -> khong can tru (goi mien phi khong hoan tien).
    const xemLenPro = await xemTruoc(cid, proGoi.id, mocPro[0].id, tk);
    ok(xemLenPro?.action_type === 'upgrade', 'tu goi dung thu len Pro la NANG CAP', `may chu noi: ${xemLenPro?.action_type}`);
    ok(xemLenPro?.credit === 0, 'goi dung thu KHONG duoc can tru', `can tru ${tien(xemLenPro?.credit ?? 0)}`);

    // ===== 8.7.3 · duong tra ve cua cong thanh toan =======================
    console.log('\n8.7.3 · Duong tra ve cua cong thanh toan');

    // VNPay: duong tra ve nam NGAY trong duong dan thanh toan, doc thang duoc.
    const donVnpay = await goi(`/cafes/${cid}/subscriptions`, {
      token: tk, method: 'POST',
      body: { package_id: proGoi.id, time_subscription_id: mocPro[0].id, payment_method: 'vnpay' },
    });
    ok(donVnpay.status === 201, 'vnpay: tao duoc don mua goi', `HTTP ${donVnpay.status}`);
    const urlVnpay = donVnpay.body?.payment_url ?? '';
    // CHI doc rieng tham so vnp_ReturnUrl. Truoc day cho nay do ca chuoi tra loi xem
    // co chu "localhost" khong, va no bat nham `vnp_IpAddr=127.0.0.1` — mot truong
    // khac han, khien phep kiem bao hong trong khi duong tra ve hoan toan dung.
    const traVe = decodeURIComponent(new URL(urlVnpay || 'https://x.invalid').searchParams.get('vnp_ReturnUrl') ?? '');
    ok(/^https:\/\/funcaffe\.(onrender\.com|vercel\.app)\//.test(traVe), 'vnpay: duong tra ve tro dung ten mien that', traVe || '(khong co)');
    ok(!/localhost|127\.0\.0\.1/.test(traVe), 'vnpay: duong tra ve khong con tro ve may minh', traVe || '(khong co)');

    // MoMo khac VNPay: redirectUrl/ipnUrl duoc gui SERVER-TO-SERVER sang MoMo chu
    // khong nam trong duong dan tra ve, nen khong doc truc tiep duoc. Thu MoMo chiu
    // tra ve payUrl la bang chung MoMo da nhan va chap nhan bo tham so do. Ca hai
    // cong cung lay goc tu APP_URL (config/services.php), ma goc do vua duoc VNPay
    // chung minh la dung.
    const donMomo = await goi(`/cafes/${cid}/subscriptions`, {
      token: tk, method: 'POST',
      body: { package_id: proGoi.id, time_subscription_id: mocPro[0].id, payment_method: 'momo' },
    });
    ok(donMomo.status === 201, 'momo: tao duoc don mua goi', `HTTP ${donMomo.status}`);
    const urlMomo = donMomo.body?.payment_url ?? '';
    ok(/^https:\/\/(test-)?payment\.momo\.vn\//.test(urlMomo), 'momo: goi duoc sang MoMo va nhan duoc duong thanh toan', urlMomo.slice(0, 60) || '(khong co)');
  }
}

console.log(`\nTONG: ${cong.dat} dat / ${cong.hong} hong`);
process.exit(cong.hong ? 1 : 0);
