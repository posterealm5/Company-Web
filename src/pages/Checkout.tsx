import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Phone, MapPin, Mail, Landmark, 
  Check, AlertCircle, Loader2, Home, Briefcase, Globe, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { RippleWrapper } from '../components/ui/RippleWrapper';
import { getAddresses, addAddress, updateAddress } from '../services/addresses';
import type { Address } from '../types/database';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';

export default function Checkout() {
  const { user, profile } = useAuth();
  const { cartItems, triggerNotification } = useCart();
  const navigate = useNavigate();
  
  // Checkout Form State
  const [formData, setFormData] = useState({
    fullName: '',
    contactNumber: '',
    address: '',
    nearestLandmark: '',
    email: ''
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Addresses State for Logged In Users
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [hasLoadedAddresses, setHasLoadedAddresses] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Address Modal Form State
  const [addressForm, setAddressForm] = useState({
    recipientName: '',
    phone: '',
    house: '',
    street: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    addressType: 'Home' as 'Home' | 'Work' | 'Other',
    isDefault: true
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressApiError, setAddressApiError] = useState<string | null>(null);

  const fetchAddresses = async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) {
      setLoadingAddresses(true);
    }
    try {
      const data = await getAddresses(user.id);
      setAddresses(data);
      setHasLoadedAddresses(true);
    } catch (err) {
      console.error('Error fetching addresses in checkout:', err);
    } finally {
      if (!isSilent) {
        setLoadingAddresses(false);
      }
    }
  };

  useEffect(() => {
    fetchAddresses(false);
  }, [user]);

  const defaultAddress = addresses.find(a => a.is_default);
  const isAddressIncomplete = defaultAddress && (!defaultAddress.street || !defaultAddress.city || !defaultAddress.state || !defaultAddress.pincode);

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/cart');
    }
  }, [cartItems, navigate]);

  // Sync Form Data with Profile or Loaded Addresses
  useEffect(() => {
    if (user && defaultAddress) {
      setFormData({
        fullName: defaultAddress.recipient_name,
        contactNumber: defaultAddress.phone,
        address: `${defaultAddress.house}${defaultAddress.street ? `, ${defaultAddress.street}` : ''}${defaultAddress.city ? `, ${defaultAddress.city}` : ''}${defaultAddress.state ? `, ${defaultAddress.state}` : ''}${defaultAddress.pincode ? ` - ${defaultAddress.pincode}` : ''}`,
        nearestLandmark: defaultAddress.landmark || '',
        email: profile?.email || user.email || ''
      });
    } else if (profile) {
      setFormData(prev => ({
        ...prev,
        fullName: profile.full_name || '',
        contactNumber: profile.phone || '',
        email: profile.email || user?.email || prev.email
      }));
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        email: user.email || ''
      }));
    }
  }, [addresses, profile, user]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName) newErrors.fullName = 'Full Name is required';
    if (!formData.contactNumber) newErrors.contactNumber = 'Contact Number is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email address';
    
    // Address checks for logged in user
    if (user) {
      if (addresses.length === 0) {
        newErrors.address = 'A saved delivery address is required. Please add one.';
      } else if (isAddressIncomplete) {
        newErrors.address = 'Your default saved address is incomplete. Please complete it.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setShowConfirmModal(true);
    } else {
      if (user && addresses.length === 0) {
        triggerNotification("Please add a shipping address before proceeding.");
      } else if (user && isAddressIncomplete) {
        triggerNotification("Please complete your shipping address details.");
      } else {
        triggerNotification("Please fix the errors in the form.");
      }
    }
  };

  const handleConfirm = () => {
    sessionStorage.setItem('checkout_details', JSON.stringify(formData));
    navigate('/order-summary');
  };

  // Open Add Address Modal
  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setAddressForm({
      recipientName: formData.fullName || (profile?.full_name || ''),
      phone: formData.contactNumber || (profile?.phone || ''),
      house: '',
      street: '',
      landmark: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      addressType: 'Home',
      isDefault: true
    });
    setAddressErrors({});
    setAddressApiError(null);
    setShowAddressModal(true);
  };

  // Open Edit Address Modal (for completing incomplete address)
  const handleOpenEditModal = () => {
    if (!defaultAddress) return;
    setEditingAddress(defaultAddress);
    setAddressForm({
      recipientName: defaultAddress.recipient_name,
      phone: defaultAddress.phone,
      house: defaultAddress.house,
      street: defaultAddress.street || '',
      landmark: defaultAddress.landmark || '',
      city: defaultAddress.city || '',
      state: defaultAddress.state || '',
      pincode: defaultAddress.pincode || '',
      country: defaultAddress.country,
      addressType: defaultAddress.address_type,
      isDefault: defaultAddress.is_default
    });
    setAddressErrors({});
    setAddressApiError(null);
    setShowAddressModal(true);
  };

  const validateAddressForm = () => {
    const errs: Record<string, string> = {};
    if (!addressForm.recipientName.trim()) errs.recipientName = 'Recipient Name is required';
    if (!addressForm.phone.trim()) {
      errs.phone = 'Contact Number is required';
    } else if (!/^\+?[0-9\s\-()]{10,20}$/.test(addressForm.phone.trim())) {
      errs.phone = 'Enter a valid 10-20 digit contact number';
    }
    if (!addressForm.house.trim()) errs.house = 'House / Flat / Building is required';
    if (!addressForm.street.trim()) errs.street = 'Street / Area is required';
    if (!addressForm.city.trim()) errs.city = 'City is required';
    if (!addressForm.state.trim()) errs.state = 'State is required';
    
    if (!addressForm.pincode.trim()) {
      errs.pincode = 'Pincode is required';
    } else if (addressForm.country === 'India' && !/^[0-9]{6}$/.test(addressForm.pincode.trim())) {
      errs.pincode = 'Pincode must be a 6-digit number';
    }
    
    if (!addressForm.country.trim()) errs.country = 'Country is required';

    setAddressErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateAddressForm()) return;

    setSavingAddress(true);
    setAddressApiError(null);

    const payload = {
      user_id: user.id,
      recipient_name: addressForm.recipientName.trim(),
      phone: addressForm.phone.trim(),
      house: addressForm.house.trim(),
      street: addressForm.street.trim() || null,
      landmark: addressForm.landmark.trim() || null,
      city: addressForm.city.trim() || null,
      state: addressForm.state.trim() || null,
      pincode: addressForm.pincode.trim() || null,
      country: addressForm.country.trim(),
      address_type: addressForm.addressType,
      is_default: addressForm.isDefault
    };

    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, payload);
      } else {
        await addAddress(payload);
      }
      setShowAddressModal(false);
      await fetchAddresses(true);
      triggerNotification("Address saved successfully!");
    } catch (err: any) {
      console.error('Error saving address:', err);
      setAddressApiError(err.message || 'Failed to save address. Please check your fields and try again.');
    } finally {
      setSavingAddress(false);
    }
  };

  const inputClasses = (name: string) => `w-full bg-white text-brand-black p-4 font-bold text-lg comic-border focus:outline-none transition-all ${
    errors[name] ? 'border-brand-red focus:ring-brand-red' : 'focus:ring-brand-black'
  }`;

  const addressModalInputClasses = (name: string) => `block w-full px-4 py-3 border-2 border-brand-black bg-white focus:outline-none focus:ring-0 focus:border-brand-red transition-colors ${
    addressErrors[name] ? 'border-brand-red' : ''
  }`;

  return (
    <div className="pt-32 pb-24 bg-brand-white min-h-screen">
      <SEO metadata={getNonIndexableMetadata('Checkout', '/checkout')} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-12"
        >
          <button 
            onClick={() => navigate('/cart')}
            className="inline-flex items-center gap-2 text-brand-black hover:text-brand-red transition-colors font-bold uppercase tracking-widest text-sm"
          >
            <ArrowLeft size={18} />
            Back to Bag
          </button>
          <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter mt-4 text-left">
            CHECKOUT <span className="text-brand-red">DETAILS</span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white comic-border p-8 md:p-12 shadow-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-8 text-left">
            {/* Email Address */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <Mail size={14} /> Email Address
              </label>
              <input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={inputClasses('email')}
                placeholder="Enter your email"
                disabled={!!user}
              />
              {errors.email && <p className="text-brand-red text-[10px] font-black uppercase mt-1">{errors.email}</p>}
              {user && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Linked to your registered account.</p>}
            </div>

            {user ? (
              /* Logged In User Saved Address Section */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b-2 border-brand-black pb-2">
                  <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <MapPin className="text-brand-red animate-pulse" size={20} /> Shipping Address
                  </h3>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/account')}
                      className="text-xs font-black uppercase tracking-widest text-brand-black hover:text-brand-red transition-colors underline"
                    >
                      Manage All Addresses
                    </button>
                  )}
                </div>

                {loadingAddresses && !hasLoadedAddresses ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="animate-spin text-brand-red" size={24} />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Loading delivery details...</span>
                  </div>
                ) : addresses.length === 0 ? (
                  /* No Saved Address Prompt */
                  <div className="border-2 border-dashed border-brand-red bg-red-50/50 p-8 text-center comic-border">
                    <AlertCircle className="mx-auto text-brand-red mb-3" size={36} />
                    <p className="font-black text-lg text-brand-black uppercase tracking-wide">No Saved Delivery Address Found</p>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest mb-6">You need a saved address to complete your order.</p>
                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      className="px-6 py-4 bg-brand-red text-white font-bold uppercase tracking-widest text-sm comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                      Add Shipping Address
                    </button>
                  </div>
                ) : (
                  /* Default Address Display */
                  <div className="space-y-4">
                    <div className={`border-2 border-brand-black p-6 bg-gray-50 relative ${
                      isAddressIncomplete ? 'border-brand-red bg-red-50/20' : ''
                    }`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="inline-flex items-center bg-brand-black text-white text-[9px] font-black uppercase px-2 py-0.5 tracking-wider">
                            {defaultAddress?.address_type}
                          </span>
                          <span className="ml-2 text-[10px] font-black text-gray-400 uppercase tracking-wide">Default Address</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenEditModal}
                          className="text-xs font-black uppercase tracking-widest text-brand-red hover:underline flex items-center gap-1"
                        >
                          Edit Address
                        </button>
                      </div>

                      <div className="space-y-1">
                        <p className="font-black text-lg uppercase">{defaultAddress?.recipient_name}</p>
                        <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                          <Phone size={12} className="text-brand-red" /> {defaultAddress?.phone}
                        </p>
                        
                        <div className="text-sm font-semibold text-brand-black pt-2 space-y-0.5 leading-snug">
                          <p>{defaultAddress?.house}</p>
                          {defaultAddress?.street && <p>{defaultAddress?.street}</p>}
                          {defaultAddress?.landmark && (
                            <p className="text-xs text-gray-400 italic font-medium">Landmark: {defaultAddress?.landmark}</p>
                          )}
                          <p>
                            {defaultAddress?.city && `${defaultAddress?.city}, `}
                            {defaultAddress?.state && `${defaultAddress?.state} `}
                            {defaultAddress?.pincode && `- ${defaultAddress?.pincode}`}
                          </p>
                          <p className="text-xs font-black uppercase tracking-wider text-gray-400 mt-1">{defaultAddress?.country}</p>
                        </div>
                      </div>

                      {/* Incomplete Warning */}
                      {isAddressIncomplete && (
                        <div className="mt-4 text-[10px] font-black text-brand-red bg-red-50 border border-brand-red/20 p-4 flex items-start gap-2.5 uppercase tracking-wide">
                          <AlertCircle size={16} className="shrink-0 mt-0.5 animate-bounce" />
                          <div>
                            <p className="font-black">Incomplete Shipping Address</p>
                            <p className="text-[9px] font-medium text-gray-500 normal-case mt-0.5">Please add your street, city, state, and pincode before continuing.</p>
                            <button
                              type="button"
                              onClick={handleOpenEditModal}
                              className="mt-2 text-[10px] font-black text-white bg-brand-red px-3 py-1.5 hover:bg-brand-black transition-colors"
                            >
                              Complete Address Details
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hidden Form Inputs for compatibility */}
                    <input type="hidden" name="fullName" value={formData.fullName} />
                    <input type="hidden" name="contactNumber" value={formData.contactNumber} />
                    <input type="hidden" name="address" value={formData.address} />
                    <input type="hidden" name="nearestLandmark" value={formData.nearestLandmark} />
                  </div>
                )}
                {errors.address && <p className="text-brand-red text-[10px] font-black uppercase mt-1">{errors.address}</p>}
              </div>
            ) : (
              /* Guest Checkout: Render traditional fields */
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                      <User size={14} /> Full Name
                    </label>
                    <input 
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      className={inputClasses('fullName')}
                      placeholder="Enter your full name"
                    />
                    {errors.fullName && <p className="text-brand-red text-[10px] font-black uppercase mt-1">{errors.fullName}</p>}
                  </div>

                  {/* Contact Number */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                      <Phone size={14} /> Contact Number
                    </label>
                    <input 
                      type="tel"
                      value={formData.contactNumber}
                      onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
                      className={inputClasses('contactNumber')}
                      placeholder="Enter phone number"
                    />
                    {errors.contactNumber && <p className="text-brand-red text-[10px] font-black uppercase mt-1">{errors.contactNumber}</p>}
                  </div>

                  {/* Nearest Landmark */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                      <Landmark size={14} /> Nearest Landmark (Optional)
                    </label>
                    <input 
                      type="text"
                      value={formData.nearestLandmark}
                      onChange={(e) => setFormData({...formData, nearestLandmark: e.target.value})}
                      className={inputClasses('nearestLandmark')}
                      placeholder="e.g. Near Mall"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <MapPin size={14} /> Full Shipping Address
                  </label>
                  <textarea 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    rows={4}
                    className={`${inputClasses('address')} resize-none`}
                    placeholder="Enter your complete address with city, state and pincode"
                  />
                  {errors.address && <p className="text-brand-red text-[10px] font-black uppercase mt-1">{errors.address}</p>}
                </div>
              </>
            )}

            <RippleWrapper delay={2} className="w-full pt-4">
              <button 
                type="submit"
                disabled={user && (addresses.length === 0 || isAddressIncomplete)}
                className={`w-full py-5 text-white font-display text-2xl uppercase tracking-widest comic-border border-white transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-none ${
                  user && (addresses.length === 0 || isAddressIncomplete)
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed grayscale shadow-none'
                    : 'bg-brand-black hover:bg-brand-red cursor-pointer'
                }`}
              >
                Submit Details <Check size={24} />
              </button>
            </RippleWrapper>
          </form>
        </motion.div>
      </div>

      {/* Address Form Modal (Inline in Checkout) */}
      <AnimatePresence>
        {showAddressModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm"
              onClick={() => !savingAddress && setShowAddressModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-brand-white comic-border p-6 md:p-8 max-w-2xl w-full shadow-2xl z-10 text-left my-8"
            >
              <button 
                onClick={() => setShowAddressModal(false)}
                disabled={savingAddress}
                className="absolute top-4 right-4 p-2 bg-brand-black text-white hover:bg-brand-red transition-colors comic-border border-white disabled:opacity-50"
              >
                <X size={18} />
              </button>

              <h3 className="text-3xl font-black uppercase tracking-tight mb-6">
                {editingAddress ? 'Complete Address Details' : 'Add Shipping Address'}
              </h3>

              {addressApiError && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-brand-red text-xs font-semibold text-brand-red">
                  {addressApiError}
                </div>
              )}

              <form onSubmit={handleSaveAddress} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Recipient Name */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                      Recipient Name *
                    </label>
                    <input 
                      type="text"
                      value={addressForm.recipientName}
                      onChange={(e) => setAddressForm({...addressForm, recipientName: e.target.value})}
                      className={addressModalInputClasses('recipientName')}
                      placeholder="e.g. John Doe"
                      disabled={savingAddress}
                    />
                    {addressErrors.recipientName && (
                      <p className="text-brand-red text-[9px] font-black uppercase mt-1">{addressErrors.recipientName}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                      Contact Number *
                    </label>
                    <input 
                      type="tel"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({...addressForm, phone: e.target.value})}
                      className={addressModalInputClasses('phone')}
                      placeholder="10-digit delivery phone"
                      disabled={savingAddress}
                    />
                    {addressErrors.phone && (
                      <p className="text-brand-red text-[9px] font-black uppercase mt-1">{addressErrors.phone}</p>
                    )}
                  </div>
                </div>

                {/* House */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    Flat / House No. / Building *
                  </label>
                  <input 
                    type="text"
                    value={addressForm.house}
                    onChange={(e) => setAddressForm({...addressForm, house: e.target.value})}
                    className={addressModalInputClasses('house')}
                    placeholder="Apt 4B, Building Name, Plot No."
                    disabled={savingAddress}
                  />
                  {addressErrors.house && (
                    <p className="text-brand-red text-[9px] font-black uppercase mt-1">{addressErrors.house}</p>
                  )}
                </div>

                {/* Street */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    Street Address / Area *
                  </label>
                  <input 
                    type="text"
                    value={addressForm.street}
                    onChange={(e) => setAddressForm({...addressForm, street: e.target.value})}
                    className={addressModalInputClasses('street')}
                    placeholder="Main Road, Sector, Area name"
                    disabled={savingAddress}
                  />
                  {addressErrors.street && (
                    <p className="text-brand-red text-[9px] font-black uppercase mt-1">{addressErrors.street}</p>
                  )}
                </div>

                {/* Landmark */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    Nearest Landmark (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Landmark size={14} className="text-gray-400" />
                    </div>
                    <input 
                      type="text"
                      value={addressForm.landmark}
                      onChange={(e) => setAddressForm({...addressForm, landmark: e.target.value})}
                      className="block w-full pl-8 pr-3 py-3 border-2 border-brand-black bg-white focus:outline-none focus:ring-0 focus:border-brand-red transition-colors"
                      placeholder="e.g. Near Central Metro"
                      disabled={savingAddress}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* City */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                      City *
                    </label>
                    <input 
                      type="text"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({...addressForm, city: e.target.value})}
                      className={addressModalInputClasses('city')}
                      placeholder="City Name"
                      disabled={savingAddress}
                    />
                    {addressErrors.city && (
                      <p className="text-brand-red text-[9px] font-black uppercase mt-1">{addressErrors.city}</p>
                    )}
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                      State *
                    </label>
                    <input 
                      type="text"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({...addressForm, state: e.target.value})}
                      className={addressModalInputClasses('state')}
                      placeholder="State Name"
                      disabled={savingAddress}
                    />
                    {addressErrors.state && (
                      <p className="text-brand-red text-[9px] font-black uppercase mt-1">{addressErrors.state}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Pincode */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                      Pincode *
                    </label>
                    <input 
                      type="text"
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm({...addressForm, pincode: e.target.value})}
                      className={addressModalInputClasses('pincode')}
                      placeholder="6 digit PIN code"
                      disabled={savingAddress}
                    />
                    {addressErrors.pincode && (
                      <p className="text-brand-red text-[9px] font-black uppercase mt-1">{addressErrors.pincode}</p>
                    )}
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                      Country *
                    </label>
                    <input 
                      type="text"
                      value={addressForm.country}
                      onChange={(e) => setAddressForm({...addressForm, country: e.target.value})}
                      className={addressModalInputClasses('country')}
                      placeholder="India"
                      disabled={savingAddress}
                    />
                    {addressErrors.country && (
                      <p className="text-brand-red text-[9px] font-black uppercase mt-1">{addressErrors.country}</p>
                    )}
                  </div>
                </div>

                {/* Address Type Selection */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">
                    Address Type *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Home', 'Work', 'Other'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAddressForm({...addressForm, addressType: type})}
                        className={`py-3 font-black uppercase text-xs border-2 transition-all flex items-center justify-center gap-1.5 ${
                          addressForm.addressType === type
                            ? 'bg-brand-black border-brand-black text-white'
                            : 'bg-white border-gray-200 text-gray-400 hover:border-brand-red'
                        }`}
                        disabled={savingAddress}
                      >
                        {type === 'Home' && <Home size={12} />}
                        {type === 'Work' && <Briefcase size={12} />}
                        {type === 'Other' && <Globe size={12} />}
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-4 pt-6 border-t border-gray-100">
                  <button 
                    type="button"
                    onClick={() => setShowAddressModal(false)}
                    disabled={savingAddress}
                    className="flex-1 py-4 font-display text-xl uppercase tracking-widest bg-white text-brand-black hover:bg-gray-100 transition-colors comic-border border-brand-black disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={savingAddress}
                    className="flex-1 py-4 font-display text-xl uppercase tracking-widest bg-brand-black text-white hover:bg-brand-red transition-colors comic-border disabled:opacity-50 flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(230,57,70,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                  >
                    {savingAddress ? <Loader2 className="animate-spin" size={18} /> : 'Save Address'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm"
              onClick={() => setShowConfirmModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white comic-border p-8 max-w-md w-full shadow-2xl z-10 text-center"
            >
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} className="text-blue-600" />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tight mb-4">Verify Details</h3>
              <p className="text-gray-600 font-medium mb-8 text-lg">
                Kindly verify the details that you provided are correct.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-4 font-display text-xl uppercase tracking-widest bg-white text-brand-black hover:bg-gray-100 transition-colors comic-border border-brand-black"
                >
                  Cancel
                </button>
                <button 
                  autoFocus
                  onClick={handleConfirm}
                  className="flex-1 py-4 font-display text-xl uppercase tracking-widest bg-brand-black text-white hover:bg-brand-red transition-colors comic-border focus:outline-none focus:ring-4 focus:ring-brand-red/50"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
