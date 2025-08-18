import React from 'react';
import clsx from 'clsx';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium', 
  className = '', 
  loading = false,
  disabled = false,
  ...props 
}) => {
  const baseClasses = 'font-medium rounded-xl transition-all duration-150 flex items-center justify-center';
  
  const variants = {
    primary: 'bg-brand-green hover:bg-green-500 text-white hover:scale-105',
    secondary: 'bg-brand-blue hover:bg-blue-600 text-white',
    tertiary: 'bg-brand-teal hover:bg-teal-600 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white hover:scale-105',
    warning: 'bg-orange-500 hover:bg-orange-400 text-white hover:scale-105',
    outline: 'border border-white/20 text-text-muted hover:text-text-high hover:bg-white/5',
    ghost: 'text-text-muted hover:text-text-high hover:bg-white/5',
  };

  const sizes = {
    small: 'px-3 py-2 text-sm',
    medium: 'px-6 py-3',
    large: 'px-8 py-4 text-lg',
  };

  const classes = clsx(
    baseClasses,
    variants[variant],
    sizes[size],
    {
      'opacity-50 cursor-not-allowed': disabled || loading,
      'hover:scale-100': disabled || loading,
    },
    className
  );

  return (
    <button 
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
      )}
      {children}
    </button>
  );
};

export default Button;