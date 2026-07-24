<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CafeController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\ToppingController;
use App\Http\Controllers\TableController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\TimeSubscriptionController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\AiController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\Admin;

// Auth - BUG-25 FIX: Thêm rate limiting 10 requests/phút cho các endpoint xác thực
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
});
Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

// User profile (auth required)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user', [AuthController::class, 'updateProfile']);
    Route::put('/user/password', [AuthController::class, 'changePassword']);
});

// Public review endpoints (no auth required)
Route::get('reviews', [ReviewController::class, 'publicReviews']);

// Upload
Route::post('/upload', [\App\Http\Controllers\UploadController::class, 'store'])->middleware('auth:sanctum');

// Contact (public)
Route::post('/contact', [ContactController::class, 'store']);

// Cafe (user's own)
// KHÔNG có route xóa quán: xóa một quán sẽ bỏ rơi toàn bộ bàn, thực đơn, hóa đơn
// và gói đã mua của quán đó (Mongo không cascade). Chủ quán chỉ đổi
// cafes.status: open (đang mở cửa) / closed (đã đóng cửa) / inactive (ngừng hoạt động).
Route::apiResource('cafes', CafeController::class)->except('destroy')->middleware('auth:sanctum');

// Cafe-scoped resources (read allowed without subscription, write requires subscription)
Route::middleware('auth:sanctum')->group(function () {
    // Categories - CRUD
    Route::get('cafes/{cafe}/categories', [CategoryController::class, 'index']);
    Route::post('cafes/{cafe}/categories', [CategoryController::class, 'store'])->middleware('subscription');
    Route::put('cafes/{cafe}/categories/{category}', [CategoryController::class, 'update'])->middleware('subscription');
    // KHÔNG có route xóa danh mục: xóa sẽ bỏ rơi các món bên trong (mồ côi
    // danh mục) — chủ quán chỉ ẨN danh mục (is_active = false).

    // Items - CRUD
    Route::get('cafes/{cafe}/items', [ItemController::class, 'index']);
    Route::post('cafes/{cafe}/items', [ItemController::class, 'store'])->middleware('subscription');
    Route::put('cafes/{cafe}/items/{item}', [ItemController::class, 'update'])->middleware('subscription');
    // KHÔNG có route xóa món: món đã bán nằm trong order/hóa đơn cũ,
    // chủ quán chỉ được ẨN món (is_available = false) thay vì xóa.
    Route::get('cafes/{cafe}/items/{item}/toppings', [ItemController::class, 'toppings']);
    Route::put('cafes/{cafe}/items/{item}/toppings', [ItemController::class, 'updateToppings'])->middleware('subscription');

    // Toppings - CRUD
    Route::get('cafes/{cafe}/toppings', [ToppingController::class, 'index']);
    Route::post('cafes/{cafe}/toppings', [ToppingController::class, 'store'])->middleware('subscription');
    Route::put('cafes/{cafe}/toppings/{topping}', [ToppingController::class, 'update'])->middleware('subscription');
    // KHÔNG có route xóa topping: topping từng bán nằm trong hóa đơn cũ và
    // cấu hình gắn món — chủ quán chỉ ẨN topping (is_available = false).

    // Tables - CRUD
    Route::get('cafes/{cafe}/tables', [TableController::class, 'index']);
    Route::post('cafes/{cafe}/tables', [TableController::class, 'store'])->middleware('subscription');
    Route::put('cafes/{cafe}/tables/{table}', [TableController::class, 'update'])->middleware('subscription');
    Route::delete('cafes/{cafe}/tables/{table}', [TableController::class, 'destroy'])->middleware('subscription');

    // Orders - create/pay requires subscription
    Route::get('cafes/{cafe}/orders', [OrderController::class, 'index']);
    Route::post('cafes/{cafe}/orders', [OrderController::class, 'store'])->middleware('subscription');
    Route::get('cafes/{cafe}/orders/{order}', [OrderController::class, 'show']);
    Route::put('cafes/{cafe}/orders/{order}', [OrderController::class, 'update'])->middleware('subscription');
    Route::post('cafes/{cafe}/orders/{order}/pay', [OrderController::class, 'pay'])->middleware('subscription');
    Route::post('cafes/{cafe}/orders/{order}/cancel', [OrderController::class, 'cancel'])->middleware('subscription');
    // C4: hoàn tiền order đã thanh toán (gộp từ InvoiceController cũ; thao tác ghi -> cần gói còn hạn)
    Route::post('cafes/{cafe}/orders/{order}/refund', [OrderController::class, 'refund'])->middleware('subscription');

    // Reviews
    Route::get('cafes/{cafe}/reviews', [ReviewController::class, 'index']);
    Route::post('cafes/{cafe}/reviews', [ReviewController::class, 'store'])->middleware('subscription');

    // Trợ lý AI (chỉ gói bật can_use_ai — middleware 'ai'; throttle chống đốt credit)
    Route::post('cafes/{cafe}/ai/chat', [AiController::class, 'chat'])
        ->middleware(['ai', 'throttle:20,1']);
    Route::post('cafes/{cafe}/ai/chat/stream', [AiController::class, 'chatStream'])
        ->middleware(['ai', 'throttle:20,1']);
    Route::post('cafes/{cafe}/ai/revenue-analysis', [AiController::class, 'revenueAnalysis'])
        ->middleware(['ai', 'throttle:10,1']);
});

