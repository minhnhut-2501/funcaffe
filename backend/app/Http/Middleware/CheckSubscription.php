<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckSubscription
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user() && $request->user()->role !== 'admin') {
            // BUG-04 FIX: Kiểm tra cả end_date để chặn subscription hết hạn
            $hasActiveSub = $request->user()->subscriptions()
                ->where('status', 'active')
                ->where('end_date', '>', now())
                ->exists();

            if (!$hasActiveSub) {
                return response()->json(['message' => 'Bạn cần kích hoạt gói dịch vụ để sử dụng chức năng này.'], 403);
            }
        }

        return $next($request);
    }
}
