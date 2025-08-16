import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
// import ReportTestDataLoader from '../components/dev/ReportTestDataLoader'; // Hidden for production
import { esgAPI } from '../services/api';

const Reports = () => {
  const { user } = useAuth();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [downloadingReportIds, setDownloadingReportIds] = useState(new Set());
  const [deletingReportIds, setDeletingReportIds] = useState(new Set());
  const [editingReportId, setEditingReportId] = useState(null);
  const [editingReportName, setEditingReportName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [showNoDataModal, setShowNoDataModal] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    dateRange: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm();

  // Load reports
  const { data: reports, isLoading: reportsLoading } = useQuery(
    ['reports', user?.id],
    () => esgAPI.getReports(),
    {
      select: (data) => Array.isArray(data) ? data : data.results || [],
      enabled: !!user?.id // Only run query when user is loaded
    }
  );

  // Load report templates
  const { data: templates, isLoading: templatesLoading, error: templatesError } = useQuery(
    ['report-templates', user?.id],
    () => esgAPI.getReportTemplates(),
    {
      select: (data) => {
        console.log('Templates API response:', data);
        const result = Array.isArray(data) ? data : data.results || [];
        console.log('Processed templates:', result);
        return result;
      },
      onError: (error) => {
        console.error('Templates loading error:', error);
      },
      retry: 1,
      enabled: !!user?.id, // Only run query when user is loaded
      staleTime: 5 * 60 * 1000, // 5 minutes - can cache templates since they're not user-specific
      cacheTime: 10 * 60 * 1000 // 10 minutes
    }
  );

  // Load company data for context
  const { data: company } = useQuery(
    ['company', user?.id],
    () => esgAPI.getCompany(),
    { 
      retry: 1, 
      staleTime: 5 * 60 * 1000,
      enabled: !!user?.id // Only run query when user is loaded
    }
  );

  // Load tasks to check if user has data
  const { data: tasks } = useQuery(
    ['tasks', user?.id, 'validation'],
    () => esgAPI.getTasks(),
    {
      select: (data) => Array.isArray(data) ? data : data.results || [],
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000
    }
  );

  // Load file data to check if user has uploaded files
  const { data: socialFileData } = useQuery(
    ['social-file-data', user?.id, 'validation'],
    () => esgAPI.getSocialFileData(),
    { enabled: !!user?.id, staleTime: 5 * 60 * 1000 }
  );

  const { data: environmentalFileData } = useQuery(
    ['environmental-file-data', user?.id, 'validation'],
    () => esgAPI.getEnvironmentalFileData(),
    { enabled: !!user?.id, staleTime: 5 * 60 * 1000 }
  );

  const { data: governanceFileData } = useQuery(
    ['governance-file-data', user?.id, 'validation'],
    () => esgAPI.getGovernanceFileData(),
    { enabled: !!user?.id, staleTime: 5 * 60 * 1000 }
  );


  // Generate report mutation
  const generateReportMutation = useMutation(
    (data) => esgAPI.generateReport(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['reports', user?.id]);
        setShowGenerateModal(false);
        reset();
        toast.success('Report generation started! You will be notified when it\'s ready.');
      },
      onError: (error) => {
        console.error('🔧 REPORTS: Generate report error:', error);
        console.error('🔧 REPORTS: Error response:', error.response?.data);
        console.error('🔧 REPORTS: Error status:', error.response?.status);
        console.error('🔧 REPORTS: Full error object:', JSON.stringify(error.response?.data, null, 2));
        
        const errorMessage = error.response?.data?.error || 
                            error.response?.data?.detail || 
                            error.response?.data?.message || 
                            JSON.stringify(error.response?.data) || 
                            error.message;
        
        toast.error(`Failed to generate report: ${errorMessage}`);
      }
    }
  );

  // Download report mutation  
  const downloadReportMutation = useMutation(
    async (reportId) => {
      console.log('🚀 Starting download for report ID:', reportId);
      const result = await esgAPI.downloadReport(reportId);
      console.log('🏁 Download API call finished for:', reportId);
      return { result, reportId };
    },
    {
      onMutate: (reportId) => {
        // Set loading state BEFORE mutation starts
        setDownloadingReportIds(prev => {
          const newSet = new Set(prev);
          newSet.add(reportId);
          console.log('🔧 MUTATE START - Added to loading set:', reportId, 'Set contents:', Array.from(newSet));
          return newSet;
        });
      },
      onSuccess: (data, variables) => {
        console.log('✅ Download success for report ID:', variables);
        console.log('Download success data:', data);
        
        try {
          // data now contains { result: { blob, filename }, reportId }
          const { result } = data;
          const { blob, filename } = result;
          
          console.log('Blob:', blob);
          console.log('Blob type:', typeof blob);
          console.log('Blob constructor:', blob?.constructor?.name);
          console.log('Filename:', filename);
          console.log('File size:', blob?.size, 'bytes');
          
          if (!blob || typeof blob.size === 'undefined') {
            throw new Error('Invalid blob object received');
          }
          
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename || `esg-report-${variables}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast.success(`✅ Downloaded: ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
        } catch (error) {
          console.error('Download processing error:', error);
          toast.error(`Download failed: ${error.message}`);
        }
      },
      onError: (error, variables) => {
        console.error('❌ Download error for report ID:', variables, error);
        toast.error('Failed to download report');
      },
      onSettled: (data, error, variables) => {
        // Always clear loading state when mutation finishes (success or error)
        setDownloadingReportIds(prev => {
          const newSet = new Set(prev);
          const wasPresent = newSet.has(variables);
          newSet.delete(variables);
          console.log('🧹 SETTLED - Removed from loading set:', variables);
          console.log('   Was present before delete:', wasPresent);
          console.log('   Set contents after delete:', Array.from(newSet));
          return newSet;
        });
      }
    }
  );

  // Delete report mutation
  const deleteReportMutation = useMutation(
    async (reportId) => {
      console.log('🗑️ Starting delete for report ID:', reportId);
      const result = await esgAPI.deleteReport(reportId);
      console.log('🏁 Delete API call finished for:', reportId);
      return { result, reportId };
    },
    {
      onMutate: (reportId) => {
        // Set loading state BEFORE mutation starts
        setDeletingReportIds(prev => {
          const newSet = new Set(prev);
          newSet.add(reportId);
          console.log('🔧 DELETE MUTATE START - Added to loading set:', reportId, 'Set contents:', Array.from(newSet));
          return newSet;
        });
      },
      onSuccess: (data, variables) => {
        console.log('✅ Delete success for report ID:', variables);
        queryClient.invalidateQueries(['reports', user?.id]);
        toast.success('Report deleted successfully');
      },
      onError: (error, variables) => {
        console.error('❌ Delete error for report ID:', variables, error);
        const errorMessage = error.response?.data?.error || 
                            error.response?.data?.detail || 
                            error.message;
        toast.error(`Failed to delete report: ${errorMessage}`);
      },
      onSettled: (data, error, variables) => {
        // Always clear loading state when mutation finishes (success or error)
        setDeletingReportIds(prev => {
          const newSet = new Set(prev);
          const wasPresent = newSet.has(variables);
          newSet.delete(variables);
          console.log('🧹 DELETE SETTLED - Removed from loading set:', variables);
          console.log('   Was present before delete:', wasPresent);
          console.log('   Set contents after delete:', Array.from(newSet));
          return newSet;
        });
      }
    }
  );

  // Update report mutation for name editing
  const updateReportMutation = useMutation(
    ({ reportId, name }) => esgAPI.updateReport(reportId, { name }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['reports', user?.id]);
        setEditingReportId(null);
        setEditingReportName('');
        toast.success('Report name updated successfully');
      },
      onError: (error) => {
        console.error('Update report error:', error);
        const errorMessage = error.response?.data?.error || 
                            error.response?.data?.detail || 
                            error.message;
        toast.error(`Failed to update report: ${errorMessage}`);
      }
    }
  );

  // Handle report name editing
  const handleStartEditName = (report) => {
    setEditingReportId(report.id);
    setEditingReportName(report.name || '');
  };

  const handleSaveReportName = () => {
    if (editingReportName.trim()) {
      updateReportMutation.mutate({
        reportId: editingReportId,
        name: editingReportName.trim()
      });
    }
  };

  const handleCancelEditName = () => {
    setEditingReportId(null);
    setEditingReportName('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSaveReportName();
    } else if (e.key === 'Escape') {
      handleCancelEditName();
    }
  };


  // Mock templates for fallback - using proper UUID v4 format
  const mockTemplates = [
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'esg_comprehensive',
      display_name: 'ESG Comprehensive Report',
      description: 'Complete overview of Environmental, Social, and Governance performance with detailed metrics, trends, and recommendations.',
      report_type: 'esg_comprehensive',
      required_frameworks: ['GRI', 'SASB'],
      supported_formats: ['pdf', 'xlsx'],
      is_framework_official: false,
      requires_verification: false
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'dst_compliance',
      display_name: 'Dubai Sustainable Tourism Compliance',
      description: 'Official DST compliance report for Dubai Department of Tourism & Commerce Marketing certification.',
      report_type: 'dst_compliance',
      required_frameworks: ['DST'],
      supported_formats: ['pdf', 'xlsx'],
      is_framework_official: true,
      requires_verification: true
    },
    {
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      name: 'green_key',
      display_name: 'Green Key Certification Report',
      description: 'Environmental sustainability report based on Green Key international eco-label standards with real extracted data from your uploaded documents.',
      report_type: 'green_key',
      required_frameworks: ['Green Key', 'ISO 14001'],
      supported_formats: ['pdf', 'xlsx'],
      is_framework_official: true,
      requires_verification: true
    }
  ];

  // Use only ESG, DST, and Green Key templates (deduplicated by report_type)
  const displayTemplates = templates && templates.length > 0 
    ? templates.filter(t => ['esg_comprehensive', 'dst_compliance', 'green_key'].includes(t.report_type))
        .reduce((acc, template) => {
          // Keep only the first template of each type to avoid duplicates
          if (!acc.find(t => t.report_type === template.report_type)) {
            acc.push(template);
          }
          return acc;
        }, [])
    : [];

  // Convert templates to options for the form
  const reportTemplateOptions = displayTemplates ? displayTemplates.map(template => ({
    value: template.id,
    label: template.display_name,
    description: template.description,
    type: template.report_type,
    frameworks: template.required_frameworks,
    formats: template.supported_formats,
    icon: template.report_type
  })) : [];

  const periodOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annual', label: 'Annual' },
    { value: 'custom', label: 'Custom Range' }
  ];



  const handleGenerateReport = (data) => {
    console.log('🔧 REPORTS: Generate report data:', data);
    
    // Validate data before proceeding with generation
    const validation = validateDataForReportGeneration();
    console.log('📊 REPORTS: Data validation result:', validation);
    
    if (!validation.hasData) {
      console.log('❌ REPORTS: Insufficient data, showing no-data modal');
      setShowGenerateModal(false);
      setShowNoDataModal(true);
      return;
    }
    
    const template = templates?.find(t => t.id === data.template_id) || displayTemplates?.find(t => t.id === data.template_id);
    console.log('🔧 REPORTS: Found template:', template);
    
    if (!data.template_id) {
      toast.error('Please select a report template');
      return;
    }
    
    // Ensure dates are not in the future
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const reportData = {
      template_id: data.template_id,
      name: data.name || `${template?.display_name || 'ESG Report'} - ${format(new Date(), 'MMM dd, yyyy')}`,
      description: data.description || '',
      format: data.format || 'pdf',
      period_start: data.start_date || '2024-01-01',
      period_end: data.end_date || yesterday.toISOString().split('T')[0], // Yesterday's date in YYYY-MM-DD format
      company_name: company?.name || company?.business_name || 'Company Name',
      parameters: {
        include_recommendations: data.include_recommendations || false,
        include_benchmarks: data.include_benchmarks || false,
        include_charts: data.include_charts || true,
        include_trends: data.include_trends || true,
        custom_sections: data.custom_sections || []
      }
    };
    
    console.log('🔧 REPORTS: Sending report data:', reportData);
    generateReportMutation.mutate(reportData);
  };


  const handleDownloadReport = (reportId) => {
    console.log('🔽 Download clicked for report ID:', reportId);
    console.log('🔽 Report object from list:', reports?.find(r => r.id === reportId));
    downloadReportMutation.mutate(reportId);
  };

  const handleDeleteReport = (report) => {
    setReportToDelete(report);
    setShowDeleteModal(true);
  };

  const confirmDeleteReport = () => {
    if (reportToDelete) {
      deleteReportMutation.mutate(reportToDelete.id);
      setShowDeleteModal(false);
      setReportToDelete(null);
    }
  };

  const cancelDeleteReport = () => {
    setShowDeleteModal(false);
    setReportToDelete(null);
  };

  // Check if user has sufficient data for report generation
  const validateDataForReportGeneration = () => {
    // Check if user has tasks from onboarding
    const hasTasks = tasks && tasks.length > 0;
    const hasCompletedTasks = tasks && tasks.some(task => task.status === 'completed' || task.progress_percentage >= 100);
    
    // Check if user has uploaded files with analyzed data
    const socialFilesCount = socialFileData?.files_analyzed || 0;
    const environmentalFilesCount = environmentalFileData?.files_analyzed || 0;
    const governanceFilesCount = governanceFileData?.files_analyzed || 0;
    const totalFilesAnalyzed = socialFilesCount + environmentalFilesCount + governanceFilesCount;
    const hasFileData = totalFilesAnalyzed > 0;
    
    // Check if user has any extracted metrics (non-zero, non-null values)
    const hasValidSocialMetrics = socialFileData && Object.keys(socialFileData).some(key => {
      if (key === 'files_analyzed') return false;
      const value = socialFileData[key];
      return value !== null && value !== undefined && value !== 0 && value !== '';
    });
    
    const hasValidEnvironmentalMetrics = environmentalFileData && Object.keys(environmentalFileData).some(key => {
      if (key === 'files_analyzed') return false;
      const value = environmentalFileData[key];
      return value !== null && value !== undefined && value !== 0 && value !== '';
    });
    
    const hasValidGovernanceMetrics = governanceFileData && Object.keys(governanceFileData).some(key => {
      if (key === 'files_analyzed') return false;
      const value = governanceFileData[key];
      return value !== null && value !== undefined && value !== 0 && value !== '';
    });
    
    const hasMetrics = hasValidSocialMetrics || hasValidEnvironmentalMetrics || hasValidGovernanceMetrics;
    
    // More strict validation: require BOTH tasks AND meaningful data
    const hasMinimumData = hasTasks && (hasCompletedTasks || hasFileData || hasMetrics);
    
    console.log('📊 STRICT Data validation for', user?.full_name || user?.email, ':', {
      hasTasks,
      hasCompletedTasks,
      hasFileData,
      hasMetrics,
      hasMinimumData,
      details: {
        tasksTotal: tasks?.length || 0,
        tasksCompleted: tasks?.filter(t => t.status === 'completed')?.length || 0,
        filesAnalyzed: {
          social: socialFilesCount,
          environmental: environmentalFilesCount,
          governance: governanceFilesCount,
          total: totalFilesAnalyzed
        },
        validMetrics: {
          social: hasValidSocialMetrics,
          environmental: hasValidEnvironmentalMetrics,
          governance: hasValidGovernanceMetrics
        },
        rawData: {
          socialFileData: socialFileData || 'null',
          environmentalFileData: environmentalFileData || 'null',
          governanceFileData: governanceFileData || 'null'
        }
      }
    });
    
    return {
      hasData: hasMinimumData,
      hasTasks,
      hasCompletedTasks,
      hasFileData,
      hasMetrics,
      details: {
        tasksTotal: tasks?.length || 0,
        tasksCompleted: tasks?.filter(t => t.status === 'completed')?.length || 0,
        totalFilesAnalyzed
      }
    };
  };

  const handleSelectTemplate = (template) => {
    // Validate data before proceeding
    const validation = validateDataForReportGeneration();
    
    if (!validation.hasData) {
      setShowNoDataModal(true);
      setShowTemplateModal(false);
      return;
    }
    
    setSelectedTemplate(template);
    
    // Auto-fill the report name with template name + current date
    const defaultName = `${template.display_name} - ${format(new Date(), 'MMM dd, yyyy')}`;
    setValue('name', defaultName);
    setValue('template_id', template.id);
    
    setShowTemplateModal(false);
    setShowGenerateModal(true);
  };

  const handleShareReport = (report) => {
    const shareData = {
      title: `ESG Report: ${report.name}`,
      text: `Check out this ESG report: ${report.name}\n\nGenerated on: ${report.created_at ? format(new Date(report.created_at), 'MMM dd, yyyy') : 'N/A'}\nStatus: ${report.status}\nType: ${report.template?.display_name || report.report_type || 'N/A'}`,
      url: window.location.href
    };

    // Try to use native Web Share API first (mobile/modern browsers)
    if (navigator.share) {
      navigator.share(shareData)
        .then(() => {
          toast.success('Report shared successfully!');
        })
        .catch((error) => {
          console.log('Native share cancelled or failed:', error);
          fallbackShare(report);
        });
    } else {
      // Fallback to copying link to clipboard
      fallbackShare(report);
    }
  };

  const fallbackShare = (report) => {
    // Create shareable text
    const shareText = `ESG Report: ${report.name}\n\nGenerated: ${report.created_at ? format(new Date(report.created_at), 'MMM dd, yyyy') : 'N/A'}\nStatus: ${report.status}\nType: ${report.template?.display_name || report.report_type || 'N/A'}\n\nView at: ${window.location.href}`;
    
    // Try to copy to clipboard
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareText)
        .then(() => {
          toast.success('Report details copied to clipboard!');
        })
        .catch(() => {
          // Final fallback - show shareable text in alert
          showShareDialog(shareText);
        });
    } else {
      // Final fallback for older browsers
      showShareDialog(shareText);
    }
  };

  const showShareDialog = (shareText) => {
    // Create a temporary modal-like alert with shareable content
    const result = window.confirm(`Report details ready to share:\n\n${shareText}\n\nClick OK to close this dialog and manually copy the details above.`);
    if (result) {
      toast.info('You can manually copy the report details from the dialog above.');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'text-brand-green',
      'processing': 'text-brand-blue',
      'failed': 'text-red-500',
      'pending': 'text-yellow-500'
    };
    return colors[status] || 'text-text-muted';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'completed': 'fa-solid fa-check-circle',
      'processing': 'fa-solid fa-spinner fa-spin',
      'failed': 'fa-solid fa-exclamation-circle',
      'pending': 'fa-solid fa-clock'
    };
    return icons[status] || 'fa-solid fa-circle';
  };

  // Filter reports based on current filters
  const filteredReports = reports?.filter(report => {
    if (filters.status !== 'all' && report.status !== filters.status) {
      return false;
    }
    
    if (filters.type !== 'all') {
      const reportType = report.template?.report_type || report.report_type || '';
      if (reportType !== filters.type) {
        return false;
      }
    }
    
    if (filters.dateRange !== 'all' && report.created_at) {
      const reportDate = new Date(report.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now - reportDate) / (1000 * 60 * 60 * 24));
      
      switch (filters.dateRange) {
        case 'today':
          if (daysDiff !== 0) return false;
          break;
        case 'week':
          if (daysDiff > 7) return false;
          break;
        case 'month':
          if (daysDiff > 30) return false;
          break;
        case 'quarter':
          if (daysDiff > 90) return false;
          break;
      }
    }
    
    return true;
  }) || [];

  if (reportsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-high mb-2">ESG Reports</h1>
            <p className="text-text-muted">Generate, manage, and analyze comprehensive ESG reports</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="primary"
              onClick={() => {
                const validation = validateDataForReportGeneration();
                console.log('📊 REPORTS: Generate button validation:', validation);
                
                if (!validation.hasData) {
                  console.log('❌ REPORTS: No data available, showing alert');
                  setShowNoDataModal(true);
                  return;
                }
                
                setShowTemplateModal(true);
              }}
            >
              <i className="fa-solid fa-plus mr-2"></i>
              Generate Report
            </Button>
          </div>
        </div>

        {/* Performance Overview */}

        {/* Recent Reports */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-high">
              Recent Reports ({filteredReports.length})
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="small"
                onClick={() => setShowFilters(!showFilters)}
              >
                <i className="fa-solid fa-filter mr-2"></i>
                Filter
              </Button>
              <Button
                variant="outline"
                size="small"
                onClick={() => queryClient.invalidateQueries(['reports', user?.id])}
              >
                <i className="fa-solid fa-refresh mr-2"></i>
                Refresh
              </Button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Status"
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'processing', label: 'Processing' },
                    { value: 'failed', label: 'Failed' },
                    { value: 'pending', label: 'Pending' }
                  ]}
                />
                <Select
                  label="Report Type"
                  value={filters.type}
                  onChange={(e) => setFilters({...filters, type: e.target.value})}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'esg_comprehensive', label: 'ESG Comprehensive' },
                    { value: 'dst_compliance', label: 'DST Compliance' },
                    { value: 'green_key', label: 'Green Key' },
                    { value: 'custom_export', label: 'Custom Export' }
                  ]}
                />
                <Select
                  label="Date Range"
                  value={filters.dateRange}
                  onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                  options={[
                    { value: 'all', label: 'All Time' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'Last 7 days' },
                    { value: 'month', label: 'Last 30 days' },
                    { value: 'quarter', label: 'Last 90 days' }
                  ]}
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-text-muted">
                  Showing {filteredReports.length} of {reports?.length || 0} reports
                </span>
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => setFilters({ status: 'all', type: 'all', dateRange: 'all' })}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-text-muted font-medium text-sm">Report Name</th>
                  <th className="text-left py-3 px-4 text-text-muted font-medium text-sm">Type</th>
                  <th className="text-left py-3 px-4 text-text-muted font-medium text-sm">Period</th>
                  <th className="text-left py-3 px-4 text-text-muted font-medium text-sm">Status</th>
                  <th className="text-left py-3 px-4 text-text-muted font-medium text-sm">Generated</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports && filteredReports.length > 0 ? (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-file-pdf text-red-400"></i>
                          </div>
                          <div className="flex-1">
                            {editingReportId === report.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingReportName}
                                  onChange={(e) => setEditingReportName(e.target.value)}
                                  onKeyDown={handleKeyPress}
                                  className="text-text-high font-medium bg-transparent border border-brand-teal rounded px-2 py-1 text-sm flex-1"
                                  autoFocus
                                />
                                <button
                                  onClick={handleSaveReportName}
                                  className="text-green-400 hover:text-green-300 p-1"
                                  title="Save"
                                  disabled={updateReportMutation.isLoading}
                                >
                                  <i className="fa-solid fa-check text-xs"></i>
                                </button>
                                <button
                                  onClick={handleCancelEditName}
                                  className="text-red-400 hover:text-red-300 p-1"
                                  title="Cancel"
                                >
                                  <i className="fa-solid fa-times text-xs"></i>
                                </button>
                              </div>
                            ) : (
                              <div 
                                className="text-text-high font-medium cursor-pointer hover:text-brand-teal flex items-center gap-2 group"
                                onClick={() => handleStartEditName(report)}
                                title="Click to edit name"
                              >
                                {report.name}
                                <i className="fa-solid fa-edit text-xs opacity-0 group-hover:opacity-50"></i>
                              </div>
                            )}
                            <div className="text-text-muted text-xs">{report.description}</div>
                            <div className="text-text-muted text-xs font-mono bg-white/5 px-1 rounded mt-1">
                              ID: {report.id?.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="bg-white/10 text-text-muted px-2 py-1 rounded text-xs">
                          {report.template?.display_name || report.report_type?.replace('_', ' ') || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-text-muted text-sm">
                        {report.report_period || 'N/A'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <i className={`${getStatusIcon(report.status)} ${getStatusColor(report.status)}`}></i>
                          <span className={`text-sm capitalize ${getStatusColor(report.status)}`}>
                            {report.status?.replace(/<[^>]*>/g, '') || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-text-muted text-sm">
                        {report.created_at ? format(new Date(report.created_at), 'MMM dd, yyyy') : 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {report.status === 'completed' && (
                            <>
                              <Button
                                variant="tertiary"
                                size="small"
                                onClick={() => handleDownloadReport(report.id)}
                                loading={(() => {
                                  const isLoading = downloadingReportIds.has(report.id);
                                  console.log(`🔄 Button render - Report ${report.id.slice(0, 8)}: loading=${isLoading}, Set:`, Array.from(downloadingReportIds));
                                  return isLoading;
                                })()}
                                title={`Download ${report.name}`}
                              >
                                <i className="fa-solid fa-download"></i>
                              </Button>
                              <Button
                                variant="tertiary"
                                size="small"
                                onClick={() => setSelectedReport(report)}
                                title={`View ${report.name}`}
                              >
                                <i className="fa-solid fa-eye"></i>
                              </Button>
                            </>
                          )}
                          <Button
                            variant="tertiary"
                            size="small"
                            onClick={() => handleShareReport(report)}
                            title={`Share ${report.name}`}
                          >
                            <i className="fa-solid fa-share"></i>
                          </Button>
                          <Button
                            variant="tertiary"
                            size="small"
                            onClick={() => handleDeleteReport(report)}
                            loading={(() => {
                              const isLoading = deletingReportIds.has(report.id);
                              console.log(`🔄 Delete button render - Report ${report.id.slice(0, 8)}: loading=${isLoading}, Set:`, Array.from(deletingReportIds));
                              return isLoading;
                            })()}
                            title={`Delete ${report.name}`}
                            className="text-red-400 hover:text-red-300"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fa-solid fa-file-text text-2xl text-text-muted"></i>
                      </div>
                      <h3 className="text-text-high font-semibold text-lg mb-2">No Reports Yet</h3>
                      <p className="text-text-muted mb-4">Generate your first ESG report to get started</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Template Selection Modal */}
        <Modal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          title="Select Report Template"
          size="extra-large"
        >
          <div className="space-y-6">
            <p className="text-text-muted mb-4">
              Choose from our professionally designed ESG report templates. Each template is optimized for specific frameworks and compliance requirements.
            </p>
            
            {/* Debug Information - Hidden for production */}
            {process.env.NODE_ENV === 'development' && false && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4 text-sm">
                <h4 className="text-blue-300 font-semibold mb-2">Debug Information:</h4>
                <p className="text-blue-200">Loading state: {templatesLoading ? 'Loading...' : 'Complete'}</p>
                <p className="text-blue-200">Templates data: {templates ? `Array(${templates.length})` : 'null/undefined'}</p>
                <p className="text-blue-200">Display templates: {displayTemplates ? `Array(${displayTemplates.length})` : 'null/undefined'}</p>
                <p className="text-blue-200">API endpoint: http://localhost:3001/api/reports/templates/</p>
                <p className="text-blue-200">Current URL: {window.location.href}</p>
                {templatesError && (
                  <p className="text-red-300">Error: {templatesError.message || JSON.stringify(templatesError)}</p>
                )}
                <button 
                  onClick={async () => {
                    try {
                      console.log('Manual API test starting...');
                      const response = await fetch('http://localhost:3001/api/reports/templates/');
                      console.log('Manual API response:', response);
                      const data = await response.json();
                      console.log('Manual API data:', data);
                      alert(`Manual test: ${response.status} - ${data.results?.length || 0} templates`);
                    } catch (error) {
                      console.error('Manual API test error:', error);
                      alert(`Manual test error: ${error.message}`);
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                >
                  Test API Call
                </button>
              </div>
            )}
            
            {templatesLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : displayTemplates && displayTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayTemplates.map((template) => {
                  const getTemplateIcon = (type) => {
                    const icons = {
                      'esg_comprehensive': 'fa-solid fa-chart-pie',
                      'dst_compliance': 'fa-solid fa-building',
                      'green_key': 'fa-solid fa-leaf',
                      'custom_export': 'fa-solid fa-file-export',
                      'quarterly_summary': 'fa-solid fa-calendar-check',
                      'compliance_tracker': 'fa-solid fa-shield-check',
                      'annual_report': 'fa-solid fa-file-alt',
                      'benchmark_analysis': 'fa-solid fa-chart-bar'
                    };
                    return icons[type] || 'fa-solid fa-file';
                  };

                  const getTemplateColor = (type) => {
                    const colors = {
                      'esg_comprehensive': 'from-brand-green to-brand-teal',
                      'dst_compliance': 'from-brand-blue to-brand-teal',
                      'green_key': 'from-brand-green to-brand-blue',
                      'custom_export': 'from-purple-500 to-brand-teal',
                      'quarterly_summary': 'from-brand-teal to-brand-green',
                      'compliance_tracker': 'from-red-500 to-brand-blue',
                      'annual_report': 'from-yellow-500 to-brand-green',
                      'benchmark_analysis': 'from-indigo-500 to-brand-blue'
                    };
                    return colors[type] || 'from-gray-500 to-gray-700';
                  };
                  
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="relative p-6 bg-white/5 rounded-xl border border-white/10 hover:border-brand-green/50 cursor-pointer transition-all duration-200 hover:bg-white/10 group"
                    >
                      {/* Header */}
                      <div className="flex items-start space-x-4 mb-4">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getTemplateColor(template.report_type)} flex items-center justify-center`}>
                          <i className={`${getTemplateIcon(template.report_type)} text-white text-lg`}></i>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-text-high font-semibold text-lg mb-1 group-hover:text-brand-green transition-colors">
                            {template.display_name}
                          </h3>
                          {template.is_framework_official && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-brand-green/20 text-brand-green">
                              <i className="fa-solid fa-certificate mr-1"></i>
                              Official Framework
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-text-muted text-sm mb-4 line-clamp-2">
                        {template.description}
                      </p>

                      {/* Frameworks & Features */}
                      <div className="space-y-3">
                        {template.required_frameworks && template.required_frameworks.length > 0 && (
                          <div>
                            <div className="text-xs text-text-muted mb-2">Required Frameworks:</div>
                            <div className="flex flex-wrap gap-1">
                              {template.required_frameworks.map((framework, idx) => (
                                <span key={idx} className="inline-block px-2 py-1 bg-white/10 text-text-muted rounded text-xs">
                                  {framework}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <div className="flex items-center space-x-3">
                            <span className="flex items-center">
                              <i className="fa-solid fa-file-pdf mr-1"></i>
                              {template.supported_formats ? template.supported_formats.join(', ').toUpperCase() : 'PDF'}
                            </span>
                            {template.requires_verification && (
                              <span className="flex items-center text-yellow-400">
                                <i className="fa-solid fa-shield-check mr-1"></i>
                                Verification Required
                              </span>
                            )}
                          </div>
                          <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-exclamation-triangle text-2xl text-yellow-500"></i>
                </div>
                <h3 className="text-text-high font-semibold text-lg mb-2">No Templates Available</h3>
                <p className="text-text-muted mb-4">Unable to load report templates. Please check your connection and try again.</p>
                <p className="text-text-muted text-sm">Templates loaded: {templates ? templates.length : 'null'}</p>
                <p className="text-text-muted text-sm">Loading state: {templatesLoading ? 'loading' : 'complete'}</p>
                {templatesError && (
                  <p className="text-red-400 text-sm">Error: {templatesError.message}</p>
                )}
              </div>
            )}
          </div>
        </Modal>

        {/* Generate Report Modal */}
        <Modal
          isOpen={showGenerateModal}
          onClose={() => {
            setShowGenerateModal(false);
            setSelectedTemplate(null);
            reset();
          }}
          title={selectedTemplate ? `Generate ${selectedTemplate.display_name}` : "Generate New Report"}
          size="large"
        >
          {selectedTemplate && (
            <div className="mb-6 p-4 bg-white/5 rounded-lg">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`w-8 h-8 rounded bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center`}>
                  <i className="fa-solid fa-chart-pie text-white text-sm"></i>
                </div>
                <div>
                  <h4 className="text-text-high font-medium">{selectedTemplate.display_name}</h4>
                  <p className="text-text-muted text-sm">{selectedTemplate.description}</p>
                </div>
              </div>
              {selectedTemplate.required_frameworks && selectedTemplate.required_frameworks.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {selectedTemplate.required_frameworks.map((framework, idx) => (
                    <span key={idx} className="inline-block px-2 py-1 bg-white/10 text-text-muted rounded text-xs">
                      {framework}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <form onSubmit={handleSubmit(handleGenerateReport)} className="space-y-6">
            {selectedTemplate && (
              <input 
                type="hidden" 
                {...register('template_id')} 
                value={selectedTemplate.id}
              />
            )}
            
            <Input
              label="Report Name"
              placeholder={selectedTemplate ? `${selectedTemplate.display_name} - ${format(new Date(), 'MMM dd, yyyy')}` : "Enter report name"}
              {...register('name')}
            />
            
            <Input
              label="Description (Optional)"
              placeholder="Brief description of this report"
              {...register('description')}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                required
                {...register('start_date', {
                  required: 'Start date is required'
                })}
                error={errors.start_date?.message}
              />
              <Input
                label="End Date"
                type="date"
                required
                {...register('end_date', {
                  required: 'End date is required'
                })}
                error={errors.end_date?.message}
              />
            </div>

            <Select
              label="Output Format"
              required
              options={selectedTemplate?.supported_formats ? 
                selectedTemplate.supported_formats.map(format => ({ 
                  value: format, 
                  label: format.toUpperCase() 
                })) : 
                [{ value: 'pdf', label: 'PDF' }]
              }
              {...register('format', {
                required: 'Output format is required'
              })}
              error={errors.format?.message}
            />

            <div className="space-y-4">
              <h4 className="text-text-high font-medium">Report Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-3">
                  <input 
                    type="checkbox"
                    className="text-brand-green focus:ring-brand-green rounded"
                    defaultChecked={true}
                    {...register('include_recommendations')}
                  />
                  <span className="text-text-high text-sm">Include AI recommendations</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input 
                    type="checkbox"
                    className="text-brand-green focus:ring-brand-green rounded"
                    defaultChecked={true}
                    {...register('include_benchmarks')}
                  />
                  <span className="text-text-high text-sm">Include industry benchmarks</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input 
                    type="checkbox"
                    className="text-brand-green focus:ring-brand-green rounded"
                    defaultChecked={true}
                    {...register('include_charts')}
                  />
                  <span className="text-text-high text-sm">Include charts & visualizations</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input 
                    type="checkbox"
                    className="text-brand-green focus:ring-brand-green rounded"
                    defaultChecked={true}
                    {...register('include_trends')}
                  />
                  <span className="text-text-high text-sm">Include trend analysis</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowGenerateModal(false);
                  setSelectedTemplate(null);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={generateReportMutation.isLoading}
                disabled={!selectedTemplate}
              >
                <i className="fa-solid fa-magic-wand-sparkles mr-2"></i>
                Generate Report
              </Button>
            </div>
          </form>
        </Modal>

        {/* Report Detail Modal */}
        <Modal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          title={selectedReport ? `Report Details: ${selectedReport.name}` : 'Report Details'}
          size="large"
        >
          {selectedReport && (
            <div className="space-y-6">
              {/* Report Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-file-pdf text-red-400 text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-text-high font-semibold text-lg">{selectedReport.name}</h3>
                    <p className="text-text-muted text-sm">{selectedReport.description || 'No description available'}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-text-muted">
                      <span>ID: {selectedReport.id?.slice(0, 8)}...</span>
                      <span>Created: {selectedReport.created_at ? format(new Date(selectedReport.created_at), 'MMM dd, yyyy') : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs capitalize ${
                    selectedReport.status === 'completed' ? 'bg-brand-green/20 text-brand-green' :
                    selectedReport.status === 'processing' ? 'bg-brand-blue/20 text-brand-blue' :
                    selectedReport.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {selectedReport.status}
                  </span>
                </div>
              </div>

              {/* Report Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-text-high font-medium mb-2">Report Information</h4>
                    <div className="bg-white/5 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Type:</span>
                        <span className="text-text-high">{selectedReport.template?.display_name || selectedReport.report_type?.replace('_', ' ') || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Period:</span>
                        <span className="text-text-high">{selectedReport.report_period || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Format:</span>
                        <span className="text-text-high">{selectedReport.format?.toUpperCase() || 'PDF'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-text-high font-medium mb-2">Actions</h4>
                    <div className="space-y-2">
                      {selectedReport.status === 'completed' && (
                        <Button
                          variant="primary"
                          onClick={() => handleDownloadReport(selectedReport.id)}
                          loading={downloadingReportIds.has(selectedReport.id)}
                          className="w-full"
                        >
                          <i className="fa-solid fa-download mr-2"></i>
                          Download Report
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => handleShareReport(selectedReport)}
                        className="w-full"
                      >
                        <i className="fa-solid fa-share mr-2"></i>
                        Share Report
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleDeleteReport(selectedReport);
                          setSelectedReport(null); // Close modal after opening delete confirmation
                        }}
                        className="w-full text-red-400 hover:text-red-300 hover:border-red-400"
                      >
                        <i className="fa-solid fa-trash mr-2"></i>
                        Delete Report
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Report Metadata */}
              {selectedReport.parameters && (
                <div>
                  <h4 className="text-text-high font-medium mb-2">Report Configuration</h4>
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {Object.entries(selectedReport.parameters).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-text-muted capitalize">{key.replace('_', ' ')}:</span>
                          <span className="text-text-high">{value?.toString() || 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* No Data Alert Modal */}
        <Modal
          isOpen={showNoDataModal}
          onClose={() => setShowNoDataModal(false)}
          title="No Data Available"
          size="medium"
        >
          <div className="space-y-6">
            {/* Warning Icon & Message */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-exclamation-triangle text-3xl text-yellow-400"></i>
              </div>
              <h3 className="text-xl font-semibold text-text-high mb-2">Cannot Generate Report</h3>
              <p className="text-text-muted">
                You need to have data in your account before generating ESG reports.
              </p>
            </div>

            {/* Requirements List */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 className="text-text-high font-medium mb-3 flex items-center">
                <i className="fa-solid fa-clipboard-list mr-2 text-brand-blue"></i>
                Required Data Sources:
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    (tasks && tasks.length > 0) ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    <i className={`fa-solid text-xs ${
                      (tasks && tasks.length > 0) ? 'fa-check text-white' : 'fa-x text-white'
                    }`}></i>
                  </div>
                  <span className="text-text-muted">
                    Complete ESG assessment and tasks
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    (tasks && tasks.length > 0) ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {tasks?.length || 0} tasks found
                  </span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    (tasks && tasks.some(task => task.status === 'completed' || task.progress_percentage >= 100)) ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    <i className={`fa-solid text-xs ${
                      (tasks && tasks.some(task => task.status === 'completed' || task.progress_percentage >= 100)) ? 'fa-check text-white' : 'fa-x text-white'
                    }`}></i>
                  </div>
                  <span className="text-text-muted">
                    Complete at least one task with evidence
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    (tasks && tasks.some(task => task.status === 'completed' || task.progress_percentage >= 100)) ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {tasks?.filter(t => t.status === 'completed' || t.progress_percentage >= 100)?.length || 0} completed
                  </span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    ((socialFileData?.files_analyzed || 0) + (environmentalFileData?.files_analyzed || 0) + (governanceFileData?.files_analyzed || 0) > 0) ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    <i className={`fa-solid text-xs ${
                      ((socialFileData?.files_analyzed || 0) + (environmentalFileData?.files_analyzed || 0) + (governanceFileData?.files_analyzed || 0) > 0) ? 'fa-check text-white' : 'fa-x text-white'
                    }`}></i>
                  </div>
                  <span className="text-text-muted">
                    Upload evidence files with ESG data
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    ((socialFileData?.files_analyzed || 0) + (environmentalFileData?.files_analyzed || 0) + (governanceFileData?.files_analyzed || 0) > 0) ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {(socialFileData?.files_analyzed || 0) + (environmentalFileData?.files_analyzed || 0) + (governanceFileData?.files_analyzed || 0)} files analyzed
                  </span>
                </div>
              </div>
            </div>

            {/* Getting Started Steps */}
            <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <i className="fa-solid fa-lightbulb text-brand-blue mt-0.5"></i>
                <div className="text-sm">
                  <p className="text-brand-blue font-medium mb-2">How to get started:</p>
                  <ol className="text-text-muted space-y-1 list-decimal list-inside">
                    <li>Complete your ESG onboarding assessment</li>
                    <li>Upload evidence files (PDFs, spreadsheets, etc.) in the Tasks section</li>
                    <li>Complete assigned ESG tasks with evidence uploads</li>
                    <li>Return here to generate comprehensive reports</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.href = '/onboard'}
                className="text-brand-blue border-brand-blue hover:bg-brand-blue hover:text-white px-4 py-2 text-sm"
              >
                <i className="fa-solid fa-clipboard-check mr-2"></i>
                Start Assessment
              </Button>
              
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.href = '/tasks'}
                  className="px-4 py-2 text-sm"
                >
                  <i className="fa-solid fa-tasks mr-2"></i>
                  View Tasks
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setShowNoDataModal(false)}
                  className="px-4 py-2 text-sm"
                >
                  Got It
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={cancelDeleteReport}
          title="Delete Report"
          size="medium"
        >
          {reportToDelete && (
            <div className="space-y-6">
              {/* Warning Icon & Message */}
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-triangle-exclamation text-3xl text-red-400"></i>
                </div>
                <h3 className="text-xl font-semibold text-text-high mb-2">Delete Report?</h3>
                <p className="text-text-muted">
                  Are you sure you want to delete this report? This action cannot be undone.
                </p>
              </div>

              {/* Report Details */}
              <div className="bg-white/5 rounded-lg p-4 border-l-4 border-red-400">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-file-pdf text-red-400"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-text-high font-medium">{reportToDelete.name}</h4>
                    <div className="flex items-center space-x-4 text-sm text-text-muted">
                      <span>{reportToDelete.template?.display_name || reportToDelete.report_type?.replace('_', ' ') || 'N/A'}</span>
                      <span>•</span>
                      <span>{reportToDelete.created_at ? format(new Date(reportToDelete.created_at), 'MMM dd, yyyy') : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Text */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-exclamation-triangle text-red-400 mt-0.5"></i>
                  <div className="text-sm">
                    <p className="text-red-400 font-medium mb-1">Warning:</p>
                    <p className="text-text-muted">
                      Once deleted, this report and all its data will be permanently removed from your account. 
                      You will need to regenerate the report if you need it again.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelDeleteReport}
                  disabled={deleteReportMutation.isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={confirmDeleteReport}
                  loading={deleteReportMutation.isLoading}
                  className="bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
                >
                  <i className="fa-solid fa-trash mr-2"></i>
                  Delete Report
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Report Test Data Loader (Development Only) - Hidden for production */}
        {process.env.NODE_ENV === 'development' && false && (
          <ReportTestDataLoader />
        )}
      </div>
    </Layout>
  );
};

export default Reports;