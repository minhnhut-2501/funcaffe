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
        'role',
        'status',
        'has_used_free_trial',
        'reset_token',
        'reset_token_expires_at',
    ];

    protected $hidden = [
        'password',
    ];

    protected $casts = [
        'has_used_free_trial' => 'boolean',
        'reset_token_expires_at' => 'datetime',
    ];

    public function cafes()
    {
        return $this->hasMany(Cafe::class);
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }
}
