/**
 * Hỏi thẳng MoMo: đơn này rốt cuộc ra sao?
 *
 * Sinh ra vì trang giả lập NAPAS treo mãi ở "Đang hoàn tất giao dịch...", nên
 * không biết được là (a) MoMo đã thu tiền mà không gọi về, hay (b) MoMo chưa
 * làm gì cả. IPN im lặng thì không phân biệt được hai thứ đó; API tra cứu thì có.
 *
 * Dùng:  node scripts/kt-momo-tracuu.mjs <orderId> [requestId]
 *        node scripts/kt-momo-tracuu.mjs --tao        # tạo đơn mới rồi in payUrl
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const doc = (t) => Object.fromEntries(
  fs.readFileSync(t, 'utf8').split(/\r?\n/)
    .filter((d) => d.trim() && !d.trim().startsWith('#') && d.includes('='))
    .map((d) => [d.slice(0, d.indexOf('=')).trim(), d.slice(d.indexOf('=') + 1).trim()]),
);
const env = doc('backend/.env');
const PARTNER = env.MOMO_PARTNER_CODE;
const ACCESS = env.MOMO_ACCESS_KEY;
const SECRET = env.MOMO_SECRET_KEY;
const GOC = (env.MOMO_ENDPOINT || '').replace(/\/create$/, '');

const ky = (raw) => crypto.createHmac('sha256', SECRET).update(raw).digest('hex');

async function taoDon() {
  const orderId = 'KT' + Date.now();
  const requestId = orderId + '-1';
  const amount = 10000;
  const orderInfo = 'Kiem thu treo NAPAS';
  const redirectUrl = 'https://funcafe.pro/user/subscription/payment-result';
  const ipnUrl = 'https://funcafe.pro/api/payments/momo/ipn';
  const raw = `accessKey=${ACCESS}&amount=${amount}&extraData=&ipnUrl=${ipnUrl}`
    + `&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${PARTNER}`
    + `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=payWithATM`;
  const r = await fetch(`${GOC}/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      partnerCode: PARTNER, partnerName: 'FunCafe', storeId: 'FunCafe',
      requestId, amount, orderId, orderInfo, redirectUrl, ipnUrl,
      lang: 'vi', extraData: '', requestType: 'payWithATM', signature: ky(raw),
    }),
  });
  const d = await r.json();
  console.log('orderId  :', orderId);
  console.log('requestId:', requestId);
  console.log('resultCode:', d.resultCode, '-', d.message);
  console.log('payUrl   :', d.payUrl);
  return orderId;
}

async function traCuu(orderId, requestId) {
  requestId = requestId || orderId + '-tra' + Date.now();
  const raw = `accessKey=${ACCESS}&orderId=${orderId}&partnerCode=${PARTNER}&requestId=${requestId}`;
  const r = await fetch(`${GOC}/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ partnerCode: PARTNER, requestId, orderId, lang: 'vi', signature: ky(raw) }),
  });
  console.log('HTTP', r.status);
  console.log(JSON.stringify(await r.json(), null, 2));
}

const arg = process.argv[2];
if (!arg) { console.error('Thiếu orderId (hoặc --tao)'); process.exit(1); }
if (arg === '--tao') await taoDon();
else await traCuu(arg, process.argv[3]);
