import { useState, useEffect, useMemo } from 'react';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';
import SmartImage from '../common/SmartImage';

const CATEGORY_TABS = [
    { key: 'starter', label: 'Starters' },
    { key: 'main', label: 'Main Course' },
    { key: 'side', label: 'Sides' },
    { key: 'dessert', label: 'Dessert' },
    { key: 'drink', label: 'Refreshments' }
];

const CATEGORY_LABELS = {
    starter: 'Starters',
    main: 'Main Dish',
    side: 'Sides',
    dessert: 'Dessert',
    drink: 'Refreshments'
};

const money = (value) => `\u20B1${Number(value || 0).toLocaleString()}`;
const emptyMenuGroups = { starter: [], main: [], side: [], dessert: [], drink: [] };

const BookingMenuSkeleton = ({ rows = 6 }) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Loading menu choices">
        {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="rounded-xl border border-[#720101]/10 bg-white p-4">
                <div className="flex gap-4">
                    <div className="h-24 w-24 flex-shrink-0 animate-pulse rounded-lg bg-gradient-to-r from-[#fffaf3] via-white to-[#f1e5dc]" />
                    <div className="min-w-0 flex-1 space-y-3">
                        <div className="h-4 w-2/3 animate-pulse rounded-full bg-gray-100" />
                        <div className="h-3 w-full animate-pulse rounded-full bg-gray-100" />
                        <div className="h-3 w-3/4 animate-pulse rounded-full bg-gray-100" />
                        <div className="h-4 w-24 animate-pulse rounded-full bg-[#720101]/10" />
                    </div>
                    <div className="h-9 w-16 animate-pulse rounded-full bg-gray-100" />
                </div>
            </div>
        ))}
    </div>
);

const BookingPackageSkeleton = ({ rows = 3 }) => (
    <>
        {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[#720101]/10 bg-white p-5 shadow-sm">
                <div className="h-3 w-20 animate-pulse rounded-full bg-[#720101]/10" />
                <div className="mt-4 h-6 w-2/3 animate-pulse rounded-full bg-gray-100" />
                <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-gray-100" />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-gray-100" />
                <div className="mt-6 h-10 w-full animate-pulse rounded-xl bg-[#720101]/10" />
            </div>
        ))}
    </>
);

// Open menu builder stays flexible. Curated packages use their structure as included allowances.
const CATEGORY_LIMITS = {
    starter: 99,
    main: 99,
    side: 99,
    dessert: 99,
    drink: 99
};

const GLOBAL_PAYMENT_TERMS = [
    '10% reservation fee, non-refundable',
    '70% down payment due one month before the event',
    '20% balance due 10 days before the event',
    '+20% service charge outside Metro Manila',
    '+3% service charge for basement or upper-floor venues'
];

const STANDARD_PREMIUM_INCLUSIONS = [
    'Buffet table styling with centerpiece, skirting, and lights',
    'Guest tables with floor-length mantels and lace',
    'Complete dinnerware, flatware, and glassware',
    'Elegant roll-top chafing dishes',
    'Uniformed waitstaff',
    'Purified water and ice',
    'Free food tasting for two'
];

const PACKAGE_CATEGORY_CONFIGS = {
    premium: {
        title: 'Weddings & Debuts',
        eyebrow: 'Premium ceremonial tier',
        description: 'Grand packages for formal celebrations with a complete ceremonial setup, premium styling, and contingency protection.',
        pricingNote: 'Flexible per-guest pricing based on the customer guest count. A 10% service charge applies.',
        taxNote: 'VAT exclusive',
        security: {
            type: 'contingency',
            label: '10% Contingency',
            description: 'Flexible emergency fund built into the estimate for extra guests, overtime, or unexpected event overages.',
            rate: 0.10,
        },
        serviceChargeRate: 0.10,
        vatRate: 0,
        decemberSurcharge: 10000,
        amenities: [
            'Elegant backdrop with floral arrangements',
            'Red carpet rollout',
            'Elegant Presidential Table Set-Up',
            'Tiffany chairs for all guests with motif ribbons',
            'Fresh flower centerpieces on each guest table',
            'Bottle of wine for toasting',
            'Styled registration and gift tables',
            ...STANDARD_PREMIUM_INCLUSIONS,
        ],
        debutExclusives: ['18 Roses', '18 Candles', 'Bouquet for the Debutant'],
        guestPerks150: ['Choice of 2: 3 to 4-layer cake or cupcakes', 'Professional emcee', '3-hour bridal car'],
        packages: [
            {
                code: 'WED-ANTHURIUM',
                name: 'Anthurium',
                description: 'Wedding tier with beef main course, fish, pasta, chicken, and pork belly carving station.',
                pricingType: 'per_head',
                pricesByPax: { small: 950, large: 950 },
                menuProfile: 'Includes dedicated Beef main course plus Oven-Baked Pork Belly Carving Station.',
                structure: { starter: 2, main: 3, side: 1, dessert: 2, drink: 1 },
                highlights: ['Beef main course included', 'Pork belly carving station', 'Full ceremonial setup'],
            },
            {
                code: 'WED-STARGAZER',
                name: 'Stargazer',
                description: 'Expanded wedding tier with a broader premium menu and the complete grand setup.',
                pricingType: 'per_head',
                pricesByPax: { small: 1250, large: 1050 },
                menuProfile: 'Includes dedicated Beef main course, more mains, and Oven-Baked Pork Belly Carving Station.',
                structure: { starter: 2, main: 4, side: 1, dessert: 2, drink: 1 },
                highlights: ['Expanded premium menu', 'Beef main course included', 'Full ceremonial setup'],
            },
            {
                code: 'WED-CARNATION',
                name: 'Carnation',
                description: 'Top wedding tier with the widest menu allowance and strongest reception styling.',
                pricingType: 'per_head',
                pricesByPax: { small: 1450, large: 1150 },
                menuProfile: 'Includes dedicated Beef main course, expanded mains, and Oven-Baked Pork Belly Carving Station.',
                structure: { starter: 3, main: 4, side: 2, dessert: 2, drink: 1 },
                highlights: ['Widest wedding menu allowance', 'Beef main course included', 'Best fit for grand receptions'],
            },
            {
                code: 'WED-150-PERKS',
                name: '150+ Guest Perks Add-On',
                description: 'Optional perk package for wedding and debut bookings with at least 150 guests.',
                pricingType: 'addon',
                addOnOnly: true,
                minimumPax: 150,
                addOnPrice: 0,
                structure: { starter: 0, main: 0, side: 0, dessert: 0, drink: 0 },
                highlights: ['Choose 2: cake or cupcakes', 'Professional emcee', '3-hour bridal car'],
            },
        ],
    },
    birthday: {
        title: 'Birthdays',
        eyebrow: 'Standard party tier',
        description: 'Elegant party packages without ceremonial items like red carpet, presidential table, or backdrop.',
        pricingNote: 'Flexible per-head pricing changes by guest count. Optional kids meal is available at Php 375/head.',
        taxNote: 'VAT exclusive',
        security: {
            type: 'cash_bond',
            label: 'Php 1,500 Cash Bond',
            description: 'Refundable deposit for broken plates or missing equipment. No contingency percentage.',
            amount: 1500,
        },
        serviceChargeRate: 0.10,
        vatRate: 0,
        kidsMealPrice: 375,
        amenities: [
            'Tiffany chairs for all guests with motif ribbons',
            'Fresh flower centerpieces on each guest table',
            'Bottle of wine for toasting',
            'Styled registration and gift tables',
            ...STANDARD_PREMIUM_INCLUSIONS,
        ],
        packages: [
            {
                code: 'BDAY-ANTHURIUM',
                name: 'Anthurium',
                description: 'Lite party version with fish, pasta, chicken, and pork belly carving station.',
                pricingType: 'per_head',
                pricesByPax: { small: 950, large: 800 },
                menuProfile: 'Drops the dedicated Beef main course; keeps Fish, Pasta, Chicken, and Pork Belly Carving Station.',
                structure: { starter: 1, main: 2, side: 1, dessert: 2, drink: 1 },
                highlights: ['No ceremonial setup', 'Pork belly carving station', 'Tiffany chair party setup'],
            },
            {
                code: 'BDAY-STARGAZER',
                name: 'Stargazer',
                description: 'Mid party tier with extra variety while keeping the birthday setup lighter.',
                pricingType: 'per_head',
                pricesByPax: { small: 1100, large: 980 },
                menuProfile: 'Birthday-scaled menu without the separate Beef main course or wedding ceremonial items.',
                structure: { starter: 2, main: 3, side: 1, dessert: 2, drink: 1 },
                highlights: ['More menu variety', 'No red carpet or backdrop', 'Cash bond only'],
            },
            {
                code: 'BDAY-CARNATION',
                name: 'Carnation',
                description: 'Highest birthday tier with the broadest party menu but still no ceremonial production.',
                pricingType: 'per_head',
                pricesByPax: { small: 1260, large: 1120 },
                menuProfile: 'Birthday-scaled premium party menu; no dedicated Beef main course and no grand wedding setup.',
                structure: { starter: 2, main: 3, side: 1, dessert: 3, drink: 1 },
                highlights: ['Broadest birthday menu', 'Elegant party setup', 'Cash bond only'],
            },
        ],
    },
    standard: {
        title: 'Standard Events',
        eyebrow: 'Packages A & B',
        description: 'General-purpose packages for graduations, reunions, corporate gatherings, and event types outside the premium categories.',
        pricingNote: 'Flexible per-head pricing based on the customer guest count. +12% VAT is strictly noted.',
        taxNote: '+12% VAT exclusive',
        security: {
            type: 'cash_bond',
            label: 'Php 1,500 Cash Bond',
            description: 'Refundable deposit for equipment damages. No contingency percentage.',
            amount: 1500,
        },
        serviceChargeRate: 0,
        vatRate: 0.12,
        amenities: [
            'Artificial flower centerpieces for guest tables',
            'Buffet table styling',
            'Guest tables with floor-length mantels and lace',
            'Complete dinnerware, flatware, and glassware',
            'Elegant roll-top chafing dishes',
            'Uniformed waitstaff',
            'Purified water and ice',
        ],
        packages: [
            {
                code: 'STANDARD-A',
                name: 'Package A - Tiffany Setup',
                description: 'Standard event package with Tiffany chairs and motif ribbons.',
                pricingType: 'per_head',
                basePrice: 850,
                structure: { starter: 2, main: 2, side: 1, dessert: 1, drink: 1 },
                highlights: ['Tiffany chairs with motif ribbons'],
            },
            {
                code: 'STANDARD-B',
                name: 'Package B - Monoblock Setup',
                description: 'Budget-conscious large-event package with monoblock chairs and motif ribbons.',
                pricingType: 'per_head',
                basePrice: 750,
                structure: { starter: 1, main: 2, side: 1, dessert: 1, drink: 1 },
                highlights: ['Monoblock chairs with motif ribbons'],
            },
        ],
    },
};

