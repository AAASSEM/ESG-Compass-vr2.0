import React, { forwardRef } from 'react';
import clsx from 'clsx';

const Input = forwardRef(({ 
  label, 
  error, 
  helperText, 
  className = '', 
  required = false,
  ...props 
}, ref) => {
  const inputClasses = clsx(
    'w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-text-high placeholder-text-muted',
    'focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors duration-150',
    {
      'border-red-500 focus:border-red-500 focus:ring-red-500': error,
    },
    className
  );

  // Prevent scroll on number inputs
  const handleWheel = (e) => {
    if (props.type === 'number' && e.target === document.activeElement) {
      e.preventDefault();
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-text-high font-medium">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={inputClasses}
        onWheel={handleWheel}
        {...props}
      />
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-text-muted text-xs">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;