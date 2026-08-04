import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * So sánh tên có nhận biết số, dùng cho danh mục cấu hình (bàn, món, topping).
 * `numeric: true` là phần quan trọng: so sánh chuỗi thuần sẽ xếp "Bàn 10" đứng
 * trước "Bàn 2" vì nó đọc từng ký tự, thấy '1' < '2' là chốt luôn.
 * Những danh sách này KHÔNG sắp theo thời gian tạo — thêm một món mới mà cả thực
 * đơn xáo lại thì còn khó tìm hơn.
 */
export const compareByName = (a: string, b: string) =>
  a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
  // ﻿ (BOM): thiếu nó Excel trên Windows đọc file theo bảng mã hệ thống
  // và toàn bộ tiếng Việt biến thành ô vuông.
  saveBlob(new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' }), filename);
}

/**
 * Đổi chuỗi ngày của API thành Date để ghi vào ô Excel.
 * Excel không có khái niệm múi giờ — nó chỉ lưu một con số — nên phải cộng sẵn
 * độ lệch giờ địa phương, nếu không file xuất ra sẽ hiển thị giờ UTC và lệch 7
 * tiếng so với giờ đang hiện trên màn hình.
 */
export function toExcelDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
}

export type ExcelColumn = {
  header: string;
  width?: number;
  /** Mã định dạng của Excel, ví dụ '#,##0' cho tiền hoặc 'dd/mm/yyyy hh:mm' cho ngày. */
  numFmt?: string;
};

/**
 * Xuất file .xlsx thật (không phải CSV đổi đuôi) để Excel giữ đúng kiểu dữ liệu:
 * số cộng được, ngày lọc được, tiếng Việt không lỗi phông.
 * exceljs được nạp động nên chỉ tải về khi người dùng bấm xuất file.
 */
export async function downloadExcel(
  filename: string,
  sheetName: string,
  columns: ExcelColumn[],
  rows: (string | number | Date | null)[][],
) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);

  ws.columns = columns.map(c => ({
    header: c.header,
    width: c.width ?? 18,
    ...(c.numFmt ? { style: { numFmt: c.numFmt } } : {}),
  }));

  rows.forEach(r => ws.addRow(r));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );
}
