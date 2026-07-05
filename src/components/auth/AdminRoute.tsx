import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2, AlertCircle, RefreshCw, LogIn } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, profile, loading, isAdmin, authError, retryAuth, signOut } = useAuth();
  const location = useLocation();

  if (authError) {
    return (
      <div className="min-h-screen pt-32 pb-24 bg-brand-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white comic-border border-2 border-brand-black p-8 text-center space-y-6 shadow-[8px_8px_0px_0px_rgba(230,57,70,1)]">
          <div className="w-16 h-16 bg-red-50 border-2 border-brand-red flex items-center justify-center mx-auto text-brand-red rotate-[-3deg]">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black uppercase tracking-tight">Authentication issue detected.</h3>
            <p className="text-gray-500 font-medium text-xs">We encountered a temporary network issue or timeout while verifying your credentials.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={retryAuth}
              className="flex-grow py-3 bg-brand-red text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 comic-border border-white hover:bg-brand-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
            >
              <RefreshCw size={14} /> Retry
            </button>
            <button
              onClick={signOut}
              className="flex-grow py-3 bg-white text-brand-black font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 comic-border border-brand-black hover:bg-gray-50 transition-all"
            >
              <LogIn size={14} /> Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-white">
        <Loader2 className="w-12 h-12 animate-spin text-brand-red" />
      </div>
    );
  }

  // If user is logged in but profile is missing, try to wait a bit longer or handle error
  if (user && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-white p-8 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-brand-red mb-4" />
        <p className="font-black uppercase tracking-widest text-sm">Synchronizing Profile...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
