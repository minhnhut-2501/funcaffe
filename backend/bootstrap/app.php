<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'subscription' => \App\Http\Middleware\CheckSubscription::class,
            'ai' => \App\Http\Middleware\RequiresAI::class,
        ]);

        $middleware->statefulApi();

        // Giới hạn tần suất cho TOÀN BỘ /api (giới hạn xem ở AppServiceProvider).
        // Trước đây chỉ 5 endpoint tự gắn throttle, phần còn lại — tạo order, tạo
        // giao dịch gói, mọi lượt ghi thực đơn — không có trần nào. Một script vòng
        // lặp là đủ lấp hạn mức 512MB của MongoDB Atlas bậc miễn phí, mà hạn mức đó
        // dùng chung cho MỌI quán.
        $middleware->throttleApi();

        // Khóa tài khoản có hiệu lực ngay với token đang cầm. Xếp SAU throttle để
        // kẻ thử token hàng loạt vẫn bị chặn ở cửa trước.
        $middleware->api(append: [
            \App\Http\Middleware\EnsureAccountActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
