<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\ReportRun;
use App\Support\PaymentLabels;
use Illuminate\Support\Collection;

class BrandedPdfService
{
    public function receipt(Payment $payment, Booking $booking): string
    {
        $method = PaymentLabels::method($payment->payment_method ?? null);
        $paidAt = $payment->paid_at ?? $payment->updated_at ?? $payment->created_at;
        $rows = [
            ['Receipt No.', sprintf('ECS-%d-P%d', $booking->id, $payment->id)],
            ['Booking Reference', sprintf('#%04d', $booking->id)],
            ['Client', $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username ?: 'Client'],
            ['Event', $booking->event_name ?: $booking->event_type ?: 'Booked event'],
            ['Event Date', optional($booking->event_date)->format('M j, Y') . ($booking->event_time ? ' at ' . $booking->event_time : '')],
            ['Payment Type', $this->label($payment->payment_type ?? 'Payment')],
            ['Payment Method', $method['label']],
            ['Amount', $this->money($payment->amount ?? 0)],
            ['Status', $this->label($payment->status ?? 'Pending')],
            ['Reference', $payment->paymongo_reference_number ?: $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id ?: 'Not provided'],
            ['Payment Date', optional($paidAt)->format('M j, Y g:i A') ?: 'Not recorded'],
            ['Remaining Balance', $this->money(max(0, (float) ($booking->total_cost ?? 0) - (float) $booking->payments()->whereIn('status', ['Paid', 'Verified'])->sum('amount')))],
        ];

        return $this->document('Official Receipt', 'Computer-generated receipt. No signature required.', $rows, [
            'Generated for payment verification and client records.',
            'For questions, contact Eloquente Catering through your account or official contact channels.',
        ]);
    }

    public function preparationList(Booking $booking): string
    {
        $booking->loadMissing(['user', 'assignee', 'preparationTasks', 'payments']);
        $menu = collect($booking->selected_menu_array ?? [])
            ->map(fn ($item) => is_array($item) ? ($item['name'] ?? $item['dish_name'] ?? $item['title'] ?? null) : $item)
            ->filter()
            ->implode(', ');

        $snapshot = [
            ['Event', $booking->event_name ?: $booking->event_type ?: 'Booked event'],
            ['Type', $booking->event_type ?: 'Not specified'],
            ['Date and time', trim((optional($booking->event_date)->format('M j, Y') ?: 'Date pending') . ($booking->event_time ? ' at ' . $booking->event_time : ''))],
            ['Guests', number_format((int) ($booking->pax ?? 0))],
            ['Venue', $this->venue($booking)],
            ['Assigned staff', $booking->assignee?->full_name ?: $booking->assignee?->username ?: 'Unassigned'],
        ];

        $client = [
            ['Client', $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username ?: 'Client'],
            ['Email', $booking->client_email ?: $booking->user?->email ?: 'Not provided'],
            ['Phone', $booking->client_phone ?: $booking->user?->phone ?: 'Not provided'],
        ];

        $serviceNotes = [
            ['Package/Menu', $menu ?: 'Menu details pending or not recorded'],
            ['Motif', $booking->color_motif ?: 'Not specified'],
            ['Special instructions', $booking->special_instructions ?: 'None recorded'],
        ];

        $taskGroups = $booking->preparationTasks
            ->groupBy(fn ($task) => $this->responsibleArea($task->department))
            ->sortKeysUsing(fn ($a, $b) => array_search($a, ['Marketing', 'Accounting', 'Service prep'], true) <=> array_search($b, ['Marketing', 'Accounting', 'Service prep'], true));

        return $this->preparationChecklistPdf(
            $booking,
            $snapshot,
            $client,
            $serviceNotes,
            $this->readinessSummary($booking, $menu),
            $taskGroups
        );
    }

