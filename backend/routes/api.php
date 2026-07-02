<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CafeController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\ToppingController;
use App\Http\Controllers\TableController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\TimeSubscriptionController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\ReviewController;
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
Route::apiResource('cafes', CafeController::class)->middleware('auth:sanctum');

// Cafe-scoped resources (read allowed without subscription, write requires subscription)
Route::middleware('auth:sanctum')->group(function () {
    // Categories - CRUD
    Route::get('cafes/{cafe}/categories', [CategoryController::class, 'index']);
    Route::post('cafes/{cafe}/categories', [CategoryController::class, 'store'])->middleware('subscription');
    Route::put('cafes/{cafe}/categories/{category}', [CategoryController::class, 'update'])->middleware('subscription');
    Route::delete('cafes/{cafe}/categories/{category}', [CategoryController::class, 'destroy'])->middleware('subscription');

    // Items - CRUD
    Route::get('cafes/{cafe}/items', [ItemController::class, 'index']);
    Route::post('cafes/{cafe}/items', [ItemController::class, 'store'])->middleware('subscription');
    Route::put('cafes/{cafe}/items/{item}', [ItemController::class, 'update'])->middleware('subscription');
    Route::delete('cafes/{cafe}/items/{item}', [ItemController::class, 'destroy'])->middleware('subscription');
    Route::get('cafes/{cafe}/items/{item}/toppings', [ItemController::class, 'toppings']);
    Route::put('cafes/{cafe}/items/{item}/toppings', [ItemController::class, 'updateToppings'])->middleware('subscription');

    // Toppings - CRUD
    Route::get('cafes/{cafe}/toppings', [ToppingController::class, 'index']);
    Route::post('cafes/{cafe}/toppings', [ToppingController::class, 'store'])->middleware('subscription');
    Route::put('cafes/{cafe}/toppings/{topping}', [ToppingController::class, 'update'])->middleware('subscription');
    Route::delete('cafes/{cafe}/toppings/{topping}', [ToppingController::class, 'destroy'])->middleware('subscription');

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

    // Invoices
    Route::get('cafes/{cafe}/invoices', [InvoiceController::class, 'index']);
    Route::get('cafes/{cafe}/invoices/{invoice}', [InvoiceController::class, 'show']);

    // Reviews
    Route::get('cafes/{cafe}/reviews', [ReviewController::class, 'index']);
    Route::post('cafes/{cafe}/reviews', [ReviewController::class, 'store'])->middleware('subscription');
});

// Packages & Time Subscriptions
Route::get('packages', [PackageController::class, 'index']);
Route::get('packages/{package}/time-subscriptions', [TimeSubscriptionController::class, 'index']);

// Cổng thanh toán VNPay (public - VNPay/trình duyệt gọi không kèm token)
Route::get('payments/vnpay/return', [\App\Http\Controllers\PaymentGatewayController::class, 'vnpayReturn']);
Route::get('payments/vnpay/ipn', [\App\Http\Controllers\PaymentGatewayController::class, 'vnpayIpn']);

// Subscriptions
Route::middleware('auth:sanctum')->group(function () {
    Route::get('subscriptions', [SubscriptionController::class, 'index']);
    Route::get('subscriptions/active', [SubscriptionController::class, 'active']);
    Route::get('subscriptions/payments', [SubscriptionController::class, 'payments']);
    Route::post('subscriptions', [SubscriptionController::class, 'store']);
});

// Admin
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('users', [Admin\UserController::class, 'index']);
    Route::put('users/{user}/lock', [Admin\UserController::class, 'toggleLock']);

    Route::get('payments', [Admin\PaymentController::class, 'index']);
    Route::put('payments/{payment}/approve', [Admin\PaymentController::class, 'approve']);
    Route::put('payments/{payment}/reject', [Admin\PaymentController::class, 'reject']);
    Route::put('payments/{payment}/reset', [Admin\PaymentController::class, 'reset']);
    // #4: Admin xác nhận / từ chối hoàn tiền khi nâng cấp gói
    Route::put('payments/{payment}/refund/approve', [Admin\PaymentController::class, 'approveRefund']);
    Route::put('payments/{payment}/refund/reject', [Admin\PaymentController::class, 'rejectRefund']);
    Route::put('payments/{payment}', [Admin\PaymentController::class, 'update']);

    Route::get('reviews', [Admin\ReviewController::class, 'index']);
    Route::put('reviews/{review}/toggle', [Admin\ReviewController::class, 'toggleStatus']);

    Route::get('revenue', [Admin\RevenueController::class, 'index']);

    Route::get('packages', [Admin\PackageController::class, 'index']);
    Route::put('packages/{package}', [Admin\PackageController::class, 'update']);

    // Time Subscriptions
    Route::get('time-subscriptions', [Admin\TimeSubscriptionController::class, 'index']);
    Route::post('time-subscriptions', [Admin\TimeSubscriptionController::class, 'store']);
    Route::put('time-subscriptions/{timeSubscription}', [Admin\TimeSubscriptionController::class, 'update']);
    Route::delete('time-subscriptions/{timeSubscription}', [Admin\TimeSubscriptionController::class, 'destroy']);
});
