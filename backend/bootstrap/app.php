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
            // Chặn tài khoản NHÂN VIÊN. Gắn vào mọi tuyến không phải bán hàng.
            'chu-quan' => \App\Http\Middleware\OwnerOnly::class,
        ]);

        $middleware->statefulApi();

        // PREPEND, không phải append: phản hồi đi từ trong ra, nên chỉ lớp ngoài cùng
        // mới ghi đè được `Vary: Origin` mà HandleCors vừa gắn. Đó là header khiến
        // Cloudflare từ chối đệm mọi đường công khai. Chi tiết trong chính lớp đó.
        $middleware->prepend(\App\Http\Middleware\PublicEdgeCache::class);

        // Tin proxy đứng trước ứng dụng (Render, Vercel) để `$request->ip()` trả về
        // IP THẬT của khách chứ không phải IP của proxy.
        //
        // Không có dòng này thì mọi khách CHƯA đăng nhập đều mang cùng một địa chỉ,
        // nên họ dùng chung MỘT rổ đếm 300 lượt/phút (xem AppServiceProvider). Một
        // người đốt hết là toàn bộ endpoint công khai — gửi liên hệ, đánh giá, bảng
        // gói, hộp chat tư vấn — trả 429 cho tất cả mọi người trong phần còn lại của
        // phút đó.
        //
        // Dùng '*' vì Render không công bố dải IP cố định cho proxy của họ. An toàn ở
        // đây vì container chỉ nhận lưu lượng đi qua proxy đó, không mở cổng ra ngoài.
        $middleware->trustProxies(at: '*');

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
