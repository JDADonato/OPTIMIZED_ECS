<?php

namespace App\Console\Commands;

use App\Services\AnnouncementService;
use Illuminate\Console\Command;

class PublishDueAnnouncements extends Command
{
    protected $signature = 'announcements:publish-due';

    protected $description = 'Publish scheduled announcements whose start time has arrived';

    public function handle(AnnouncementService $announcements): int
    {
        $published = $announcements->publishDueScheduled();

        $this->info("Published {$published} scheduled announcement(s).");

        return self::SUCCESS;
    }
}
