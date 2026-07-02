<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use MongoDB\Client;

class SeedFuncafe extends Command
{
    protected $signature = 'funcafe:seed {--user=6a3910511846951d38041ca7} {--force : Xóa dữ liệu cũ trước khi seed}';
    protected $description = 'Seed dữ liệu mẫu cho FunCafe';

    public function handle()
    {
        $client = new Client(config('database.connections.mongodb.dsn'));
        $db = $client->selectDatabase(config('database.connections.mongodb.database'));
        $userId = $this->option('user');

        if ($this->option('force')) {
            $this->warn('Đang xóa dữ liệu cũ...');
            foreach (['packages', 'time_subscriptions', 'cafes', 'sizes', 'categories', 'items', 'item_prices', 'toppings', 'item_toppings', 'tables'] as $col) {
                $db->$col->deleteMany([]);
            }
            $this->info('Đã xóa dữ liệu cũ.');
        }

        $this->info('Đang seed packages...');
        $freePkgId = $this->insert($db->packages, [
            'name' => 'Fun Free', 'type' => 'free',
            'level' => 0, 'is_trial' => true,
            'max_tables' => null, 'max_menu_items' => null, 'can_use_ai' => false,
            'description' => 'Dùng thử toàn bộ tính năng Pro Max trong 7 ngày (1 lần/tài khoản)',
            'features' => ['Trải nghiệm TOÀN BỘ tính năng Pro Max trong 7 ngày', 'Không giới hạn bàn & thực đơn', 'Quản lý size & topping', 'Bán hàng theo bàn, order & hóa đơn', 'Thống kê & biểu đồ doanh thu', 'Chỉ dùng thử 1 lần / tài khoản'],
            'status' => 'active',
        ]);
        $proPkgId = $this->insert($db->packages, [
            'name' => 'Pro', 'type' => 'pro',
            'level' => 1, 'is_trial' => false,
            'max_tables' => 10, 'max_menu_items' => 15, 'can_use_ai' => false,
            'description' => 'Đầy đủ chức năng + doanh thu (tối đa 10 bàn, 15 món)',
            'features' => ['Quản lý thông tin quán', 'Tối đa 10 bàn', 'Thực đơn tối đa 15 món', 'Quản lý size & topping', 'Bán hàng theo bàn', 'Quản lý order & hóa đơn', 'In & xuất PDF hóa đơn', 'Thống kê & biểu đồ doanh thu'],
            'status' => 'active',
        ]);
        $promaxPkgId = $this->insert($db->packages, [
            'name' => 'Pro Max', 'type' => 'promax',
            'level' => 2, 'is_trial' => false,
            'max_tables' => null, 'max_menu_items' => null, 'can_use_ai' => true,
            'description' => 'Không giới hạn + trợ lý AI (sắp ra mắt)',
            'features' => ['Toàn bộ chức năng gói Pro', 'Không giới hạn bàn & thực đơn', 'Thống kê doanh thu chi tiết', 'Top món bán chạy & báo cáo', 'Trợ lý AI thông minh (sắp ra mắt)'],
            'status' => 'active',
        ]);

        $this->info('Đang seed time_subscriptions...');
        $this->insert($db->time_subscriptions, ['package_id' => $freePkgId, 'duration_value' => 7, 'duration_unit' => 'day', 'price' => 0, 'label' => '7 ngày', 'status' => 'active']);
        $this->insert($db->time_subscriptions, ['package_id' => $proPkgId, 'duration_value' => 1, 'duration_unit' => 'month', 'price' => 199000, 'label' => '1 tháng', 'status' => 'active']);
        $this->insert($db->time_subscriptions, ['package_id' => $proPkgId, 'duration_value' => 3, 'duration_unit' => 'month', 'price' => 549000, 'label' => '3 tháng', 'status' => 'active']);
        $this->insert($db->time_subscriptions, ['package_id' => $proPkgId, 'duration_value' => 12, 'duration_unit' => 'month', 'price' => 1990000, 'label' => '12 tháng', 'status' => 'active']);
        $this->insert($db->time_subscriptions, ['package_id' => $promaxPkgId, 'duration_value' => 1, 'duration_unit' => 'month', 'price' => 499000, 'label' => '1 tháng', 'status' => 'active']);
        $this->insert($db->time_subscriptions, ['package_id' => $promaxPkgId, 'duration_value' => 3, 'duration_unit' => 'month', 'price' => 1399000, 'label' => '3 tháng', 'status' => 'active']);
        $this->insert($db->time_subscriptions, ['package_id' => $promaxPkgId, 'duration_value' => 12, 'duration_unit' => 'month', 'price' => 4990000, 'label' => '12 tháng', 'status' => 'active']);

        $this->info('Đang seed cafe...');
        $cafeId = $this->insert($db->cafes, [
            'user_id' => $userId,
            'name' => 'Cafe Fun Có Thể',
            'address' => '123 Nguyễn Huệ, Q.1, TP.HCM',
            'phone' => '0909123456',
            'description' => 'Quán cafe phong cách hiện đại',
            'logo' => null,
            'status' => 'open',
        ]);

        $this->info('Đang seed categories...');
        $catCoffeeId = $this->insert($db->categories, ['cafe_id' => $cafeId, 'name' => 'Cà phê', 'description' => 'Cà phê truyền thống và đặc biệt', 'is_active' => true]);
        $catTeaId = $this->insert($db->categories, ['cafe_id' => $cafeId, 'name' => 'Trà sữa', 'description' => 'Trà sữa các loại', 'is_active' => true]);
        $catJuiceId = $this->insert($db->categories, ['cafe_id' => $cafeId, 'name' => 'Nước ép', 'description' => 'Nước ép trái cây tươi', 'is_active' => true]);

        $this->info('Đang seed items...');
        $item1Id = $this->insert($db->items, ['cafe_id' => $cafeId, 'category_id' => $catCoffeeId, 'name' => 'Cà phê đen', 'description' => 'Cà phê đen truyền thống', 'image' => null, 'base_price' => 25000, 'has_size' => false, 'allow_topping' => false, 'is_available' => true, 'display_order' => 1]);
        $item2Id = $this->insert($db->items, ['cafe_id' => $cafeId, 'category_id' => $catCoffeeId, 'name' => 'Cà phê sữa', 'description' => 'Cà phê sữa đá', 'image' => null, 'base_price' => 0, 'has_size' => true, 'allow_topping' => false, 'is_available' => true, 'display_order' => 2]);
        $item3Id = $this->insert($db->items, ['cafe_id' => $cafeId, 'category_id' => $catTeaId, 'name' => 'Trà sữa ô long', 'description' => 'Trà sữa ô long thơm béo', 'image' => null, 'base_price' => 0, 'has_size' => true, 'allow_topping' => true, 'is_available' => true, 'display_order' => 3]);
        $item4Id = $this->insert($db->items, ['cafe_id' => $cafeId, 'category_id' => $catTeaId, 'name' => 'Trà sữa matcha', 'description' => 'Trà sữa vị matcha Nhật Bản', 'image' => null, 'base_price' => 0, 'has_size' => true, 'allow_topping' => true, 'is_available' => true, 'display_order' => 4]);
        $item5Id = $this->insert($db->items, ['cafe_id' => $cafeId, 'category_id' => $catJuiceId, 'name' => 'Nước ép cam', 'description' => 'Nước ép cam tươi nguyên chất', 'image' => null, 'base_price' => 35000, 'has_size' => false, 'allow_topping' => false, 'is_available' => true, 'display_order' => 5]);

        $this->info('Đang seed sizes...');
        $sizeSId = $this->insert($db->sizes, ['name' => 'S', 'description' => 'Nhỏ', 'sort_order' => 1, 'is_active' => true]);
        $sizeMId = $this->insert($db->sizes, ['name' => 'M', 'description' => 'Vừa', 'sort_order' => 2, 'is_active' => true]);
        $sizeLId = $this->insert($db->sizes, ['name' => 'L', 'description' => 'Lớn', 'sort_order' => 3, 'is_active' => true]);

        $this->info('Đang seed item_prices...');
        $this->insert($db->item_prices, ['item_id' => $item2Id, 'size_id' => $sizeMId, 'price' => 25000, 'is_active' => true]);
        $this->insert($db->item_prices, ['item_id' => $item2Id, 'size_id' => $sizeLId, 'price' => 30000, 'is_active' => true]);
        $this->insert($db->item_prices, ['item_id' => $item3Id, 'size_id' => $sizeSId, 'price' => 35000, 'is_active' => true]);
        $this->insert($db->item_prices, ['item_id' => $item3Id, 'size_id' => $sizeMId, 'price' => 40000, 'is_active' => true]);
        $this->insert($db->item_prices, ['item_id' => $item3Id, 'size_id' => $sizeLId, 'price' => 45000, 'is_active' => true]);
        $this->insert($db->item_prices, ['item_id' => $item4Id, 'size_id' => $sizeSId, 'price' => 40000, 'is_active' => true]);
        $this->insert($db->item_prices, ['item_id' => $item4Id, 'size_id' => $sizeMId, 'price' => 45000, 'is_active' => true]);
        $this->insert($db->item_prices, ['item_id' => $item4Id, 'size_id' => $sizeLId, 'price' => 50000, 'is_active' => true]);

        $this->info('Đang seed toppings...');
        $top1Id = $this->insert($db->toppings, ['cafe_id' => $cafeId, 'name' => 'Trân châu trắng', 'price' => 5000, 'image' => null, 'is_available' => true]);
        $top2Id = $this->insert($db->toppings, ['cafe_id' => $cafeId, 'name' => 'Pudding', 'price' => 7000, 'image' => null, 'is_available' => true]);
        $top3Id = $this->insert($db->toppings, ['cafe_id' => $cafeId, 'name' => 'Kem cheese', 'price' => 8000, 'image' => null, 'is_available' => true]);
        $top4Id = $this->insert($db->toppings, ['cafe_id' => $cafeId, 'name' => 'Thạch cafe', 'price' => 5000, 'image' => null, 'is_available' => true]);

        $this->info('Đang seed item_toppings...');
        $this->insert($db->item_toppings, ['item_id' => $item3Id, 'topping_id' => $top1Id]);
        $this->insert($db->item_toppings, ['item_id' => $item3Id, 'topping_id' => $top2Id]);
        $this->insert($db->item_toppings, ['item_id' => $item3Id, 'topping_id' => $top3Id]);
        $this->insert($db->item_toppings, ['item_id' => $item4Id, 'topping_id' => $top1Id]);
        $this->insert($db->item_toppings, ['item_id' => $item4Id, 'topping_id' => $top2Id]);
        $this->insert($db->item_toppings, ['item_id' => $item4Id, 'topping_id' => $top4Id]);

        $this->info('Đang seed tables...');
        $this->insert($db->tables, ['cafe_id' => $cafeId, 'name' => 'Bàn 1', 'capacity' => 2, 'display_order' => 1, 'status' => 'empty', 'current_order_id' => null]);
        $this->insert($db->tables, ['cafe_id' => $cafeId, 'name' => 'Bàn 2', 'capacity' => 4, 'display_order' => 2, 'status' => 'empty', 'current_order_id' => null]);
        $this->insert($db->tables, ['cafe_id' => $cafeId, 'name' => 'Bàn 3', 'capacity' => 4, 'display_order' => 3, 'status' => 'empty', 'current_order_id' => null]);
        $this->insert($db->tables, ['cafe_id' => $cafeId, 'name' => 'Bàn 4', 'capacity' => 6, 'display_order' => 4, 'status' => 'empty', 'current_order_id' => null]);
        $this->insert($db->tables, ['cafe_id' => $cafeId, 'name' => 'Bàn 5', 'capacity' => 2, 'display_order' => 5, 'status' => 'empty', 'current_order_id' => null]);

        $this->newLine();
        $this->info('✓ Seed hoàn tất!');
        $this->table(['Collection', 'Số records'], [
            ['packages', 3],
            ['time_subscriptions', 7],
            ['cafes', 1],
            ['sizes', 3],
            ['categories', 3],
            ['items', 5],
            ['item_prices', 8],
            ['toppings', 4],
            ['item_toppings', 6],
            ['tables', 5],
        ]);
    }

    private function insert($collection, array $data): string
    {
        $now = new \MongoDB\BSON\UTCDateTime();
        $data['created_at'] = $now;
        $data['updated_at'] = $now;
        $result = $collection->insertOne($data);
        return (string) $result->getInsertedId();
    }
}
