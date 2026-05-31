import { useState, useMemo, useEffect, useRef } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';
import { useToast } from '../../context/ToastContext';
import UserDropdown from '../../Components/common/UserDropdown';
import NotificationBell from '../../Components/common/NotificationBell';
import logoImg from '../../../images/ECS_LOGO.png';
import ClientNavbar from '../../Components/common/ClientNavbar';
import ConfirmModal from '../../Components/common/ConfirmModal';
import SmartImage from '../../Components/common/SmartImage';
import StaffPreviewBanner from '../../Components/common/StaffPreviewBanner';
import RevealOnScroll from '../../Components/common/RevealOnScroll';
import { dashboardHrefForUser, isStaffUser } from '../../utils/dashboardLinks';

const CATEGORY_LIMITS = { starter: 3, main: 4, side: 4, dessert: 4, drink: 3 };
const STORAGE_KEY = 'ecs_booking_draft';

const trackPublicFunnel = (event, payload = {}) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('ecs:funnel', { detail: { event, ...payload } }));
    window.dataLayer?.push({ event: `ecs_${event}`, ...payload });
};

const emptyMenuGroups = { starter: [], main: [], side: [], dessert: [], drink: [] };

const MenuCardSkeleton = ({ count = 6 }) => (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading menu dishes">
        {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="h-48 animate-pulse bg-gradient-to-r from-[#fffaf3] via-white to-[#f1e5dc]" />
                <div className="space-y-3 p-6">
                    <div className="h-3 w-20 animate-pulse rounded-full bg-[#720101]/10" />
                    <div className="h-5 w-3/4 animate-pulse rounded-full bg-gray-100" />
                    <div className="h-3 w-full animate-pulse rounded-full bg-gray-100" />
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-gray-100" />
                    <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                        <div className="h-3 w-24 animate-pulse rounded-full bg-gray-100" />
                        <div className="h-5 w-16 animate-pulse rounded-full bg-[#720101]/10" />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const MenuGallery = () => {
    const { auth } = usePage().props;
    const user = auth?.user || null;
    const toast = useToast();
    const dashboardHref = dashboardHrefForUser(user, '/');
    const [activeCategory, setActiveCategory] = useState('all');
    const [priceFilter, setPriceFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('default');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [pricingOverrides, setPricingOverrides] = useState({});
    const [customItems, setCustomItems] = useState(emptyMenuGroups);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [catalogLoaded, setCatalogLoaded] = useState(false);
    const [catalogError, setCatalogError] = useState(false);
    const [pricingLoading, setPricingLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [hoveredDish, setHoveredDish] = useState(null);
    const [lightboxDish, setLightboxDish] = useState(null);
    const [showPackageDrawer, setShowPackageDrawer] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [exitBuildConfirmOpen, setExitBuildConfirmOpen] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const menuStartRef = useRef(null);
    const ITEMS_PER_PAGE = 9;

    const exitBuildMode = () => {
        setIsSelectionMode(false);
        setExitBuildConfirmOpen(false);
    };

    // Package builder state
    const [packageSelections, setPackageSelections] = useState({
        starter: [], main: [], side: [], dessert: [], drink: []
    });

    // Scroll-to-top listener
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const loadCatalog = () => {
        setCatalogLoading(true);
        setCatalogError(false);
        fetchMenuItemsFromAPI()
            .then(organizedDishes => {
                setCustomItems(organizedDishes || emptyMenuGroups);
                setCatalogLoaded(true);
            })
            .catch(error => {
                console.error('Error loading menu catalog:', error);
                setCustomItems(emptyMenuGroups);
                setCatalogError(true);
                setCatalogLoaded(true);
            })
            .finally(() => setCatalogLoading(false));
    };

    useEffect(() => {
        fetch('/api/pricing')
            .then(res => res.json())
            .then(data => setPricingOverrides(data.overrides || {}))
            .catch(console.error)
            .finally(() => setPricingLoading(false));

        loadCatalog();
    }, []);

    // Menu items organized by category (already structured from API)
    const mergedDishes = customItems;

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Menu', path: '/menu' },
        { name: 'Book Now', path: '/book' },
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
    ];

    const categories = [
        { id: 'all', label: 'All Dishes' },
        { id: 'starter', label: 'Starters' },
        { id: 'main', label: 'Main Courses' },
        { id: 'side', label: 'Sides' },
        { id: 'dessert', label: 'Desserts' },
        { id: 'drink', label: 'Refreshments' },
    ];

    const priceRanges = [
        { id: 'all', label: 'All Prices' },
        { id: 'under50', label: 'Under ₱50', min: 0, max: 49 },
        { id: '50to80', label: '₱50 – ₱80', min: 50, max: 80 },
        { id: '80to120', label: '₱80 – ₱120', min: 80, max: 120 },
        { id: 'above120', label: '₱120+', min: 120, max: Infinity },
    ];

    const sortOptions = [
        { id: 'default', label: 'Default' },
        { id: 'cheapest', label: 'Cheapest First' },
        { id: 'expensive', label: 'Most Expensive First' },
    ];

    // Flatten dishes for "All" view or filter by category
    const displayedDishes = useMemo(() => {
        const getAdjustedDish = (item, cat) => ({
            ...item,
            category: cat,
            costPerHead: pricingOverrides[`dish_${item.id}`] !== undefined ? pricingOverrides[`dish_${item.id}`] : item.costPerHead,
        });

        let dishes;
        if (activeCategory === 'all') {
            dishes = Object.entries(mergedDishes).reduce((acc, [cat, items]) => {
                return [...acc, ...items.map(item => getAdjustedDish(item, cat))];
            }, []);
        } else {
            dishes = (mergedDishes[activeCategory] || []).map(item => getAdjustedDish(item, activeCategory));
        }

        // Apply price filter
        if (priceFilter !== 'all') {
            const range = priceRanges.find(r => r.id === priceFilter);
            if (range) {
                dishes = dishes.filter(d => d.costPerHead >= range.min && d.costPerHead <= range.max);
            }
        }

        // Apply sort
        if (sortOrder === 'cheapest') {
            dishes = [...dishes].sort((a, b) => a.costPerHead - b.costPerHead);
        } else if (sortOrder === 'expensive') {
            dishes = [...dishes].sort((a, b) => b.costPerHead - a.costPerHead);
        }

        // Apply search query
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            dishes = dishes.filter(d => d.name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q)));
        }

        return dishes;
    }, [activeCategory, priceFilter, sortOrder, pricingOverrides, mergedDishes, searchQuery]);

    // Package builder helpers
    const totalPackageDishes = useMemo(() => Object.values(packageSelections).reduce((sum, arr) => sum + arr.length, 0), [packageSelections]);

    const getDishCost = (dish) => {
        const overrideId = `dish_${dish.id}`;
        return pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : dish.costPerHead;
    };

    const togglePackageDish = (category, dishId) => {
        setPackageSelections(prev => {
            const list = prev[category];
            if (list.includes(dishId)) {
                return { ...prev, [category]: list.filter(id => id !== dishId) };
            } else {
                const limit = CATEGORY_LIMITS[category] || 5;
                if (list.length >= limit) {
                    toast.error(`Maximum ${limit} ${category} reached`);
                    return prev;
                }
                return { ...prev, [category]: [...list, dishId] };
            }
        });
    };

    const buildMenuPayload = () => {
        const fullMenuSelection = {};
        const selectedDishesMap = {};
        Object.keys(packageSelections).forEach(cat => {
            fullMenuSelection[cat] = packageSelections[cat].map(id => {
                const dish = mergedDishes[cat].find(d => d.id === id);
                return { ...dish, costPerHead: getDishCost(dish), priceAdj: getDishCost(dish) };
            });
            selectedDishesMap[cat] = [...packageSelections[cat]];
        });
        let totalCost = 0;
        Object.keys(packageSelections).forEach(cat => {
            packageSelections[cat].forEach(id => {
                const dish = mergedDishes[cat]?.find(d => d.id === id);
                if (dish) totalCost += getDishCost(dish) * 20;
            });
        });
        return { fullMenuSelection, selectedDishesMap, totalCost };
    };

    const handleProceedToBooking = () => {
        trackPublicFunnel('menu_to_booking', { selected_dishes: totalPackageDishes });
        // Check for existing booking draft
        try {
            const existing = localStorage.getItem(STORAGE_KEY);
            if (existing) {
                const parsed = JSON.parse(existing);
                // If there is meaningful data beyond defaults (has a date, event type, or is past step 1)
                if (parsed._step > 1 || parsed.date || parsed.eventType) {
                    setShowConflictModal(true);
                    setShowPackageDrawer(false);
                    return;
                }
            }
        } catch(e) {}
        saveAndRedirect('fresh');
    };

    const saveAndRedirect = (mode) => {
        const { fullMenuSelection, selectedDishesMap, totalCost } = buildMenuPayload();

        if (mode === 'menu-only') {
            // Keep existing booking data, only overwrite menu fields
            try {
                const existing = JSON.parse(localStorage.getItem(STORAGE_KEY));
                existing.selectedDishes = selectedDishesMap;
                existing.customMenu = fullMenuSelection;
                existing.totalCost = totalCost;
                existing._customPackageFromMenu = true;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
            } catch(e) {
                // Fallback to fresh if parse fails
                saveAndRedirect('fresh');
                return;
            }
        } else {
            // Fresh booking with custom menu
            const bookingDraft = {
                _step: 1,
                _customPackageFromMenu: true,
                selectedDishes: selectedDishesMap,
                customMenu: fullMenuSelection,
                totalCost,
                pax: 20,
                date: null, time: '', duration: 4, remainingPax: null,
                eventType: '',
                dietaryNotes: '',
                budget: 0,
                client_full_name: '', venue_address_line: '', venue_street: '', venue_city: '', venue_province: '', venue_zip_code: '', client_email: '', client_phone: '', venueDistance: 'metro-manila', isHighRise: false,
                wantsTasting: false, tasting_guest_name: '', tasting_guest_email: '', tasting_guest_phone: '', tasting_preferred_date: '', tasting_preferred_time: '', tasting_notes: ''
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bookingDraft));
        }

        sessionStorage.removeItem('ecs_booking_active');
        setShowConflictModal(false);
        toast.success('Your custom package has been saved! Complete the booking details.');
        router.get('/book');
    };

    // Reset page when filters change
    useEffect(() => { setCurrentPage(1); }, [activeCategory, priceFilter, sortOrder, searchQuery]);

    const scrollToMenuStart = () => {
        const top = Math.max((menuStartRef.current?.getBoundingClientRect().top || 0) + window.scrollY - 84, 0);
        window.scrollTo({ top, behavior: 'smooth' });
    };

    const changePage = (nextPage) => {
        setCurrentPage(Math.min(Math.max(nextPage, 1), totalPages));
        window.requestAnimationFrame(scrollToMenuStart);
    };

    const bestSellers = useMemo(() => {
        return Object.entries(mergedDishes).reduce((acc, [cat, items]) => {
            const sellers = items.filter(d => d.isBestSeller).map(item => ({
                ...item,
                category: cat,
                costPerHead: pricingOverrides[`dish_${item.id}`] !== undefined ? pricingOverrides[`dish_${item.id}`] : item.costPerHead,
            }));
            return [...acc, ...sellers];
        }, []);
    }, [pricingOverrides, mergedDishes]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(displayedDishes.length / ITEMS_PER_PAGE));
    const paginatedDishes = displayedDishes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Get price range for display
    const allPrices = displayedDishes.map(d => d.costPerHead);
    const minPrice = allPrices.length ? Math.min(...allPrices) : null;
    const maxPrice = allPrices.length ? Math.max(...allPrices) : null;
    const sourceDishCount = Object.values(mergedDishes).reduce((sum, items) => sum + (items?.length || 0), 0);
    const isInitialMenuLoading = catalogLoading || pricingLoading;
    const hasLoadedCatalog = catalogLoaded && !catalogLoading;
    const hasSourceDishes = sourceDishCount > 0;

    return (
        <div className={`min-h-screen bg-white ${isStaffUser(user) ? 'pt-[104px]' : 'pt-[68px]'}`}>
            <Head title="Menu Gallery | Eloquente Catering">
                <meta name="description" content="Browse Eloquente Catering dishes, best sellers, price indicators, and build a custom menu package before booking." />
            </Head>
            <ClientNavbar user={user} />
            <StaffPreviewBanner user={user} label="customer-facing menu page" />
            {/* Navbar */}
            <nav className="hidden bg-brand-red shadow-lg py-4 relative z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div className="flex-shrink-0 flex items-center">
                            <Link href="/">
                                <img src={logoImg} alt="Eloquente Catering" className="h-12 w-auto object-contain" />
                            </Link>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-8">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.path}
                                    className="text-white hover:text-yellow-400 font-medium text-sm uppercase tracking-wider transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}

                            <div className="border-l border-white/30 h-6 mx-4"></div>

                            {user ? (
                                <div className="flex items-center gap-2">
                                    <NotificationBell variant="light" />
                                    <UserDropdown 
                                        user={user} 
                                        dashLink={dashboardHref}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center space-x-4">
                                    <Link href="/login" className="text-white hover:text-yellow-400 text-sm font-medium uppercase tracking-wider">
                                        Login
                                    </Link>
                                    <Link
                                        href="/register"
                                        className="bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold py-2 px-6 rounded-full text-xs uppercase tracking-wider transition-transform transform hover:scale-105 shadow-lg"
                                    >
                                        Register
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="text-white hover:text-gray-200 focus:outline-none"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {isMobileMenuOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-red-800 absolute top-full left-0 w-full shadow-xl">
                        <div className="px-4 pt-2 pb-4 space-y-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium"
                                >
                                    {link.name}
                                </Link>
                            ))}
                            {user ? (
                                <>
                                    <Link href={dashboardHref} className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                                        Dashboard
                                    </Link>
                                    <Link href="/profile" className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                                        My Profile
                                    </Link>
                                    <button
                                        onClick={() => { router.post('/logout'); setIsMobileMenuOpen(false); }}
                                        className="w-full text-left text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <div className="mt-4 flex flex-col space-y-2">
                                    <Link href="/login" className="block text-center text-white border border-white/30 px-3 py-2 rounded-md" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
                                    <Link href="/register" className="block text-center bg-yellow-500 text-red-900 px-3 py-2 rounded-md font-bold" onClick={() => setIsMobileMenuOpen(false)}>Register</Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Header */}
            <RevealOnScroll className="bg-red-900 py-16 px-4 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                    Our Curated Menu
                </h1>
                <p className="text-red-100 max-w-2xl mx-auto text-lg font-light">
                    Explore our diverse selection of exquisite dishes, crafted to perfection for your special events.
                </p>
                <p className="text-yellow-400 mt-3 text-sm font-medium">
                    {isInitialMenuLoading
                        ? 'Loading current menu pricing...'
                        : minPrice !== null && maxPrice !== null
                            ? `Price range: ₱${minPrice} – ₱${maxPrice} per head`
                            : 'Menu catalog is being prepared.'}
                </p>
            </RevealOnScroll>

            {/* Create Custom Package CTA Banner */}
            {!isSelectionMode && (
                <RevealOnScroll delay="rv-d1" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
                            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-7 h-7 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Build Your Own Package</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    Hand-pick dishes from our menu to create a personalized package for your event. 
                                    Select from starters, mains, sides, desserts, and drinks — then proceed directly to booking.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    trackPublicFunnel('menu_plan_started');
                                    setIsSelectionMode(true);
                                }}
                                className="flex items-center gap-2 bg-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-red-800 transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-95 whitespace-nowrap"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Start Building
                            </button>
                        </div>
                    </div>
                </RevealOnScroll>
            )}

            {/* Selection Mode: Sticky Category Tracker */}
            {isSelectionMode && (
                <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Building Custom Package</h3>
                                <span className="text-xs text-gray-400 font-medium">{totalPackageDishes} dish{totalPackageDishes !== 1 ? 'es' : ''} selected</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {totalPackageDishes > 0 && (
                                    <button
                                        onClick={() => setShowPackageDrawer(true)}
                                        className="flex items-center gap-1.5 bg-red-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-800 transition-all"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                                        View Package
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (totalPackageDishes > 0) {
                                            setExitBuildConfirmOpen(true);
                                            return;
                                        }
                                        exitBuildMode();
                                    }}
                                    className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-200 transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    Exit Build Mode
                                </button>
                            </div>
                        </div>
                        {/* Category Progress Chips */}
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            {Object.entries(CATEGORY_LIMITS).map(([cat, limit]) => {
                                const count = packageSelections[cat]?.length || 0;
                                const isFull = count >= limit;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                                            activeCategory === cat
                                                ? 'bg-red-900 text-white border-red-900 shadow-md'
                                                : isFull
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span>{cat}</span>
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${
                                            isFull ? 'bg-green-500 text-white' : count > 0 ? 'bg-yellow-400 text-red-900' : 'bg-gray-200 text-gray-500'
                                        }`}>{count}</span>
                                        <span className="text-[10px] opacity-60">/{limit}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div ref={menuStartRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Best Sellers Section - Always visible */}
                {bestSellers.length > 0 && (
                    <RevealOnScroll className="mb-20">
                        <div className="flex items-center mb-8">
                            <span className="w-1 h-8 bg-yellow-500 mr-4"></span>
                            <h2 className="text-2xl font-bold font-display text-gray-900">Best Sellers</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {bestSellers.slice(0, 4).map((dish, index) => (
                                <RevealOnScroll key={dish.id} delay={`rv-d${index + 1}`} className="group relative rounded-xl overflow-hidden shadow-lg aspect-w-1 aspect-h-1">
                                    <SmartImage
                                        src={dish.image}
                                        alt={dish.name}
                                        aspectRatio="1 / 1"
                                        containerClassName="h-64"
                                        className="transform group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90"></div>
                                    <div className="absolute bottom-0 left-0 p-4">
                                        <span className="bg-yellow-500 text-red-900 text-xs font-bold px-2 py-1 rounded-full mb-2 inline-block">Best Seller</span>
                                        <h3 className="text-white font-bold text-lg leading-tight">{dish.name}</h3>
                                        <p className="text-yellow-300 text-sm font-semibold mt-1">₱{dish.costPerHead}/head</p>
                                    </div>
                                </RevealOnScroll>
                            ))}
                        </div>
                    </RevealOnScroll>
                )}

                {/* Category Navigation */}
                <RevealOnScroll className="flex overflow-x-auto pb-4 mb-6 border-b border-gray-100 space-x-2 md:justify-center custom-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeCategory === cat.id
                                ? 'bg-red-900 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </RevealOnScroll>

                {/* Filters & Sort Bar */}
                <RevealOnScroll delay="rv-d1" className="flex flex-col gap-4 mb-8 bg-gray-50 rounded-xl p-4 border border-gray-100">
                    {/* Search Bar */}
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search dishes by name..."
                            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-transparent bg-white transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        {/* Price Range Filter */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                <svg className="w-4 h-4 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                Price:
                            </span>
                            <div className="flex gap-1.5 flex-wrap">
                                {priceRanges.map(range => (
                                    <button
                                        key={range.id}
                                        onClick={() => setPriceFilter(range.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${priceFilter === range.id
                                            ? 'bg-red-900 text-white shadow-sm'
                                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                            }`}
                                    >
                                        {range.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                <svg className="w-4 h-4 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                                Sort:
                            </span>
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 cursor-pointer"
                            >
                                {sortOptions.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </RevealOnScroll>

                {/* Results count */}
                <RevealOnScroll as="p" delay="rv-d2" className="text-sm text-gray-400 mb-6">
                    {isInitialMenuLoading ? (
                        'Loading dishes...'
                    ) : catalogError ? (
                        'Menu catalog could not be loaded.'
                    ) : displayedDishes.length > 0 ? (
                        <>
                            Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, displayedDishes.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, displayedDishes.length)} of {displayedDishes.length} {displayedDishes.length === 1 ? 'dish' : 'dishes'}
                            {searchQuery && ` matching "${searchQuery}"`}
                            {priceFilter !== 'all' && ` in ${priceRanges.find(r => r.id === priceFilter)?.label}`}
                            {sortOrder !== 'default' && ` · Sorted by ${sortOptions.find(s => s.id === sortOrder)?.label.toLowerCase()}`}
                        </>
                    ) : hasLoadedCatalog && hasSourceDishes ? (
                        'No dishes match the current filters.'
                    ) : (
                        'No menu dishes are available yet.'
                    )}
                </RevealOnScroll>

                {/* Main Grid */}
                {isInitialMenuLoading ? (
                    <MenuCardSkeleton count={ITEMS_PER_PAGE} />
                ) : catalogError ? (
                    <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-14 text-center">
                        <h3 className="text-lg font-bold text-red-900 mb-2">Menu is taking longer to load</h3>
                        <p className="mx-auto max-w-md text-sm font-semibold leading-6 text-red-700">We could not reach the menu catalog. Try again so we can show current dishes and prices.</p>
                        <button
                            type="button"
                            onClick={loadCatalog}
                            className="mt-5 rounded-full bg-red-900 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-red-800"
                        >
                            Retry Menu
                        </button>
                    </div>
                ) : paginatedDishes.length > 0 ? (
                    <>
                        <div key={`page-${currentPage}-${activeCategory}-${priceFilter}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {paginatedDishes.map((dish, idx) => (
                                <RevealOnScroll
                                    key={dish.id}
                                    delay={`rv-d${(idx % 4) + 1}`}
                                    className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col group"
                                    style={{ animationDelay: `${idx * 60}ms` }}
                                >
                                    <div
                                        className="relative h-48 overflow-hidden cursor-pointer"
                                        onMouseEnter={() => setHoveredDish(dish.id)}
                                        onMouseLeave={() => setHoveredDish(null)}
                                        onClick={() => setLightboxDish(dish)}
                                    >
                                        <SmartImage
                                            src={dish.image}
                                            alt={dish.name}
                                            aspectRatio="4 / 3"
                                            containerClassName="h-full"
                                            className={`transition-transform duration-500 ${hoveredDish === dish.id ? 'scale-110' : 'scale-100'}`}
                                        />
                                        {/* Hover overlay */}
                                        <div className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity duration-300 ${hoveredDish === dish.id ? 'opacity-100' : 'opacity-0'}`}>
                                            <span className="bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow">
                                                <svg className="w-4 h-4 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                                View
                                            </span>
                                        </div>
                                        {dish.isBestSeller && (
                                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-sm">
                                                <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{dish.category || activeCategory}</span>
                                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-900 transition-colors duration-200">{dish.name}</h3>
                                        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{dish.description}</p>
                                        <div className="mt-auto">
                                            <div className="flex justify-between items-center border-t border-gray-50 pt-4 mb-3">
                                                <span className="text-sm font-medium text-gray-400">Price per head</span>
                                                <span className="font-bold text-red-900 text-lg">₱{dish.costPerHead}</span>
                                            </div>
                                            {/* Package builder button — only in selection mode */}
                                            {isSelectionMode && (() => {
                                                const cat = dish.category || activeCategory;
                                                const inPackage = packageSelections[cat]?.includes(dish.id);
                                                const catCount = packageSelections[cat]?.length || 0;
                                                const catLimit = CATEGORY_LIMITS[cat] || 5;
                                                const isFull = !inPackage && catCount >= catLimit;
                                                return (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); togglePackageDish(cat, dish.id); }}
                                                        disabled={isFull}
                                                        className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all transform active:scale-95 flex items-center justify-center gap-2 ${inPackage
                                                            ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                                            : isFull
                                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                                                : 'bg-red-900 text-white hover:bg-red-800 shadow-sm'
                                                        }`}
                                                    >
                                                        {inPackage ? (
                                                            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Added — Click to Remove</>
                                                        ) : isFull ? (
                                                            <>{cat} limit reached ({catLimit})</>
                                                        ) : (
                                                            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add to Package</>
                                                        )}
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </RevealOnScroll>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center mt-12 gap-2">
                                <button
                                    onClick={() => changePage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                    ← Prev
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => changePage(page)}
                                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${currentPage === page ? 'bg-red-900 text-white shadow-md scale-110' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => changePage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20 animate-fadeIn">
                        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <h3 className="text-lg font-bold text-gray-400 mb-2">{hasSourceDishes ? 'No dishes match these filters' : 'No menu dishes available yet'}</h3>
                        <p className="text-gray-400 text-sm">{hasSourceDishes ? 'Try adjusting your filters to see more dishes.' : 'The menu catalog has loaded, but no active dishes are published right now.'}</p>
                        {hasSourceDishes && (
                            <button
                                onClick={() => { setSearchQuery(''); setPriceFilter('all'); setSortOrder('default'); }}
                                className="mt-4 px-6 py-2 bg-red-900 text-white text-sm font-bold rounded-full hover:bg-red-800 transition-colors"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox Overlay */}
            {lightboxDish && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 lightbox-overlay" onClick={() => setLightboxDish(null)}>
                    <div className="relative max-w-3xl w-full mx-4 lightbox-img" onClick={e => e.stopPropagation()}>
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
                            <p className="text-yellow-300 text-lg font-bold mt-2">₱{lightboxDish.costPerHead}/head</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Package Builder Button — only in selection mode */}
            {isSelectionMode && totalPackageDishes > 0 && (
                <button
                    onClick={() => setShowPackageDrawer(true)}
                    className="fixed bottom-24 right-6 z-50 bg-red-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 hover:bg-red-800 transition-all transform hover:scale-105 active:scale-95"
                    style={{animation:'imgZoomIn .3s ease'}}
                >
                    <div className="relative">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                        <span className="absolute -top-2 -right-2 bg-yellow-400 text-red-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{totalPackageDishes}</span>
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold uppercase tracking-wider opacity-70">My Package</div>
                        <div className="font-bold text-sm">{totalPackageDishes} {totalPackageDishes === 1 ? 'dish' : 'dishes'} selected</div>
                    </div>
                </button>
            )}

            {/* Package Drawer */}
            {showPackageDrawer && (
                <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPackageDrawer(false)}>
                    <div
                        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                        style={{animation:'slideUp .3s ease'}}
                    >
                        <div className="px-6 py-5 sm:rounded-t-2xl rounded-t-2xl flex-shrink-0" style={{background:'linear-gradient(90deg, #7f1d1d, #991b1b)'}}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-lg" style={{color:'#ffffff'}}>My Custom Package</h3>
                                    <p className="text-xs font-semibold mt-0.5" style={{color:'#fde047'}}>{totalPackageDishes} dishes selected</p>
                                </div>
                                <button onClick={() => setShowPackageDrawer(false)} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{background:'rgba(255,255,255,0.2)', color:'#ffffff'}}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {Object.entries(packageSelections).map(([cat, ids]) => {
                                if (ids.length === 0) return null;
                                return (
                                    <div key={cat}>
                                        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                                            {cat} <span className="text-gray-400">({ids.length}/{CATEGORY_LIMITS[cat]})</span>
                                        </h4>
                                        <div className="space-y-2">
                                            {ids.map(id => {
                                                const dish = mergedDishes[cat]?.find(d => d.id === id);
                                                if (!dish) return null;
                                                return (
                                                    <div key={id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                                                        <SmartImage src={dish.image} alt={dish.name} aspectRatio="1 / 1" containerClassName="h-10 w-10 flex-shrink-0 rounded-lg" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{dish.name}</p>
                                                            <p className="text-xs text-gray-400">₱{getDishCost(dish)}/head</p>
                                                        </div>
                                                        <button
                                                            onClick={() => togglePackageDish(cat, id)}
                                                            className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            {totalPackageDishes === 0 && (
                                <p className="text-center text-gray-400 text-sm py-8">No dishes added yet. Browse the menu and add dishes to your package.</p>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 space-y-3">
                            <button
                                onClick={handleProceedToBooking}
                                disabled={totalPackageDishes === 0}
                                className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 ${totalPackageDishes > 0 ? 'bg-red-900 text-white hover:bg-red-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Proceed to Booking
                            </button>
                            <button
                                onClick={() => {
                                    setPackageSelections({ starter: [], main: [], side: [], dessert: [], drink: [] });
                                    setShowPackageDrawer(false);
                                }}
                                className="w-full py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:text-red-900 hover:bg-gray-50 transition-all"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Booking Conflict Modal */}
            {showConflictModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{animation:'overlayIn .25s ease both'}}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" style={{animation:'imgZoomIn .35s cubic-bezier(0.22,1,0.36,1) both'}}>
                        <div className="p-8 text-center" style={{background:'linear-gradient(135deg, #7f1d1d, #991b1b)'}}>
                            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{background:'rgba(234,179,8,0.2)'}}>
                                <svg className="w-8 h-8" style={{color:'#facc15'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                            </div>
                            <h3 className="font-bold text-xl mb-2" style={{color:'#ffffff'}}>Existing Booking Found</h3>
                            <p className="text-sm" style={{color:'rgba(255,255,255,0.7)'}}>You have an unfinished booking in progress. How would you like to proceed with your custom package?</p>
                        </div>
                        <div className="p-6 bg-white space-y-3">
                            <button
                                onClick={() => saveAndRedirect('menu-only')}
                                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                style={{background:'#7f1d1d'}}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Keep Booking, Update Menu Only
                            </button>
                            <button
                                onClick={() => saveAndRedirect('fresh')}
                                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Start Fresh Booking
                            </button>
                            <button
                                onClick={() => setShowConflictModal(false)}
                                className="w-full py-2.5 rounded-xl font-bold text-sm text-gray-400 hover:text-gray-600 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={exitBuildConfirmOpen}
                title="Exit build mode?"
                message="Your dish selections will be kept so you can return to this package later."
                confirmText="Exit"
                onCancel={() => setExitBuildConfirmOpen(false)}
                onConfirm={exitBuildMode}
            />

            {/* Scroll to Top Button */}
            {showScrollTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border border-gray-200"
                    style={{ background: '#ffffff', animation: 'imgZoomIn .25s ease both' }}
                    title="Back to top"
                >
                    <svg className="w-5 h-5 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                </button>
            )}
        </div>
    );
};

export default MenuGallery;
