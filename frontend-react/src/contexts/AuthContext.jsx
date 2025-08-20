import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from 'react-query';
import { esgAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check for demo mode
      const demoMode = localStorage.getItem('demo_mode');
      if (demoMode) {
        const demoUser = JSON.parse(localStorage.getItem('user'));
        setUser(demoUser);
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      if (esgAPI.isAuthenticated()) {
        const userData = await esgAPI.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      esgAPI.clearAuth();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const result = await esgAPI.login(email, password);
      if (result.success) {
        // Clear all cached data before setting new user
        queryClient.clear();
        console.log('🧹 Cleared React Query cache on login');
        
        setUser(result.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const result = await esgAPI.register(userData);
      return result;
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Clear demo mode if active
      localStorage.removeItem('demo_mode');
      await esgAPI.logout();
      
      // Clear all React Query cache to prevent data leakage between users
      queryClient.clear();
      console.log('🧹 Cleared React Query cache on logout');
      
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  // Demo mode - login with real demo user from backend
  const loginDemo = async () => {
    setLoading(true);
    try {
      const result = await esgAPI.loginDemo();
      if (result.success) {
        // Clear all cached data before setting new user
        queryClient.clear();
        console.log('🧹 Cleared React Query cache on demo login');
        
        setUser(result.user);
        setIsAuthenticated(true);
        localStorage.setItem('demo_mode', 'true');
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Demo login failed:', error);
      return { success: false, error: 'Demo login failed' };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    loginDemo,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};