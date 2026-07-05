import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Let the user pass standard input props
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockActive, setCapsLockActive] = useState(false);

    const toggleVisibility = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowPassword(prev => !prev);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      setCapsLockActive(e.getModifierState('CapsLock'));
      if (props.onKeyDown) props.onKeyDown(e);
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
      setCapsLockActive(e.getModifierState('CapsLock'));
      if (props.onKeyUp) props.onKeyUp(e);
    };

    return (
      <div className="w-full">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
            <Lock size={18} className="text-gray-400" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            ref={ref}
            className={`block w-full pl-10 pr-12 py-3 border-2 border-brand-black bg-white focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 text-brand-black font-medium ${className}`}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            {...props}
          />
          <button
            type="button"
            onClick={toggleVisibility}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-brand-black focus:outline-none transition-colors z-10 cursor-pointer h-full"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{ width: '44px', justifyContent: 'center' }}
          >
            {showPassword ? (
              <EyeOff size={18} className="shrink-0" />
            ) : (
              <Eye size={18} className="shrink-0" />
            )}
          </button>
        </div>
        {capsLockActive && (
          <p className="mt-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider text-left">
            Caps Lock is ON
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
