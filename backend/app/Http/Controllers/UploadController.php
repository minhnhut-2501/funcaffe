<?php

namespace App\Http\Controllers;

use Cloudinary\Cloudinary;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class UploadController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
        ]);

        $file = $request->file('file');

        // Production: đẩy lên Cloudinary (bền vững qua redeploy). Trả secure_url tuyệt đối.
        if ($cloudinaryUrl = config('services.cloudinary.url')) {
            try {
                $result = (new Cloudinary($cloudinaryUrl))
                    ->uploadApi()
                    ->upload($file->getRealPath(), ['folder' => 'funcafe']);

                return response()->json([
                    'url' => $result['secure_url'],
                    'path' => $result['public_id'],
                ], 201);
            } catch (Throwable $e) {
                // KHÔNG để lỗi này rơi ra thành 500 "Server Error" trơ trọi.
                //
                // Trên Render free không có Shell và APP_DEBUG phải tắt, nên một
                // ngoại lệ không bắt ở đây là hoàn toàn mù: người dùng thấy "Server
                // Error", còn nguyên nhân thật (sai khóa, sai cloud name, Cloudinary
                // từ chối) thì không ai đọc được ở đâu. Bắt rồi kể rõ ra là cách duy
                // nhất để chẩn đoán được từ xa.
                Log::error('Upload len Cloudinary that bai', [
                    'loai' => $e::class,
                    'thong_diep' => $e->getMessage(),
                    'cau_hinh' => $this->tomTatCauHinh($cloudinaryUrl),
                ]);

                return response()->json([
                    'message' => 'Không tải được ảnh lên kho ảnh Cloudinary. ' . $this->goiYKhacPhuc($e),
                    'chi_tiet' => [
                        'loai_loi' => class_basename($e),
                        'ly_do' => $this->cheKhoaBiMat($e->getMessage(), $cloudinaryUrl),
                        'cau_hinh' => $this->tomTatCauHinh($cloudinaryUrl),
                        'thu_doc' => $this->thuQuyenDoc($cloudinaryUrl),
                    ],
                ], 502);
            }
        }

        // Local dev (không cấu hình Cloudinary): lưu vào disk public như cũ.
        $path = $file->store('uploads', 'public');

        return response()->json([
            'url' => Storage::url($path),
            'path' => $path,
        ], 201);
    }

    /**
     * Mô tả CLOUDINARY_URL mà KHÔNG lộ khóa bí mật.
     *
     * Chỉ nêu tên cloud (vốn công khai — nó nằm trong mọi URL ảnh) cùng độ dài của
     * api_key/api_secret. Bấy nhiêu đủ để phân biệt "chưa đặt biến", "đặt sai định
     * dạng" và "đặt đủ nhưng Cloudinary từ chối" — ba nguyên nhân cần cách chữa khác
     * hẳn nhau — mà không biến thông báo lỗi thành chỗ rò rỉ khóa.
     */
    private function tomTatCauHinh(string $url): array
    {
        $phan = parse_url($url);

        if ($phan === false || ($phan['scheme'] ?? null) !== 'cloudinary') {
            return [
                'dinh_dang' => 'SAI — phải là cloudinary://<api_key>:<api_secret>@<cloud_name>',
                'do_dai_bien' => strlen($url),
            ];
        }

        return [
            'dinh_dang' => 'đúng dạng cloudinary://',
            'cloud_name' => $phan['host'] ?? '(trống)',
            'do_dai_api_key' => strlen($phan['user'] ?? ''),
            'do_dai_api_secret' => strlen($phan['pass'] ?? ''),
        ];
    }

    /**
     * Khi TẢI LÊN bị từ chối: thử hai việc CHỈ ĐỌC bằng đúng cặp khóa đó.
     *
     * Vì sao cần. Cloudinary trả về "missing permissions (actions=[create])" cho cùng
     * một cặp khóa mà bảng điều khiển hiện là Active và không giới hạn quyền. Nhìn từ
     * ngoài thì hai khả năng khác hẳn nhau trông y như nhau:
     *
     *   - khóa vô hiệu hoàn toàn (sai, đã xóa, thuộc nơi khác) — cả đọc lẫn ghi đều hỏng;
     *   - khóa còn sống nhưng RIÊNG quyền ghi bị chặn ở cấp tài khoản — đọc vẫn chạy.
     *
     * Hai nguyên nhân đó chữa bằng hai cách khác nhau, nên đoán sai là mất một buổi
     * đi sai đường. `ping` phân biệt được chúng. `usage` đi thêm một bước: nó trả về
     * tên gói và mức đã dùng, đủ để xác nhận hay bác bỏ giả thuyết "vượt hạn mức miễn
     * phí nên bị khóa thao tác ghi" — thứ không nhìn thấy được từ phía máy chủ.
     *
     * Chỉ chạy trên nhánh đã hỏng, nên không thêm lượt gọi nào cho đường bình thường.
     */
    private function thuQuyenDoc(string $cloudinaryUrl): array
    {
        $ket = [];

        try {
            $api = (new Cloudinary($cloudinaryUrl))->adminApi();
            $api->ping();
            $ket['doc_duoc'] = true;
            $ket['ket_luan'] = 'Khóa CÒN SỐNG và đọc được — chỉ quyền GHI bị chặn. '
                . 'Xem hạn mức và cấu hình chặn ghi ở cấp tài khoản, không phải ở khóa.';
        } catch (Throwable $e) {
            $ket['doc_duoc'] = false;
            $ket['loi_khi_doc'] = class_basename($e) . ': ' . $this->cheKhoaBiMat($e->getMessage(), $cloudinaryUrl);
            $ket['ket_luan'] = 'Khóa KHÔNG làm được gì, kể cả đọc — cặp api_key/api_secret '
                . 'trên máy chủ không khớp khóa nào đang hoạt động. Tạo khóa mới rồi đặt lại CLOUDINARY_URL.';

            return $ket;
        }

        // Đọc được thì hỏi luôn hạn mức — trả lời thẳng cho câu "có phải vượt gói free không".
        try {
            $dung = (new Cloudinary($cloudinaryUrl))->adminApi()->usage();
            // CHỈ lấy vài trường tóm tắt. `usage()` trả về một khối lớn, đổ hết ra
            // phản hồi HTTP là thừa và khó đọc.
            $ket['goi'] = $dung['plan'] ?? '(không rõ)';
            $ket['credit_da_dung'] = $dung['credits']['usage'] ?? null;
            $ket['credit_gioi_han'] = $dung['credits']['limit'] ?? null;
            $ket['phan_tram_da_dung'] = $dung['credits']['used_percent'] ?? null;
        } catch (Throwable $e) {
            $ket['loi_khi_doc_han_muc'] = class_basename($e) . ': ' . $this->cheKhoaBiMat($e->getMessage(), $cloudinaryUrl);
        }

        return $ket;
    }

    /**
     * Gợi ý việc cần làm, suy từ thông điệp lỗi.
     *
     * Thứ tự các nhánh có ý nghĩa. "Class ... not found" là lỗi THIẾU THƯ VIỆN chứ
     * không phải sai cấu hình, mà nó cũng chứa chữ "not found" như lỗi sai cloud_name
     * — nên phải xét trước, nếu không sẽ chỉ người ta đi sửa nhầm chỗ.
     */
    private function goiYKhacPhuc(Throwable $e): string
    {
        $tin = strtolower($e->getMessage());

        return match (true) {
            $e instanceof \Error && str_contains($tin, 'not found') && str_contains($tin, 'cloudinary')
                => 'Máy chủ chưa cài thư viện cloudinary/cloudinary_php — cần dựng lại (rebuild) backend.',
            str_contains($tin, 'signature') || str_contains($tin, 'api_secret')
                => 'Chữ ký không hợp lệ — api_secret trong CLOUDINARY_URL sai.',
            str_contains($tin, 'api_key') || str_contains($tin, 'unauthorized') || str_contains($tin, '401')
                => 'Cloudinary từ chối xác thực — kiểm tra api_key trong CLOUDINARY_URL.',
            str_contains($tin, 'cloud_name') || str_contains($tin, '404')
                => 'Sai cloud_name — phần sau dấu @ trong CLOUDINARY_URL.',
            str_contains($tin, 'curl') || str_contains($tin, 'ssl') || str_contains($tin, 'timed out')
                => 'Không kết nối được tới Cloudinary từ máy chủ.',
            default
                => 'Xem mục chi_tiet bên dưới và log của máy chủ.',
        };
    }

    /**
     * Xóa mọi mảnh khóa bí mật khỏi thông điệp trước khi trả về cho trình duyệt.
     * Một số ngoại lệ cấu hình nhét nguyên chuỗi CLOUDINARY_URL vào thông điệp.
     */
    private function cheKhoaBiMat(string $tin, string $url): string
    {
        $phan = parse_url($url);
        foreach ([$phan['pass'] ?? '', $phan['user'] ?? '', $url] as $bimat) {
            if ($bimat !== '') {
                $tin = str_replace($bimat, '***', $tin);
            }
        }

        // Chặn cả dạng cloudinary://... còn sót do viết hoa/thường khác nhau.
        return (string) preg_replace('#cloudinary://[^\s"\']+#i', 'cloudinary://***', $tin);
    }
}
