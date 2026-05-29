import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import ClientNavbar from '../Components/common/ClientNavbar';
import Footer from '../Components/common/Footer';

const stats = [
    ['500+', 'events catered'],
    ['15', 'years serving'],
    ['4', 'event specialties'],
];

const About = () => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans">
            <Head title="About Eloquente Catering">
                <meta name="description" content="Learn about Eloquente Catering's event planning approach, catering service standards, and full-service event operations." />
            </Head>
            <ClientNavbar user={user} logout={logout} activePath="/about" />

            <main className="pt-[68px]">
                <section className="relative overflow-hidden bg-[#17120f] text-white">
                    <img
                        src="https://images.unsplash.com/photo-1559329007-40df8a9345d8?auto=format&fit=crop&q=85&w=1800"
                        alt="Catering team preparing an event table"
                        className="absolute inset-0 h-full w-full object-cover opacity-45"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#15110f] via-[#15110f]/80 to-[#720101]/35" />
                    <div className="relative mx-auto grid min-h-[560px] max-w-7xl items-end gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.8fr]">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f0aa0b]">About Eloquente</p>
                            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">Event catering built on taste, timing, and trust.</h1>
                            <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/70">
                                We combine curated menus, transparent planning, and disciplined event operations so clients can make confident decisions before the first plate is served.
                            </p>
                        </div>
                        <div className="grid gap-3 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md sm:grid-cols-3 lg:grid-cols-1">
                            {stats.map(([value, label]) => (
                                <div key={label} className="rounded-xl bg-white/10 p-4">
                                    <p className="font-display text-3xl font-bold text-white">{value}</p>
                                    <p className="mt-1 text-xs font-black uppercase tracking-widest text-white/55">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr]">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#720101]">Our Standard</p>
                        <h2 className="mt-4 font-display text-3xl font-bold text-[#1a1a1a] sm:text-4xl">Professional service without making planning feel complicated.</h2>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        {[
                            ['Menu clarity', 'Dish choices are tied to real pricing so every menu change has visible cost impact.'],
                            ['Event readiness', 'Timing, venue notes, guest count, and final sourcing rules are managed before the rush window.'],
                            ['Guest experience', 'Food, service flow, and presentation are planned around the kind of event you are hosting.'],
                            ['Accountability', 'The dashboard keeps bookings, payments, tastings, and updates in one place.'],
                        ].map(([title, text]) => (
                            <div key={title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                                <h3 className="font-display text-xl font-bold text-[#1a1a1a]">{title}</h3>
                                <p className="mt-3 text-sm font-medium leading-6 text-gray-500">{text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white py-20">
                    <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-2">
                        <img
                            src="https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&q=85&w=1100"
                            alt="Chef plating food for service"
                            className="h-[440px] w-full rounded-2xl object-cover shadow-xl"
                        />
                        <div className="self-center">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">How We Work</p>
                            <h2 className="mt-4 font-display text-3xl font-bold text-[#1a1a1a]">From tasting to final balance, every step has a purpose.</h2>
                            <p className="mt-5 text-sm font-medium leading-7 text-gray-600">
                                Eloquente treats catering as both culinary work and operations work. We help clients taste, choose, price, confirm, and prepare on a schedule that protects food quality and event execution.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link href="/book" className="rounded-full bg-[#720101] px-6 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-[#5a0101]">Book Event</Link>
                                <Link href="/food-tasting" className="rounded-full border border-[#720101]/20 bg-white px-6 py-3 text-sm font-black uppercase tracking-widest text-[#720101] hover:bg-[#720101]/5">Book Tasting</Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default About;
