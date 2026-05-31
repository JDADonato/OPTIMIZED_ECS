<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class MenuController extends Controller
{
    /**
     * Get all menu items with optional filtering
     */
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->get('per_page', 50), 1), 100);
        $page = max((int) $request->get('page', 1), 1);
        $category = (string) $request->query('category', 'all');
        $bestSeller = $request->has('best_seller') && $request->boolean('best_seller');
        $active = $request->has('active') ? $request->boolean('active') : true;
        $version = (int) Cache::get('catalog.version', 1);
        $cacheKey = "catalog.public.menu.v{$version}.category:{$category}.best:".(int) $bestSeller.'.active:'.(int) $active.".page:{$page}.per:{$perPage}";

        $items = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($active, $bestSeller, $category, $perPage) {
            $query = MenuItem::query();

            if ($category !== 'all' && $category !== '') {
                $query->where('category', $category);
            }

            if ($bestSeller) {
                $query->whereRaw('is_best_seller is true');
            }

            return $query
                ->whereRaw('is_active is '.($active ? 'true' : 'false'))
                ->orderBy('category')
                ->orderBy('name')
                ->paginate($perPage)
                ->toArray();
        });

        return response()->json($items);
    }

    /**
     * Get a single menu item
     */
    public function show($id)
    {
        $item = MenuItem::findOrFail($id);

        return response()->json($item);
    }

    /**
     * Get all categories (Cached for 24 hours)
     */
    public function categories()
    {
        $categories = Cache::remember('menu_categories', now()->addHours(24), function () {
            return MenuItem::distinct()
                ->whereRaw('is_active is true')
                ->pluck('category')
                ->sort()
                ->values();
        });

        return response()->json($categories);
    }

    /**
     * Get best seller items (Cached for 24 hours)
     */
    public function bestsellers()
    {
        $items = Cache::remember('menu_bestsellers', now()->addHours(24), function () {
            return MenuItem::whereRaw('is_best_seller is true')
                ->whereRaw('is_active is true')
                ->orderBy('name')
                ->get();
        });

        return response()->json($items);
    }
}
