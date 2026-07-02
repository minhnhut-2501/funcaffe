<?php

namespace App\Services;

/**
 * Dịch vụ tạo URL thanh toán và xác thực chữ ký VNPay (sandbox).
 * Tài liệu: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 */
class VnpayService
{
    /**
     * Dựng URL chuyển hướng sang cổng VNPay.
     *
     * @param string $txnRef   Mã tham chiếu giao dịch (dùng transaction_code của package_payments)
     * @param int    $amountVnd Số tiền (VND, chưa nhân 100)
     * @param string $orderInfo Mô tả đơn hàng (không dấu)
     * @param string $ipAddr    IP người dùng
     */
    public function buildPaymentUrl(string $txnRef, int $amountVnd, string $orderInfo, string $ipAddr): string
    {
        $cfg = config('services.vnpay');

        $data = [
            'vnp_Version'   => '2.1.0',
            'vnp_Command'   => 'pay',
            'vnp_TmnCode'   => $cfg['tmn_code'],
            'vnp_Amount'    => $amountVnd * 100, // VNPay tính theo đơn vị x100
            'vnp_CurrCode'  => 'VND',
            'vnp_TxnRef'    => $txnRef,
            'vnp_OrderInfo' => $orderInfo,
            'vnp_OrderType' => 'other',
            'vnp_Locale'    => 'vn',
            'vnp_ReturnUrl' => $cfg['return_url'],
            'vnp_IpAddr'    => $ipAddr ?: '127.0.0.1',
            'vnp_CreateDate' => now()->format('YmdHis'),
        ];

        ksort($data);
        $hashData = $this->buildHashData($data);
        $secureHash = hash_hmac('sha512', $hashData, (string) $cfg['hash_secret']);

        return $cfg['url'] . '?' . $this->buildQuery($data) . '&vnp_SecureHash=' . $secureHash;
    }

    /**
     * Xác thực chữ ký trên dữ liệu VNPay trả về (Return URL / IPN).
     */
    public function validateSignature(array $query): bool
    {
        $secret = (string) config('services.vnpay.hash_secret');
        if ($secret === '' || empty($query['vnp_SecureHash'])) {
            return false;
        }

        $received = $query['vnp_SecureHash'];
        $data = $query;
        unset($data['vnp_SecureHash'], $data['vnp_SecureHashType']);

        ksort($data);
        $hashData = $this->buildHashData($data);
        $calculated = hash_hmac('sha512', $hashData, $secret);

        return hash_equals($calculated, (string) $received);
    }

    /** Chuỗi dùng để ký: urlencode value, nối bằng & theo thứ tự key đã sort. */
    private function buildHashData(array $data): string
    {
        $parts = [];
        foreach ($data as $key => $value) {
            $parts[] = urlencode((string) $key) . '=' . urlencode((string) $value);
        }
        return implode('&', $parts);
    }

    /** Query string (giống buildHashData, tách riêng cho rõ nghĩa). */
    private function buildQuery(array $data): string
    {
        return $this->buildHashData($data);
    }
}
