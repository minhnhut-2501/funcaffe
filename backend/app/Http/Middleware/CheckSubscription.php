<?php

namespace App\Http\Middleware;

use App\Models\Shop;
use App\Models\Subscription;
use Closure;
use Illuminate\Http\Request;

class CheckSubscription
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user() && $request->user()->role !== 'admin') {
            // ĐA QUÁN: gói tính theo TỪNG QUÁN. Mọi route gắn middleware này đều là
            // shops/{shop}/... nên đọc quán từ route rồi kiểm gói CÒN HIỆU LỰC của quán đó.
            $shop = $request->route('shop');
            $shopId = $shop instanceof Shop ? (string) $shop->id : (string) $shop;

            // BUG-04 FIX: dùng scope effective() (active + còn hạn) cho thống nhất toàn hệ thống.
            $hasActiveSub = $shopId
                ? Subscription::where('shop_id', $shopId)->effective()->exists()
                : false;

            if (!$hasActiveSub) {
                return response()->json(['message' => 'Quán này cần kích hoạt gói dịch vụ để sử dụng chức năng này.'], 403);
            }
        }

        return $next($request);
    }
}
