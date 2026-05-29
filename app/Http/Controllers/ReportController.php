<?php

namespace App\Http\Controllers;

use App\Http\Resources\ReportRunResource;
use App\Http\Resources\ReportTemplateResource;
use App\Models\ReportRun;
use App\Models\ReportTemplate;
use App\Services\AdminReportService;
use App\Services\BrandedPdfService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(private readonly AdminReportService $reports)
    {
    }

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
        return response()->json(ReportTemplateResource::collection(ReportTemplate::query()
            ->orderByDesc('updated_at')
            ->get())->resolve());
    }

    public function storeTemplate(Request $request)
    {
        $payload = $this->validateTemplate($request);
        $template = ReportTemplate::create([
            ...$payload,
            'created_by' => Auth::id(),
            'visibility' => $payload['visibility'] ?? 'admin',
        ]);

        return response()->json((new ReportTemplateResource($template))->resolve(), 201);
    }

    public function updateTemplate(Request $request, ReportTemplate $template)
    {
        $template->update($this->validateTemplate($request));

        return response()->json((new ReportTemplateResource($template->fresh()))->resolve());
    }

    public function destroyTemplate(ReportTemplate $template)
    {
        $template->delete();

        return ApiResponse::message('Report template deleted.');
    }

    public function run(Request $request, ReportTemplate $template)
    {
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

        return response()->json((new ReportRunResource($run))->resolve(), 201);
    }

    public function export(Request $request, ReportRun $run, BrandedPdfService $pdf)
    {
        $format = strtolower((string) $request->query('format', 'csv'));
        if ($format === 'pdf') {
            $filename = 'eloquente-report-' . $run->id . '.pdf';
            return response($pdf->report($run->loadMissing('creator'), $this->reportSections($run)), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        }

        $filename = 'eloquente-report-' . $run->id . '.csv';
        $snapshot = $this->normalizedSnapshot($run);
        $widgetNames = collect($this->reports->widgetDefinitions())->pluck('name', 'id');

        return response()->streamDownload(function () use ($snapshot, $widgetNames) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Report Section', 'Item', 'Detail', 'Value']);

            foreach ($snapshot['executive_summary']['takeaways'] ?? [] as $index => $takeaway) {
                fputcsv($handle, ['Executive Summary', 'Takeaway ' . ($index + 1), $takeaway['headline'] ?? '', $takeaway['recommended_action'] ?? '']);
            }

            foreach ($snapshot['widgets'] as $widget) {
                $title = $widgetNames[$widget['id'] ?? ''] ?? $this->humanLabel($widget['id'] ?? 'Report Section');
                $data = $widget['data'] ?? [];

                if (!empty($data['insight'])) {
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

        if (!empty($snapshot['executive_summary'])) {
            $lines[] = 'EXECUTIVE SUMMARY';
            $lines[] = $snapshot['executive_summary']['headline'] ?? 'Report ready for review.';
            foreach ($snapshot['executive_summary']['takeaways'] ?? [] as $takeaway) {
                $lines[] = '- ' . ($takeaway['headline'] ?? 'Review this takeaway.');
                if (!empty($takeaway['recommended_action'])) {
                    $lines[] = '  Action: ' . $takeaway['recommended_action'];
                }
            }
            $lines[] = '';
        }

        foreach ($snapshot['widgets'] as $widget) {
            $title = $widgetNames[$widget['id'] ?? ''] ?? $this->humanLabel($widget['id'] ?? 'Report Section');
            $lines[] = strtoupper($title);
            if (!empty($widget['data']['insight'])) {
                $lines[] = 'Interpretation: ' . ($widget['data']['insight']['headline'] ?? '');
                $lines[] = 'Recommended action: ' . ($widget['data']['insight']['recommended_action'] ?? '');
            }
            foreach ($this->flattenWidgetRows($widget['data'] ?? []) as $row) {
                $detail = $row['detail'] ? ' - ' . $row['detail'] : '';
                $lines[] = $row['item'] . $detail . ': ' . $row['value'];
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
                if (!is_array($row)) {
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

    private function buildPdf(ReportRun $run): string
    {
        $widgetNames = collect($this->reports->widgetDefinitions())->pluck('name', 'id');
        $lines = [
            'Eloquente Catering',
            'Management Report #' . $run->id,
            'Generated: ' . now()->format('M j, Y g:i A'),
            '',
        ];

        foreach ($run->result_snapshot_json ?? [] as $widget) {
            $title = $widgetNames[$widget['id'] ?? ''] ?? $this->humanLabel($widget['id'] ?? 'Report Section');
            $lines[] = strtoupper($title);
            foreach ($this->flattenWidgetRows($widget['data'] ?? []) as $row) {
                $detail = $row['detail'] ? ' - ' . $row['detail'] : '';
                $lines[] = $row['item'] . $detail . ': ' . $row['value'];
            }
            $lines[] = '';
        }

        return $this->simplePdf($lines);
    }

    private function simplePdf(array $lines): string
    {
        $pages = array_chunk($this->wrapPdfLines($lines), 42);
        $objects = [];
        $objects[] = '<< /Type /Catalog /Pages 2 0 R >>';
        $pageRefs = [];
        $fontObjectId = (count($pages) * 2) + 3;

        foreach ($pages as $index => $pageLines) {
            $pageId = 3 + ($index * 2);
            $contentId = $pageId + 1;
            $pageRefs[] = $pageId . ' 0 R';
            $objects[] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {$fontObjectId} 0 R >> >> /Contents {$contentId} 0 R >>";

            $streamLines = ['BT', '/F1 11 Tf', '50 742 Td', '14 TL'];
            foreach ($pageLines as $line) {
                $streamLines[] = '(' . $this->escapePdfText($line) . ') Tj';
                $streamLines[] = 'T*';
            }
            $streamLines[] = 'ET';
            $stream = implode("\n", $streamLines);
            $objects[] = "<< /Length " . strlen($stream) . " >>\nstream\n{$stream}\nendstream";
        }

        array_splice($objects, 1, 0, ['<< /Type /Pages /Kids [' . implode(' ', $pageRefs) . '] /Count ' . count($pages) . ' >>']);
        $objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1) . " 0 obj\n{$object}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= str_pad((string) $offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
        }
        $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";

        return $pdf;
    }

    private function wrapPdfLines(array $lines): array
    {
        return collect($lines)->flatMap(function ($line) {
            $line = trim((string) $line);
            if ($line === '') {
                return [''];
            }
            return str_split($line, 88);
        })->all();
    }

    private function escapePdfText(string $text): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
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
                return 'PHP ' . number_format((float) $value, 2);
            }
            if (str_contains($lower, 'rate') || str_contains($lower, 'percent')) {
                return number_format((float) $value, 1) . '%';
            }
            return number_format((float) $value, is_float($value + 0) && fmod((float) $value, 1.0) !== 0.0 ? 2 : 0);
        }

        return (string) $value;
    }
}
