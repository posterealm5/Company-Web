import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, User, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { signIn, signUp, signInWithGoogle, resetPassword } from '../../services/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { PasswordInput } from '../ui/PasswordInput';
import { mapAuthError } from '../../utils/authErrors';
import { useNotification } from '../../context/NotificationContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot_password';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState<number | null>(null);

  const [validationErrors, setValidationErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});

  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const { triggerNotification } = useNotification();

  // Cooldown countdown timer
  useEffect(() => {
    if (forgotCooldown === null) return;
    if (forgotCooldown === 0) {
      setForgotCooldown(null);
      return;
    }
    const timer = setTimeout(() => {
      setForgotCooldown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [forgotCooldown]);

  // Auto-focus on mode switch or modal open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (mode === 'signup') {
          fullNameRef.current?.focus();
        } else if (mode === 'login') {
          emailRef.current?.focus();
        } else if (mode === 'forgot_password') {
          emailRef.current?.focus();
        }
      }, 150); // Wait for scale transition to complete
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode]);

  // Listen for Escape key to close the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Listen for automatic email verification and session detection
  useEffect(() => {
    if (!isOpen || !success || mode !== 'signup') return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && currentSession?.user) {
        triggerNotification('Email Verified!', 'Welcome to Posterealm.', 'success');
        setTimeout(() => {
          onClose();
        }, 700);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isOpen, success, mode, onClose, triggerNotification]);

  // Reset state when modal opens/closes or mode changes
  const resetState = () => {
    setError(null);
    setSuccess(null);
    setPassword('');
    setValidationErrors({});
    // Keep email and fullName to prevent re-typing when switching modes
  };

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    resetState();
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: undefined }));
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (validationErrors.password) {
      setValidationErrors(prev => ({ ...prev, password: undefined }));
    }
  };

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    if (validationErrors.fullName) {
      setValidationErrors(prev => ({ ...prev, fullName: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (mode === 'signup') {
      if (!fullName.trim()) {
        errors.fullName = 'Please enter your full name.';
      }
      if (!email.trim()) {
        errors.email = 'Please enter a valid email address.';
      } else if (!emailRegex.test(email)) {
        errors.email = 'Please enter a valid email address.';
      }
      if (!password) {
        errors.password = 'Password must contain at least 8 characters.';
      } else if (password.length < 8) {
        errors.password = 'Password must contain at least 8 characters.';
      }
    } else if (mode === 'login') {
      if (!email.trim()) {
        errors.email = 'Please enter your email address.';
      } else if (!emailRegex.test(email)) {
        errors.email = 'Please enter a valid email address.';
      }
      if (!password) {
        errors.password = 'Please enter your password.';
      }
    } else if (mode === 'forgot_password') {
      if (!email.trim()) {
        errors.email = 'Please enter your email address.';
      } else if (!emailRegex.test(email)) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || googleLoading || forgotCooldown !== null) return;

    if (!isSupabaseConfigured()) {
      const configErr = {
        title: 'Connection problem',
        message: 'Authentication is not configured. Please connect to Supabase.',
      };
      setError(configErr);
      triggerNotification(configErr.title, configErr.message, 'error');
      return;
    }

    if (!validateForm()) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        
        triggerNotification('Welcome Back!', "You've successfully signed in.", 'success');
        setTimeout(() => {
          onClose();
        }, 600);
      } else if (mode === 'signup') {
        const { session, error } = await signUp(email, password, fullName);
        if (error) throw error;
        
        if (!session) {
          triggerNotification('Verify Your Email', "We've sent a verification link to your email address.", 'success');
          setSuccess("We've sent a verification link to your email address. Please verify your email before signing in.");
        } else {
          triggerNotification('Account Created!', 'Welcome to Posterealm.', 'success');
          setTimeout(() => {
            onClose();
          }, 600);
        }
      } else if (mode === 'forgot_password') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        
        triggerNotification('Check Your Inbox', "We've sent you a password reset link.", 'success');
        setSuccess("We've sent you a password reset link.");
        setForgotCooldown(30);
      }
    } catch (err: any) {
      const mapped = mapAuthError(err);
      setError(mapped);
      triggerNotification(mapped.title, mapped.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading || googleLoading) return;

    if (!isSupabaseConfigured()) {
      const configErr = {
        title: 'Connection problem',
        message: 'Authentication is not configured. Please connect to Supabase.',
      };
      setError(configErr);
      triggerNotification(configErr.title, configErr.message, 'error');
      return;
    }
    
    setGoogleLoading(true);
    setError(null);
    
    try {
      sessionStorage.setItem('pending_google_login', 'true');
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      const mapped = mapAuthError(err);
      setError(mapped);
      triggerNotification(mapped.title, mapped.message, 'error');
      setGoogleLoading(false);
    }
  };

  if (!isOpen) return null;

  const isAnyLoading = loading || googleLoading;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md max-h-[90vh] bg-brand-white border-2 border-brand-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-brand-black bg-gray-50 flex-shrink-0">
            <div className="w-20 flex justify-start">
              {mode !== 'login' && (
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:text-brand-red focus:text-brand-red focus:outline-none transition-colors duration-200 cursor-pointer"
                  aria-label="Go back"
                >
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </button>
              )}
            </div>
            <h2 className="text-2xl font-display font-bold uppercase tracking-wider text-center flex-grow">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot_password' && 'Reset Password'}
            </h2>
            <div className="w-20 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors focus:outline-none focus:bg-gray-200 cursor-pointer"
                aria-label="Close"
              >
                <X size={20} className="text-brand-black" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 overflow-y-auto flex-grow">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-brand-red flex items-start gap-3">
                <AlertCircle className="text-brand-red shrink-0 mt-0.5" size={20} />
                <div className="text-left">
                  <h4 className="font-bold text-brand-red text-sm uppercase leading-tight">{error.title}</h4>
                  <p className="text-xs text-brand-red mt-1 font-medium leading-normal">{error.message}</p>
                </div>
              </div>
            )}

            {mode === 'signup' && success ? (
              <div className="text-center py-6 space-y-6">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-green-50 rounded-full border-2 border-brand-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Mail className="text-green-600 animate-pulse" size={32} />
                  </div>
                  <h3 className="text-xl font-display font-bold uppercase tracking-wider mt-2">
                    Verify Your Email
                  </h3>
                </div>
                
                <div className="space-y-4 max-w-sm mx-auto">
                  <p className="text-sm font-medium text-gray-700 leading-relaxed">
                    We've sent a verification link to your email address.
                  </p>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed">
                    Please check your inbox and click the verification link.
                  </p>
                  <p className="text-xs font-bold text-brand-black uppercase tracking-wider bg-gray-50 p-3 border-2 border-brand-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    This page will automatically continue once your email has been verified.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                  <Loader2 className="animate-spin text-brand-red" size={16} />
                  <span>Waiting for verification...</span>
                </div>
              </div>
            ) : (
              <>
                {success && (
                  <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 flex items-start gap-3">
                    <AlertCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
                    <div className="text-left">
                      <h4 className="font-bold text-green-700 text-sm uppercase leading-tight">Success</h4>
                      <p className="text-xs text-green-700 mt-1 font-medium leading-normal">{success}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-wider text-brand-black mb-2 text-left">
                        Full Name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User size={18} className="text-gray-400" />
                        </div>
                        <input
                          type="text"
                          ref={fullNameRef}
                          value={fullName}
                          onChange={(e) => handleFullNameChange(e.target.value)}
                          disabled={isAnyLoading}
                          className="block w-full pl-10 pr-3 py-3 border-2 border-brand-black bg-white focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 text-brand-black font-medium"
                          placeholder="John Doe"
                        />
                      </div>
                      {validationErrors.fullName && (
                        <p className="mt-1.5 text-xs font-bold text-brand-red uppercase tracking-wider text-left">
                          {validationErrors.fullName}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wider text-brand-black mb-2 text-left">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={18} className="text-gray-400" />
                      </div>
                      <input
                        type="email"
                        ref={emailRef}
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        disabled={isAnyLoading}
                        className="block w-full pl-10 pr-3 py-3 border-2 border-brand-black bg-white focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 text-brand-black font-medium"
                        placeholder="you@example.com"
                      />
                    </div>
                    {validationErrors.email && (
                      <p className="mt-1.5 text-xs font-bold text-brand-red uppercase tracking-wider text-left">
                        {validationErrors.email}
                      </p>
                    )}
                  </div>

                  {mode !== 'forgot_password' && (
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-wider text-brand-black mb-2 text-left">
                        Password
                      </label>
                      <PasswordInput
                        ref={passwordRef}
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        disabled={isAnyLoading}
                        placeholder="••••••••"
                      />
                      {validationErrors.password && (
                        <p className="mt-1.5 text-xs font-bold text-brand-red uppercase tracking-wider text-left">
                          {validationErrors.password}
                        </p>
                      )}
                    </div>
                  )}

                  {mode === 'login' && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleModeChange('forgot_password')}
                        className="text-sm font-bold text-brand-black hover:text-brand-red transition-colors underline-offset-4 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAnyLoading || forgotCooldown !== null}
                    className="w-full bg-brand-red text-white font-bold uppercase tracking-wider py-4 hover:bg-red-700 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span>
                          {mode === 'login' && 'Signing In...'}
                          {mode === 'signup' && 'Creating Account...'}
                          {mode === 'forgot_password' && 'Sending...'}
                        </span>
                      </div>
                    ) : forgotCooldown !== null ? (
                      `Resend available in ${forgotCooldown}s`
                    ) : mode === 'login' ? (
                      'Sign In'
                    ) : mode === 'signup' ? (
                      'Create Account'
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </form>

                {(mode === 'login' || mode === 'signup') && (
                  <>
                    <div className="mt-6 flex items-center">
                      <div className="flex-grow border-t border-gray-300"></div>
                      <span className="flex-shrink-0 mx-4 text-gray-500 text-sm font-bold uppercase">Or</span>
                      <div className="flex-grow border-t border-gray-300"></div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isAnyLoading}
                      className="mt-6 w-full bg-white border-2 border-brand-black text-brand-black font-bold uppercase tracking-wider py-3.5 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {googleLoading ? (
                        <>
                          <Loader2 className="animate-spin text-brand-black" size={20} />
                          <span>Connecting to Google...</span>
                        </>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25C22.56 11.4 22.48 10.58 22.34 9.8H12V14.43H17.92C17.67 15.93 16.8 17.21 15.53 18.06V21.03H19.09C21.17 19.12 22.56 16.24 22.56 12.25Z" fill="#4285F4"/>
                            <path d="M12 23C14.97 23 17.46 22.02 19.09 21.03L15.53 18.06C14.65 18.65 13.42 19.01 12 19.01C9.25 19.01 6.92 17.15 6.08 14.64H2.41V17.68C4.17 21.18 7.78 23 12 23Z" fill="#34A853"/>
                            <path d="M6.08 14.64C5.86 13.98 5.74 13.29 5.74 12.5C5.74 11.71 5.86 11.02 6.08 10.36V7.32H2.41C1.68 8.77 1.25 10.39 1.25 12.14C1.25 13.89 1.68 15.51 2.41 16.96L6.08 14.64Z" fill="#FBBC05"/>
                            <path d="M12 5.99C13.62 5.99 15.07 6.55 16.21 7.64L19.18 4.67C17.45 3.06 14.96 2 12 2C7.78 2 4.17 3.82 2.41 7.32L6.08 10.36C6.92 7.85 9.25 5.99 12 5.99Z" fill="#EA4335"/>
                          </svg>
                          Continue with Google
                        </>
                      )}
                    </button>
                  </>
                )}
              </>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                {mode === 'login' ? "Don't have an account? " : 
                 mode === 'signup' ? "Already have an account? " : 
                 "Remember your password? "}
                <button
                  type="button"
                  onClick={() => handleModeChange(mode === 'login' ? 'signup' : 'login')}
                  className="font-bold text-brand-black hover:text-brand-red underline underline-offset-4 transition-colors"
                >
                  {mode === 'login' ? 'Sign Up' : 'Log In'}
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
