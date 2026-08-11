import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  resolve: {
    // Cùng bí danh với tsconfig để bài kiểm thử nhập module y như mã sản phẩm.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Các bài hiện tại chỉ kiểm hàm thuần (định dạng, gom nhóm biểu đồ, hạn mức gói)
    // nên không cần DOM. Khi thêm bài cho component thì đổi sang 'jsdom'.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
