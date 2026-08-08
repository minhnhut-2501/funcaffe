<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Dịch vụ thanh toán MoMo (môi trường thử nghiệm), loại giao dịch captureWallet.
 * Tài liệu: https://developers.momo.vn/v3/docs/payment/api/wallet/onetime
 *
 * KHÁC VNPay ở điểm cốt lõi: VNPay chỉ cần dựng URL đã ký rồi chuyển hướng, còn
 * MoMo bắt buộc gọi API server-to-server để lấy `payUrl`. Nghĩa là bước tạo đơn
 * có một lần đi mạng CÓ THỂ HỎNG, và nơi gọi phải dọn đơn khi hỏng.
 */
class MomoService
{
    /**
     * Giá trị 'verify' cho Guzzle: trỏ tới cacert.pem nếu có (fix cURL error 60
     * khi PHP local thiếu chứng chỉ), ngược lại dùng cert hệ thống (Linux/Render).
     */
    private function verify(): string|bool
    {
        $bundle = (string) config('funcafe.ca_bundle');
        return ($bundle !== '' && is_file($bundle)) ? $bundle : true;
    }

    public function isConfigured(): bool
    {
        $cfg = config('services.momo');
        return !empty($cfg['partner_code']) && !empty($cfg['access_key']) && !empty($cfg['secret_key']);
    }

    /**
     * Tạo đơn trên cổng MoMo, trả về payUrl để frontend chuyển hướng sang.
     *
     * @param string $orderId   Mã đơn — dùng transaction_code của package_payments.
     *                          MoMo yêu cầu DUY NHẤT VĨNH VIỄN theo partner, không
     *                          chỉ duy nhất trong ngày.
     * @param int    $amount    Số tiền VND. MoMo nhận nguyên giá trị, KHÔNG nhân 100 như VNPay.
     * @param string $orderInfo Mô tả đơn.
     *
     * @throws RuntimeException khi chưa cấu hình, mạng hỏng, hoặc MoMo từ chối.
     */
    public function createPayment(string $orderId, int $amount, string $orderInfo): string
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('Chưa cấu hình cổng MoMo trên máy chủ.');
        }

        $cfg = config('services.momo');
        $extraData = '';

        // captureWallet = tra bang vi MoMo (quet ma bang app). payWithATM = tra bang
        // the ATM noi dia ngay tren trinh duyet, khong can app.
        //
        // De o .env de chuyen duoc ma khong phai sua ma nguon: moi truong thu nghiem
        // chi mo vi bang APP TEST rieng cua MoMo (Android/iOS, phai go app that truoc),
        // nen khi khong co thiet bi phu hop thi dat MOMO_REQUEST_TYPE=payWithATM de
        // van chay tron luong that — van ky HMAC-SHA256, van nhan IPN, van kich hoat goi.
        $requestType = (string) ($cfg['request_type'] ?? 'captureWallet');
        // requestId phải khác orderId và duy nhất theo TỪNG LẦN GỌI: nếu lần tạo đầu
        // lỗi mạng, lần thử lại vẫn dùng chung orderId nhưng phải có requestId mới.
        $requestId = $orderId . '-' . now()->format('YmdHis');

        // Thứ tự trường trong chuỗi ký là CỐ ĐỊNH theo tài liệu — viết cứng chứ không
        // ksort như VnpayService. Nó tình cờ trùng thứ tự chữ cái, nhưng phụ thuộc vào
        // sự tình cờ đó thì một lần MoMo đổi tài liệu là hỏng mà không ai biết vì sao.
        $raw = 'accessKey=' . $cfg['access_key']
            . '&amount=' . $amount
            . '&extraData=' . $extraData
            . '&ipnUrl=' . $cfg['ipn_url']
            . '&orderId=' . $orderId
            . '&orderInfo=' . $orderInfo
            . '&partnerCode=' . $cfg['partner_code']
            . '&redirectUrl=' . $cfg['redirect_url']
            . '&requestId=' . $requestId
            . '&requestType=' . $requestType;

        $body = [
            'partnerCode' => $cfg['partner_code'],
            'partnerName' => 'FunCafe',
            'storeId'     => 'FunCafe',
            'requestId'   => $requestId,
            'amount'      => $amount,
            'orderId'     => $orderId,
            'orderInfo'   => $orderInfo,
            'redirectUrl' => $cfg['redirect_url'],
            'ipnUrl'      => $cfg['ipn_url'],
            'lang'        => 'vi',
            'extraData'   => $extraData,
            'requestType' => $requestType,
            'signature'   => hash_hmac('sha256', $raw, (string) $cfg['secret_key']),
        ];

        $response = Http::withOptions(['verify' => $this->verify()])
            ->timeout(30)
            ->acceptJson()
            ->post((string) $cfg['endpoint'], $body);

        if ($response->failed()) {
            throw new RuntimeException("Không gọi được cổng MoMo (HTTP {$response->status()}).");
        }

        $data = $response->json() ?? [];
        // resultCode 0 = thành công. Ký sai thì MoMo trả 41 kèm message giải thích.
        if ((int) ($data['resultCode'] ?? -1) !== 0) {
            $msg = $data['message'] ?? 'Lỗi không xác định';
            throw new RuntimeException("MoMo từ chối đơn ({$data['resultCode']}): {$msg}");
        }

        $payUrl = (string) ($data['payUrl'] ?? '');
        if ($payUrl === '') {
            throw new RuntimeException('MoMo không trả về đường dẫn thanh toán.');
        }

        return $payUrl;
    }

    /**
     * Xác thực chữ ký MoMo gửi kèm khi trả kết quả (Return URL và IPN).
     *
     * Chuỗi ký ở đây KHÁC chuỗi ký lúc tạo đơn — khác cả tập trường lẫn thứ tự.
     * Dùng nhầm chuỗi của createPayment thì mọi callback đều bị coi là giả mạo.
     */
    public function validateSignature(array $data): bool
    {
        $cfg = config('services.momo');
        $secret = (string) ($cfg['secret_key'] ?? '');
        $received = (string) ($data['signature'] ?? '');

        if ($secret === '' || $received === '') {
            return false;
        }

        $raw = 'accessKey=' . $cfg['access_key']
            . '&amount=' . ($data['amount'] ?? '')
            . '&extraData=' . ($data['extraData'] ?? '')
            . '&message=' . ($data['message'] ?? '')
            . '&orderId=' . ($data['orderId'] ?? '')
            . '&orderInfo=' . ($data['orderInfo'] ?? '')
            . '&orderType=' . ($data['orderType'] ?? '')
            . '&partnerCode=' . ($data['partnerCode'] ?? '')
            . '&payType=' . ($data['payType'] ?? '')
            . '&requestId=' . ($data['requestId'] ?? '')
            . '&responseTime=' . ($data['responseTime'] ?? '')
            . '&resultCode=' . ($data['resultCode'] ?? '')
            . '&transId=' . ($data['transId'] ?? '');

        $calculated = hash_hmac('sha256', $raw, $secret);

        // hash_equals: so sánh không phụ thuộc thời gian, tránh rò rỉ chữ ký qua
        // việc đo thời gian phản hồi.
        return hash_equals($calculated, $received);
    }
}
