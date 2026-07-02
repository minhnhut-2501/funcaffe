// Import seed data for FunCafe
// Run: mongosh funcafe import.js

const db = db.getSiblingDB('funcafe');

print('Importing packages...');
db.packages.insertMany([
  {
    name: 'Fun Free',
    type: 'free',
    code: 'FREE',
    is_trial: true,
    has_revenue_report: false,
    description: 'Dùng thử miễn phí 7 ngày',
    features: ['Quản lý thông tin quán', 'Quản lý bàn', 'Quản lý thực đơn (tối đa 20 món)', 'Bán hàng theo bàn', 'Quản lý order', 'Quản lý hóa đơn'],
    status: 'active',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01')
  },
  {
    name: 'Pro',
    type: 'pro',
    code: 'PRO',
    is_trial: false,
    has_revenue_report: false,
    description: 'Đầy đủ chức năng quản lý cơ bản',
    features: ['Quản lý thông tin quán', 'Quản lý bàn - không giới hạn', 'Quản lý thực đơn - không giới hạn', 'Quản lý size', 'Quản lý topping', 'Cấu hình topping cho món', 'Bán hàng theo bàn', 'Quản lý order', 'Quản lý hóa đơn', 'In hóa đơn'],
    status: 'active',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01')
  },
  {
    name: 'Pro Max',
    type: 'promax',
    code: 'PROMAX',
    is_trial: false,
    has_revenue_report: true,
    description: 'Đầy đủ nhất - có thống kê doanh thu',
    features: ['Toàn bộ chức năng Pro', 'Thống kê doanh thu', 'Biểu đồ doanh thu', 'Top món bán chạy', 'Báo cáo chi tiết'],
    status: 'active',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01')
  }
]);

// Get package IDs
const freePkg = db.packages.findOne({ code: 'FREE' });
const proPkg = db.packages.findOne({ code: 'PRO' });
const promaxPkg = db.packages.findOne({ code: 'PROMAX' });

print('Importing time_subscriptions...');
db.time_subscriptions.insertMany([
  { package_id: freePkg._id, duration_value: 7, duration_unit: 'day', price: 0, label: '7 ngày', status: 'active', created_at: new Date(), updated_at: new Date() },
  { package_id: proPkg._id, duration_value: 1, duration_unit: 'month', price: 199000, label: '1 tháng', status: 'active', created_at: new Date(), updated_at: new Date() },
  { package_id: proPkg._id, duration_value: 3, duration_unit: 'month', price: 549000, label: '3 tháng', status: 'active', created_at: new Date(), updated_at: new Date() },
  { package_id: proPkg._id, duration_value: 12, duration_unit: 'month', price: 1990000, label: '12 tháng', status: 'active', created_at: new Date(), updated_at: new Date() },
  { package_id: promaxPkg._id, duration_value: 1, duration_unit: 'month', price: 499000, label: '1 tháng', status: 'active', created_at: new Date(), updated_at: new Date() },
  { package_id: promaxPkg._id, duration_value: 3, duration_unit: 'month', price: 1399000, label: '3 tháng', status: 'active', created_at: new Date(), updated_at: new Date() },
  { package_id: promaxPkg._id, duration_value: 12, duration_unit: 'month', price: 4990000, label: '12 tháng', status: 'active', created_at: new Date(), updated_at: new Date() }
]);

print('Importing cafe...');
const cafeId = db.cafes.insertOne({
  user_id: '6a3910511846951d38041ca7',
  name: 'Cafe Fun Có Thể',
  address: '123 Nguyễn Huệ, Q.1, TP.HCM',
  phone: '0909123456',
  description: 'Quán cafe phong cách hiện đại',
  logo: null,
  status: 'open',
  created_at: new Date(),
  updated_at: new Date()
}).insertedId;

print('Importing categories...');
const catCoffee = db.categories.insertOne({ cafe_id: cafeId, name: 'Cà phê', description: 'Cà phê truyền thống và đặc biệt', is_active: true, created_at: new Date(), updated_at: new Date() }).insertedId;
const catTea = db.categories.insertOne({ cafe_id: cafeId, name: 'Trà sữa', description: 'Trà sữa các loại', is_active: true, created_at: new Date(), updated_at: new Date() }).insertedId;
const catJuice = db.categories.insertOne({ cafe_id: cafeId, name: 'Nước ép', description: 'Nước ép trái cây tươi', is_active: true, created_at: new Date(), updated_at: new Date() }).insertedId;

