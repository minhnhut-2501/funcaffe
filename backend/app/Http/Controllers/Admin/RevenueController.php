<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\PackagePayment;
use App\Models\Subscription;
use App\Models\Package;
use Illuminate\Http\Request;

class RevenueController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    public function index()
    {
        // BUG-01 FIX: Chỉ có status 'paid' là hợp lệ — 'approved' không tồn tại trong hệ thống
        $successStatuses = ['paid'];

        $paidPayments = PackagePayment::whereIn('payment_status', $successStatuses)->get();

        // Các khoản hoàn tiền ĐÃ DUYỆT (refund pro-rata khi nâng gói) phải trừ khỏi doanh thu
        $approvedRefunds = PackagePayment::where('refund_status', 'approved')->get();
        $totalRefunded   = (float) $approvedRefunds->sum('refund_amount');

        $grossRevenue = (float) $paidPayments->sum('amount');
        $totalRevenue = $grossRevenue - $totalRefunded; // doanh thu thực (net)

        $totalUsers = User::count();
        $activeSubscriptions = Subscription::where('status', 'active')->count();
        $pendingPayments = PackagePayment::where('payment_status', 'pending')->count();

        // Hoàn tiền theo tháng (theo thời điểm hoàn) để trừ vào doanh thu tháng tương ứng
        $refundByMonth = $approvedRefunds->groupBy(function ($p) {
            $d = $p->refunded_at ?? $p->updated_at ?? $p->created_at;
            return $d ? $d->format('Y-m') : 'unknown';
        })->map(fn($items) => (float) $items->sum('refund_amount'));

        $monthly = $paidPayments
            ->groupBy(fn($p) => $p->created_at ? $p->created_at->format('Y-m') : 'unknown')
            ->map(fn($items, $month) => [
                'month' => $month,
                'revenue' => (float) $items->sum('amount') - ($refundByMonth[$month] ?? 0),
                'count' => $items->count(),
            ])
            ->values();

        $packageStats = Package::all()->map(function ($pkg) use ($successStatuses) {
            $gross  = (float) PackagePayment::where('package_id', $pkg->id)->whereIn('payment_status', $successStatuses)->sum('amount');
            $refund = (float) PackagePayment::where('package_id', $pkg->id)->where('refund_status', 'approved')->sum('refund_amount');
            return [
                'name' => $pkg->name,
                'type' => $pkg->type ?? 'free',
                'user_count' => Subscription::where('package_id', $pkg->id)->where('status', 'active')->count(),
                'revenue' => $gross - $refund,
            ];
        });

        return response()->json([
            'total_users' => $totalUsers,
            'total_revenue' => $totalRevenue,
            'gross_revenue' => $grossRevenue,
            'total_refunded' => $totalRefunded,
            'active_subscriptions' => $activeSubscriptions,
            'pending_payments' => $pendingPayments,
            'monthly_data' => $monthly,
            'package_stats' => $packageStats,
            'paid_payments' => $paidPayments,
        ]);
    }
}