const resolvePackageCategoryKey = (eventType = '') => {
    const normalized = String(eventType).toLowerCase();
    if (normalized.includes('wedding') || normalized.includes('debut')) return 'premium';
    if (normalized.includes('birthday') || normalized.includes('bday')) return 'birthday';
    return 'standard';
};

const normalizePackageStructure = (structure = {}) => ({
    starter: Number(structure.starter ?? structure.starters ?? 0),
    main: Number(structure.main ?? structure.mains ?? structure.main_dish ?? structure.mainDish ?? 0),
    side: Number(structure.side ?? structure.sides ?? 0),
    dessert: Number(structure.dessert ?? structure.desserts ?? 0),
    drink: Number(structure.drink ?? structure.drinks ?? structure.refreshment ?? structure.refreshments ?? 0),
});

const apiPackageToCard = (pkg, categoryKey) => ({
    id: pkg.id,
    code: pkg.code || `${String(pkg.package_category || categoryKey).toUpperCase()}-${String(pkg.name || 'PACKAGE').toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
    name: pkg.name,
    description: pkg.description || 'Custom package configured by the staff catalog.',
    pricingType: 'per_head',
    basePrice: Number(pkg.base_price_per_head || 0),
    minimumPax: Number(pkg.minimum_pax || 1),
    structure: normalizePackageStructure(pkg.menu_structure || {}),
    highlights: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
    menuProfile: Array.isArray(pkg.amenities) ? pkg.amenities[0] : '',
    packageRecord: pkg,
});

const resolvePackagePricing = (pkg, pax = 0) => {
    if (pkg.pricingType === 'flat') {
        const guestCount = Number(pax || 0);
        return {
            ...pkg,
            flatPrice: pkg.flatPrices?.[guestCount] || pkg.flatPrice || 0,
            guestCount,
            guestBand: `${guestCount} pax`,
        };
    }

    if (pkg.pricingType === 'per_head' && pkg.pricesByPax) {
        const isLarge = Number(pax || 0) >= 100;
        return {
            ...pkg,
            basePrice: isLarge ? pkg.pricesByPax.large : pkg.pricesByPax.small,
            guestBand: `${Number(pax || 0).toLocaleString()} pax ${isLarge ? 'large-event rate' : 'standard rate'}`,
        };
    }

    return pkg;
};

const MenuBuilder = ({ bookingData, updateBooking, onNext, onBack, mode = 'full' }) => {
    const { pax, selectedDishes: existingDishes } = bookingData;
    const [phase, setPhase] = useState(() => {
        if (mode === 'menu') return 'menu';
        if (mode === 'packages') return bookingData.packageChoiceStage === 'curated' ? 'curated' : 'path';
        return bookingData.packageChoiceStage === 'curated' ? 'curated' : 'path';
    }); // 'path' | 'curated' | 'menu'
    const [budget, setBudget] = useState(bookingData.budget || '');
    const [activeTab, setActiveTab] = useState('starter');
    const [selections, setSelections] = useState({
        starter: [],
        main: [],
        side: [],
        dessert: [],
        drink: []
    });

    // Pricing overrides from server
    const [pricingOverrides, setPricingOverrides] = useState({});
    const [customItems, setCustomItems] = useState(emptyMenuGroups);
    const [curatedPackages, setCuratedPackages] = useState([]);
    const [menuCatalogLoading, setMenuCatalogLoading] = useState(true);
    const [menuCatalogLoaded, setMenuCatalogLoaded] = useState(false);
    const [menuCatalogError, setMenuCatalogError] = useState(false);
    const [pricingLoading, setPricingLoading] = useState(true);
    const [packagesLoading, setPackagesLoading] = useState(true);
    const [packagesLoaded, setPackagesLoaded] = useState(false);
    const [packagesError, setPackagesError] = useState(false);
    const [lightboxDish, setLightboxDish] = useState(null);
    const [menuSearch, setMenuSearch] = useState('');
    const [menuFilter, setMenuFilter] = useState('all');
    const [menuSort, setMenuSort] = useState('recommended');
    const [menuPage, setMenuPage] = useState(1);
    const dishesPerPage = 6;

    useEffect(() => {
        const fetchOverrides = async () => {
            try {
                const res = await fetch('/api/pricing');
                if (res.ok) {
                    const data = await res.json();
                    setPricingOverrides(data.overrides || {});
                }
            } catch (error) {
                console.error("Error fetching pricing overrides:", error);
            } finally {
                setPricingLoading(false);
            }
        };
        fetchOverrides();
        setMenuCatalogLoading(true);
        setMenuCatalogError(false);
        fetchMenuItemsFromAPI()
            .then(organizedDishes => {
                setCustomItems(organizedDishes || emptyMenuGroups);
                setMenuCatalogLoaded(true);
            })
            .catch(error => {
                console.error('Error fetching menu catalog:', error);
                setCustomItems(emptyMenuGroups);
                setMenuCatalogError(true);
                setMenuCatalogLoaded(true);
            })
            .finally(() => setMenuCatalogLoading(false));
    }, []);

    useEffect(() => {
        const slug = bookingData.eventTypeSlug;
        const packageUrl = slug ? `/api/packages/type/${encodeURIComponent(slug)}` : '/api/packages?per_page=100';
        setPackagesLoading(true);
        setPackagesLoaded(false);
        setPackagesError(false);
        fetch(packageUrl)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.data || []);
                setCuratedPackages(list);
                setPackagesLoaded(true);
            })
            .catch(error => {
                console.error('Error fetching curated packages:', error);
                setCuratedPackages([]);
                setPackagesLoaded(true);
                setPackagesError(true);
            })
            .finally(() => {
                setPackagesLoading(false);
            });
    }, [bookingData.eventTypeSlug]);

    // Menu items organized by category (already structured from API)
    const mergedDishes = customItems;
    const packageCategoryKey = PACKAGE_CATEGORY_CONFIGS[bookingData.package_category]
        ? bookingData.package_category
        : resolvePackageCategoryKey(bookingData.eventType);
    const packageCategory = PACKAGE_CATEGORY_CONFIGS[packageCategoryKey] || PACKAGE_CATEGORY_CONFIGS.standard;
    const configuredPackageCards = curatedPackages
        .filter(pkg => !pkg.package_category || pkg.package_category === packageCategoryKey)
        .map(pkg => apiPackageToCard(pkg, packageCategoryKey))
        .filter(pkg => Number(pax || 0) >= (pkg.minimumPax || 1));
    const fallbackPackageCards = packageCategory.packages
        .map(pkg => resolvePackagePricing(pkg, pax))
        .filter(pkg => !pkg.addOnOnly || Number(pax || 0) >= (pkg.minimumPax || 0));
    const packageCards = configuredPackageCards.length ? configuredPackageCards : fallbackPackageCards;
    const hasPackagePricing = Boolean(bookingData.package_pricing_type || bookingData.package_base_price || bookingData.package_flat_price);
    const budgetMinimum = useMemo(() => {
        if (!pax) return 0;
        return CATEGORY_TABS.reduce((sum, tab) => {
            const categoryDishes = mergedDishes[tab.key] || [];
            if (categoryDishes.length === 0) return sum;
            const cheapest = Math.min(...categoryDishes.map(dish => getDishCost(dish)));
            return sum + (cheapest * pax);
        }, 0);
    }, [mergedDishes, pax, pricingOverrides]);
    const budgetNumber = parseInt(budget || 0, 10);
    const isBudgetReady = budgetMinimum > 0 && budgetNumber >= budgetMinimum;
    const isMenuCatalogLoading = menuCatalogLoading || pricingLoading || !menuCatalogLoaded;
    const isMenuCatalogReady = menuCatalogLoaded && !menuCatalogLoading && !pricingLoading;
    const budgetMissingCategory = isMenuCatalogReady ? CATEGORY_TABS.find(tab => (mergedDishes[tab.key] || []).length === 0) : null;
    const budgetStatusMessage = isMenuCatalogLoading
        ? 'Menu prices are still loading.'
        : menuCatalogError
            ? 'Menu prices could not be loaded. Please try again later.'
            : budgetMissingCategory
                ? `No active ${budgetMissingCategory.label.toLowerCase()} dishes are available yet.`
                : budgetMinimum > 0
                    ? `For ${pax} guests, a complete menu starts at ${money(budgetMinimum)}. This includes at least one choice from each menu section.`
                    : 'Checking the starting menu price for your guest count.';
    const packageTerms = [
        ...GLOBAL_PAYMENT_TERMS,
        packageCategory.pricingNote,
        packageCategory.security.label,
    ];
    const packageContextFields = {
        package_category: packageCategoryKey,
        package_category_label: packageCategory.title,
        package_amenities: bookingData.event_applicable_setups?.length ? bookingData.event_applicable_setups : packageCategory.amenities,
        package_terms: packageTerms,
        package_security_type: bookingData.event_security_type || packageCategory.security.type,
        package_security_label: bookingData.event_security_label || packageCategory.security.label,
        package_security_description: bookingData.event_security_description || packageCategory.security.description,
        package_security_rate: packageCategory.security.rate || 0,
        package_cash_bond: packageCategory.security.amount || 0,
        package_service_charge_rate: packageCategory.serviceChargeRate || 0,
        package_vat_rate: packageCategory.vatRate || 0,
        package_december_surcharge: packageCategory.decemberSurcharge || 0,
        package_kids_meal_price: packageCategory.kidsMealPrice || 0,
        package_location_surcharge_rate: 0.20,
        package_floor_surcharge_rate: 0.03,
    };

    // Restore existing selections if coming back
    useEffect(() => {
        if (existingDishes && Object.keys(existingDishes).some(k => existingDishes[k]?.length > 0)) {
            setSelections({
                starter: existingDishes.starter || existingDishes.starters || [],
                main: existingDishes.main || existingDishes.mains || [],
                side: existingDishes.side || existingDishes.sides || [],
                dessert: existingDishes.dessert || existingDishes.desserts || [],
                drink: existingDishes.drink || existingDishes.drinks || []
            });
            if (mode !== 'packages') {
                setPhase('menu');
            }
        }
    }, []);

    const getExtraSelectionRows = (nextSelections = selections, allowances = bookingData.package_allowances || CATEGORY_LIMITS) => {
        const rows = [];
        Object.keys(nextSelections).forEach(category => {
            const includedLimit = allowances?.[category] ?? CATEGORY_LIMITS[category] ?? 0;
            const extraIds = (nextSelections[category] || []).slice(includedLimit);
            extraIds.forEach(id => {
                const dish = findDishById(category, id);
                if (!dish) return;
                const costPerHead = getDishCost(dish);
                rows.push({
                    id,
                    category,
                    name: dish.name,
                    costPerHead,
                    total: costPerHead * (pax || 0),
                });
            });
        });
        return rows;
    };

    const getPackageBaseTotal = (extra = {}) => {
        const pricingType = extra.package_pricing_type ?? bookingData.package_pricing_type;
        const flatPrice = extra.package_flat_price ?? bookingData.package_flat_price;
        const basePrice = extra.package_base_price ?? bookingData.package_base_price;
        if (pricingType === 'flat') return flatPrice || 0;
        return (basePrice || 0) * (pax || 0);
    };

    const getExtraSelectionFee = (nextSelections = selections, allowances = bookingData.package_allowances || CATEGORY_LIMITS) => {
        if (!hasPackagePricing) return 0;
        return getExtraSelectionRows(nextSelections, allowances).reduce((sum, row) => sum + row.total, 0);
    };

    const getSelectionTotal = (nextSelections, extra = {}) => {
        if (extra.package_pricing_type || extra.package_base_price || extra.package_flat_price || hasPackagePricing) {
            const allowances = extra.package_allowances || bookingData.package_allowances || CATEGORY_LIMITS;
            return getPackageBaseTotal(extra) + getExtraSelectionRows(nextSelections, allowances).reduce((sum, row) => sum + row.total, 0);
        }

        let total = 0;
        Object.keys(nextSelections).forEach(category => {
            nextSelections[category].forEach(id => {
                const dish = findDishById(category, id);
                if (dish) total += getDishCost(dish) * (pax || 0);
            });
        });
        return total;
    };

    const advanceFromPackageChoice = (nextSelections, extra = {}) => {
        updateBooking({
            selectedDishes: nextSelections,
            totalCost: getSelectionTotal(nextSelections, extra),
            menuExtraFee: (extra.package_pricing_type || extra.package_base_price || extra.package_flat_price) ? getExtraSelectionRows(nextSelections, extra.package_allowances).reduce((sum, row) => sum + row.total, 0) : 0,
            ...extra,
        });

        if (mode === 'packages') {
            onNext(true);
            return;
        }

        setPhase('menu');
    };

    const findDishById = (category, id) => {
        return (mergedDishes[category] || []).find(dish => String(dish.id) === String(id));
    };

    // Get effective cost per head for a dish
    function getDishCost(dish) {
        if (!dish) return 0;
        const overrideId = `dish_${dish.id}`;
        if (pricingOverrides[overrideId] !== undefined) {
            return pricingOverrides[overrideId];
        }
        return dish.costPerHead;
    }

    // Calculate total from selections
    const menuTotal = useMemo(() => {
        if (hasPackagePricing) {
            return getPackageBaseTotal() + getExtraSelectionFee(selections);
        }

        let total = 0;
        Object.keys(selections).forEach(category => {
            selections[category].forEach(id => {
                const dish = findDishById(category, id);
                if (dish) total += getDishCost(dish) * (pax || 0);
            });
        });
        return total;
    }, [selections, pax, pricingOverrides, bookingData.package_base_price, bookingData.package_flat_price, bookingData.package_pricing_type, bookingData.package_allowances]);

    // Update parent whenever selections change
    useEffect(() => {
        if (phase === 'menu') {
            updateBooking({
                selectedDishes: selections,
                totalCost: menuTotal,
                menuExtraFee: hasPackagePricing ? getExtraSelectionFee(selections) : 0
            });
        }
    }, [selections, menuTotal, phase]);

    // Toggle a dish selection (with category limit enforcement)
    const toggleDish = (category, dishId) => {
        setSelections(prev => {
            const currentList = prev[category];
            if (currentList.includes(dishId)) {
                return { ...prev, [category]: currentList.filter(id => id !== dishId) };
            } else {
                // Check limit
                const limit = CATEGORY_LIMITS[category] || 5;
                if (currentList.length >= limit) {
                    return prev; // Don't add — limit reached
                }
                return { ...prev, [category]: [...currentList, dishId] };
            }
        });
    };

    // Budget builder: secure one dish from every category first, then add extras if the budget allows.
    const applyBudgetMaximizer = () => {
        if (!isBudgetReady || budgetMissingCategory) return;
        const totalBudget = parseInt(budget);
        const newSelections = { starter: [], main: [], side: [], dessert: [], drink: [] };
        let runningTotal = 0;

        const categories = ['starter', 'main', 'side', 'dessert', 'drink'];

        // Build sorted dish lists per category.
        const categoryQueues = {};
        categories.forEach(cat => {
            categoryQueues[cat] = [...(mergedDishes[cat] || [])]
                .map(dish => ({
                    ...dish,
                    category: cat,
                    totalCost: Number(getDishCost(dish) || 0) * Number(pax || 0)
                }))
                .filter(dish => dish.totalCost > 0)
                .sort((a, b) => a.totalCost - b.totalCost);
        });

        // First pass: guarantee a complete menu by selecting the lowest-priced dish in every category.
        for (const cat of categories) {
            const cheapest = categoryQueues[cat]?.[0];
            if (!cheapest || runningTotal + cheapest.totalCost > totalBudget) {
                return;
            }

            newSelections[cat].push(cheapest.id);
            runningTotal += cheapest.totalCost;
        }

        // Second pass: with a complete menu secured, add the best remaining choices that still fit.
        const remainingQueues = {};
        categories.forEach(cat => {
            remainingQueues[cat] = [...categoryQueues[cat]]
                .filter(dish => !newSelections[cat].includes(dish.id))
                .sort((a, b) => b.totalCost - a.totalCost);
        });

        let changed = true;
        while (changed) {
            changed = false;
            for (const cat of categories) {
                const limit = CATEGORY_LIMITS[cat] || 5;
                if (newSelections[cat].length >= limit) continue; // Category full

                const queue = remainingQueues[cat] || [];
                for (let i = 0; i < queue.length; i++) {
                    const dish = queue[i];
                    if (newSelections[cat].includes(dish.id)) continue; // Already selected
                    if (runningTotal + dish.totalCost <= totalBudget) {
                        newSelections[cat].push(dish.id);
                        runningTotal += dish.totalCost;
                        changed = true;
                        break;
                    }
                }
            }
        }

        setSelections(newSelections);
        advanceFromPackageChoice(newSelections, {
            ...packageContextFields,
            budget: parseInt(budget) || 0,
            package_id: 'budget-guided',
            package_base_price: null,
            package_flat_price: null,
            package_pricing_type: null,
            package_name: 'Smart Budget Menu',
            packageChoiceStage: 'path',
        });
    };

    // Apply a curated package — map DB menu_structure (plural keys) to singular keys
    const applyCuratedPackage = (pkg) => {
        if (pkg.addOnOnly) return;
        // The package doesn't have prefilledDishes, it has menu_structure with counts
        // We auto-select the cheapest dishes up to the count for each category
        const menuStructure = pkg.structure || {};
        const newSelections = { starter: [], main: [], side: [], dessert: [], drink: [] };
        
        Object.entries(menuStructure).forEach(([category, count]) => {
            const available = mergedDishes[category] || [];
            // Sort by cost and pick the cheapest ones
            const sorted = [...available].sort((a, b) => getDishCost(a) - getDishCost(b));
            newSelections[category] = sorted.slice(0, count).map(d => d.id);
        });
        
        setSelections(newSelections);
        const record = pkg.packageRecord || {};
        const securityType = record.security_type || packageContextFields.package_security_type;
        advanceFromPackageChoice(newSelections, {
            package_id: String(pkg.id || pkg.code),
            ...packageContextFields,
            package_category: record.package_category || packageContextFields.package_category,
            package_amenities: record.amenities?.length ? record.amenities : packageContextFields.package_amenities,
            package_terms: record.applicable_setups?.length ? [...GLOBAL_PAYMENT_TERMS, ...record.applicable_setups, record.security_label || packageContextFields.package_security_label] : packageContextFields.package_terms,
            package_security_type: securityType,
            package_security_label: record.security_label || packageContextFields.package_security_label,
            package_security_description: record.security_description || packageContextFields.package_security_description,
            package_security_rate: securityType === 'contingency' ? 0.10 : 0,
            package_cash_bond: securityType === 'cash_bond' ? 1500 : 0,
            package_pricing_type: pkg.pricingType,
            package_base_price: pkg.pricingType === 'per_head' ? pkg.basePrice : null,
            package_flat_price: pkg.pricingType === 'flat' ? pkg.flatPrice : null,
            package_guest_count: pax || null,
            package_minimum_pax: null,
            package_name: pkg.name,
            package_tier_code: pkg.code,
            package_allowances: menuStructure,
            packageChoiceStage: 'curated',
        });
    };

    // Apply blank canvas
    const applyBlankCanvas = () => {
        setSelections({ starter: [], main: [], side: [], dessert: [], drink: [] });
        advanceFromPackageChoice({ starter: [], main: [], side: [], dessert: [], drink: [] }, {
            ...packageContextFields,
            package_id: 'custom',
            package_base_price: null,
            package_flat_price: null,
            package_pricing_type: null,
            package_name: 'Blank Canvas Menu',
            packageChoiceStage: 'path',
        });
    };

    const handleConfirmMenu = () => {
        const totalDishes = Object.values(selections).reduce((sum, arr) => sum + arr.length, 0);
        if (totalDishes === 0) return;
        const missingCategory = CATEGORY_TABS.find(tab => (selections[tab.key] || []).length === 0);
        if (missingCategory) {
            setActiveTab(missingCategory.key);
            return;
        }

        // Build full menu selection with dish objects for submission, including any pricing overrides
        const fullMenuSelection = {};
        const sanitizedSelections = {};
        Object.keys(selections).forEach(cat => {
            sanitizedSelections[cat] = [];
            const validCategoryIds = (selections[cat] || []).filter(id => Boolean(findDishById(cat, id)));
            sanitizedSelections[cat] = validCategoryIds;
            fullMenuSelection[cat] = validCategoryIds.map(id => {
                const dish = findDishById(cat, id);
                const categoryIds = validCategoryIds;
                const includedLimit = bookingData.package_allowances?.[cat] ?? CATEGORY_LIMITS[cat] ?? 0;
                const selectionIndex = categoryIds.indexOf(id);
                const isExtraSelection = hasPackagePricing && selectionIndex >= includedLimit;
                return {
                    ...dish,
                    costPerHead: getDishCost(dish),
                    priceAdj: getDishCost(dish),
                    includedInPackage: hasPackagePricing && !isExtraSelection,
                    isExtraSelection,
                };
            });
        });

        updateBooking({
            selectedDishes: sanitizedSelections,
            customMenu: fullMenuSelection,
            totalCost: menuTotal,
            menuExtraFee: hasPackagePricing ? getExtraSelectionFee(selections) : 0,
            budget: budget ? parseInt(budget) : 0
        });
        onNext(true);
    };

    const clearAllSelections = () => {
        const emptySelections = { starter: [], main: [], side: [], dessert: [], drink: [] };
        setSelections(emptySelections);
        setMenuFilter('all');
        setMenuSearch('');
        setMenuPage(1);
        updateBooking({
            selectedDishes: emptySelections,
            customMenu: {},
            totalCost: hasPackagePricing ? getPackageBaseTotal() : 0,
            menuExtraFee: 0,
        });
    };

    const totalDishCount = Object.values(selections).reduce((sum, arr) => sum + arr.length, 0);
    const missingCategories = CATEGORY_TABS.filter(tab => (selections[tab.key] || []).length === 0);
    const allCategoriesFilled = missingCategories.length === 0;
    const activeCategoryIndex = CATEGORY_TABS.findIndex(tab => tab.key === activeTab);
    const activeCategory = CATEGORY_TABS[activeCategoryIndex] || CATEGORY_TABS[0];
    const isFirstCategory = activeCategoryIndex <= 0;
    const isLastCategory = activeCategoryIndex === CATEGORY_TABS.length - 1;
    const activeCategoryCount = selections[activeTab]?.length || 0;
    const activeCategoryAllowance = bookingData.package_allowances?.[activeTab] ?? null;
    const activeCategoryExtraCount = activeCategoryAllowance ? Math.max(0, activeCategoryCount - activeCategoryAllowance) : 0;
    const isGuidedMenu = bookingData.package_id === 'custom';
    const isCuratedSelection = bookingData.package_id && !['custom', 'budget-guided'].includes(String(bookingData.package_id));
    const canAdvanceMenu = !isMenuCatalogLoading && !menuCatalogError && (isGuidedMenu ? (!isLastCategory || allCategoriesFilled) : allCategoriesFilled);
    const hasAnySelection = totalDishCount > 0;
    const showMenuGuide = isGuidedMenu || hasPackagePricing;
    const goToPreviousCategory = () => {
        if (!isGuidedMenu || isFirstCategory) {
            updateBooking({ packageChoiceStage: isCuratedSelection ? 'curated' : 'path' });
            onBack();
            return;
        }
        setActiveTab(CATEGORY_TABS[activeCategoryIndex - 1].key);
    };
    const goToNextCategory = () => {
        if (!isGuidedMenu || isLastCategory) {
            handleConfirmMenu();
            return;
        }
        setActiveTab(CATEGORY_TABS[activeCategoryIndex + 1].key);
    };
    useEffect(() => {
        setMenuPage(1);
    }, [activeTab, menuSearch, menuFilter, menuSort]);

    const activeDishes = useMemo(() => {
        const normalizedSearch = menuSearch.trim().toLowerCase();
        return [...(mergedDishes[activeTab] || [])]
            .filter(dish => {
                const isSelected = selections[activeTab]?.includes(dish.id);
                if (menuFilter === 'selected' && !isSelected) return false;
                if (menuFilter === 'best' && !dish.isBestSeller) return false;
                if (normalizedSearch) {
                    const searchableText = `${dish.name || ''} ${dish.description || ''}`.toLowerCase();
                    if (!searchableText.includes(normalizedSearch)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const aSelected = selections[activeTab]?.includes(a.id);
                const bSelected = selections[activeTab]?.includes(b.id);
                if (menuSort === 'price-low') return getDishCost(a) - getDishCost(b);
                if (menuSort === 'price-high') return getDishCost(b) - getDishCost(a);
                if (menuSort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
                if (aSelected !== bSelected) return aSelected ? -1 : 1;
                if (a.isBestSeller !== b.isBestSeller) return b.isBestSeller ? 1 : -1;
                return getDishCost(a) - getDishCost(b);
            });
    }, [mergedDishes, activeTab, menuSearch, menuFilter, menuSort, selections, pricingOverrides]);

    const totalMenuPages = Math.max(1, Math.ceil(activeDishes.length / dishesPerPage));
    const currentMenuPage = Math.min(menuPage, totalMenuPages);
    const pagedDishes = activeDishes.slice((currentMenuPage - 1) * dishesPerPage, currentMenuPage * dishesPerPage);
    const activeSourceDishes = mergedDishes[activeTab] || [];
    const hasActiveSourceDishes = activeSourceDishes.length > 0;
    const menuEmptyTitle = hasActiveSourceDishes ? 'No dishes match these filters.' : 'No active dishes are available yet.';
    const menuEmptyCopy = hasActiveSourceDishes
        ? 'Try a different search, filter, or category.'
        : 'This category has loaded, but no published dishes are available right now.';
    const packageSubSteps = phase === 'curated'
        ? ['Choose method', 'Select package']
        : ['Choose method'];
    const currentPackageSubStep = phase === 'curated' ? 1 : 0;
    const MiniStepProgress = ({ steps, activeIndex }) => (
        <div className="booking-mini-progress" aria-label="Current step progress">
            {steps.map((step, index) => (
                <span
                    key={step}
                    className={index < activeIndex ? 'done' : index === activeIndex ? 'active' : ''}
                >
                    {step}
                </span>
            ))}
        </div>
    );

    // ==========================================
    // PHASE: BUDGET ENTRY
    // ==========================================
    if (phase === 'budget') {
        return (
            <div className="flex flex-col h-full justify-between animate-fadeIn">
                <div className="space-y-8">
                    <div className="max-w-lg mx-auto space-y-6 mt-4">
                        <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                                Target Budget (PHP)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">₱</span>
                                <input
                                    type="number"
                                    min={budgetMinimum || 0}
                                    step="1000"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    placeholder={budgetMinimum ? `Minimum ${money(budgetMinimum)}` : 'Loading menu prices'}
                                    className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm text-gray-900 font-bold text-xl"
                                />
                            </div>
                            {budget && pax && (
                                <p className="text-sm text-primary-600 mt-3 font-medium text-center">
                                    ≈ ₱{Math.round(parseInt(budget) / pax).toLocaleString()} per head for {pax} guests
                                </p>
                            )}
                        </div>

                        <div className={`rounded-xl border px-3 py-2 text-xs font-bold leading-relaxed ${isBudgetReady ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                            {budgetStatusMessage}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={applyBudgetMaximizer}
                                disabled={!isBudgetReady || Boolean(budgetMissingCategory) || isMenuCatalogLoading || menuCatalogError}
                                className={`flex-1 py-4 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 flex items-center justify-center ${isBudgetReady && !budgetMissingCategory
                                    ? 'bg-red-900 text-white hover:bg-red-800 hover:shadow-xl'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                Build My Menu
                                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setPhase('path')}
                                className="px-8 py-4 rounded-xl font-bold text-gray-500 border-2 border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-all"
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-start pt-12 items-center border-t border-gray-100 mt-8">
                    <button
                        onClick={() => {
                            updateBooking({ selectedDishes: { starter: [], main: [], side: [], dessert: [], drink: [] }, customMenu: {}, totalCost: 0 });
                            onBack();
                        }}
                        className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================
    // PHASE: PATH SELECTION
    // ==========================================
    if (phase === 'path') {
        return (
            <div className="flex flex-col h-full justify-between animate-fadeIn">
                <div className="space-y-8">
                    <div className="text-center mb-2">
                        <h3 className="text-2xl font-black text-gray-950">How would you like to build your menu?</h3>
                        <p className="mt-2 text-sm font-semibold text-gray-500">Choose a starting point. You can review and adjust dishes before continuing.</p>
                    </div>
                    <MiniStepProgress steps={packageSubSteps} activeIndex={currentPackageSubStep} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto booking-menu-path">
                        {/* Budget Maximizer - only when budget is entered */}
                        <>
                            <div className="booking-choice-card booking-choice-card-budget group text-left p-8 rounded-2xl border-2 border-green-100 bg-white transition-all duration-300 relative overflow-hidden">
                                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-5 text-green-600 group-hover:bg-green-200 transition-colors">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Build Around a Budget</h3>
                                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                    The system will choose dishes that fit within your <strong className="text-green-700">₱{parseInt(budget || 0).toLocaleString()}</strong> target. You can still review and adjust the result.
                                </p>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Target budget</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    placeholder={budgetMinimum ? `Minimum ${money(budgetMinimum)}` : 'Loading menu prices'}
                                    className="mb-5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-red-900 focus:ring-4 focus:ring-red-900/10"
                                />
                                <div className={`mb-5 rounded-xl border px-3 py-2 text-xs font-bold leading-relaxed ${isBudgetReady ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                    {budgetStatusMessage}
                                </div>
                                <ul className="space-y-2 text-xs text-gray-500 mb-5">
                                    <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Auto-selects dishes to fit your budget</li>
                                    <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Evenly spreads across all categories</li>
                                    <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>You can still add, remove, or swap dishes after</li>
                                </ul>
                                <button
                                    type="button"
                                    onClick={applyBudgetMaximizer}
                                    disabled={!isBudgetReady || Boolean(budgetMissingCategory) || isMenuCatalogLoading || menuCatalogError}
                                    className="text-green-600 font-bold text-sm flex items-center group-hover:translate-x-1 transition-transform disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Build from budget
                                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </button>
                            </div>
                        </>

                        {/* Curated Packages */}
                        <button
                            onClick={() => {
                                updateBooking({ packageChoiceStage: 'curated' });
                                setPhase('curated');
                            }}
                            className="booking-choice-card booking-choice-card-package group text-left p-8 rounded-2xl border-2 border-primary-100 bg-white transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-5 text-primary-600 group-hover:bg-primary-100 transition-colors">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Curated Packages</h3>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                Browse pre-designed packages — <strong>Economy</strong>, <strong>Standard</strong>, or <strong>Premium</strong> — each with a balanced set of dishes already picked for you.
                            </p>
                            <ul className="space-y-2 text-xs text-gray-500 mb-5">
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Event-specific amenities and security terms</li>
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Flexible pricing based on your pax</li>
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Modify any dish after selecting a package</li>
                            </ul>
                            <div className="text-primary-600 font-bold text-sm flex items-center group-hover:translate-x-1 transition-transform">
                                Browse packages
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </div>
                        </button>

                        {/* Blank Canvas */}
                        <button
                            onClick={applyBlankCanvas}
                            className="booking-choice-card booking-choice-card-custom group text-left p-8 rounded-2xl border-2 border-gray-100 bg-white transition-all duration-300"
                        >
                            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-5 text-gray-500 group-hover:bg-gray-100 transition-colors">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Blank Canvas</h3>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                Start from an empty selection and choose each dish yourself, category by category.
                            </p>
                            <ul className="space-y-2 text-xs text-gray-500 mb-5">
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Browse every dish in our catalog</li>
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Full control over every category</li>
                                <li className="flex items-center"><svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Uses the same event amenities and terms</li>
                            </ul>
                            <div className="text-gray-600 font-bold text-sm flex items-center group-hover:translate-x-1 transition-transform">
                                Start choosing dishes
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="flex justify-start pt-12 items-center border-t border-gray-100 mt-8">
                    <button
                        onClick={onBack}
                        className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'curated') {
        return (
            <div className="booking-package-flow animate-fadeIn">
                <div className="booking-curated-heading">
                    <p className="booking-step-kicker">{packageCategory.eyebrow}</p>
                    <h3>Choose a package.</h3>
                    <p>Pick the package that best matches your budget and menu size. You can still adjust dishes after this.</p>
                </div>

                <MiniStepProgress steps={packageSubSteps} activeIndex={currentPackageSubStep} />

                <div className="booking-package-layout booking-package-layout-simple">
                    <div className="booking-menu-path booking-curated-grid booking-curated-grid-simple">
                        {packagesLoading || !packagesLoaded ? (
                            <BookingPackageSkeleton rows={3} />
                        ) : packageCards.length === 0 ? (
                            <div className="booking-menu-empty md:col-span-3">
                                <strong>{packagesError ? 'Packages could not be loaded.' : 'No packages available yet.'}</strong>
                                <span>{packagesError ? 'You can still go back and build a custom menu.' : 'Try another event type or build a custom menu instead.'}</span>
                            </div>
                        ) : packageCards.map((pkg, index) => {
                            const menuStructure = pkg.structure || {};
                            const totalDishes = Object.values(menuStructure).reduce((sum, count) => sum + count, 0);
                            const baseTotal = pkg.pricingType === 'addon' ? pkg.addOnPrice : pkg.pricingType === 'flat' ? pkg.flatPrice : (pkg.basePrice * (pax || 0));
                            const priceLabel = pkg.pricingType === 'addon' ? 'Additional package' : pkg.pricingType === 'flat' ? `${money(pkg.flatPrice)} flat` : `${money(pkg.basePrice)}/head`;
                            const highlights = pkg.highlights?.slice(0, 2) || [];

                            return (
                                <div
                                    key={pkg.code}
                                    className={`booking-choice-card booking-curated-card booking-curated-card-simple booking-tier-card-${index} text-left rounded-2xl bg-white transition-all duration-300`}
                                >
                                    <div className="booking-curated-content flex-1 flex flex-col">
                                        <p className="booking-curated-code">{pkg.code}</p>
                                        <h3>{pkg.name}</h3>
                                        <p className="booking-curated-description">{pkg.description}</p>
                                        <div className="booking-curated-price-row">
                                            <strong>{priceLabel}</strong>
                                            {pkg.pricingType !== 'addon' && <span>{totalDishes} dishes</span>}
                                        </div>
                                        {highlights.length > 0 && (
                                            <ul className="booking-curated-highlights">
                                                {highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                                            </ul>
                                        )}
                                        <div className="mt-auto">
                                            <p className="booking-curated-total">Estimate for {pax} guests: <strong>{money(baseTotal)}</strong></p>
                                            <button
                                                onClick={() => applyCuratedPackage(pkg)}
                                                disabled={pkg.pricingType === 'addon'}
                                                className="booking-curated-select"
                                            >
                                                {pkg.pricingType === 'addon' ? 'Available for 150+ guests' : `Select ${pkg.name}`}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-start pt-8 items-center border-t border-gray-100 mt-8">
                    <button
                        onClick={() => {
                            updateBooking({ packageChoiceStage: 'path' });
                            setPhase('path');
                        }}
                        className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================
    // PHASE: CURATED PACKAGES
    // ==========================================
    if (phase === 'curated') {
        return (
            <div className="flex flex-col h-full justify-between animate-fadeIn">
                <div className="space-y-8">
                    <div className="booking-menu-path booking-curated-grid grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-4">
                        {packageCards.map((pkg, index) => {
                            // Calculate price per head for this package using menu_structure
                            const menuStructure = pkg.structure || {};
                            let pkgTotal = 0;
                            let totalDishes = 0;
                            
                            Object.entries(menuStructure).forEach(([category, count]) => {
                                const available = mergedDishes[category] || [];
                                const sorted = [...available].sort((a, b) => getDishCost(a) - getDishCost(b));
                                const selected = sorted.slice(0, count);
                                selected.forEach(d => { pkgTotal += getDishCost(d); });
                                totalDishes += count;
                            });

                            // Use base_price_per_head from DB if available
                            const displayPrice = pkg.basePrice || pkgTotal;

                            return (
                                <div
                                    key={pkg.id}
                                    className={`booking-choice-card booking-curated-card booking-tier-card-${index} text-left p-8 rounded-2xl border-2 bg-white transition-all duration-300 relative overflow-hidden`}
                                >
                                    <div className="booking-curated-content flex-1 flex flex-col">
                                        <p className="text-xs font-black uppercase tracking-widest text-primary-700 mb-2">{pkg.code}</p>
                                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{pkg.name}</h3>
                                        <p className="text-gray-500 text-sm mb-4">{pkg.description}</p>
                                        <p className="text-primary-600 font-bold text-lg mb-1">₱{displayPrice.toLocaleString()}/head</p>
                                        <p className="text-xs text-gray-400 mb-2">{totalDishes} included choices</p>
                                        <div className="booking-package-breakdown">
                                            {CATEGORY_TABS.map(tab => (
                                                <span key={tab.key}>
                                                    <strong>{menuStructure[tab.key] || 0}</strong> {CATEGORY_LABELS[tab.key]}
                                                </span>
                                            ))}
                                        </div>
                                        {pkg.inclusions && pkg.inclusions.length > 0 && (
                                            <ul className="text-xs text-gray-500 mb-4 space-y-1">
                                                {pkg.inclusions.slice(0, 3).map((inc, i) => (
                                                    <li key={i} className="flex items-center">
                                                        <svg className="w-3.5 h-3.5 mr-1.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        {inc}
                                                    </li>
                                                ))}
                                                {pkg.inclusions.length > 3 && (
                                                    <li className="text-gray-400 italic">+{pkg.inclusions.length - 3} more</li>
                                                )}
                                            </ul>
                                        )}
                                        <div className="mt-auto">
                                            <div className="text-sm text-gray-500 mb-4">
                                                <p className="text-xs">Total: ₱{(displayPrice * pax).toLocaleString()} for {pax} guests</p>
                                            </div>
                                            <button
                                                onClick={() => applyCuratedPackage(pkg)}
                                                className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all transform active:scale-95 bg-gray-900 text-white hover:bg-red-900"
                                            >
                                                Select {pkg.name}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-start pt-12 items-center border-t border-gray-100 mt-8">
                    <button
                        onClick={() => {
                            updateBooking({ packageChoiceStage: 'path' });
                            setPhase('path');
                        }}
                        className="text-gray-500 font-bold hover:text-gray-800 px-6 py-3 transition-colors flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================
    // PHASE: TABULAR MENU BUILDER
    // ==========================================
    return (
        <div className="flex flex-col h-full animate-fadeIn">
            {/* Image Lightbox */}
            {lightboxDish && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={() => setLightboxDish(null)}>
                    <div className="relative max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()} style={{animation:'imgZoomIn .3s cubic-bezier(0.22,1,0.36,1) both'}}>
                        <button
                            onClick={() => setLightboxDish(null)}
                            className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors z-10"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <SmartImage
                            src={lightboxDish.image}
                            alt={lightboxDish.name}
                            loading="eager"
                            aspectRatio="16 / 10"
                            containerClassName="rounded-2xl shadow-2xl max-h-[70vh]"
                            className="max-h-[70vh]"
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl">
                            {lightboxDish.isBestSeller && (
                                <span className="bg-yellow-500 text-red-900 text-xs font-bold px-2 py-1 rounded-full mb-2 inline-block">Best Seller</span>
                            )}
                            <h3 className="text-white font-bold text-2xl">{lightboxDish.name}</h3>
                            <p className="text-gray-200 text-sm mt-1">{lightboxDish.description}</p>
                            <p className="text-yellow-300 text-lg font-bold mt-2">{money(getDishCost(lightboxDish))}/head</p>
                        </div>
                    </div>
                </div>
            )}
            {showMenuGuide && (
                <div className="booking-menu-guide">
                    <div>
                        <p className="booking-step-kicker">Menu category {activeCategoryIndex + 1} of {CATEGORY_TABS.length}</p>
                        <h3>{activeCategory.label}</h3>
                        {activeCategoryAllowance ? (
                            <p>{activeCategoryAllowance} included in this package. Extra selections in this category add a per-guest fee.</p>
                        ) : (
                            <p>Pick at least one item in every category. You can move through each category and still return to adjust anything.</p>
                        )}
                    </div>
                    <strong>
                        {activeCategoryAllowance ? `${activeCategoryCount}/${activeCategoryAllowance} included` : `${activeCategoryCount} selected`}
                        {activeCategoryExtraCount > 0 && <span className="booking-overage-note"> +{activeCategoryExtraCount} extra</span>}
                    </strong>
                </div>
            )}

            {/* Category Tabs */}
            <div className="booking-category-tabs">
                {CATEGORY_TABS.map(tab => {
                    const count = selections[tab.key]?.length || 0;
                    const allowance = bookingData.package_allowances?.[tab.key] ?? null;
                    const extraCount = allowance ? Math.max(0, count - allowance) : 0;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`booking-category-tab ${isActive
                                ? 'active'
                                : ''
                                }`}
                        >
                            <span>{tab.label}</span>
                            <strong className={count > 0 ? 'started' : ''}>
                                {allowance ? `${count}/${allowance}` : count > 0 ? `${count} picked` : 'Required'}
                                {extraCount > 0 && <em>+{extraCount}</em>}
                            </strong>
                        </button>
                    );
                })}
            </div>

            <div className="booking-menu-tools">
                <label className="booking-menu-search">
                    <span>Search dishes</span>
                    <input
                        type="search"
                        value={menuSearch}
                        onChange={(event) => setMenuSearch(event.target.value)}
                        placeholder={`Find ${activeCategory.label.toLowerCase()}`}
                    />
                </label>
                <div className="booking-menu-tool-group">
                    <label>
                        <span>Show</span>
                        <select value={menuFilter} onChange={(event) => setMenuFilter(event.target.value)}>
                            <option value="all">All dishes</option>
                            <option value="best">Best sellers</option>
                            <option value="selected">Selected only</option>
                        </select>
                    </label>
                    <label>
                        <span>Sort</span>
                        <select value={menuSort} onChange={(event) => setMenuSort(event.target.value)}>
                            <option value="recommended">Recommended</option>
                            <option value="price-low">Lowest price</option>
                            <option value="price-high">Highest price</option>
                            <option value="name">Name A-Z</option>
                        </select>
                    </label>
                </div>
            </div>

            {/* Dish Grid */}
            <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                {isMenuCatalogLoading ? (
                    <BookingMenuSkeleton rows={6} />
                ) : menuCatalogError ? (
                    <div className="booking-menu-empty">
                        <strong>Menu choices could not be loaded.</strong>
                        <span>Please go back and try this step again in a moment.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pagedDishes.map(dish => {
                            const isSelected = selections[activeTab]?.includes(dish.id);
                            const cost = getDishCost(dish);
                            const categoryCount = selections[activeTab]?.length || 0;
                            const categoryAllowance = bookingData.package_allowances?.[activeTab] ?? null;
                            const isExtraAdd = Boolean(categoryAllowance) && !isSelected && categoryCount >= categoryAllowance;

                            return (
                                <div
                                    key={dish.id}
                                    className={`booking-dish-card relative rounded-xl overflow-hidden transition-all duration-200 ${isSelected
                                        ? 'selected'
                                        : isExtraAdd
                                            ? 'extra'
                                            : ''
                                        }`}
                                >
                                    <div className="flex items-start gap-4 p-4">
                                        <div 
                                            className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 cursor-pointer group/img"
                                            onClick={() => setLightboxDish(dish)}
                                            title="Click to enlarge"
                                        >
                                            <SmartImage
                                                src={dish.image}
                                                alt={dish.name}
                                                aspectRatio="1 / 1"
                                                containerClassName="h-full"
                                                className="transition-transform duration-300 group-hover/img:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all duration-300 flex items-center justify-center">
                                                <svg className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                            </div>
                                            {dish.isBestSeller && (
                                                <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center">
                                                    <svg className="w-2.5 h-2.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                </div>
                                            )}
                                        </div>

                                        <div className="booking-dish-copy flex-1 min-w-0">
                                            <h5 className={`font-bold text-sm mb-0.5 ${isSelected ? 'text-primary-900' : 'text-gray-900'}`}>
                                                {dish.name}
                                            </h5>
                                            <p className="booking-dish-description text-xs text-gray-400 mb-2">{dish.description || 'A menu option prepared for your selected event package.'}</p>
                                            <div className="booking-dish-price-row flex items-baseline justify-between gap-2">
                                                <span>{money(cost)} <small>per head</small></span>
                                                {pax > 0 && (
                                                    <strong>{money(cost * pax)} for {pax} guests</strong>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => toggleDish(activeTab, dish.id)}
                                            className={`booking-dish-action ${isSelected ? 'remove' : isExtraAdd ? 'extra' : 'add'}`}
                                        >
                                            {isSelected ? 'Remove' : isExtraAdd ? `Add +${money(cost)}/head` : 'Add'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {!isMenuCatalogLoading && !menuCatalogError && pagedDishes.length === 0 && (
                    <div className="booking-menu-empty">
                        <strong>{menuEmptyTitle}</strong>
                        <span>{menuEmptyCopy}</span>
                    </div>
                )}
            </div>

            <div className="booking-menu-pagination">
                {isMenuCatalogLoading ? (
                    <span>Loading menu choices...</span>
                ) : menuCatalogError ? (
                    <span>Menu choices unavailable</span>
                ) : (
                    <span>
                        Showing {activeDishes.length === 0 ? 0 : ((currentMenuPage - 1) * dishesPerPage) + 1}
                        -{Math.min(currentMenuPage * dishesPerPage, activeDishes.length)} of {activeDishes.length}
                    </span>
                )}
                <div>
                    <button type="button" onClick={() => setMenuPage(page => Math.max(1, page - 1))} disabled={isMenuCatalogLoading || currentMenuPage <= 1}>
                        Previous
                    </button>
                    <strong>{isMenuCatalogLoading ? 'Loading...' : `Page ${currentMenuPage} of ${totalMenuPages}`}</strong>
                    <button type="button" onClick={() => setMenuPage(page => Math.min(totalMenuPages, page + 1))} disabled={isMenuCatalogLoading || currentMenuPage >= totalMenuPages}>
                        Next
                    </button>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex justify-between pt-8 items-center border-t border-gray-100 mt-8">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={goToPreviousCategory}
                        className="text-gray-500 font-medium hover:text-gray-800 px-4 py-3 transition-colors flex items-center text-sm"
                    >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        {isGuidedMenu && !isFirstCategory ? 'Previous category' : 'Back to packages'}
                    </button>
                    <button
                        type="button"
                        onClick={clearAllSelections}
                        disabled={!hasAnySelection}
                        className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-300"
                    >
                        Clear all
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Menu Total</p>
                        {isMenuCatalogLoading ? (
                            <p className="booking-menu-required-note">
                                Checking available dishes...
                            </p>
                        ) : !allCategoriesFilled && (
                            <p className="booking-menu-required-note">
                                Missing {missingCategories.map(tab => tab.label).join(', ')}
                            </p>
                        )}
                        <p className="text-xl font-bold text-gray-900">{isMenuCatalogLoading ? 'Loading...' : money(menuTotal)}</p>
                    </div>
                    <button
                        onClick={goToNextCategory}
                        disabled={!canAdvanceMenu}
                        className={`px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 flex items-center text-sm ${canAdvanceMenu
                            ? 'bg-red-900 text-white hover:bg-red-800 hover:shadow-xl'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isGuidedMenu && !isLastCategory ? 'Next category' : 'Confirm Menu'}
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MenuBuilder;
