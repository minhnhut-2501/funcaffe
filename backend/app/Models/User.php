<?php

namespace App\Models;

use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\NewAccessToken;
use MongoDB\Laravel\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    public function createToken(string $name, array $abilities = ['*'], ?\DateTimeInterface $expiresAt = null): NewAccessToken
    {
        $plainTextToken = \Illuminate\Support\Str::random(40);
        $token = $this->tokens()->create([
            'name' => $name,
            'token' => hash('sha256', $plainTextToken),
            'abilities' => json_encode($abilities),
            'expires_at' => $expiresAt,
            'tokenable_id' => (string) $this->getKey(),
        ]);

        return new NewAccessToken($token, $token->getKey() . '|' . $plainTextToken);
    }

    protected $connection = 'mongodb';
    protected $collection = 'users';

    protected $fillable = [
        'full_name',
        'email',
        'password',
        'phone',
        'avatar',
        // 'admin' | 'user' (chủ quán) | 'staff' (nhân viên)
        'role',
        'status',
        // CHỈ nhân viên có trường này: quán mà họ làm việc. Chủ quán và admin không
        // có nó — chủ quán nắm quán theo chiều ngược lại, qua `shops.user_id`.
        //
        // Trường này TÙY CHỌN, và chỗ nào đọc nó cũng phải hiểu "trống = không có
        // quyền gì", chứ không phải "không giới hạn". NoSQL không có NOT NULL để ép
        // "hễ là staff thì phải có shop_id", nên ràng buộc đó nằm ở mã: chỗ DUY NHẤT
        // tạo được nhân viên là StaffController@store, và nó đặt cả hai cùng lúc.
        'shop_id',
        // Gói dùng thử tính theo TÀI KHOẢN (mỗi tài khoản một lần), song song với cờ
        // cùng tên trên quán. Chỉ đặt trên quán là không đủ: số quán một tài khoản
        // được tạo không bị giới hạn, nên cứ tạo quán mới là lại có 7 ngày Pro Max.
        'has_used_free_trial',
        'reset_token',
        'reset_token_expires_at',
    ];

    protected $hidden = [
        'password',
        // SECURITY: token đặt lại mật khẩu là bí mật — ai đọc được là chiếm được
        // tài khoản. Không bao giờ trả về qua API (kể cả cho admin).
        'reset_token',
        'reset_token_expires_at',
    ];

    protected $casts = [
        'reset_token_expires_at' => 'datetime',
    ];

    /** Các quán NGƯỜI NÀY SỞ HỮU (chủ quán). Khác hẳn shop() bên dưới. */
    public function shops()
    {
        return $this->hasMany(Shop::class);
    }

    /** Quán người này LÀM VIỆC TẠI (nhân viên). Chủ quán trả về null. */
    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    /** Có phải nhân viên không. Gom một chỗ để mọi nơi hỏi giống nhau. */
    public function laNhanVien(): bool
    {
        return $this->role === 'staff';
    }

    // Không có quan hệ subscriptions(): gói gắn với QUÁN, đi qua shops.
    // $user->shops->pluck('id') rồi lọc Subscription theo shop_id.
}
