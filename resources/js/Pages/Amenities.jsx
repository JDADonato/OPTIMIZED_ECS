import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import ClientNavbar from '../Components/common/ClientNavbar';
import Footer from '../Components/common/Footer';
import RevealOnScroll from '../Components/common/RevealOnScroll';

const standardSetup = [
    'Complete sets of elegant dinnerware, flatware, and glassware.',
    'Elegant roll-top chafing dishes for buffet service.',
    'Buffet table styling with centerpiece arrangements, skirting, and lighting.',
    'Guest tables dressed with floor-length mantels and lace toppings.',
    'Fresh or artificial floral centerpieces for guest tables.',
    'Tiffany chairs or monoblock chairs decorated with motif ribbons.',
    'Styled tables for gifts and guest registration.',
    'Purified drinking water and ice for all drinks.',
    'Complimentary food tasting for two prior to the event.',
];

const premiumEnhancements = [
    ['Backdrop', 'Elegant floral backdrop designed around the couple, celebrant, or event focal point.'],
    ['Presidential table', 'Formal long-table arrangements, including state-visit style setups.'],
    ['Ceremony aisle', 'Red carpet aisle rollout for weddings, debuts, and formal entrances.'],
    ['Toast detail', 'A complimentary bottle of wine for the ceremonial toast.'],
];

const occasionInclusions = [
    {
        title: 'Debut Exclusives',
        text: 'Provision of 18 Roses, 18 Candles, and a special bouquet for the Debutant.',
    },
    {
        title: 'Grand Celebrations',
        text: 'For 150+ guests, choose from premium add-ons such as a 3 to 4-layer fondant cake, 75-150 boxed cupcakes, a professional event emcee, or a 3-hour bridal car rental.',
    },
];

