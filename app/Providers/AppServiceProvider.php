<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->isProduction() && str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        // Phase 1: N+1 Query Eradication
        // Throws an exception when a lazy loading N+1 query happens in dev/testing.
        Model::preventLazyLoading(! $this->app->isProduction());

        $this->configureRateLimits();
    }

    private function configureRateLimits(): void
    {
        RateLimiter::for('client-errors', fn (Request $request) => Limit::perMinute(20)->by($this->rateKey($request)));
        RateLimiter::for('chat-mutation', fn (Request $request) => Limit::perMinute(30)->by($this->rateKey($request)));
        RateLimiter::for('notification-mutation', fn (Request $request) => Limit::perMinute(60)->by($this->rateKey($request)));
        RateLimiter::for('report-heavy', fn (Request $request) => Limit::perMinute(12)->by($this->rateKey($request)));
        RateLimiter::for('refund-action', fn (Request $request) => Limit::perMinute(10)->by($this->rateKey($request)));
        RateLimiter::for('admin-sensitive', fn (Request $request) => Limit::perMinute(12)->by($this->rateKey($request)));
        RateLimiter::for('announcement-action', fn (Request $request) => Limit::perMinute(20)->by($this->rateKey($request)));
        RateLimiter::for('payment-checkout', fn (Request $request) => Limit::perMinute(8)->by($this->rateKey($request)));
    }

    private function rateKey(Request $request): string
    {
        return (string) ($request->user()?->id ?: $request->ip());
    }
}
