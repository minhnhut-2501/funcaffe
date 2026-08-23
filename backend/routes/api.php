<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ToppingController;
use App\Http\Controllers\TableController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\TimeSubscriptionController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\AiController;
use App\Http\Controllers\AiConsultController;
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
    // Throttle NGANG với đăng nhập: endpoint này nhận `current_password` và nói cho
    // người gọi biết đoán đúng hay sai. Ai cầm được token (máy để mở, token bị chép)
    // mà không biết mật khẩu thì đây là chỗ dò — không giới hạn là dò được vô hạn.
    Route::put('/user/password', [AuthController::class, 'changePassword'])
        ->middleware('throttle:10,1');
});

// Public review endpoints (no auth required)
Route::get('reviews', [ReviewController::class, 'publicReviews']);

// Upload — throttle vì mỗi lượt đẩy một tệp lên Cloudinary. Không giới hạn thì một
// tài khoản bất kỳ đốt hết hạn mức miễn phí, làm hỏng ảnh của MỌI quán khác.
// 30/phút vẫn thoải mái cho thao tác thật (thêm ảnh cho cả thực đơn một lượt).
Route::post('/upload', [\App\Http\Controllers\UploadController::class, 'store'])
    ->middleware(['auth:sanctum', 'throttle:30,1']);

// Contact (public) — PHẢI có throttle: endpoint này ghi thẳng vào CSDL, không cần
// đăng nhập và không có captcha. Không giới hạn thì một script đơn giản đủ để lấp
// đầy hạn mức 512MB của MongoDB Atlas bậc miễn phí (ảnh hưởng dữ liệu MỌI quán)
// và đẩy liên hệ thật của khách ra khỏi tầm nhìn của admin.
Route::post('/contact', [ContactController::class, 'store'])->middleware('throttle:5,1');

// Trợ lý TƯ VẤN (public) — hộp chat ở trang giới thiệu, hỏi được khi CHƯA đăng nhập.
//
// KHÔNG gắn middleware 'ai' và cũng KHÔNG mang {shop}: đây là tuyến tư vấn bán hàng,
// ngữ cảnh chỉ có bảng gói và thông tin sản phẩm (ConsultKnowledgeService) — không
// một truy vấn nào chạm vào doanh thu, bàn hay thực đơn của quán nào. Hỏi số liệu
// quán thì phải đi tuyến shops/{shop}/ai/* bên dưới, và tuyến đó vẫn chặn ở Pro Max.
//
// Trần 'ai-tu-van' (AppServiceProvider) chặt hơn hẳn trần chung: mỗi lượt gọi ở đây
// đốt hạn ngạch Gemini bậc miễn phí, mà hạn ngạch đó dùng chung với trợ lý của chủ
// quán đã trả tiền.
Route::middleware('throttle:ai-tu-van')->group(function () {
    Route::post('/ai/consult', [AiConsultController::class, 'chat']);
    Route::post('/ai/consult/stream', [AiConsultController::class, 'chatStream']);
});

// Shop (user's own)
// KHÔNG có route xóa quán: xóa một quán sẽ bỏ rơi toàn bộ bàn, thực đơn, hóa đơn
// và gói đã mua của quán đó (Mongo không cascade). Chủ quán chỉ đổi
// shops.status: open (đang mở cửa) / closed (đã đóng cửa) / inactive (ngừng hoạt động).
Route::apiResource('shops', ShopController::class)->except('destroy')->middleware('auth:sanctum');

