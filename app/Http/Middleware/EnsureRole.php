<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Handle an incoming request.
     * Usage: middleware('role:Admin,Marketing') — allows Admin OR Marketing.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! Auth::check()) {
            return redirect()->route('login');
        }

        if ((Auth::user()->account_status ?? 'active') !== 'active') {
            Auth::logout();

            return redirect()->route('login')->with('error', 'This account is deactivated.');
        }

        if (! in_array(Auth::user()->role, $roles)) {
            abort(403, 'Unauthorized — insufficient role.');
        }

        return $next($request);
    }
}
