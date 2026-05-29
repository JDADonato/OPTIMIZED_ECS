<?php

namespace App\Console\Commands;

use App\Services\UploadRegistryService;
use Illuminate\Console\Command;

class BackfillBookingThemeUploads extends Command
{
    protected $signature = 'uploads:backfill-booking-theme-uploads {--dry-run : Scan without creating or updating uploaded file registry rows}';

    protected $description = 'Register existing local booking theme upload references in the uploaded files registry.';

    public function handle(UploadRegistryService $uploads): int
    {
        $summary = $uploads->backfillBookingThemeUploads((bool) $this->option('dry-run'));

        $this->info(($this->option('dry-run') ? 'Dry run complete.' : 'Backfill complete.'));
        $this->table(
            ['Metric', 'Count'],
            collect($summary)->map(fn ($count, $metric) => [$metric, $count])->values()->all()
        );

        return self::SUCCESS;
    }
}