// Shop-scoped resources (read allowed without subscription, write requires subscription)
Route::middleware('auth:sanctum')->group(function () {
    // Categories - CRUD
    Route::get('shops/{shop}/categories', [CategoryController::class, 'index']);
    Route::post('shops/{shop}/categories', [CategoryController::class, 'store'])->middleware('subscription');
    Route::put('shops/{shop}/categories/{category}', [CategoryController::class, 'update'])->middleware('subscription');
    // KHÔNG có route xóa danh mục: xóa sẽ bỏ rơi các món bên trong (mồ côi
    // danh mục) — chủ quán chỉ ẨN danh mục (is_active = false).

    // Items - CRUD
    Route::get('shops/{shop}/products', [ProductController::class, 'index']);
    Route::post('shops/{shop}/products', [ProductController::class, 'store'])->middleware('subscription');
    Route::put('shops/{shop}/products/{product}', [ProductController::class, 'update'])->middleware('subscription');
    // KHÔNG có route xóa món: món đã bán nằm trong order/hóa đơn cũ,
    // chủ quán chỉ được ẨN món (is_available = false) thay vì xóa.
    // KHÔNG có route cấu hình topping riêng cho món: topping đi kèm trường
    // `topping_ids` ngay trong body của store/update món.

    // Toppings - CRUD
    Route::get('shops/{shop}/toppings', [ToppingController::class, 'index']);
    Route::post('shops/{shop}/toppings', [ToppingController::class, 'store'])->middleware('subscription');
    Route::put('shops/{shop}/toppings/{topping}', [ToppingController::class, 'update'])->middleware('subscription');
    // KHÔNG có route xóa topping: topping từng bán nằm trong hóa đơn cũ và
    // cấu hình gắn món — chủ quán chỉ ẨN topping (is_available = false).

    // Tables - CRUD
    Route::get('shops/{shop}/tables', [TableController::class, 'index']);
    Route::post('shops/{shop}/tables', [TableController::class, 'store'])->middleware('subscription');
    Route::put('shops/{shop}/tables/{table}', [TableController::class, 'update'])->middleware('subscription');
    Route::delete('shops/{shop}/tables/{table}', [TableController::class, 'destroy'])->middleware('subscription');

    // Orders - create/pay requires subscription
    Route::get('shops/{shop}/orders', [OrderController::class, 'index']);
    Route::post('shops/{shop}/orders', [OrderController::class, 'store'])->middleware('subscription');
    Route::get('shops/{shop}/orders/{order}', [OrderController::class, 'show']);
    Route::put('shops/{shop}/orders/{order}', [OrderController::class, 'update'])->middleware('subscription');
    Route::post('shops/{shop}/orders/{order}/pay', [OrderController::class, 'pay'])->middleware('subscription');
    Route::post('shops/{shop}/orders/{order}/cancel', [OrderController::class, 'cancel'])->middleware('subscription');

    // Reviews
    // Đánh giá là về PHẦN MỀM, mỗi tài khoản một cái — nên route đọc "của tôi" KHÔNG
    // đi qua {shop}. Frontend hỏi theo quán thì đổi sang quán chưa đánh giá sẽ tưởng
    // là chưa từng viết và mời viết lại.
    Route::get('reviews/mine', [ReviewController::class, 'mine']);
    Route::get('shops/{shop}/reviews', [ReviewController::class, 'index']);
    Route::post('shops/{shop}/reviews', [ReviewController::class, 'store'])->middleware('subscription');

    // Trợ lý AI (chỉ gói bật can_use_ai — middleware 'ai'; throttle chống đốt credit)
    Route::post('shops/{shop}/ai/chat', [AiController::class, 'chat'])
        ->middleware(['ai', 'throttle:20,1']);
    Route::post('shops/{shop}/ai/chat/stream', [AiController::class, 'chatStream'])
        ->middleware(['ai', 'throttle:20,1']);
    Route::post('shops/{shop}/ai/revenue-analysis', [AiController::class, 'revenueAnalysis'])
        ->middleware(['ai', 'throttle:10,1']);
    // Câu gợi ý mở đầu cho chat — chỉ đếm dữ liệu của quán, KHÔNG gọi Gemini,
    // nên throttle rộng tay hơn các endpoint đốt credit ở trên.
    Route::get('shops/{shop}/ai/suggestions', [AiController::class, 'suggestions'])
        ->middleware(['ai', 'throttle:60,1']);
});

// Packages & Time Subscriptions
Route::get('packages', [PackageController::class, 'index']);
Route::get('packages/{package}/time-subscriptions', [TimeSubscriptionController::class, 'index']);

// Cổng thanh toán (public - cổng/trình duyệt gọi không kèm token)
Route::get('payments/vnpay/return', [\App\Http\Controllers\PaymentGatewayController::class, 'vnpayReturn']);
Route::get('payments/vnpay/ipn', [\App\Http\Controllers\PaymentGatewayController::class, 'vnpayIpn']);
// MoMo: IPN là POST với thân JSON, không phải GET như VNPay.
Route::get('payments/momo/return', [\App\Http\Controllers\PaymentGatewayController::class, 'momoReturn']);
Route::post('payments/momo/ipn', [\App\Http\Controllers\PaymentGatewayController::class, 'momoIpn']);

// Subscriptions — ĐA QUÁN: gói/thanh toán độc lập theo từng quán (shops/{shop}/...)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('shops/{shop}/subscriptions', [SubscriptionController::class, 'index']);
    Route::get('shops/{shop}/subscriptions/active', [SubscriptionController::class, 'active']);
    Route::get('shops/{shop}/subscriptions/payments', [SubscriptionController::class, 'payments']);
    // Xem trước số phải trả (gồm phần cấn trừ khi nâng cấp) — chỉ đọc, không tạo giao dịch.
    Route::get('shops/{shop}/subscriptions/preview', [SubscriptionController::class, 'preview']);
    Route::post('shops/{shop}/subscriptions', [SubscriptionController::class, 'store']);

    // Tổng doanh thu gộp tất cả quán của user (không theo quán cụ thể)
    Route::get('revenue/overview', [\App\Http\Controllers\UserRevenueController::class, 'overview']);
    // Số liệu trang Doanh thu: đã cộng sẵn ở máy chủ, nhận khoảng ngày + phạm vi quán.
    Route::get('revenue/summary', [\App\Http\Controllers\UserRevenueController::class, 'summary']);
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
