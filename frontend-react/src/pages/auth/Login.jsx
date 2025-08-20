import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await login(data.email, data.password);
      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      const result = await loginDemo();
      if (result.success) {
        toast.success('Demo mode activated! Full database populated.');
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Demo login failed');
      }
    } catch (error) {
      toast.error('Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#131A2C] via-[#1C1330] to-[#131A2C] px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-brand-green rounded-xl flex items-center justify-center">
              <i className="fas fa-compass text-white text-xl"></i>
            </div>
            <span className="text-text-high font-bold text-2xl">ESG Compass</span>
          </div>
        </div>

        <Card className="w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-text-high mb-2">Welcome Back</h1>
            <p className="text-text-muted">Sign in to your ESG management platform</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              required
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              required
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
            />

            <Button
              type="submit"
              variant="primary"
              size="large"
              loading={isLoading}
              className="w-full"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-muted text-sm">
              Don't have an account?{' '}
              <Link 
                to="/register" 
                className="text-brand-green hover:text-green-400 font-medium transition-colors"
              >
                Sign up here
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="large"
              onClick={handleDemoLogin}
              className="w-full mb-4"
              disabled={isLoading}
            >
              <i className="fas fa-eye mr-2"></i>
              View Dashboard Demo
            </Button>
            
            <div className="flex items-center space-x-3 text-sm text-text-muted">
              <i className="fas fa-shield-alt text-brand-green"></i>
              <span>Secure login powered by JWT authentication</span>
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-text-muted text-xs">
            ESG Compass - UAE ESG Management Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;