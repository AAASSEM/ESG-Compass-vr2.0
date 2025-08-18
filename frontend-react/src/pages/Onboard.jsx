import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import LocationsStep from '../components/onboarding/LocationsStep';
import ESGScopingWizard from '../components/onboarding/ESGScopingWizard';
import { esgAPI } from '../services/api';

const Onboard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [companyId, setCompanyId] = useState(null);
  const [isManualStep, setIsManualStep] = useState(false); // Track if step was manually set
  const [locationData, setLocationData] = useState([]);
  const [esgData, setEsgData] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false); // Track if viewing completed onboarding
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Function to scroll to top of page
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Force fresh data when component mounts
  useEffect(() => {
    queryClient.invalidateQueries('company');
    
    // Reset component state on mount
    setLocationData([]);
    setEsgData(null);
    setIsManualStep(false);
  }, [queryClient]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      name: '',
      business_sector: '',
      employee_size: '',
      emirate: '',
      license_type: '',
      main_location: ''
    }
  });

  // Load existing company data
  const { data: company, isLoading } = useQuery(
    'company',
    () => esgAPI.getCompany(),
    {
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0, // Always fetch fresh data
      cacheTime: 0, // Don't cache data
      onSuccess: (data) => {
        if (data && data.onboarding_completed) {
          // Instead of redirecting, show onboarding in view mode
          setIsViewMode(true);
          setCurrentStep(4); // Show completion step by default
        }
        
        if (data) {
          setCompanyId(data.id);
          // Only set step from data if user hasn't manually navigated and not in view mode
          if (!isManualStep && !data.onboarding_completed) {
            setCurrentStep(data.setup_step || 1);
          }
          
          // Always populate form with existing data from company fields
          Object.keys(data).forEach(key => {
            if (data[key]) setValue(key, data[key]);
          });
          
          // Populate from scoping_data if available first
          if (data.scoping_data) {
            const scopingData = data.scoping_data;
            
            // Step 1: Business Information - map scoping_data fields to form fields
            if (scopingData.business_name) setValue('name', scopingData.business_name);
            if (scopingData.business_sector) setValue('business_sector', scopingData.business_sector);
            if (scopingData.employee_size) setValue('employee_size', scopingData.employee_size);
            if (scopingData.emirate) setValue('emirate', scopingData.emirate);  
            if (scopingData.license_type) setValue('license_type', scopingData.license_type);
            if (scopingData.main_location) setValue('main_location', scopingData.main_location);
          }
          
          // Then override with company data (from signup) to ensure it takes precedence
          if (data.business_sector) {
            setValue('business_sector', data.business_sector);
          }
          
          // Handle Step 2 and Step 3 data restoration
          if (data.scoping_data) {
            const scopingData = data.scoping_data;
            
            
            // Step 2: Locations
            if (scopingData.locations) {
              setLocationData(scopingData.locations);
            }
            
            // Step 3: ESG Assessment
            if (scopingData.esg_assessment) {
              setEsgData(scopingData.esg_assessment);
            } else {
              // Clear ESG data if not in scoping_data
              setEsgData(null);
            }
            
          } else {
            // No scoping data - clear all state
            setLocationData([]);
            setEsgData(null);
          }
        }
      },
      onError: (error) => {
        // No company found, start fresh
      }
    }
  );

  // Debug step changes and restore form data when navigating in view mode
  useEffect(() => {
    
    // In view mode, make sure form data is restored when switching steps
    if (isViewMode && company?.scoping_data) {
      const scopingData = company.scoping_data;
      
      // Force refresh form values when stepping through in view mode - correct field mapping
      if (scopingData.business_name) setValue('name', scopingData.business_name);
      if (scopingData.employee_size) setValue('employee_size', scopingData.employee_size);
      if (scopingData.emirate) setValue('emirate', scopingData.emirate);
      if (scopingData.license_type) setValue('license_type', scopingData.license_type);
      if (scopingData.main_location) setValue('main_location', scopingData.main_location);
      
      // Always prioritize company.business_sector over scoping_data
      if (company?.business_sector) {
        setValue('business_sector', company.business_sector);
      } else if (scopingData.business_sector) {
        setValue('business_sector', scopingData.business_sector);
      }
      
    }
  }, [currentStep, isViewMode, setValue, company]);

  // Additional useEffect to restore form data when company data becomes available
  useEffect(() => {
    if (company && isViewMode && company.scoping_data) {
      const scopingData = company.scoping_data;
      
      
      // Restore all form values from scoping_data
      if (scopingData.business_name) setValue('name', scopingData.business_name);
      if (scopingData.employee_size) setValue('employee_size', scopingData.employee_size);
      if (scopingData.emirate) setValue('emirate', scopingData.emirate);
      if (scopingData.license_type) setValue('license_type', scopingData.license_type);
      if (scopingData.main_location) setValue('main_location', scopingData.main_location);
      
      // Always prioritize company.business_sector over scoping_data
      if (company?.business_sector) {
        setValue('business_sector', company.business_sector);
      } else if (scopingData.business_sector) {
        setValue('business_sector', scopingData.business_sector);
      }
      
      // Also restore location data
      if (scopingData.locations) {
        setLocationData(scopingData.locations);
      }
      
      // Also restore ESG data
      if (scopingData.esg_assessment) {
        setEsgData(scopingData.esg_assessment);
      }
      
    }
  }, [company, isViewMode, setValue]);

  // Create/Update company mutation
  const updateCompanyMutation = useMutation(
    (data) => {
      // Always try to update company - the API will handle create vs update logic
      return esgAPI.updateCompany(companyId, data);
    },
    {
      onSuccess: (data) => {
        setCompanyId(data.id);
        // Invalidate cache to ensure fresh data is available
        queryClient.invalidateQueries('company');
        toast.success('Information saved successfully!');
      },
      onError: (error) => {
        toast.error('Failed to save information. Please try again.');
      }
    }
  );

  // Create location mutation
  const createLocationMutation = useMutation(
    (locationData) => esgAPI.createLocation(locationData),
    {
      onSuccess: () => {
        toast.success('Location information saved! Moving to next step...');
        setTimeout(() => navigate('/dashboard'), 1500);
      },
      onError: (error) => {
        toast.error('Failed to save location information.');
      }
    }
  );

  const industryOptions = [
    { value: 'hospitality', label: 'Hospitality & Tourism' },
    { value: 'construction', label: 'Construction & Real Estate' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'logistics', label: 'Logistics & Transportation' },
    { value: 'education', label: 'Education' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'retail', label: 'Retail & E-commerce' },
    { value: 'technology', label: 'Technology & Software' }
  ];

  const employeeSizeOptions = [
    { value: '1-10', label: '1-10 employees' },
    { value: '11-50', label: '11-50 employees' },
    { value: '51-200', label: '51-200 employees' },
    { value: '201-500', label: '201-500 employees' },
    { value: '500+', label: '500+ employees' }
  ];

  const emirateOptions = [
    { value: 'abu-dhabi', label: 'Abu Dhabi' },
    { value: 'dubai', label: 'Dubai' },
    { value: 'sharjah', label: 'Sharjah' },
    { value: 'ajman', label:'Ajman' },
    { value: 'umm-al-quwain', label: 'Umm Al Quwain' },
    { value: 'ras-al-khaimah', label: 'Ras Al Khaimah' },
    { value: 'fujairah', label: 'Fujairah' }
  ];

  const licenseTypeOptions = [
    { value: 'commercial', label: 'Commercial' },
    { value: 'professional', label: 'Professional' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'tourism', label: 'Tourism' },
    { value: 'free-zone', label: 'Free Zone' }
  ];

  const stepTitles = [
    'Business Information',
    'Locations & Facilities',  
    'ESG Assessment',
    'Complete Setup'
  ];

  const stepDescriptions = [
    "Provide your company details to customize your ESG assessment and ensure compliance with UAE regulations.",
    "Configure all business locations and facilities for comprehensive ESG coverage.",
    "Complete your sustainability assessment to generate personalized compliance tasks.",
    "Review your configuration and access your personalized ESG compliance roadmap."
  ];

  const handleStep1Submit = async (data) => {
    const businessData = {
      business_name: data.name,
      industry: data.business_sector,
      employee_count: data.employee_size,
      emirate_location: data.emirate,
      license_type: data.license_type
    };

    updateCompanyMutation.mutate(businessData, {
      onSuccess: async (result) => {
        
        // Also save to scoping_data for persistence
        try {
          const scopingData = {
            scoping_data: {
              business_name: data.name,
              business_sector: data.business_sector,
              employee_size: data.employee_size,
              emirate: data.emirate,
              license_type: data.license_type,
              main_location: data.main_location || 'Dubai, UAE',
              step_1_completed: true,
              step_1_completed_at: new Date().toISOString()
            },
            setup_step: 2
          };
          
          await esgAPI.updateScopingData(scopingData);
          
        } catch (error) {
        }
        
        setIsManualStep(true); // Mark as manually navigated
        setCurrentStep(2);
        scrollToTop();
      },
      onError: (error) => {
      }
    });
  };

  const handleLocationDataComplete = async (locations) => {
    setLocationData(locations);
    
    // Save locations data to scoping_data
    try {
      const scopingData = {
        scoping_data: {
          locations: locations,
          step_2_completed: true,
          step_2_completed_at: new Date().toISOString()
        },
        setup_step: 3
      };
      
      await esgAPI.updateScopingData(scopingData);
      
    } catch (error) {
    }
    
    setIsManualStep(true);
    setCurrentStep(3); // Move to ESG Assessment
    scrollToTop();
  };

  const handleESGComplete = async (results) => {
    setEsgData(results);
    
    // Save ESG assessment data to scoping_data
    try {
      const scopingData = {
        scoping_data: {
          esg_assessment: results,
          step_3_completed: true,
          step_3_completed_at: new Date().toISOString()
        },
        setup_step: 4,
        esg_scoping_completed: true
      };
      
      await esgAPI.updateScopingData(scopingData);
      
      // Invalidate tasks cache so new tasks appear without logout/login
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('dashboard-overview');
      
    } catch (error) {
    }
    
    setIsManualStep(true);
    setCurrentStep(4); // Move to completion
    scrollToTop();
  };

  const handleCompleteOnboarding = async () => {
    // Save final completion status to database
    try {
      const scopingData = {
        scoping_data: {
          step_4_completed: true,
          step_4_completed_at: new Date().toISOString(),
          onboarding_flow_completed: true,
          final_business_data: watch(),
          final_location_data: locationData,
          final_esg_data: esgData
        },
        onboarding_completed: true,
        setup_step: 4
      };
      
      
      const response = await esgAPI.updateScopingData(scopingData);
      
      // Give the backend a moment to generate tasks
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force refresh task and dashboard cache after task generation
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('dashboard-overview');
      queryClient.invalidateQueries('company');
      toast.success('🎉 Onboarding completed! Your ESG tasks have been generated.');
      
    } catch (error) {
      
      // Still proceed to mark as completed locally, but show warning
      toast.error('Warning: Onboarding saved locally but may need to sync to server');
    }
    
    // Mark onboarding as completed
    localStorage.setItem('onboardingCompleted', 'true');
    
    // Save final state (keep existing functionality)
    const onboardingData = {
      businessData: watch(),
      locationData,
      esgData,
      completedAt: new Date().toISOString()
    };
    
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const companyIdKey = companyId || currentUser.company_id || 'temp';
    localStorage.setItem(`onboarding_complete_${companyIdKey}`, JSON.stringify(onboardingData));
    
    toast.success('Onboarding completed successfully!');
    navigate('/tasks');
  };

  const getStepProgress = () => (currentStep / 4) * 100;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-text-high font-bold text-xl mb-2">Onboarding Setup</h2>
                  <p className="text-text-muted text-sm">Step {currentStep} of 4</p>
                </div>

                <div className="space-y-4">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step}>
                      <div 
                        className={`flex items-center space-x-3 ${
                          isViewMode ? 'cursor-pointer hover:bg-white/5 rounded-lg p-2 -m-2' : ''
                        }`}
                        onClick={isViewMode ? () => setCurrentStep(step) : undefined}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          step <= currentStep 
                            ? 'bg-brand-green text-white' 
                            : 'bg-white/20 text-text-muted'
                        }`}>
                          <span className="text-sm font-semibold">{step}</span>
                        </div>
                        <div>
                          <div className={`font-medium ${
                            step <= currentStep ? 'text-text-high' : 'text-text-muted'
                          }`}>
                            {['Business Information', 'Locations & Facilities', 'ESG Assessment', 'Complete Setup'][step - 1]}
                          </div>
                          <div className="text-text-muted text-xs">
                            {['Company details', 'Sites & facilities', 'Sustainability assessment', 'Review & finalize'][step - 1]}
                          </div>
                        </div>
                      </div>
                      {step < 4 && (
                        <div className="ml-4 w-0.5 h-8 bg-white/20"></div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Progress</span>
                    <span>{Math.round(getStepProgress())}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div 
                      className="bg-brand-green h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getStepProgress()}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <div className="space-y-8">
                {/* Step Header */}
                <div className="space-y-2">
                  {isViewMode && (
                    <div className="bg-brand-green/10 border border-brand-green/30 rounded-xl p-4 mb-6">
                      <div className="flex items-center space-x-3">
                        <i className="fas fa-eye text-brand-green"></i>
                        <div>
                          <h4 className="text-brand-green font-semibold">Viewing Completed Onboarding</h4>
                          <p className="text-text-muted text-sm">You can review your answers and navigate between steps. Changes are not allowed in view mode.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <h1 className="text-text-high font-bold text-2xl flex items-center">
                    <i className={`fa-solid mr-3 ${
                      currentStep === 1 ? 'fa-building text-brand-blue' :
                      currentStep === 2 ? 'fa-map-marker-alt text-brand-blue' :
                      currentStep === 3 ? 'fa-clipboard-check text-brand-green' :
                      'fa-check text-brand-green'
                    }`}></i>
                    {stepTitles[currentStep - 1]}
                  </h1>
                  <p className="text-text-muted">
                    {isViewMode ? "Review your completed " + stepDescriptions[currentStep - 1].toLowerCase() : stepDescriptions[currentStep - 1]}
                  </p>
                </div>

                {/* Step 1: Business Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <Input
                      label="Business Name"
                      placeholder="Enter your company name"
                      required={!isViewMode}
                      error={!isViewMode ? errors.name?.message : undefined}
                      helperText={isViewMode ? "Business name from your profile" : "This will appear on your ESG reports and certificates"}
                      disabled={isViewMode}
                      {...register('name', {
                        required: !isViewMode ? 'Business name is required' : false
                      })}
                    />

                    <Select
                      label="Industry"
                      placeholder="Select your industry"
                      required={!isViewMode}
                      options={industryOptions}
                      error={!isViewMode ? errors.business_sector?.message : undefined}
                      helperText={isViewMode ? "Industry from your signup" : (company?.business_sector ? "Industry from your signup (read-only)" : "Select your industry")}
                      disabled={isViewMode || !!company?.business_sector} // Make read-only if view mode or company has business_sector
                      {...register('business_sector', {
                        required: !isViewMode ? 'Industry selection is required' : false
                      })}
                    />

                    <Select
                      label="Number of Employees"
                      placeholder="Select range"
                      required={!isViewMode}
                      options={employeeSizeOptions}
                      error={!isViewMode ? errors.employee_size?.message : undefined}
                      helperText={isViewMode ? "Employee count range" : "Determines reporting requirements"}
                      disabled={isViewMode}
                      {...register('employee_size', {
                        required: !isViewMode ? 'Employee size is required' : false
                      })}
                    />

                    <div className="grid grid-cols-1 gap-6">
                      <Select
                        label="Business License Type"
                        placeholder="Select license type"
                        options={licenseTypeOptions}
                        disabled={isViewMode}
                        helperText={isViewMode ? "Business license type" : undefined}
                        {...register('license_type')}
                      />
                    </div>

                    {!isViewMode ? (
                      <form onSubmit={handleSubmit(handleStep1Submit)} className="contents">
                        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/10">
                          <Button
                            type="submit"
                            variant="primary"
                            size="large"
                            loading={updateCompanyMutation.isLoading}
                            disabled={!isValid}
                            className="flex-1"
                          >
                            Continue to Locations
                            <i className="fas fa-arrow-right ml-2"></i>
                          </Button>
                          <Button
                            variant="outline"
                            size="large"
                            onClick={() => navigate('/dashboard')}
                          >
                            Cancel Setup
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/10">
                        <Button
                          variant="primary"
                          size="large"
                          onClick={() => {
                            setCurrentStep(2);
                            scrollToTop();
                          }}
                          className="flex-1"
                        >
                          View Locations
                          <i className="fas fa-arrow-right ml-2"></i>
                        </Button>
                        <Button
                          variant="outline"
                          size="large"
                          onClick={() => navigate('/dashboard')}
                        >
                          Back to Dashboard
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Locations */}
                {currentStep === 2 && (
                  <LocationsStep
                    onComplete={handleLocationDataComplete}
                    onBack={() => {
                      setCurrentStep(1);
                      scrollToTop();
                    }}
                    initialData={locationData}
                    isViewMode={isViewMode}
                    onNextStep={() => {
                      setCurrentStep(3);
                      scrollToTop();
                    }}
                  />
                )}

                {/* Step 3: ESG Assessment */}
                {currentStep === 3 && (
                  <ESGScopingWizard
                    companyId={companyId}
                    businessSector={watch('business_sector')}
                    onComplete={handleESGComplete}
                    onBack={() => {
                      setCurrentStep(2);
                      scrollToTop();
                    }}
                    isViewMode={isViewMode}
                    onNextStep={() => {
                      setCurrentStep(4);
                      scrollToTop();
                    }}
                  />
                )}

                {/* Step 4: Completion */}
                {currentStep === 4 && (
                  <div className="space-y-8">
                    <div className="text-center space-y-6">
                      <div className="w-24 h-24 mx-auto bg-brand-green/20 rounded-full flex items-center justify-center mb-6">
                        <i className="fa-solid fa-check text-4xl text-brand-green"></i>
                      </div>
                      <h2 className="text-3xl font-bold text-text-high">
                        Setup Complete!
                      </h2>
                      <p className="text-text-muted text-lg max-w-2xl mx-auto">
                        Congratulations! Your ESG platform is now configured and ready to use. 
                        We've generated a comprehensive compliance roadmap tailored to your business.
                      </p>

                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <div className="text-2xl font-bold text-brand-green">
                            {watch('business_sector') || 'Technology'}
                          </div>
                          <div className="text-text-muted text-sm">Business Sector</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <div className="text-2xl font-bold text-brand-green">
                            {locationData.length || 1}
                          </div>
                          <div className="text-text-muted text-sm">Locations</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <div className="text-2xl font-bold text-brand-green">
                            {company?.scoping_data?.esg_assessment?.answeredQuestions || esgData?.answeredQuestions || 0}
                          </div>
                          <div className="text-text-muted text-sm">ESG Questions</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <div className="text-2xl font-bold text-brand-green">
                            {Math.round(company?.scoping_data?.esg_assessment?.completionRate || esgData?.completionRate || 0)}%
                          </div>
                          <div className="text-text-muted text-sm">Complete</div>
                        </div>
                      </div>

                      {/* Next Steps */}
                      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-xl p-6 text-left">
                        <h4 className="text-lg font-semibold text-brand-blue mb-3 flex items-center">
                          <i className="fa-solid fa-rocket mr-2"></i>
                          What's Next?
                        </h4>
                        <ul className="space-y-2 text-text-muted">
                          <li className="flex items-center space-x-2">
                            <i className="fas fa-check text-brand-green"></i>
                            <span>Review your personalized ESG tasks in Task Management</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <i className="fas fa-check text-brand-green"></i>
                            <span>Start uploading evidence for high-priority requirements</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <i className="fas fa-check text-brand-green"></i>
                            <span>Monitor your progress on the Dashboard</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <i className="fas fa-check text-brand-green"></i>
                            <span>Generate reports for compliance audits</span>
                          </li>
                        </ul>
                      </div>

                      {!isViewMode ? (
                        <Button
                          variant="primary"
                          size="large"
                          onClick={handleCompleteOnboarding}
                          className="px-12"
                        >
                          Go to Tasks
                          <i className="fas fa-arrow-right ml-2"></i>
                        </Button>
                      ) : (
                        <div className="flex gap-4 justify-center">
                          <Button
                            variant="outline"
                            size="large"
                            onClick={() => {
                              setCurrentStep(3);
                              scrollToTop();
                            }}
                            className="px-6"
                          >
                            <i className="fas fa-arrow-left mr-2"></i>
                            View ESG Assessment
                          </Button>
                          <Button
                            variant="primary"
                            size="large"
                            onClick={() => navigate('/tasks')}
                            className="px-12"
                          >
                            Go to Tasks
                            <i className="fas fa-arrow-right ml-2"></i>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Help Section */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-start space-x-3">
                    <i className="fas fa-lightbulb text-brand-blue mt-1"></i>
                    <div className="space-y-1">
                      <h4 className="text-text-high font-medium text-sm">Need help?</h4>
                      <p className="text-text-muted text-xs">
                        Our setup wizard guides you through UAE-specific ESG requirements. 
                        You can always update this information later in Settings.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Onboard;