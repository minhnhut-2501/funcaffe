<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\Order;
use App\Models\Item;
use App\Models\ItemPrice;
use App\Models\Topping;
use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use App\Http\Controllers\Concerns\RunsAtomically;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    use ChecksCafeOwnership;
    use RunsAtomically;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);
        $orders = $cafe->orders()->with(['orderDetails.orderDetailToppings.topping', 'table'])->get();
        return response()->json($orders);
    }

    public function show(Cafe $cafe, Order $order)
    {
        $this->authorizeCafe($cafe);

        if ((string) $order->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $order->load(['orderDetails.orderDetailToppings.topping', 'table']);
        return response()->json($order);
    }

    /**
     * BUG-02 FIX: Tự tính giá từ DB (ItemPrice / Item.base_price / Topping.price).
     * Không tin giá frontend gửi lên (unit_price, subtotal, price_at_time bị bỏ khỏi validation).
     */
    public function store(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $validated = $request->validate([
            'table_id'                              => 'required|string',
            'note'                                  => 'nullable|string',
            'items'                                 => 'required|array|min:1',
            'items.*.item_id'                       => 'required|string',
            'items.*.item_name_snapshot'            => 'required|string',
            'items.*.item_price_id'                 => 'nullable|string',
            'items.*.size_name_snapshot'            => 'nullable|string',
            'items.*.quantity'                      => 'required|integer|min:1',
            'items.*.note'                          => 'nullable|string',
            'items.*.toppings'                      => 'nullable|array',
            'items.*.toppings.*.topping_id'         => 'required|string',
            'items.*.toppings.*.topping_name_snapshot' => 'nullable|string',
            'items.*.toppings.*.quantity'           => 'required|integer|min:1',
        ]);

        // Bàn phải thuộc quán này
        if (!$cafe->tables()->where('_id', $validated['table_id'])->exists()) {
            return response()->json(['message' => 'Bàn không hợp lệ hoặc không thuộc quán của bạn.'], 422);
        }

        // Chống tạo order trùng: nếu bàn đã có order active thì không tạo mới,
        // trả về order hiện tại để client tiếp tục cập nhật vào đó.
        $existing = $cafe->orders()
            ->where('table_id', $validated['table_id'])
            ->where('status', 'active')
            ->first();
        if ($existing) {
            $existing->load(['orderDetails.orderDetailToppings.topping', 'table']);
            return response()->json($existing, 200);
        }

        $order = $this->atomic(function () use ($cafe, $validated) {
            $todayStr = now()->format('Ymd');
            // B7: count()+1 có thể trùng khi 2 request chạy song song — dò tiếp
            // tới số chưa dùng trước khi chốt mã.
            $orderCount = $cafe->orders()->where('code', 'like', "ORD-{$todayStr}-%")->count() + 1;
            do {
                $orderCode = 'ORD-' . $todayStr . '-' . str_pad($orderCount++, 4, '0', STR_PAD_LEFT);
            } while ($cafe->orders()->where('code', $orderCode)->exists());

            $order = $cafe->orders()->create([
                'table_id'     => $validated['table_id'],
                'code'         => $orderCode,
                'status'       => 'active',
                'note'         => $validated['note'] ?? '',
                'subtotal'     => 0,
                'total_amount' => 0,
            ]);

            $orderSubtotal = 0;

            foreach ($validated['items'] as $itemData) {
                [$detail, $itemTotalPrice] = $this->createOrderDetail($cafe, $order, $itemData);
                $orderSubtotal += $itemTotalPrice;
            }

            $order->update([
                'subtotal'     => $orderSubtotal,
                'total_amount' => $orderSubtotal,
            ]);

            $cafe->tables()->where('_id', $order->table_id)->update([
                'status'           => 'serving',
                'current_order_id' => $order->id,
            ]);

            return $order;
        });

        $order->load(['orderDetails.orderDetailToppings.topping', 'table']);
        return response()->json($order, 201);
    }

    /**
     * BUG-02 + BUG-08 FIX: update() cũng tự tính giá từ DB khi items được gửi lên.
     */
    public function update(Request $request, Cafe $cafe, Order $order)
    {
        $this->authorizeCafe($cafe);

        if ((string) $order->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        // Không cho sửa order đã thanh toán
        if ($order->status === 'paid') {
            return response()->json(['message' => 'Order đã thanh toán, không thể chỉnh sửa.'], 400);
        }

        $validated = $request->validate([
            'table_id'                              => 'sometimes|string',
            'note'                                  => 'nullable|string',
            'discount_amount'                       => 'nullable|numeric|min:0',
            'items'                                 => 'sometimes|array',
            'items.*.item_id'                       => 'required_with:items|string',
            'items.*.item_name_snapshot'            => 'required_with:items|string',
            'items.*.item_price_id'                 => 'nullable|string',
            'items.*.size_name_snapshot'            => 'nullable|string',
            'items.*.quantity'                      => 'required_with:items|integer|min:1',
            'items.*.note'                          => 'nullable|string',
            'items.*.toppings'                      => 'nullable|array',
            'items.*.toppings.*.topping_id'         => 'required_with:items.*.toppings|string',
            'items.*.toppings.*.topping_name_snapshot' => 'nullable|string',
            'items.*.toppings.*.quantity'           => 'required_with:items.*.toppings|integer|min:1',
        ]);

        $oldTableId = $order->table_id;

        $this->atomic(function () use ($request, $cafe, $order, $validated, $oldTableId) {
            $updateData = [];
            if ($request->has('table_id'))       $updateData['table_id']       = $validated['table_id'];
            if ($request->has('note'))           $updateData['note']           = $validated['note'] ?? '';
            if ($request->has('discount_amount')) $updateData['discount_amount'] = $validated['discount_amount'] ?? 0;

            if ($request->has('items')) {
                $order->orderDetails()->each(function ($detail) {
                    $detail->orderDetailToppings()->delete();
                });
                $order->orderDetails()->delete();

                $orderSubtotal = 0;
                foreach ($validated['items'] as $itemData) {
                    [$detail, $itemTotalPrice] = $this->createOrderDetail($cafe, $order, $itemData);
                    $orderSubtotal += $itemTotalPrice;
                }

                $discount = (float) ($updateData['discount_amount'] ?? $order->discount_amount ?? 0);
                // Chặn giảm giá vượt tạm tính → tổng không âm
                $discount = min($discount, (float) $orderSubtotal);

                $updateData['subtotal']     = $orderSubtotal;
                $updateData['total_amount'] = max(0.0, (float) $orderSubtotal - $discount);
                $updateData['discount_amount'] = $discount;
            }

            $order->update($updateData);

            if ($request->has('table_id') && $oldTableId !== $validated['table_id']) {
                $cafe->tables()->where('_id', $oldTableId)->update(['status' => 'empty', 'current_order_id' => null]);
                $cafe->tables()->where('_id', $validated['table_id'])->update(['status' => 'serving', 'current_order_id' => $order->id]);
            }
        });

        $order->load(['orderDetails.orderDetailToppings.topping', 'table']);
        return response()->json($order);
    }

    public function pay(Request $request, Cafe $cafe, Order $order)
    {
        $this->authorizeCafe($cafe);

        if ((string) $order->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        // Chỉ order ĐANG PHỤC VỤ mới thanh toán được. Trước đây chỉ chặn mỗi 'paid'
        // nên order đã HỦY vẫn thanh toán được, sinh hóa đơn và chạy thẳng vào
        // doanh thu — tiền ảo. Dùng danh sách trắng để trạng thái mới thêm sau này
        // cũng bị chặn mặc định.
        if ($order->status !== 'active') {
            $reason = $order->status === 'paid'
                ? 'Order này đã được thanh toán.'
                : 'Order đã hủy, không thể thanh toán.';
            return response()->json(['message' => $reason], 400);
        }

        $validated = $request->validate([
            'payment_method'  => 'required|string|in:cash,vietqr',
            'discount_amount' => 'nullable|numeric|min:0',
            'cash_received'   => 'nullable|numeric|min:0',
        ]);

        // Chặn giảm giá vượt quá tạm tính → không cho tổng tiền âm
        $discount = min((float) ($validated['discount_amount'] ?? 0), (float) $order->subtotal);
        $total    = max(0.0, (float) $order->subtotal - $discount);

        // Tiền khách đưa + tiền thối (chỉ áp dụng cho tiền mặt) — lưu để đối chứng.
        $cashReceived = null;
        $changeAmount = null;
        if ($validated['payment_method'] === 'cash' && isset($validated['cash_received'])) {
            $cashReceived = (int) round((float) $validated['cash_received']);
            // BUG-FIX (B2): khách đưa thiếu tiền thì không được xác nhận thanh toán
            if ($cashReceived < (int) round($total)) {
                return response()->json([
                    'message' => 'Tiền khách đưa chưa đủ. Cần tối thiểu ' . number_format($total, 0, ',', '.') . 'đ.',
                ], 422);
            }
            $changeAmount = max(0, $cashReceived - (int) round($total));
        }

        $todayStr     = now()->format('Ymd');
        // B7: dò tiếp tới số chưa dùng để tránh trùng mã khi request song song.
        // Mã phiếu (invoice_code) nay lưu thẳng trên order — không còn bảng invoices.
        $invoiceCount = $cafe->orders()
            ->where('invoice_code', 'like', "INV-{$todayStr}-%")
            ->count() + 1;
        do {
            $invoiceCode = 'INV-' . $todayStr . '-' . str_pad($invoiceCount++, 4, '0', STR_PAD_LEFT);
        } while ($cafe->orders()->where('invoice_code', $invoiceCode)->exists());

        $now = now();

        $this->atomic(function () use ($order, $cafe, $invoiceCode, $discount, $total, $validated, $now, $cashReceived, $changeAmount) {
            // Order tự "nhận" toàn bộ thông tin thanh toán (dòng món đã ở order_details).
            $order->update([
                'status'          => 'paid',
                'invoice_code'    => $invoiceCode,
                'payment_method'  => $validated['payment_method'],
                'payment_status'  => 'paid',
                'paid_at'         => $now,
                'discount_amount' => $discount,
                'total_amount'    => $total,
                'cash_received'   => $cashReceived,
                'change_amount'   => $changeAmount,
            ]);

            // Thanh toán xong -> bàn về TRỐNG luôn (bỏ trạng thái 'cleaning').
            $cafe->tables()->where('_id', $order->table_id)->update([
                'status'           => 'empty',
                'current_order_id' => null,
            ]);
        });

        return response()->json($order->load(['table', 'orderDetails.orderDetailToppings.topping']));
    }

    /**
     * Hủy order đang phục vụ: đánh dấu order 'cancelled' và trả bàn về TRỐNG.
     * Không hủy được order đã thanh toán.
     */
    public function cancel(Request $request, Cafe $cafe, Order $order)
    {
        $this->authorizeCafe($cafe);

        if ((string) $order->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if ($order->status === 'paid') {
            return response()->json(['message' => 'Order đã thanh toán, không thể hủy.'], 400);
        }

        $this->atomic(function () use ($order, $cafe) {
            $order->update(['status' => 'cancelled']);

            $cafe->tables()->where('_id', $order->table_id)->update([
                'status'           => 'empty',
                'current_order_id' => null,
            ]);
        });

        return response()->json($order->load(['table']));
    }

    /**
     * C4: Hoàn tiền một order đã thanh toán (khách trả món, thu ngân hoàn lại tiền).
     * Chỉ hoàn được order đang 'paid'; bắt buộc ghi lý do để đối soát.
     * Order 'refunded' bị LOẠI khỏi doanh thu (query thống kê lọc payment_status).
     */
    public function refund(Request $request, Cafe $cafe, Order $order)
    {
        $this->authorizeCafe($cafe);

        if ((string) $order->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if ($order->payment_status === 'refunded') {
            return response()->json(['message' => 'Đơn này đã được hoàn tiền trước đó.'], 400);
        }
        if ($order->payment_status !== 'paid') {
            return response()->json(['message' => 'Chỉ hoàn tiền được đơn đã thanh toán.'], 400);
        }

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $order->update([
            'payment_status' => 'refunded',
            'refunded_at'    => now(),
            'refund_reason'  => $validated['reason'],
        ]);

        return response()->json($order->fresh()->load(['table', 'orderDetails.orderDetailToppings.topping']));
    }

    /**
     * Helper: tạo order_detail và order_detail_toppings, tính giá từ DB.
     * Trả về [$detail, $itemTotalPrice].
     *
     * BUG-FIX (B1): item / size / topping BẮT BUỘC tồn tại và thuộc đúng quán.
     * Trước đây Item::find() không kiểm tra gì — id không tồn tại → giá 0 vẫn
     * tạo được dòng order ("món ma"), hoặc dùng được giá của quán khác.
     */
    private function createOrderDetail(Cafe $cafe, Order $order, array $itemData): array
    {
        $fail = function (string $msg) {
            throw new \Illuminate\Http\Exceptions\HttpResponseException(
                response()->json(['message' => $msg], 422)
            );
        };

        // Món phải tồn tại và thuộc quán này
        $item = Item::find($itemData['item_id']);
        if (!$item || (string) $item->cafe_id !== (string) $cafe->id) {
            $fail('Món không hợp lệ hoặc không thuộc quán của bạn.');
        }

        // Tự lấy giá từ DB
        if (!empty($itemData['item_price_id'])) {
            $itemPrice = ItemPrice::find($itemData['item_price_id']);
            // Size phải tồn tại và thuộc đúng món
            if (!$itemPrice || (string) $itemPrice->item_id !== (string) $item->id) {
                $fail('Size không hợp lệ cho món "' . $item->name . '".');
            }
            $unitPrice = (float) $itemPrice->price;
        } else {
            $unitPrice = (float) $item->base_price;
        }

        $quantity    = (int) $itemData['quantity'];
        $itemSubtotal = $unitPrice * $quantity;

        $toppingTotal = 0.0;
        $toppingRows  = [];

        foreach ($itemData['toppings'] ?? [] as $topData) {
            $topping = Topping::find($topData['topping_id']);
            // Topping phải tồn tại và thuộc quán này
            if (!$topping || (string) $topping->cafe_id !== (string) $cafe->id) {
                $fail('Topping không hợp lệ hoặc không thuộc quán của bạn.');
            }
            $toppingPrice = (float) $topping->price;
            $toppingQty   = (int) $topData['quantity'];
            // Công thức: price_at_time * topping_qty * item_qty
            $toppingSubtotal = $toppingPrice * $toppingQty * $quantity;
            $toppingTotal   += $toppingSubtotal;

            $toppingRows[] = [
                'topping_id'            => $topData['topping_id'],
                // Snapshot tên lấy từ DB — không tin tên client gửi lên (in lên hóa đơn)
                'topping_name_snapshot' => $topping->name,
                'quantity'              => $toppingQty,
                'price_at_time'         => $toppingPrice,
                'subtotal'              => $toppingSubtotal,
            ];
        }

        $itemTotalPrice = $itemSubtotal + $toppingTotal;

        $detail = $order->orderDetails()->create([
            'item_id'            => $itemData['item_id'],
            // Snapshot tên lấy từ DB — không tin tên client gửi lên (in lên hóa đơn)
            'item_name_snapshot' => $item->name,
            'item_price_id'      => $itemData['item_price_id'] ?? null,
            'size_name_snapshot' => $itemData['size_name_snapshot'] ?? null,
            'quantity'           => $quantity,
            'unit_price'         => $unitPrice,
            'subtotal'           => $itemSubtotal,
            'topping_total'      => $toppingTotal,
            'total_price'        => $itemTotalPrice,
            'note'               => $itemData['note'] ?? '',
        ]);

        foreach ($toppingRows as $topRow) {
            $detail->orderDetailToppings()->create($topRow);
        }

        return [$detail, $itemTotalPrice];
    }
}
