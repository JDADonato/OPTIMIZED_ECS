import { useEffect, useState } from 'react';
import Modal from '../common/Modal';

const CITY_OPTIONS = [
    { value: 'caloocan', label: 'Caloocan', zone: 'metro-manila', fee: 0 },
    { value: 'las-pinas', label: 'Las Pinas', zone: 'metro-manila', fee: 0 },
    { value: 'makati', label: 'Makati', zone: 'metro-manila', fee: 0 },
    { value: 'malabon', label: 'Malabon', zone: 'metro-manila', fee: 0 },
    { value: 'mandaluyong', label: 'Mandaluyong', zone: 'metro-manila', fee: 0 },
    { value: 'manila', label: 'Manila', zone: 'metro-manila', fee: 0 },
    { value: 'marikina', label: 'Marikina', zone: 'metro-manila', fee: 0 },
    { value: 'muntinlupa', label: 'Muntinlupa', zone: 'metro-manila', fee: 0 },
    { value: 'navotas', label: 'Navotas', zone: 'metro-manila', fee: 0 },
    { value: 'paranaque', label: 'Paranaque', zone: 'metro-manila', fee: 0 },
    { value: 'pasay', label: 'Pasay', zone: 'metro-manila', fee: 0 },
    { value: 'pasig', label: 'Pasig', zone: 'metro-manila', fee: 0 },
    { value: 'pateros', label: 'Pateros', zone: 'metro-manila', fee: 0 },
    { value: 'quezon-city', label: 'Quezon City', zone: 'metro-manila', fee: 0 },
    { value: 'san-juan', label: 'San Juan', zone: 'metro-manila', fee: 0 },
    { value: 'taguig', label: 'Taguig', zone: 'metro-manila', fee: 0 },
    { value: 'valenzuela', label: 'Valenzuela', zone: 'metro-manila', fee: 0 },
    { value: 'antipolo', label: 'Antipolo', zone: 'outside-16-30', fee: 1500 },
    { value: 'bacoor', label: 'Bacoor', zone: 'outside-16-30', fee: 1500 },
    { value: 'binan', label: 'Binan', zone: 'outside-16-30', fee: 1500 },
    { value: 'cainta', label: 'Cainta', zone: 'outside-16-30', fee: 1500 },
    { value: 'dasmarinas', label: 'Dasmarinas', zone: 'outside-16-30', fee: 1500 },
    { value: 'imus', label: 'Imus', zone: 'outside-16-30', fee: 1500 },
    { value: 'meycauayan', label: 'Meycauayan', zone: 'outside-16-30', fee: 1500 },
    { value: 'san-pedro', label: 'San Pedro', zone: 'outside-16-30', fee: 1500 },
    { value: 'taytay', label: 'Taytay', zone: 'outside-16-30', fee: 1500 },
    { value: 'rodriguez', label: 'Rodriguez (Montalban)', zone: 'outside-16-30', fee: 1500 },
    { value: 'angono', label: 'Angono', zone: 'outside-31-50', fee: 3000 },
    { value: 'binangonan', label: 'Binangonan', zone: 'outside-31-50', fee: 3000 },
    { value: 'cabuyao', label: 'Cabuyao', zone: 'outside-31-50', fee: 3000 },
    { value: 'carmona', label: 'Carmona', zone: 'outside-31-50', fee: 3000 },
    { value: 'general-trias', label: 'General Trias', zone: 'outside-31-50', fee: 3000 },
    { value: 'santa-rosa', label: 'Santa Rosa', zone: 'outside-31-50', fee: 3000 },
    { value: 'silang', label: 'Silang', zone: 'outside-31-50', fee: 3000 },
    { value: 'san-mateo', label: 'San Mateo', zone: 'outside-31-50', fee: 3000 },
    { value: 'norzagaray', label: 'Norzagaray', zone: 'outside-31-50', fee: 3000 },
    { value: 'teresa', label: 'Teresa', zone: 'outside-31-50', fee: 3000 },
];

