<?php

namespace App\Http\Middleware;

use App\Models\Cafe;
use App\Models\Subscription;
use Closure;
use Illuminate\Http\Request;

class CheckSubscription
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user() && $request->user()->role !== 'admin') {
            // ĐA QUÁN: gói tính theo TỪNG QUÁN. Mọi route gắn middleware này đều là
            // cafes/{cafe}/... nên đọc quán từ route rồi kiểm gói CÒN HIỆU LỰC của quán đó.
            $cafe = $request->route('cafe');
            $cafeId = $cafe instanceof Cafe ? (string) $cafe->id : (string) $cafe;

            // BUG-04 FIX: dùng scope effective() (active + còn hạn) cho thống nhất toàn hệ thống.
            $hasActiveSub = $cafeId
                ? Subscription::where('cafe_id', $cafeId)->effective()->exists()
                : false;

            if (!$hasActiveSub) {
                return response()->json(['message' => 'Quán này cần kích hoạt gói dịch vụ để sử dụng chức năng này.'], 403);
            }
        }

        return $next($request);
    }
}