print('Importing items...');
const item1 = db.items.insertOne({ cafe_id: cafeId, category_id: catCoffee, name: 'Cà phê đen', description: 'Cà phê đen truyền thống', image: null, base_price: 25000, has_size: false, allow_topping: false, is_available: true, display_order: 1, created_at: new Date(), updated_at: new Date() }).insertedId;
const item2 = db.items.insertOne({ cafe_id: cafeId, category_id: catCoffee, name: 'Cà phê sữa', description: 'Cà phê sữa đá', image: null, base_price: 0, has_size: true, allow_topping: false, is_available: true, display_order: 2, created_at: new Date(), updated_at: new Date() }).insertedId;
const item3 = db.items.insertOne({ cafe_id: cafeId, category_id: catTea, name: 'Trà sữa ô long', description: 'Trà sữa ô long thơm béo', image: null, base_price: 0, has_size: true, allow_topping: true, is_available: true, display_order: 3, created_at: new Date(), updated_at: new Date() }).insertedId;
const item4 = db.items.insertOne({ cafe_id: cafeId, category_id: catTea, name: 'Trà sữa matcha', description: 'Trà sữa vị matcha Nhật Bản', image: null, base_price: 0, has_size: true, allow_topping: true, is_available: true, display_order: 4, created_at: new Date(), updated_at: new Date() }).insertedId;
const item5 = db.items.insertOne({ cafe_id: cafeId, category_id: catJuice, name: 'Nước ép cam', description: 'Nước ép cam tươi nguyên chất', image: null, base_price: 35000, has_size: false, allow_topping: false, is_available: true, display_order: 5, created_at: new Date(), updated_at: new Date() }).insertedId;

print('Importing sizes...');
const sizeS = db.sizes.insertOne({ name: 'S', description: 'Nhỏ', sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() }).insertedId;
const sizeM = db.sizes.insertOne({ name: 'M', description: 'Vừa', sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() }).insertedId;
const sizeL = db.sizes.insertOne({ name: 'L', description: 'Lớn', sort_order: 3, is_active: true, created_at: new Date(), updated_at: new Date() }).insertedId;

print('Importing item_prices...');
db.item_prices.insertMany([
  { item_id: item2, size_id: sizeM, price: 25000, is_active: true, created_at: new Date(), updated_at: new Date() },
  { item_id: item2, size_id: sizeL, price: 30000, is_active: true, created_at: new Date(), updated_at: new Date() },
  { item_id: item3, size_id: sizeS, price: 35000, is_active: true, created_at: new Date(), updated_at: new Date() },
  { item_id: item3, size_id: sizeM, price: 40000, is_active: true, created_at: new Date(), updated_at: new Date() },
  { item_id: item3, size_id: sizeL, price: 45000, is_active: true, created_at: new Date(), updated_at: new Date() },
  { item_id: item4, size_id: sizeS, price: 40000, is_active: true, created_at: new Date(), updated_at: new Date() },
  { item_id: item4, size_id: sizeM, price: 45000, is_active: true, created_at: new Date(), updated_at: new Date() },
  { item_id: item4, size_id: sizeL, price: 50000, is_active: true, created_at: new Date(), updated_at: new Date() }
]);

print('Importing toppings...');
const top1 = db.toppings.insertOne({ cafe_id: cafeId, name: 'Trân châu trắng', price: 5000, image: null, is_available: true, created_at: new Date(), updated_at: new Date() }).insertedId;
const top2 = db.toppings.insertOne({ cafe_id: cafeId, name: 'Pudding', price: 7000, image: null, is_available: true, created_at: new Date(), updated_at: new Date() }).insertedId;
const top3 = db.toppings.insertOne({ cafe_id: cafeId, name: 'Kem cheese', price: 8000, image: null, is_available: true, created_at: new Date(), updated_at: new Date() }).insertedId;
const top4 = db.toppings.insertOne({ cafe_id: cafeId, name: 'Thạch cafe', price: 5000, image: null, is_available: true, created_at: new Date(), updated_at: new Date() }).insertedId;

print('Importing item_toppings...');
db.item_toppings.insertMany([
  { item_id: item3, topping_id: top1, created_at: new Date(), updated_at: new Date() },
  { item_id: item3, topping_id: top2, created_at: new Date(), updated_at: new Date() },
  { item_id: item3, topping_id: top3, created_at: new Date(), updated_at: new Date() },
  { item_id: item4, topping_id: top1, created_at: new Date(), updated_at: new Date() },
  { item_id: item4, topping_id: top2, created_at: new Date(), updated_at: new Date() },
  { item_id: item4, topping_id: top4, created_at: new Date(), updated_at: new Date() }
]);

print('Importing tables...');
db.tables.insertMany([
  { cafe_id: cafeId, name: 'Bàn 1', capacity: 2, display_order: 1, status: 'empty', current_order_id: null, created_at: new Date(), updated_at: new Date() },
  { cafe_id: cafeId, name: 'Bàn 2', capacity: 4, display_order: 2, status: 'empty', current_order_id: null, created_at: new Date(), updated_at: new Date() },
  { cafe_id: cafeId, name: 'Bàn 3', capacity: 4, display_order: 3, status: 'empty', current_order_id: null, created_at: new Date(), updated_at: new Date() },
  { cafe_id: cafeId, name: 'Bàn 4', capacity: 6, display_order: 4, status: 'empty', current_order_id: null, created_at: new Date(), updated_at: new Date() },
  { cafe_id: cafeId, name: 'Bàn 5', capacity: 2, display_order: 5, status: 'empty', current_order_id: null, created_at: new Date(), updated_at: new Date() }
]);

print('Seed completed successfully!');
