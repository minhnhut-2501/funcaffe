<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

class PersonalAccessToken extends SanctumPersonalAccessToken
{
    protected $connection = 'sqlite';

    protected $casts = [
        'tokenable_id' => 'string',
        'abilities' => 'json',
    ];
}
