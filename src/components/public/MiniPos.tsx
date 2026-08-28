'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, ShoppingBag, Wallet, Check, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useDemSo } from '@/hooks/use-dem-so';

/**
 * Màn Bán hàng của FunCafe DIỄN LẠI vòng đời một đơn — bằng DOM thật, không phải
 * ảnh chụp và cũng không phải video.
 *
 * VÌ SAO PHẢI LÀ THỨ CHẠY ĐƯỢC: nguyên tắc số một của trang này là "Cho thấy, đừng
 * kể", nhưng mọi khu vực khoe sản phẩm đều đang là ảnh PNG đứng im — mà một tấm ảnh
 * chụp thì vẫn là KỂ. Vòng lặp dưới đây kể đúng chuyện chủ quán cần nghe trong mười
 * giây đầu: chọn bàn → thêm món → tiền tự cộng → thu tiền → bàn tự về Trống. Không
 * tấm ảnh nào nói được câu cuối cùng đó.
 *
 * Video thì nặng, không co giãn theo bề rộng, chữ mờ khi phóng to và không đi theo
 * hệ màu của trang. DOM thì dùng lại đúng token màu và đúng thẻ bàn của portal.
 *
 * Ba điều kiện dừng, đủ để một vòng lặp vô hạn không thành gánh nặng:
 *   1. `prefers-reduced-motion` → đứng ở KHUNG_TINH, không chạy lần nào.
 *   2. Cuộn ra khỏi màn hình → dừng (IntersectionObserver).
 *   3. Chuyển sang tab khác → dừng (visibilitychange).
 *
 * `role="img"` + nhãn: trình đọc màn hình nhận MỘT câu mô tả, thay vì bị đọc lại cả
 * khối mỗi 7 giây theo từng bước. Đây là minh hoạ, không phải giao diện thao tác được.
 */

const BAN = [
  { ten: 'Bàn 01', cho: 4, phucVu: true },
  { ten: 'Bàn 02', cho: 2, phucVu: false },
  { ten: 'Bàn 03', cho: 4, phucVu: false },
  { ten: 'Bàn 04', cho: 6, phucVu: true },
  { ten: 'Bàn 05', cho: 2, phucVu: false },
  { ten: 'Bàn 06', cho: 4, phucVu: false },
];
/** Bàn được diễn trong kịch bản. */
const BAN_DIEN = 4;

const MON = [
  { ten: 'Cà phê sữa đá', gia: 29000 },
  { ten: 'Bạc xỉu', gia: 32000 },
  { ten: 'Trà đào cam sả', gia: 45000 },
  { ten: 'Trà sữa trân châu', gia: 39000 },
  { ten: 'Nước ép cam', gia: 35000 },
  { ten: 'Bánh mì que', gia: 15000 },
];

/** Hai dòng lần lượt rơi vào phiếu, theo đúng thứ tự kịch bản. */
const DONG_PHIEU = [
  { mon: 0, bienThe: 'Size M · ít đá', sl: 1, gia: 29000 },
  { mon: 2, bienThe: 'Size L · thạch dừa', sl: 1, gia: 45000 },
];

type Buoc = {
  khung: 'ban' | 'mon';
  chonBan: boolean;
  dong: number;
  nhanMon: number | null;
  phucVu: boolean;
  nhanThanhToan: boolean;
  daThu: boolean;
  ms: number;
  chu: string;
};

