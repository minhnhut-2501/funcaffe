<?php

namespace App\Http\Controllers;

use App\Models\Package;
use Illuminate\Http\Request;

class PackageController extends Controller
{
    public function index()
    {
        // Đính kèm vat_rate (%) vào từng gói để frontend hiển thị thuế
        // trước khi thanh toán — nguồn chân lý là config funcafe.vat_rate.
        $vatRate = (float) config('funcafe.vat_rate', 10);

        $packages = Package::where('status', 'active')->get()->map(function ($pkg) use ($vatRate) {
            $data = $pkg->toArray();
            $data['vat_rate'] = $pkg->is_trial ? 0 : $vatRate;
            return $data;
        });

        return response()->json($packages);
    }
}