const Amenities = () => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans">
            <Head title="Amenities | Eloquente Catering">
                <meta name="description" content="Review Eloquente Catering amenities, buffet setup, table styling, service crew details, and event inclusions." />
            </Head>
            <ClientNavbar user={user} logout={logout} activePath="/amenities" />

            <main className="pt-[68px]">
                <section className="relative overflow-hidden bg-[#15110f] text-white">
                    <img
                        src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=85&w=1900"
                        alt="Elegant event reception with dressed tables and warm lighting"
                        className="absolute inset-0 h-full w-full object-cover opacity-35"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#15110f] via-[#15110f]/90 to-[#15110f]/68" />
                    <div className="relative mx-auto grid min-h-[560px] max-w-7xl items-end gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.72fr]">
                        <RevealOnScroll>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f0aa0b]">Amenities & Expectations</p>
                            <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-6xl">
                                The Eloquente Experience
                            </h1>
                            <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/72">
                                Beyond the menu: the table setting, service equipment, ceremony details, and special inclusions prepared for your event.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link href="/book" className="rounded-full bg-[#f0aa0b] px-6 py-3 text-xs font-black uppercase tracking-widest text-[#1a1a1a] transition-colors hover:bg-[#d99a08]">
                                    Book Event
                                </Link>
                                <Link href="/contact" className="rounded-full border border-white/20 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#f0aa0b] hover:text-[#f0aa0b]">
                                    Ask About Setup
                                </Link>
                            </div>
                        </RevealOnScroll>

                        <RevealOnScroll delay="rv-d1" className="rounded-2xl border border-white/10 bg-[#fffaf3] p-5 text-[#1a1a1a] shadow-xl">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#720101]">Prepared with every plan</p>
                            <div className="mt-5 grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
                                {[
                                    ['Tables', 'Dressed guest, buffet, gift, and registration areas.'],
                                    ['Service', 'Buffet equipment, dinnerware, glassware, water, and ice.'],
                                    ['Milestones', 'Special ceremony and occasion-based inclusions.'],
                                ].map(([title, text]) => (
                                    <div key={title}>
                                        <h2 className="font-display text-xl font-bold">{title}</h2>
                                        <p className="mt-2 text-sm font-medium leading-6 text-gray-600">{text}</p>
                                    </div>
                                ))}
                            </div>
                        </RevealOnScroll>
                    </div>
                </section>

                <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr]">
                    <RevealOnScroll>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#720101]">Standard Setup</p>
                        <h2 className="mt-4 font-display text-3xl font-bold text-[#1a1a1a] sm:text-4xl">
                            Event essentials that make the room feel complete.
                        </h2>
                        <p className="mt-5 text-sm font-medium leading-7 text-gray-600">
                            From dressed tables to service pieces, these are the details your guests see and use throughout the celebration.
                        </p>
                    </RevealOnScroll>

                    <RevealOnScroll delay="rv-d1" className="overflow-hidden rounded-3xl bg-white shadow-sm">
                        <div className="border-b border-gray-100 bg-[#fffaf3] px-6 py-5 sm:px-8">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#720101]">Included setup checklist</p>
                            <h3 className="mt-2 font-display text-2xl font-bold text-[#1a1a1a]">Prepared before service begins</h3>
                        </div>
                        <div className="grid gap-x-10 gap-y-0 p-6 sm:grid-cols-2 sm:p-8">
                            {standardSetup.map((item) => (
                                <div key={item} className="flex gap-3 border-b border-gray-100 py-4 first:pt-0 last:border-0">
                                    <span className="mt-1.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#720101]/5 text-[#720101]">
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" /></svg>
                                    </span>
                                    <p className="text-sm font-semibold leading-6 text-gray-700">{item}</p>
                                </div>
                            ))}
                        </div>
                    </RevealOnScroll>
                </section>

                <section className="bg-white py-20">
                    <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-2">
                        <RevealOnScroll className="rv-left">
                            <img
                                src="https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&q=85&w=1200"
                                alt="Wedding reception with floral ceremony details"
                                className="h-[460px] w-full rounded-2xl object-cover shadow-xl"
                            />
                        </RevealOnScroll>
                        <RevealOnScroll delay="rv-d1" className="self-center rv-right">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Weddings & Debuts</p>
                            <h2 className="mt-4 font-display text-3xl font-bold text-[#1a1a1a] sm:text-4xl">
                                Premium enhancements for focal moments.
                            </h2>
                            <p className="mt-5 text-sm font-medium leading-7 text-gray-600">
                                Formal events need more than tables and service gear. These inclusions help frame the entrance, toast, and main celebrant area.
                            </p>
                            <div className="mt-8 divide-y divide-gray-100 border-y border-gray-100">
                                {premiumEnhancements.map(([title, text]) => (
                                    <div key={title} className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr]">
                                        <h3 className="font-display text-lg font-bold text-[#720101]">{title}</h3>
                                        <p className="text-sm font-medium leading-6 text-gray-600">{text}</p>
                                    </div>
                                ))}
                            </div>
                        </RevealOnScroll>
                    </div>
                </section>

                <section className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
                    <RevealOnScroll className="self-center">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#720101]">Special Occasions</p>
                        <h2 className="mt-4 font-display text-3xl font-bold text-[#1a1a1a] sm:text-4xl">
                            Added value for debuts and large celebrations.
                        </h2>
                        <p className="mt-5 text-sm font-medium leading-7 text-gray-600">
                            Some celebrations come with occasion-specific details. Availability and final choices are confirmed during booking review.
                        </p>
                    </RevealOnScroll>

                    <div className="grid gap-5">
                        {occasionInclusions.map((item, index) => (
                            <RevealOnScroll key={item.title} delay={`rv-d${index + 1}`} className="rounded-2xl border border-[#720101]/10 bg-white p-6 shadow-sm">
                                <h3 className="font-display text-2xl font-bold text-[#1a1a1a]">{item.title}</h3>
                                <p className="mt-3 text-sm font-medium leading-7 text-gray-600">{item.text}</p>
                            </RevealOnScroll>
                        ))}
                    </div>
                </section>

                <section className="bg-[#15110f] py-16 text-white">
                    <RevealOnScroll className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Ready to plan the room?</p>
                            <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold">
                                Pair your menu with the setup details your celebration deserves.
                            </h2>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link href="/book" className="rounded-full bg-[#f0aa0b] px-6 py-3 text-xs font-black uppercase tracking-widest text-[#1a1a1a] transition-colors hover:bg-[#d99a08]">
                                Book Event
                            </Link>
                            <Link href="/menu" className="rounded-full border border-white/15 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#f0aa0b] hover:text-[#f0aa0b]">
                                View Menu
                            </Link>
                        </div>
                    </RevealOnScroll>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default Amenities;
