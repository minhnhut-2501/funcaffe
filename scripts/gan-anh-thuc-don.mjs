/**
 * Gan anh cho MON va TOPPING theo ten, cho ca ba quan demo.
 *
 * Vi sao khong tai anh len qua nut "Tai anh" nhu chu quan that: tren ban trien khai
 * duong tai anh dang HONG (Cloudinary tu choi quyen `create` — viec 8.7.2). Anh o day
 * nam san trong `public/mon/` cua frontend, nen truong `image` chi can giu duong dan
 * tuong doi `/mon/<ten>.jpg` — trinh duyet tu ghep voi ten mien cua chinh trang.
 * Khong phu thuoc Cloudinary, khong phu thuoc mang ngoai, va con nguyen sau moi lan
 * trien khai lai.
 *
 * Chay THU (khong ghi gi, chi in ra se gan gi cho gi):
 *   USER_EMAIL=... USER_PASS=... node scripts/gan-anh-thuc-don.mjs
 * Chay THAT:
 *   ... node scripts/gan-anh-thuc-don.mjs --ap-dung
 *
 * Anh deu la CC0 (mien tru ban quyen, khong can ghi cong) lay qua Openverse —
 * xem public/mon/NGUON-ANH.md.
 */
const API = process.env.API ?? 'https://funcaffe.onrender.com/api';
const AP_DUNG = process.argv.includes('--ap-dung');

/**
 * Luat khop, XET THEO THU TU TU TREN XUONG — cai dau tien khop thi thang.
 *
 * Thu tu la phan quan trong nhat o day: "Matcha da xay" phai ra ly da xay chu khong
 * phai ly matcha, nen luat 'da xay' buoc phai dung TRUOC luat 'matcha'. Tuong tu
 * "Tra sua matcha" phai ra matcha, nen 'matcha' dung truoc 'tra sua'.
 */
const LUAT = [
  [/đá xay/i,                          'da-xay'],
  [/matcha/i,                          'matcha'],
  [/trà sữa|hồng trà sữa/i,            'tra-sua'],
  [/trà vải/i,                         'tra-vai'],
  [/trà đào|trà chanh|trà xoài|trà dâu|trà gừng|thanh long/i, 'tra-trai-cay'],
  [/cold brew|nitro/i,                 'cold-brew'],
  [/espresso/i,                        'espresso'],
  [/americano|phin đen/i,              'ca-phe-den'],
  [/latte|cappuccino|flat white|mocha|macchiato/i, 'cappuccino'],
  [/v60|cà phê trứng/i,                'ca-phe-nong'],
  [/cà phê sữa|bạc xỉu|cà phê muối|cà phê dừa|bơ cà phê|sữa chua cà phê/i, 'ca-phe-sua-da'],
  [/bánh flan|flan/i,                  'banh-flan'],
  [/croissant/i,                       'croissant'],
  [/tiramisu/i,                        'tiramisu'],
  [/cheesecake/i,                      'cheesecake'],
  [/brownie/i,                         'brownie'],
  [/bánh mì/i,                         'banh-mi-bo-toi'],
  // Topping
  [/trân châu/i,                       'tran-chau'],
  [/thạch dừa/i,                       'thach-dua'],
  [/pudding/i,                         'pudding'],
  [/kem cheese|kem tươi/i,             'kem-tuoi'],
  [/syrup/i,                           'syrup'],
];

const anhCho = (ten) => {
  const luat = LUAT.find(([re]) => re.test(ten));
  return luat ? `/mon/${luat[1]}.jpg` : null;
};

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
    if (res.status >= 502 && lan <= thuLai) {
      console.log(`  ... may chu chua san sang (HTTP ${res.status}), doi 20s (${lan}/${thuLai})`);
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    return { status: res.status, body: noiDung };
  }
}

const dangNhap = await goi('/auth/login', { method: 'POST', body: { email: process.env.USER_EMAIL, password: process.env.USER_PASS } });
if (!dangNhap.body?.token) { console.error('Khong dang nhap duoc:', dangNhap.body); process.exit(1); }
const token = dangNhap.body.token;

console.log(AP_DUNG ? 'CHE DO GHI THAT\n' : 'CHAY THU — khong ghi gi. Them --ap-dung de ghi that.\n');

let daGan = 0, khongKhop = [], hong = 0;

for (const c of (await goi('/cafes', { token })).body) {
  const cid = c.id ?? c._id;
  console.log(`\n=== ${c.name}`);

  for (const mon of (await goi(`/cafes/${cid}/items`, { token })).body) {
    const anh = anhCho(mon.name);
    if (!anh) { khongKhop.push(`mon: ${mon.name}`); continue; }
    if (mon.image === anh) { console.log(`  (da co)  ${mon.name}`); continue; }
    if (AP_DUNG) {
      // CHI gui truong `image`. Gui ca doi tuong mon se keo theo `sizes` va
      // `topping_ids` da bi bien dang qua duong doc — tuc la sua anh mot cai lam
      // hong ca bang gia theo size.
      const kq = await goi(`/cafes/${cid}/items/${mon.id ?? mon._id}`, { token, method: 'PUT', body: { image: anh } });
      if (kq.status !== 200) { console.log(`  HONG     ${mon.name} — HTTP ${kq.status}`); hong++; continue; }
    }
    console.log(`  ${AP_DUNG ? 'da gan ' : 'se gan '} ${mon.name.padEnd(32)} -> ${anh}`);
    daGan++;
  }

  for (const top of (await goi(`/cafes/${cid}/toppings`, { token })).body) {
    const anh = anhCho(top.name);
    if (!anh) { khongKhop.push(`topping: ${top.name}`); continue; }
    if (top.image === anh) { console.log(`  (da co)  ${top.name}`); continue; }
    if (AP_DUNG) {
      const kq = await goi(`/cafes/${cid}/toppings/${top.id ?? top._id}`, { token, method: 'PUT', body: { image: anh } });
      if (kq.status !== 200) { console.log(`  HONG     ${top.name} — HTTP ${kq.status}`); hong++; continue; }
    }
    console.log(`  ${AP_DUNG ? 'da gan ' : 'se gan '} ${top.name.padEnd(32)} -> ${anh}`);
    daGan++;
  }
}

console.log(`\n${AP_DUNG ? 'Da gan' : 'Se gan'}: ${daGan} · hong: ${hong} · khong khop luat nao: ${khongKhop.length}`);
khongKhop.forEach((t) => console.log('  - ' + t));
