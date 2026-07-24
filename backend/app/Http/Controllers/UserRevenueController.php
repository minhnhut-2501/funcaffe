<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\Order;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Http\Request;
use MongoDB\BSON\UTCDateTime;
use Throwable;

/**
 * Tổng doanh thu GỘP tất cả quán của một user (đa quán).
 * Khác Admin\RevenueController (toàn hệ thống) — đây chỉ tính các quán do chính
 * user sở hữu. Xem doanh thu là quyền cơ bản của mọi user nên KHÔNG gate theo gói.
 */
class UserRevenueController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function overview(Request $request)
    {
        $user = $request->user();

        $cafes = Cafe::where('user_id', (string) $user->id)->get();
        if ($cafes->isEmpty()) {
            return response()->json([
                'total' => 0,
                'today' => 0,
                'this_month' => 0,
                'revenue_by_month' => [],
                'cafes' => [],
            ]);
        }

        $cafeIds = $cafes->pluck('id')->map(fn ($id) => (string) $id)->all();

        // Gói active (còn hiệu lực) của từng quán -> hiện tên gói trên thẻ.
        $activeSubs = Subscription::whereIn('cafe_id', $cafeIds)
            ->effective()
            ->get()
            ->keyBy(fn ($s) => (string) $s->cafe_id);

        // Doanh thu đọc thẳng từ order đã thanh toán (bỏ bảng invoices).
        // Loại đơn đã hoàn tiền (payment_status='refunded').
        $invoices = Order::whereIn('cafe_id', $cafeIds)
            ->where('status', 'paid')
            ->where('payment_status', 'paid')
            ->get();

        $todayStr = Carbon::now()->format('Y-m-d');
        $thisMonthStr = Carbon::now()->format('Y-m');

        $byMonth = [];                 // gộp mọi quán, key 'Y-m'
        $perCafe = [];                 // key cafe_id => ['total','today','month']
        foreach ($cafeIds as $cid) {
            $perCafe[$cid] = ['total' => 0, 'today' => 0, 'month' => 0];
        }

        $grandTotal = 0;
        $grandToday = 0;
        $grandMonth = 0;

        foreach ($invoices as $inv) {
            $cid = (string) $inv->cafe_id;
            $amount = (int) ($inv->total_amount ?? 0);
            $date = $this->toCarbon($inv->paid_at ?? $inv->created_at);

            $grandTotal += $amount;
            if (isset($perCafe[$cid])) {
                $perCafe[$cid]['total'] += $amount;
            }

            if ($date) {
                $mKey = $date->format('Y-m');
                $byMonth[$mKey] = ($byMonth[$mKey] ?? 0) + $amount;

                if ($date->format('Y-m-d') === $todayStr) {
                    $grandToday += $amount;
                    if (isset($perCafe[$cid])) {
                        $perCafe[$cid]['today'] += $amount;
                    }
                }
                if ($mKey === $thisMonthStr) {
                    $grandMonth += $amount;
                    if (isset($perCafe[$cid])) {
                        $perCafe[$cid]['month'] += $amount;
                    }
                }
            }
        }

        ksort($byMonth);

        $cafeRows = $cafes->map(function ($cafe) use ($perCafe, $activeSubs) {
            $cid = (string) $cafe->id;
            $sub = $activeSubs->get($cid);
            $stat = $perCafe[$cid] ?? ['total' => 0, 'today' => 0, 'month' => 0];

            return [
                'cafe_id' => $cid,
                'cafe_name' => $cafe->name,
                'status' => $cafe->status,
                'package_name' => $sub->package_name_snapshot ?? null,
                'has_package' => $sub !== null,
                'total' => $stat['total'],
                'today' => $stat['today'],
                'month' => $stat['month'],
            ];
        })->values();

        return response()->json([
            'total' => $grandTotal,
            'today' => $grandToday,
            'this_month' => $grandMonth,
            'revenue_by_month' => array_slice($byMonth, -12, 12, true),
            'cafes' => $cafeRows,
        ]);
    }

    private function toCarbon($date): ?Carbon
    {
        if (!$date) {
            return null;
        }
        if ($date instanceof Carbon) {
            return $date;
        }
        if ($date instanceof UTCDateTime) {
            return Carbon::instance($date->toDateTime());
        }
        try {
            return Carbon::parse((string) $date);
        } catch (Throwable) {
            return null;
        }
    }
}
