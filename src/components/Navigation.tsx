import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, ShoppingCart, User, Heart, Mail, Phone, Copy, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';

const AuthModal = React.lazy(() => import('./auth/AuthModal').then(module => ({ default: module.AuthModal })));




export const Navbar: React.FC<{ isShifted?: boolean }> = ({ isShifted }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const { cartCount, triggerNotification } = useCart();
  const { wishlistCount } = useWishlist();
  const { user, signOut } = useAuth();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Customize', path: '/customize' },
    { name: 'Collections', path: '/collections' },
    { name: 'How it Works', path: '/how-it-works' },
  ];

  return (
    <nav className={`fixed left-0 w-full z-50 bg-brand-white border-b-2 border-brand-black transition-all duration-300 ${isShifted ? 'top-10' : 'top-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex-shrink-0 flex items-center overflow-hidden h-20">
            <Link to="/" className="flex items-center">
              <img 
                src="/logo.png" 
                alt="Posterealm Logo" 
                width={160}
                height={160}
                className="w-auto object-contain"
                style={{ height: '160px' }}
              />
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) => 
                  `text-sm font-bold uppercase tracking-widest transition-colors hover:text-brand-red ${
                    isActive ? 'text-brand-red decoration-2 underline underline-offset-8' : 'text-brand-black'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <div className="relative">
              <button 
                onClick={() => user ? setIsProfileDropdownOpen(!isProfileDropdownOpen) : setIsAuthModalOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
              >
                <User size={24} className={user ? "text-brand-red" : "text-brand-black"} />
              </button>
              
              <AnimatePresence>
                {user && isProfileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white border-2 border-brand-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-2 z-50"
                  >
                    <Link 
                      to="/account" 
                      className="block px-4 py-2 text-sm font-bold text-brand-black hover:bg-gray-100 hover:text-brand-red transition-colors uppercase tracking-wider"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      Account
                    </Link>
                    <Link 
                      to="/account/orders" 
                      className="block px-4 py-2 text-sm font-bold text-brand-black hover:bg-gray-100 hover:text-brand-red transition-colors uppercase tracking-wider"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      Orders
                    </Link>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button 
                      onClick={() => {
                        signOut();
                        setIsProfileDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm font-bold text-brand-black hover:bg-gray-100 hover:text-brand-red transition-colors uppercase tracking-wider"
                    >
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link to="/wishlist" className="p-2 hover:bg-gray-100 rounded-full transition-colors relative" title="Wishlist">
              <Heart size={24} className="text-brand-black" />
              {wishlistCount > 0 && (
                <span className="absolute top-0 right-0 bg-brand-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link to="/cart" className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
              <ShoppingCart size={24} />
              <span className="absolute top-0 right-0 bg-brand-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {cartCount}
              </span>
            </Link>
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <div className="relative">
              <button 
                onClick={() => user ? setIsProfileDropdownOpen(!isProfileDropdownOpen) : setIsAuthModalOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
              >
                <User size={24} className={user ? "text-brand-red" : "text-brand-black"} />
              </button>
              
              <AnimatePresence>
                {user && isProfileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white border-2 border-brand-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-2 z-50"
                  >
                    <Link 
                      to="/account" 
                      className="block px-4 py-2 text-sm font-bold text-brand-black hover:bg-gray-100 hover:text-brand-red transition-colors uppercase tracking-wider text-left"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      Account
                    </Link>
                    <Link 
                      to="/account/orders" 
                      className="block px-4 py-2 text-sm font-bold text-brand-black hover:bg-gray-100 hover:text-brand-red transition-colors uppercase tracking-wider text-left"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      Orders
                    </Link>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button 
                      onClick={() => {
                        signOut();
                        setIsProfileDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm font-bold text-brand-black hover:bg-gray-100 hover:text-brand-red transition-colors uppercase tracking-wider"
                    >
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Link to="/wishlist" className="p-2 hover:bg-gray-100 rounded-full transition-colors relative" title="Wishlist">
              <Heart size={24} className="text-brand-black" />
              {wishlistCount > 0 && (
                <span className="absolute top-0 right-0 bg-brand-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link to="/cart" className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
              <ShoppingCart size={24} />
              <span className="absolute top-0 right-0 bg-brand-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {cartCount}
              </span>
            </Link>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-brand-black hover:bg-gray-100 focus:outline-none"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-brand-white border-t border-brand-black"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => 
                    `block px-3 py-4 text-xl font-display font-bold uppercase tracking-wider border-b border-gray-100 ${
                      isActive ? 'text-brand-red' : 'text-brand-black'
                    }`
                  }
                >
                  {link.name}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <React.Suspense fallback={null}>
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
        />
      </React.Suspense>
    </nav>
  );
};

const InstagramIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const ThreadsIcon = () => (
  <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 24 24">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1.88 14.524c-.752.418-1.58.627-2.483.627-.853 0-1.602-.204-2.247-.611s-1.135-.97-1.47-1.689c-.335-.719-.502-1.564-.502-2.536 0-.964.167-1.808.502-2.531s.824-1.282 1.47-1.677c.646-.395 1.395-.592 2.247-.592.898 0 1.722.207 2.472.622.75.415 1.32.993 1.71 1.734s.585 1.587.585 2.544c0 .942-.192 1.745-.577 2.41s-.946 1.171-1.682 1.517zm.252-3.136c0-.573-.083-1.036-.25-1.391s-.42-.622-.76-.803c-.34-.18-.752-.271-1.238-.271-.475 0-.882.091-1.222.274s-.592.443-.756.784c-.164.341-.246.777-.246 1.309 0 .546.082.99.246 1.334.164.344.417.602.758.775s.748.259 1.22.259c.486 0 .898-.086 1.238-.259s.593-.429.76-.767.25-.79.25-1.356z"/>
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export const Footer = () => {
  const { triggerNotification } = useCart();
  return (
    <footer className="bg-brand-black text-brand-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-12">
          <div className="col-span-1 sm:col-span-2 md:col-span-4">
            <div className="mb-6 flex items-center overflow-hidden" style={{ height: '80px' }}>
              <img 
                src="/logo.png" 
                alt="Posterealm Logo" 
                width={200}
                height={200}
                className="w-auto object-contain"
                style={{ height: '200px', filter: 'invert(1)' }}
              />
            </div>
            <p className="text-gray-400 max-w-md">
              Revolutionizing the way you decorate your walls. From custom designs to 
              flagship materials, we bring your vision to life with bold aesthetics 
              and premium quality.
            </p>
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold uppercase mb-6 text-brand-red">Shop</h3>
            <ul className="space-y-4 text-gray-400">
              <li><Link to="/customize" className="hover:text-white transition-colors">Custom Designs</Link></li>
              <li><Link to="/collections" className="hover:text-white transition-colors">All Posters</Link></li>
              <li><Link to="/collections" className="hover:text-white transition-colors">New Arrivals</Link></li>
              <li><Link to="/collections" className="hover:text-white transition-colors">Bestsellers</Link></li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold uppercase mb-6 text-brand-red">Company</h3>
            <ul className="space-y-4 text-gray-400">
              <li><Link to="/how-it-works" className="hover:text-white transition-colors">How it Works</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold uppercase mb-6 text-brand-red">Socials</h3>
            <ul className="space-y-4 text-gray-400">
              <li>
                <a 
                  href="https://www.instagram.com/posterealm.store/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <InstagramIcon />
                  <span>Instagram</span>
                </a>
              </li>
              <li>
                <a 
                  href="https://www.threads.com/@posterealm.store" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <ThreadsIcon />
                  <span>Threads</span>
                </a>
              </li>
              <li>
                <a 
                  href="https://x.com/posterealm" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <XIcon />
                  <span>X (Twitter)</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold uppercase mb-6 text-brand-red">Contact</h3>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li>
                <div className="flex items-center gap-2">
                  <a 
                    href="mailto:posterealm5@gmail.com" 
                    className="flex items-center gap-2 hover:text-white transition-colors break-all"
                  >
                    <Mail size={16} className="shrink-0" />
                    <span>posterealm5@gmail.com</span>
                  </a>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      const email = 'posterealm5@gmail.com';
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(email);
                      } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = email;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        try {
                          document.execCommand('copy');
                        } catch (err) {
                          console.error('Failed to copy text: ', err);
                        }
                        document.body.removeChild(textarea);
                      }
                      triggerNotification('Email copied successfully');
                    }}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title="Copy Email"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </li>
              <li>
                <a 
                  href="https://wa.me/918949923501?text=Hi%20Posterealm,%20I%20need%20assistance." 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <MessageCircle size={16} className="shrink-0" />
                  <span>WhatsApp Support</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
          <p>© 2026 POSTEREALM. ALL RIGHTS RESERVED.</p>
          <p className="mt-4 md:mt-0">MADE FOR COLLECTORS, BY COLLECTORS.</p>
        </div>
      </div>
    </footer>
  );
};
