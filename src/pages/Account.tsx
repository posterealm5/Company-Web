import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/auth';
import { getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } from '../services/addresses';
import type { Address } from '../types/database';
import { 
  User, Phone, MapPin, Loader2, CheckCircle, ArrowLeft, 
  Plus, Edit2, Trash2, Home, Briefcase, Globe, AlertTriangle, 
  X, Landmark, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../context/NotificationContext';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';

export default function Account() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { triggerNotification } = useNotification();
  
  // Profile Section State
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [successProfile, setSuccessProfile] = useState(false);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);

  // Addresses State
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [hasLoadedAddresses, setHasLoadedAddresses] = useState(false);
  const [updatingAddressId, setUpdatingAddressId] = useState<string | null>(null);
  
  // Modals & Address CRUD State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);

  // Address Form State
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
    isDefault: false
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressApiError, setAddressApiError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const fetchUserAddresses = async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) {
      setLoadingAddresses(true);
    }
    try {
      const data = await getAddresses(user.id);
      setAddresses(data);
      setHasLoadedAddresses(true);
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      if (!isSilent) {
        setLoadingAddresses(false);
      }
    }
  };

  useEffect(() => {
    fetchUserAddresses(false);
  }, [user]);

  // Save Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSavingProfile(true);
    setSuccessProfile(false);
    setErrorProfile(null);
    
    try {
      await updateProfile(user.id, user.email || '', { 
        full_name: fullName, 
        phone
      });
      await refreshProfile();
      setSuccessProfile(true);
      setTimeout(() => setSuccessProfile(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorProfile(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Open Add Address Modal
  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setAddressForm({
      recipientName: '',
      phone: '',
      house: '',
      street: '',
      landmark: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      addressType: 'Home',
      isDefault: addresses.length === 0 // Default true if it is the first address
    });
    setAddressErrors({});
    setAddressApiError(null);
    setShowAddressModal(true);
  };

  // Open Edit Address Modal
  const handleOpenEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setAddressForm({
      recipientName: addr.recipient_name,
      phone: addr.phone,
      house: addr.house,
      street: addr.street || '',
      landmark: addr.landmark || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      country: addr.country,
      addressType: addr.address_type,
      isDefault: addr.is_default
    });
    setAddressErrors({});
    setAddressApiError(null);
    setShowAddressModal(true);
  };

  // Validate Address Form
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

  // Save Address (Insert / Update)
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
      await fetchUserAddresses(true);
    } catch (err: any) {
      console.error('Error saving address:', err);
      setAddressApiError(err.message || 'Failed to save address. Please check your fields and try again.');
    } finally {
      setSavingAddress(false);
    }
  };

  // Trigger Delete Confirmation
  const handleDeleteTrigger = (addr: Address) => {
    setAddressToDelete(addr);
    setShowDeleteConfirm(true);
  };

  // Delete Address
  const handleDeleteConfirm = async () => {
    if (!user || !addressToDelete) return;

    try {
      await deleteAddress(addressToDelete.id, user.id, addressToDelete.is_default);
      setShowDeleteConfirm(false);
      setAddressToDelete(null);
      await fetchUserAddresses(true);
    } catch (err) {
      console.error('Error deleting address:', err);
    }
  };

  // Set default address
  const handleSetDefault = async (addr: Address) => {
    if (!user || updatingAddressId) return;

    const previousAddresses = [...addresses];

    // Optimistically update the UI:
    // Mark the clicked address as default, all others as non-default, and sort
    const optimisticAddresses = addresses.map(a => ({
      ...a,
      is_default: a.id === addr.id
    })).sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });

    setAddresses(optimisticAddresses);
    setUpdatingAddressId(addr.id);

    try {
      await setDefaultAddress(addr.id, user.id);
      await fetchUserAddresses(true);
      triggerNotification('Default delivery address updated.', '', 'success');
    } catch (err) {
      console.error('Error setting default address:', err);
      setAddresses(previousAddresses);
      triggerNotification('Failed to update default address.', 'Please try again.', 'error');
    } finally {
      setUpdatingAddressId(null);
    }
  };

  const inputClasses = (name: string) => `block w-full px-4 py-3 border-2 border-brand-black bg-white focus:outline-none focus:ring-0 focus:border-brand-red transition-colors ${
    addressErrors[name] ? 'border-brand-red' : ''
  }`;

  return (
    <div className="pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <SEO metadata={getNonIndexableMetadata('My Account', '/account')} />
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 border-2 border-brand-black hover:bg-gray-100 transition-colors bg-white focus:outline-none flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
          aria-label="Go back"
        >
          <ArrowLeft size={24} className="text-brand-black" />
        </button>
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-wider">
          My Account
        </h1>
      </div>

      <div className="space-y-12">
        {/* Profile Card */}
        <div className="bg-brand-white border-2 border-brand-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-10 text-left">
          <h2 className="text-2xl font-black uppercase tracking-tight mb-6 flex items-center gap-2 pb-2 border-b-2 border-gray-100">
            <User className="text-brand-red" size={24} /> Profile Information
          </h2>
          
          {errorProfile && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-brand-red">
              <p className="text-sm text-brand-red font-medium">{errorProfile}</p>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-brand-black mb-2">
                Email Address
              </label>
              <div className="block w-full px-4 py-3 border-2 border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed font-bold">
                {user?.email}
              </div>
              <p className="mt-1 text-xs text-gray-500 font-medium">Email cannot be changed.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-brand-black mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-brand-black bg-white focus:outline-none focus:ring-0 focus:border-brand-red transition-colors font-bold"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-brand-black mb-2">
                  Contact Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-brand-black bg-white focus:outline-none focus:ring-0 focus:border-brand-red transition-colors font-bold"
                    placeholder="+91 99999 99999"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-brand-red text-white font-bold uppercase tracking-wider px-8 py-4 hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-70 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                {savingProfile ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
              </button>
              
              {successProfile && (
                <span className="flex items-center gap-2 text-green-600 font-bold text-sm bg-green-50 px-4 py-2 border border-green-200">
                  <CheckCircle size={18} /> Saved successfully
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Addresses Card */}
        <div className="bg-brand-white border-2 border-brand-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-10 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-2 border-b-2 border-gray-100">
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <MapPin className="text-brand-red" size={24} /> Saved Addresses
            </h2>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-black text-white hover:bg-brand-red font-bold uppercase tracking-widest text-xs comic-border shadow-[4px_4px_0px_0px_rgba(230,57,70,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <Plus size={14} /> Add New Address
            </button>
          </div>

          {loadingAddresses && !hasLoadedAddresses ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-brand-red" size={32} />
              <p className="text-sm font-bold uppercase tracking-wider text-gray-400">Loading your realms...</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-gray-300 bg-gray-50 text-center p-8">
              <MapPin className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="font-bold text-lg text-gray-500 uppercase tracking-wide">No Saved Addresses Found</p>
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Add a delivery address to complete your checkout faster.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {addresses.map((addr) => {
                const isAddressIncomplete = !addr.street || !addr.city || !addr.state || !addr.pincode;
                const isUpdating = addr.id === updatingAddressId;
                const isSelectable = !addr.is_default && !isAddressIncomplete && !isUpdating;
                return (
                  <div 
                    key={addr.id} 
                    role={isSelectable ? 'button' : undefined}
                    tabIndex={isSelectable ? 0 : undefined}
                    onClick={isSelectable ? () => handleSetDefault(addr) : undefined}
                    onKeyDown={
                      isSelectable 
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSetDefault(addr);
                            }
                          }
                        : undefined
                    }
                    className={`bg-white border-2 border-brand-black p-6 flex flex-col justify-between transition-all duration-200 ease-in-out relative select-none ${
                      isUpdating
                        ? 'border-brand-black opacity-80 pointer-events-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : addr.is_default 
                          ? 'border-[3px] border-brand-red shadow-[4px_4px_0px_0px_rgba(230,57,70,1)] hover:shadow-[6px_6px_0px_0px_rgba(230,57,70,1)]' 
                          : isSelectable
                            ? 'cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-[2px] hover:-translate-y-[2px] focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2'
                            : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                  >
                    <div>
                      {/* Badge / Type Header */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center gap-1 bg-gray-100 border border-brand-black text-brand-black text-[10px] font-black uppercase px-2.5 py-1 tracking-wider">
                          {addr.address_type === 'Home' && <Home size={10} />}
                          {addr.address_type === 'Work' && <Briefcase size={10} />}
                          {addr.address_type === 'Other' && <Globe size={10} />}
                          {addr.address_type}
                        </span>
                        
                        {isUpdating ? (
                          <span className="bg-brand-black text-white text-[10px] font-black uppercase px-2.5 py-1 tracking-widest comic-border border-white flex items-center gap-1">
                            <Loader2 className="animate-spin" size={10} /> Updating...
                          </span>
                        ) : addr.is_default && (
                          <span className="bg-brand-red text-white text-[10px] font-black uppercase px-2.5 py-1 tracking-widest comic-border border-white">
                            Default
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-1 mb-6">
                        <p className="font-black text-lg tracking-tight uppercase">{addr.recipient_name}</p>
                        <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                          <Phone size={12} className="text-brand-red" /> {addr.phone}
                        </p>
                        
                        <div className="text-sm font-semibold text-brand-black pt-2 space-y-0.5 leading-snug">
                          <p>{addr.house}</p>
                          {addr.street && <p>{addr.street}</p>}
                          {addr.landmark && (
                            <p className="text-xs text-gray-400 italic font-medium">Landmark: {addr.landmark}</p>
                          )}
                          <p>
                            {addr.city && `${addr.city}, `}
                            {addr.state && `${addr.state} `}
                            {addr.pincode && `- ${addr.pincode}`}
                          </p>
                          <p className="text-xs font-black uppercase tracking-wider text-gray-400 mt-1">{addr.country}</p>
                        </div>

                        {/* Legacy Incomplete Warning */}
                        {isAddressIncomplete && (
                          <div className="mt-4 text-[10px] font-black text-brand-red bg-red-50 border border-brand-red/20 p-2.5 flex items-start gap-1.5 uppercase tracking-wide">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <div>
                              <p>Incomplete Details</p>
                              <p className="text-[9px] font-medium text-gray-500 normal-case mt-0.5">Please edit to specify your street, city, state, and pincode.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-4 mt-auto">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(addr);
                          }}
                          disabled={isUpdating}
                          className="p-3 text-gray-500 hover:text-brand-black hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none transition-colors border border-gray-200 rounded-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-black focus:ring-offset-2"
                          title="Edit Address"
                          aria-label={`Edit address for ${addr.recipient_name}`}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTrigger(addr);
                          }}
                          disabled={isUpdating}
                          className="p-3 text-gray-500 hover:text-brand-red hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none transition-colors border border-gray-200 rounded-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2"
                          title="Delete Address"
                          aria-label={`Delete address for ${addr.recipient_name}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Address Form Modal */}
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
                {editingAddress ? 'Edit Address' : 'Add New Address'}
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
                      className={inputClasses('recipientName')}
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
                      className={inputClasses('phone')}
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
                    className={inputClasses('house')}
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
                    className={inputClasses('street')}
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
                      className={inputClasses('city')}
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
                      className={inputClasses('state')}
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
                      className={inputClasses('pincode')}
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
                      className={inputClasses('country')}
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

                {/* Set as Default Checkbox */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Do not allow toggling off if this is the only default address
                      if (editingAddress?.is_default) return;
                      setAddressForm({...addressForm, isDefault: !addressForm.isDefault});
                    }}
                    className="flex items-center gap-2 select-none group text-left"
                    disabled={savingAddress || editingAddress?.is_default}
                  >
                    <div className={`w-6 h-6 border-2 border-brand-black flex items-center justify-center transition-all ${
                      addressForm.isDefault ? 'bg-brand-red border-brand-black text-white' : 'bg-white border-gray-300'
                    }`}>
                      {addressForm.isDefault && <Check size={14} strokeWidth={4} />}
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-brand-black group-hover:text-brand-red transition-colors">
                      Set as default shipping address
                    </span>
                  </button>
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white comic-border p-8 max-w-md w-full shadow-2xl z-10 text-center"
            >
              <div className="bg-red-50 border-2 border-brand-red w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-red rotate-[-3deg]">
                <Trash2 size={28} />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tight mb-2">Delete Address</h3>
              <p className="text-gray-500 font-medium mb-8 text-sm leading-relaxed">
                Are you sure you want to remove this address? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setAddressToDelete(null);
                  }}
                  className="flex-1 py-4 font-display text-xl uppercase tracking-widest bg-white text-brand-black hover:bg-gray-100 transition-colors comic-border border-brand-black"
                >
                  Cancel
                </button>
                <button 
                  autoFocus
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-4 font-display text-xl uppercase tracking-widest bg-brand-red text-white hover:bg-brand-black transition-colors comic-border border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
