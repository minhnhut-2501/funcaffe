<?php

namespace App\Providers;

use App\Models\PersonalAccessToken;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        $this->dinhNghiaGioiHanTanSuat();
    }

    /**
     * Trần tần suất cho toàn bộ /api (bật ở bootstrap/app.php qua `throttleApi()`).
     *
     * 300 lượt/phút là RỘNG so với dùng thật: một màn hình bán hàng nặng nhất cũng chỉ
     * gọi chừng mười lượt mỗi lần mở, còn quán đông khách thì vài lượt mỗi giây là
     * cùng. Con số này không nhắm vào người dùng thật — nó chặn vòng lặp tự động, thứ
     * đi nhanh hơn hai bậc độ lớn.
     *
     * Đếm theo TÀI KHOẢN khi đã đăng nhập, theo địa chỉ IP khi chưa. Đếm theo IP cho
     * cả hai thì mấy máy bán hàng của cùng một quán ngồi sau một đường mạng sẽ ăn
     * chung một trần — quán càng đông càng dễ bị chặn, đúng lúc không nên bị chặn.
     *
     * Các endpoint nhạy cảm vẫn giữ throttle riêng chặt hơn (đăng nhập 10/phút, gửi
     * liên hệ 5/phút…); hai lớp cộng lại, lớp nào chặt hơn thì lớp đó chạm trước.
     */
    private function dinhNghiaGioiHanTanSuat(): void
    {
        RateLimiter::for('api', function (Request $request) {
            // PHẢI hỏi thẳng guard 'sanctum': middleware throttle chạy TRƯỚC
            // `auth:sanctum`, lúc đó `$request->user()` (guard mặc định) còn null nên
            // mọi lượt gọi sẽ bị đếm theo IP — đúng cái nhược điểm nói ở trên.
            $id = $request->user('sanctum')?->getAuthIdentifier();

            return Limit::perMinute(300)->by($id ? 'u:' . $id : 'ip:' . $request->ip());
        });
    }
}
