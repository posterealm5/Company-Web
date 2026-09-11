import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2, AlertCircle, RefreshCw, LogIn } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, authError, retryAuth, signOut } = useAuth();
  const location = useLocation();

  if (authError) {
    return (
      <div className="min-h-screen pt-32 pb-24 bg-brand-white dark:bg-[#0D0D0D] flex items-center justify-center px-4 text-brand-black dark:text-zinc-100">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 comic-border border-2 border-brand-black dark:border-zinc-700 p-8 text-center space-y-6 shadow-[8px_8px_0px_0px_rgba(230,57,70,1)] text-brand-black dark:text-zinc-100">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 border-2 border-brand-red flex items-center justify-center mx-auto text-brand-red rotate-[-3deg]">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black uppercase tracking-tight text-brand-black dark:text-zinc-100">Authentication issue detected.</h3>
            <p className="text-gray-500 dark:text-zinc-400 font-medium text-xs">We encountered a temporary network issue or timeout while verifying your credentials.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={retryAuth}
              className="flex-grow py-3 bg-brand-red text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 comic-border border-white hover:bg-brand-black dark:hover:bg-brand-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
            >
              <RefreshCw size={14} /> Retry
            </button>
            <button
              onClick={signOut}
              className="flex-grow py-3 bg-white dark:bg-zinc-800 text-brand-black dark:text-zinc-100 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 comic-border border-brand-black dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all"
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={48} />
        <p className="text-gray-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-sm">Verifying Session...</p>
      </div>
    );
  }

  if (!user) {
    // Redirect them to the login page, but save the current location they were
    // trying to go to if we want to redirect them after login later.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