    private function preparationChecklistPdf(Booking $booking, array $snapshot, array $client, array $serviceNotes, array $readiness, Collection $taskGroups): string
    {
        $pages = [];
        $commands = [];
        $y = 0;
        $margin = 42;
        $width = 528;

        $newPage = function () use (&$pages, &$commands, &$y) {
            if ($commands) {
                $pages[] = $commands;
            }

            $commands = [];
            $y = 742;
        };

        $ensureSpace = function (float $height) use (&$y, $newPage) {
            if ($y - $height < 56) {
                $newPage();
            }
        };

        $rect = function (float $x, float $y, float $w, float $h, array $fill = null, array $stroke = null) use (&$commands) {
            $cmd = ['q'];
            if ($fill) {
                $cmd[] = sprintf('%.3F %.3F %.3F rg', $fill[0], $fill[1], $fill[2]);
            }
            if ($stroke) {
                $cmd[] = sprintf('%.3F %.3F %.3F RG', $stroke[0], $stroke[1], $stroke[2]);
            }
            $cmd[] = sprintf('%.2F %.2F %.2F %.2F re %s', $x, $y, $w, $h, $fill ? ($stroke ? 'B' : 'f') : 'S');
            $cmd[] = 'Q';
            $commands[] = implode("\n", $cmd);
        };

        $text = function (string $value, float $x, float $y, int $size = 10, bool $bold = false, array $color = [0.05, 0.07, 0.12]) use (&$commands) {
            $commands[] = sprintf(
                "BT /%s %d Tf %.3F %.3F %.3F rg %.2F %.2F Td (%s) Tj ET",
                $bold ? 'F2' : 'F1',
                $size,
                $color[0],
                $color[1],
                $color[2],
                $x,
                $y,
                $this->escape($value)
            );
        };

        $wrappedText = function (string $value, float $x, float $top, float $maxWidth, int $size = 10, bool $bold = false, array $color = [0.05, 0.07, 0.12], float $lineHeight = 12) use ($text) {
            $lines = $this->wrapForWidth($value, $maxWidth, $size);
            $lineY = $top;
            foreach ($lines as $line) {
                $text($line, $x, $lineY, $size, $bold, $color);
                $lineY -= $lineHeight;
            }

            return count($lines) * $lineHeight;
        };

        $sectionTitle = function (string $title) use (&$y, $margin, $width, $text, $rect, $ensureSpace) {
            $ensureSpace(34);
            $text(strtoupper($title), $margin, $y, 9, true, [0.63, 0.38, 0.04]);
            $rect($margin, $y - 10, $width, 0.5, null, [0.90, 0.84, 0.78]);
            $y -= 28;
        };

        $infoGrid = function (array $items, int $columns = 2) use (&$y, $margin, $width, $rect, $text, $wrappedText, $ensureSpace) {
            $gap = 10;
            $cardWidth = ($width - ($gap * ($columns - 1))) / $columns;

            foreach (array_chunk($items, $columns) as $row) {
                $heights = collect($row)->map(fn ($item) => max(48, 26 + (count($this->wrapForWidth((string) ($item[1] ?? ''), $cardWidth - 24, 10)) * 12)))->all();
                $height = max($heights);
                $ensureSpace($height + 12);

                foreach ($row as $index => $item) {
                    $x = $margin + (($cardWidth + $gap) * $index);
                    $rect($x, $y - $height, $cardWidth, $height, [0.99, 0.98, 0.95], [0.92, 0.84, 0.80]);
                    $text(strtoupper((string) ($item[0] ?? 'Detail')), $x + 12, $y - 18, 8, true, [0.57, 0.64, 0.72]);
                    $wrappedText((string) ($item[1] ?? 'Not provided'), $x + 12, $y - 35, $cardWidth - 24, 10, true);
                }

                $y -= $height + 10;
            }
        };

        $newPage();
        $rect(0, 0, 612, 792, [1, 0.99, 0.97]);
        $rect(0, 758, 612, 34, [0.45, 0.00, 0.00]);
        $text('ELOQUENTE CATERING', $margin, 770, 11, true, [1, 1, 1]);
        $text('INTERNAL EVENT PREPARATION', 380, 770, 8, true, [1, 0.91, 0.66]);
        $text('Event Preparation Checklist', $margin, 724, 20, true);
        $text(sprintf('Booking #%04d', $booking->id), $margin, 706, 11, true, [0.45, 0.00, 0.00]);
        $text('Generated ' . now()->format('M j, Y g:i A'), 390, 706, 9, false, [0.38, 0.45, 0.55]);
        $y = 672;

        $sectionTitle('Event snapshot');
        $infoGrid($snapshot, 2);

        $sectionTitle('Client contact');
        $infoGrid($client, 3);

        $sectionTitle('Menu and service notes');
        $infoGrid($serviceNotes, 1);

        $sectionTitle('Readiness summary');
        $columns = 3;
        $gap = 8;
        $pillWidth = ($width - ($gap * ($columns - 1))) / $columns;
        foreach (array_chunk($readiness, $columns) as $row) {
            $ensureSpace(42);
            foreach ($row as $index => $item) {
                $x = $margin + (($pillWidth + $gap) * $index);
                $ready = $item['ready'];
                $rect($x, $y - 34, $pillWidth, 34, $ready ? [0.91, 0.98, 0.94] : [1.00, 0.97, 0.87], $ready ? [0.65, 0.91, 0.76] : [0.98, 0.82, 0.37]);
                $text($ready ? 'READY' : 'NEEDS CHECK', $x + 10, $y - 14, 7, true, $ready ? [0.05, 0.46, 0.25] : [0.63, 0.32, 0.00]);
                $text($item['label'], $x + 10, $y - 27, 9, true);
            }
            $y -= 42;
        }

        $sectionTitle('Handoff checklist');
        if ($taskGroups->isEmpty()) {
            $ensureSpace(38);
            $rect($margin, $y - 34, $width, 34, [1, 1, 1], [0.92, 0.84, 0.80]);
            $text('No handoff tasks recorded yet.', $margin + 12, $y - 21, 10, true, [0.38, 0.45, 0.55]);
            $y -= 44;
        } else {
            foreach ($taskGroups as $area => $tasks) {
                $ensureSpace(34);
                $text(strtoupper((string) $area), $margin, $y, 9, true, [0.45, 0.00, 0.00]);
                $text($area === 'Service prep' ? 'Admin override available if blocked' : '', $margin + 350, $y, 8, true, [0.63, 0.38, 0.04]);
                $y -= 12;

                foreach ($tasks as $task) {
                    $label = (string) ($task->label ?? $task->title ?? 'Handoff task');
                    $status = (string) ($task->status ?? 'Pending');
                    $due = $task->due_at ? 'Due ' . optional($task->due_at)->format('M j, Y') : 'No due date';
                    $lines = $this->wrapForWidth($label, 300, 10);
                    $rowHeight = max(34, 20 + (count($lines) * 12));
                    $ensureSpace($rowHeight + 6);

                    $rect($margin, $y - $rowHeight, $width, $rowHeight, [1, 1, 1], [0.92, 0.84, 0.80]);
                    $text($status === 'Done' ? '[x]' : '[ ]', $margin + 10, $y - 20, 10, true, $status === 'Done' ? [0.05, 0.46, 0.25] : [0.45, 0.00, 0.00]);
                    $wrappedText($label, $margin + 38, $y - 16, 300, 10, true);
                    $text($status, $margin + 370, $y - 20, 9, true, $status === 'Done' ? [0.05, 0.46, 0.25] : [0.63, 0.32, 0.00]);
                    $text($due, $margin + 440, $y - 20, 8, false, [0.38, 0.45, 0.55]);
                    $y -= $rowHeight + 6;
                }

                $y -= 4;
            }
        }

        $text('Prepared for staff coordination. Verify details with the customer before final service execution.', $margin, 38, 8, false, [0.38, 0.45, 0.55]);

        if ($commands) {
            $pages[] = $commands;
        }

        return $this->renderCommandPdf($pages);
    }

