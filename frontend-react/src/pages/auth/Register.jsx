import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card from '../../components/ui/Card';
import { getApiBaseURL } from '../../utils/api-config';

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm();

  const watchPassword = watch('password');

  const onSubmit = async (data) => {
    setIsLoading(true);
    console.log('Registration data:', data);  // Debug log
    
    try {
      // Debug: Check API connection
      console.log('Attempting registration with backend at:', getApiBaseURL());
      
      const result = await registerUser({
        email: data.email,
        password: data.password,
        full_name: `${data.first_name} ${data.last_name}`,
        first_name: data.first_name,
        last_name: data.last_name,
        job_title: 'Manager', // Default role as requested
        phone_number: data.phone_number,
        company_name: data.company_name || 'My Company',
        company_description: data.company_description || '',
        business_sector: data.industry || 'other'  // Use industry selection as business_sector
      });
      
      console.log('Registration result:', result);  // Debug log

      if (result.success) {
        toast.success('Registration successful! Please sign in.');
        navigate('/login');
      } else {
        toast.error(result.error || 'Registration failed');
      }
    } catch (error) {
      toast.error('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#131A2C] via-[#1C1330] to-[#131A2C] px-6 py-12">
      <div className="w-full max-w-lg">
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
            <h1 className="text-2xl font-bold text-text-high mb-2">Create Account</h1>
            <p className="text-text-muted">Join the leading ESG management platform in the UAE</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="First name"
                required
                error={errors.first_name?.message}
                {...register('first_name', {
                  required: 'First name is required'
                })}
              />

              <Input
                label="Last Name"
                placeholder="Last name"
                required
                error={errors.last_name?.message}
                {...register('last_name', {
                  required: 'Last name is required'
                })}
              />
            </div>

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

            <Select
              label="Industry"
              placeholder="Select your industry"
              required
              options={[
                { value: 'hospitality', label: 'Hospitality & Tourism' },
                { value: 'construction', label: 'Construction & Real Estate' },
                { value: 'manufacturing', label: 'Manufacturing' },
                { value: 'logistics', label: 'Logistics & Transportation' },
                { value: 'education', label: 'Education' },
                { value: 'healthcare', label: 'Healthcare' },
                { value: 'retail', label: 'Retail & E-commerce' },
                { value: 'technology', label: 'Technology & Software' }
              ]}
              error={errors.industry?.message}
              {...register('industry', {
                required: 'Industry selection is required'
              })}
            />

            <Input
              label="Phone Number"
              type="tel"
              placeholder="+971 XX XXX XXXX"
              error={errors.phone_number?.message}
              {...register('phone_number')}
            />

            <Input
              label="Company Name"
              placeholder="Your company name"
              error={errors.company_name?.message}
              {...register('company_name')}
            />

            <div>
              <label className="block text-text-high font-medium mb-2">
                Company Description
              </label>
              <textarea
                placeholder="Brief description of your company and its activities"
                rows="3"
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-text-high placeholder-text-muted focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors resize-none"
                {...register('company_description')}
              />
              {errors.company_description && (
                <p className="text-red-400 text-sm mt-1">{errors.company_description.message}</p>
              )}
            </div>

            <Input
              label="Password"
              type="password"
              placeholder="Create a strong password"
              required
              error={errors.password?.message}
              helperText="Must be at least 8 characters long"
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters'
                }
              })}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              required
              error={errors.confirm_password?.message}
              {...register('confirm_password', {
                required: 'Password confirmation is required',
                validate: (value) =>
                  value === watchPassword || 'Passwords do not match'
              })}
            />

            <Button
              type="submit"
              variant="primary"
              size="large"
              loading={isLoading}
              className="w-full"
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-muted text-sm">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-brand-green hover:text-green-400 font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-start space-x-3 text-sm text-text-muted">
              <i className="fas fa-info-circle text-brand-blue mt-0.5"></i>
              <div className="space-y-1">
                <p>By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
                <p>Your data is encrypted and stored securely in compliance with UAE data protection laws.</p>
              </div>
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

export default Register;