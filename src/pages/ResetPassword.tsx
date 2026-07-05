import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { updatePassword } from '../services/auth';
import { supabase } from '../lib/supabase';
import { PasswordInput } from '../components/ui/PasswordInput';
import { mapAuthError } from '../utils/authErrors';
import { useNotification } from '../context/NotificationContext';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { triggerNotification } = useNotification();

  useEffect(() => {
    // Focus the password input on load
    passwordRef.current?.focus();

    // Check if we have a recovery token in the URL hash
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Ready to reset
      }
    });
  }, []);

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (validationError) {
      setValidationError(null);
    }
  };

  const validateForm = (): boolean => {
    if (!password) {
      setValidationError('Password must contain at least 8 characters.');
      return false;
    }
    if (password.length < 8) {
      setValidationError('Password must contain at least 8 characters.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      
      triggerNotification('Password Updated!', 'You can now sign in using your new password.', 'success');
      
      // Delay navigation slightly to let the user see the success message
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 600);
    } catch (err: any) {
      const mapped = mapAuthError(err);
      setError(mapped);
      triggerNotification(mapped.title, mapped.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-24 max-w-md mx-auto px-4 sm:px-6 lg:px-8 min-h-[70vh]">
      <SEO metadata={getNonIndexableMetadata('Reset Password', '/reset-password')} />
      <div className="bg-brand-white border-2 border-brand-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
        <h1 className="text-2xl font-display font-bold uppercase tracking-wider mb-6 text-center">
          Set New Password
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-brand-red flex items-start gap-3">
            <AlertCircle className="text-brand-red shrink-0 mt-0.5" size={20} />
            <div className="text-left">
              <h4 className="font-bold text-brand-red text-sm uppercase leading-tight">{error.title}</h4>
              <p className="text-xs text-brand-red mt-1 font-medium leading-normal">{error.message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-brand-black mb-2 text-left">
              New Password
            </label>
            <PasswordInput
              ref={passwordRef}
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
            />
            {validationError && (
              <p className="mt-1.5 text-xs font-bold text-brand-red uppercase tracking-wider text-left">
                {validationError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red text-white font-bold uppercase tracking-wider py-4 hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                <span>Updating Password...</span>
              </div>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