    public function report(ReportRun $run, array $sections): string
    {
        $rows = [
            ['Report Number', '#' . $run->id],
            ['Generated', now()->format('M j, Y g:i A')],
            ['Created By', $run->creator?->full_name ?: $run->creator?->username ?: 'Admin'],
        ];

        return $this->document('Management Report', 'Prepared for Eloquente staff review.', $rows, $sections);
    }

    public function calendar(string $title, Collection $events): string
    {
        $rows = $events->map(fn ($event) => [
            optional($event->event_date)->format('M j, Y') . ($event->event_time ? ' ' . $event->event_time : ''),
            ($event->event_name ?: $event->event_type ?: 'Booked event') . ' | ' . ($event->client_full_name ?: 'Client') . ' | ' . $this->label($event->status),
        ])->all();

        return $this->document($title, 'Event calendar export.', $rows ?: [['Events', 'No events found for the selected range.']], []);
    }

    private function document(string $title, string $subtitle, array $rows, array $notes): string
    {
        $lines = [
            'ELOQUENTE CATERING',
            $title,
            $subtitle,
            'Generated: ' . now()->format('M j, Y g:i A'),
            str_repeat('-', 72),
        ];

        foreach ($rows as $row) {
            $lines[] = str_pad((string) ($row[0] ?? ''), 22) . ' ' . (string) ($row[1] ?? '');
        }

        if ($notes) {
            $lines[] = str_repeat('-', 72);
            foreach ($notes as $note) {
                $lines[] = (string) $note;
            }
        }

        return $this->simplePdf($lines);
    }

