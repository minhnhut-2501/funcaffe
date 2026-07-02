<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\Invoice;
use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    use ChecksCafeOwnership;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        // BUG-07 FIX: Dùng invoice.items snapshot thay vì load order_details
        $invoices = Invoice::where('cafe_id', $cafe->id)->with('order')->get();
        return response()->json($invoices);
    }

    public function show(Cafe $cafe, Invoice $invoice)
    {
        $this->authorizeCafe($cafe);

        if ((string) $invoice->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        // BUG-07 FIX: Dùng invoice.items snapshot thay vì load order_details
        $invoice->load('order');
        return response()->json($invoice);
    }
}
