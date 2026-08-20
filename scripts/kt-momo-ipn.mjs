/**
 * Kiểm bộ nhận callback (IPN) của MoMo mà không cần điện thoại.
 *
 * MoMo sandbox kiểu captureWallet bắt quét QR bằng ứng dụng MoMo Test, nên không tự
 * động hoá được chặng trả tiền. Nhưng chặng ĐÁNG LO nhất không nằm ở đó: nó nằm ở
 * lượt MoMo gọi ngược về máy chủ mình — đúng thứ vừa bị Cloudflare chặn mấy hôm nay.
 *
 * Kịch bản này dựng một callback đúng chữ ký rồi gửi tới /api/payments/momo/ipn,
 * kiểm ba việc: chữ ký hợp lệ thì nhận, sai thì từ chối, và số tiền lệch thì từ chối.
 *
 * Khoá lấy từ backend/.env (bộ khoá thử NGHIỆM CÔNG KHAI của MoMo) và KHÔNG in ra.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('backend/.env', 'utf8').split('\n')
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith('#') && d.includes('='))
    .map((d) => [d.slice(0, d.indexOf('=')), d.slice(d.indexOf('=') + 1).trim()]),
);

const [orderId, soTien] = process.argv.slice(2);
if (!orderId || !soTien) { console.error('Dùng: node scripts/kt-momo-ipn.mjs <orderId> <soTien>'); process.exit(1); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const kyTen = (d) => crypto.createHmac('sha256', env.MOMO_SECRET_KEY).update(
  'accessKey=' + env.MOMO_ACCESS_KEY
  + '&amount=' + d.amount + '&extraData=' + d.extraData + '&message=' + d.message
  + '&orderId=' + d.orderId + '&orderInfo=' + d.orderInfo + '&orderType=' + d.orderType
  + '&partnerCode=' + d.partnerCode + '&payType=' + d.payType + '&requestId=' + d.requestId
  + '&responseTime=' + d.responseTime + '&resultCode=' + d.resultCode + '&transId=' + d.transId,
).digest('hex');

const than = (ghiDe = {}) => {
  const d = {
    partnerCode: env.MOMO_PARTNER_CODE, orderId, requestId: orderId,
    amount: Number(soTien), orderInfo: 'Thanh toan goi Pro Max', orderType: 'momo_wallet',
    transId: Date.now(), resultCode: 0, message: 'Successful.',
    payType: 'qr', responseTime: Date.now(), extraData: '',
    ...ghiDe,
  };
  return { ...d, signature: kyTen(d) };
};

const gui = async (nhan, d) => {
  const r = await fetch('https://api.funcafe.pro/api/payments/momo/ipn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify(d),
    signal: AbortSignal.timeout(90000),
  });
  console.log(`${nhan.padEnd(34)} HTTP ${r.status}`);
};

// Hai phép thử âm chạy TRƯỚC: nếu chúng lọt thì phép thử dương phía sau vô nghĩa,
// vì khi đó bộ nhận nhận tuốt chứ không phải nhận vì chữ ký đúng.
console.log('=== PHẢI BỊ TỪ CHỐI ===');
await gui('chữ ký sai', { ...than(), signature: 'a'.repeat(64) });
await gui('số tiền lệch (chữ ký vẫn đúng)', than({ amount: Number(soTien) + 100000 }));

console.log('\n=== PHẢI ĐƯỢC NHẬN ===');
await gui('chữ ký đúng, resultCode=0', than());