    private function simplePdf(array $lines): string
    {
        $pages = array_chunk($this->wrap($lines), 40);
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>'];
        $pageRefs = [];
        $fontObjectId = (count($pages) * 2) + 3;

        foreach ($pages as $index => $pageLines) {
            $pageId = 3 + ($index * 2);
            $contentId = $pageId + 1;
            $pageRefs[] = "{$pageId} 0 R";
            $objects[] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {$fontObjectId} 0 R >> >> /Contents {$contentId} 0 R >>";

            $streamLines = ['BT', '/F1 11 Tf', '54 742 Td', '15 TL'];
            foreach ($pageLines as $line) {
                $streamLines[] = '(' . $this->escape($line) . ') Tj';
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
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= str_pad((string) $offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
        }

        return $pdf . "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function renderCommandPdf(array $pages): string
    {
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>'];
        $pageRefs = [];
        $fontObjectId = (count($pages) * 2) + 3;
        $boldFontObjectId = $fontObjectId + 1;

        foreach ($pages as $index => $commands) {
            $pageId = 3 + ($index * 2);
            $contentId = $pageId + 1;
            $pageRefs[] = "{$pageId} 0 R";
            $objects[] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {$fontObjectId} 0 R /F2 {$boldFontObjectId} 0 R >> >> /Contents {$contentId} 0 R >>";

            $stream = implode("\n", $commands);
            $objects[] = "<< /Length " . strlen($stream) . " >>\nstream\n{$stream}\nendstream";
        }

        array_splice($objects, 1, 0, ['<< /Type /Pages /Kids [' . implode(' ', $pageRefs) . '] /Count ' . count($pages) . ' >>']);
        $objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        $objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1) . " 0 obj\n{$object}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= str_pad((string) $offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
        }

        return $pdf . "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function wrapForWidth(string $text, float $maxWidth, int $fontSize): array
    {
        $text = trim(preg_replace('/\s+/', ' ', $text));
        if ($text === '') {
            return ['Not provided'];
        }

        $charsPerLine = max(12, (int) floor($maxWidth / max(4.6, $fontSize * 0.52)));
        $lines = [];
        foreach (explode(' ', $text) as $word) {
            $current = end($lines);
            if ($current === false || strlen($current . ' ' . $word) > $charsPerLine) {
                $lines[] = $word;
            } else {
                $lines[array_key_last($lines)] = $current . ' ' . $word;
            }
        }

        return $lines ?: ['Not provided'];
    }

    private function readinessSummary(Booking $booking, string $menu): array
    {
        $payments = $booking->payments;
        $paymentReady = $payments->isNotEmpty() && $payments->every(fn ($payment) => in_array($payment->status, ['Paid', 'Verified', 'Refunded'], true));

        return [
            ['label' => 'Payment', 'ready' => $paymentReady],
            ['label' => 'Menu', 'ready' => $menu !== ''],
            ['label' => 'Venue', 'ready' => $this->venue($booking) !== 'Venue not provided'],
            ['label' => 'Headcount', 'ready' => (int) ($booking->pax ?? 0) > 0],
            ['label' => 'Tasting', 'ready' => !$booking->food_tasting_id || filled($booking->food_tasting_id)],
            ['label' => 'Customer messages', 'ready' => true],
        ];
    }

    private function wrap(array $lines): array
    {
        return collect($lines)->flatMap(function ($line) {
            $line = trim(preg_replace('/\s+/', ' ', (string) $line));
            return $line === '' ? [''] : str_split($line, 88);
        })->all();
    }

    private function escape(string $text): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
    }

    private function money(mixed $value): string
    {
        return 'PHP ' . number_format((float) $value, 2);
    }

    private function label(?string $value): string
    {
        return ucwords(str_replace(['_', '-'], ' ', (string) $value));
    }

    private function responsibleArea(?string $department): string
    {
        return match ($department) {
            'Operations', 'Admin', 'Service prep', null, '' => 'Service prep',
            default => $department,
        };
    }

    private function venue(Booking $booking): string
    {
        return collect([$booking->venue_address_line, $booking->venue_street, $booking->venue_city, $booking->venue_province, $booking->venue_zip_code])
            ->filter()
            ->implode(', ') ?: 'Venue not provided';
    }
}