// Packages & Time Subscriptions
Route::get('packages', [PackageController::class, 'index']);
Route::get('packages/{package}/time-subscriptions', [TimeSubscriptionController::class, 'index']);

// Cổng thanh toán VNPay (public - VNPay/trình duyệt gọi không kèm token)
Route::get('payments/vnpay/return', [\App\Http\Controllers\PaymentGatewayController::class, 'vnpayReturn']);
Route::get('payments/vnpay/ipn', [\App\Http\Controllers\PaymentGatewayController::class, 'vnpayIpn']);

// Subscriptions — ĐA QUÁN: gói/thanh toán độc lập theo từng quán (cafes/{cafe}/...)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('cafes/{cafe}/subscriptions', [SubscriptionController::class, 'index']);
    Route::get('cafes/{cafe}/subscriptions/active', [SubscriptionController::class, 'active']);
    Route::get('cafes/{cafe}/subscriptions/payments', [SubscriptionController::class, 'payments']);
    Route::post('cafes/{cafe}/subscriptions', [SubscriptionController::class, 'store']);

    // Tổng doanh thu gộp tất cả quán của user (không theo quán cụ thể)
    Route::get('revenue/overview', [\App\Http\Controllers\UserRevenueController::class, 'overview']);
});

// Admin
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('users', [Admin\UserController::class, 'index']);
    Route::put('users/{user}/lock', [Admin\UserController::class, 'toggleLock']);

    // Thanh toán gói: CHỈ ĐỌC để đối soát. Cổng online (VNPay/MoMo) tự kích hoạt và
    // nâng cấp giữa kỳ tự cấn trừ — không có duyệt tay, cũng không được sửa số tiền.
    Route::get('payments', [Admin\PaymentController::class, 'index']);

    Route::get('reviews', [Admin\ReviewController::class, 'index']);
    Route::put('reviews/{review}/toggle', [Admin\ReviewController::class, 'toggleStatus']);

    // B6: Tin nhắn Liên hệ từ trang public — admin đọc & đánh dấu đã xử lý
    Route::get('contacts', [Admin\ContactController::class, 'index']);
    Route::put('contacts/{contact}/read', [Admin\ContactController::class, 'toggleRead']);
    Route::post('contacts/{contact}/reply', [Admin\ContactController::class, 'reply']);

    // Không có endpoint 'revenue' riêng: trang Doanh thu hệ thống của admin dựng
    // số liệu từ admin/users + admin/payments (đã có sẵn), nên Admin\RevenueController
    // chưa từng được gọi lần nào — đã xóa thay vì để code chết.

    Route::get('packages', [Admin\PackageController::class, 'index']);
    Route::put('packages/{package}', [Admin\PackageController::class, 'update']);

    // Time Subscriptions
    Route::get('time-subscriptions', [Admin\TimeSubscriptionController::class, 'index']);
    Route::post('time-subscriptions', [Admin\TimeSubscriptionController::class, 'store']);
    Route::put('time-subscriptions/{timeSubscription}', [Admin\TimeSubscriptionController::class, 'update']);
    Route::delete('time-subscriptions/{timeSubscription}', [Admin\TimeSubscriptionController::class, 'destroy']);
});
