<?php

namespace App\Http\Controllers;

use App\Http\Resources\ReportRunResource;
use App\Http\Resources\ReportTemplateResource;
use App\Models\ReportRun;
use App\Models\ReportTemplate;
use App\Services\AdminReportService;
use App\Services\BrandedPdfService;
use App\Services\OperationalBroadcastService;
use App\Support\ApiResponse;
use App\Support\ResourceVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ReportController extends Controller
{
    public function __construct(private readonly AdminReportService $reports) {}

    public function widgets()
    {
        return response()->json($this->reports->widgetDefinitions());
    }

    public function preview(Request $request)
    {
        $payload = $request->validate([
            'widgets' => 'nullable|array',
            'widgets.*' => 'string',
            'filters' => 'nullable|array',
        ]);

        $widgets = $this->reports->preview($payload['widgets'] ?? [], $payload['filters'] ?? []);

        return response()->json([
            'widgets' => $widgets,
            'executive_summary' => $this->reports->executiveSummary($widgets),
        ]);
    }

    public function templates()
    {
        $query = ReportTemplate::query()
            ->when(! request()->boolean('include_archived'), fn ($query) => $query->whereNull('archived_at'))
            ->orderByDesc('updated_at');

        $versionMeta = ResourceVersion::fromQuery($query);
        if (ResourceVersion::matches(request(), $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        if (request()->boolean('paginated') || request()->has('page') || request()->has('per_page')) {
            $perPage = min(max((int) request()->query('per_page', 25), 1), 75);
            $paginator = $query->paginate($perPage);

            return response()->json([
                'data' => ReportTemplateResource::collection(collect($paginator->items()))->resolve(),
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                    ...$versionMeta,
                    'changed' => true,
                ],
            ]);
        }

        return response()->json(ReportTemplateResource::collection($query->limit(200)->get())->resolve());
    }

    public function storeTemplate(Request $request)
    {
        $payload = $this->validateTemplate($request);
        $template = ReportTemplate::create([
            ...$payload,
            'created_by' => Auth::id(),
            'visibility' => $payload['visibility'] ?? 'admin',
        ]);
        app(OperationalBroadcastService::class)
            ->adminChanged('report_templates', 'report_template', $template->id, 'created', 'Report template created.');

        return response()->json((new ReportTemplateResource($template))->resolve(), 201);
    }

    public function updateTemplate(Request $request, ReportTemplate $template)
    {
        $template->update($this->validateTemplate($request));
        app(OperationalBroadcastService::class)
            ->adminChanged('report_templates', 'report_template', $template->id, 'updated', 'Report template updated.');

        return response()->json((new ReportTemplateResource($template->fresh()))->resolve());
    }

    public function destroyTemplate(ReportTemplate $template)
    {
        $template->forceFill(['archived_at' => $template->archived_at ?: now()])->save();
        app(OperationalBroadcastService::class)
            ->adminChanged('report_templates', 'report_template', $template->id, 'archived', 'Report template archived.');

        return ApiResponse::message('Report template archived.');
    }

    public function archiveTemplate(ReportTemplate $template)
    {
        return $this->destroyTemplate($template);
    }

    public function run(Request $request, ReportTemplate $template)
    {
        if ($template->archived_at) {
            return response()->json(['error' => 'Archived report templates cannot be run.'], 422);
        }

        $payload = $request->validate([
            'filters' => 'nullable|array',
        ]);

        $filters = array_filter($payload['filters'] ?? $template->filters_json ?? [], fn ($value) => $value !== null && $value !== '');
        $widgets = collect($template->layout_json ?? [])
            ->map(fn ($item) => is_array($item) ? ($item['id'] ?? null) : $item)
            ->filter()
            ->values()
            ->all();

        $snapshot = $this->reports->preview($widgets, $filters);

        $run = ReportRun::create([
            'report_template_id' => $template->id,
            'created_by' => Auth::id(),
            'status' => 'completed',
            'parameters_json' => ['filters' => $filters, 'widgets' => $widgets],
            'result_snapshot_json' => [
                'executive_summary' => $this->reports->executiveSummary($snapshot),
                'widgets' => $snapshot,
            ],
        ]);
        app(OperationalBroadcastService::class)
            ->adminChanged('reports', 'report_run', $run->id, 'created', 'Report run completed.');

        return response()->json((new ReportRunResource($run))->resolve(), 201);
    }

    public function export(Request $request, ReportRun $run, BrandedPdfService $pdf)
    {
        $format = strtolower((string) $request->query('format', 'csv'));
        if ($format === 'pdf') {
            $filename = 'eloquente-report-'.$run->id.'.pdf';
            $sections = $this->reportSections($run);
            $truncated = count($sections) > $pdf->maxReportLines();

            return response($pdf->report($run->loadMissing('creator'), $sections, $truncated), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            ]);
        }

        $filename = 'eloquente-report-'.$run->id.'.csv';
        $snapshot = $this->normalizedSnapshot($run);
        $widgetNames = collect($this->reports->widgetDefinitions())->pluck('name', 'id');

        return response()->streamDownload(function () use ($snapshot, $widgetNames) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Report Section', 'Item', 'Detail', 'Value']);

            foreach ($snapshot['executive_summary']['takeaways'] ?? [] as $index => $takeaway) {
                fputcsv($handle, ['Executive Summary', 'Takeaway '.($index + 1), $takeaway['headline'] ?? '', $takeaway['recommended_action'] ?? '']);
            }

            foreach ($snapshot['widgets'] as $widget) {
                $title = $widgetNames[$widget['id'] ?? ''] ?? $this->humanLabel($widget['id'] ?? 'Report Section');
                $data = $widget['data'] ?? [];

                if (! empty($data['insight'])) {
                    fputcsv($handle, [$title, 'Interpretation', $data['insight']['headline'] ?? '', $data['insight']['recommended_action'] ?? '']);
                }

                foreach ($this->flattenWidgetRows($data) as $row) {
                    fputcsv($handle, [$title, $row['item'], $row['detail'], $row['value']]);
                }
            }

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private function reportSections(ReportRun $run): array
    {
        $widgetNames = collect($this->reports->widgetDefinitions())->pluck('name', 'id');
        $lines = [];
        $snapshot = $this->normalizedSnapshot($run);

        if (! empty($snapshot['executive_summary'])) {
            $lines[] = 'EXECUTIVE SUMMARY';
            $lines[] = $snapshot['executive_summary']['headline'] ?? 'Report ready for review.';
            foreach ($snapshot['executive_summary']['takeaways'] ?? [] as $takeaway) {
                $lines[] = '- '.($takeaway['headline'] ?? 'Review this takeaway.');
                if (! empty($takeaway['recommended_action'])) {
                    $lines[] = '  Action: '.$takeaway['recommended_action'];
                }
            }
            $lines[] = '';
        }

        foreach ($snapshot['widgets'] as $widget) {
            $title = $widgetNames[$widget['id'] ?? ''] ?? $this->humanLabel($widget['id'] ?? 'Report Section');
            $lines[] = strtoupper($title);
            if (! empty($widget['data']['insight'])) {
                $lines[] = 'Interpretation: '.($widget['data']['insight']['headline'] ?? '');
                $lines[] = 'Recommended action: '.($widget['data']['insight']['recommended_action'] ?? '');
            }
            foreach ($this->flattenWidgetRows($widget['data'] ?? []) as $row) {
                $detail = $row['detail'] ? ' - '.$row['detail'] : '';
                $lines[] = $row['item'].$detail.': '.$row['value'];
            }
        }

        return $lines;
    }

    private function validateTemplate(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
            'visibility' => 'nullable|string|max:40',
            'layout_json' => 'required|array|min:1',
            'filters_json' => 'nullable|array',
        ]);
    }

    private function normalizedSnapshot(ReportRun $run): array
    {
        $snapshot = $run->result_snapshot_json ?? [];

        if (isset($snapshot['widgets']) && is_array($snapshot['widgets'])) {
            return [
                'executive_summary' => $snapshot['executive_summary'] ?? $this->reports->executiveSummary($snapshot['widgets']),
                'widgets' => $snapshot['widgets'],
            ];
        }

        $widgets = is_array($snapshot) ? $snapshot : [];

        return [
            'executive_summary' => $this->reports->executiveSummary($widgets),
            'widgets' => $widgets,
        ];
    }

    private function flattenWidgetRows(array $data): array
    {
        if (isset($data['rows']) && is_array($data['rows'])) {
            return collect($data['rows'])->flatMap(function ($row) {
                if (! is_array($row)) {
                    return [['item' => 'Result', 'detail' => '', 'value' => $this->formatExportValue($row)]];
                }

                $label = $row['label'] ?? $row['name'] ?? $row['client'] ?? $row['date'] ?? 'row';

                return collect($row)
                    ->reject(fn ($value, $key) => in_array($key, ['id', 'label', 'name', 'client'], true) || is_array($value))
                    ->map(fn ($value, $key) => [
                        'item' => $label,
                        'detail' => $this->humanLabel((string) $key),
                        'value' => $this->formatExportValue($value, (string) $key),
                    ])
                    ->values();
            })->values()->all();
        }

        return collect($data)
            ->reject(fn ($value, $key) => is_array($value) || in_array($key, ['action', 'insight'], true))
            ->map(fn ($value, $key) => [
                'item' => $this->humanLabel((string) $key),
                'detail' => '',
                'value' => $this->formatExportValue($value, (string) $key),
            ])
            ->when(isset($data['action']), fn ($rows) => $rows->push([
                'item' => 'Recommended Action',
                'detail' => '',
                'value' => $data['action'],
            ]))
            ->values()
            ->all();
    }

    private function humanLabel(string $key): string
    {
        $label = preg_replace('/(?<!^)[A-Z]/', ' $0', str_replace(['_', '-'], ' ', $key));

        return ucwords(trim((string) $label));
    }

    private function formatExportValue(mixed $value, string $key = ''): string
    {
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_numeric($value)) {
            $lower = strtolower($key);
            if (str_contains($lower, 'revenue') || str_contains($lower, 'amount') || str_contains($lower, 'total') || str_contains($lower, 'value') || str_contains($lower, 'balance')) {
                return 'PHP '.number_format((float) $value, 2);
            }
            if (str_contains($lower, 'rate') || str_contains($lower, 'percent')) {
                return number_format((float) $value, 1).'%';
            }

            return number_format((float) $value, is_float($value + 0) && fmod((float) $value, 1.0) !== 0.0 ? 2 : 0);
        }

        return (string) $value;
    }
}
