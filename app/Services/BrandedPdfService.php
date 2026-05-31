<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\ReportRun;
use App\Support\PaymentLabels;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;

class BrandedPdfService
{
    private const MAX_REPORT_LINES = 300;

    public function receipt(Payment $payment, Booking $booking): string
    {
        $booking->loadMissing(['user', 'payments' => fn ($query) => $query->active()]);
        $payment->loadMissing(['booking']);

        $method = PaymentLabels::method($payment->payment_method ?? null);
        $paidAt = $payment->paid_at ?? $payment->updated_at ?? $payment->created_at;

        return $this->render('pdf.receipt', [
            'title' => 'Official Receipt',
            'documentNumber' => sprintf('ECS-%d-P%d', $booking->id, $payment->id),
            'generatedAt' => now(),
            'booking' => $booking,
            'payment' => $payment,
            'paymentMethodLabel' => $method['label'],
            'paidAt' => $paidAt,
            'remainingBalance' => max(
                0,
                (float) ($booking->total_cost ?? 0)
                    - (float) $booking->payments->whereIn('status', ['Paid', 'Verified'])->sum('amount')
            ),
        ]);
    }

    public function preparationList(Booking $booking): string
    {
        $booking->loadMissing([
            'user',
            'assignee',
            'preparationTasks' => fn ($query) => $query->orderBy('department')->orderBy('created_at'),
            'payments' => fn ($query) => $query->active()->orderBy('due_date'),
        ]);

        $menuItems = collect($booking->selected_menu_array ?? [])
            ->map(fn ($item) => is_array($item) ? ($item['name'] ?? $item['dish_name'] ?? $item['title'] ?? null) : $item)
            ->filter()
            ->values();

        $taskGroups = $booking->preparationTasks
            ->groupBy(fn ($task) => $this->responsibleArea($task->department))
            ->sortKeysUsing(fn ($a, $b) => array_search($a, ['Marketing', 'Accounting', 'Service prep'], true) <=> array_search($b, ['Marketing', 'Accounting', 'Service prep'], true));

        return $this->render('pdf.preparation', [
            'title' => 'Event Preparation Checklist',
            'documentNumber' => sprintf('Booking #%04d', $booking->id),
            'generatedAt' => now(),
            'booking' => $booking,
            'menuItems' => $menuItems,
            'venue' => $this->venue($booking),
            'readiness' => $this->readinessSummary($booking, $menuItems->isNotEmpty()),
            'taskGroups' => $taskGroups,
        ]);
    }

    public function report(ReportRun $run, array $sections, bool $truncated = false): string
    {
        $run->loadMissing('creator');

        return $this->render('pdf.report', [
            'title' => 'Management Report',
            'documentNumber' => '#'.$run->id,
            'generatedAt' => now(),
            'run' => $run,
            'sections' => array_slice($sections, 0, self::MAX_REPORT_LINES),
            'truncated' => $truncated || count($sections) > self::MAX_REPORT_LINES,
            'maxLines' => self::MAX_REPORT_LINES,
        ]);
    }

    public function calendar(string $title, Collection $events, array $window = [], bool $truncated = false): string
    {
        return $this->render('pdf.calendar', [
            'title' => $title,
            'documentNumber' => 'Calendar Export',
            'generatedAt' => now(),
            'events' => $events,
            'window' => $window,
            'truncated' => $truncated,
        ], 'landscape');
    }

    public function maxReportLines(): int
    {
        return self::MAX_REPORT_LINES;
    }

    private function render(string $view, array $data, string $orientation = 'portrait'): string
    {
        $pdf = Pdf::setOptions([
            'defaultFont' => 'DejaVu Sans',
            'isRemoteEnabled' => false,
            'isHtml5ParserEnabled' => true,
            'isPhpEnabled' => false,
        ])
            ->loadView($view, [
                ...$data,
                'brandName' => 'Eloquente Catering',
            ])
            ->setPaper('a4', $orientation);

        $pdf->render();

        $canvas = $pdf->getDomPDF()->getCanvas();
        $font = $pdf->getDomPDF()->getFontMetrics()->getFont('DejaVu Sans', 'normal');
        $canvas->page_text(
            $orientation === 'landscape' ? 718 : 474,
            $orientation === 'landscape' ? 560 : 806,
            'Page {PAGE_NUM} of {PAGE_COUNT}',
            $font,
            8,
            [0.38, 0.45, 0.55]
        );

        return $pdf->output();
    }

    public function money(mixed $value): string
    {
        return 'PHP '.number_format((float) $value, 2);
    }

    public function label(?string $value): string
    {
        return ucwords(str_replace(['_', '-'], ' ', (string) $value));
    }

    public function venue(Booking $booking): string
    {
        return collect([
            $booking->venue_address_line,
            $booking->venue_street,
            $booking->venue_city,
            $booking->venue_province,
            $booking->venue_zip_code,
        ])->filter()->implode(', ') ?: 'Venue not provided';
    }

    private function readinessSummary(Booking $booking, bool $hasMenu): array
    {
        $payments = $booking->payments;
        $paymentReady = $payments->isNotEmpty()
            && $payments->every(fn ($payment) => in_array($payment->status, ['Paid', 'Verified', 'Refunded'], true));

        return [
            ['label' => 'Payment', 'ready' => $paymentReady],
            ['label' => 'Menu', 'ready' => $hasMenu],
            ['label' => 'Venue', 'ready' => $this->venue($booking) !== 'Venue not provided'],
            ['label' => 'Headcount', 'ready' => (int) ($booking->pax ?? 0) > 0],
            ['label' => 'Tasting', 'ready' => ! $booking->food_tasting_id || filled($booking->food_tasting_id)],
            ['label' => 'Customer messages', 'ready' => true],
        ];
    }

    private function responsibleArea(?string $department): string
    {
        return match ($department) {
            'Operations', 'Admin', 'Service prep', null, '' => 'Service prep',
            default => $department,
        };
    }
}
