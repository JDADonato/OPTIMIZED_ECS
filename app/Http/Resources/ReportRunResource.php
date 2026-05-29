<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReportRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'report_template_id' => $this->report_template_id,
            'created_by' => $this->created_by,
            'status' => $this->status,
            'parameters_json' => $this->parameters_json ?? [],
            'result_snapshot_json' => $this->result_snapshot_json ?? [],
            'export_path' => $this->export_path,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