const EventSurcharges = ({ bookingData, updateBooking, onNext, onBack, user, requireEmail = true }) => {
    const [formData, setFormData] = useState({
        client_full_name: bookingData.client_full_name || '',
        client_email: bookingData.client_email || user?.email || '',
        client_phone: bookingData.client_phone || user?.phone || '',
        venue_address_line: bookingData.venue_address_line || '',
        venue_street: bookingData.venue_street || '',
        venue_city: bookingData.venue_city || '',
    });
    const [isHighRise, setIsHighRise] = useState(bookingData.isHighRise || false);
    const [citySearch, setCitySearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                client_email: prev.client_email || user.email || '',
                client_phone: prev.client_phone || user.phone || '',
            }));
        }
    }, [user]);

    const selectedCity = CITY_OPTIONS.find(city => city.value === formData.venue_city);
    const venueDistance = selectedCity?.zone || 'metro-manila';
    const locationSurcharge = venueDistance !== 'metro-manila'
        ? Math.round((bookingData.totalCost || 0) * (bookingData.package_location_surcharge_rate || 0.20))
        : 0;

    const filteredCities = CITY_OPTIONS.filter(city => city.label.toLowerCase().includes(citySearch.toLowerCase()));
    const metroCities = filteredCities.filter(city => city.zone === 'metro-manila');
    const nearCities = filteredCities.filter(city => city.zone === 'outside-16-30');
    const farCities = filteredCities.filter(city => city.zone === 'outside-31-50');

    const handleChange = (event) => {
        const updated = { ...formData, [event.target.name]: event.target.value };
        setFormData(updated);

        if (event.target.name === 'venue_city') {
            const city = CITY_OPTIONS.find(option => option.value === event.target.value);
            updateBooking({ ...updated, venueDistance: city?.zone || 'metro-manila' });
            return;
        }

        updateBooking(updated);
    };

    const handleSelectCity = (city) => {
        handleChange({ target: { name: 'venue_city', value: city.value } });
        setIsDropdownOpen(false);
        setCitySearch('');
    };

    const handleHighRiseChange = (checked) => {
        setIsHighRise(checked);
        updateBooking({ isHighRise: checked });
    };

    const handleConfirm = () => {
        if (!formData.client_full_name.trim()) {
            setModal({ isOpen: true, type: 'error', title: 'Missing Information', message: 'Please enter your full name.' });
            return;
        }
        if ((requireEmail && !formData.client_email.trim()) || !formData.client_phone.trim()) {
            setModal({
                isOpen: true,
                type: 'error',
                title: 'Contact details needed',
                message: requireEmail
                    ? 'Please add the email and mobile number we should use for booking updates.'
                    : 'Please add the mobile number we should use for booking updates.',
            });
            return;
        }
        if (!formData.venue_address_line.trim() || !formData.venue_city) {
            setModal({ isOpen: true, type: 'error', title: 'Missing Address', message: 'Please fill in the address and select a city.' });
            return;
        }

        updateBooking({ ...formData, venueDistance, isHighRise });
        onNext(true);
    };

    return (
        <div className="booking-step animate-fadeIn">
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />

            <div className="booking-step-grid">
                <section className="booking-step-panel">
                    <p className="booking-step-kicker">Contact and venue</p>
                    <h2>Where is your event?</h2>
                    <p className="booking-step-copy">
                        Add the contact person and venue address so the team can confirm logistics and any location fees.
                    </p>

                    <div className="booking-detail-summary">
                        <div>
                            <span>Location fee</span>
                            <strong>{locationSurcharge > 0 ? `PHP ${locationSurcharge.toLocaleString()}` : 'Included'}</strong>
                        </div>
                        <div>
                            <span>Venue access</span>
                            <strong>{isHighRise ? 'High-rise' : 'Standard'}</strong>
                        </div>
                    </div>
                </section>

                <section className="booking-choice-area">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="md:col-span-2">
                            <span className="booking-field-label">Full name</span>
                            <input type="text" name="client_full_name" placeholder="Enter your full name" value={formData.client_full_name} onChange={handleChange} className="booking-input" />
                        </label>
                        <label>
                            <span className="booking-field-label">Email address</span>
                            <input type="email" name="client_email" placeholder="your@email.com" value={formData.client_email} onChange={handleChange} className="booking-input" />
                        </label>
                        <label>
                            <span className="booking-field-label">Mobile number</span>
                            <input type="tel" name="client_phone" placeholder="Mobile number" value={formData.client_phone} onChange={handleChange} className="booking-input" />
                        </label>
                        <label className="md:col-span-2">
                            <span className="booking-field-label">Venue address</span>
                            <input type="text" name="venue_address_line" placeholder="Building, block, lot, unit, or venue name" value={formData.venue_address_line} onChange={handleChange} className="booking-input" />
                        </label>
                        <label>
                            <span className="booking-field-label">Street</span>
                            <input type="text" name="venue_street" placeholder="Street name" value={formData.venue_street} onChange={handleChange} className="booking-input" />
                        </label>
                        <div>
                            <span className="booking-field-label">City or municipality</span>
                            <div className="relative">
                                <button type="button" onClick={() => setIsDropdownOpen(true)} className="booking-input flex items-center justify-between text-left">
                                    <span className={selectedCity ? 'text-gray-900' : 'text-gray-400'}>
                                        {selectedCity ? selectedCity.label : 'Search or select a city'}
                                    </span>
                                    <span className="text-gray-400">v</span>
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                                        <div className="border-b border-gray-100 p-3">
                                            <input type="text" className="booking-input py-3 text-sm" placeholder="Search city" value={citySearch} onChange={(event) => setCitySearch(event.target.value)} autoFocus />
                                        </div>
                                        <div className="max-h-64 overflow-y-auto py-2" onClick={(event) => event.stopPropagation()}>
                                            {filteredCities.length === 0 ? (
                                                <div className="px-4 py-3 text-sm font-medium text-gray-500">No cities found.</div>
                                            ) : (
                                                <>
                                                    {metroCities.length > 0 && <CityGroup title="Metro Manila" feeLabel="Included" cities={metroCities} selectedValue={formData.venue_city} onSelect={handleSelectCity} />}
                                                    {nearCities.length > 0 && <CityGroup title="Nearby areas" feeLabel="+20%" cities={nearCities} selectedValue={formData.venue_city} onSelect={handleSelectCity} />}
                                                    {farCities.length > 0 && <CityGroup title="Extended service area" feeLabel="+20%" cities={farCities} selectedValue={formData.venue_city} onSelect={handleSelectCity} />}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {isDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />}
                        </div>

                        <label className="md:col-span-2 flex cursor-pointer items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-[#720101]/30">
                            <input type="checkbox" checked={isHighRise} onChange={(event) => handleHighRiseChange(event.target.checked)} className="mt-1 h-5 w-5 rounded border-gray-300 text-[#720101] focus:ring-[#720101]" />
                            <span>
                                <span className="block font-bold text-gray-900">High-rise venue</span>
                                <span className="mt-1 block text-sm font-medium leading-relaxed text-gray-500">
                                    Select this for basement venues, the 2nd floor and above, or locations that require additional carrying and setup.
                                </span>
                            </span>
                        </label>

                        {isHighRise && (
                            <div className="md:col-span-2 booking-inline-error border-[#f0aa0b]/40 bg-[#f0aa0b]/10 text-[#6f4a05]">
                                A 3% floor service charge is added for basement or upper-floor logistics.
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="booking-step-actions">
                <button onClick={onBack} className="booking-secondary-btn">Back</button>
                <button onClick={handleConfirm} className="booking-primary-btn">Continue</button>
            </div>
        </div>
    );
};

const CityGroup = ({ title, feeLabel, cities, selectedValue, onSelect }) => (
    <div className="py-1">
        <div className="flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
            <span>{title}</span>
            <span>{feeLabel}</span>
        </div>
        {cities.map(city => (
            <button
                key={city.value}
                type="button"
                onClick={() => onSelect(city)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold transition ${selectedValue === city.value ? 'bg-[#fff8ea] text-[#720101]' : 'text-gray-700 hover:bg-gray-50'}`}
            >
                <span>{city.label}</span>
                {selectedValue === city.value && <span className="text-[#f0aa0b]">Selected</span>}
            </button>
        ))}
    </div>
);

export default EventSurcharges;
