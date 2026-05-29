<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReportRun extends Model
{
    protected $fillable = [
        'report_template_id',
        'created_by',
        'status',
        'parameters_json',
        'result_snapshot_json',
        'export_path',
    ];

    protected $casts = [
        'parameters_json' => 'array',
        'result_snapshot_json' => 'array',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
