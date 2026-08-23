<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Models\Package;
use App\Models\TimeSubscription;
use App\Models\PackagePayment;
use App\Models\User;
use App\Models\Shop;
use App\Http\Controllers\Concerns\RunsAtomically;
use App\Http\Controllers\Concerns\ChecksShopAccess;
use App\Services\MomoService;
use App\Services\SubscriptionActivator;
use App\Services\VnpayService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SubscriptionController extends Controller
{
    use RunsAtomically;
    use ChecksShopAccess;

    /**
     * Bao lâu thì coi một đơn cổng thanh toán 'pending' là đã bị bỏ dở.
     *
     * Phải dài hơn thời gian một người thật cần để trả tiền trên cổng (mở app ngân
     * hàng, nhập OTP, xác thực sinh trắc học...). 30 phút là rộng rãi cho việc đó
     * mà vẫn không để đơn rác tồn quá lâu trong sổ.
     */
    private const GATEWAY_PENDING_TTL_MINUTES = 30;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /** Mốc thời gian mà trước đó mọi đơn cổng 'pending' bị coi là đã bỏ. */
    private function gatewayPendingDeadline(): \Illuminate\Support\Carbon
    {
        return now()->subMinutes(self::GATEWAY_PENDING_TTL_MINUTES);
    }

    /**
     * Trả về subscription cho client. Với cổng online và có số tiền phải trả, đính
     * kèm payment_url để frontend chuyển hướng sang cổng.
     *
     * VNPay chỉ dựng URL đã ký (không đi mạng, không hỏng được). MoMo phải gọi API
     * server-to-server nên CÓ THỂ HỎNG — hỏng thì phải dọn đơn ngay tại đây, nếu
     * không người dùng còn lại một đơn 'pending' treo chặn luôn lần mua kế tiếp.
     */
    private function respondSubscription($subscription, int $statusCode, float $amount, string $txnCode, Request $request)
    {
        $data = $subscription->load('package')->toArray();
        $method = $request->input('payment_method');

        if ($amount > 0 && in_array($method, PackagePayment::ONLINE_GATEWAYS, true)) {
            // Bỏ dấu tiếng Việt khỏi mô tả: cả hai cổng đều đưa chuỗi này vào chữ ký,
            // ký tự ngoài ASCII rất dễ lệch encoding giữa lúc ký và lúc gửi.
            $orderInfo = 'Thanh toan goi ' . preg_replace('/[^A-Za-z0-9 ]/', '', $subscription->package_name_snapshot ?? 'FunCafe');
            $payable = (int) round($amount);

            if ($method === 'vnpay') {
                $data['payment_url'] = app(VnpayService::class)->buildPaymentUrl(
                    $txnCode,
                    $payable,
                    $orderInfo,
                    (string) $request->ip()
                );
            } else {
                $payment = PackagePayment::where('transaction_code', $txnCode)->first();

                // Đuôi ngẫu nhiên: MoMo bắt mã đơn duy nhất theo PARTNER CODE, mà mã
                // partner của môi trường thử nghiệm là dùng chung. transaction_code lại
                // đếm theo từng CSDL, nên local và production cùng đẻ ra 'TXN-<ngày>-0001'
                // cho giao dịch đầu ngày — cái gửi sau bị MoMo từ chối vì trùng.
                $gatewayOrderId = $txnCode . '-' . strtolower(Str::random(6));
                $payment?->update(['gateway_order_id' => $gatewayOrderId]);

                try {
                    $data['payment_url'] = app(MomoService::class)->createPayment($gatewayOrderId, $payable, $orderInfo);
                } catch (\Throwable $e) {
                    if ($payment) {
                        $this->atomic(fn () => app(SubscriptionActivator::class)->rejectAndRollback($payment));
                    }

                    return response()->json([
                        'message' => 'Không kết nối được cổng MoMo: ' . $e->getMessage(),
                    ], 502);
                }
            }
        }

        return response()->json($data, $statusCode);
    }

    /**
     * Tính giá trị còn lại của gói cũ để CẤN TRỪ vào giá gói nâng cấp
     * (pro-rata theo số ngày chưa dùng). Trả về số tiền làm tròn, tối thiểu 0.
     *
     * Dựa vào $oldSub->total_amount = TỔNG tiền đã trả cho chu kỳ start_date -> end_date.
     * Mọi nhánh kéo dài end_date PHẢI cộng dồn total_amount tương ứng, nếu không tỉ lệ
     * ở đây sẽ chia số tiền cũ cho khoảng thời gian đã dài ra -> cấn trừ thiếu cho khách.
     */
    private function calculateProratedCredit($oldSub): float
    {
        if (!$oldSub || !$oldSub->start_date || !$oldSub->end_date) {
            return 0.0;
        }

        $paid = (float) ($oldSub->total_amount ?? 0);
        if ($paid <= 0) {
            return 0.0; // Gói miễn phí (Fun Free) không hoàn tiền
        }

        $now = now();
        if ($oldSub->end_date->lessThanOrEqualTo($now)) {
            return 0.0; // Đã hết hạn -> không còn gì để hoàn
        }

        $totalSeconds = $oldSub->start_date->diffInSeconds($oldSub->end_date);
        if ($totalSeconds <= 0) {
            return 0.0;
        }

        $remainingSeconds = $now->diffInSeconds($oldSub->end_date);
        $ratio = min(1, max(0, $remainingSeconds / $totalSeconds));

        return round($paid * $ratio);
    }

    /**
     * XEM TRƯỚC số tiền phải trả, TRƯỚC khi tạo bất cứ giao dịch nào.
     *
     * Lý do có endpoint này thay vì để giao diện tự tính: phần cấn trừ khi nâng cấp
     * giữa kỳ dựa vào `calculateProratedCredit()` — tỉ lệ theo giây giữa start_date và
     * end_date của gói cũ. Cài lại công thức đó ở phía trình duyệt là tạo ra hai bản
     * chắc chắn sẽ lệch nhau ở lần sửa tiếp theo, mà lệch ở đây nghĩa là màn hình hứa
     * một con số còn cổng thanh toán thu một con số khác.
     *
     * Trước khi có nó, hộp thoại thanh toán hiện "Tổng thanh toán = giá gói + VAT" cho
     * cả trường hợp nâng cấp — tức là một số CAO HƠN số thật sự bị trừ, và người dùng
     * không có cách nào biết mình được cấn trừ bao nhiêu cho tới lúc đã trả tiền xong.
     *
     * KHÔNG ghi gì vào CSDL.
     */
    public function preview(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);

        $validated = $request->validate([
            'package_id'           => 'required|string',
            'time_subscription_id' => 'nullable|string',
        ]);

        $package = Package::find($validated['package_id']);
        if (!$package) {
            return response()->json(['message' => 'Không tìm thấy gói dịch vụ.'], 404);
        }

        $vatRate = (float) config('funcafe.vat_rate', 10);
        $subtotal = 0.0;

        if ($package->is_trial) {
            $vatRate = 0;
        } else {
            $timeSub = !empty($validated['time_subscription_id'])
                ? TimeSubscription::find($validated['time_subscription_id'])
                : null;
            if (!$timeSub) {
                return response()->json(['message' => 'Vui lòng chọn thời hạn gói.'], 400);
            }
            $subtotal = (float) $timeSub->price;
        }

        $vatAmount = round($subtotal * $vatRate / 100);
        $gross     = $subtotal + $vatAmount;

        // Cùng phép so cấp bậc như store(), để nhãn hành động khớp với việc sẽ xảy ra.
        $activeSub = Subscription::latestForShop((string) $shop->id)->first();
        $oldLevel  = $activeSub ? (Package::find($activeSub->package_id)->level ?? 0) : null;
        $newLevel  = $package->level ?? 0;

        $actionType = match (true) {
            !$activeSub            => 'new',
            $newLevel > $oldLevel  => 'upgrade',
            $newLevel === $oldLevel => 'renew',
            default                => 'downgrade',
        };

        $credit  = $actionType === 'upgrade'
            ? min($this->calculateProratedCredit($activeSub), $gross)
            : 0.0;
        $payable = max(0, round($gross - $credit));

        return response()->json([
            'action_type' => $actionType,
            'subtotal'    => $subtotal,
            'vat_rate'    => $vatRate,
            'vat_amount'  => $vatAmount,
            'gross'       => $gross,
            'credit'      => $credit,
            'payable'     => $payable,
            // Nâng cấp mà cấn trừ phủ hết giá gói mới thì không phải qua cổng nào cả.
            'needs_gateway' => $payable > 0,
        ]);
    }

    /**
     * B7: sinh mã giao dịch TXN-yyyymmdd-#### không trùng — count()+1 rồi dò
     * tiếp tới số chưa dùng (count đơn thuần có thể trùng khi request song song).
     */
    private function nextTransactionCode(\Illuminate\Support\Carbon $now): string
    {
        $todayStr = $now->format('Ymd');
        $seq = PackagePayment::where('transaction_code', 'like', "TXN-{$todayStr}-%")->count() + 1;
        do {
            $txnCode = 'TXN-' . $todayStr . '-' . str_pad($seq++, 4, '0', STR_PAD_LEFT);
        } while (PackagePayment::where('transaction_code', $txnCode)->exists());

        return $txnCode;
    }

    public function index(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);

        $subscriptions = Subscription::where('shop_id', (string) $shop->id)
            ->with('package', 'packagePayments')
            ->get();

        return response()->json($subscriptions);
    }

    /**
     * Gói MỚI NHẤT của quán, kể cả khi đã quá hạn.
     *
     * Cố ý KHÔNG dùng scope effective(): frontend cần thấy cả gói đã hết hạn để hiện
     * chế độ "chỉ xem" và mời gia hạn. Xem Subscription::scopeLatestForShop().
     */
    public function active(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);

        $subscription = Subscription::latestForShop((string) $shop->id)
            ->with('package', 'packagePayments')
            ->first();

        return response()->json($subscription);
    }

    /**
     * Lịch sử thanh toán gói của chính user (để user theo dõi trạng thái:
     * chờ duyệt / đã thanh toán / bị từ chối + thông tin hoàn tiền nếu có).
     */
    public function payments(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);

        $payments = PackagePayment::where('shop_id', (string) $shop->id)
            // Giao dịch qua cổng online (VNPay/MoMo...) CHỈ hiện khi ĐÃ thanh toán (paid).
            // Đơn đang chờ cổng / bị hủy / thất bại đều không hiện (tránh hiểu nhầm "đã thanh toán").
            // Các phương thức khác vẫn hiện đầy đủ mọi trạng thái.
            ->where(function ($q) {
                $q->whereNotIn('payment_method', PackagePayment::ONLINE_GATEWAYS)
                  ->orWhere('payment_status', 'paid');
            })
            ->with('package')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($payments);
    }

    public function store(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);

        $validated = $request->validate([
            'package_id' => 'required|string',
            'time_subscription_id' => 'nullable|string',
            // CHỈ cổng online. Trước đây danh sách này còn nhận cash / bank_transfer /
            // qr_code / e_wallet, và đó là một lỗ thủng thẳng: nhánh "không phải cổng"
            // KÍCH HOẠT GÓI NGAY (xem $subscriptionStatus bên dưới) vì nó được viết cho
            // thời còn khâu admin duyệt tay. Khâu đó đã gỡ từ 22/07/2026, nhưng nhánh
            // thì còn — nên chỉ cần gọi thẳng API với payment_method='cash' là có Pro Max
            // miễn phí, không qua cổng nào. Giao diện chưa bao giờ hiện các lựa chọn đó,
            // nhưng giao diện không phải chốt chặn.
            //
            // Dựng từ chính hằng số để hai danh sách không thể lệch nhau.
            'payment_method' => ['required', 'string', 'in:' . implode(',', PackagePayment::ONLINE_GATEWAYS)],
            'note' => 'nullable|string|max:500',
        ], [
            'payment_method.in' => 'Chỉ thanh toán gói qua VNPay hoặc MoMo.',
        ]);

        $package = Package::findOrFail($validated['package_id']);
        $user = $request->user();
        $shopId = (string) $shop->id;

        // Dọn đơn cổng online (VNPay/MoMo) bị bỏ dở CỦA CHÍNH QUÁN NÀY: chúng tự kích hoạt
        // qua callback, KHÔNG chờ admin — nên không được chặn thao tác mới.
        // ĐA QUÁN: chỉ tác động quán này, tránh làm hỏng đơn pending của quán khác cùng chủ.
        //
        // CHỈ dọn đơn đã QUÁ HẠN CHỜ. Trước đây chỗ này dọn sạch mọi đơn 'pending', kể cả
        // đơn khách ĐANG trả tiền ở tab cổng thanh toán bên cạnh — khách bấm mua lần hai là
        // đơn đầu bị đánh 'failed', trả tiền xong thì tiền vào mà gói không được cấp.
        // Hai lớp bảo vệ cho tình huống đó: ngưỡng thời gian ở đây, và
        // SubscriptionActivator vẫn kích hoạt được đơn 'failed' khi cổng xác nhận thu tiền.
        $staleBefore = $this->gatewayPendingDeadline();
        $stalePayments = PackagePayment::where('shop_id', $shopId)
            ->where('payment_status', 'pending')
            ->whereIn('payment_method', PackagePayment::ONLINE_GATEWAYS)
            ->where('created_at', '<', $staleBefore)
            ->get();

        foreach ($stalePayments as $stale) {
            $stale->update(['payment_status' => 'failed']);
            // Chỉ hủy subscription ĐI KÈM đơn quá hạn đó, không quét sạch mọi sub 'pending'
            // của quán (một sub 'pending' khác có thể đang chờ đơn vẫn còn hiệu lực).
            $staleSub = $stale->subscription;
            if ($staleSub && $staleSub->status === 'pending') {
                $staleSub->update(['status' => 'cancelled']);
            }
        }

        // ĐÃ GỠ chốt chặn "đang có giao dịch chờ admin kiểm tra".
        //
        // Nó chặn quán khi tồn tại một giao dịch 'pending' không phải của cổng, và bảo
        // người ta chờ admin xử lý. Nhưng khâu admin duyệt tay đã gỡ từ 22/07/2026 —
        // Admin\PaymentController nay CHỈ ĐỌC, không còn nút duyệt hay từ chối nào.
        // Nghĩa là chốt này không còn cửa ra: quán nào rơi vào đó thì vĩnh viễn không
        // mua, gia hạn hay nâng cấp được nữa, và câu thông báo hứa hẹn một thao tác mà
        // không ai thực hiện được.
        //
        // Từ nay không đường nào tạo ra giao dịch như vậy (payment_method chỉ nhận cổng
        // online). Gỡ chốt cũng chính là lối thoát cho các bản ghi cũ còn kẹt lại.

        // Lấy time_subscription để tính giá và duration
        $timeSub = null;
        $subtotal = 0;      // giá gói CHƯA gồm VAT (niêm yết)
        $vatRate = (float) config('funcafe.vat_rate', 10); // %
        $vatAmount = 0;
        $amount = 0;        // số tiền thanh toán thực tế = subtotal + VAT
        $startDate = now();

        if ($package->is_trial) {
            // Fun Free: mặc định 7 ngày, giá 0 (không phát sinh VAT)
            $endDate = $startDate->copy()->addDays(7);
            $vatRate = 0;
        } else {
            if (empty($validated['time_subscription_id'])) {
                return response()->json(['message' => 'Vui lòng chọn thời hạn gói.'], 400);
            }
            $timeSub = TimeSubscription::findOrFail($validated['time_subscription_id']);
            $subtotal = (float) $timeSub->price;
            $vatAmount = round($subtotal * $vatRate / 100);
            $amount = $subtotal + $vatAmount;
            $durationValue = $timeSub->duration_value;
            $durationUnit = $timeSub->duration_unit;
            $endDate = $durationUnit === 'day'
                ? $startDate->copy()->addDays($durationValue)
                : $startDate->copy()->addMonths($durationValue);
        }

        // Kiểm tra quyền dùng thử. HAI cổng, cả hai đều cần:
        //  - theo TÀI KHOẢN: số quán mỗi tài khoản tạo được không bị giới hạn, nên chỉ
        //    chặn theo quán là mở đường dùng Pro Max miễn phí vĩnh viễn — hết 7 ngày
        //    thì tạo quán mới, lại được 7 ngày nữa.
        //  - theo QUÁN: lớp phòng thứ hai, phòng khi dữ liệu lệch (quán mang dấu đã
        //    dùng mà chủ thì chưa).
        //
        // HỎI TÀI KHOẢN TRƯỚC, và đây là chủ ý chứ không phải thứ tự ngẫu nhiên. Lúc
        // kích hoạt gói dùng thử, cả hai dấu được đánh CÙNG LÚC (xem đoạn dưới), nên
        // quán nào đã dùng thì chủ của nó chắc chắn cũng đã dùng. Hỏi quán trước thì
        // người dùng luôn đọc được câu "quán này đã dùng" — câu đó ngụ ý "thử quán
        // khác đi", mà tạo quán mới xong họ vẫn đâm vào cổng tài khoản và vẫn bị chặn.
        // Nói thẳng ràng buộc rộng hơn và vĩnh viễn thì họ khỏi mất công.
        if ($package->is_trial) {
            if ($user->has_used_free_trial) {
                return response()->json([
                    'message' => 'Tài khoản của bạn đã dùng gói dùng thử miễn phí rồi. Mỗi tài khoản chỉ được dùng thử một lần — vui lòng chọn gói trả phí cho quán này.',
                ], 400);
            }
            if ($shop->has_used_free_trial) {
                return response()->json([
                    'message' => 'Quán này đã dùng gói dùng thử trước đó. Mỗi quán chỉ được dùng thử một lần — vui lòng chọn gói trả phí.',
                ], 400);
            }
        }

        // Gói hiện hành của QUÁN NÀY để so cấp bậc (mua mới / nâng cấp / gia hạn).
        // latestForShop sắp theo end_date: quán có nhiều bản ghi 'active' thì gói còn
        // hạn phải thắng gói đã hết, kể cả khi bản ghi của nó được tạo trước.
        $activeSub = Subscription::latestForShop($shopId)->first();

        $now = now();

        // Tạo transaction code (B7: dò tiếp tới số chưa dùng, tránh trùng khi request song song)
        $txnCode = $this->nextTransactionCode($now);

        // Cổng thanh toán online (VNPay/MoMo...) tự kích hoạt qua callback, không duyệt tay.
        $isGateway = in_array($validated['payment_method'], PackagePayment::ONLINE_GATEWAYS, true);

        if (!$activeSub) {
            // A. Chưa có subscription active -> NEW
            $isTrial = $package->is_trial;
            // Cổng online: GIỮ 'pending' (chưa cấp gói) tới khi cổng xác nhận thanh toán.
            // Tránh việc khách chọn cổng rồi back lại vẫn được kích hoạt.
            $subscriptionStatus = ($isTrial || !$isGateway) ? 'active' : 'pending';
            $paymentStatus = $isTrial ? 'paid' : 'pending';

            $subscription = $this->atomic(function () use (
                $user, $shop, $shopId, $package, $timeSub, $startDate, $endDate, $amount,
                $subtotal, $vatRate, $vatAmount,
                $subscriptionStatus, $paymentStatus, $txnCode,
                $validated, $now, $isTrial
            ) {
                // Tạo thẳng qua model, KHÔNG qua $user->subscriptions(): đi qua quan hệ
                // sẽ tự nhét user_id vào document, mà gói thì gắn với quán chứ không
                // gắn với tài khoản.
                $subscription = Subscription::create([
                    'shop_id' => $shopId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'package_name_snapshot' => $package->name,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'total_amount' => $amount,
                    'status' => $subscriptionStatus,
                ]);

                $subscription->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'shop_id' => $shopId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'subtotal' => $subtotal,
                    'vat_rate' => $vatRate,
                    'vat_amount' => $vatAmount,
                    'amount' => $amount,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => $paymentStatus,
                    'transaction_code' => $txnCode,
                    'paid_at' => $isTrial ? $now : null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'new',
                    'previous_subscription_id' => null,
                    'previous_end_date' => null,
                    'credit_amount' => 0,
                ]);

                // Đánh dấu đã dùng thử ở CẢ HAI cấp — xem hai cổng kiểm tra ở trên.
                if ($isTrial) {
                    $shop->update(['has_used_free_trial' => true]);
                    $user->update(['has_used_free_trial' => true]);
                }

                return $subscription;
            });

            return $this->respondSubscription($subscription, 201, $amount, $txnCode, $request);
        }

        // Có subscription active -> so sánh level
        $oldPackage = Package::find($activeSub->package_id);
        $oldLevel = $oldPackage ? ($oldPackage->level ?? 0) : 0;
        $newLevel = $package->level ?? 0;

        if ($newLevel > $oldLevel) {
            // B. UPGRADE — CẤN TRỪ THẲNG phần còn lại của gói cũ vào giá gói mới ("credit ngay").
            // Giá trị còn lại (pro-rata theo thời gian, đã gồm VAT) được TRỪ ngay vào số tiền
            // phải trả; KHÔNG tạo yêu cầu hoàn tiền chờ admin nữa. User chỉ trả phần chênh lệch.
            $grossAmount = $amount;                                            // giá gói mới (đã gồm VAT)
            $credit      = min($this->calculateProratedCredit($activeSub), $grossAmount); // không vượt quá giá gói mới
            $payable     = max(0, round($grossAmount - $credit));              // số tiền thực trả sau khi cấn trừ

            // Nếu phần cấn trừ đã phủ hết giá gói mới (payable = 0) thì không cần qua cổng thanh toán:
            // kích hoạt ngay như luồng duyệt tay (admin xác nhận giao dịch 0đ).
            $gatewayCharge = $isGateway && $payable > 0;

            // Cấn trừ phủ hết giá gói mới (payable = 0) thì KHÔNG có gì để thu: gói được
            // cấp ngay, nên giao dịch phải ghi là ĐÃ THANH TOÁN luôn. Để 'pending' thì
            // không luồng nào chuyển nó sang 'paid' (cổng không được gọi vì không có
            // tiền, admin thì không còn nút duyệt tay), và tới lần mua sau nó bị đoạn
            // dọn dẹp đánh dấu 'failed' — sổ sách ghi "thất bại" cho một gói đang chạy.
            $upgradePaymentStatus = $payable > 0 ? 'pending' : 'paid';

            $subscription = $this->atomic(function () use (
                $user, $shopId, $package, $timeSub, $startDate, $endDate, $payable,
                $subtotal, $vatRate, $vatAmount, $now,
                $txnCode, $validated, $activeSub, $credit, $gatewayCharge, $upgradePaymentStatus
            ) {
                // VNPay (có thu tiền): HOÃN hủy gói cũ tới khi thanh toán xác nhận (khách back lại -> giữ nguyên gói cũ).
                if (!$gatewayCharge) {
                    $activeSub->update(['status' => 'cancelled']);
                }

                // Tạo sub mới. VNPay -> 'pending' (chưa hiệu lực) tới khi cổng xác nhận.
                // total_amount = số THỰC TRẢ (đã cấn trừ) -> pro-rata lần nâng cấp sau tính đúng.
                $subscription = Subscription::create([
                    'shop_id' => $shopId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'package_name_snapshot' => $package->name,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'total_amount' => $payable,
                    'status' => $gatewayCharge ? 'pending' : 'active',
                ]);

                $subscription->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'shop_id' => $shopId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'subtotal' => $subtotal,
                    'vat_rate' => $vatRate,
                    'vat_amount' => $vatAmount,
                    'amount' => $payable,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => $upgradePaymentStatus,
                    'transaction_code' => $txnCode,
                    'paid_at' => $upgradePaymentStatus === 'paid' ? $now : null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'upgrade',
                    'previous_subscription_id' => (string) $activeSub->id,
                    'previous_end_date' => null,
                    'credit_amount' => $credit,
                ]);

                return $subscription;
            });

            return $this->respondSubscription($subscription, 201, $payable, $txnCode, $request);
        }

        if ($newLevel === $oldLevel) {
            // C. RENEW
            $previousEndDate = $activeSub->end_date;

            // BUG-06 FIX: Cộng trực tiếp duration vào previousEndDate nếu còn hiệu lực,
            // hoặc vào now() nếu đã hết hạn
            $baseDate = ($previousEndDate && $previousEndDate->greaterThan($now))
                ? $previousEndDate->copy()
                : $now->copy();

            if ($timeSub) {
                $durationValue = $timeSub->duration_value;
                $durationUnit = $timeSub->duration_unit;
                $newEndDate = $durationUnit === 'day'
                    ? $baseDate->addDays($durationValue)
                    : $baseDate->addMonths($durationValue);
            } else {
                $newEndDate = $baseDate->addMonths(1);
            }

            $this->atomic(function () use (
                $activeSub, $newEndDate, $user, $shopId, $package, $timeSub, $amount,
                $subtotal, $vatRate, $vatAmount,
                $validated, $txnCode, $previousEndDate, $isGateway
            ) {
                // VNPay: HOÃN gia hạn end_date tới khi thanh toán xác nhận (khách back lại -> không cộng thêm ngày).
                // Gói hiện tại vẫn 'active' như cũ; end_date mới sẽ được áp khi cổng xác nhận (markPaidAndActivate).
                if (!$isGateway) {
                    $activeSub->update([
                        'end_date' => $newEndDate,
                        // total_amount = TỔNG tiền đã trả cho chu kỳ hiện hành (start_date -> end_date).
                        // Phải cộng dồn ĐÚNG THEO CẶP với end_date, nếu không calculateProratedCredit()
                        // sẽ chia số tiền cũ cho khoảng thời gian đã dài ra -> cấn trừ thiếu cho khách.
                        'total_amount' => (float) ($activeSub->total_amount ?? 0) + $amount,
                    ]);
                }

                // Tạo package_payment
                $activeSub->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'shop_id' => $shopId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'subtotal' => $subtotal,
                    'vat_rate' => $vatRate,
                    'vat_amount' => $vatAmount,
                    'amount' => $amount,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => 'pending',
                    'transaction_code' => $txnCode,
                    'paid_at' => null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'renew',
                    'previous_subscription_id' => (string) $activeSub->id,
                    'previous_end_date' => $previousEndDate,
                    'credit_amount' => 0,
                ]);
            });

            return $this->respondSubscription($activeSub->fresh(), 200, $amount, $txnCode, $request);
        }

        // D. DOWNGRADE - không cho phép
        return response()->json([
            'message' => 'Không thể hạ gói khi gói hiện tại còn hiệu lực.'
        ], 400);
    }

}
