import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    // Thư mục sinh ra hoặc không thuộc mã nguồn frontend.
    // `next-env.d.ts` do Next tự sinh lại mỗi lần dựng, sửa vào đó là vô nghĩa.
    // `.local`, `.claude`, `.agents` là công cụ phát triển, không phải sản phẩm.
    ignores: [
      // '.next-e2e/**' là thư mục dựng của bản Next thứ hai (NEXT_DIST_DIR, dùng khi
      // chạy kịch bản đầu-cuối song song với server dev). Không bỏ qua thì eslint soi
      // cả mã webpack sinh ra và đẻ ra hàng chục lỗi giả.
      '.next/**', '.next-e2e/**', 'node_modules/**', 'backend/**', 'public/**', 'scripts/**',
      'design-shots/**', 'next-env.d.ts', '.local/**', '.claude/**', '.agents/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // TẮT — giao diện toàn tiếng Việt, chữ trong ngoặc kép xuất hiện liên tục
      // ("Thêm", "Quản lý thời hạn"). Viết thành &quot; làm mã nguồn khó đọc mà
      // không đổi được gì trên màn hình.
      'react/no-unescaped-entities': 'off',

      // TẮT — ảnh của dự án đến từ Cloudinary (đã tối ưu sẵn ở phía dịch vụ) và
      // từ địa chỉ ngoài do chủ quán dán vào. Dùng next/image sẽ phải khai báo
      // trước từng tên miền và tiêu hạn mức tối ưu ảnh của gói Vercel miễn phí.
      '@next/next/no-img-element': 'off',

      // Biến `_` trong `const { [id]: _, ...rest } = prev` là cách bỏ một khóa
      // khỏi object — không phải mã chết.
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // Còn ~90 chỗ, gần hết nằm ở services/index.ts. Để mức cảnh báo cho
      // `npm run lint` còn dùng được; việc siết kiểu là mục 1.2.3 của kế hoạch.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

export default config;
