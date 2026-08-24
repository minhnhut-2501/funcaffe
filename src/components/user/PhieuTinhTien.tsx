'use client';
import { Fragment } from 'react';
import { formatCurrency, formatDate, formatDateTime, formatPaymentMethod } from '@/lib/format';
import type { Invoice } from '@/types';

/**
 * Tờ phiếu tính tiền — khối `.print-area` mà `inBill()` cắt ra để đưa lên giấy.
 *
 * DÙNG CHUNG cho hai nơi: hộp thoại chi tiết ở trang Hóa đơn, và hộp thoại hiện ngay
 * sau khi thu tiền ở trang Bán hàng. Đây là lý do nó là component chứ không nằm thẳng
 * trong trang: hai bản chép rời sẽ lệch nhau dần, mà lệch ở đây nghĩa là tờ in sau
 * thanh toán khác tờ in lại — đúng thứ khách sẽ mang ra đối chiếu.
 *
 * Chỉ vẽ NỘI DUNG. Nút bấm nằm ở footer hộp thoại bên ngoài, cố ý để chúng ở ngoài
 * `.print-area` cho khỏi lên giấy.
 */
export default function PhieuTinhTien({
  hoaDon,
  tenQuan,
  diaChiQuan,
  dienThoaiQuan,
  dangTaiChiTiet = false,
}: {
  hoaDon: Invoice;
  /** Dự phòng khi hóa đơn chưa kèm thông tin quán (bản ghi cũ). */
  tenQuan?: string;
  diaChiQuan?: string;
  dienThoaiQuan?: string;
  dangTaiChiTiet?: boolean;
}) {
  return (
    <div className="space-y-4 print-area">
      <div className="text-center pb-4 border-b-2 border-dashed border-cafe-200">
        <h3 className="text-base font-bold text-cafe-900">{hoaDon.shopName || tenQuan || 'FunCafe'}</h3>
        <p className="text-cafe-500 text-xs mt-0.5">{hoaDon.shopAddress || diaChiQuan || ''}</p>
        <p className="text-cafe-500 text-xs">{(hoaDon.shopPhone || dienThoaiQuan) ? `ĐT: ${hoaDon.shopPhone || dienThoaiQuan}` : ''}</p>
        {/*
          * "PHIẾU TÍNH TIỀN", KHÔNG phải "HÓA ĐƠN".
          *
          * Tờ giấy này là chứng từ nội bộ để quán và khách đối chiếu. Hóa đơn điện tử
          * theo Nghị định 123/2020/NĐ-CP là thứ khác hẳn: định dạng XML theo chuẩn
          * Tổng cục Thuế, có chữ ký số của người bán, đăng ký trước với cơ quan thuế
          * và truyền dữ liệu về đó — bản PDF chỉ là "bản thể hiện" của nó. Hệ thống
          * chưa làm khâu nào trong số đó, nên in chữ "HÓA ĐƠN" lên giấy là nói sai về
          * giá trị pháp lý của tờ phiếu.
          *
          * Tên MÀN HÌNH vẫn giữ "Hóa đơn" theo đúng thuật ngữ trong báo cáo và điều
          * hướng — đổi chỗ đó là lệch với tài liệu đã nộp.
          */}
        <p className="font-bold text-cafe-800 text-sm mt-3 tracking-wide">PHIẾU TÍNH TIỀN</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="text-cafe-500">Mã hóa đơn: <span className="font-bold text-cafe-800 font-mono">{hoaDon.invoiceCode}</span></div>
        <div className="text-cafe-500">Mã order: <span className="font-medium text-cafe-700 font-mono">{hoaDon.orderCode}</span></div>
        <div className="text-cafe-500">
          {hoaDon.orderType === 'takeaway'
            ? <span className="font-semibold text-cafe-800">MANG VỀ</span>
            : <>Bàn: <span className="font-medium text-cafe-800">{hoaDon.tableName}</span></>}
        </div>
        <div className="text-cafe-500">Ngày: <span className="font-medium text-cafe-800">{formatDate(hoaDon.paidAt)}</span></div>
        <div className="text-cafe-500">Giờ TT: <span className="font-medium text-cafe-800">{formatDateTime(hoaDon.paidAt)}</span></div>
        <div className="text-cafe-500">Thanh toán: <span className="font-medium text-cafe-800">{formatPaymentMethod(hoaDon.paymentMethod)}</span></div>
      </div>

      <div className="border-t border-dashed border-cafe-200 pt-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-cafe-500 border-b border-cafe-100">
              <th className="text-left pb-2 font-medium">Món</th>
              <th className="text-center pb-2 font-medium">SL</th>
              <th className="text-right pb-2 font-medium">Đơn giá</th>
              <th className="text-right pb-2 font-medium">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cafe-50">
            {/* no-print: dòng chờ này không bao giờ được lên giấy. Nút In cũng đã khóa
                trong lúc chờ, nên đây chỉ là lớp phòng thứ hai. */}
            {dangTaiChiTiet && hoaDon.items.length === 0 && (
              <tr className="no-print"><td colSpan={4} className="py-3 text-center text-cafe-400">Đang tải chi tiết món...</td></tr>
            )}
            {hoaDon.items.map((item, idx) => (
              <Fragment key={idx}>
                <tr className="text-cafe-800">
                  <td className="py-1.5 pr-2">
                    <span className="font-medium">{item.productNameSnapshot}</span>
                    {item.sizeNameSnapshot && (<span className="text-cafe-400"> ({item.sizeNameSnapshot})</span>)}
                  </td>
                  <td className="py-1.5 text-center">{item.quantity}</td>
                  <td className="py-1.5 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(item.unitPrice * item.quantity)}</td>
                </tr>
                {/* t.quantity là số phần topping cho MỘT ly, nên phải nhân thêm số ly
                    (item.quantity) mới ra phần khách thật sự trả. Trước đây bỏ quên nên
                    cộng các dòng lại không khớp tổng hóa đơn. */}
                {item.toppings.map((t, ti) => (
                  <tr key={ti} className="text-cafe-400">
                    <td className="py-1 pl-3 pr-2">+ {t.toppingNameSnapshot}</td>
                    <td className="py-1 text-center">{t.quantity * item.quantity}</td>
                    <td className="py-1 text-right">{formatCurrency(t.priceAtTime)}</td>
                    <td className="py-1 text-right">{formatCurrency(t.priceAtTime * t.quantity * item.quantity)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-dashed border-cafe-200 pt-3 space-y-1 text-xs">
        <div className="flex justify-between text-cafe-600">
          <span>Tạm tính</span>
          <span>{formatCurrency(hoaDon.subtotal)}</span>
        </div>
        <div className="flex justify-between text-cafe-600">
          <span>Giảm giá</span>
          <span>{hoaDon.discountAmount > 0 ? formatCurrency(hoaDon.discountAmount) : '—'}</span>
        </div>
      </div>
      <div className="flex justify-between items-center font-bold text-cafe-800 text-sm border-t-2 border-cafe-800 pt-3">
        <span>TỔNG THANH TOÁN</span>
        <span className="text-base">{formatCurrency(hoaDon.totalAmount)}</span>
      </div>

      {hoaDon.paymentMethod === 'cash' && hoaDon.cashReceived != null && (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-cafe-600">
            <span>Tiền khách đưa</span>
            <span>{formatCurrency(hoaDon.cashReceived)}</span>
          </div>
          <div className="flex justify-between text-cafe-600">
            <span>Tiền thối</span>
            <span>{formatCurrency(hoaDon.changeAmount ?? 0)}</span>
          </div>
        </div>
      )}

      <p className="text-center text-cafe-500 text-xs pt-1">Cảm ơn quý khách và hẹn gặp lại!</p>
      {/*
        * Câu chuẩn vẫn thấy trên phiếu của quán ăn và siêu thị. Nó nói rõ với khách
        * rằng muốn hóa đơn để kê khai thuế thì phải hỏi riêng — nếu không họ cầm tờ
        * này về phòng kế toán rồi mới biết là không dùng được.
        */}
      <p className="text-center text-cafe-400 text-[10px] leading-snug">
        Phiếu này không có giá trị thay thế hóa đơn.
      </p>
    </div>
  );
}
