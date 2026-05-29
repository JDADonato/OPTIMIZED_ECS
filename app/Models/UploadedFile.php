<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UploadedFile extends Model
{
    protected $fillable = [
        'user_id',
        'disk',
        'path',
        'url',
        'mime_type',
        'size',
        'original_name',
        'purpose',
        'status',
        'attachable_type',
        'attachable_id',
        'attached_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'attached_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function attachable()
    {
        return $this->morphTo();
    }
}
