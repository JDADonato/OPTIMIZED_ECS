let menuItemsPromise = null;
let customMenuItemsPromise = null;

/**
 * Fetches all menu items from the database API and organizes them by category.
 * Returns a DISHES-like object with category keys.
 */

export async function fetchMenuItemsFromAPI() {
    if (menuItemsPromise) return menuItemsPromise;

    menuItemsPromise = fetchMenuItemsFromAPINetwork();
    return menuItemsPromise;
}

async function fetchMenuItemsFromAPINetwork() {
    try {
        const res = await fetch('/api/menu?per_page=100&active=1');
        if (res.ok) {
            const data = await res.json();
            const items = Array.isArray(data.data) ? data.data : [];
            
            // Organize by category
            const organized = {
                starter: [],
                main: [],
                side: [],
                dessert: [],
                drink: [],
            };
            
            items.forEach(item => {
                const category = item.category || 'main';
                if (!organized[category]) {
                    organized[category] = [];
                }
                
                organized[category].push(normalizeAPIItem(item));
            });
            
            return organized;
        }
    } catch (error) {
        console.error('Error fetching menu items from API:', error);
    }
    menuItemsPromise = null;
    return { starter: [], main: [], side: [], dessert: [], drink: [] };
}

/**
 * Fetches custom menu items from the legacy API endpoint (if needed).
 */
export async function fetchCustomMenuItems() {
    if (customMenuItemsPromise) return customMenuItemsPromise;

    customMenuItemsPromise = fetchCustomMenuItemsNetwork();
    return customMenuItemsPromise;
}

async function fetchCustomMenuItemsNetwork() {
    try {
        const res = await fetch('/api/menu-items');
        if (res.ok) {
            return await res.json();
        }
    } catch (error) {
        console.error('Error fetching custom menu items:', error);
    }
    customMenuItemsPromise = null;
    return [];
}

/**
 * Convert DB menu item into the standard shape for display.
 */
export function normalizeAPIItem(dbItem) {
    return {
        id: dbItem.id,
        dishId: dbItem.dish_id,
        name: dbItem.name,
        costPerHead: parseFloat(dbItem.cost_per_head),
        priceAdj: parseFloat(dbItem.price_adj || 0),
        image: dbItem.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
        isBestSeller: dbItem.is_best_seller,
        description: dbItem.description || '',
        isActive: dbItem.is_active !== false,
    };
}

/**
 * Convert raw DB menu items into the standard shape (legacy).
 */
export function normalizeCustomItems(dbItems) {
    return dbItems.map(normalizeAPIItem);
}

/**
 * Returns an organized menu object by category.
 * Fetches menu data from the database API.
 */
export function getMergedDishes(customItems = []) {
    // If customItems are provided, organize them by category
    if (customItems && customItems.length > 0) {
        const merged = {
            starter: [],
            main: [],
            side: [],
            dessert: [],
            drink: [],
        };
        
        customItems.forEach(item => {
            const category = item.category || 'main';
            if (!merged[category]) {
                merged[category] = [];
            }
            merged[category].push(normalizeCustomItems([item])[0]);
        });
        
        return merged;
    }
    
    // Empty structure
    return { starter: [], main: [], side: [], dessert: [], drink: [] };
}
