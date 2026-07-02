<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\Order;
use App\Models\Item;
use App\Models\ItemPrice;
use App\Models\Topping;
use App\Models\Invoice;
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
        $orders = $cafe->orders()->with(['orderDetails.orderDetailToppings.topping', 'invoice', 'table'])->get();
        return response()->json($orders);
    }

    public function show(Cafe $cafe, Order $order)
    {
        $this->authorizeCafe($cafe);

        if ((string) $order->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $order->load(['orderDetails.orderDetailToppings.topping', 'invoice', 'table']);
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
            $orderCount = $cafe->orders()->where('code', 'like', "ORD-{$todayStr}-%")->count() + 1;
            $orderCode = 'ORD-' . $todayStr . '-' . str_pad($orderCount, 4, '0', STR_PAD_LEFT);

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
                [$detail, $itemTotalPrice] = $this->createOrderDetail($order, $itemData);
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
                    [$detail, $itemTotalPrice] = $this->createOrderDetail($order, $itemData);
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

        // BUG-FIX: Chặn thanh toán lại order đã 'paid' để tránh tạo hóa đơn trùng
        if ($order->status === 'paid') {
            return response()->json(['message' => 'Order này đã được thanh toán.'], 400);
        }

        $validated = $request->validate([
            'payment_method'  => 'required|string|in:cash,bank_transfer,qr_code,e_wallet,vietqr',
            'discount_amount' => 'nullable|numeric|min:0',
        ]);

        // Chặn giảm giá vượt quá tạm tính → không cho tổng tiền âm
        $discount = min((float) ($validated['discount_amount'] ?? 0), (float) $order->subtotal);
        $total    = max(0.0, (float) $order->subtotal - $discount);

        $todayStr     = now()->format('Ymd');
        $invoiceCount = Invoice::where('cafe_id', (string) $cafe->id)
            ->where('invoice_code', 'like', "INV-{$todayStr}-%")
            ->count() + 1;
        $invoiceCode = 'INV-' . $todayStr . '-' . str_pad($invoiceCount, 4, '0', STR_PAD_LEFT);

        $order->load(['table', 'orderDetails.orderDetailToppings']);

        $invoiceItems = $order->orderDetails->map(function ($detail) {
            $toppings = $detail->orderDetailToppings->map(function ($t) {
                return [
                    'topping_name' => $t->topping_name_snapshot,
                    'quantity'     => $t->quantity,
                    'price'        => $t->price_at_time,
                    'subtotal'     => $t->subtotal,
                ];
            });

            return [
                'item_name'     => $detail->item_name_snapshot,
                'size_name'     => $detail->size_name_snapshot,
                'quantity'      => $detail->quantity,
                'unit_price'    => $detail->unit_price,
                'item_subtotal' => $detail->subtotal,
                'toppings'      => $toppings,
                'topping_total' => $toppings->sum('subtotal'),
                'total_price'   => $detail->subtotal + $toppings->sum('subtotal'),
                'note'          => $detail->note,
            ];
        })->toArray();

        $now = now();

        $this->atomic(function () use ($order, $cafe, $invoiceCode, $invoiceItems, $discount, $total, $validated, $now) {
            $order->invoice()->create([
                'invoice_code'    => $invoiceCode,
                'cafe_id'         => $cafe->id,
                'table_id'        => $order->table_id,
                'items'           => $invoiceItems,
                'cafe_snapshot'   => [
                    'name'    => $cafe->name,
                    'address' => $cafe->address ?? '',
                    'phone'   => $cafe->phone   ?? '',
                ],
                'table_snapshot'  => [
                    'name' => $order->table->name ?? '',
                ],
                'subtotal'        => $order->subtotal,
                'discount_amount' => $discount,
                'total_amount'    => $total,
                'payment_method'  => $validated['payment_method'],
                'payment_status'  => 'paid',
                'paid_at'         => $now,
            ]);

            $order->update([
                'status'          => 'paid',
                'paid_at'         => $now,
                'discount_amount' => $discount,
                'total_amount'    => $total,
            ]);

            $cafe->tables()->where('_id', $order->table_id)->update([
                'status'           => 'cleaning',
                'current_order_id' => null,
            ]);
        });

        return response()->json($order->load('invoice'));
    }

    /**
     * Helper: tạo order_detail và order_detail_toppings, tính giá từ DB.
     * Trả về [$detail, $itemTotalPrice].
     */
    private function createOrderDetail(Order $order, array $itemData): array
    {
        // Tự lấy giá từ DB
        if (!empty($itemData['item_price_id'])) {
            $itemPrice = ItemPrice::find($itemData['item_price_id']);
            $unitPrice = $itemPrice ? (float) $itemPrice->price : 0.0;
        } else {
            $item      = Item::find($itemData['item_id']);
            $unitPrice = $item ? (float) $item->base_price : 0.0;
        }

        $quantity    = (int) $itemData['quantity'];
        $itemSubtotal = $unitPrice * $quantity;

        $toppingTotal = 0.0;
        $toppingRows  = [];

        foreach ($itemData['toppings'] ?? [] as $topData) {
            $topping      = Topping::find($topData['topping_id']);
            $toppingPrice = $topping ? (float) $topping->price : 0.0;
            $toppingQty   = (int) $topData['quantity'];
            // Công thức: price_at_time * topping_qty * item_qty
            $toppingSubtotal = $toppingPrice * $toppingQty * $quantity;
            $toppingTotal   += $toppingSubtotal;

            $toppingRows[] = [
                'topping_id'            => $topData['topping_id'],
                'topping_name_snapshot' => $topData['topping_name_snapshot'] ?? ($topping ? $topping->name : ''),
                'quantity'              => $toppingQty,
                'price_at_time'         => $toppingPrice,
                'subtotal'              => $toppingSubtotal,
            ];
        }

        $itemTotalPrice = $itemSubtotal + $toppingTotal;

        $detail = $order->orderDetails()->create([
            'item_id'            => $itemData['item_id'],
            'item_name_snapshot' => $itemData['item_name_snapshot'],
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
