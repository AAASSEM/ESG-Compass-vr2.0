import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../ui/UserAvatar';

const Header = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'fa-solid fa-chart-pie' },
    { path: '/onboard', label: 'Data Wizard', icon: 'fa-solid fa-database' },
    { path: '/tracker', label: 'Progress Tracker', icon: 'fa-solid fa-chart-line' },
    { path: '/tasks', label: 'Tasks', icon: 'fa-solid fa-tasks' },
    { path: '/reports', label: 'Reports Hub', icon: 'fa-solid fa-file-alt' },
    { path: '/users', label: 'User Management', icon: 'fa-solid fa-users' },
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="relative z-20 px-6 lg:px-20 py-6">
      <nav className="flex items-center justify-between gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-brand-green rounded-xl flex items-center justify-center">
            <i className="fas fa-compass text-white text-lg"></i>
          </div>
          <span className="text-text-high font-bold text-xl">ESG Compass</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex flex-1 justify-center">
          <div className="flex items-center gap-4 bg-white/10 px-2 py-1 rounded-xl">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-text-muted hover:text-text-high hover:bg-brand-green/10 transition-colors font-medium ${
                  isActive(item.path) ? 'bg-white/10 text-text-high' : ''
                }`}
              >
                <i className={`${item.icon} ${isActive(item.path) ? 'text-brand-green' : ''}`}></i>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop User Menu */}
        <div className="hidden lg:flex items-center space-x-3">
          <UserAvatar 
            fullName={user?.full_name}
            email={user?.email}
            size="md"
          />
          <span className="text-text-high text-sm">
            {user?.full_name || user?.email || 'User'}
          </span>
          <button
            onClick={logout}
            className="text-text-muted hover:text-text-high transition-colors ml-2"
            title="Logout"
          >
            <i className="fa-solid fa-sign-out-alt"></i>
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden text-text-high p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Toggle mobile menu"
        >
          <i className={`fa-solid ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-[#131A2C]/95 backdrop-blur-md border-t border-white/10">
          <div className="px-6 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-text-muted hover:text-text-high hover:bg-brand-green/10 transition-colors font-medium ${
                  isActive(item.path) ? 'bg-white/10 text-text-high' : ''
                }`}
              >
                <i className={`${item.icon} ${isActive(item.path) ? 'text-brand-green' : ''}`}></i>
                <span>{item.label}</span>
              </Link>
            ))}
            
            {/* Mobile User Section */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <div className="flex items-center space-x-3 px-4 py-2">
                <UserAvatar 
                  fullName={user?.full_name}
                  email={user?.email}
                  size="sm"
                />
                <span className="text-text-high text-sm">
                  {user?.full_name || user?.email || 'User'}
                </span>
              </div>
              <button
                onClick={() => {
                  logout();
                  closeMobileMenu();
                }}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-text-muted hover:text-text-high hover:bg-red-500/10 transition-colors font-medium w-full"
              >
                <i className="fa-solid fa-sign-out-alt"></i>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;