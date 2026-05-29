<?php

use App\Services\PostEventLifecycleService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('bookings:complete-past-submitted', function () {
    $completed = PostEventLifecycleService::completePastSubmitted();

    $this->info("Completed {$completed} past submitted booking(s).");
})->purpose('Complete past submitted booking requests and move them into post-event workflow');
