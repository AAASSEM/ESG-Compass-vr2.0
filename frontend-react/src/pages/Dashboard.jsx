import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { esgAPI } from '../services/api';
import { normalizeCategory, suggestTaskCategory } from '../utils/categories';
import Select from '../components/ui/Select';

const Dashboard = () => {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('overview'); // Default to overview
  const [selectedMetric, setSelectedMetric] = useState('employee_satisfaction');
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    period: 'monthly',
    dataSource: 'all'
  });
  const queryClient = useQueryClient();

  // Clear cached data when user changes (login/logout) - less aggressive
  useEffect(() => {
    if (user?.id) {
      console.log('👤 DASHBOARD: User changed, invalidating queries');
      queryClient.invalidateQueries();
    }
  }, [user?.id, queryClient]);

  // Fetch dashboard data with user-specific cache keys
  const { data: company, isLoading: companyLoading } = useQuery(
    ['company', user?.id, 'dashboard'],
    () => esgAPI.getCompany(),
    { 
      enabled: !!user?.id,
      retry: 1, 
      staleTime: 0,
      cacheTime: 0,
      refetchOnWindowFocus: true
    }
  );

  const { data: tasks, isLoading: tasksLoading } = useQuery(
    ['tasks', user?.id, 'dashboard'], // Remove timestamp to prevent infinite queries
    () => {
      console.log('🔄 DASHBOARD: Fetching fresh tasks from API for user:', user?.id);
      return esgAPI.getTasks();
    },
    { 
      enabled: !!user?.id,
      retry: 1, 
      staleTime: 5000, // 5 seconds
      cacheTime: 300000, // 5 minutes
      refetchOnWindowFocus: true,
      onSuccess: (data) => {
        console.log('✅ DASHBOARD: Tasks loaded for', user?.full_name || user?.email, ':', data?.length || 0);
      }
    }
  );

  const { data: dashboardOverview, isLoading: overviewLoading } = useQuery(
    ['dashboard-overview', user?.id],
    () => esgAPI.getDashboardOverview(),
    { 
      enabled: !!user?.id,
      retry: 1, 
      staleTime: 0,
      cacheTime: 0,
      refetchOnWindowFocus: true
    }
  );

  // Fetch real file data for each category
  const { data: socialData, isLoading: socialLoading } = useQuery(
    ['social-file-data', user?.id],
    () => esgAPI.getSocialFileData(),
    { 
      retry: 1, 
      staleTime: 0,
      cacheTime: 0,
      enabled: !!user?.id && (selectedTab === 'social' || selectedTab === 'overview')
    }
  );

  const { data: environmentalData, isLoading: environmentalLoading } = useQuery(
    ['environmental-file-data', user?.id],
    () => esgAPI.getEnvironmentalFileData(),
    { 
      retry: 1, 
      staleTime: 0,
      cacheTime: 0,
      enabled: !!user?.id && (selectedTab === 'environmental' || selectedTab === 'overview')
    }
  );

  const { data: governanceData, isLoading: governanceLoading } = useQuery(
    ['governance-file-data', user?.id],
    () => esgAPI.getGovernanceFileData(),
    { 
      retry: 1, 
      staleTime: 0,
      cacheTime: 0,
      enabled: !!user?.id && (selectedTab === 'governance' || selectedTab === 'overview')
    }
  );

  // Calculate progress from API data only
  const calculateApiProgress = () => {
    // Handle different possible API response structures
    let taskList = [];
    
    if (Array.isArray(tasks)) {
      taskList = tasks;
    } else if (tasks && Array.isArray(tasks.results)) {
      taskList = tasks.results;
    } else if (tasks && Array.isArray(tasks.data)) {
      taskList = tasks.data;
    }
    
    console.log('📊 DASHBOARD: Raw tasks data for', user?.full_name || user?.email, ':', {
      tasksInput: tasks,
      taskListLength: taskList?.length || 0,
      taskListSample: taskList?.slice(0, 3).map(t => ({ 
        id: t.id?.slice(0, 8), 
        category: t.category, 
        status: t.status, 
        progress: t.progress_percentage 
      })) || []
    });
    
    // Continue with calculation even if no tasks (will naturally result in 0%)
    
    // Calculate progress based purely on task completion status from database
    
    console.log('📊 DASHBOARD: Calculating progress from API tasks:', taskList?.length || 0);
    
    let totalTasks = { environmental: 0, social: 0, governance: 0 };
    let completedTasks = { environmental: 0, social: 0, governance: 0 };

    (taskList || []).forEach(task => {
      const normalizedCategory = normalizeCategory(task.category);
      totalTasks[normalizedCategory] = (totalTasks[normalizedCategory] || 0) + 1;
      
      if (task.status === 'completed' || task.progress_percentage >= 100) {
        completedTasks[normalizedCategory] = (completedTasks[normalizedCategory] || 0) + 1;
      }
    });

    const calculatePercentage = (completed, total) => 
      total > 0 ? Math.round((completed / total) * 100) : 0;

    const environmental = calculatePercentage(completedTasks.environmental, totalTasks.environmental);
    const social = calculatePercentage(completedTasks.social, totalTasks.social);
    const governance = calculatePercentage(completedTasks.governance, totalTasks.governance);
    const overall = calculatePercentage(
      completedTasks.environmental + completedTasks.social + completedTasks.governance,
      totalTasks.environmental + totalTasks.social + totalTasks.governance
    );

    // If score is 50 or less, show 0
    const adjustedEnvironmental = environmental <= 50 ? 0 : environmental;
    const adjustedSocial = social <= 50 ? 0 : social;
    const adjustedGovernance = governance <= 50 ? 0 : governance;
    const adjustedOverall = overall <= 50 ? 0 : overall;
    
    console.log('🔍 SCORE ADJUSTMENT: Original vs Adjusted:', {
      original: { environmental, social, governance, overall },
      adjusted: { environmental: adjustedEnvironmental, social: adjustedSocial, governance: adjustedGovernance, overall: adjustedOverall }
    });

    console.log('🔍 TASK CALC: === DETAILED TASK-BASED CALCULATION ===');
    console.log('🔍 TASK CALC: Total tasks breakdown:', totalTasks);
    console.log('🔍 TASK CALC: Completed tasks breakdown:', completedTasks);
    console.log('🔍 TASK CALC: Individual percentages:', { environmental, social, governance });
    console.log('🔍 TASK CALC: Overall calculation:', {
      totalCompleted: completedTasks.environmental + completedTasks.social + completedTasks.governance,
      totalTasks: totalTasks.environmental + totalTasks.social + totalTasks.governance,
      overallResult: overall
    });
    console.log('🎯 TASK CALC: === IF 58.33% APPEARS, CHECK ABOVE VALUES ===');
    
    if (overall === 58.33 || Math.round(overall) === 58) {
      console.error('🚨 FOUND 58.33% SOURCE: Task-based calculation resulted in:', overall);
      console.error('🚨 This is the wrong calculation - should use file data instead!');
    }

    return { environmental: adjustedEnvironmental, social: adjustedSocial, governance: adjustedGovernance, overall: adjustedOverall };
  };

  // Get progress from API data only - include user ID to force recalculation on user change
  const realProgress = React.useMemo(() => {
    console.log('🔍 DASHBOARD: === PROGRESS CALCULATION START ===');
    console.log('🔍 DASHBOARD: User:', user?.full_name || user?.email, '| ID:', user?.id);
    console.log('🔍 DASHBOARD: socialData:', socialData);
    console.log('🔍 DASHBOARD: environmentalData:', environmentalData);
    console.log('🔍 DASHBOARD: governanceData:', governanceData);
    console.log('🔍 DASHBOARD: tasks length:', tasks?.length || 0);
    
    // Check file data availability
    const hasSocialFiles = socialData?.files_analyzed > 0;
    const hasEnvFiles = environmentalData?.files_analyzed > 0;
    const hasGovFiles = governanceData?.files_analyzed > 0;
    
    console.log('🔍 DASHBOARD: File data check:', {
      hasSocialFiles,
      hasEnvFiles,
      hasGovFiles,
      socialFilesCount: socialData?.files_analyzed || 0,
      envFilesCount: environmentalData?.files_analyzed || 0,
      govFilesCount: governanceData?.files_analyzed || 0
    });
    
    // Prioritize file data over task data if available
    if (hasSocialFiles || hasEnvFiles || hasGovFiles) {
      console.log('📊 DASHBOARD: ✅ Using FILE-BASED progress calculation');
      const envScore = environmentalData?.sustainability_score || 0;
      const socialScore = socialData?.satisfaction_score || 0;
      const govScore = governanceData?.compliance_score || 0;
      
      console.log('🔍 DASHBOARD: Raw file scores:', {
        envScore,
        socialScore, 
        govScore
      });
      
      // Calculate overall from available scores
      const scores = [envScore, socialScore, govScore].filter(score => score > 0);
      const overall = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      
      const result = {
        environmental: envScore <= 50 ? 0 : envScore,
        social: socialScore <= 50 ? 0 : socialScore, 
        governance: govScore <= 50 ? 0 : govScore,
        overall: overall <= 50 ? 0 : overall
      };
      
      console.log('🔍 FILE SCORE ADJUSTMENT: Original vs Adjusted:', {
        original: { environmental: envScore, social: socialScore, governance: govScore, overall },
        adjusted: result
      });
      console.log('🎯 DASHBOARD: FINAL FILE-BASED RESULT:', result);
      console.log('🔍 DASHBOARD: === If you see 58.33%, it\'s NOT from here ===');
      return result;
    } else {
      console.log('📊 DASHBOARD: ⚠️ Using TASK-BASED progress calculation (fallback)');
      const result = calculateApiProgress();
      console.log('🎯 DASHBOARD: FINAL TASK-BASED RESULT:', result);
      console.log('🔍 DASHBOARD: === If you see 58.33%, it might be from here ===');
      return result;
    }
  }, [tasks, user?.id, socialData, environmentalData, governanceData]);

  const isLoading = companyLoading || tasksLoading || overviewLoading || socialLoading || environmentalLoading || governanceLoading;

  // Debug function to force refresh all data
  const handleForceRefresh = async () => {
    console.log('🔄 DASHBOARD: Force refreshing all data...');
    queryClient.clear(); // Clear all cache
    queryClient.removeQueries(); // Remove all queries
    queryClient.invalidateQueries(); // Force refetch
  };

  // Smart data generation based on real progress
  const trendData = React.useMemo(() => {
    if (realProgress.overall === 0) return [];
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, index) => ({
      month,
      environmental: Math.min(realProgress.environmental, (index + 1) * 15),
      social: Math.min(realProgress.social, (index + 1) * 17),
      governance: Math.min(realProgress.governance, (index + 1) * 16),
    }));
  }, [realProgress]);

  const emissionsData = React.useMemo(() => {
    if (realProgress.overall === 0) return [];
    
    return [
      { name: 'Environmental', value: realProgress.environmental, color: '#2EC57D' },
      { name: 'Social', value: realProgress.social, color: '#3DAEFF' },
      { name: 'Governance', value: realProgress.governance, color: '#20C5C5' },
    ].filter(item => item.value > 0);
  }, [realProgress]);

  const taskStats = React.useMemo(() => {
    if (!tasks) return { total: 0, completed: 0, inProgress: 0, overdue: 0 };

    const tasksArray = Array.isArray(tasks) ? tasks : tasks.results || [];
    return {
      total: tasksArray.length,
      completed: tasksArray.filter(t => t.status === 'completed').length,
      inProgress: tasksArray.filter(t => t.status === 'in_progress').length,
      overdue: tasksArray.filter(t => t.is_overdue).length,
    };
  }, [tasks, user?.id]);

  // Metric categories
  const metricCategories = [
    {
      id: 'environmental',
      label: 'Environmental',
      icon: 'fa-solid fa-leaf',
      color: '#2EC57D',
      metrics: [
        { value: 'energy_consumption', label: 'Energy Consumption (kWh)' },
        { value: 'water_usage', label: 'Water Usage (L)' },
        { value: 'waste_generated', label: 'Waste Generated (kg)' },
        { value: 'carbon_emissions', label: 'Carbon Emissions (tCO2e)' },
        { value: 'renewable_energy', label: 'Renewable Energy (%)' }
      ]
    },
    {
      id: 'social',
      label: 'Social',
      icon: 'fa-solid fa-users',
      color: '#3DAEFF',
      metrics: [
        { value: 'employee_satisfaction', label: 'Employee Satisfaction (%)' },
        { value: 'training_hours', label: 'Training Hours' },
        { value: 'diversity_ratio', label: 'Diversity Ratio (%)' },
        { value: 'safety_incidents', label: 'Safety Incidents' },
        { value: 'community_investment', label: 'Community Investment (AED)' }
      ]
    },
    {
      id: 'governance',
      label: 'Governance',
      icon: 'fa-solid fa-shield-halved',
      color: '#20C5C5',
      metrics: [
        { value: 'board_meetings', label: 'Board Meetings' },
        { value: 'compliance_score', label: 'Compliance Score (%)' },
        { value: 'audit_findings', label: 'Audit Findings' },
        { value: 'policy_updates', label: 'Policy Updates' },
        { value: 'stakeholder_engagement', label: 'Stakeholder Engagement Score' }
      ]
    }
  ];

  const periodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annually', label: 'Annually' }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'environmental', label: 'Environmental' },
    { id: 'social', label: 'Social' },
    { id: 'governance', label: 'Governance' },
  ];

  // Get current category - force recalculation when selectedTab changes
  const currentCategory = React.useMemo(() => {
    return metricCategories.find(cat => cat.id === selectedTab) || metricCategories[1]; // Default to social
  }, [selectedTab]);
  
  const availableMetrics = currentCategory?.metrics || [];

  // Set default metric when tab changes
  useEffect(() => {
    if (selectedTab !== 'overview' && currentCategory?.metrics?.length > 0) {
      setSelectedMetric(currentCategory.metrics[0].value);
    }
    console.log(`🎯 Tab changed to: ${selectedTab}, Icon: ${currentCategory?.icon}, Color: ${currentCategory?.color}`);
  }, [selectedTab, currentCategory]);

  // Get current category data based on selected tab
  const getCurrentCategoryData = () => {
    switch (selectedTab) {
      case 'social': return socialData;
      case 'environmental': return environmentalData;
      case 'governance': return governanceData;
      default: return null;
    }
  };

  const currentCategoryData = React.useMemo(() => getCurrentCategoryData(), [selectedTab, socialData, environmentalData, governanceData]);

  // Chart data for metrics using real extracted data or task progress
  const chartData = React.useMemo(() => {
    const data = getCurrentCategoryData();
    let baseValue = 0;

    // If we have file data with actual metrics, use it
    if (data && data.files_analyzed > 0 && data[selectedMetric]) {
      const metricValue = data[selectedMetric];
      baseValue = typeof metricValue === 'number' ? metricValue : 0;
    } else {
      // Otherwise use task completion progress as the base value
      baseValue = realProgress[selectedTab] || 0;
    }
    
    // Create trend data showing progression to current value
    return [
      { month: 'Jan', value: Math.max(0, baseValue * 0.6), target: 80, benchmark: 70 },
      { month: 'Feb', value: Math.max(0, baseValue * 0.7), target: 80, benchmark: 70 },
      { month: 'Mar', value: Math.max(0, baseValue * 0.8), target: 80, benchmark: 70 },
      { month: 'Apr', value: Math.max(0, baseValue * 0.9), target: 80, benchmark: 70 },
      { month: 'May', value: Math.max(0, baseValue * 0.95), target: 80, benchmark: 70 },
      { month: 'Jun', value: Math.max(0, baseValue), target: 80, benchmark: 70 }
    ];
  }, [selectedTab, selectedMetric, socialData, environmentalData, governanceData, realProgress]);

  // Performance bar chart data using real data
  const performanceData = React.useMemo(() => {
    const data = getCurrentCategoryData();
    let currentValue = 0;

    // If we have file data with actual metrics, use it
    if (data && data.files_analyzed > 0 && data[selectedMetric]) {
      currentValue = typeof data[selectedMetric] === 'number' ? data[selectedMetric] : 0;
    } else {
      // Otherwise use task completion progress
      currentValue = realProgress[selectedTab] || 0;
    }
    
    return [
      { category: 'Current', value: currentValue },
      { category: 'Target', value: 85 },
      { category: 'Last Month', value: Math.max(0, currentValue - 5) }
    ];
  }, [currentCategoryData, selectedMetric, realProgress, selectedTab]);

  // Key metrics summary data - show task completion progress when no file data
  const getKeyMetricsSummary = () => {
    if (selectedTab === 'social') {
      // Use file data if available, otherwise show task progress
      if (socialData?.files_analyzed > 0) {
        return [
          { name: 'Employee Satisfaction', value: socialData.satisfaction_score ? `${socialData.satisfaction_score}%` : '--', change: '+5%', status: 'up', description: 'from uploaded files' },
          { name: 'Training Hours', value: socialData.training_hours ? `${socialData.training_hours}h` : '--', change: '0%', status: 'stable', description: 'per employee' },
          { name: 'Diversity Ratio', value: socialData.diversity_ratio ? `${socialData.diversity_ratio}%` : '--', change: '-2%', status: 'down', description: 'female ratio' },
          { name: 'Safety Incidents', value: socialData.safety_incidents !== null ? socialData.safety_incidents : '--', change: '-50%', status: 'up', description: 'this year' }
        ];
      } else {
        // Show task-based progress
        return [
          { name: 'Indoor Air Quality', value: realProgress.social > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'monitoring program' },
          { name: 'Healthy Food Policy', value: realProgress.social > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'cafeteria program' },
          { name: 'Eco Club Program', value: realProgress.social > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'student committee' },
          { name: 'Curriculum Integration', value: realProgress.social > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'sustainability education' }
        ];
      }
    }
    
    if (selectedTab === 'environmental') {
      if (environmentalData?.files_analyzed > 0) {
        return [
          { name: 'Energy Consumption', value: environmentalData.energy_consumption ? `${environmentalData.energy_consumption} kWh` : '--', change: '0%', status: 'stable', description: 'from uploaded files' },
          { name: 'Water Usage', value: environmentalData.water_usage ? `${environmentalData.water_usage} L` : '--', change: '0%', status: 'stable', description: 'total consumption' },
          { name: 'Waste Generated', value: environmentalData.waste_generated ? `${environmentalData.waste_generated} kg` : '--', change: '0%', status: 'stable', description: 'waste output' },
          { name: 'Carbon Emissions', value: environmentalData.carbon_emissions ? `${environmentalData.carbon_emissions} tCO2e` : '--', change: '0%', status: 'stable', description: 'total emissions' }
        ];
      } else {
        return [
          { name: 'Recycling Program', value: realProgress.environmental > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'waste separation' },
          { name: 'Consumption Tracking', value: realProgress.environmental > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'electricity & water' },
          { name: 'Reuse Program', value: realProgress.environmental > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'uniforms & textbooks' }
        ];
      }
    }
    
    if (selectedTab === 'governance') {
      if (governanceData?.files_analyzed > 0) {
        return [
          { name: 'Board Meetings', value: governanceData.board_meetings ? governanceData.board_meetings : '--', change: '0%', status: 'stable', description: 'meetings held' },
          { name: 'Compliance Score', value: governanceData.compliance_score ? `${governanceData.compliance_score}%` : '--', change: '0%', status: 'stable', description: 'compliance rating' },
          { name: 'Audit Findings', value: governanceData.audit_findings !== null ? governanceData.audit_findings : '--', change: '0%', status: 'stable', description: 'total findings' },
          { name: 'Policy Updates', value: governanceData.policy_updates ? governanceData.policy_updates : '--', change: '0%', status: 'stable', description: 'policies updated' }
        ];
      } else {
        return [
          { name: 'Sustainability Strategy', value: realProgress.governance > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'formal policy' },
          { name: 'Policy Documentation', value: realProgress.governance > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'written strategy' },
          { name: 'Governance Framework', value: realProgress.governance > 0 ? '✓ Complete' : 'Pending', change: '', status: 'stable', description: 'management structure' }
        ];
      }
    }
    
    // Fallback
    return [
      { name: 'Task Progress', value: `${Math.round(realProgress.overall)}%`, change: '0%', status: 'stable', description: 'overall completion' }
    ];
  };

  const keyMetricsSummary = React.useMemo(() => getKeyMetricsSummary(), [selectedTab, socialData, environmentalData, governanceData, realProgress]);

  const getMetricIcon = (metricType) => {
    const iconMap = {
      'employee_satisfaction': 'fa-smile',
      'training_hours': 'fa-graduation-cap',
      'diversity_ratio': 'fa-users-cog',
      'safety_incidents': 'fa-shield-alt',
      'community_investment': 'fa-hand-holding-heart'
    };
    return iconMap[metricType] || 'fa-chart-line';
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green mx-auto mb-4"></div>
            <p className="text-text-muted">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-white/5 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex-1 px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedTab === tab.id
                    ? 'bg-white/10 text-text-high'
                    : 'text-text-muted hover:text-text-high'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tracker Content for Category Tabs */}
        {selectedTab !== 'overview' && (
          <>
            {/* Header Section */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div 
                  key={selectedTab}
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${currentCategory.color}20` }}
                >
                  <i 
                    key={`${selectedTab}-icon`}
                    className={`${currentCategory.icon} text-xl`}
                    style={{ color: currentCategory.color }}
                  ></i>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-high">{currentCategory.label} Tracker</h2>
                  <p className="text-text-muted">Monitor and track {selectedTab} metrics</p>
                </div>
              </div>
              <Select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                options={periodOptions}
                className="w-32"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
              {/* Metrics Sidebar */}
              <div className="lg:col-span-1">
                <Card>
                  <h3 className="text-lg font-semibold text-text-high mb-4">Metrics</h3>
                  <div className="space-y-2">
                    {availableMetrics.map((metric) => (
                      <button
                        key={metric.value}
                        onClick={() => setSelectedMetric(metric.value)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center space-x-3 ${
                          selectedMetric === metric.value
                            ? 'text-text-high'
                            : 'text-text-muted hover:text-text-high hover:bg-white/5'
                        }`}
                        style={{
                          backgroundColor: selectedMetric === metric.value ? `${currentCategory.color}20` : 'transparent'
                        }}
                      >
                        <i className={`fa-solid ${getMetricIcon(metric.value)} text-sm`}></i>
                        <span className="text-sm">{metric.label}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Main Chart */}
              <div className="lg:col-span-3">
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-text-high">
                      {availableMetrics.find(m => m.value === selectedMetric)?.label || 'Employee Satisfaction (%)'}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-text-muted">Actual</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-text-muted">Target</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                        <span className="text-text-muted">Benchmark</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                          domain={[0, 100]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke={currentCategory.color} 
                          strokeWidth={3}
                          dot={{ fill: currentCategory.color, strokeWidth: 2, r: 5 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="target" 
                          stroke="#3DAEFF" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="benchmark" 
                          stroke="#9CA3AF" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Performance vs Target */}
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-text-high">Performance vs Target</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                        domain={[0, 100]}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        <Cell fill={currentCategory.color} />
                        <Cell fill="#3DAEFF" />
                        <Cell fill="#20C5C5" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Key Metrics Summary */}
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-text-high">Key Metrics Summary</h3>
                  <span className="text-xs text-text-muted">Current Performance</span>
                </div>
                <div className="space-y-3">
                  {keyMetricsSummary.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-text-high">{metric.name}</div>
                        <div className="text-xs text-text-muted">{metric.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-text-high">{metric.value}</div>
                        <div className={`text-xs font-medium flex items-center justify-end ${
                          metric.status === 'up' ? 'text-green-400' :
                          metric.status === 'down' ? 'text-red-400' :
                          'text-yellow-400'
                        }`}>
                          {metric.change}
                          {metric.change && metric.status === 'up' && ' ↑'}
                          {metric.change && metric.status === 'down' && ' ↓'}
                          {metric.change && metric.status === 'stable' && ' →'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}

        {/* Overview Tab Content */}
        {selectedTab === 'overview' && (
          <OverviewContent 
            company={company}
            trendData={trendData}
            emissionsData={emissionsData}
            taskStats={taskStats}
            realProgress={realProgress}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            filters={filters}
            setFilters={setFilters}
          />
        )}
      </div>
    </Layout>
  );
};

// Overview Content Component
const OverviewContent = ({ company, trendData, emissionsData, taskStats, realProgress, showFilters, setShowFilters, filters, setFilters }) => {
  // Apply category filter to progress data
  const filteredProgress = React.useMemo(() => {
    if (filters.category === 'all') {
      return realProgress;
    }
    
    // Show only the selected category
    const filtered = {
      environmental: filters.category === 'environmental' ? realProgress.environmental : 0,
      social: filters.category === 'social' ? realProgress.social : 0,
      governance: filters.category === 'governance' ? realProgress.governance : 0,
      overall: realProgress[filters.category] || 0
    };
    
    return filtered;
  }, [realProgress, filters.category]);

  // Filter trend data based on filters
  const filteredTrendData = React.useMemo(() => {
    if (filteredProgress.overall === 0) return [];
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, index) => ({
      month,
      environmental: filters.category === 'all' || filters.category === 'environmental' 
        ? Math.min(filteredProgress.environmental, (index + 1) * 15) : 0,
      social: filters.category === 'all' || filters.category === 'social' 
        ? Math.min(filteredProgress.social, (index + 1) * 17) : 0,
      governance: filters.category === 'all' || filters.category === 'governance' 
        ? Math.min(filteredProgress.governance, (index + 1) * 16) : 0,
    }));
  }, [filteredProgress, filters.category]);

  // Filter emissions data based on filters  
  const filteredEmissionsData = React.useMemo(() => {
    if (filteredProgress.overall === 0) return [];
    
    const data = [
      { name: 'Environmental', value: filteredProgress.environmental, color: '#2EC57D' },
      { name: 'Social', value: filteredProgress.social, color: '#3DAEFF' },
      { name: 'Governance', value: filteredProgress.governance, color: '#20C5C5' },
    ];
    
    // Filter based on category selection
    if (filters.category !== 'all') {
      return data.filter(item => 
        item.name.toLowerCase() === filters.category && item.value > 0
      );
    }
    
    return data.filter(item => item.value > 0);
  }, [filteredProgress, filters.category]);

  return (
    <>
      {/* Header with Filter Controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-high">ESG Dashboard Overview</h2>
          <p className="text-text-muted">Monitor your ESG performance and progress</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <i className="fa-solid fa-filter mr-2"></i>
          Filter
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Category"
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              options={[
                { value: 'all', label: 'All Categories' },
                { value: 'environmental', label: 'Environmental' },
                { value: 'social', label: 'Social' },
                { value: 'governance', label: 'Governance' }
              ]}
            />
            <Select
              label="Time Period"
              value={filters.period}
              onChange={(e) => setFilters({...filters, period: e.target.value})}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'annually', label: 'Annually' }
              ]}
            />
            <Select
              label="Data Source"
              value={filters.dataSource}
              onChange={(e) => setFilters({...filters, dataSource: e.target.value})}
              options={[
                { value: 'all', label: 'All Sources' },
                { value: 'file_data', label: 'Uploaded Files' },
                { value: 'task_progress', label: 'Task Progress' },
                { value: 'manual_entry', label: 'Manual Entry' }
              ]}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-text-muted">
              Viewing {filters.category !== 'all' ? filters.category : 'all'} data for {filters.period} period
            </span>
            <Button
              variant="outline"
              size="small"
              onClick={() => setFilters({ category: 'all', period: 'monthly', dataSource: 'all' })}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-muted">Overall ESG Score</h3>
            <i className="fa-solid fa-chart-pie text-brand-green"></i>
          </div>
          <div className="text-2xl font-bold mb-2" style={{
            color: filteredProgress.overall > 0 ? '#2EC57D' : 'rgba(248,249,250,0.72)'
          }}>
            {filteredProgress.overall > 0 ? Math.round(filteredProgress.overall) : '–'}%
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs" style={{
              color: filteredProgress.overall > 0 ? '#2EC57D' : 'rgba(248,249,250,0.72)'
            }}>
              {filteredProgress.overall > 0 ? 'Based on evidence uploads' : 'No evidence uploaded'}
            </span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-muted">Environmental</h3>
            <i className="fa-solid fa-leaf text-brand-green"></i>
          </div>
          <div className="text-2xl font-bold mb-2" style={{
            color: filteredProgress.environmental > 0 ? '#2EC57D' : 'rgba(248,249,250,0.72)'
          }}>
            {filteredProgress.environmental > 0 ? Math.round(filteredProgress.environmental) : '–'}%
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs" style={{
              color: filteredProgress.environmental > 0 ? '#2EC57D' : 'rgba(248,249,250,0.72)'
            }}>
              {filteredProgress.environmental > 0 ? 'Based on uploaded evidence' : 'No evidence uploaded'}
            </span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-muted">Social</h3>
            <i className="fa-solid fa-users text-brand-blue"></i>
          </div>
          <div className="text-2xl font-bold mb-2" style={{
            color: filteredProgress.social > 0 ? '#3DAEFF' : 'rgba(248,249,250,0.72)'
          }}>
            {filteredProgress.social > 0 ? Math.round(filteredProgress.social) : '–'}%
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs" style={{
              color: filteredProgress.social > 0 ? '#3DAEFF' : 'rgba(248,249,250,0.72)'
            }}>
              {filteredProgress.social > 0 ? 'Based on uploaded evidence' : 'No evidence uploaded'}
            </span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-muted">Governance</h3>
            <i className="fa-solid fa-shield-halved text-brand-teal"></i>
          </div>
          <div className="text-2xl font-bold mb-2" style={{
            color: filteredProgress.governance > 0 ? '#20C5C5' : 'rgba(248,249,250,0.72)'
          }}>
            {filteredProgress.governance > 0 ? Math.round(filteredProgress.governance) : '–'}%
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs" style={{
              color: filteredProgress.governance > 0 ? '#20C5C5' : 'rgba(248,249,250,0.72)'
            }}>
              {filteredProgress.governance > 0 ? 'Based on uploaded evidence' : 'No evidence uploaded'}
            </span>
          </div>
        </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Trends Chart */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-high">ESG Trends</h3>
            </div>
            <div className="h-64">
              {filteredTrendData && filteredTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="environmental" 
                      stroke="#2EC57D" 
                      strokeWidth={2}
                      dot={{ fill: '#2EC57D', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="social" 
                      stroke="#3DAEFF" 
                      strokeWidth={2}
                      dot={{ fill: '#3DAEFF', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="governance" 
                      stroke="#20C5C5" 
                      strokeWidth={2}
                      dot={{ fill: '#20C5C5', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <i className="fa-solid fa-chart-line text-4xl text-text-muted mb-4"></i>
                    <p className="text-text-muted">No trend data available</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Progress Breakdown */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-high">Progress Breakdown</h3>
            </div>
            <div className="h-64">
              {filteredEmissionsData && filteredEmissionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filteredEmissionsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {filteredEmissionsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <i className="fa-solid fa-chart-pie text-4xl text-text-muted mb-4"></i>
                    <p className="text-text-muted">No progress data available</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Priority Recommendations */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-high">Priority Recommendations</h3>
            </div>
            {filteredProgress.overall > 0 ? (
              <div className="space-y-4">
                {filteredProgress.environmental < 70 && (filters.category === 'all' || filters.category === 'environmental') && (
                  <div className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg">
                    <div className="w-3 h-3 bg-brand-green rounded-full mt-2"></div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium mb-1 text-text-high">Improve Environmental Performance</h4>
                      <p className="text-xs text-text-muted mb-2">Upload more environmental evidence</p>
                      <span className="text-xs bg-brand-green/20 text-brand-green px-2 py-1 rounded">High Impact</span>
                    </div>
                  </div>
                )}
                
                {filteredProgress.social < 70 && (filters.category === 'all' || filters.category === 'social') && (
                  <div className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg">
                    <div className="w-3 h-3 bg-brand-blue rounded-full mt-2"></div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium mb-1 text-text-high">Enhance Social Programs</h4>
                      <p className="text-xs text-text-muted mb-2">Complete social category tasks</p>
                      <span className="text-xs bg-brand-blue/20 text-brand-blue px-2 py-1 rounded">Medium Impact</span>
                    </div>
                  </div>
                )}
                
                {filteredProgress.governance < 70 && (filters.category === 'all' || filters.category === 'governance') && (
                  <div className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg">
                    <div className="w-3 h-3 bg-brand-teal rounded-full mt-2"></div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium mb-1 text-text-high">Strengthen Governance</h4>
                      <p className="text-xs text-text-muted mb-2">Complete governance tasks</p>
                      <span className="text-xs bg-brand-teal/20 text-brand-teal px-2 py-1 rounded">Low Impact</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-lightbulb text-2xl text-text-muted"></i>
                </div>
                <h3 className="text-text-high font-semibold text-lg mb-2">No Recommendations</h3>
                <p className="text-text-muted">Complete your ESG assessment to receive recommendations</p>
              </div>
            )}
          </Card>

          {/* Targets & Progress */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-high">2025 Targets & Progress</h3>
            </div>
            {filteredProgress.overall > 0 ? (
              <div className="space-y-6">
                {filteredProgress.environmental > 0 && (filters.category === 'all' || filters.category === 'environmental') && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-text-high">Environmental Score</span>
                      <span className="text-sm text-brand-green">{Math.round(filteredProgress.environmental)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-brand-green h-2 rounded-full" style={{ width: `${filteredProgress.environmental}%` }}></div>
                    </div>
                  </div>
                )}

                {filteredProgress.social > 0 && (filters.category === 'all' || filters.category === 'social') && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-text-high">Social Score</span>
                      <span className="text-sm text-brand-blue">{Math.round(filteredProgress.social)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-brand-blue h-2 rounded-full" style={{ width: `${filteredProgress.social}%` }}></div>
                    </div>
                  </div>
                )}

                {filteredProgress.governance > 0 && (filters.category === 'all' || filters.category === 'governance') && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-text-high">Governance Score</span>
                      <span className="text-sm text-brand-teal">{Math.round(filteredProgress.governance)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-brand-teal h-2 rounded-full" style={{ width: `${filteredProgress.governance}%` }}></div>
                    </div>
                  </div>
                )}

                {taskStats.total > 0 && (
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">Tasks Overview</span>
                      <div className="flex space-x-4">
                        <span className="text-brand-green">{taskStats.completed} completed</span>
                        <span className="text-brand-blue">{taskStats.inProgress} in progress</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-bullseye text-2xl text-text-muted"></i>
                </div>
                <h3 className="text-text-high font-semibold text-lg mb-2">No Targets Set</h3>
                <p className="text-text-muted">Set up your ESG targets to track progress</p>
              </div>
            )}
          </Card>
        </div>
    </>
  );
};

// Tracker Content Component - Category-specific content
const TrackerContent = ({ selectedTab, realProgress, company, tasks }) => {
  const getTabColor = () => {
    switch (selectedTab) {
      case 'environmental': return '#2EC57D';
      case 'social': return '#3DAEFF';
      case 'governance': return '#20C5C5';
      default: return '#2EC57D';
    }
  };

  const getTabIcon = () => {
    switch (selectedTab) {
      case 'environmental': return 'fa-leaf';
      case 'social': return 'fa-users';
      case 'governance': return 'fa-shield-halved';
      default: return 'fa-chart-line';
    }
  };

  const getTabProgress = () => {
    switch (selectedTab) {
      case 'environmental': return realProgress.environmental;
      case 'social': return realProgress.social;
      case 'governance': return realProgress.governance;
      default: return 0;
    }
  };

  const getTabTasks = () => {
    // Use real API data instead of hardcoded tasks
    let taskList = [];
    
    if (Array.isArray(tasks)) {
      taskList = tasks;
    } else if (tasks && Array.isArray(tasks.results)) {
      taskList = tasks.results;
    } else if (tasks && Array.isArray(tasks.data)) {
      taskList = tasks.data;
    }
    
    // Filter tasks by the selected category
    const categoryTasks = taskList.filter(task => {
      const normalizedCategory = normalizeCategory(task.category);
      return normalizedCategory === selectedTab;
    });
    
    // Convert API task format to display format
    return categoryTasks.map(task => ({
      name: task.title,
      status: task.status,
      progress: task.progress_percentage || 0
    }));
  };

  const tabProgress = getTabProgress();
  const tabColor = getTabColor();
  const tabIcon = getTabIcon();
  const tabTasks = getTabTasks();

  return (
    <div className="space-y-8">
      {/* Category Header */}
      <div className="text-center py-8">
        <div 
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: `${tabColor}20` }}
        >
          <i className={`fas ${tabIcon} text-3xl`} style={{ color: tabColor }}></i>
        </div>
        <h2 className="text-2xl font-bold text-text-high mb-2 capitalize">{selectedTab}</h2>
        <div className="text-3xl font-bold mb-4" style={{ color: tabColor }}>
          {tabProgress > 0 ? `${tabProgress}%` : '–%'}
        </div>
        <p className="text-text-muted">
          {tabProgress > 0 ? `${selectedTab} category performance` : `No ${selectedTab} data available`}
        </p>
      </div>

      {/* Progress Bar */}
      <Card>
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-text-high capitalize">{selectedTab} Progress</span>
            <span className="text-sm" style={{ color: tabColor }}>{tabProgress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div 
              className="h-3 rounded-full transition-all duration-1000" 
              style={{ 
                width: `${tabProgress}%`,
                backgroundColor: tabColor
              }}
            ></div>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Based on completed evidence uploads and task submissions
        </p>
      </Card>

      {/* Tasks Overview */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-high capitalize">{selectedTab} Tasks</h3>
          <span className="text-sm text-text-muted">{tabTasks.length} tasks</span>
        </div>
        
        {tabTasks.length > 0 ? (
          <div className="space-y-4">
            {tabTasks.map((task, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div 
                    className={`w-3 h-3 rounded-full ${
                      task.status === 'completed' ? 'bg-green-500' : 
                      task.status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-500'
                    }`}
                  ></div>
                  <span className="text-sm font-medium text-text-high">{task.name}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-text-muted capitalize">{task.status.replace('_', ' ')}</span>
                  <div className="w-20 bg-white/10 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full" 
                      style={{ 
                        width: `${task.progress}%`,
                        backgroundColor: tabColor
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className={`fas ${tabIcon} text-2xl text-text-muted`}></i>
            </div>
            <h3 className="text-text-high font-semibold text-lg mb-2">No Tasks Available</h3>
            <p className="text-text-muted">No {selectedTab.toLowerCase()} tasks have been assigned yet</p>
          </div>
        )}
      </Card>

      {/* Category-specific Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-high">Key Metrics</h3>
          </div>
          <div className="space-y-4">
            {selectedTab === 'environmental' && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Energy Consumption</span>
                  <span className="text-sm font-medium text-text-high">12.5 kWh</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Water Usage</span>
                  <span className="text-sm font-medium text-text-high">45.2 L</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Waste Generated</span>
                  <span className="text-sm font-medium text-text-high">2.1 kg</span>
                </div>
              </>
            )}
            
            {selectedTab === 'social' && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Employee Satisfaction</span>
                  <span className="text-sm font-medium text-text-high">85%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Training Hours</span>
                  <span className="text-sm font-medium text-text-high">120h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Community Investment</span>
                  <span className="text-sm font-medium text-text-high">$15,000</span>
                </div>
              </>
            )}
            
            {selectedTab === 'governance' && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Board Meetings</span>
                  <span className="text-sm font-medium text-text-high">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Compliance Score</span>
                  <span className="text-sm font-medium text-text-high">98%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Policy Updates</span>
                  <span className="text-sm font-medium text-text-high">3</span>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-high">Performance Trend</h3>
          </div>
          <div className="h-40 flex items-center justify-center">
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${tabColor}20` }}
              >
                <i className="fa-solid fa-chart-line text-2xl" style={{ color: tabColor }}></i>
              </div>
              <p className="text-text-muted text-sm">Detailed trends coming soon</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;