const KICH_BAN: Buoc[] = [
  { khung: 'ban', chonBan: false, dong: 0, nhanMon: null, phucVu: false, nhanThanhToan: false, daThu: false, ms: 1200, chu: 'Sơ đồ bàn — Bàn 05 đang trống' },
  { khung: 'ban', chonBan: true,  dong: 0, nhanMon: null, phucVu: false, nhanThanhToan: false, daThu: false, ms:  750, chu: 'Thu ngân chạm vào Bàn 05' },
  { khung: 'mon', chonBan: true,  dong: 1, nhanMon: 0,    phucVu: true,  nhanThanhToan: false, daThu: false, ms: 1150, chu: 'Thêm Cà phê sữa đá — bàn chuyển sang Đang phục vụ' },
  { khung: 'mon', chonBan: true,  dong: 2, nhanMon: 2,    phucVu: true,  nhanThanhToan: false, daThu: false, ms: 1350, chu: 'Thêm Trà đào cam sả — tiền món, size và topping tự cộng' },
  { khung: 'mon', chonBan: true,  dong: 2, nhanMon: null, phucVu: true,  nhanThanhToan: true,  daThu: false, ms:  850, chu: 'Khách trả tiền mặt, thu ngân bấm Thanh toán' },
  { khung: 'ban', chonBan: false, dong: 2, nhanMon: null, phucVu: false, nhanThanhToan: false, daThu: true,  ms: 1950, chu: 'Xong — hóa đơn lưu lại, Bàn 05 tự về Trống' },
];

/** Khung đứng yên khi người dùng bật "giảm chuyển động": lúc phiếu đầy đủ nhất. */
const KHUNG_TINH = 3;

