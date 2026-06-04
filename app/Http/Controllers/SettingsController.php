<?php

namespace App\Http\Controllers;

use App\Models\BusinessRule;
use App\Models\BusinessSetting;
use App\Models\EventType;
use App\Models\MenuItem;
use App\Models\Package;
use App\Services\OperationalBroadcastService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    public function businessSettings()
    {
        $settings = BusinessSetting::query()
            ->orderBy('group')
            ->orderBy('key')
            ->get()
            ->groupBy('group')
            ->map(fn ($items) => $items->mapWithKeys(fn ($item) => [$item->key => $item->value]));

        return response()->json([
            'settings' => $settings,
        ]);
    }

    public function updateBusinessSettings(Request $request)
    {
        $data = $request->validate([
            'group' => ['required', 'string', 'max:80'],
            'settings' => ['required', 'array'],
        ]);

        foreach ($data['settings'] as $key => $value) {
            BusinessSetting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => is_array($value) ? $value : ['value' => $value],
                    'group' => $data['group'],
                    'updated_by' => $request->user()?->id,
                ]
            );
        }

        app(OperationalBroadcastService::class)
            ->adminChanged('settings', 'business_settings', $data['group'], 'updated', 'Business settings updated.');

        return response()->json([
            'message' => 'Settings updated successfully.',
            'settings' => BusinessSetting::where('group', $data['group'])->get()->mapWithKeys(fn ($item) => [$item->key => $item->value]),
        ]);
    }

    public function paymentRules()
    {
        return response()->json($this->activeBusinessRule());
    }

    public function updatePaymentRules(Request $request)
    {
        $data = $request->validate([
            'reservation_fee_percentage' => 'required|numeric|min:0|max:100',
            'downpayment_percentage' => 'required|numeric|min:0|max:100',
            'final_payment_percentage' => 'required|numeric|min:0|max:100',
            'reservation_validity_hours' => 'required|integer|min:1|max:720',
            'downpayment_due_days' => 'required|integer|min:1|max:365',
            'final_payment_due_days' => 'required|integer|min:1|max:365',
        ]);

        $total = (float) $data['reservation_fee_percentage']
            + (float) $data['downpayment_percentage']
            + (float) $data['final_payment_percentage'];

        if (round($total, 2) !== 100.00) {
            return response()->json(['error' => 'Payment tranche percentages must total 100%.'], 422);
        }

        if ((int) $data['final_payment_due_days'] >= (int) $data['downpayment_due_days']) {
            return response()->json(['error' => 'Final payment due days must be less than down payment due days.'], 422);
        }

        $rule = $this->activeBusinessRule();
        $rule->update($data);
        Cache::forget('business_rules.active');

        app(OperationalBroadcastService::class)
            ->adminChanged('finance', 'payment_rules', $rule->id, 'updated', 'Payment rules updated.');

        return response()->json(['message' => 'Payment rules updated successfully.', 'rules' => $rule->fresh()]);
    }

    private function activeBusinessRule(): BusinessRule
    {
        return BusinessRule::getActive() ?? BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 3,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 20,
            'is_active' => true,
        ]);
    }

    public function menuItems()
    {
        $version = $this->catalogVersion();

        return response()->json(Cache::remember("catalog.settings.menu_items.v{$version}", now()->addMinutes(10), fn () => (
            MenuItem::query()
                ->orderBy('category')
                ->orderBy('name')
                ->get()
        )));
    }

    public function eventTypes()
    {
        $version = $this->catalogVersion();

        return response()->json(Cache::remember("catalog.settings.event_types.v{$version}", now()->addMinutes(10), fn () => (
            EventType::query()
                ->orderBy('label')
                ->get()
        )));
    }

    public function createPackage(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|string|max:255|exists:event_types,slug',
            'package_category' => 'nullable|string|max:255',
            'event_type_slugs' => 'nullable',
            'base_price_per_head' => 'required|numeric|min:0',
            'minimum_pax' => 'required|integer|min:1',
            'description' => 'nullable|string',
            'inclusions' => 'nullable',
            'amenities' => 'nullable',
            'applicable_setups' => 'nullable',
            'menu_structure' => 'nullable',
            'security_type' => 'nullable|string|max:255',
            'security_label' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $data['inclusions'] = $this->normalizeLines($data['inclusions'] ?? []);
        $data['amenities'] = $this->normalizeLines($data['amenities'] ?? []);
        $data['applicable_setups'] = $this->normalizeLines($data['applicable_setups'] ?? []);
        $data['event_type_slugs'] = $this->normalizeSlugs($data['event_type_slugs'] ?? [$data['type']]);
        $data['package_category'] = $data['package_category'] ?? 'standard';
        $data['menu_structure'] = $this->normalizeMenuStructure($data['menu_structure'] ?? []);
        $data['is_active'] = $data['is_active'] ?? true;

        $package = Package::create($data);
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'package', $package->id, 'created', 'Package created.');

        return response()->json($package, 201);
    }

    public function updatePackage(Request $request, int $id)
    {
        $package = Package::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|string|max:255|exists:event_types,slug',
            'package_category' => 'nullable|string|max:255',
            'event_type_slugs' => 'nullable',
            'base_price_per_head' => 'sometimes|required|numeric|min:0',
            'minimum_pax' => 'sometimes|required|integer|min:1',
            'description' => 'nullable|string',
            'inclusions' => 'nullable',
            'amenities' => 'nullable',
            'applicable_setups' => 'nullable',
            'menu_structure' => 'nullable',
            'security_type' => 'nullable|string|max:255',
            'security_label' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        if (array_key_exists('inclusions', $data)) {
            $data['inclusions'] = $this->normalizeLines($data['inclusions']);
        }
        if (array_key_exists('amenities', $data)) {
            $data['amenities'] = $this->normalizeLines($data['amenities']);
        }
        if (array_key_exists('applicable_setups', $data)) {
            $data['applicable_setups'] = $this->normalizeLines($data['applicable_setups']);
        }
        if (array_key_exists('event_type_slugs', $data)) {
            $data['event_type_slugs'] = $this->normalizeSlugs($data['event_type_slugs']);
        }
        if (array_key_exists('menu_structure', $data)) {
            $data['menu_structure'] = $this->normalizeMenuStructure($data['menu_structure']);
        }

        $package->update($data);
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'package', $package->id, 'updated', 'Package updated.');

        return response()->json(['message' => 'Package updated successfully.', 'package' => $package->fresh()]);
    }

    public function updateDishPricing(Request $request, int $id)
    {
        $data = $request->validate([
            'cost_per_head' => 'required|numeric|min:0',
            'price_adj' => 'nullable|numeric|min:0',
        ]);

        $item = MenuItem::findOrFail($id);
        $item->update([
            'cost_per_head' => $data['cost_per_head'],
            'price_adj' => $data['price_adj'] ?? 0,
        ]);
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'menu_item', $item->id, 'pricing_updated', 'Dish pricing updated.');

        return response()->json(['message' => 'Dish pricing updated successfully.', 'item' => $item->fresh()]);
    }

    public function createMenuItem(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|in:starter,main,side,dessert,drink',
            'cost_per_head' => 'required|numeric|min:0',
            'price_adj' => 'nullable|numeric|min:0',
            'image' => 'nullable|string',
            'description' => 'nullable|string',
            'is_best_seller' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $item = MenuItem::create([
            'dish_id' => 'custom_'.strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $data['name'])).'_'.time(),
            'name' => $data['name'],
            'category' => $data['category'],
            'cost_per_head' => $data['cost_per_head'],
            'price_adj' => $data['price_adj'] ?? 0,
            'image' => $data['image'] ?? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
            'description' => $data['description'] ?? '',
            'is_best_seller' => $data['is_best_seller'] ?? false,
            'is_active' => $data['is_active'] ?? true,
        ]);
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'menu_item', $item->id, 'created', 'Menu item created.');

        return response()->json($item, 201);
    }

    public function updateMenuItem(Request $request, int $id)
    {
        $item = MenuItem::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'category' => 'sometimes|required|in:starter,main,side,dessert,drink',
            'cost_per_head' => 'nullable|numeric|min:0',
            'price_adj' => 'nullable|numeric|min:0',
            'image' => 'nullable|string',
            'description' => 'nullable|string',
            'is_best_seller' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $item->update($data);
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'menu_item', $item->id, 'updated', 'Menu item updated.');

        return response()->json(['message' => 'Menu item updated successfully.', 'item' => $item->fresh()]);
    }

    public function archiveMenuItem(int $id)
    {
        $item = MenuItem::findOrFail($id);
        $item->update(['is_active' => false]);
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'menu_item', $item->id, 'archived', 'Menu item archived.');

        return response()->json(['message' => 'Menu item archived successfully.', 'item' => $item->fresh()]);
    }

    public function createEventType(Request $request)
    {
        $data = $request->validate([
            'label' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:event_types,slug',
            'icon' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:2048',
            'package_category' => 'nullable|string|max:255',
            'applicable_setups' => 'nullable',
            'security_type' => 'nullable|string|max:255',
            'security_label' => 'nullable|string|max:255',
            'security_description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $data['slug'] = $data['slug'] ?? Str::slug($data['label']);
        $data['icon'] = $data['icon'] ?? 'sparkles';
        $data['package_category'] = $data['package_category'] ?? 'standard';
        $data['applicable_setups'] = $this->normalizeLines($data['applicable_setups'] ?? []);
        $data['is_active'] = $data['is_active'] ?? true;
        $data['archived_at'] = empty($data['is_active']) ? now() : null;

        if (EventType::where('slug', $data['slug'])->exists()) {
            return response()->json(['error' => 'An event type with this slug already exists.'], 422);
        }

        $eventType = EventType::create($data);
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'event_type', $eventType->id, 'created', 'Event type created.');

        return response()->json($eventType, 201);
    }

    public function updateEventType(Request $request, int $id)
    {
        $eventType = EventType::findOrFail($id);

        $data = $request->validate([
            'label' => 'sometimes|required|string|max:255',
            'slug' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('event_types', 'slug')->ignore($eventType->id)],
            'icon' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:2048',
            'package_category' => 'nullable|string|max:255',
            'applicable_setups' => 'nullable',
            'security_type' => 'nullable|string|max:255',
            'security_label' => 'nullable|string|max:255',
            'security_description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        if (array_key_exists('slug', $data)) {
            Package::where('type', $eventType->slug)->update(['type' => $data['slug']]);
            Package::all()->each(function (Package $package) use ($eventType, $data) {
                $slugs = $package->event_type_slugs ?: [];
                if (! in_array($eventType->slug, $slugs, true)) {
                    return;
                }

                $package->event_type_slugs = array_values(array_unique(array_map(
                    fn ($slug) => $slug === $eventType->slug ? $data['slug'] : $slug,
                    $slugs
                )));
                $package->save();
            });
        }
        if (array_key_exists('applicable_setups', $data)) {
            $data['applicable_setups'] = $this->normalizeLines($data['applicable_setups']);
        }
        if (array_key_exists('is_active', $data)) {
            $data['archived_at'] = $data['is_active'] ? null : ($eventType->archived_at ?: now());
        }

        $eventType->update($data);
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'event_type', $eventType->id, 'updated', 'Event type updated.');

        return response()->json(['message' => 'Event type updated successfully.', 'event_type' => $eventType->fresh()]);
    }

    public function deleteEventType(int $id)
    {
        $eventType = EventType::findOrFail($id);

        $eventType->forceFill([
            'is_active' => false,
            'archived_at' => $eventType->archived_at ?: now(),
        ])->save();
        $this->bumpCatalogVersion();

        app(OperationalBroadcastService::class)
            ->adminChanged('catalog', 'event_type', $eventType->id, 'archived', 'Event type archived.');

        return response()->json(['message' => 'Event type archived successfully.', 'event_type' => $eventType->fresh()]);
    }

    public function archiveEventType(int $id)
    {
        return $this->deleteEventType($id);
    }

    private function normalizeLines($value): array
    {
        if (is_array($value)) {
            return array_values(array_filter($value));
        }

        return array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string) $value))));
    }

    private function normalizeSlugs($value): array
    {
        if (is_array($value)) {
            return array_values(array_unique(array_filter(array_map('trim', $value))));
        }

        return array_values(array_unique(array_filter(array_map('trim', preg_split('/,|\r\n|\r|\n/', (string) $value)))));
    }

    private function normalizeMenuStructure($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function catalogVersion(): int
    {
        return (int) Cache::get('catalog.version', 1);
    }

    private function bumpCatalogVersion(): void
    {
        Cache::put('catalog.version', $this->catalogVersion() + 1, now()->addDays(30));
        Cache::forget('menu_categories');
        Cache::forget('menu_bestsellers');
    }
}
