<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Laravel\Sanctum\Sanctum;

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    |
    | Requests from the following domains / hosts will receive stateful API
    | authentication cookies. Typically, these should include your local
    | and production domains which access your API via a frontend SPA.
    |
    */

    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        '',
        Sanctum::currentApplicationUrlWithPort(),
    ))),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Guards
    |--------------------------------------------------------------------------
    |
    | This array contains the authentication guards that will be checked when
    | Sanctum is trying to authenticate a request. If none of these guards
    | are able to authenticate the request, Sanctum will use the bearer
    | token that's present on an incoming request for authentication.
    |
    */

    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Expiration Minutes
    |--------------------------------------------------------------------------
    |
    | This value controls the number of minutes until an issued token will be
    | considered expired. This will override any values set in the token's
    | "expires_at" attribute, but first-party sessions are not affected.
    |
    */

    /*
     * CHÍNH SÁCH HẠN DÙNG TOKEN (việc 2.5.3): 30 ngày.
     *
     * Để `null` là token sống mãi. Nghĩa là một token bị chép lại — máy bán hàng để
     * mở ở quán, một lần đăng nhập trên máy công cộng, ảnh chụp `localStorage` — mở
     * được tài khoản đó vô thời hạn, cả sau khi chủ quán đã đổi mật khẩu trên máy khác
     * (đổi mật khẩu chỉ thu hồi token KHÁC, giữ token đang dùng).
     *
     * 30 ngày là mức đủ để chủ quán không bị hỏi lại mật khẩu trong lúc làm việc (mở
     * hằng ngày thì gần như không bao giờ chạm hạn) nhưng vẫn đặt điểm dừng cho token
     * đã rời tay chủ. Con số này áp cho mọi token, bất kể ô "Ghi nhớ đăng nhập" —
     * ô đó chỉ quyết định trình duyệt giữ token ở đâu.
     *
     * Bản ghi token đã quá hạn vẫn nằm lại trong bảng: dọn bằng
     * `php artisan sanctum:prune-expired --hours=24` (chưa hẹn giờ tự chạy vì gói
     * miễn phí của Render không có bộ hẹn giờ — ghi trong báo cáo triển khai).
     */
    'expiration' => env('SANCTUM_EXPIRATION_MINUTES', 60 * 24 * 30),

    /*
    |--------------------------------------------------------------------------
    | Token Prefix
    |--------------------------------------------------------------------------
    |
    | Sanctum can prefix new tokens in order to take advantage of numerous
    | security scanning initiatives maintained by open source platforms
    | that notify developers if they commit tokens into repositories.
    |
    | See: https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning
    |
    */

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Middleware
    |--------------------------------------------------------------------------
    |
    | When authenticating your first-party SPA with Sanctum you may need to
    | customize some of the middleware Sanctum uses while processing the
    | request. You may change the middleware listed below as required.
    |
    */

    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],

];