export default function MiniPos({ className = '' }: { className?: string }) {
  const [i, setI] = useState(0);
  const [trongTam, setTrongTam] = useState(false);
  const [tabHien, setTabHien] = useState(true);
  const khungRef = useRef<HTMLDivElement>(null);

  const chay = trongTam && tabHien;
  const b = KICH_BAN[i];
  const tong = DONG_PHIEU.slice(0, b.dong).reduce((s, d) => s + d.gia * d.sl, 0);
  const tienHienThi = useDemSo(tong, 420);

  useEffect(() => {
    const el = khungRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setI(KHUNG_TINH);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => setTrongTam(e.isIntersecting),
      { threshold: 0.35 },
    );
    io.observe(el);
    const doiTab = () => setTabHien(!document.hidden);
    document.addEventListener('visibilitychange', doiTab);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', doiTab);
    };
  }, []);

  // Hẹn giờ đặt lại mỗi lần đổi bước, nên dừng giữa chừng rồi chạy tiếp không bị dồn
  // nhiều lượt hẹn giờ chồng lên nhau.
  useEffect(() => {
    if (!chay) return;
    const t = setTimeout(() => setI((v) => (v + 1) % KICH_BAN.length), KICH_BAN[i].ms);
    return () => clearTimeout(t);
  }, [chay, i]);

  const moMon = b.khung === 'mon';

  return (
    <figure className={`m-0 ${className}`}>
      <div
        ref={khungRef}
        role="img"
        aria-label="Minh hoạ màn hình Bán hàng của FunCafe: thu ngân chọn Bàn 05, thêm Cà phê sữa đá và Trà đào cam sả vào phiếu, tổng tiền tự cộng thành 74.000 đồng, thu tiền mặt xong thì bàn tự trở về trạng thái Trống."
        className="anh-noi relative z-10 select-none overflow-hidden rounded-2xl border border-line bg-white"
      >
        {/* Thanh tiêu đề giả — cùng mô-típ với AppShot để hai kiểu khung không đá nhau */}
        <div aria-hidden className="flex h-8 items-center gap-1.5 border-b border-line bg-sand px-3.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
          <span className="h-2.5 w-2.5 rounded-full bg-pine/60" />
          <span className="ml-2 truncate text-[10px] font-medium text-ink/70">FunCafe · Bán hàng</span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-pine">
            <span className={`h-1.5 w-1.5 rounded-full bg-pine ${chay ? 'nhip-song' : ''}`} />
            Đang chạy thật
          </span>
        </div>

        <div aria-hidden className="grid grid-cols-5 text-ink">
          {/* ---- Cột trái: sơ đồ bàn, trượt sang bên khi mở thực đơn ---- */}
          {/* Cao HƠN ở màn hẹp, nghe ngược đời nhưng đúng: dưới sm hai lưới xuống
              còn 2 cột nên cần ba hàng thay vì hai. Giữ 15.5rem là cắt cụt hàng cuối. */}
          <div className="relative col-span-3 h-[17.25rem] overflow-hidden border-r border-line bg-paper sm:h-[16.5rem]">
            <div
              className={`absolute inset-0 p-2.5 transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                moMon ? '-translate-x-4 opacity-0' : 'translate-x-0 opacity-100'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-ink/70">Sơ đồ bàn</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-bean/10 px-2 py-1 text-[10px] font-bold text-bean">
                  <ShoppingBag className="h-3 w-3" /> MANG VỀ
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {BAN.map((t, k) => {
                  const dien = k === BAN_DIEN;
                  const chon = dien && b.chonBan;
                  const dangPhucVu = dien ? b.phucVu : t.phucVu;
                  return (
                    <div
                      key={t.ten}
                      className={`rounded-lg border p-1.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        chon ? '-translate-y-0.5 border-bean bg-bean shadow-card' : 'border-line bg-white'
                      }`}
                    >
                      <p className={`truncate text-[11px] font-bold ${chon ? 'text-white' : 'text-ink'}`}>{t.ten}</p>
                      <p className={`mt-px flex items-center gap-0.5 text-[9px] ${chon ? 'text-white/70' : 'text-cafe-400'}`}>
                        <Users className="h-2.5 w-2.5" />
                        {t.cho} chỗ
                      </p>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-semibold transition-colors duration-300 ${
                          chon
                            ? 'bg-white/20 text-white'
                            : dangPhucVu
                              ? 'bg-gold/18 text-gold-deep'
                              : 'bg-pine/12 text-pine'
                        }`}
                      >
                        <span className={`h-1 w-1 rounded-full ${chon ? 'bg-white' : dangPhucVu ? 'bg-gold-deep' : 'bg-pine'}`} />
                        {dangPhucVu ? 'Đang phục vụ' : 'Trống'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lưới món trượt vào đúng chỗ lưới bàn vừa rời đi */}
            <div
              className={`absolute inset-0 p-2.5 transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                moMon ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-ink/70">Thực đơn</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-ink/70 ring-1 ring-line">Cà phê</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {MON.map((m, k) => {
                  const nhan = b.nhanMon === k;
                  return (
                    <div
                      key={m.ten}
                      className={`rounded-lg border p-1.5 transition-all duration-200 ease-out ${
                        nhan ? 'scale-95 border-bean bg-bean-tint shadow-card' : 'border-line bg-white'
                      }`}
                    >
                      <div className={`mb-1 h-6 rounded transition-colors duration-200 ${nhan ? 'bg-bean/25' : 'bg-sand'}`} />
                      <p className="truncate text-[9px] font-semibold leading-tight text-ink">{m.ten}</p>
                      <p className={`text-[9px] font-bold ${nhan ? 'text-bean' : 'text-ink/70'}`}>
                        {m.gia.toLocaleString('vi-VN')}đ
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---- Cột phải: phiếu order ---- */}
          <div className="col-span-2 flex h-[17.25rem] flex-col p-2.5 sm:h-[16.5rem]">
            <div className="mb-2 flex items-baseline justify-between gap-1">
              <span className="text-[11px] font-semibold text-ink/70">Phiếu order</span>
              <span
                className={`text-[10px] font-bold text-bean transition-opacity duration-300 ${
                  b.chonBan ? 'opacity-100' : 'opacity-0'
                }`}
              >
                Bàn 05
              </span>
            </div>

            <div className="relative flex-1">
              {/* Trạng thái rỗng nằm CHỒNG LÊN chứ không đẩy layout, nên phiếu không
                  giật một cái khi món đầu tiên rơi vào. */}
              <p
                className={`absolute inset-x-0 top-8 text-center text-[10px] leading-relaxed text-ink/50 transition-opacity duration-300 ${
                  b.dong === 0 ? 'opacity-100' : 'opacity-0'
                }`}
              >
                Chọn bàn rồi
                <br />
                chạm vào món
              </p>

              <ul className="space-y-1.5">
                {DONG_PHIEU.map((d, k) => {
                  const hien = k < b.dong;
                  return (
                    <li
                      key={d.mon}
                      className={`flex items-start gap-1.5 rounded-lg border border-line bg-white p-1.5 transition-[opacity,translate] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        hien ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                      }`}
                      style={{ transitionDelay: hien ? '60ms' : '0ms' }}
                    >
                      <span className="mt-px shrink-0 rounded bg-bean-tint px-1 text-[9px] font-bold text-bean">{d.sl}×</span>
                      <span className="min-w-0 flex-1">
                        {/* KHÔNG cắt chữ ở đây: cột phiếu chỉ rộng 40% khung, nên ở 390px
                            tên món bị cắt thành "Cà ph…" — đọc ra đúng một chữ. Cho xuống
                            dòng thì cả hai món đều đọc được, mà cột phiếu lại đang thừa
                            chỗ theo chiều dọc. */}
                        <span className="block text-[10px] font-semibold leading-tight text-ink">{MON[d.mon].ten}</span>
                        <span className="block truncate text-[9px] text-ink/60">{d.bienThe}</span>
                      </span>
                      <span className="shrink-0 text-[10px] font-bold tabular-nums text-ink">
                        {d.gia.toLocaleString('vi-VN')}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Dấu ĐÃ THU đóng lên phiếu như con dấu mực, hơi nghiêng cho đúng chất giấy */}
              <div
                className={`pointer-events-none absolute inset-x-0 top-10 flex justify-center transition-[opacity,scale,rotate] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  b.daThu ? 'rotate-[-8deg] scale-100 opacity-100' : 'rotate-0 scale-125 opacity-0'
                }`}
              >
                <span className="rounded-md border-2 border-pine bg-white/90 px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-pine">
                  ĐÃ THU
                </span>
              </div>
            </div>

            <div className="mt-2 border-t border-line pt-2">
              <div className="mb-1.5 flex items-baseline justify-between gap-1">
                <span className="text-[10px] font-medium text-ink/70">Tổng cộng</span>
                <span className="text-sm font-extrabold tabular-nums text-bean">{formatCurrency(tienHienThi)}</span>
              </div>
              <div
                className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold text-white transition-all duration-200 ease-out ${
                  b.daThu ? 'bg-pine' : b.nhanThanhToan ? 'scale-[.96] bg-bean-dark' : 'bg-bean'
                }`}
              >
                {b.daThu ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={3} /> Đã thu tiền mặt
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5" /> Thanh toán
                  </>
                )}
              </div>
              <p className="mt-1.5 flex items-center justify-center gap-1 text-[9px] text-ink/45">
                <Trash2 className="h-2.5 w-2.5" /> Hủy order
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lời thuyết minh — chiều cao cố định để đổi câu không đẩy trang nhích lên xuống.
          Người xem mục tiêu phần lớn không rành công nghệ; một vòng 7 giây không có
          chú thích thì họ thấy màu nhấp nháy chứ không thấy quy trình. */}
      <figcaption
        aria-hidden
        className="mt-3 flex h-9 items-center justify-center gap-2.5 px-2 text-center text-xs text-ink/70"
      >
        <span className="flex shrink-0 items-center gap-1">
          {KICH_BAN.map((buoc, k) => (
            <span
              key={buoc.chu}
              className={`h-1 rounded-full transition-all duration-300 ${k === i ? 'w-4 bg-bean' : 'w-1 bg-line'}`}
            />
          ))}
        </span>
        <span key={i} className="doi-cau leading-snug">
          {b.chu}
        </span>
      </figcaption>
    </figure>
  );
}
