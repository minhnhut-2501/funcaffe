<?php

namespace App\Http\Controllers;

use App\Models\TimeSubscription;
use App\Models\Package;
use Illuminate\Http\Request;

class TimeSubscriptionController extends Controller
{
    // Endpoint công khai: trang Bảng giá / Trang chủ (khách chưa đăng nhập) cần
    // xem được giá các gói. KHÔNG ép auth ở đây (quản lý thời hạn gói là
    // Admin\TimeSubscriptionController riêng, đã có auth + admin).
    public function index(Package $package)
    {
        return response()->json($package->timeSubscriptions()->where('status', 'active')->get());
    }
}
