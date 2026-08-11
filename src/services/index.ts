/**
 * Cửa vào duy nhất của tầng dịch vụ.
 *
 * Trước đây toàn bộ 15 service nằm trong MỘT tệp 1.073 dòng. Nay tách theo miền
 * nhưng vẫn xuất lại ở đây, nên mọi nơi gọi giữ nguyên `from '@/services'`.
 */
export * from './ai';
export * from './cafe-id';
export * from './cafes';
export * from './contact';
export * from './menu';
export * from './orders';
export * from './packages';
export * from './payments';
export * from './revenue';
export * from './reviews';
export * from './subscriptions';
export * from './tables';
export * from './users';
