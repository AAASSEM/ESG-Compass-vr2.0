import React, { forwardRef } from 'react';
import clsx from 'clsx';

const Select = forwardRef(({ 
  label, 
  error, 
  helperText, 
  className = '', 
  required = false,
  options = [],
  placeholder = 'Select an option...',
  ...props 
}, ref) => {
  const selectClasses = clsx(
    'w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-text-high',
    'focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors duration-150',
    'appearance-none bg-no-repeat bg-right bg-[length:16px_16px]',
    {
      'border-red-500 focus:border-red-500 focus:ring-red-500': error,
    },
    className
  );

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-text-high font-medium">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={selectClasses}
          {...props}
        >
          <option value="" className="bg-[#131A2C] text-text-high">{placeholder}</option>
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              className="bg-[#131A2C] text-text-high"
            >
              {option.label}
            </option>
          ))}
        </select>
        <i className="fas fa-chevron-down absolute right-4 top-1/2 transform -translate-y-1/2 text-text-muted pointer-events-none"></i>
      </div>
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-text-muted text-xs">{helperText}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;