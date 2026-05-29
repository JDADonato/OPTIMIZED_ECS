<?php

namespace App\Console\Commands;

use App\Services\UploadRegistryService;
use Illuminate\Console\Command;

class PurgeOrphanUploads extends Command
{
    protected $signature = 'uploads:purge-orphans';

    protected $description = 'Discard temporary uploads that were never attached to an operational record.';

    public function handle(UploadRegistryService $uploads): int
    {
        $count = $uploads->purgeOrphans();
        $this->info("Purged {$count} orphaned upload(s).");

        return self::SUCCESS;
    }
}
