<?php

return [
    'timing_enabled' => filter_var(env('PERFORMANCE_TIMING_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'timing_threshold_ms' => (float) env('PERFORMANCE_TIMING_THRESHOLD_MS', 750),
];
