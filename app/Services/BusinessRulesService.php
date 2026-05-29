<?php

namespace App\Services;

/**
 * Ported from: server/config/businessRules.js
 * Central business logic constants and calculations for Eloquente Catering.
 */
class BusinessRulesService
{
    // ─── Capacity Limits ───
    const MAX_PAX_PER_DAY = 3500;
    const MAX_EVENTS_PER_DAY = 7;

    // ─── Fees ───
    const HIGH_RISE_SERVICE_FEE = 0.03;  // 3%
    const OUT_OF_TOWN_FEE = 0.20;        // 20%

    // ─── Payment Terms ───
    // Standard breakdown: 10% reservation, 70% down payment, 20% final
    const PAYMENT_TRANCHES = [
        'Reservation' => 0.10,
        'DownPayment' => 0.70,
        'Final'       => 0.20,
    ];

    /**
     * Calculate required staff based on pax count.
     * Rule: Base 3 staff for ≤50 pax. Add 1 staff for every 25 additional pax.
     */
    public static function calcStaff(int $pax): int
    {
        if ($pax <= 50) return 3;
        $additionalPax = $pax - 50;
        $additionalStaff = (int) ceil($additionalPax / 25);
        return 3 + $additionalStaff;
    }
}
