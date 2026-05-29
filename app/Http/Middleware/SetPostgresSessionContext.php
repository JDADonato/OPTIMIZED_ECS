<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class SetPostgresSessionContext
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('database.default') === 'pgsql') {
            $user = $request->user() ?: Auth::user();

            DB::statement("select set_config('app.current_user_id', ?, false)", [
                $user ? (string) $user->id : '',
            ]);

            DB::statement("select set_config('app.current_user_role', ?, false)", [
                $user ? (string) $user->role : '',
            ]);
        }

        return $next($request);
    }
}
