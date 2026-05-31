<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminReportService
{
    private array $memo = [];

    public function widgetDefinitions(): array
    {
        return [
            ['id' => 'revenue_summary', 'name' => 'Revenue Summary', 'category' => 'Finance', 'description' => 'Collected, pending, overdue, and collection rate.'],
            ['id' => 'payment_breakdown', 'name' => 'Payment Status Breakdown', 'category' => 'Finance', 'description' => 'Counts and totals by payment status.'],
            ['id' => 'payment_aging', 'name' => 'Payment Aging', 'category' => 'Finance', 'description' => 'Unpaid balances grouped by urgency.'],
            ['id' => 'booking_pipeline', 'name' => 'Booking Pipeline', 'category' => 'Sales', 'description' => 'Bookings by operational status.'],
            ['id' => 'upcoming_workload', 'name' => 'Upcoming Workload', 'category' => 'Operations', 'description' => 'Next confirmed or pending events.'],
            ['id' => 'package_performance', 'name' => 'Package Performance', 'category' => 'Sales', 'description' => 'Package count and value.'],
            ['id' => 'menu_performance', 'name' => 'Menu Item Performance', 'category' => 'Menu', 'description' => 'Top selected dishes.'],
            ['id' => 'customer_growth', 'name' => 'Customer Growth', 'category' => 'Marketing', 'description' => 'New clients by month.'],
            ['id' => 'refunds_cancellations', 'name' => 'Refunds And Cancellations', 'category' => 'Finance', 'description' => 'Cancelled value and refunded payments.'],
            ['id' => 'operational_alerts', 'name' => 'Operational Alerts', 'category' => 'Operations', 'description' => 'A compact queue of issues needing action.'],
        ];
    }

    public function preview(array $widgetIds, array $filters = []): array
    {
        if (empty($widgetIds)) {
            $widgetIds = ['revenue_summary', 'booking_pipeline', 'payment_breakdown', 'upcoming_workload'];
        }

        return collect($widgetIds)
            ->map(fn ($id) => ['id' => $id, 'data' => $this->widgetData($id, $filters)])
            ->values()
            ->all();
    }

    public function executiveSummary(array $widgets): array
    {
        $insights = collect($widgets)
            ->map(fn ($widget) => $widget['data']['insight'] ?? null)
            ->filter()
            ->values();

        $critical = $insights->first(fn ($insight) => in_array($insight['severity'] ?? '', ['critical', 'warning'], true));
        $opportunity = $insights->first(fn ($insight) => ($insight['severity'] ?? '') === 'watch') ?: $insights->first();
        $nextAction = $critical ?: $opportunity;

        return [
            'headline' => $critical['headline'] ?? ($opportunity['headline'] ?? 'Business report is ready for review.'),
            'takeaways' => $insights
                ->take(5)
                ->map(fn ($insight) => [
                    'headline' => $insight['headline'] ?? 'Review this section.',
                    'meaning' => $insight['meaning'] ?? '',
                    'recommended_action' => $insight['recommended_action'] ?? '',
                    'severity' => $insight['severity'] ?? 'good',
                ])
                ->values()
                ->all(),
            'recommended_action' => $nextAction['recommended_action'] ?? 'Review the selected report blocks and follow up on any active queues.',
        ];
    }

    public function widgetData(string $id, array $filters = []): array
    {
        return $this->cachedPart('report-widget.'.$id, $filters, 120, function () use ($id, $filters) {
            $data = match ($id) {
                'revenue_summary' => $this->revenueSummary($filters),
                'payment_breakdown' => $this->paymentBreakdown($filters),
                'payment_aging' => ['rows' => $this->paymentAging($filters), 'action' => 'Oldest unpaid balances should be followed up first.'],
                'booking_pipeline' => $this->bookingPipeline($filters),
                'upcoming_workload' => $this->upcomingWorkload($filters),
                'package_performance' => $this->packagePerformance($filters),
                'menu_performance' => $this->menuPerformance($filters),
                'customer_growth' => $this->customerGrowth($filters),
                'refunds_cancellations' => $this->refundsAndCancellations($filters),
                'operational_alerts' => ['rows' => $this->operationalAlerts($filters), 'action' => 'Resolve warning items before daily operations start.'],
                default => ['message' => 'Unknown widget.'],
            };

            return [
                ...$data,
                'insight' => $data['insight'] ?? $this->insightForWidget($id, $data),
            ];
        });
    }

    public function analytics(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('full', $filters, 60, function () use ($filters) {
            $summary = $this->memo('revenueSummary', $filters, fn () => $this->revenueSummary($filters));
            $trend = $this->memo('settledRevenueTrend', $filters, fn () => $this->settledRevenueTrend($filters));
            $paymentBreakdown = $this->memo('paymentBreakdown', $filters, fn () => $this->paymentBreakdown($filters));
            $paymentAging = $this->memo('paymentAging', $filters, fn () => $this->paymentAging($filters));
            $bookingPipeline = $this->memo('bookingPipeline', $filters, fn () => $this->bookingPipeline($filters));
            $upcomingWorkload = $this->memo('upcomingWorkload', $filters, fn () => $this->upcomingWorkload($filters));
            $packagePerformance = $this->memo('packagePerformance', $filters, fn () => $this->packagePerformance($filters));
            $menuPerformance = $this->memo('menuPerformance', $filters, fn () => $this->menuPerformance($filters));
            $customerGrowth = $this->memo('customerGrowth', $filters, fn () => $this->customerGrowth($filters));
            $operationsLoad = $this->memo('operationsLoad', $filters, fn () => $this->operationsLoad($filters));
            $peakSeasonCrossTab = $this->memo('peakSeasonCrossTab', $filters, fn () => $this->peakSeasonCrossTab($filters));
            $operationalAlerts = $this->memo('operationalAlerts', $filters, fn () => $this->operationalAlerts($filters));
            $salesFrequency = $this->memo('salesFrequencyDistribution', $filters, fn () => $this->salesFrequencyDistribution($filters));
            $revenueForecast = $this->memo('revenueForecast', $filters, fn () => $this->revenueForecast($filters));
            $paxDemandProjection = $this->memo('paxDemandProjection', $filters, fn () => $this->paxDemandProjection($filters));

            return [
                'summary' => $this->summary($filters, $summary),
                'businessSnapshot' => $this->memo('businessSnapshot', $filters, fn () => $this->businessSnapshot($filters)),
                'revenueTrends' => $trend,
                'revenueHealth' => [
                    'settledRevenueOverTime' => $trend,
                    'paymentStatusBreakdown' => $paymentBreakdown['rows'],
                    'paymentAging' => $paymentAging,
                ],
                'paymentAging' => $paymentAging,
                'bookingPipeline' => $bookingPipeline['rows'],
                'upcomingWorkload' => $upcomingWorkload['rows'],
                'packagePerformance' => $packagePerformance['rows'],
                'menuPerformance' => $menuPerformance['rows'],
                'customerExperience' => [
                    'customerGrowth' => $customerGrowth['rows'],
                    'feedbackSignals' => $this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters))['feedbackSignals'],
                ],
                'conversionFunnel' => $this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters)),
                'operationsLoad' => $operationsLoad,
                'peakSeasonCrossTab' => $peakSeasonCrossTab,
                'alerts' => $operationalAlerts,
                'operationalAlerts' => $operationalAlerts,
                'salesFrequencyDistribution' => $salesFrequency,
                'revenueForecast' => $revenueForecast,
                'revenueRegression' => $revenueForecast,
                'paxDemandProjection' => $paxDemandProjection,
                'demandMovingAverage' => $paxDemandProjection,
                'insights' => $this->analyticsInsights($filters, [
                    'summary' => $summary,
                    'conversion' => $this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters)),
                    'paymentBreakdown' => $paymentBreakdown,
                    'paymentAging' => $paymentAging,
                    'bookingPipeline' => $bookingPipeline,
                    'packagePerformance' => $packagePerformance,
                    'menuPerformance' => $menuPerformance,
                    'operationalAlerts' => $operationalAlerts,
                    'salesFrequency' => $salesFrequency,
                    'peakSeasonCrossTab' => $peakSeasonCrossTab,
                    'revenueForecast' => $revenueForecast,
                    'paxDemandProjection' => $paxDemandProjection,
                ]),
                'projectedPaxDemand' => $paxDemandProjection['rows'],
                'salesFrequency' => $this->legacySalesFrequency($filters),
                'topSellers' => $packagePerformance['rows'],
                'peakSeasons' => $peakSeasonCrossTab['monthlyTotals'] ?? $operationsLoad,
            ];
        });
    }

    public function analyticsSummary(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('summary', $filters, 60, function () use ($filters) {
            $summary = $this->memo('revenueSummary', $filters, fn () => $this->revenueSummary($filters));

            return [
                'summary' => $this->summary($filters, $summary),
                'businessSnapshot' => $this->memo('businessSnapshot', $filters, fn () => $this->businessSnapshot($filters)),
                'conversionFunnel' => $this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters)),
                'salesFrequencyDistribution' => $this->memo('salesFrequencyDistribution', $filters, fn () => $this->salesFrequencyDistribution($filters)),
                'revenueRegression' => $this->memo('revenueForecast', $filters, fn () => $this->revenueForecast($filters)),
                'demandMovingAverage' => $this->memo('paxDemandProjection', $filters, fn () => $this->paxDemandProjection($filters)),
                'alerts' => $this->memo('operationalAlerts', $filters, fn () => $this->operationalAlerts($filters)),
                'insights' => $this->analyticsInsights($filters, [
                    'summary' => $summary,
                    'conversion' => $this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters)),
                    'operationalAlerts' => $this->memo('operationalAlerts', $filters, fn () => $this->operationalAlerts($filters)),
                    'salesFrequency' => $this->memo('salesFrequencyDistribution', $filters, fn () => $this->salesFrequencyDistribution($filters)),
                    'revenueForecast' => $this->memo('revenueForecast', $filters, fn () => $this->revenueForecast($filters)),
                    'paxDemandProjection' => $this->memo('paxDemandProjection', $filters, fn () => $this->paxDemandProjection($filters)),
                ]),
            ];
        });
    }

    public function analyticsRevenue(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('revenue', $filters, 180, function () use ($filters) {
            return [
                'settledRevenueOverTime' => $this->memo('settledRevenueTrend', $filters, fn () => $this->settledRevenueTrend($filters)),
                'paymentStatusBreakdown' => $this->memo('paymentBreakdown', $filters, fn () => $this->paymentBreakdown($filters))['rows'],
                'paymentAging' => $this->memo('paymentAging', $filters, fn () => $this->paymentAging($filters)),
                'insight' => $this->insightForWidget('revenue_summary', $this->memo('revenueSummary', $filters, fn () => $this->revenueSummary($filters))),
            ];
        });
    }

    public function analyticsPipeline(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('pipeline', $filters, 90, function () use ($filters) {
            return [
                'bookingPipeline' => $this->memo('bookingPipeline', $filters, fn () => $this->bookingPipeline($filters))['rows'],
                'upcomingWorkload' => $this->memo('upcomingWorkload', $filters, fn () => $this->upcomingWorkload($filters))['rows'],
                'insight' => $this->insightForWidget('booking_pipeline', $this->memo('bookingPipeline', $filters, fn () => $this->bookingPipeline($filters))),
            ];
        });
    }

    public function analyticsMenuPerformance(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('menu', $filters, 300, function () use ($filters) {
            return [
                'packagePerformance' => $this->memo('packagePerformance', $filters, fn () => $this->packagePerformance($filters))['rows'],
                'menuPerformance' => $this->memo('menuPerformance', $filters, fn () => $this->menuPerformance($filters))['rows'],
                'salesFrequencyDistribution' => $this->memo('salesFrequencyDistribution', $filters, fn () => $this->salesFrequencyDistribution($filters)),
                'insight' => $this->insightForWidget('package_performance', $this->memo('packagePerformance', $filters, fn () => $this->packagePerformance($filters))),
            ];
        });
    }

    public function analyticsCustomerExperience(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('customer', $filters, 300, function () use ($filters) {
            return [
                'customerGrowth' => $this->memo('customerGrowth', $filters, fn () => $this->customerGrowth($filters))['rows'],
                'feedbackSignals' => $this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters))['feedbackSignals'],
                'conversionFunnel' => $this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters)),
                'insight' => $this->insightForConversion($this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters))),
            ];
        });
    }

    public function analyticsOperations(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('operations', $filters, 60, function () use ($filters) {
            $peakSeasonCrossTab = $this->memo('peakSeasonCrossTab', $filters, fn () => $this->peakSeasonCrossTab($filters));
            $salesFrequency = $this->memo('salesFrequencyDistribution', $filters, fn () => $this->salesFrequencyDistribution($filters));
            $revenueForecast = $this->memo('revenueForecast', $filters, fn () => $this->revenueForecast($filters));
            $paxDemandProjection = $this->memo('paxDemandProjection', $filters, fn () => $this->paxDemandProjection($filters));

            return [
                'operationsLoad' => $this->memo('operationsLoad', $filters, fn () => $this->operationsLoad($filters)),
                'peakSeasonCrossTab' => $peakSeasonCrossTab,
                'salesFrequencyDistribution' => $salesFrequency,
                'revenueRegression' => $revenueForecast,
                'demandMovingAverage' => $paxDemandProjection,
                'alerts' => $this->memo('operationalAlerts', $filters, fn () => $this->operationalAlerts($filters)),
                'insight' => $this->insightForWidget('operational_alerts', ['rows' => $this->memo('operationalAlerts', $filters, fn () => $this->operationalAlerts($filters))]),
            ];
        });
    }

    public function analyticsForecasts(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('forecasts', $filters, 180, function () use ($filters) {
            $paxDemandProjection = $this->memo('paxDemandProjection', $filters, fn () => $this->paxDemandProjection($filters));

            return [
                'revenueForecast' => $this->memo('revenueForecast', $filters, fn () => $this->revenueForecast($filters)),
                'revenueRegression' => $this->memo('revenueForecast', $filters, fn () => $this->revenueForecast($filters)),
                'paxDemandProjection' => $paxDemandProjection,
                'demandMovingAverage' => $paxDemandProjection,
                'projectedPaxDemand' => $paxDemandProjection['rows'],
                'insight' => $this->insightForForecasts($this->memo('revenueForecast', $filters, fn () => $this->revenueForecast($filters)), $paxDemandProjection),
            ];
        });
    }

    public function analyticsAdvanced(array $filters = []): array
    {
        $filters = $this->withSnapshotWindow($filters);

        return $this->cachedPart('advanced', $filters, 180, function () use ($filters) {
            $salesFrequency = $this->memo('salesFrequencyDistribution', $filters, fn () => $this->salesFrequencyDistribution($filters));
            $revenueRegression = $this->memo('revenueForecast', $filters, fn () => $this->revenueForecast($filters));
            $demandMovingAverage = $this->memo('paxDemandProjection', $filters, fn () => $this->paxDemandProjection($filters));

            return [
                'salesFrequencyDistribution' => $salesFrequency,
                'revenueRegression' => $revenueRegression,
                'revenueForecast' => $revenueRegression,
                'demandMovingAverage' => $demandMovingAverage,
                'paxDemandProjection' => $demandMovingAverage,
                'peakSeasonCrossTab' => $this->memo('peakSeasonCrossTab', $filters, fn () => $this->peakSeasonCrossTab($filters)),
                'insights' => [
                    'salesFrequency' => $salesFrequency['insight'] ?? null,
                    'revenueRegression' => $revenueRegression['interpretation'] ?? null,
                    'demandMovingAverage' => $demandMovingAverage['interpretation'] ?? null,
                ],
            ];
        });
    }

    private function summary(array $filters, array $summary): array
    {
        $conversion = $this->memo('conversionFunnel', $filters, fn () => $this->conversionFunnel($filters));

        return [
            'settledRevenue' => $summary['settledRevenue'],
            'pendingRevenue' => $summary['pendingRevenue'],
            'overdueRevenue' => $summary['overdueRevenue'],
            'totalRevenue' => $summary['settledRevenue'] + $summary['pendingRevenue'],
            'collectionRate' => $summary['collectionRate'],
            'averageBookingValue' => $this->memo('averageBookingValue', $filters, fn () => $this->averageBookingValue($filters)),
            'pendingBookings' => $this->memo('pendingBookings', $filters, fn () => $this->countBookings($filters, ['Pending'])),
            'activeBookings' => $this->memo('activeBookings', $filters, fn () => $this->countBookings($filters, ['Confirmed'])),
            'completedBookings' => $this->memo('completedBookings', $filters, fn () => $this->countBookings($filters, ['Completed'])),
            'totalPax' => $this->memo('totalPax', $filters, fn () => $this->bookingQuery($filters)->sum('pax') ?: 0),
            'bookingCompletionRate' => $conversion['booking_completion_rate'],
            'paymentCompletionRate' => $conversion['payment_completion_rate'],
            'feedbackSubmissions' => $conversion['feedback_submissions'],
        ];
    }

    private function conversionFunnel(array $filters): array
    {
        $from = isset($filters['date_from']) ? Carbon::parse($filters['date_from'])->startOfDay() : null;
        $to = isset($filters['date_to']) ? Carbon::parse($filters['date_to'])->endOfDay() : null;
        $summary = ConversionEventService::summarize($from, $to);

        if (
            (int) ($summary['booking_starts'] ?? 0) === 0
            && (int) ($summary['booking_submissions'] ?? 0) === 0
            && (int) ($summary['payment_checkout_starts'] ?? 0) === 0
            && (int) ($summary['feedback_submissions'] ?? 0) === 0
        ) {
            $summary = $this->operationalConversionFunnel($filters);
        }

        return [
            ...$summary,
            'feedbackSignals' => [
                [
                    'label' => 'Feedback submitted',
                    'count' => $summary['feedback_submissions'],
                    'action' => 'Review completed event responses.',
                ],
                [
                    'label' => 'Testimonial candidates',
                    'count' => $summary['testimonial_candidates'],
                    'action' => 'Approve strong testimonials for public proof.',
                ],
                [
                    'label' => 'Low-rating follow-ups',
                    'count' => $summary['low_feedback_followups'],
                    'action' => 'Resolve service concerns before they become churn.',
                ],
            ],
        ];
    }

    private function operationalConversionFunnel(array $filters): array
    {
        $bookingIds = $this->bookingQuery($filters)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $bookingSubmissions = count($bookingIds);
        $bookingStarts = $bookingSubmissions;

        $paymentBase = $this->paymentQuery($filters)->whereNotNull('payments.booking_id');
        $paymentStarts = (clone $paymentBase)->distinct()->count('payments.id');
        $paymentConfirmations = (clone $paymentBase)
            ->whereIn('payments.status', ['Paid', 'Verified'])
            ->distinct()
            ->count('payments.id');

        $feedbackSubmissions = 0;
        $testimonialCandidates = 0;
        $lowFeedbackFollowups = 0;

        if (! empty($bookingIds) && Schema::hasTable('feedback_responses')) {
            $feedbackBase = DB::table('feedback_responses')
                ->whereIn('booking_id', $bookingIds);

            $feedbackSubmissions = (clone $feedbackBase)->count();
            $testimonialCandidates = (clone $feedbackBase)
                ->where(function ($query) {
                    $query->whereRaw('testimonial_permission is true')
                        ->orWhere('rating', '>=', 4);
                })
                ->count();
            $lowFeedbackFollowups = (clone $feedbackBase)
                ->where(function ($query) {
                    $query->whereRaw('follow_up_required is true')
                        ->orWhere('rating', '<=', 2);
                })
                ->count();
        }

        return [
            'booking_starts' => $bookingStarts,
            'booking_submissions' => $bookingSubmissions,
            'booking_completion_rate' => $this->percent($bookingSubmissions, $bookingStarts),
            'assisted_booking_submissions' => $this->bookingQuery($filters)->where('booking_source', 'staff_assisted')->count(),
            'clarification_responses' => 0,
            'payment_checkout_starts' => max($paymentStarts, $paymentConfirmations),
            'payment_confirmations' => $paymentConfirmations,
            'payment_completion_rate' => $this->percent($paymentConfirmations, max($paymentStarts, $paymentConfirmations)),
            'feedback_submissions' => $feedbackSubmissions,
            'testimonial_candidates' => $testimonialCandidates,
            'low_feedback_followups' => $lowFeedbackFollowups,
            'raw_counts' => [
                'operational_booking_records' => $bookingSubmissions,
                'operational_payment_records' => $paymentStarts,
                'operational_feedback_records' => $feedbackSubmissions,
            ],
            'source' => 'operational_records',
            'is_fallback' => true,
        ];
    }

    private function analyticsInsights(array $filters, array $parts): array
    {
        $summaryInsight = $this->insightForWidget('revenue_summary', $parts['summary'] ?? []);
        $conversionInsight = $this->insightForConversion($parts['conversion'] ?? []);
        $operationsInsight = $this->insightForWidget('operational_alerts', ['rows' => $parts['operationalAlerts'] ?? []]);
        $forecastInsight = isset($parts['revenueForecast'], $parts['paxDemandProjection'])
            ? $this->insightForForecasts($parts['revenueForecast'], $parts['paxDemandProjection'])
            : null;

        $all = collect([
            'revenue' => $summaryInsight,
            'conversion' => $conversionInsight,
            'operations' => $operationsInsight,
            'forecast' => $forecastInsight,
            'payments' => isset($parts['paymentBreakdown']) ? $this->insightForWidget('payment_breakdown', $parts['paymentBreakdown']) : null,
            'pipeline' => isset($parts['bookingPipeline']) ? $this->insightForWidget('booking_pipeline', $parts['bookingPipeline']) : null,
            'menu' => isset($parts['packagePerformance']) ? $this->insightForWidget('package_performance', $parts['packagePerformance']) : null,
            'salesFrequency' => $parts['salesFrequency']['insight'] ?? null,
            'peakSeason' => $parts['peakSeasonCrossTab']['insight'] ?? null,
        ])->filter();

        $priority = ['critical' => 4, 'warning' => 3, 'watch' => 2, 'good' => 1];

        return [
            'items' => $all->all(),
            'takeaways' => $all
                ->sortByDesc(fn ($insight) => $priority[$insight['severity'] ?? 'good'] ?? 1)
                ->take(3)
                ->values()
                ->all(),
            'generated_at' => now()->toISOString(),
        ];
    }

    private function insightForWidget(string $id, array $data): array
    {
        return match ($id) {
            'revenue_summary' => $this->insight(
                ($data['overdueRevenue'] ?? 0) > 0 ? 'Collection risk needs attention.' : 'Collections look current for this view.',
                ($data['overdueRevenue'] ?? 0) > 0
                    ? 'Some expected revenue is already overdue, so cash collection is the main finance risk.'
                    : 'No overdue revenue is visible in this filter, so the team can focus on upcoming milestones.',
                ($data['overdueRevenue'] ?? 0) > 0 ? 'Open Finance and follow up overdue payment milestones.' : 'Keep monitoring pending balances as event dates approach.',
                ($data['overdueRevenue'] ?? 0) > 0 ? 'warning' : 'good'
            ),
            'payment_breakdown' => $this->paymentBreakdownInsight($data['rows'] ?? []),
            'payment_aging' => $this->paymentAgingInsight($data['rows'] ?? []),
            'booking_pipeline' => $this->bookingPipelineInsight($data['rows'] ?? []),
            'upcoming_workload' => $this->insight(
                empty($data['rows'] ?? []) ? 'No near-term workload is queued.' : 'Upcoming events are ready for daily review.',
                empty($data['rows'] ?? []) ? 'There are no upcoming pending or confirmed events in this report view.' : 'The report contains near-term events that may need logistics and customer follow-up.',
                empty($data['rows'] ?? []) ? 'Use this section as a quiet-period confirmation.' : 'Review upcoming events with missing details first.',
                empty($data['rows'] ?? []) ? 'good' : 'watch'
            ),
            'package_performance' => $this->rankedRowsInsight($data['rows'] ?? [], 'Package demand is concentrated.', 'Use top packages in recommendations and promotions.'),
            'menu_performance' => $this->rankedRowsInsight($data['rows'] ?? [], 'Menu demand has clear leaders.', 'Use top dishes for package defaults and purchasing preparation.'),
            'customer_growth' => $this->rankedRowsInsight($data['rows'] ?? [], 'Customer growth is visible in the selected period.', 'Compare low-growth months with marketing activity.'),
            'refunds_cancellations' => $this->insight(
                (($data['cancelledValue'] ?? 0) + ($data['refundedAmount'] ?? 0)) > 0 ? 'Cancellation and refund exposure exists.' : 'No refund exposure is visible.',
                (($data['cancelledValue'] ?? 0) + ($data['refundedAmount'] ?? 0)) > 0 ? 'Cancelled value and refunds can reduce realized revenue if not reviewed.' : 'This report view has no visible cancellation/refund pressure.',
                (($data['cancelledValue'] ?? 0) + ($data['refundedAmount'] ?? 0)) > 0 ? 'Review cancellation reasons and refund cases.' : 'Keep refund checks in the normal finance review.',
                (($data['cancelledValue'] ?? 0) + ($data['refundedAmount'] ?? 0)) > 0 ? 'watch' : 'good'
            ),
            'operational_alerts' => $this->operationalAlertsInsight($data['rows'] ?? []),
            default => $this->insight('Report block is ready.', 'This section has data for the selected filters.', 'Review the values and compare them with current operations.', 'good'),
        };
    }

    private function insightForConversion(array $conversion): array
    {
        $bookingRate = (float) ($conversion['booking_completion_rate'] ?? 0);
        $paymentRate = (float) ($conversion['payment_completion_rate'] ?? 0);
        $lowFollowUps = (int) ($conversion['low_feedback_followups'] ?? 0);

        if ($lowFollowUps > 0) {
            return $this->insight('Feedback needs follow-up.', 'Some completed events produced low ratings, which can affect trust and referrals.', 'Open Event History and resolve low-rating follow-ups.', 'warning');
        }

        if ($bookingRate > 0 && $bookingRate < 45) {
            return $this->insight('Booking completion is dropping.', 'Many customers start the booking flow but do not reach submission.', 'Review booking steps, validation messages, and abandoned draft recovery.', 'warning');
        }

        if ($paymentRate > 0 && $paymentRate < 60) {
            return $this->insight('Payment completion needs support.', 'Customers may need clearer payment reminders or easier next-payment actions.', 'Open Finance and review reminders for pending balances.', 'watch');
        }

        return $this->insight('Conversion signals are stable.', 'Booking, payment, and feedback signals do not show an urgent conversion risk.', 'Keep monitoring the funnel after each demo/test flow.', 'good');
    }

    private function insightForForecasts(array $revenueForecast, array $paxProjection): array
    {
        if (($revenueForecast['is_insufficient_data'] ?? false) || ($paxProjection['is_insufficient_data'] ?? false)) {
            return $this->insight(
                'Predictive analytics need more historical data.',
                'The named analytics are available, but the current filters do not expose enough real records for both the Simple Linear Regression and Simple Moving Average models.',
                'Broaden the filter window or keep collecting verified payments and completed booking demand before using the forecast for planning.',
                'good'
            );
        }

        $direction = (string) ($revenueForecast['summary']['direction'] ?? 'upward');
        $nextRevenue = (float) ($revenueForecast['summary']['nextForecast'] ?? 0);
        $forecastPax = (int) ($paxProjection['summary']['nextForecast'] ?? $paxProjection['summary']['forecastPax'] ?? 0);

        if ($direction === 'downward') {
            return $this->insight('Simple Linear Regression is trending downward.', 'Revenue is trending downward with an expected trajectory of '.$this->peso($nextRevenue).' in the next forecast period.', 'Check upcoming confirmed bookings and payment schedules before planning expenses.', 'warning');
        }

        if ($forecastPax > 0) {
            return $this->insight('Predictive analytics are usable for preparation.', 'Revenue is trending upward with an expected trajectory of '.$this->peso($nextRevenue).', while SMA demand projects '.number_format($forecastPax).' guests.', 'Share the revenue and demand projections with finance, handoff, and operations planning.', 'watch');
        }

        return $this->insight('Forecast needs more history.', 'There is not enough visible demand to make this projection very useful yet.', 'Use actual booking queues until more history is available.', 'good');
    }

    private function paymentBreakdownInsight(array $rows): array
    {
        $pending = collect($rows)
            ->filter(fn ($row) => ! in_array(strtolower((string) ($row['label'] ?? '')), ['paid', 'verified', 'refunded'], true))
            ->sum('total');

        return $this->insight(
            $pending > 0 ? 'Some payments still need action.' : 'Payment records look settled.',
            $pending > 0 ? 'There are unpaid or unverified payment records in this view.' : 'No pending payment amount is visible in this breakdown.',
            $pending > 0 ? 'Open Finance and prioritize pending, overdue, or unverified payments.' : 'Use this as a settled-payment confirmation.',
            $pending > 0 ? 'watch' : 'good'
        );
    }

    private function paymentAgingInsight(array $rows): array
    {
        $oldest = collect($rows)->firstWhere('label', '15+ days');
        $oldValue = (float) ($oldest['value'] ?? 0);

        return $this->insight(
            $oldValue > 0 ? 'Old unpaid balances need escalation.' : 'No long-aged unpaid balance is visible.',
            $oldValue > 0 ? 'Balances older than 15 days are the highest collection risk in this view.' : 'The oldest unpaid-balance bucket is clear for this report.',
            $oldValue > 0 ? 'Send reminders or review payment terms for oldest unpaid balances.' : 'Continue normal due-date monitoring.',
            $oldValue > 0 ? 'critical' : 'good'
        );
    }

    private function bookingPipelineInsight(array $rows): array
    {
        $pending = collect($rows)->first(fn ($row) => strtolower((string) ($row['label'] ?? '')) === 'pending');
        $pendingCount = (int) ($pending['count'] ?? 0);

        return $this->insight(
            $pendingCount > 0 ? 'Pending bookings are waiting.' : 'No pending booking queue is visible.',
            $pendingCount > 0 ? 'Pending bookings are the clearest conversion opportunity because customers already submitted interest.' : 'The selected pipeline has no visible intake backlog.',
            $pendingCount > 0 ? 'Open Bookings & Intake and resolve pending requests.' : 'Use the pipeline for monitoring rather than urgent action.',
            $pendingCount > 0 ? 'watch' : 'good'
        );
    }

    private function rankedRowsInsight(array $rows, string $headline, string $action): array
    {
        $top = collect($rows)->first();

        return $this->insight(
            $top ? $headline : 'No demand pattern is visible yet.',
            $top ? (($top['label'] ?? $top['name'] ?? 'The top item').' is leading this report view.') : 'The selected filters did not return enough rows for a useful ranking.',
            $top ? $action : 'Broaden the filters or wait for more booking activity.',
            $top ? 'watch' : 'good'
        );
    }

    private function operationalAlertsInsight(array $rows): array
    {
        $urgent = collect($rows)->first(fn ($row) => in_array($row['severity'] ?? '', ['danger', 'warning'], true) && (int) ($row['count'] ?? 0) > 0);

        return $this->insight(
            $urgent ? 'Operations has an active blocker.' : 'No operational blockers are visible.',
            $urgent ? (($urgent['label'] ?? 'An operational alert').' needs attention before it affects customer experience.') : 'The alert queue does not show an active blocker for this view.',
            $urgent ? 'Open the related queue and resolve the blocker first.' : 'Keep this as a daily health check.',
            $urgent ? (($urgent['severity'] ?? '') === 'danger' ? 'critical' : 'warning') : 'good'
        );
    }

    private function insight(string $headline, string $meaning, string $recommendedAction, string $severity = 'good'): array
    {
        return [
            'headline' => $headline,
            'meaning' => $meaning,
            'recommended_action' => $recommendedAction,
            'severity' => in_array($severity, ['good', 'watch', 'warning', 'critical'], true) ? $severity : 'good',
        ];
    }

    private function cachedPart(string $part, array $filters, int $ttlSeconds, callable $callback): array
    {
        $version = Cache::get('admin.analytics.version', 1);
        $key = 'admin.analytics.v6.'.$version.'.'.$part.'.'.$this->filterHash($filters);

        return Cache::remember($key, now()->addSeconds($ttlSeconds), $callback);
    }

    private function memo(string $name, array $filters, callable $callback): mixed
    {
        $key = $name.':'.$this->filterHash($filters);

        if (! array_key_exists($key, $this->memo)) {
            $this->memo[$key] = $callback();
        }

        return $this->memo[$key];
    }

    private function filterHash(array $filters): string
    {
        ksort($filters);

        return md5(json_encode($filters));
    }

    private function businessSnapshot(array $filters): array
    {
        $window = $filters['snapshot_window'] ?? 'all';
        $snapshotFilters = $this->withSnapshotWindow($filters);
        $summary = $this->revenueSummary($snapshotFilters);
        $bookingRow = $this->bookingQuery($snapshotFilters)
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(pax) as pax')
            ->selectRaw('SUM(COALESCE(total_cost, budget, 0)) as value')
            ->first();

        $bookingCount = (int) ($bookingRow->count ?? 0);
        $bookingValue = (float) ($bookingRow->value ?? 0);
        $totalRevenue = $summary['settledRevenue'] + $summary['pendingRevenue'];
        $overdueRatio = $totalRevenue > 0 ? round(($summary['overdueRevenue'] / $totalRevenue) * 100, 1) : 0;

        return [
            'window' => $window,
            'label' => $this->snapshotWindowLabel($window),
            'dateFrom' => $snapshotFilters['date_from'] ?? null,
            'dateTo' => $snapshotFilters['date_to'] ?? null,
            'cards' => [
                [
                    'label' => 'Total revenue',
                    'value' => $totalRevenue,
                    'format' => 'currency',
                    'hint' => 'Collected plus unpaid booked revenue',
                ],
                [
                    'label' => 'Collected revenue',
                    'value' => $summary['settledRevenue'],
                    'format' => 'currency',
                    'hint' => 'Verified and paid payment milestones',
                ],
                [
                    'label' => 'Pending collection',
                    'value' => $summary['pendingRevenue'],
                    'format' => 'currency',
                    'hint' => 'Cash still expected from active bookings',
                ],
                [
                    'label' => 'Overdue balance',
                    'value' => $summary['overdueRevenue'],
                    'format' => 'currency',
                    'hint' => $overdueRatio.'% of total revenue exposure',
                ],
                [
                    'label' => 'Bookings',
                    'value' => $bookingCount,
                    'format' => 'number',
                    'hint' => 'Events inside the selected window',
                ],
                [
                    'label' => 'Total pax',
                    'value' => (int) ($bookingRow->pax ?? 0),
                    'format' => 'number',
                    'hint' => 'Guest demand covered by these bookings',
                ],
                [
                    'label' => 'Average booking value',
                    'value' => $bookingCount > 0 ? round($bookingValue / $bookingCount, 2) : 0,
                    'format' => 'currency',
                    'hint' => 'Revenue value per booking',
                ],
                [
                    'label' => 'Collection rate',
                    'value' => $summary['collectionRate'],
                    'format' => 'percent',
                    'hint' => 'Collected share of total revenue',
                ],
            ],
            'insight' => $summary['overdueRevenue'] > 0
                ? 'Collection risk is present in this window. Prioritize overdue milestones before approving new adjustments.'
                : 'No overdue revenue is visible in this window. Keep monitoring pending milestones as event dates approach.',
        ];
    }

    private function revenueSummary(array $filters): array
    {
        $paymentRows = $this->paymentQuery($filters)
            ->selectRaw("SUM(CASE WHEN payments.status IN ('Paid', 'Verified') THEN payments.amount ELSE 0 END) as settled")
            ->selectRaw("SUM(CASE WHEN payments.status NOT IN ('Paid', 'Verified', 'Refunded') THEN payments.amount ELSE 0 END) as pending")
            ->selectRaw("SUM(CASE WHEN payments.status NOT IN ('Paid', 'Verified', 'Refunded') AND payments.due_date < ? THEN payments.amount ELSE 0 END) as overdue", [today()->toDateString()])
            ->first();

        $settled = (float) ($paymentRows->settled ?? 0);
        $pending = (float) ($paymentRows->pending ?? 0);
        $overdue = (float) ($paymentRows->overdue ?? 0);
        $total = $settled + $pending;

        return [
            'settledRevenue' => $settled,
            'pendingRevenue' => $pending,
            'overdueRevenue' => $overdue,
            'collectionRate' => $total > 0 ? round(($settled / $total) * 100, 1) : 0,
            'action' => $overdue > 0 ? 'Prioritize overdue balances before upcoming events.' : 'Collections are current for the selected filters.',
        ];
    }

    private function paymentBreakdown(array $filters): array
    {
        $rows = $this->paymentQuery($filters)
            ->select('payments.status')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(payments.amount) as total')
            ->groupBy('payments.status')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'label' => $row->status ?: 'Unknown',
                'count' => (int) $row->count,
                'total' => (float) $row->total,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Use this to focus verification and reminder work.'];
    }

    private function bookingPipeline(array $filters): array
    {
        $rows = $this->bookingQuery($filters)
            ->select('status')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(COALESCE(total_cost, budget, 0)) as value')
            ->groupBy('status')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => [
                'label' => $row->status ?: 'Unknown',
                'count' => (int) $row->count,
                'value' => (float) $row->value,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Pending bookings are the main conversion queue.'];
    }

    private function upcomingWorkload(array $filters): array
    {
        $rows = $this->bookingQuery($filters)
            ->whereDate('event_date', '>=', today())
            ->whereIn('status', ['Pending', 'Confirmed'])
            ->orderBy('event_date')
            ->limit(10)
            ->get(['id', 'client_full_name', 'event_date', 'event_type', 'status', 'pax', 'venue_city'])
            ->map(fn ($booking) => [
                'id' => $booking->id,
                'client' => $booking->client_full_name ?: 'Client',
                'date' => optional($booking->event_date)->format('M j, Y'),
                'eventType' => $booking->event_type ?: 'Event',
                'status' => $booking->status,
                'pax' => (int) $booking->pax,
                'city' => $booking->venue_city,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Check near-term pending events and missing logistics first.'];
    }

    private function packagePerformance(array $filters): array
    {
        $packageNames = DB::table('packages')->pluck('name', 'id');
        $rows = $this->bookingQuery($filters)
            ->selectRaw("COALESCE(bookings.package_id, 'Unassigned') as package_key")
            ->selectRaw('COUNT(bookings.id) as count')
            ->selectRaw('SUM(COALESCE(bookings.total_cost, bookings.budget, 0)) as revenue')
            ->groupBy('package_key')
            ->orderByDesc('revenue')
            ->limit(50)
            ->get()
            ->map(function ($row) use ($packageNames) {
                $packageKey = (string) ($row->package_key ?: 'Unassigned');

                return [
                    'label' => $packageNames[$packageKey] ?? ($packageKey === 'Unassigned' ? 'Unassigned' : $packageKey),
                    'count' => (int) $row->count,
                    'revenue' => (float) $row->revenue,
                ];
            })
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Use top packages for recommendations and promo focus.'];
    }

    private function menuPerformance(array $filters): array
    {
        $rows = DB::table('booking_items')
            ->join('menu_items', 'booking_items.menu_item_id', '=', 'menu_items.id')
            ->join('bookings', 'booking_items.booking_id', '=', 'bookings.id')
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('bookings.event_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('bookings.event_date', '<=', $date))
            ->when($filters['event_type'] ?? null, fn ($q, $type) => $q->where('bookings.event_type', $type))
            ->when($filters['booking_status'] ?? null, fn ($q, $status) => $q->where('bookings.status', $status))
            ->when($filters['payment_status'] ?? null, function ($q, $status) {
                $q->whereExists(function ($subquery) use ($status) {
                    $subquery->select(DB::raw(1))
                        ->from('payments')
                        ->whereColumn('payments.booking_id', 'bookings.id')
                        ->where('payments.status', $status);
                });
            })
            ->when($filters['package_id'] ?? null, fn ($q, $id) => $q->where('bookings.package_id', $id))
            ->when($filters['package_category'] ?? null, fn ($q, $category) => $this->applyPackageCategoryFilter($q, 'bookings.package_id', $category))
            ->when($filters['city'] ?? null, fn ($q, $city) => $q->where('bookings.venue_city', 'like', '%'.trim($city).'%'))
            ->when($filters['pax_min'] ?? null, fn ($q, $pax) => $q->where('bookings.pax', '>=', (int) $pax))
            ->when($filters['pax_max'] ?? null, fn ($q, $pax) => $q->where('bookings.pax', '<=', (int) $pax))
            ->select('menu_items.name as label', 'menu_items.category')
            ->selectRaw('COUNT(booking_items.id) as selections')
            ->selectRaw('SUM(bookings.pax) as pax_served')
            ->groupBy('menu_items.name', 'menu_items.category')
            ->orderByDesc('selections')
            ->limit(50)
            ->get()
            ->map(fn ($row) => [
                'label' => $row->label,
                'category' => $row->category,
                'selections' => (int) $row->selections,
                'paxServed' => (int) $row->pax_served,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Top dishes should influence package defaults and purchasing.'];
    }

    private function customerGrowth(array $filters): array
    {
        $monthExpression = $this->monthExpression('created_at');

        $rows = DB::table('users')
            ->where('role', 'Client')
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('created_at', '<=', $date))
            ->selectRaw("$monthExpression as month")
            ->selectRaw('COUNT(*) as count')
            ->groupBy('month')
            ->orderBy('month')
            ->limit(12)
            ->get()
            ->map(fn ($row) => ['label' => $row->month, 'count' => (int) $row->count])
            ->values()
            ->all();

        return ['rows' => $rows, 'action' => 'Growth dips can trigger marketing campaigns.'];
    }

    private function refundsAndCancellations(array $filters): array
    {
        $cancelledValue = $this->bookingQuery($filters)
            ->whereIn('status', ['Cancelled', 'cancelled'])
            ->sum(DB::raw('COALESCE(total_cost, budget, 0)'));

        $refunded = $this->paymentQuery($filters)
            ->where('payments.status', 'Refunded')
            ->sum('payments.amount');

        return [
            'cancelledValue' => (float) $cancelledValue,
            'refundedAmount' => (float) $refunded,
            'action' => 'Review cancellation reasons and refund exposure together.',
        ];
    }

    private function salesFrequencyDistribution(array $filters): array
    {
        $packageCategories = DB::table('packages')
            ->pluck('package_category', 'id')
            ->mapWithKeys(fn ($category, $id) => [(string) $id => (string) $category])
            ->all();

        $bookingRows = $this->paymentQuery($filters)
            ->whereNotNull('payments.booking_id')
            ->whereIn('payments.status', ['Paid', 'Verified'])
            ->select('payments.booking_id', 'bookings.package_id')
            ->selectRaw('SUM(payments.amount) as settled_amount')
            ->groupBy('payments.booking_id', 'bookings.package_id')
            ->get();

        $tiers = collect($this->salesValueTiers())
            ->mapWithKeys(fn ($tier) => [$tier['key'] => [
                ...$tier,
                'count' => 0,
                'revenue' => 0.0,
                'percentage' => 0.0,
            ]])
            ->all();

        foreach ($bookingRows as $row) {
            $tier = $this->salesTierForPackage($row->package_id ?? null, $packageCategories);
            $tiers[$tier['key']]['count']++;
            $tiers[$tier['key']]['revenue'] += (float) ($row->settled_amount ?? 0);
        }

        return $this->salesFrequencyPayload(array_values($tiers), false);
    }

    private function settledRevenueTrend(array $filters): array
    {
        $monthExpression = $this->monthExpression('payments.verified_at');
        $monthCount = min(max((int) ($filters['trend_months'] ?? 6), 1), 24);
        $endMonth = today()->startOfMonth();
        $startMonth = $endMonth->copy()->subMonths($monthCount - 1);

        $rows = $this->paymentQuery($filters)
            ->whereIn('payments.status', ['Paid', 'Verified'])
            ->whereNotNull('payments.verified_at')
            ->where('payments.verified_at', '<=', now())
            ->where('payments.verified_at', '>=', $startMonth->toDateString())
            ->where('payments.verified_at', '<', $endMonth->copy()->addMonth()->toDateString())
            ->selectRaw("$monthExpression as month")
            ->selectRaw('SUM(payments.amount) as revenue')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        return collect(range(0, $monthCount - 1))
            ->map(function ($index) use ($startMonth, $rows) {
                $month = $startMonth->copy()->addMonths($index);
                $key = $month->format('Y-m');

                return [
                    'month' => $key,
                    'label' => $month->format('M Y'),
                    'revenue' => (float) ($rows[$key]->revenue ?? 0),
                ];
            })
            ->values()
            ->all();
    }

    private function revenueForecast(array $filters): array
    {
        $period = $this->normalizePeriod($filters['revenue_forecast_period'] ?? 'monthly');
        $requestedHistoryMonths = min(max((int) ($filters['trend_months'] ?? 12), 6), 24);
        $historyCount = $period === 'quarterly'
            ? max(4, (int) ceil($requestedHistoryMonths / 3))
            : $requestedHistoryMonths;
        $horizon = min(max((int) ($filters['revenue_forecast_horizon'] ?? ($period === 'quarterly' ? 4 : 3)), 1), 12);
        $end = $this->periodStart(today(), $period);
        $start = $this->shiftPeriod($end, -($historyCount - 1), $period);
        $periodExpression = $this->periodExpression('payments.verified_at', $period);

        $rows = $this->paymentQuery($filters)
            ->whereIn('payments.status', ['Paid', 'Verified'])
            ->whereNotNull('payments.verified_at')
            ->where('payments.verified_at', '<=', now())
            ->where('payments.verified_at', '>=', $start->toDateString())
            ->where('payments.verified_at', '<', $this->shiftPeriod($end, 1, $period)->toDateString())
            ->selectRaw("$periodExpression as period_key")
            ->selectRaw('SUM(payments.amount) as revenue')
            ->groupBy('period_key')
            ->orderBy('period_key')
            ->get()
            ->keyBy('period_key');

        $monthly = collect(range(0, $historyCount - 1))
            ->map(function ($index) use ($start, $period, $rows) {
                $date = $this->shiftPeriod($start, $index, $period);
                $key = $this->periodKey($date, $period);

                return [
                    'x' => $index + 1,
                    'period' => $key,
                    'month' => $key,
                    'label' => $this->periodLabel($date, $period),
                    'revenue' => (float) ($rows[$key]->revenue ?? 0),
                ];
            })
            ->values();

        $sampleSize = $monthly->filter(fn ($row) => (float) ($row['revenue'] ?? 0) > 0)->count();

        if ($sampleSize < 2) {
            return $this->insufficientRevenueRegression($monthly->all(), $period, $historyCount, $horizon, $sampleSize);
        }

        $cumulative = 0.0;
        $history = $monthly->map(function ($row) use (&$cumulative) {
            $cumulative += (float) $row['revenue'];

            return [
                ...$row,
                'cumulativeRevenue' => round($cumulative, 2),
                'trendLine' => null,
                'projectedTrend' => null,
                'forecast' => null,
                'isForecast' => false,
            ];
        })->values();

        $regression = $this->ordinaryLeastSquares($history->map(fn ($row) => [
            'x' => (float) $row['x'],
            'y' => (float) $row['cumulativeRevenue'],
        ])->all());

        $history = $history->map(function ($row) use ($regression) {
            $trend = $regression['alpha'] + ($regression['beta'] * (float) $row['x']);

            return [
                ...$row,
                'trendLine' => round(max($trend, 0), 2),
            ];
        })->values();

        $projection = [];
        $previousTrend = (float) ($history->last()['trendLine'] ?? $history->last()['cumulativeRevenue'] ?? 0);

        for ($i = 1; $i <= $horizon; $i++) {
            $x = $historyCount + $i;
            $date = $this->shiftPeriod($end, $i, $period);
            $trend = max($regression['alpha'] + ($regression['beta'] * $x), 0);
            $monthlyForecast = max($trend - $previousTrend, 0);
            $previousTrend = $trend;

            $projection[] = [
                'x' => $x,
                'period' => $this->periodKey($date, $period),
                'month' => $this->periodKey($date, $period),
                'label' => $this->periodLabel($date, $period),
                'revenue' => null,
                'cumulativeRevenue' => null,
                'trendLine' => round($trend, 2),
                'projectedTrend' => round($trend, 2),
                'forecast' => round($monthlyForecast, 2),
                'projectedRevenue' => round($monthlyForecast, 2),
                'isForecast' => true,
            ];
        }

        $lastActual = (float) ($history->last()['cumulativeRevenue'] ?? 0);
        $lastMonthly = (float) ($history->last()['revenue'] ?? 0);
        $nextForecast = (float) ($projection[0]['projectedRevenue'] ?? 0);
        $direction = $regression['beta'] >= 0 ? 'upward' : 'downward';
        $changePercent = $lastMonthly > 0 ? round((($nextForecast - $lastMonthly) / $lastMonthly) * 100, 1) : 0;

        return [
            'method' => 'Simple Linear Regression (OLS)',
            'formula' => 'Y = a + bX',
            'variables' => [
                'Y' => 'Projected cumulative verified revenue.',
                'a' => 'Regression intercept.',
                'b' => 'Regression slope.',
                'X' => 'Sequential time period index.',
            ],
            'period' => $period,
            'horizon' => $horizon,
            'historyWindow' => $historyCount,
            'sampleSize' => $sampleSize,
            'is_insufficient_data' => false,
            'is_fallback' => false,
            'alpha' => round($regression['alpha'], 4),
            'beta' => round($regression['beta'], 4),
            'historical' => $history->all(),
            'projection' => $projection,
            'rows' => $history->concat($projection)->values()->all(),
            'summary' => [
                'nextForecast' => $nextForecast,
                'nextTrend' => (float) ($projection[0]['projectedTrend'] ?? 0),
                'lastActual' => $lastActual,
                'lastMonthlyRevenue' => $lastMonthly,
                'direction' => $direction,
                'changePercent' => $changePercent,
                'method' => 'Simple Linear Regression (OLS)',
                'sampleSize' => $sampleSize,
            ],
            'interpretation' => $this->insight(
                'Simple Linear Regression revenue forecast is ready.',
                'Verified revenue is trending '.$direction.' with an expected trajectory of '.$this->peso($nextForecast).' for the next '.$period.' period.',
                'Consider adjusting operational buffers and purchasing commitments before the next planning cycle.',
                $direction === 'downward' ? 'warning' : 'watch'
            ),
            'insight' => 'Verified revenue is trending '.$direction.' with an expected trajectory of '.$this->peso($nextForecast).' for the next '.$period.' period. Consider adjusting operational buffers.',
        ];
    }

    private function paxDemandProjection(array $filters): array
    {
        $period = $this->normalizePeriod($filters['pax_projection_period'] ?? 'monthly');
        $horizon = min(max((int) ($filters['pax_projection_horizon'] ?? ($period === 'quarterly' ? 4 : 6)), 1), 12);
        $window = min(max((int) ($filters['pax_sma_window'] ?? 3), 2), 6);
        $year = isset($filters['pax_projection_year']) ? (int) $filters['pax_projection_year'] : null;
        $quarter = isset($filters['pax_projection_quarter']) ? (int) $filters['pax_projection_quarter'] : null;
        $historyCount = max($window + 7, $period === 'quarterly' ? 10 : 18);
        $end = $this->periodStart(today(), $period);
        $start = $this->shiftPeriod($end, -($historyCount - 1), $period);
        $periodExpression = $this->periodExpression('event_date', $period);

        $rows = $this->bookingQuery($filters)
            ->whereIn('status', ['Pending', 'Confirmed', 'Completed'])
            ->whereDate('event_date', '<=', today())
            ->whereDate('event_date', '>=', $start->toDateString())
            ->whereDate('event_date', '<', $this->shiftPeriod($end, 1, $period)->toDateString())
            ->when($year, fn ($q) => $q->whereYear('event_date', $year))
            ->when($quarter, fn ($q) => $q->whereRaw($this->quarterWhereExpression('event_date').' = ?', [$quarter]))
            ->selectRaw("$periodExpression as period_key")
            ->selectRaw('SUM(pax) as pax')
            ->selectRaw('COUNT(*) as events')
            ->groupBy('period_key')
            ->orderBy('period_key')
            ->get()
            ->keyBy('period_key');

        $baseStart = $year
            ? ($quarter ? Carbon::create($year, (($quarter - 1) * 3) + 1, 1) : Carbon::create($year, 1, 1))
            : $start;
        $baseCount = $year
            ? ($quarter && $period === 'monthly' ? 3 : ($period === 'quarterly' ? ($quarter ? 1 : 4) : 12))
            : $historyCount;

        $history = collect(range(0, $baseCount - 1))
            ->map(function ($index) use ($baseStart, $period, $rows) {
                $date = $this->shiftPeriod($this->periodStart($baseStart, $period), $index, $period);
                $key = $this->periodKey($date, $period);

                return [
                    'period' => $key,
                    'label' => $this->periodLabel($date, $period),
                    'pax' => (int) ($rows[$key]->pax ?? 0),
                    'events' => (int) ($rows[$key]->events ?? 0),
                    'forecast' => null,
                    'isForecast' => false,
                ];
            })
            ->filter(fn ($row) => ! $year || str_starts_with($row['period'], (string) $year))
            ->values();

        $smaBasis = $this->bookingQuery($filters)
            ->whereIn('status', ['Pending', 'Confirmed', 'Completed'])
            ->whereDate('event_date', '<=', today())
            ->whereDate('event_date', '>=', $start->toDateString())
            ->whereDate('event_date', '<', $this->shiftPeriod($end, 1, $period)->toDateString())
            ->selectRaw("$periodExpression as period_key")
            ->selectRaw('SUM(pax) as pax')
            ->groupBy('period_key')
            ->orderBy('period_key')
            ->get()
            ->keyBy('period_key');

        $seriesValues = collect(range(0, $historyCount - 1))
            ->map(function ($index) use ($start, $period, $smaBasis) {
                $key = $this->periodKey($this->shiftPeriod($start, $index, $period), $period);

                return (float) ($smaBasis[$key]->pax ?? 0);
            })
            ->values()
            ->all();

        $sampleSize = count(array_filter($seriesValues, fn ($value) => (float) $value > 0));

        if ($sampleSize < $window) {
            return $this->insufficientPaxDemandProjection($history->all(), $period, $horizon, $window, $sampleSize);
        }

        $forecastRows = [];
        for ($i = 1; $i <= $horizon; $i++) {
            $forecast = $this->simpleMovingAverage($seriesValues, $window);
            $seriesValues[] = $forecast;
            $date = $this->shiftPeriod($end, $i, $period);
            $forecastRows[] = [
                'period' => $this->periodKey($date, $period),
                'label' => $this->periodLabel($date, $period),
                'pax' => null,
                'events' => null,
                'forecast' => (int) round($forecast),
                'isForecast' => true,
            ];
        }

        $historicalPax = $history->sum('pax');
        $forecastTotal = collect($forecastRows)->sum('forecast');
        $peak = $history->sortByDesc('pax')->first();
        $nextForecast = (int) ($forecastRows[0]['forecast'] ?? 0);

        return [
            'method' => 'Simple Moving Average (SMA)',
            'formula' => 'SMA = (P1 + P2 + ... + Pn) / n',
            'variables' => [
                'SMA' => 'Projected pax demand for the next period.',
                'P' => 'Historical pax demand per period.',
                'n' => 'Configured moving-average window.',
            ],
            'period' => $period,
            'smaWindow' => $window,
            'horizon' => $horizon,
            'historyWindow' => $historyCount,
            'sampleSize' => $sampleSize,
            'is_insufficient_data' => false,
            'is_fallback' => false,
            'rows' => $history->concat($forecastRows)->values()->all(),
            'summary' => [
                'historicalPax' => (int) $historicalPax,
                'forecastPax' => (int) $forecastTotal,
                'nextForecast' => $nextForecast,
                'nextMonthBaseline' => $nextForecast,
                'peakPeriod' => $peak['label'] ?? 'No historical demand',
                'method' => 'Simple Moving Average ('.strtoupper((string) $window).'-period SMA)',
                'sampleSize' => $sampleSize,
            ],
            'interpretation' => $this->insight(
                'Simple Moving Average pax demand projection is ready.',
                'The moving average projects a baseline requirement for '.number_format($nextForecast).' total guests in the next '.$period.' period.',
                'Ensure raw ingredient inventory aligns with this baseline before supplier commitments are finalized.',
                'watch'
            ),
            'insight' => 'The moving average projects a baseline requirement for '.number_format($nextForecast).' total guests in the next '.$period.' period. Ensure raw ingredient inventory aligns with this baseline.',
        ];
    }

    private function paymentAging(array $filters): array
    {
        $payments = $this->paymentQuery($filters)
            ->whereNotIn('payments.status', ['Paid', 'Verified', 'Refunded'])
            ->get(['payments.amount', 'payments.due_date']);

        $buckets = [
            'Not due' => 0,
            '1-7 days' => 0,
            '8-14 days' => 0,
            '15+ days' => 0,
        ];

        foreach ($payments as $payment) {
            $days = $payment->due_date ? Carbon::parse($payment->due_date)->diffInDays(today(), false) : -1;
            $bucket = $days <= 0 ? 'Not due' : ($days <= 7 ? '1-7 days' : ($days <= 14 ? '8-14 days' : '15+ days'));
            $buckets[$bucket] += (float) $payment->amount;
        }

        return collect($buckets)->map(fn ($value, $label) => ['label' => $label, 'value' => $value])->values()->all();
    }

    private function operationsLoad(array $filters): array
    {
        $monthExpression = $this->calendarMonthExpression('event_date');

        return $this->bookingQuery($filters)
            ->whereIn('status', ['Pending', 'Confirmed', 'Completed'])
            ->selectRaw("$monthExpression as month")
            ->selectRaw('COUNT(*) as events')
            ->selectRaw('SUM(pax) as pax')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => [
                'month' => Carbon::createFromFormat('m', str_pad((string) $row->month, 2, '0', STR_PAD_LEFT))->format('M'),
                'monthNumber' => (int) $row->month,
                'events' => (int) $row->events,
                'count' => (int) $row->events,
                'pax' => (int) $row->pax,
            ])
            ->values()
            ->all();
    }

    private function peakSeasonCrossTab(array $filters): array
    {
        $months = collect(range(1, 12))
            ->map(fn ($month) => [
                'key' => str_pad((string) $month, 2, '0', STR_PAD_LEFT),
                'label' => Carbon::create(2024, $month, 1)->format('M'),
                'monthNumber' => $month,
            ])
            ->values()
            ->all();

        $monthExpression = $this->calendarMonthExpression('event_date');
        $query = $this->bookingQuery($filters);

        if (! isset($filters['booking_status'])) {
            $query->whereIn('status', ['Pending', 'Confirmed', 'Completed']);
        }

        $records = $query
            ->selectRaw("COALESCE(NULLIF(event_type, ''), 'Unspecified Event') as event_type_label")
            ->selectRaw("$monthExpression as month_key")
            ->selectRaw('COUNT(*) as events')
            ->selectRaw('SUM(pax) as pax')
            ->groupBy('event_type_label', 'month_key')
            ->orderBy('event_type_label')
            ->orderBy('month_key')
            ->get();

        $maxEvents = max((int) $records->max('events'), 0);
        $monthlyTotals = collect($months)
            ->map(fn ($month) => [
                'month' => $month['label'],
                'monthNumber' => $month['monthNumber'],
                'events' => 0,
                'count' => 0,
                'pax' => 0,
            ])
            ->keyBy('monthNumber')
            ->all();

        $rows = $records
            ->groupBy('event_type_label')
            ->map(function ($group, $label) use ($months, $maxEvents, &$monthlyTotals) {
                $cellsByMonth = $group->keyBy(fn ($row) => (int) $row->month_key);
                $cells = collect($months)
                    ->map(function ($month) use ($cellsByMonth, $maxEvents, &$monthlyTotals) {
                        $monthNumber = (int) $month['monthNumber'];
                        $record = $cellsByMonth->get($monthNumber);
                        $events = (int) ($record->events ?? 0);
                        $pax = (int) ($record->pax ?? 0);

                        if ($events > 0) {
                            $monthlyTotals[$monthNumber]['events'] += $events;
                            $monthlyTotals[$monthNumber]['count'] += $events;
                            $monthlyTotals[$monthNumber]['pax'] += $pax;
                        }

                        return [
                            ...$month,
                            'events' => $events,
                            'count' => $events,
                            'pax' => $pax,
                            'intensity' => $this->heatmapIntensity($events, $maxEvents),
                        ];
                    })
                    ->values()
                    ->all();

                return [
                    'eventType' => (string) $label,
                    'label' => (string) $label,
                    'totalEvents' => (int) collect($cells)->sum('events'),
                    'totalPax' => (int) collect($cells)->sum('pax'),
                    'months' => $cells,
                ];
            })
            ->sortByDesc('totalEvents')
            ->values()
            ->all();

        $monthlyTotals = collect($monthlyTotals)
            ->map(fn ($row) => [
                ...$row,
                'intensity' => $this->heatmapIntensity((int) $row['events'], max((int) collect($monthlyTotals)->max('events'), 0)),
            ])
            ->values()
            ->all();

        $busiestMonth = collect($monthlyTotals)->sortByDesc('events')->first();
        $busiestEventType = collect($rows)->sortByDesc('totalEvents')->first();
        $totalEvents = collect($rows)->sum('totalEvents');
        $totalPax = collect($rows)->sum('totalPax');

        return [
            'method' => 'Cross-tabulation frequency heatmap',
            'formula' => 'Frequency = count of bookings grouped by event type and calendar month',
            'variables' => [
                'rows' => 'Event type or category.',
                'columns' => 'Calendar month from January to December.',
                'cell' => 'Booking frequency and pax demand for the event type during the month.',
            ],
            'months' => $months,
            'rows' => $rows,
            'monthlyTotals' => $monthlyTotals,
            'summary' => [
                'busiestMonth' => $busiestMonth['month'] ?? 'No month',
                'busiestMonthEvents' => (int) ($busiestMonth['events'] ?? 0),
                'busiestEventType' => $busiestEventType['label'] ?? 'No event type',
                'busiestEventTypeEvents' => (int) ($busiestEventType['totalEvents'] ?? 0),
                'totalEvents' => (int) $totalEvents,
                'totalPax' => (int) $totalPax,
                'sampleSize' => (int) $totalEvents,
            ],
            'is_insufficient_data' => $totalEvents === 0,
            'insight' => $this->insight(
                $totalEvents > 0 ? 'Peak season cross-tabulation is ready.' : 'Peak season cross-tabulation needs booking history.',
                $totalEvents > 0
                    ? 'The busiest month is '.($busiestMonth['month'] ?? 'unknown').' and the leading event type is '.($busiestEventType['label'] ?? 'unknown').'.'
                    : 'No pending, confirmed, or completed bookings match the selected filters yet.',
                $totalEvents > 0
                    ? 'Use the high-intensity cells to plan staffing, purchasing, and campaign timing.'
                    : 'Broaden the filters or wait for more booking records before using seasonal heatmap decisions.',
                $totalEvents > 0 ? 'watch' : 'good'
            ),
        ];
    }

    private function heatmapIntensity(int $value, int $max): string
    {
        if ($value <= 0 || $max <= 0) {
            return 'none';
        }

        $ratio = $value / $max;

        return match (true) {
            $ratio >= 0.75 => 'peak',
            $ratio >= 0.5 => 'high',
            $ratio >= 0.25 => 'moderate',
            default => 'low',
        };
    }

    private function operationalAlerts(array $filters): array
    {
        $pendingOld = $this->bookingQuery($filters)->where('status', 'Pending')->where('created_at', '<=', now()->subHours(48))->count();
        $overduePayments = $this->paymentQuery($filters)->whereNotIn('payments.status', ['Paid', 'Verified', 'Refunded'])->where('payments.due_date', '<', today())->count();
        $upcomingMissing = $this->bookingQuery($filters)
            ->whereIn('status', ['Confirmed'])
            ->whereBetween('event_date', [today(), today()->addDays(7)])
            ->where(function ($q) {
                $q->whereNull('venue_address_line')->orWhereNull('event_time');
            })
            ->count();

        return [
            ['label' => 'Pending bookings older than 48 hours', 'count' => $pendingOld, 'severity' => $pendingOld > 0 ? 'warning' : 'ok'],
            ['label' => 'Overdue unpaid payment milestones', 'count' => $overduePayments, 'severity' => $overduePayments > 0 ? 'danger' : 'ok'],
            ['label' => 'Events within 7 days missing logistics', 'count' => $upcomingMissing, 'severity' => $upcomingMissing > 0 ? 'warning' : 'ok'],
        ];
    }

    private function averageBookingValue(array $filters): float
    {
        $row = $this->bookingQuery($filters)
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(COALESCE(total_cost, budget, 0)) as value')
            ->first();

        return (int) ($row->count ?? 0) > 0 ? round(((float) $row->value) / (int) $row->count, 2) : 0;
    }

    private function countBookings(array $filters, array $statuses): int
    {
        return $this->bookingQuery($filters)->whereIn('status', $statuses)->count();
    }

    private function bookingQuery(array $filters)
    {
        return Booking::query()
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('event_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('event_date', '<=', $date))
            ->when($filters['event_type'] ?? null, fn ($q, $type) => $q->where('event_type', $type))
            ->when($filters['booking_status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['payment_status'] ?? null, function ($q, $status) {
                $q->whereExists(function ($subquery) use ($status) {
                    $subquery->select(DB::raw(1))
                        ->from('payments')
                        ->whereColumn('payments.booking_id', 'bookings.id')
                        ->where('payments.status', $status);
                });
            })
            ->when($filters['package_id'] ?? null, fn ($q, $id) => $q->where('package_id', $id))
            ->when($filters['package_category'] ?? null, fn ($q, $category) => $this->applyPackageCategoryFilter($q, 'package_id', $category))
            ->when($filters['city'] ?? null, fn ($q, $city) => $q->where('venue_city', 'like', '%'.trim($city).'%'))
            ->when($filters['pax_min'] ?? null, fn ($q, $pax) => $q->where('pax', '>=', (int) $pax))
            ->when($filters['pax_max'] ?? null, fn ($q, $pax) => $q->where('pax', '<=', (int) $pax));
    }

    private function paymentQuery(array $filters)
    {
        return Payment::query()
            ->active()
            ->leftJoin('bookings', 'payments.booking_id', '=', 'bookings.id')
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('bookings.event_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('bookings.event_date', '<=', $date))
            ->when($filters['event_type'] ?? null, fn ($q, $type) => $q->where('bookings.event_type', $type))
            ->when($filters['booking_status'] ?? null, fn ($q, $status) => $q->where('bookings.status', $status))
            ->when($filters['payment_status'] ?? null, fn ($q, $status) => $q->where('payments.status', $status))
            ->when($filters['package_id'] ?? null, fn ($q, $id) => $q->where('bookings.package_id', $id))
            ->when($filters['package_category'] ?? null, fn ($q, $category) => $this->applyPackageCategoryFilter($q, 'bookings.package_id', $category))
            ->when($filters['city'] ?? null, fn ($q, $city) => $q->where('bookings.venue_city', 'like', '%'.trim($city).'%'))
            ->when($filters['pax_min'] ?? null, fn ($q, $pax) => $q->where('bookings.pax', '>=', (int) $pax))
            ->when($filters['pax_max'] ?? null, fn ($q, $pax) => $q->where('bookings.pax', '<=', (int) $pax));
    }

    private function applyPackageCategoryFilter($query, string $column, ?string $category)
    {
        $category = trim((string) $category);

        if ($category === '' || $category === 'all') {
            return $query;
        }

        if ($category === 'custom') {
            return $query->where(function ($inner) use ($column) {
                $inner->whereNull($column)
                    ->orWhere($column, '')
                    ->orWhereIn($column, ['custom', 'budget-guided']);
            });
        }

        $packageIds = $this->packageIdsForCategory($category);

        return empty($packageIds)
            ? $query->whereRaw('1 = 0')
            : $query->whereIn($column, $packageIds);
    }

    private function packageIdsForCategory(string $category): array
    {
        return DB::table('packages')
            ->where('package_category', $category)
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();
    }

    private function legacySalesFrequency(array $filters): array
    {
        $rows = $this->menuPerformance($filters)['rows'];
        $all = collect($rows)->map(fn ($row) => [
            'name' => $row['label'],
            'category' => $row['category'] ?? 'menu',
            'sales' => $row['selections'] ?? 0,
            'pax_served' => $row['paxServed'] ?? 0,
        ]);

        $grouped = ['All' => $all->values()->all()];
        foreach (['starter', 'main', 'side', 'dessert', 'drink'] as $category) {
            $grouped[$category] = $all->where('category', $category)->values()->all();
        }

        return $grouped;
    }

    private function salesValueTiers(): array
    {
        return [
            ['key' => 'premium', 'label' => 'Wedding & Debut Packages', 'min' => null, 'max' => null],
            ['key' => 'birthday', 'label' => 'Birthday Packages', 'min' => null, 'max' => null],
            ['key' => 'standard', 'label' => 'Standard Event Packages', 'min' => null, 'max' => null],
            ['key' => 'custom', 'label' => 'Custom / Unassigned', 'min' => null, 'max' => null],
        ];
    }

    private function salesTierForPackage(?string $packageId, array $packageCategories): array
    {
        $packageKey = trim((string) $packageId);
        $category = $packageCategories[$packageKey] ?? null;

        if (in_array($packageKey, ['', 'custom', 'budget-guided'], true)) {
            $category = 'custom';
        }

        foreach ($this->salesValueTiers() as $tier) {
            if ($tier['key'] === $category) {
                return $tier;
            }
        }

        return collect($this->salesValueTiers())->firstWhere('key', 'custom') ?? $this->salesValueTiers()[0];
    }

    private function salesFrequencyPayload(array $rows, bool $isFallback): array
    {
        $total = collect($rows)->sum('count');
        $revenue = collect($rows)->sum('revenue');
        $rows = collect($rows)
            ->map(fn ($row) => [
                'key' => $row['key'],
                'label' => $row['label'],
                'min' => $row['min'],
                'max' => $row['max'],
                'count' => (int) $row['count'],
                'frequency' => (int) $row['count'],
                'revenue' => round((float) $row['revenue'], 2),
                'percentage' => $total > 0 ? round(((int) $row['count'] / $total) * 100, 1) : 0,
                'revenueContribution' => $revenue > 0 ? round(((float) $row['revenue'] / $revenue) * 100, 1) : 0,
            ])
            ->sortByDesc('count')
            ->values()
            ->all();

        $top = collect($rows)->first();
        $meaning = $top
            ? $top['label'].' represents '.$top['percentage'].'% of verified package volume in this view.'
            : 'No verified sales volume is available for package-category distribution yet.';

        return [
            'method' => 'Frequency Distribution',
            'formula' => 'Percentage = (category frequency / total frequency) x 100',
            'variables' => [
                'frequency' => 'Number of verified bookings in the package category.',
                'percentage' => 'Share of verified booking frequency represented by the category.',
                'revenueContribution' => 'Share of verified revenue represented by the category.',
            ],
            'rows' => $rows,
            'summary' => [
                'totalFrequency' => (int) $total,
                'totalRevenue' => round((float) $revenue, 2),
                'leader' => $top['label'] ?? 'No package category',
                'leaderPercentage' => (float) ($top['percentage'] ?? 0),
                'sampleSize' => (int) $total,
            ],
            'is_fallback' => $isFallback,
            'insight' => $this->insight(
                $top ? ($top['label'].' leads verified package volume.') : 'Package category distribution needs more data.',
                $meaning,
                $top ? 'Use the leading category for campaign targeting and package recommendation defaults.' : 'Keep the chart visible while more verified payments arrive.',
                $isFallback ? 'warning' : 'watch'
            ),
        ];
    }

    private function ordinaryLeastSquares(array $points): array
    {
        $n = count($points);

        if ($n === 0) {
            return ['alpha' => 0.0, 'beta' => 0.0];
        }

        $sumX = collect($points)->sum('x');
        $sumY = collect($points)->sum('y');
        $sumXY = collect($points)->sum(fn ($point) => $point['x'] * $point['y']);
        $sumX2 = collect($points)->sum(fn ($point) => $point['x'] * $point['x']);
        $denominator = ($n * $sumX2) - ($sumX * $sumX);
        $beta = abs($denominator) > 0.000001
            ? (($n * $sumXY) - ($sumX * $sumY)) / $denominator
            : 0.0;
        $alpha = ($sumY - ($beta * $sumX)) / $n;

        return ['alpha' => (float) $alpha, 'beta' => (float) $beta];
    }

    private function insufficientRevenueRegression(array $historical, string $period, int $historyCount, int $horizon, int $sampleSize): array
    {
        return [
            'method' => 'Simple Linear Regression (OLS)',
            'formula' => 'Y = a + bX',
            'variables' => [
                'Y' => 'Projected cumulative verified revenue.',
                'a' => 'Regression intercept.',
                'b' => 'Regression slope.',
                'X' => 'Sequential time period index.',
            ],
            'period' => $period,
            'horizon' => $horizon,
            'historyWindow' => $historyCount,
            'sampleSize' => $sampleSize,
            'is_insufficient_data' => true,
            'is_fallback' => false,
            'alpha' => null,
            'beta' => null,
            'historical' => $historical,
            'projection' => [],
            'rows' => [],
            'summary' => [
                'nextForecast' => null,
                'nextTrend' => null,
                'lastActual' => 0,
                'lastMonthlyRevenue' => 0,
                'direction' => 'insufficient',
                'changePercent' => 0,
                'method' => 'Simple Linear Regression (OLS)',
                'sampleSize' => $sampleSize,
            ],
            'interpretation' => $this->insight(
                'Simple Linear Regression needs more verified revenue history.',
                'At least two periods with verified revenue are required before the system can draw a defensible regression line.',
                'Use actual booking and payment queues until more verified payment periods are available.',
                'good'
            ),
            'insight' => 'Insufficient historical data for Simple Linear Regression revenue forecasting.',
        ];
    }

    private function insufficientPaxDemandProjection(array $historical, string $period, int $horizon, int $window, int $sampleSize): array
    {
        return [
            'method' => 'Simple Moving Average (SMA)',
            'formula' => 'SMA = (P1 + P2 + ... + Pn) / n',
            'variables' => [
                'SMA' => 'Projected pax demand for the next period.',
                'P' => 'Historical pax demand per period.',
                'n' => 'Configured moving-average window.',
            ],
            'period' => $period,
            'smaWindow' => $window,
            'horizon' => $horizon,
            'historyWindow' => count($historical),
            'sampleSize' => $sampleSize,
            'is_insufficient_data' => true,
            'is_fallback' => false,
            'rows' => [],
            'historical' => $historical,
            'summary' => [
                'historicalPax' => (int) collect($historical)->sum('pax'),
                'forecastPax' => null,
                'nextForecast' => null,
                'nextMonthBaseline' => null,
                'peakPeriod' => 'Insufficient history',
                'method' => 'Simple Moving Average ('.strtoupper((string) $window).'-period SMA)',
                'sampleSize' => $sampleSize,
            ],
            'interpretation' => $this->insight(
                'Simple Moving Average needs more pax history.',
                'The selected moving-average window requires at least '.$window.' periods with guest demand before a defensible projection can be shown.',
                'Use confirmed upcoming events until more historical demand periods are available.',
                'good'
            ),
            'insight' => 'Insufficient historical data for Simple Moving Average pax demand projection.',
        ];
    }

    private function peso(float $amount): string
    {
        return 'PHP '.number_format($amount, 2);
    }

    private function simpleMovingAverage(array $values, int $window): float
    {
        $slice = array_slice(array_values($values), -$window);
        $slice = array_pad($slice, -$window, 0);

        return count($slice) > 0 ? array_sum($slice) / count($slice) : 0;
    }

    private function percent(int|float $value, int|float $total): int
    {
        if ($total <= 0) {
            return 0;
        }

        return (int) round(($value / $total) * 100);
    }

    private function withSnapshotWindow(array $filters): array
    {
        $window = (string) ($filters['snapshot_window'] ?? 'all');
        $range = $this->snapshotFilters($window);

        if (($filters['date_from'] ?? null) || ($filters['date_to'] ?? null) || empty($range)) {
            return $filters;
        }

        return [
            ...$filters,
            ...$range,
        ];
    }

    private function snapshotFilters(string $window): array
    {
        $today = today();

        return match ($window) {
            '3m' => ['date_from' => $today->copy()->subMonths(3)->startOfDay()->toDateString(), 'date_to' => $today->toDateString()],
            '6m' => ['date_from' => $today->copy()->subMonths(6)->startOfDay()->toDateString(), 'date_to' => $today->toDateString()],
            '12m' => ['date_from' => $today->copy()->subMonths(12)->startOfDay()->toDateString(), 'date_to' => $today->toDateString()],
            '24m' => ['date_from' => $today->copy()->subMonths(24)->startOfDay()->toDateString(), 'date_to' => $today->toDateString()],
            'ytd' => ['date_from' => $today->copy()->startOfYear()->toDateString(), 'date_to' => $today->toDateString()],
            default => [],
        };
    }

    private function snapshotWindowLabel(string $window): string
    {
        return match ($window) {
            '3m' => 'Last 3 months',
            '6m' => 'Last 6 months',
            '12m' => 'Last 12 months',
            '24m' => 'Last 24 months',
            'ytd' => 'Year to date',
            default => 'All time',
        };
    }

    private function normalizePeriod(string $period): string
    {
        return in_array($period, ['monthly', 'quarterly'], true) ? $period : 'monthly';
    }

    private function periodStart(Carbon $date, string $period): Carbon
    {
        if ($period === 'quarterly') {
            return $date->copy()->startOfQuarter()->startOfDay();
        }

        return $date->copy()->startOfMonth()->startOfDay();
    }

    private function shiftPeriod(Carbon $date, int $offset, string $period): Carbon
    {
        return $period === 'quarterly'
            ? $date->copy()->addQuarters($offset)->startOfQuarter()->startOfDay()
            : $date->copy()->addMonths($offset)->startOfMonth()->startOfDay();
    }

    private function periodKey(Carbon $date, string $period): string
    {
        return $period === 'quarterly'
            ? $date->format('Y').'-Q'.$date->quarter
            : $date->format('Y-m');
    }

    private function periodLabel(Carbon $date, string $period): string
    {
        return $period === 'quarterly'
            ? 'Q'.$date->quarter.' '.$date->format('Y')
            : $date->format('M Y');
    }

    private function periodExpression(string $column, string $period): string
    {
        if ($period === 'quarterly') {
            return match (DB::getDriverName()) {
                'pgsql' => "CONCAT(EXTRACT(YEAR FROM $column)::int, '-Q', EXTRACT(QUARTER FROM $column)::int)",
                'mysql', 'mariadb' => "CONCAT(YEAR($column), '-Q', QUARTER($column))",
                default => "strftime('%Y', $column) || '-Q' || (((cast(strftime('%m', $column) as integer) - 1) / 3) + 1)",
            };
        }

        return $this->monthExpression($column);
    }

    private function quarterWhereExpression(string $column): string
    {
        return match (DB::getDriverName()) {
            'pgsql' => "EXTRACT(QUARTER FROM $column)::int",
            'mysql', 'mariadb' => "QUARTER($column)",
            default => "(((cast(strftime('%m', $column) as integer) - 1) / 3) + 1)",
        };
    }

    private function monthExpression(string $column): string
    {
        return match (DB::getDriverName()) {
            'pgsql' => "TO_CHAR($column, 'YYYY-MM')",
            'mysql', 'mariadb' => "DATE_FORMAT($column, '%Y-%m')",
            default => "strftime('%Y-%m', $column)",
        };
    }

    private function calendarMonthExpression(string $column): string
    {
        return match (DB::getDriverName()) {
            'pgsql' => "TO_CHAR($column, 'MM')",
            'mysql', 'mariadb' => "DATE_FORMAT($column, '%m')",
            default => "strftime('%m', $column)",
        };
    }
}
