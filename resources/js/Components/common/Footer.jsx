import React from 'react';
import { Link } from '@inertiajs/react';
import logoImg from '../../../images/ECS_LOGO.png';

const Footer = () => {
    return (
        <footer className="mt-auto bg-[#15110f] text-white">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.25fr_2fr]">
                <div>
                    <img src={logoImg} alt="Eloquente Catering Services" className="h-12 w-auto opacity-90" />
                    <p className="mt-5 max-w-sm text-sm font-medium leading-6 text-white/55">
                        Premium event catering for weddings, corporate gatherings, private celebrations, and tasting-led planning across Metro Manila.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link href="/book" className="rounded-full bg-[#f0aa0b] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-[#1a1a1a] transition-colors hover:bg-[#d99a08]">
                            Book Event
                        </Link>
                        <Link href="/food-tasting" className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#f0aa0b] hover:text-[#f0aa0b]">
                            Book Tasting
                        </Link>
                    </div>
                </div>

                <div className="grid gap-8 sm:grid-cols-3">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Explore</p>
                        <div className="mt-4 grid gap-3 text-sm font-semibold text-white/60">
                            <Link href="/" className="hover:text-white">Home</Link>
                            <Link href="/about" className="hover:text-white">About Us</Link>
                            <Link href="/amenities" className="hover:text-white">Amenities</Link>
                            <Link href="/menu" className="hover:text-white">Menu</Link>
                            <Link href="/contact" className="hover:text-white">Contact</Link>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Services</p>
                        <div className="mt-4 grid gap-3 text-sm font-semibold text-white/60">
                            <span>Weddings</span>
                            <span>Corporate Events</span>
                            <span>Private Parties</span>
                            <span>Debut & Baptismal</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Contact</p>
                        <div className="mt-4 grid gap-3 text-sm font-semibold text-white/60">
                            <span>Metro Manila, Philippines</span>
                            <span>+63 912 345 6789</span>
                            <span>bookings@eloquente.com</span>
                            <span>Mon-Sat, 9AM-6PM</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="border-t border-white/10">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs font-semibold text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <p>© 2026 Eloquente Catering Services. All rights reserved.</p>
                    <p>Transparent planning, current pricing, and event-ready service.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
