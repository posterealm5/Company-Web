import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ExternalLink,
  ChevronRight,
  Megaphone,
  MessageSquare,
  Image as ImageIcon,
  Tag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { SEO } from '../SEO';
import { getNonIndexableMetadata } from '../../services/metadata';

const AdminLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Overview', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { name: 'Products', path: '/admin/products', icon: <Package size={20} /> },
    { name: 'Orders', path: '/admin/orders', icon: <ShoppingBag size={20} /> },
    { name: 'Users', path: '/admin/users', icon: <Users size={20} /> },
    { name: 'Coupons', path: '/admin/coupons', icon: <Tag size={20} /> },
    { name: 'Offers Ticker', path: '/admin/offers', icon: <Megaphone size={20} /> },
    { name: 'Reviews', path: '/admin/reviews', icon: <MessageSquare size={20} /> },
    { name: 'Wall Showcase', path: '/admin/showcase', icon: <ImageIcon size={20} /> },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <SEO metadata={getNonIndexableMetadata('Admin Panel', location.pathname)} />
      {/* Mobile Header */}
      <div className="md:hidden bg-brand-black text-white p-4 flex items-center justify-between sticky top-0 z-[100]">
        <Link to="/" className="text-xl font-black uppercase tracking-tighter">
          POSTER<span className="text-brand-red">REALM</span> ADMIN
        </Link>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 transition-colors rounded-lg active:scale-95">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 z-[90] h-screen w-72 bg-brand-black text-white p-6 pt-24 md:pt-6 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="mb-10 hidden md:block">
            <Link to="/" className="text-2xl font-black uppercase tracking-tighter">
              POSTER<span className="text-brand-red">REALM</span> <span className="text-xs align-top bg-brand-red px-1 rounded ml-1">ADMIN</span>
            </Link>
          </div>

          <nav className="flex-grow space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`
                    flex items-center justify-between px-4 py-3 font-black uppercase text-xs tracking-widest transition-all comic-border border-transparent
                    ${isActive 
                      ? 'bg-brand-red text-white border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    {item.name}
                  </div>
                  {isActive && <ChevronRight size={14} />}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-10 space-y-4 border-t border-white/10">
            <Link 
              to="/" 
              className="flex items-center gap-3 px-4 py-3 font-black uppercase text-xs tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink size={20} />
              View Storefront
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 font-black uppercase text-xs tracking-widest text-brand-red hover:bg-brand-red/10 transition-colors text-left"
            >
              <LogOut size={20} />
              Logout
            </button>
            <div className="p-4 bg-white/5 comic-border border-white/10 mt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Logged in as</p>
              <p className="text-xs font-bold truncate">{profile?.full_name || profile?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-10 pt-10 md:pt-10 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-[80] md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLayout;
